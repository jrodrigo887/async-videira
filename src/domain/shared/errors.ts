/** Campos de um código: `messageKey` (padrão "operation.failed"), `retryable` (padrão false), `helpTopic` (opcional). */
interface ErrorEntry {
  messageKey?: string;
  retryable?: boolean;
  helpTopic?: string;
}

/**
 * Catálogo único de códigos de erro. É daqui que saem: a chave de mensagem e o "tentar de novo" da UI,
 * o tópico de ajuda (ADR 0009) e a allowlist de códigos do log de atividade.
 * Adaptadores traduzem falhas externas para estes códigos na borda (HTTP 401 → AUTH_REJECTED etc.);
 * ninguém classifica erro lendo o texto da mensagem.
 */
export const ERRORS = Object.freeze({
  AUTH_REQUIRED: { messageKey: "credentials.required" },
  AUTH_REJECTED: { messageKey: "credentials.rejected", helpTopic: "configurar-holyrics" },
  SERVICE_UNAVAILABLE: { messageKey: "service.unavailable", retryable: true },
  TIMEOUT: {},
  INTERNAL: {},
  INVALID_REQUEST: {},
  NO_SETLIST: {},
  PREPARATION_EXPIRED: {},
  HOLYRICS_NOT_RUNNING: { retryable: true, helpTopic: "configurar-holyrics" },
  HOLYRICS_UNREACHABLE: { helpTopic: "configurar-holyrics" },
  HOLYRICS_TOKEN_INVALID: { helpTopic: "configurar-holyrics" },
  HOLYRICS_PERMISSION_MISSING: { helpTopic: "configurar-holyrics" },
  PERMISSION_MISSING: { helpTopic: "configurar-holyrics" },
  APPLY_FAILED: { helpTopic: "configurar-holyrics" },
  RESTORE_FAILED: { helpTopic: "configurar-holyrics" },
  EDITOR_ALREADY_OPEN: { helpTopic: "musica-nao-esta-no-holyrics" },
  EDITOR_UNSUPPORTED: { helpTopic: "musica-nao-esta-no-holyrics" },
  EDITOR_FAILED: { helpTopic: "musica-nao-esta-no-holyrics" },
  SONG_ABSENT: { helpTopic: "musica-nao-esta-no-holyrics" },
  SONG_AMBIGUOUS: { helpTopic: "musica-ambigua-e-vinculos" },
  DESTINATION_TEMPORARY: { helpTopic: "destino-playlist-temporaria" },
  DESTINATION_CHANGED: { helpTopic: "destino-playlist-temporaria" },
  LIBRARY_CHANGED: { helpTopic: "trocar-de-computador" },
  CATALOG_CHANGED: { helpTopic: "trocar-de-computador" },
  INVALID_HOLYRICS_URL: {},
  INVALID_VIDEIRA_URL: {},
  INVALID_CREDENTIAL: {},
  VAULT_UNAVAILABLE: {},
  EXTERNAL_LINK_BLOCKED: {},
} satisfies Record<string, ErrorEntry>);

export type ErrorCode = keyof typeof ERRORS;

const catalog: Readonly<Record<string, ErrorEntry>> = ERRORS;
const isErrorCode = (code: unknown): code is ErrorCode => typeof code === "string" && Object.hasOwn(ERRORS, code);

export interface CodedError extends Error {
  code: string;
}

/** Erro com código estável do catálogo (ou de um adaptador, que o mapeador reduz a INTERNAL se desconhecido). */
export const coded = (code: string, message: string): CodedError => Object.assign(new Error(message), { code });

/** Código seguro para expor: o do erro se estiver no catálogo; senão INTERNAL. */
export const errorCode = (error: unknown): ErrorCode => {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  return isErrorCode(code) ? code : "INTERNAL";
};

export interface ErrorInfo {
  code: string;
  messageKey: string;
  retryable: boolean;
  helpTopicId: string | null;
}

export function errorInfo(code: string): ErrorInfo {
  const entry = catalog[code] ?? ERRORS.INTERNAL;
  return { code, messageKey: entry.messageKey ?? "operation.failed", retryable: entry.retryable === true, helpTopicId: entry.helpTopic ?? null };
}

export const helpTopicForError = (code: string): string | null => catalog[code]?.helpTopic ?? null;

/** code → tópico, para validar o conteúdo da Ajuda contra o catálogo. */
export const helpTopicsByError = (): Record<string, string> =>
  Object.fromEntries(Object.entries(catalog).flatMap(([code, entry]) => (entry.helpTopic ? [[code, entry.helpTopic]] : [])));
