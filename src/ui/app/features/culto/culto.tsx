import React, { useState } from "react";
import type { ReactNode } from "react";
import type { ProgressMessage } from "../../../../application/services/progress-forwarder.ts";
import type { PlanItemView, PreparationView } from "../../../../application/use-cases/prepare-worship.ts";
import type { CredentialTarget } from "../../../../domain/types.ts";
import { Callout, Chip, HelpLink, Icon, STATE_META, StateChip, fmtDay, fmtDayMonth, fmtShort, fmtTime, plural, songState, summarize } from "../../shared/ui.tsx";
import type { OnGo, OnHelp, StateKey } from "../../shared/ui.tsx";

/** Resultado da última publicação, mostrado como aviso na tela do culto. */
export interface ResultBanner { ok: boolean; title: string; body: string }

const PENDING: StateKey[] = ["needsLink", "chooseVersion", "missing"];

function SongRow({ item, onGo }: { item: PlanItemView; onGo: OnGo }) {
  const state = songState(item);
  const artist = item.artist ?? "";
  let support = artist;
  let action: ReactNode = null;
  if (state === "needsLink") {
    const s = item.suggestions![0]!;
    support = `${artist} · Achamos “${s.title}” de ${s.artist ?? "artista não informado"} no Holyrics com o mesmo nome.`;
    action = <button className="ds-button-secondary btn-sm" onClick={() => onGo("vinculos")}>Ver</button>;
  } else if (state === "chooseVersion") {
    support = `${artist} · Há ${item.candidates?.length ?? "várias"} músicas com este nome no Holyrics.`;
    action = <button className="ds-button-secondary btn-sm" onClick={() => onGo("vinculos")}>Ver</button>;
  } else if (state === "missing") {
    support = `${artist} · Precisa ser cadastrada no Holyrics antes.`;
  } else if (state === "repeated") {
    support = `${artist} · O Holyrics não aceita a mesma música duas vezes na playlist: ela entra uma vez.`;
  }
  return (
    <li className={`song-row ${state === "repeated" ? "is-repeated" : ""}`} aria-label={`Posição ${item.position}, ${item.title}, ${artist}, ${STATE_META[state].label}`}>
      <span className="song-pos" aria-hidden="true">{item.position}</span>
      <div><p className="song-title">{item.title}</p><p className="song-meta">{support}</p></div>
      <StateChip state={state} />
      <span className="action-slot">{action}</span>
    </li>
  );
}

function Songs({ items, onGo }: { items: PlanItemView[]; onGo: OnGo }) {
  const [view, setView] = useState<"state" | "order">("state");
  const c = summarize(items);
  const counted = c.total - c.repeated;
  const chips = (Object.keys(STATE_META) as StateKey[]).filter((k) => c[k] > 0).map((k) => (
    <StateChip key={k} state={k} label={`${c[k]} ${c[k] === 1 && k === "ready" ? "pronta" : STATE_META[k].many}`} />
  ));
  if (!items.length) return <><h2 className="ds-h2">Músicas do setlist</h2><p className="muted">Este setlist não tem músicas. Peça à liderança para conferir no Videira Music.</p></>;
  const pending = items.filter((i) => PENDING.includes(songState(i)));
  const canGroup = items.length > 5 && pending.length > 0;
  const grouped = canGroup && view === "state";
  const rows = (list: PlanItemView[]) => <ol className="song-list">{list.map((i) => <SongRow key={i.position} item={i} onGo={onGo} />)}</ol>;
  const repeated = items.filter((i) => songState(i) === "repeated");
  const ready = items.filter((i) => songState(i) === "ready");
  return (
    <section className="ds-card" aria-labelledby="songs-h">
      <div className="songs-sticky">
        <div className="row between" style={{ flexWrap: "wrap" }}>
          <h2 className="ds-h2" id="songs-h">Músicas do setlist</h2>
          {canGroup && <div className="seg" role="group" aria-label="Organizar músicas">
            <button aria-pressed={grouped} onClick={() => setView("state")}>Por estado</button>
            <button aria-pressed={!grouped} onClick={() => setView("order")}>Na ordem do setlist</button>
          </div>}
        </div>
        <div className="summary" style={{ marginTop: ".5rem" }} aria-live="polite">
          <strong>{c.ready} de {counted} {counted === 1 ? "música pronta" : "músicas prontas"}</strong>
          <span className="row-wrap">{chips}</span>
        </div>
      </div>
      {grouped ? <>
        <h3 className="group-h">Precisam de você ({pending.length})</h3>{rows(pending)}
        {repeated.length > 0 && <><h3 className="group-h">Repetidas ({repeated.length})</h3>{rows(repeated)}</>}
        <details className="group-ready"><summary className="group-h">Prontas ({ready.length})</summary>{rows(ready)}</details>
      </> : rows(items)}
    </section>
  );
}

