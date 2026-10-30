import React from "react";
import type { AuditEntry } from "../../../../domain/audit/audit-entry.ts";
import { Icon, plural } from "../../shared/ui.tsx";

const logTitles: Record<string, string> = { "app.started": "Aplicativo iniciado", "settings.updated": "Configurações atualizadas", "credentials.saved": "Token guardado no cofre", "connection.started": "Teste de conexão iniciado", "connection.succeeded": "Conexão confirmada", "connection.failed": "Falha no teste de conexão", "worship.started": "Operação iniciada", "worship.succeeded": "Operação concluída", "worship.failed": "Operação falhou", "links.confirmed": "Vínculos confirmados", "links.removed": "Vínculo desfeito" };
const targetNames: Record<string, string> = { videira: "Videira Music", holyrics: "Holyrics" };
const actionNames: Record<string, string> = { prepare: "Preparar culto", apply: "Publicar no Holyrics" };
const statusNames: Record<string, string> = { configured: "configurado", prepared: "preparação", complete: "concluído", ok: "sucesso", failed: "falhou" };

export function Historico({ logs, message, onRefresh, onCopy }: { logs: AuditEntry[]; message: string; onRefresh: () => void; onCopy: () => void }) {
  return (
    <>
      <div className="page-head"><div className="grow"><p className="ds-eyebrow">Registro local</p><h1 className="ds-h1">Histórico</h1>
        <p className="lead muted">Operações e conexões neste computador. Tokens, conteúdo musical e URLs não são incluídos.</p></div>
        <div className="row"><button className="ds-button-secondary" onClick={onRefresh}><Icon name="refresh" />Atualizar</button><button className="ds-button-secondary" disabled={!logs.length} onClick={onCopy}><Icon name="copy" />Copiar</button></div></div>
      {message && <p role="status" className="sm">{message}</p>}
      <section className="ds-card">
        {logs.length ? <ul className="list-rows">{logs.map((entry, i) => (
          <li key={`${entry.at}-${i}`}>
            <time className="sm muted" dateTime={entry.at}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(entry.at))}</time>
            <div className="grow"><strong>{entry.action ? `${actionNames[entry.action]} · ` : ""}{logTitles[entry.event] ?? "Evento"}</strong>
              <p className="sm muted">{[entry.target ? targetNames[entry.target] : null, entry.code, entry.count !== undefined ? `${plural(entry.count, "setlist", "setlists")}` : null, entry.status ? statusNames[entry.status] ?? entry.status : null].filter(Boolean).join(" · ")}</p></div>
          </li>))}</ul> : <p className="muted">Nenhum evento registrado ainda.</p>}
      </section>
    </>
  );
}
