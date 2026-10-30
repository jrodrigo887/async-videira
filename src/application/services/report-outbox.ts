import type { AppState, Hash, PendingReport, SyncReport } from "../../domain/types.ts";
import type { Deps, WireReport } from "../ports/index.ts";

const MAX_REPORT_ATTEMPTS = 10;
const MAX_REPORT_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** O servidor recebe o fingerprint como texto (hash), não como objeto. */
export function reportForServer(report: SyncReport, hash: Hash): WireReport {
  return {
    ...report,
    libraryFingerprint: typeof report.libraryFingerprint === "string" ? report.libraryFingerprint : hash(report.libraryFingerprint),
  };
}

/** Reenvia a fila de sync-reports pendentes; devolve o estado já persistido. */
export async function flushPendingReports(deps: Deps): Promise<AppState> {
  const { videira, state: repository, clock, hash } = deps;
  const state = await repository.load();
  const now = clock.now().getTime();
  let changed = false;
  const pendingReports: PendingReport[] = [];
  for (const entry of state.pendingReports) {
    const attempts = Number(entry.attemptCount ?? 0);
    const queuedAt = Date.parse(entry.queuedAt ?? "");
    const expired = Number.isFinite(queuedAt) && now - queuedAt > MAX_REPORT_AGE_MS;
    if (attempts >= MAX_REPORT_ATTEMPTS || expired) {
      pendingReports.push(entry);
      continue;
    }
    try {
      await videira.sendSyncReport(reportForServer(entry.report, hash));
      changed = true;
    } catch {
      pendingReports.push({ ...entry, attemptCount: attempts + 1, lastAttemptAt: new Date(now).toISOString() });
      changed = true;
    }
  }
  if (changed) await repository.save({ ...state, pendingReports });
  return { ...state, pendingReports };
}

/** Envia o relatório; se o Videira estiver indisponível, enfileira em `state.pendingReports` (o chamador persiste). */
export async function deliverReport(deps: Deps, state: AppState, report: SyncReport): Promise<{ queued: boolean }> {
  const { videira, clock, hash } = deps;
  try {
    await videira.sendSyncReport(reportForServer(report, hash));
    return { queued: false };
  } catch {
    state.pendingReports.push({ report, queuedAt: clock.now().toISOString(), attemptCount: 1 });
    return { queued: true };
  }
}