function Destination({ prep, onRecheck, loading, onHelp }: { prep: PreparationView; onRecheck: () => void; loading: boolean; onHelp: OnHelp }) {
  const dest = prep.destination;
  const hasDate = Boolean(dest.datetime);
  const sameDay = Boolean(dest.datetime && prep.setlist.eventAt && new Date(dest.datetime).toDateString() === new Date(prep.setlist.eventAt).toDateString());
  const count = dest.currentCount ? `${plural(dest.currentCount, "música", "músicas")} na playlist agora` : "playlist vazia agora";
  const typeLabel = dest.type === "event" ? "Evento da agenda" : hasDate ? "Culto da agenda" : "Playlist temporária";
  return (
    <section className="ds-card stack-sm dest-card" aria-labelledby="dest-h">
      <div>
        <h2 className="ds-h2" id="dest-h">Destino no Holyrics</h2>
        <p className="dest-name">{dest.name ?? "Playlist temporária"}</p>
        <p className="sm muted">{typeLabel}{hasDate ? ` · ${fmtShort(dest.datetime)}` : ""} · {count}</p>
      </div>
      <div className="dest-check">
        {!hasDate && <><Chip tone="neutral" icon="info">Sem data para conferir</Chip><p className="sm muted" style={{ marginTop: ".5rem" }}>É a playlist aberta no Holyrics agora. Ela não tem data de culto: você confirma antes de substituir.</p><HelpLink onOpen={onHelp} topic="destino-playlist-temporaria" /></>}
        {hasDate && sameDay && <Chip tone="ok" icon="check">Mesmo dia do setlist</Chip>}
        {hasDate && !sameDay && <Callout tone="warn" icon="alert" title={`O culto selecionado é de ${fmtDayMonth(dest.datetime)}, o setlist é de ${fmtDayMonth(prep.setlist.eventAt)}`}>Confira se é o culto certo. Se não for, selecione o culto certo no Holyrics.</Callout>}
      </div>
      <p className="sm muted dest-help">O app só consegue mudar o que está <strong>selecionado</strong> no Holyrics. Para trocar, selecione o culto lá e clique em Verificar de novo.</p>
      <button className="ds-button-secondary btn-sm dest-btn" disabled={loading} onClick={onRecheck}><Icon name="refresh" />Verificar de novo</button>
    </section>
  );
}

interface CultoProps {
  prep: PreparationView | null;
  error: string | null;
  loading: boolean;
  progress: ProgressMessage | null;
  configured: Record<CredentialTarget, boolean>;
  result: ResultBanner | null;
  onPrepare: (setlistId?: string) => void;
  onGo: OnGo;
  onHelp: OnHelp;
}

const STEP_LABELS: Record<string, string> = {
  "prepare:started": "Iniciando…",
  "prepare:reading": "Lendo o setlist e a biblioteca do Holyrics…",
  "prepare:planning": "Montando o plano da playlist…",
  "apply:started": "Iniciando a publicação…",
  "apply:validating": "Conferindo se nada mudou desde a preparação…",
  "apply:writing": "Escrevendo a playlist no Holyrics e conferindo…",
  "apply:reporting": "Enviando o relatório ao Videira Music…",
};

