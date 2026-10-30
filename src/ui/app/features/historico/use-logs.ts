import { useState } from "react";
import type { AuditEntry } from "../../../../domain/audit/audit-entry.ts";
import { call } from "../../shared/api.ts";

export function useLogs() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [message, setMessage] = useState("");
  async function refresh() { setMessage(""); try { setLogs(await call("logs.list")); } catch { setMessage("Não foi possível ler os logs locais."); } }
  async function copy() { try { await navigator.clipboard.writeText(JSON.stringify(logs, null, 2)); setMessage("Logs copiados. Revise antes de compartilhar."); } catch { setMessage("Não foi possível copiar os logs."); } }
  return { logs, message, refresh, copy };
}
