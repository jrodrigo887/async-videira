import React, { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { HelpArticle, HelpEntry } from "../../shared/api.ts";
import { Icon } from "../../shared/ui.tsx";

const toHtml = (markdown: string): string => DOMPurify.sanitize(
  marked.parse(markdown.replace(/\]\(topico:([\w-]+)\)/g, "](#topico-$1)"), { gfm: true, breaks: false, async: false }),
  { ALLOWED_TAGS: ["p", "h1", "h2", "h3", "h4", "ul", "ol", "li", "strong", "em", "blockquote", "code", "pre", "a", "table", "thead", "tbody", "tr", "th", "td"], ALLOWED_ATTR: ["href", "title"] },
);

interface TopicProps {
  topic: HelpEntry;
  open: boolean;
  onToggle: () => void;
  loadTopic: (topicId: string) => Promise<HelpArticle | null>;
  onOpenTopic: (topicId: string) => void;
}

function Topic({ topic, open, onToggle, loadTopic, onOpenTopic }: TopicProps) {
  const [body, setBody] = useState<string | null>(null);
  useEffect(() => {
    if (!open || body) return;
    let alive = true;
    loadTopic(topic.id).then((a) => alive && setBody(a?.markdown ?? ""), () => alive && setBody(""));
    return () => { alive = false; };
  }, [open, body, loadTopic, topic.id]);
  const html = useMemo(() => (body ? toHtml(body) : ""), [body]);
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement).closest?.("a");
    if (!link) return;
    event.preventDefault();
    const href = link.getAttribute("href") ?? "";
    if (href.startsWith("#topico-")) onOpenTopic(href.slice("#topico-".length));
  };
  return (
    <li className="accordion-item" id={`topic-${topic.id}`}>
      <h2 className="accordion-head">
        <button className="accordion-trigger" aria-expanded={open} aria-controls={`panel-${topic.id}`} onClick={onToggle}>
          <span className="grow"><span className="accordion-title">{topic.title}</span>{!open && topic.summary && <span className="accordion-summary">{topic.summary}</span>}</span>
          <Icon name="chevron" className="icon accordion-chevron" />
        </button>
      </h2>
      <div className="accordion-panel" id={`panel-${topic.id}`} role="region" aria-label={topic.title} hidden={!open}>
        {open && (body === null ? <p className="muted sm">Carregando…</p> : <div className="md" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />)}
      </div>
    </li>
  );
}

interface AjudaProps {
  topics: HelpEntry[];
  article: HelpArticle | null;
  query: string;
  onQuery: (value: string) => void;
  loadTopic: (topicId: string) => Promise<HelpArticle | null>;
  onBack: (() => void) | null;
}

export function Ajuda({ topics, article, query, onQuery, loadTopic, onBack }: AjudaProps) {
  const [openId, setOpenId] = useState<string | null>(article?.id ?? null);
  // Abrir a Ajuda a partir de um link contextual (ou F1) abre direto o tópico pedido.
  useEffect(() => { if (article?.id) setOpenId(article.id); }, [article]);
  useEffect(() => {
    if (!openId) return;
    document.getElementById(`topic-${openId}`)?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [openId]);
  return (
    <>
      <div className="page-head"><div className="grow"><p className="ds-eyebrow">Funciona sem internet</p><h1 className="ds-h1">Ajuda</h1>
        <p className="lead muted">Clique em um título para abrir a resposta logo abaixo.</p></div>
        {onBack && <button className="ds-button-secondary" onClick={onBack}><Icon name="back" />Voltar</button>}</div>
      <div className="field help-search" role="search"><label htmlFor="help-search">Procurar na ajuda</label>
        <input id="help-search" className="ds-input" type="search" autoComplete="off" value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Ex.: token, destino, letra" /></div>
      {topics.length
        ? <ul className="accordion ds-card">{topics.map((t) => <Topic key={t.id} topic={t} open={openId === t.id} loadTopic={loadTopic} onOpenTopic={setOpenId} onToggle={() => setOpenId(openId === t.id ? null : t.id)} />)}</ul>
        : <div className="help-empty"><p className="sm"><strong>Nada encontrado.</strong></p><p className="sm muted">Tente outra palavra, como “token” ou “destino”.</p></div>}
    </>
  );
}
