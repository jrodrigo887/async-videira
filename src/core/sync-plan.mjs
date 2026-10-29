const normalize = (value) =>
  typeof value === "string"
    ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim().replace(/\s+/g, " ")
    : "";

const sameSequence = (left, right) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const reportItems = (plan, resolvedOutcome) => plan.itemResults.map((item) => ({
  songId: item.songId,
  position: item.position,
  outcome: item.status === "resolved"
    ? resolvedOutcome
    : item.status === "repeated"
      ? "duplicate"
      : "skipped",
}));

function resolve(item, catalog) {
  const externalId = item.externalId == null ? "" : String(item.externalId).trim();
  if (externalId) {
    const matches = catalog.filter((entry) => String(entry.id) === externalId);
    if (matches.length === 1) return { kind: "resolved", id: externalId, via: "externalId" };
    if (matches.length > 1) return { kind: "ambiguous", candidates: matches.map((entry) => String(entry.id)) };
    // A stale explicit ID can suggest migration candidates, but must not bind silently.
  }

  const title = normalize(item.title);
  const artist = normalize(item.artist);
  if (!title || !artist) return { kind: "absent", candidates: [] };

  // SearchLyrics may return broad matches; only exact normalized title AND artist qualify.
  const matches = catalog.filter((entry) =>
    normalize(entry.title) === title && normalize(entry.artist) === artist,
  );
  if (matches.length === 1) return { kind: "suggested", candidates: matches.map((entry) => ({ id: String(entry.id), title: entry.title, artist: entry.artist ?? null })) };
  if (matches.length > 1) return { kind: "ambiguous", candidates: matches.map((entry) => String(entry.id)) };
  return { kind: "absent", candidates: [] };
}

/** Build an inspectable dry-run plan; repeated Holyrics IDs are marked and emitted only once. */
export function planSync({ items, catalog, currentIds = [] }) {
  const seen = new Set();
  const itemResults = [...items]
    .sort((a, b) => a.position - b.position)
    .map((item) => {
      const result = resolve(item, catalog);
      if (result.kind === "resolved") {
        if (seen.has(result.id)) {
          return { position: item.position, songId: item.songId ?? null, title: item.title, artist: item.artist ?? null, status: "repeated", holyricsId: result.id, matchedBy: result.via };
        }
        seen.add(result.id);
        return { position: item.position, songId: item.songId ?? null, title: item.title, artist: item.artist ?? null, status: "resolved", holyricsId: result.id, matchedBy: result.via };
      }
      return {
        position: item.position,
        songId: item.songId ?? null,
        title: item.title,
        artist: item.artist ?? null,
        status: result.kind === "suggested" ? "absent" : result.kind,
        candidates: result.kind === "suggested" ? undefined : result.candidates,
        suggestions: result.kind === "suggested" ? result.candidates : undefined,
      };
    });

  const targetIds = itemResults.filter((item) => item.status === "resolved").map((item) => item.holyricsId);
  const hasRepeated = itemResults.some((item) => item.status === "repeated");
  return {
    itemResults,
    targetIds,
    hasRepeated,
    mutates: targetIds.length > 0 && !sameSequence(targetIds, currentIds.map(String)),
  };
}

/**
 * Execute a plan through an adapter. A successful write is never reported as OK
 * until an independent post-apply playlist read matches the deduplicated target.
 */
export async function executeSync({ items, catalog, adapter }) {
  const current = (await adapter.getPlaylist()).map((entry) => String(entry.id ?? entry));
  const plan = planSync({ items, catalog, currentIds: current });

  if (plan.targetIds.length === 0) {
    return { status: "FAILED", applied: false, verified: false, plan, reportItems: reportItems(plan, "skipped") };
  }

  if (!plan.mutates) {
    const hasRepeated = plan.itemResults.some((item) => item.status === "repeated");
    const outcomes = plan.itemResults.map((item) => ({
      songId: item.songId,
      position: item.position,
      outcome: item.status === "resolved" ? "unchanged" : item.status === "repeated" ? "duplicate" : "skipped",
    }));
    return { status: hasRepeated ? "PARTIAL" : "OK", applied: false, verified: true, plan, reportItems: outcomes };
  }

  try {
    await adapter.applyOrder(plan.targetIds);
    const actual = (await adapter.getPlaylist()).map((entry) => String(entry.id ?? entry));
    if (!sameSequence(actual, plan.targetIds)) {
      return {
        status: "FAILED",
        applied: true,
        verified: false,
        plan,
        actualIds: actual,
        reportItems: reportItems(plan, "failed"),
      };
    }
    const hasSkipped = plan.itemResults.some((item) => item.status === "ambiguous" || item.status === "absent" || item.status === "repeated");
    return {
      status: hasSkipped ? "PARTIAL" : "OK",
      applied: true,
      verified: true,
      plan,
      actualIds: actual,
      reportItems: reportItems(plan, "added"),
    };
  } catch (error) {
    return {
      status: "FAILED",
      applied: true,
      verified: false,
      plan,
      error: error instanceof Error ? error.message : String(error),
      reportItems: reportItems(plan, "failed"),
    };
  }
}
