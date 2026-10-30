import { matchSong } from "../linking/song-matcher.ts";
import { sameSequence } from "../shared/ids.ts";
import type { CatalogSong, PlanItem, SetlistItem, SyncPlan } from "../types.ts";

/** Build an inspectable dry-run plan; repeated Holyrics IDs are marked and emitted only once. */
export function planSync({ items, catalog, currentIds = [] }: {
  items: readonly SetlistItem[];
  catalog: readonly CatalogSong[];
  currentIds?: readonly unknown[];
}): SyncPlan {
  const seen = new Set<string>();
  const itemResults = [...items]
    .sort((a, b) => a.position - b.position)
    .map((item): PlanItem => {
      const result = matchSong(item, catalog);
      const base = { position: item.position, songId: item.songId ?? null, title: item.title, artist: item.artist ?? null };
      if (result.kind === "resolved") {
        const status = seen.has(result.id) ? "repeated" : "resolved";
        seen.add(result.id);
        return { ...base, status, holyricsId: result.id, matchedBy: result.via };
      }
      return {
        ...base,
        status: result.kind === "suggested" ? "absent" : result.kind,
        candidates: result.kind === "suggested" ? undefined : result.candidates,
        suggestions: result.kind === "suggested" ? result.candidates : undefined,
        // The Videira link points at an ID this Holyrics library no longer has (reinstall or re-import).
        ...(result.stale ? { staleExternalId: result.stale } : {}),
      };
    });

  const targetIds = itemResults.filter((item) => item.status === "resolved").map((item) => item.holyricsId!);
  return {
    itemResults,
    targetIds,
    hasRepeated: itemResults.some((item) => item.status === "repeated"),
    mutates: targetIds.length > 0 && !sameSequence(targetIds, currentIds.map(String)),
  };
}
