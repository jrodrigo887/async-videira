import React from "react";
import type { InputHTMLAttributes } from "react";
import type { CredentialTarget, Settings } from "../../../../domain/types.ts";
import { Callout, HelpLink } from "../../shared/ui.tsx";
import type { OnHelp, Theme } from "../../shared/ui.tsx";

/** Estado do teste de conexão de um serviço, mostrado em Ajustes. */
export type TestState =
  | { phase: "testing" }
  | { phase: "ok"; title: string; body: string }
  | { phase: "error"; title: string; body: string; help: string }
  | null;

function TestResult({ test, onHelp }: { test: TestState; onHelp: OnHelp }) {
  if (!test) return null;
  if (test.phase === "testing") return <p className="sm muted test-result" role="status">Testando a conexão…</p>;
  return (
    <div className="test-result">
      <Callout tone={test.phase === "ok" ? "ok" : "danger"} icon={test.phase === "ok" ? "check" : "x"} role={test.phase === "ok" ? "status" : "alert"} title={test.title} actions={test.phase === "error" && test.help ? <HelpLink onOpen={onHelp} topic={test.help} /> : null}>{test.body}</Callout>
    </div>
  );
}

interface AjustesProps {
  settings: Settings;
  setSettings: (settings: Settings) => void;
  status: Record<CredentialTarget, boolean>;
  tokens: Record<CredentialTarget, string>;
  setTokens: (tokens: Record<CredentialTarget, string>) => void;
  message: string;
  saving: boolean;
  tests: Record<CredentialTarget, TestState>;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  onSave: () => void;
  onTest: (target: CredentialTarget) => void;
  onHelp: OnHelp;
}

export function Ajustes({ settings, setSettings, status, tokens, setTokens, message, saving, tests, theme, setTheme, onSave, onTest, onHelp }: AjustesProps) {
  const field = (id: string, label: string, value: string, onChange: (value: string) => void, props: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="field"><label htmlFor={id}>{label}</label><input id={id} className="ds-input" value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" spellCheck="false" {...props} /></div>
  );
  return (
    <>
      <div className="page-head"><div className="grow"><p className="ds-eyebrow">Ajustes</p><h1 className="ds-h1">Conexões e aparência</h1>
        <p className="lead muted">Os tokens são guardados pelo cofre seguro do sistema operacional.</p></div></div>
      <section className="ds-card stack settings-section" aria-labelledby="holyrics-h">
        <h2 className="ds-h2" id="holyrics-h">Holyrics</h2>
        {field("holyrics-url", "Endereço local do Holyrics", settings.holyricsUrl, (v) => setSettings({ ...settings, holyricsUrl: v }))}
        {field("holyrics-token", "Token do Holyrics", tokens.holyrics, (v) => setTokens({ ...tokens, holyrics: v }), { type: "password", placeholder: status.holyrics ? "Já configurado — cole só para trocar" : "Cole o token" })}
        <div className="row"><button className={`ds-button-secondary ${tests.holyrics?.phase === "testing" ? "is-busy" : ""}`} aria-busy={tests.holyrics?.phase === "testing"} onClick={() => onTest("holyrics")}>{tests.holyrics?.phase === "testing" ? "Testando…" : "Testar Holyrics"}</button><HelpLink onOpen={onHelp} topic="configurar-holyrics">Como configurar o Holyrics</HelpLink></div>
        <TestResult test={tests.holyrics} onHelp={onHelp} />
      </section>
      <section className="ds-card stack settings-section" aria-labelledby="videira-h">
        <h2 className="ds-h2" id="videira-h">Videira Music</h2>
        {field("videira-url", "Endereço do Videira Music", settings.videiraApiBase, (v) => setSettings({ ...settings, videiraApiBase: v }))}
        {field("videira-token", "Token do Videira Music", tokens.videira, (v) => setTokens({ ...tokens, videira: v }), { type: "password", placeholder: status.videira ? "Já configurado — cole só para trocar" : "Cole o token" })}
        <div className="row"><button className={`ds-button-secondary ${tests.videira?.phase === "testing" ? "is-busy" : ""}`} aria-busy={tests.videira?.phase === "testing"} onClick={() => onTest("videira")}>{tests.videira?.phase === "testing" ? "Testando…" : "Testar Videira Music"}</button><HelpLink onOpen={onHelp} topic="configurar-videira">Como configurar o Videira</HelpLink></div>
        <TestResult test={tests.videira} onHelp={onHelp} />
      </section>
      <div className="row"><button className={`ds-button ${saving ? "is-busy" : ""}`} aria-busy={saving} onClick={onSave}>{saving ? "Salvando…" : "Salvar configuração"}</button>{message && <span role="status" className="sm">{message}</span>}</div>
      <section className="ds-card stack settings-section" aria-labelledby="theme-h">
        <h2 className="ds-h2" id="theme-h">Aparência</h2>
        <div className="seg" role="group" aria-label="Tema">
          {([["system", "Sistema"], ["light", "Claro"], ["dark", "Escuro"]] as Array<[Theme, string]>).map(([k, l]) => <button key={k} aria-pressed={theme === k} onClick={() => setTheme(k)}>{l}</button>)}
        </div>
      </section>
      <Callout tone="warn" icon="shield" title="Sobre a rede">O Holyrics pode aceitar conexões de outros aparelhos na rede. Use uma rede confiável e mantenha o firewall ativo.</Callout>
    </>
  );
}
