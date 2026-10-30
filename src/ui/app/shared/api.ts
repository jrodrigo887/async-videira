// Ponte tipada entre a UI e o processo principal: `call("comando", entrada)` devolve a saída desse comando.
// O mapa abaixo espelha o manifesto em src/interface/electron/ipc/commands.ts (os nomes vivem lá).
import type { RecoveryAction, RecoveryReport } from "../../../application/use-cases/recover-interrupted-apply.ts";
import type { PreparationView } from "../../../application/use-cases/prepare-worship.ts";
import type { AuditEntry } from "../../../domain/audit/audit-entry.ts";
import type { HelpListItem } from "../../../domain/help/help-topics.ts";
import type { CatalogSong, CredentialTarget, Settings } from "../../../domain/types.ts";
import type { ProgressMessage } from "../../../application/services/progress-forwarder.ts";
import type { CoreError } from "../../../interface/electron/ipc/types.ts";

export type HelpEntry = Pick<HelpListItem, "id" | "title" | "summary" | "context">;
export interface HelpArticle { id: string; topicId: string; title: string; markdown: string }
export interface LinkConfirmation { videiraSongId: string; holyricsSongId: string }
export interface LinkOutcome extends LinkConfirmation { outcome: string }

export interface CommandMap {
  "settings.get": { input: void; output: Settings };
  "settings.update": { input: Settings; output: Settings };
  "service.credentials.set": { input: { target: CredentialTarget; token: string }; output: { configured: boolean } };
  "service.credentials.status": { input: void; output: Record<CredentialTarget, boolean> };
  "logs.list": { input: void; output: AuditEntry[] };
  "connection.check": { input: { target: CredentialTarget; token?: string | undefined; url?: string }; output: { connected: boolean; version?: string | null; count?: number } };
  "connection.probe": { input: { target: CredentialTarget }; output: { connected: boolean } };
  "songLinks.confirmBatch": { input: { confirmations: LinkConfirmation[] }; output: { outcomes: LinkOutcome[] } };
  "songLinks.remove": { input: { videiraSongId: string }; output: { removed: boolean } };
  "song.openEditor": { input: { videiraSongId: string }; output: { opened: boolean; lyricsFilled: boolean } };
  "song.awaitCreated": { input: void; output: { state: "created" | "ambiguous" | "not-found"; songs: CatalogSong[] } };
  "worship.prepare": { input: { setlistId?: string }; output: { text: string; status: string; preparation: PreparationView } };
  "worship.apply": { input: void; output: { text: string; status: string; preparation: null } };
  "worship.recover": { input: { action?: RecoveryAction }; output: RecoveryReport };
  "help.list": { input: void; output: HelpEntry[] };
  "help.get": { input: { topicId: string }; output: HelpArticle | null };
  "help.search": { input: { query: string; limit?: number }; output: HelpEntry[] };
  "externalLink.open": { input: { url: string }; output: { opened: boolean } };
}

type IpcResult = { ok: true; data: unknown } | { ok: false; error?: CoreError };

export interface AsyncVideiraBridge {
  invoke(command: string, payload?: unknown): Promise<IpcResult>;
  /** Ausente fora do Electron (web-shim). */
  onProgress?(listener: (message: ProgressMessage) => void): () => void;
}

declare global {
  interface Window { asyncVideira: AsyncVideiraBridge }
}

/** Erro de uma chamada: a UI decide o texto pelo `code` (catálogo), nunca pela mensagem. */
export class CallError extends Error {
  code: string;

  constructor(messageKey: string, code: string) {
    super(messageKey);
    this.name = "CallError";
    this.code = code;
  }
}

export const codeOf = (error: unknown): string => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : "INTERNAL";
};

type Args<K extends keyof CommandMap> = CommandMap[K]["input"] extends void ? [] : [payload: CommandMap[K]["input"]];

export async function call<K extends keyof CommandMap>(name: K, ...args: Args<K>): Promise<CommandMap[K]["output"]> {
  const response = await window.asyncVideira.invoke(name, args[0]);
  if (!response.ok) throw new CallError(response.error?.messageKey ?? "operation.failed", response.error?.code ?? "INTERNAL");
  return response.data as CommandMap[K]["output"];
}

export type Safe<T> = { ok: true; data: T } | { ok: false; code: string };

/** Transforma a chamada em um resultado que a tela trata sem try/catch. */
export async function safely<T>(fn: () => Promise<T>): Promise<Safe<T>> {
  try { return { ok: true, data: await fn() }; } catch (error) { return { ok: false, code: codeOf(error) }; }
}

export type ConfirmResult = { ok: true; outcomes: LinkOutcome[] } | { ok: false; code: string };
