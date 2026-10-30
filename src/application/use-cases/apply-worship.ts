import { projectCatalog } from "../../domain/catalog/holyrics-catalog.ts";
import { createLibraryFingerprint } from "../../domain/library/fingerprint.ts";
import { isStale } from "../../domain/preparation/preparation.ts";
import { projectSetlist, selectSetlist } from "../../domain/setlist/setlist.ts";
import type { ApplyJournal } from "../../domain/events.ts";
import { publish } from "../services/events.ts";
import { deliverReport, flushPendingReports } from "../services/report-outbox.ts";
import type { Deps } from "../ports/index.ts";
import { executeSync } from "./execute-sync.ts";

/**
 * Aplica a preparação vigente na playlist do Holyrics, depois de revalidar tudo contra o estado atual.
 * Devolve o resultado da sincronização e se o relatório ficou na fila.
 */
export async function applyWorship(deps: Deps, { setlistId }: { setlistId?: string | number | null } = {}) {
  const { videira, holyrics, state: repository, clock, hash } = deps;
  await publish(deps, { type: "OperationPhaseChanged", operation: "apply", phase: "validating" });
  const state = await flushPendingReports(deps);
  const prepared = state.prepared;
  if (!prepared) throw new Error("Nenhuma preparação válida encontrada; execute preparar primeiro.");
  if (setlistId && String(setlistId) !== String(prepared.setlistId)) {
    throw new Error("SETLIST_ID differs from the prepared setlist; execute preparar again.");
  }

  const listed = await videira.listPublishedSetlists();
  if (!selectSetlist(listed.setlists, prepared.setlistId)) throw new Error("The prepared setlist is no longer published; execute preparar again.");
  const detail = await videira.getPublishedSetlist(prepared.setlistId);
  const ping = await holyrics.ping();
  const rawCatalog = await holyrics.getCatalog();
  const schedule = await holyrics.getCurrentSchedule();
  const setlist = projectSetlist(detail);
  const catalog = projectCatalog(rawCatalog);
  const fingerprint = createLibraryFingerprint(ping, catalog, hash);
  if (isStale(prepared, { setlist, catalog, fingerprint, schedule }, hash)) {
    throw new Error("Videira data, Holyrics catalog, library or selected schedule changed since preparar; prepare again.");
  }

  await publish(deps, { type: "OperationPhaseChanged", operation: "apply", phase: "writing" });
  let working = state;
  const result = await executeSync({
    items: setlist.items,
    catalog,
    adapter: holyrics,
    // Durável ANTES da primeira escrita: se o app cair no meio do Remove+Add, a próxima abertura sabe o que restaurar.
    beforeWrite: async ({ backupIds, targetIds }) => {
      const journal: ApplyJournal = { phase: "started", setlistId: prepared.setlistId, backupIds, targetIds, at: clock.now().toISOString() };
      working = { ...state, journal };
      await repository.save(working);
      await publish(deps, { type: "ApplyStarted", setlistId: prepared.setlistId, backupIds, targetIds });
    },
  });
  await publish(deps, { type: "OperationPhaseChanged", operation: "apply", phase: "reporting" });
  const { queued } = await deliverReport(deps, working, {
    setlistId: prepared.setlistId,
    status: result.status,
    holyricsVersion: String(ping.version?.version ?? "unknown"),
    items: result.reportItems,
    libraryFingerprint: fingerprint,
  });
  await repository.save({
    ...working,
    prepared: null,
    journal: { phase: "done", setlistId: prepared.setlistId, status: result.status, at: clock.now().toISOString() },
    pendingReports: working.pendingReports,
    migration: { ...working.migration, previousFingerprint: fingerprint, status: "observed" },
    lastRun: {
      setlistId: prepared.setlistId,
      status: result.status,
      verified: result.verified,
      ...(result.status === "FAILED" ? { errorCode: result.errorCode, restored: result.restored } : {}),
      finishedAt: clock.now().toISOString(),
    },
  });
  await publish(deps, { type: "PlaylistApplied", setlistId: prepared.setlistId, status: result.status, verified: result.verified });
  return { title: prepared.title, setlistId: prepared.setlistId, result, reportQueued: queued };
}

export type AppliedWorship = Awaited<ReturnType<typeof applyWorship>>;
