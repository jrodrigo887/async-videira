import type { DomainEvent } from "../../domain/events.ts";
import type { AuditData } from "../../domain/audit/audit-entry.ts";
import type { AuditLog, EventHandler } from "../ports/index.ts";

type Row = { event: string; data?: AuditData };

/** Evento de domínio → linha do log de atividade. A allowlist de campos continua em `sanitizeAuditEntry`. */
export function auditRowFor(event: DomainEvent): Row | null {
  switch (event.type) {
    case "AppStarted": return { event: "app.started" };
    case "SettingsUpdated": return { event: "settings.updated" };
    case "CredentialsSaved": return { event: "credentials.saved", data: { target: event.target, status: "configured" } };
    case "LinksConfirmed": return { event: "links.confirmed", data: { count: event.count } };
    case "LinkRemoved": return { event: "links.removed", data: { count: 1 } };
    case "OperationStarted":
      if (event.operation === "connection") return { event: "connection.started", data: { target: event.target } };
      return event.operation === "prepare" || event.operation === "apply" ? { event: "worship.started", data: { action: event.operation } } : null;
    case "OperationSucceeded":
      if (event.operation === "connection") return { event: "connection.succeeded", data: { target: event.target, count: event.count } };
      return event.operation === "prepare" || event.operation === "apply" ? { event: "worship.succeeded", data: { action: event.operation, status: event.status } } : null;
    case "OperationFailed":
      if (event.operation === "connection") return { event: "connection.failed", data: { target: event.target, code: event.code } };
      return event.operation === "prepare" || event.operation === "apply" ? { event: "worship.failed", data: { action: event.operation, code: event.code } } : null;
    default: return null;
  }
}

export const createAuditProjector = (audit: Pick<AuditLog, "append">): EventHandler => async (event) => {
  const row = auditRowFor(event);
  if (row) await audit.append(row.event, row.data);
};
