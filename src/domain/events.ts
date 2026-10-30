// Eventos de domínio: fatos já ocorridos, imutáveis, no passado. Só notificam (log, histórico, progresso);
// nenhuma decisão de negócio depende de quem os escuta. Publicados DEPOIS da mudança durável.
import type { CredentialTarget, SyncStatus } from "./types.ts";

export type OperationKind = "prepare" | "apply" | "connection" | "recover";

export type DomainEvent =
  | { type: "AppStarted" }
  | { type: "SettingsUpdated" }
  | { type: "CredentialsSaved"; target: CredentialTarget }
  | { type: "OperationStarted"; operation: OperationKind; target?: CredentialTarget }
  | { type: "OperationPhaseChanged"; operation: OperationKind; phase: string }
  | { type: "OperationSucceeded"; operation: OperationKind; status?: "prepared" | "complete"; count?: number; target?: CredentialTarget }
  | { type: "OperationFailed"; operation: OperationKind; code: string; target?: CredentialTarget }
  | { type: "PreparationCreated"; setlistId: string; items: number; targets: number }
  | { type: "ApplyStarted"; setlistId: string; backupIds: string[]; targetIds: string[] }
  | { type: "PlaylistApplied"; setlistId: string; status: SyncStatus; verified: boolean }
  | { type: "PlaylistRestored"; ok: boolean }
  | { type: "LinksConfirmed"; count: number }
  | { type: "LinkRemoved"; songId: string };

export type DomainEventType = DomainEvent["type"];

/**
 * Registro durável de um apply em andamento. `started` é gravado ANTES da primeira escrita no Holyrics,
 * com a playlist anterior (`backupIds`) e a pretendida (`targetIds`); `done` só depois do desfecho.
 * Um `started` sem `done` na inicialização significa que o app caiu no meio do Remove+Add.
 */
export type ApplyJournal =
  | { phase: "started"; setlistId: string; backupIds: string[]; targetIds: string[]; at: string }
  | { phase: "done"; setlistId: string; status: SyncStatus; at: string };
