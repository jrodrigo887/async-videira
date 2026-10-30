import React, { useEffect, useState } from "react";
import type { PlanItemView, PreparationView } from "../../../../application/use-cases/prepare-worship.ts";
import type { CatalogSong } from "../../../../domain/types.ts";
import type { ConfirmResult, LinkConfirmation, Safe } from "../../shared/api.ts";
import { Callout, Chip, HelpLink, Icon, plural, songState } from "../../shared/ui.tsx";
import type { IconName, OnGo, OnHelp, Tone } from "../../shared/ui.tsx";

const GOOD = ["created", "updated", "unchanged"];
const outcomeText: Record<string, string> = {
  duplicate: "o Holyrics ou o Videira já usa essa música em outro vínculo",
  not_found: "o Videira não encontrou a música",
  rejected: "a música não estava entre as oferecidas",
  failed: "falhou",
};
const missingEndpoint = "O servidor do Videira Music ainda não tem este recurso (atualização pendente no servidor). Peça a quem administra o servidor para publicar a versão nova.";

const editorErrors: Record<string, string> = {
  EDITOR_ALREADY_OPEN: "O editor do Holyrics já está aberto. Feche-o e tente de novo.",
  EDITOR_UNSUPPORTED: "Esta versão do Holyrics não abre o editor pela API. Cadastre a música manualmente.",
  HOLYRICS_NOT_RUNNING: "O Holyrics não está respondendo.",
};

interface Flash { tone: Tone; icon: IconName; title: string; body: string }
interface EditorState { songId: string | null; phase: "waiting" | "notfound" | "error"; code?: string; lyricsFilled?: boolean }

interface VinculosProps {
  prep: PreparationView | null;
  onGo: OnGo;
  onHelp: OnHelp;
  onConfirm: (confirmations: LinkConfirmation[]) => Promise<ConfirmResult>;
  onRemove: (videiraSongId: string) => Promise<Safe<{ removed: boolean }>>;
  onOpenEditor: (videiraSongId: string) => Promise<Safe<{ opened: boolean; lyricsFilled: boolean }>>;
  onAwaitCreated: () => Promise<Safe<{ state: string; songs: CatalogSong[] }>>;
}

/** Chave do item nos mapas de seleção; itens sem `songId` nunca são selecionáveis. */
const idOf = (item: PlanItemView): string => item.songId ?? "";