export function Culto({ progress, prep, error, loading, configured, result, onPrepare, onGo, onHelp }: CultoProps) {
  const banners: ReactNode[] = [];
  if (!configured.holyrics) banners.push(<Callout key="h" tone="danger" icon="x" role="alert" title="Falta o token do Holyrics" actions={<button className="ds-button btn-sm" onClick={() => onGo("ajustes")}>Colar token</button>}>Sem ele o app não lê a biblioteca nem muda a playlist.</Callout>);
  if (!configured.videira) banners.push(<Callout key="v" tone="warn" icon="alert" title="Falta o token do Videira Music" actions={<button className="ds-button-secondary btn-sm" onClick={() => onGo("ajustes")}>Colar token</button>}>Sem ele o app não baixa setlists.</Callout>);
  if (error === "HOLYRICS_NOT_RUNNING") banners.push(<Callout key="e" tone="danger" icon="x" role="alert" title="O Holyrics não está respondendo" actions={<><button className="ds-button btn-sm" onClick={() => onPrepare()}><Icon name="refresh" />Tentar de novo</button><HelpLink onOpen={onHelp} topic="configurar-holyrics" /></>}>Abra o Holyrics neste computador. Se ele já está aberto, confira <strong>Arquivo → Configurações → API Server → Ativar (local)</strong>.</Callout>);
  else if (error === "AUTH_REJECTED") banners.push(<Callout key="e" tone="danger" icon="x" role="alert" title="Um dos tokens foi recusado" actions={<><button className="ds-button btn-sm" onClick={() => onGo("ajustes")}>Trocar token</button><HelpLink onOpen={onHelp} topic="problemas-comuns" /></>}>O token pode ter sido revogado. Gere um novo e cole em Ajustes.</Callout>);
  else if (error === "SERVICE_UNAVAILABLE") banners.push(<Callout key="e" tone="warn" icon="alert" role="alert" title="Não foi possível alcançar o Videira Music" actions={<button className="ds-button-secondary btn-sm" onClick={() => onPrepare()}><Icon name="refresh" />Tentar de novo</button>}>Confira a conexão com a internet.</Callout>);
  else if (error === "NO_SETLIST") banners.push(<Callout key="e" tone="info" icon="info" role="status" title="Nenhum setlist publicado de hoje em diante" actions={<><button className="ds-button-secondary btn-sm" onClick={() => onPrepare()}><Icon name="refresh" />Procurar de novo</button><HelpLink onOpen={onHelp} topic="configurar-videira">Por que o setlist não aparece?</HelpLink></>}>O Videira Music respondeu normalmente, mas não há setlist publicado para hoje nem para os próximos dias. Os tokens estão corretos. Confira no Videira Music se o setlist está <strong>publicado</strong> e com <strong>data e hora</strong> preenchidas.</Callout>);
  else if (error) banners.push(<Callout key="e" tone="danger" icon="x" role="alert" title="Não foi possível concluir" actions={<><button className="ds-button btn-sm" onClick={() => onPrepare()}><Icon name="refresh" />Tentar de novo</button><HelpLink onOpen={onHelp} topic="problemas-comuns" /></>}>{error}</Callout>);
  if (prep?.reconciliation?.active) banners.push(<Callout key="rc" tone="info" icon="info" role="status" title="A biblioteca de músicas do Holyrics mudou" actions={<><button className="ds-button-secondary btn-sm" onClick={() => onGo("vinculos")}>Revisar vínculos</button><HelpLink onOpen={onHelp} topic="trocar-de-computador" /></>}>{prep.reconciliation.libraryMoved ? "Parece que o Holyrics foi reinstalado ou está em outro computador. " : ""}{prep.reconciliation.staleCount ? `${plural(prep.reconciliation.staleCount, "música deste culto precisa", "músicas deste culto precisam")} ser vinculada outra vez.` : "Isso não afeta o culto de domingo."} Nenhum vínculo antigo é apagado.</Callout>);
  if (result) banners.push(<Callout key="r" tone={result.ok ? "ok" : "danger"} icon={result.ok ? "check" : "x"} role="status" title={result.title}>{result.body}</Callout>);

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <p className="ds-eyebrow">Próximo culto</p>
          <h1 className="ds-h1">{prep?.setlist.title ?? "Culto de domingo"}</h1>
          {prep && <p className="lead muted">{fmtDay(prep.setlist.eventAt)}{prep.setlist.eventAt ? ` · ${fmtTime(prep.setlist.eventAt)}` : ""}</p>}
        </div>
        <button className="ds-button-secondary" disabled={loading} onClick={() => onPrepare()}><Icon name="refresh" />{loading ? "Preparando…" : prep ? "Preparar de novo" : "Preparar culto"}</button>
      </div>
      {loading && progress && <p className="sm muted" role="status">{STEP_LABELS[`${progress.operation}:${progress.step}`] ?? "Trabalhando…"}</p>}
      {prep && prep.setlists.length > 1 && (
        <div className="field" style={{ maxWidth: "26rem" }}>
          <label htmlFor="setlist-pick">Setlist do dia</label>
          <p className="help">{prep.setlists.length} setlists publicados</p>
          <select id="setlist-pick" className="ds-input" value={prep.setlist.id} disabled={loading} onChange={(e) => onPrepare(e.target.value)}>
            {prep.setlists.map((s) => <option key={s.id} value={s.id}>{s.title} — {fmtTime(s.eventAt)}</option>)}
          </select>
        </div>
      )}
      {banners}
      {prep && <div className="culto-grid">
        <div className="dest-col"><Destination prep={prep} loading={loading} onRecheck={() => onPrepare()} onHelp={onHelp} /></div>
        <Songs items={prep.items} onGo={onGo} />
      </div>}
    </>
  );
}
