import { normalizeText } from "../shared/text.ts";
import type { CatalogSong, PlanItem, SetlistItem, SongMatch, SyncPlan } from "../types.ts";

/**
 * Resolve um item do setlist contra o catálogo do Holyrics.
 * `resolved` (externalId presente), `suggested` (título+artista exatos, só sugestão), `ambiguous` ou `absent`.
 * `stale` guarda um externalId que o catálogo atual não tem mais.
 */
export function matchSong(item: Pick<SetlistItem, "externalId" | "title" | "artist">, catalog: readonly CatalogSong[]): SongMatch {
  let stale: string | null = null;
  const externalId = item.externalId == null ? "" : String(item.externalId).trim();
  if (externalId) {
    const matches = catalog.filter((entry) => String(entry.id) === externalId);
    if (matches.length === 1) return { kind: "resolved", id: externalId, via: "externalId" };
    if (matches.length > 1) return { kind: "ambiguous", candidates: matches.map((entry) => String(entry.id)) };
    // A stale explicit ID can suggest migration candidates, but must not bind silently.
    stale = externalId;
  }

  const title = normalizeText(item.title);
  const artist = normalizeText(item.artist);
  if (!title || !artist) return { kind: "absent", candidates: [], stale };

  // SearchLyrics may return broad matches; only exact normalized title AND artist qualify.
  const matches = catalog.filter((entry) =>
    normalizeText(entry.title) === title && normalizeText(entry.artist) === artist,
  );
  if (matches.length === 1) return { kind: "suggested", stale, candidates: matches.map((entry) => ({ id: String(entry.id), title: entry.title, artist: entry.artist ?? null })) };
  if (matches.length > 1) return { kind: "ambiguous", stale, candidates: matches.map((entry) => String(entry.id)) };
  return { kind: "absent", candidates: [], stale };
}

/** Regra de oferta: só um par oferecido pela última preparação pode virar vínculo. */
export function offeredIds(item: Pick<PlanItem, "suggestions" | "candidates">, createdIds?: Iterable<string> | null): Set<string> {
  return new Set([
    ...(item.suggestions ?? []).map((song) => String(song.id)),
    ...(item.candidates ?? []).filter((id) => typeof id === "string").map(String),
    ...(createdIds ?? []),
  ]);
}

/** Item da preparação atual identificado pelo ID da música no Videira. */
export const findPlanItem = (plan: SyncPlan | null | undefined, videiraSongId: unknown): PlanItem | undefined =>
  plan?.itemResults.find((candidate) => candidate.songId != null && String(candidate.songId) === String(videiraSongId));
