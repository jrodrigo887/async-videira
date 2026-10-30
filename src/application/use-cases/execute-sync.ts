import type { CatalogSong, SetlistItem, SyncOutcome } from "../../domain/types.ts";
import type { SyncAdapter } from "../ports/index.ts";
import { idsOf, sameSequence } from "../../domain/shared/ids.ts";
import { planSync } from "../../domain/sync/sync-plan.ts";
import { outcomeError, outcomeMismatch, outcomeNoTargets, outcomeUnchanged, outcomeVerified } from "../../domain/sync/sync-outcome.ts";

/**
 * Execute a plan through an adapter. A successful write is never reported as OK
 * until an independent post-apply playlist read matches the deduplicated target.
 */
export async function executeSync({ items, catalog, adapter, beforeWrite }: {
  items: SetlistItem[];
  catalog: CatalogSong[];
  adapter: SyncAdapter;
  /** Chamado depois do plano e ANTES da primeira escrita (aqui nasce o journal do apply). */
  beforeWrite?: (write: { backupIds: string[]; targetIds: string[] }) => Promise<void>;
}): Promise<SyncOutcome> {
  const current = idsOf(await adapter.getPlaylist());
  const plan = planSync({ items, catalog, currentIds: current });

  if (plan.targetIds.length === 0) return outcomeNoTargets(plan);
  if (!plan.mutates) return outcomeUnchanged(plan);

  await beforeWrite?.({ backupIds: current, targetIds: plan.targetIds });
  try {
    await adapter.applyOrder(plan.targetIds);
    const actual = idsOf(await adapter.getPlaylist());
    if (!sameSequence(actual, plan.targetIds)) return outcomeMismatch(plan, actual);
    return outcomeVerified(plan, actual);
  } catch (error) {
    return outcomeError(plan, error);
  }
}
