import { projectCatalog } from "../../domain/catalog/holyrics-catalog.ts";
import { createLibraryFingerprint, libraryMoved } from "../../domain/library/fingerprint.ts";
import { createPreparation } from "../../domain/preparation/preparation.ts";
import { coded } from "../../domain/shared/errors.ts";
import { idsOf } from "../../domain/shared/ids.ts";
import { projectSetlist, selectSetlist } from "../../domain/setlist/setlist.ts";
import { planSync } from "../../domain/sync/sync-plan.ts";
import type { Deps } from "../ports/index.ts";
import { publish } from "../services/events.ts";
import { flushPendingReports } from "../services/report-outbox.ts";
import type { CatalogSong, PlanItem } from "../../domain/types.ts";

/**
 * Dry-run: lê Videira e Holyrics, monta o plano e persiste a preparação. Não escreve no Holyrics.
 * Devolve `preparation` (visão para a UI), o `plan` completo e se o Holyrics reportou plano ativo.
 */
export async function prepareWorship(deps: Deps, { date, setlistId }: { date?: string | null; setlistId?: string | number | null } = {}) {
  const { videira, holyrics, state, clock, hash } = deps;
  await publish(deps, { type: "OperationPhaseChanged", operation: "prepare", phase: "reading" });
  const previous = await flushPendingReports(deps);
  const listed = await videira.listPublishedSetlists(date ? { date } : {});
  const chosen = selectSetlist(listed.setlists, setlistId);
  if (!chosen) {
    throw setlistId
      ? new Error("SETLIST_ID is not among the published setlists.")
      : coded("NO_SETLIST", "No published setlist is available.");
  }
  const detail = await videira.getPublishedSetlist(chosen.id);
  const ping = await holyrics.ping();
  const rawCatalog = await holyrics.getCatalog();
  const schedule = await holyrics.getCurrentSchedule();
  const currentPlaylist = await holyrics.getPlaylist();
  const setlist = projectSetlist(detail);
  if (setlist.items.length === 0) throw new Error("The selected published setlist contains no song items.");

  const catalog = projectCatalog(rawCatalog);
  const currentIds = idsOf(currentPlaylist);
  await publish(deps, { type: "OperationPhaseChanged", operation: "prepare", phase: "planning" });
  const plan = planSync({ items: setlist.items, catalog, currentIds });
  const fingerprint = createLibraryFingerprint(ping, catalog, hash);
  const before = previous.migration?.previousFingerprint ?? null;
  const staleCount = plan.itemResults.filter((item) => item.staleExternalId).length;
  const moved = libraryMoved(before, fingerprint);
  const preparedAt = clock.now().toISOString();
  const prepared = createPreparation({ chosenId: chosen.id, setlist, catalog, fingerprint, schedule, plan, preparedAt, hash });

  await state.save({
    ...previous,
    cache: {
      catalog: { items: catalog, fingerprint, readAt: clock.now().toISOString() },
      setlist: { value: setlist, fetchedAt: clock.now().toISOString() },
    },
    prepared,
    migration: { ...previous.migration, previousFingerprint: fingerprint, ...(staleCount > 0 ? { status: "reconciling" } : {}) },
  });

  await publish(deps, { type: "PreparationCreated", setlistId: prepared.setlistId, items: plan.itemResults.length, targets: plan.targetIds.length });

  const preparation: PreparationView = {
    setlist: { id: prepared.setlistId, title: setlist.title, eventAt: setlist.eventAt },
    setlists: listed.setlists.map((entry) => ({ id: String(entry.id), title: entry.title ?? "", eventAt: entry.eventAt ?? null })),
    destination: { name: prepared.schedule.name, type: prepared.schedule.type, datetime: prepared.schedule.datetime, currentCount: currentIds.length },
    holyricsVersion: ping.version?.version ?? null,
    catalogCount: catalog.length,
    items: plan.itemResults.map((item) => (item.candidates?.length ? { ...item, candidateSongs: item.candidates.map((id) => catalog.find((song) => song.id === id)).filter((song): song is CatalogSong => Boolean(song)) } : item)),
    targetCount: plan.targetIds.length,
    hasRepeated: plan.hasRepeated,
    mutates: plan.mutates,
    reconciliation: { active: staleCount > 0 || moved, staleCount, libraryMoved: moved },
  };
  return { preparation, plan, activePlan: Boolean(ping.plan?.type && ping.plan.type !== "none") };
}

export interface PlanItemView extends PlanItem {
  /** Versões do Holyrics entre as quais o operador escolhe, quando a música é ambígua. */
  candidateSongs?: CatalogSong[];
}

/** Visão da preparação para a UI e o IPC: só o que a tela precisa, sem hashes nem estado interno. */
export interface PreparationView {
  setlist: { id: string; title: string; eventAt: string | null };
  setlists: Array<{ id: string; title: string; eventAt: string | null }>;
  destination: { name: string | null; type: string | null; datetime: string | null; currentCount: number };
  holyricsVersion: string | null;
  catalogCount: number;
  items: PlanItemView[];
  targetCount: number;
  hasRepeated: boolean;
  mutates: boolean;
  reconciliation: { active: boolean; staleCount: number; libraryMoved: boolean };
}

export type PreparedWorship = Awaited<ReturnType<typeof prepareWorship>>;
