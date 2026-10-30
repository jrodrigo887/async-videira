import { coded } from "../../domain/shared/errors.ts";
import { idsOf, sameSequence } from "../../domain/shared/ids.ts";
import type { Deps } from "../ports/index.ts";
import { publish } from "../services/events.ts";

/** Onde a playlist do Holyrics está agora em relação ao que o apply interrompido pretendia. */
export type PlaylistPosition = "target" | "backup" | "other";

export type RecoveryReport =
  | { status: "none" }
  | { status: "interrupted"; setlistId: string; at: string; playlist: PlaylistPosition; backupCount: number; targetCount: number; canRestore: boolean }
  | { status: "restored"; setlistId: string }
  | { status: "dismissed"; setlistId: string };

export type RecoveryAction = "inspect" | "restore" | "dismiss";

/**
 * Na abertura do app: um journal `started` sem `done` significa que o apply foi interrompido (queda de energia,
 * encerramento forçado). Relê a playlist e compara com o que foi planejado, mas nunca presume sucesso:
 * restaurar a playlist anterior ou dispensar o aviso são decisões do operador (`action`).
 */
export async function recoverInterruptedApply(deps: Deps, { action = "inspect" }: { action?: RecoveryAction } = {}): Promise<RecoveryReport> {
  const state = await deps.state.load();
  const journal = state.journal;
  if (!journal || journal.phase !== "started") return { status: "none" };

  if (action === "dismiss") {
    await deps.state.save({ ...state, journal: null });
    return { status: "dismissed", setlistId: journal.setlistId };
  }

  const current = idsOf(await deps.holyrics.getPlaylist());
  const playlist: PlaylistPosition = sameSequence(current, journal.targetIds) ? "target" : sameSequence(current, journal.backupIds) ? "backup" : "other";
  // O Holyrics recusa trocar a playlist por uma lista vazia, então uma playlist anterior vazia não é restaurável por aqui.
  const canRestore = journal.backupIds.length > 0;

  if (action === "inspect") {
    return { status: "interrupted", setlistId: journal.setlistId, at: journal.at, playlist, backupCount: journal.backupIds.length, targetCount: journal.targetIds.length, canRestore };
  }

  if (!canRestore) throw coded("INVALID_REQUEST", "A playlist anterior estava vazia; limpe a playlist no Holyrics e dispense o aviso.");
  try {
    if (playlist !== "backup") await deps.holyrics.applyOrder(journal.backupIds);
  } catch (error) {
    await publish(deps, { type: "PlaylistRestored", ok: false });
    throw error;
  }
  await deps.state.save({ ...state, journal: null });
  await publish(deps, { type: "PlaylistRestored", ok: true });
  return { status: "restored", setlistId: journal.setlistId };
}
