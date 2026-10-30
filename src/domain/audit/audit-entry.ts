import { ERRORS } from "../shared/errors.ts";

/** O log de atividade só aceita eventos e campos enumerados: nunca texto livre, token ou conteúdo musical. */
export const AUDIT_EVENTS: ReadonlySet<string> = new Set([
  "app.started", "settings.updated", "credentials.saved",
  "connection.started", "connection.succeeded", "connection.failed",
  "worship.started", "worship.succeeded", "worship.failed",
  "links.confirmed", "links.removed",
]);
const TARGETS = new Set(["videira", "holyrics"]);
const STATUSES = new Set(["ok", "failed", "configured", "prepared", "complete"]);
const ACTIONS = new Set(["prepare", "apply"]);
const MAX_COUNT = 100000;

/** Dados que um chamador pode anexar a um evento; só o que passa pela allowlist é gravado. */
export interface AuditData {
  target?: unknown;
  action?: unknown;
  status?: unknown;
  code?: unknown;
  count?: unknown;
}

export interface AuditEntry {
  at: string;
  event: string;
  target?: string;
  action?: string;
  status?: string;
  code?: string;
  count?: number;
}

const inSet = (set: ReadonlySet<string>, value: unknown): value is string => typeof value === "string" && set.has(value);

/** Devolve a entrada limpa, ou null se o evento não é permitido. Serve tanto para gravar quanto para ler. */
export function sanitizeAuditEntry(event: unknown, data: AuditData = {}, at?: unknown): AuditEntry | null {
  if (!inSet(AUDIT_EVENTS, event) || typeof at !== "string") return null;
  const entry: AuditEntry = { at, event };
  if (inSet(TARGETS, data.target)) entry.target = data.target;
  if (inSet(ACTIONS, data.action)) entry.action = data.action;
  if (inSet(STATUSES, data.status)) entry.status = data.status;
  if (typeof data.code === "string" && Object.hasOwn(ERRORS, data.code)) entry.code = data.code;
  if (Number.isSafeInteger(data.count) && (data.count as number) >= 0 && (data.count as number) <= MAX_COUNT) entry.count = data.count as number;
  return entry;
}
