import type { ReportItem, ReportOutcome, SyncOutcome, SyncPlan } from "../types.ts";

/** Política de resultado: nunca "OK" sem releitura confirmada; um item não resolvido rebaixa para PARTIAL. */
const itemOutcomes = (plan: SyncPlan, resolvedOutcome: ReportOutcome): ReportItem[] => plan.itemResults.map((item) => ({
  songId: item.songId,
  position: item.position,
  outcome: item.status === "resolved"
    ? resolvedOutcome
    : item.status === "repeated"
      ? "duplicate"
      : "skipped",
}));

const hasUnresolved = (plan: SyncPlan): boolean => plan.itemResults.some((item) => item.status !== "resolved");

export const outcomeNoTargets = (plan: SyncPlan): SyncOutcome =>
  ({ status: "FAILED", applied: false, verified: false, plan, reportItems: itemOutcomes(plan, "skipped") });

export const outcomeUnchanged = (plan: SyncPlan): SyncOutcome =>
  ({ status: plan.hasRepeated ? "PARTIAL" : "OK", applied: false, verified: true, plan, reportItems: itemOutcomes(plan, "unchanged") });

export const outcomeMismatch = (plan: SyncPlan, actualIds: string[]): SyncOutcome =>
  ({ status: "FAILED", applied: true, verified: false, plan, actualIds, reportItems: itemOutcomes(plan, "failed") });

export const outcomeVerified = (plan: SyncPlan, actualIds: string[]): SyncOutcome =>
  ({ status: hasUnresolved(plan) ? "PARTIAL" : "OK", applied: true, verified: true, plan, actualIds, reportItems: itemOutcomes(plan, "added") });

interface ApplyFailure { code?: string; restored?: boolean; restorationError?: string | null }

export const outcomeError = (plan: SyncPlan, error: unknown): SyncOutcome => {
  const failure = (error ?? {}) as ApplyFailure;
  return {
    status: "FAILED",
    applied: true,
    verified: false,
    plan,
    error: error instanceof Error ? error.message : String(error),
    errorCode: failure.code ?? "APPLY_FAILED",
    restored: failure.restored === true,
    restorationError: failure.restorationError ?? null,
    reportItems: itemOutcomes(plan, "failed"),
  };
};
