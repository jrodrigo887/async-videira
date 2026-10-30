import type { MigrationEntry } from "../../domain/types.ts";
import type { Deps, LinkRequest } from "../ports/index.ts";
import { publish } from "../services/events.ts";
import { coded } from "../../domain/shared/errors.ts";
import { findPlanItem, offeredIds } from "../../domain/linking/song-matcher.ts";
import { GOOD_LINK_OUTCOMES, withHistory } from "../../domain/linking/migration-history.ts";

const MAX_BATCH = 200;

/**
 * Persist operator-confirmed links in Videira. The renderer only names the pair; the pair must have been
 * offered by the last preparation, and title/artist always come from the live Holyrics catalog, not the caller.
 * `created` maps videiraSongId -> Set of Holyrics IDs from the "create song" flow.
 */
export async function confirmSongLinks(deps: Deps, { confirmations, created = new Map() }: { confirmations: unknown; created?: ReadonlyMap<string, Iterable<string>> }) {
  if (!Array.isArray(confirmations) || confirmations.length < 1 || confirmations.length > MAX_BATCH) {
    throw coded("INVALID_REQUEST", "Invalid confirmations.");
  }
  const { state: repository, clock } = deps;
  const state = await repository.load();
  const plan = state.prepared?.plan;
  if (!plan) throw coded("PREPARATION_EXPIRED", "Nenhuma preparação válida; prepare o culto novamente.");

  const { videira, holyrics } = deps;
  const catalog = new Map((await holyrics.getCatalog()).map((song) => [String(song.id), song]));

  const outcomes: Array<{ videiraSongId: string; holyricsSongId: string; outcome: string }> = [];
  const toSend: Array<{ base: { videiraSongId: string; holyricsSongId: string }; body: LinkRequest }> = [];
  const seenVideira = new Set<string>();
  for (const entry of confirmations) {
    const videiraSongId = typeof entry?.videiraSongId === "string" ? entry.videiraSongId : "";
    const holyricsSongId = typeof entry?.holyricsSongId === "string" ? entry.holyricsSongId : "";
    const base = { videiraSongId, holyricsSongId };
    const item = findPlanItem(plan, videiraSongId);
    const song = catalog.get(holyricsSongId);
    if (!item || !song || seenVideira.has(videiraSongId) || !offeredIds(item, created.get(videiraSongId)).has(holyricsSongId)) {
      outcomes.push({ ...base, outcome: "rejected" });
      continue;
    }
    seenVideira.add(videiraSongId);
    toSend.push({ base, body: { songId: videiraSongId, externalId: holyricsSongId, externalTitle: song.title, externalArtist: song.artist || null } });
  }

  if (toSend.length > 0) {
    const results = await videira.confirmSongLinks(toSend.map((entry) => entry.body));
    for (const [index, entry] of toSend.entries()) {
      const outcome = results.find((result) => result.index === index)?.outcome;
      outcomes.push({ ...entry.base, outcome: typeof outcome === "string" ? outcome : "failed" });
    }
    // Links change how the setlist resolves, so the stored plan is stale until the next preparation.
    const at = clock.now().toISOString();
    const migrated: MigrationEntry[] = [];
    for (const entry of toSend) {
      const item = findPlanItem(plan, entry.base.videiraSongId);
      if (item?.staleExternalId && GOOD_LINK_OUTCOMES.includes(outcomes.find((o) => o.videiraSongId === entry.base.videiraSongId)?.outcome ?? "")) {
        migrated.push({ at, songId: entry.base.videiraSongId, oldExternalId: item.staleExternalId, newExternalId: entry.base.holyricsSongId, action: "relinked" });
      }
    }
    await repository.save({ ...state, prepared: null, ...(migrated.length ? { migration: withHistory(state, migrated) } : {}) });
    await publish(deps, { type: "LinksConfirmed", count: outcomes.filter((entry) => GOOD_LINK_OUTCOMES.includes(entry.outcome)).length });
  }
  return { outcomes };
}

/**
 * Removes the Videira link of a song of the current preparation (linked, or pointing at an ID this library lost).
 */
export async function removeSongLink(deps: Deps, { videiraSongId }: { videiraSongId: string }) {
  const { state: repository, clock } = deps;
  const state = await repository.load();
  const item = findPlanItem(state.prepared?.plan, videiraSongId);
  if (!item) throw coded("PREPARATION_EXPIRED", "Música fora da preparação atual.");
  const oldExternalId = item.staleExternalId ?? (item.matchedBy === "externalId" ? item.holyricsId : null);
  if (!oldExternalId) throw coded("INVALID_REQUEST", "Esta música não tem vínculo.");
  const result = await deps.videira.removeSongLink(String(videiraSongId));
  const entry: MigrationEntry = { at: clock.now().toISOString(), songId: String(videiraSongId), oldExternalId: String(oldExternalId), newExternalId: null, action: "unlinked" };
  await repository.save({ ...state, prepared: null, migration: withHistory(state, [entry]) });
  await publish(deps, { type: "LinkRemoved", songId: String(videiraSongId) });
  return { removed: result.removed };
}
