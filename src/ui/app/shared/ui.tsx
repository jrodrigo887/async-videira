import React from "react";
import type { ReactNode } from "react";
import type { PlanItem } from "../../../domain/types.ts";

const ICONS = {
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  link: '<path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1"/><path d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/>',
  history: '<path d="M3 12a9 9 0 109-9 9 9 0 00-7 3.5L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2v.3M12 17v.01"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  diamond: '<path d="M12 3l9 9-9 9-9-9z"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 01-3 3H3"/>',
  refresh: '<path d="M20 11a8 8 0 00-14-4L4 9"/><path d="M4 4v5h5M4 13a8 8 0 0014 4l2-2"/><path d="M20 20v-5h-5"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>',
};

export type IconName = keyof typeof ICONS;
export type Tone = "ok" | "info" | "warn" | "danger" | "neutral";
export type StateKey = "ready" | "needsLink" | "chooseVersion" | "missing" | "repeated";
export type Screen = "culto" | "vinculos" | "historico" | "ajustes" | "ajuda";
export type Theme = "system" | "light" | "dark";
export type OnGo = (screen: Screen) => void;
export type OnHelp = (topicId?: string) => void;

export const Icon = ({ name, className = "icon" }: { name: IconName; className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] ?? "" }} />
);

interface StateMeta { label: string; many: string; tone: Tone; icon: IconName }

export const STATE_META: Record<StateKey, StateMeta> = {
  ready: { label: "Pronta", many: "prontas", tone: "ok", icon: "check" },
  needsLink: { label: "Confirmar vínculo", many: "para confirmar vínculo", tone: "info", icon: "link" },
  chooseVersion: { label: "Escolher versão", many: "para escolher versão", tone: "warn", icon: "diamond" },
  missing: { label: "Não está no Holyrics", many: "fora do Holyrics", tone: "danger", icon: "x" },
  repeated: { label: "Repetida — entra 1 vez", many: "repetidas", tone: "neutral", icon: "repeat" },
};

export const Chip = ({ tone, icon, children }: { tone: Tone; icon: IconName; children?: ReactNode }) => (
  <span className={`status-chip status-chip--${tone}`}><Icon name={icon} />{children}</span>
);

export const StateChip = ({ state, label }: { state: StateKey; label?: string }) => {
  const meta = STATE_META[state];
  return <Chip tone={meta.tone} icon={meta.icon}>{label ?? meta.label}</Chip>;
};

export const Callout = ({ tone, icon, title, children, actions, role }: { tone: Tone; icon: IconName; title: string; children?: ReactNode; actions?: ReactNode; role?: string }) => (
  <div className={`callout callout--${tone}`} role={role}>
    <Icon name={icon} className="icon-lg" />
    <div className="grow"><h2>{title}</h2>{children && <p>{children}</p>}{actions && <div className="actions">{actions}</div>}</div>
  </div>
);

export const HelpLink = ({ onOpen, topic, children = "Ver ajuda sobre isto" }: { onOpen: OnHelp; topic: string; children?: ReactNode }) => (
  <button className="ds-link help-link" onClick={() => onOpen(topic)}><Icon name="help" />{children}</button>
);

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const fmt = (options: Intl.DateTimeFormatOptions) => (iso?: string | null) => { const d = iso ? new Date(iso) : null; return d && !Number.isNaN(d.getTime()) ? new Intl.DateTimeFormat("pt-BR", options).format(d) : ""; };
export const fmtDay = fmt({ weekday: "long", day: "numeric", month: "long" });
export const fmtTime = fmt({ hour: "2-digit", minute: "2-digit" });
export const fmtShort = fmt({ weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
export const fmtDayMonth = fmt({ day: "2-digit", month: "2-digit" });

/** Traduz o resultado do plano do core para os estados de interface do protótipo. */
export function songState(item: Pick<PlanItem, "status" | "suggestions">): StateKey {
  if (item.status === "resolved") return "ready";
  if (item.status === "repeated") return "repeated";
  if (item.status === "ambiguous") return "chooseVersion";
  return item.suggestions?.length ? "needsLink" : "missing";
}

export function summarize(items: Array<Pick<PlanItem, "status" | "suggestions">>) {
  const counts: Record<StateKey | "total", number> = { total: items.length, ready: 0, needsLink: 0, chooseVersion: 0, missing: 0, repeated: 0 };
  for (const item of items) counts[songState(item)] += 1;
  return counts;
}