export function Vinculos({ prep, onGo, onHelp, onConfirm, onRemove, onOpenEditor, onAwaitCreated }: VinculosProps) {
  const items = prep?.items ?? [];
  const suggested = items.filter((i) => songState(i) === "needsLink");
  const ambiguous = items.filter((i) => songState(i) === "chooseVersion");
  const missing = items.filter((i) => songState(i) === "missing");
  const linked = items.filter((i) => i.songId && (i.staleExternalId || i.matchedBy === "externalId"));
  const reconciliation = prep?.reconciliation;
  const [sel, setSel] = useState<Record<string, string | null>>({});
  const [created, setCreated] = useState<Record<string, CatalogSong[]>>({});
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [undoing, setUndoing] = useState<string | null>(null);

  useEffect(() => {
    setSel(Object.fromEntries(suggested.flatMap((i) => (i.songId ? [[i.songId, i.suggestions![0]!.id] as const] : []))));
    setCreated({});
    setEditor(null);
    // Recomeça a revisão a cada nova preparação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prep]);

  const chosen = Object.entries(sel).filter((entry): entry is [string, string] => Boolean(entry[1]));
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };

  const confirm = () => run(async () => {
    const r = await onConfirm(chosen.map(([videiraSongId, holyricsSongId]) => ({ videiraSongId, holyricsSongId })));
    if (!r.ok) {
      setFlash({ tone: "danger", icon: "x", title: "Não foi possível confirmar os vínculos", body: r.code === "AUTH_REJECTED" ? "O Videira Music recusou o token." : r.code === "PREPARATION_EXPIRED" ? "A preparação expirou. Prepare o culto de novo." : r.code === "VIDEIRA_ENDPOINT_MISSING" ? missingEndpoint : "Confira a conexão e tente de novo." });
      return;
    }
    const good = r.outcomes.filter((o) => GOOD.includes(o.outcome)).length;
    const bad = r.outcomes.filter((o) => !GOOD.includes(o.outcome));
    setFlash({
      tone: bad.length ? "warn" : "ok",
      icon: bad.length ? "alert" : "check",
      title: plural(good, "vínculo confirmado", "vínculos confirmados"),
      body: bad.length ? `${plural(bad.length, "não foi confirmado", "não foram confirmados")}: ${[...new Set(bad.map((o) => outcomeText[o.outcome] ?? o.outcome))].join("; ")}.` : "O culto foi preparado de novo com os vínculos.",
    });
  });

  const undo = (item: PlanItemView) => run(async () => {
    setUndoing(null);
    const r = await onRemove(idOf(item));
    setFlash(r.ok
      ? { tone: "ok", icon: "check", title: "Vínculo desfeito", body: `“${item.title}” volta a ser procurada pelo nome no Holyrics. O culto foi preparado de novo.` }
      : { tone: "danger", icon: "x", title: "Não foi possível desfazer o vínculo", body: r.code === "AUTH_REJECTED" ? "O Videira Music recusou o token." : r.code === "PREPARATION_EXPIRED" ? "A preparação expirou. Prepare o culto de novo." : r.code === "VIDEIRA_ENDPOINT_MISSING" ? missingEndpoint : "Confira a conexão e tente de novo." });
  });

  const staleNote = (item: PlanItemView) => (item.staleExternalId ? <><br /><span className="sm" style={{ color: "hsl(var(--color-warning))" }}>O vínculo antigo (Holyrics {item.staleExternalId}) não existe mais nesta biblioteca.</span></> : null);

  const openEditor = (item: PlanItemView) => run(async () => {
    const r = await onOpenEditor(idOf(item));
    setEditor(r.ok ? { songId: item.songId, phase: "waiting", lyricsFilled: r.data.lyricsFilled } : { songId: item.songId, phase: "error", code: r.code });
  });

  const reread = (item: PlanItemView) => run(async () => {
    const r = await onAwaitCreated();
    if (!r.ok) { setEditor({ songId: item.songId, phase: "error", code: r.code }); return; }
    if (r.data.state === "not-found") { setEditor({ songId: item.songId, phase: "notfound" }); return; }
    setCreated((c) => ({ ...c, [idOf(item)]: r.data.songs }));
    if (r.data.songs.length === 1) setSel((s) => ({ ...s, [idOf(item)]: r.data.songs[0].id }));
    setEditor(null);
  });

  const radios = (item: PlanItemView, songs: CatalogSong[]) => (
    <fieldset style={{ border: 0, padding: 0, margin: ".5rem 0 0" }}>
      <legend className="sr-only">Escolher a versão de {item.title}</legend>
      {songs.map((song) => (
        <label className="radio-card" key={song.id}>
          <input type="radio" name={`pick-${item.songId}`} checked={sel[idOf(item)] === song.id} onChange={() => setSel({ ...sel, [idOf(item)]: song.id })} />
          <span><strong>{song.title}</strong> · {song.artist || "artista não informado"} <span className="xs subtle">(Holyrics {song.id})</span></span>
        </label>
      ))}
    </fieldset>
  );

  const editorNote = (item: PlanItemView) => {
    if (editor?.songId !== item.songId) return null;
    if (editor.phase === "waiting") return <p className="sm" role="status">{editor.lyricsFilled
      ? "O editor abriu no Holyrics com a letra do Videira. Confira, salve a música lá e volte aqui."
      : "O editor abriu no Holyrics, mas não achamos a letra no Videira: cole a letra e apague o texto [Letra não fornecida]. Depois salve a música lá e volte aqui."}</p>;
    if (editor.phase === "notfound") return <p className="sm" role="status">Não encontramos a música nova. Salve com o mesmo título e artista e leia de novo.</p>;
    if (editor.phase === "error") return <p className="sm" role="alert">{editorErrors[editor.code ?? ""] ?? "Não foi possível falar com o Holyrics."}</p>;
    return null;
  };

  return (
    <>
      <div className="page-head">
        <div className="grow"><p className="ds-eyebrow">Vínculos</p><h1 className="ds-h1">Músicas que precisam de você</h1>
          <p className="lead muted">O vínculo liga uma música do Videira Music a uma música do Holyrics. Nada é vinculado sem você confirmar.</p></div>
        <HelpLink onOpen={onHelp} topic="musica-ambigua-e-vinculos">Como funcionam os vínculos</HelpLink>
      </div>
      {reconciliation?.active && <Callout tone="info" icon="info" title="A biblioteca de músicas do Holyrics mudou" role="status" actions={<HelpLink onOpen={onHelp} topic="trocar-de-computador" />}>{reconciliation.libraryMoved ? "Parece que o Holyrics foi reinstalado ou está em outro computador. " : ""}{reconciliation.staleCount ? `${plural(reconciliation.staleCount, "música deste culto aponta", "músicas deste culto apontam")} para uma música que não existe mais aqui.` : "Nenhum vínculo deste culto ficou sem correspondência."} Revise abaixo: nenhum vínculo antigo é apagado sem você pedir, e as trocas ficam no histórico.</Callout>}
      {flash && <Callout tone={flash.tone} icon={flash.icon} role="status" title={flash.title}>{flash.body}</Callout>}
      {!prep && <div className="ds-card-muted">Prepare o culto para ver as músicas.</div>}
      {prep && !suggested.length && !ambiguous.length && !missing.length && <div className="ds-card-muted"><Chip tone="ok" icon="check">Nenhuma pendência neste culto</Chip></div>}

      {suggested.length > 0 && (
        <section className="ds-card stack-sm" aria-labelledby="sug-h">
          <h2 className="ds-h2" id="sug-h">Mesmo nome no Holyrics ({suggested.length})</h2>
          <p className="sm muted">Achamos uma música com o mesmo título e artista. Desmarque as que não forem a mesma.</p>
          <ul className="list-rows">{suggested.map((item) => {
            const s = item.suggestions![0]!;
            return (
              <li key={item.position}>
                <label className="check grow">
                  <input type="checkbox" disabled={!item.songId} checked={Boolean(sel[idOf(item)])} onChange={(e) => setSel({ ...sel, [idOf(item)]: e.target.checked ? s.id : null })} />
                  <span><strong>{item.title}</strong> · {item.artist}<br /><span className="sm muted">Holyrics: “{s.title}” de {s.artist ?? "artista não informado"} (ID {s.id})</span>{staleNote(item)}</span>
                </label>
              </li>
            );
          })}</ul>
        </section>
      )}

      {ambiguous.length > 0 && (
        <section className="ds-card stack-sm" aria-labelledby="amb-h">
          <h2 className="ds-h2" id="amb-h">Escolher a versão ({ambiguous.length})</h2>
          <p className="sm muted">Há mais de uma música com este nome no Holyrics. Escolha a certa, ou deixe sem escolher para a música ficar de fora.</p>
          {ambiguous.map((item) => <div key={item.position}><p className="song-title">{item.title} <span className="muted">· {item.artist}</span>{staleNote(item)}</p>{radios(item, item.candidateSongs ?? [])}</div>)}
        </section>
      )}

      {missing.length > 0 && (
        <section className="ds-card stack-sm" aria-labelledby="mis-h">
          <h2 className="ds-h2" id="mis-h">Não está no Holyrics ({missing.length})</h2>
          <p className="sm muted">Abra o editor de músicas do Holyrics, salve a música e leia a biblioteca de novo. Quem salva é você, no Holyrics.</p>
          {missing.map((item) => (
            <div key={item.position} className="stack-sm">
              <div className="row between" style={{ flexWrap: "wrap" }}>
                <p className="song-title">{item.title} <span className="muted">· {item.artist}</span>{staleNote(item)}</p>
                {!created[idOf(item)] && (editor?.songId === item.songId && ["waiting", "notfound"].includes(editor.phase)
                  ? <button className="ds-button-secondary btn-sm" disabled={busy} onClick={() => reread(item)}><Icon name="refresh" />Ler a biblioteca de novo</button>
                  : <button className="ds-button-secondary btn-sm" disabled={busy || !item.songId} onClick={() => openEditor(item)}>Abrir editor no Holyrics</button>)}
              </div>
              {editorNote(item)}
              {created[idOf(item)] && <><p className="sm" role="status">Música nova encontrada no Holyrics. Confirme que é esta:</p>{radios(item, created[idOf(item)])}</>}
            </div>
          ))}
        </section>
      )}

      {linked.length > 0 && (
        <section className="ds-card stack-sm" aria-labelledby="lnk-h">
          <h2 className="ds-h2" id="lnk-h">Vínculos deste culto ({linked.length})</h2>
          <p className="sm muted">Músicas já ligadas ao Holyrics. Desfazer apaga só o vínculo no Videira Music; nenhuma música é apagada em nenhum dos dois lados.</p>
          <ul className="list-rows">{linked.map((item) => (
            <li key={item.position}>
              <div className="grow"><strong>{item.title}</strong> · {item.artist}<br />
                <span className="sm muted">{item.staleExternalId ? `Vinculada ao Holyrics ${item.staleExternalId}, que não existe mais aqui` : `Vinculada ao Holyrics ${item.holyricsId}`}</span></div>
              {undoing === item.songId
                ? <span className="row"><span className="sm">Desfazer?</span><button className="ds-button-danger btn-sm" disabled={busy} onClick={() => undo(item)}>Desfazer vínculo</button><button className="ds-button-secondary btn-sm" onClick={() => setUndoing(null)}>Cancelar</button></span>
                : <button className="ds-button-secondary btn-sm" disabled={busy} onClick={() => setUndoing(item.songId)}><Icon name="undo" />Desfazer vínculo</button>}
            </li>))}</ul>
        </section>
      )}

      <div className="row between" style={{ flexWrap: "wrap" }}>
        <button className="ds-button-secondary" onClick={() => onGo("culto")}><Icon name="back" />Voltar ao culto</button>
        <button className="ds-button" disabled={busy || !chosen.length} onClick={confirm}>{chosen.length ? `Confirmar ${plural(chosen.length, "vínculo", "vínculos")}` : "Nada para confirmar"}</button>
      </div>
    </>
  );
}
