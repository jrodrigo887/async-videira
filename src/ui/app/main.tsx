import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import "./shared/web-shim.ts";
import brandIcon from "./shared/assets/icone-app.svg";
import type { CredentialTarget } from "../../domain/types.ts";
import { Ajuda } from "./features/ajuda/ajuda.tsx";
import { useHelp } from "./features/ajuda/use-help.ts";
import { Ajustes } from "./features/ajustes/ajustes.tsx";
import { useSettings } from "./features/ajustes/use-settings.ts";
import { ConfirmApply } from "./features/culto/confirm-apply.tsx";
import { Culto } from "./features/culto/culto.tsx";
import { RecoveryBanner } from "./features/culto/recovery.tsx";
import { useWorship } from "./features/culto/use-worship.ts";
import { Historico } from "./features/historico/historico.tsx";
import { useLogs } from "./features/historico/use-logs.ts";
import { Vinculos } from "./features/vinculos/vinculos.tsx";
import { useLinks } from "./features/vinculos/use-links.ts";
import { Icon, plural, songState } from "./shared/ui.tsx";
import type { IconName, Screen } from "./shared/ui.tsx";
import { useTheme } from "./shared/use-theme.ts";

const NAV: Array<[Screen, IconName, string]> = [["culto", "music", "Culto"], ["vinculos", "link", "Vínculos"], ["historico", "history", "Histórico"], ["ajustes", "settings", "Ajustes"], ["ajuda", "help", "Ajuda"]];

const CONN_LABELS: Record<string, string> = { ok: "conectado", down: "não conectado: não está respondendo", offline: "não conectado: sem internet", rejected: "não conectado: token recusado", failed: "não foi possível conectar" };

// Raiz: roteamento entre telas, tema, atalhos e a ordem de abertura. Dados e ações ficam nos hooks de cada funcionalidade.
function App() {
  const [screen, setScreen] = useState<Screen>("culto");
  const [helpReturn, setHelpReturn] = useState<Screen | null>(null);
  const [theme, setTheme] = useTheme();
  const worship = useWorship();
  const { prep, prepare } = worship;
  const { probe } = worship;
  // Confere cada serviço configurado (com tentativas) e só então prepara o culto.
  const connectAndPrepare = useCallback(async (configured: Record<CredentialTarget, boolean>) => {
    const targets = (Object.keys(configured) as CredentialTarget[]).filter((target) => configured[target]);
    await Promise.all(targets.map(probe));
    if (targets.length === 2) prepare();
  }, [probe, prepare]);
  const config = useSettings({ onReady: connectAndPrepare, onConnected: worship.markConnected });
  const links = useLinks(prepare);
  const help = useHelp();
  const logs = useLogs();

  useEffect(() => {
    (async () => {
      const configured = await config.load();
      await help.loadList();
      await worship.checkInterrupted();
      if (configured.holyrics || configured.videira) await connectAndPrepare(configured); else setScreen("culto");
    })();
    // Só na abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openHelp = useCallback(async (topicId = "comecar") => {
    setHelpReturn((r) => r ?? screen);
    setScreen("ajuda");
    await help.open(topicId);
  }, [screen, help.open]);

  const go = useCallback((next: Screen) => {
    setHelpReturn(null); setScreen(next);
    if (next === "historico") logs.refresh();
    if (next === "ajuda" && !help.article) openHelp("comecar");
  }, [help.article, openHelp, logs.refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F1") { e.preventDefault(); openHelp("comecar"); }
      else if (e.ctrlKey && /^[1-4]$/.test(e.key)) { e.preventDefault(); go(NAV[Number(e.key) - 1]![0]); }
      else if (e.ctrlKey && e.key.toLowerCase() === "r") { e.preventDefault(); if (screen === "culto") prepare(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, openHelp, prepare, screen]);

  const pendingCount = prep ? prep.items.filter((i) => ["needsLink", "chooseVersion", "missing"].includes(songState(i))).length : 0;
  const canApply = prep !== null && prep.targetCount > 0 && prep.mutates && !worship.loading;
  const hint = !prep ? "Prepare o culto para ver o que será publicado."
    : !prep.mutates && prep.targetCount > 0 ? "A playlist do Holyrics já está igual ao setlist."
    : pendingCount ? `${plural(pendingCount, "música precisa", "músicas precisam")} de você antes de publicar.` : "Tudo pronto para publicar.";

  const pill = (target: CredentialTarget, label: string) => {
    const state = worship.conn[target];
    const configured = config.status[target];
    const checking = configured && state === "checking";
    const text = !configured ? "sem token" : checking ? "conectando…" : (state && CONN_LABELS[state]) || "token configurado";
    const tone = state === "ok" || checking ? "" : state === "offline" || (!state && configured) ? "warn" : "danger";
    return <button className={`conn-pill ${tone}`} onClick={() => go("ajustes")} aria-busy={checking}>{checking ? <span className="spinner" aria-hidden="true" /> : <span className="dot" aria-hidden="true" />}{label}: {text}</button>;
  };

  return (
    <div className="app">
      <a className="skip-link ds-button" href="#main">Pular para o conteúdo</a>
      <div className="app-body">
        <nav className="app-nav" aria-label="Principal">
          <div className="brand"><img className="brand-mark" src={brandIcon} alt="" aria-hidden="true" /><span className="brand-text">async-videira<small>Videira Music · Holyrics</small></span></div>
          {NAV.map(([key, ic, label], i) => (
            <button key={key} className="nav-item" aria-current={screen === key ? "page" : undefined} title={`${label} (${i < 4 ? `Ctrl+${i + 1}` : "F1"})`} onClick={() => (key === "ajuda" ? openHelp(help.article?.id ?? "comecar") : go(key))}>
              <Icon name={ic} /><span className="label">{label}</span>
              {key === "vinculos" && pendingCount > 0 && <span className="count" aria-hidden="true">{pendingCount}</span>}
            </button>
          ))}
          <div className="nav-foot">v0.1.0</div>
        </nav>
        <div className="app-main">
          <div className="connbar" role="status" aria-label="Conexões">{pill("holyrics", "Holyrics")}{pill("videira", "Videira Music")}</div>
          <main id="main" className="content" tabIndex={-1}>
            <div className="content-inner stack">
              {screen === "culto" && worship.interrupted && <RecoveryBanner report={worship.interrupted} onDone={worship.clearInterrupted} />}
              {screen === "culto" && <Culto progress={worship.progress} prep={prep} error={worship.error} loading={worship.loading} configured={config.status} result={worship.result} onPrepare={prepare} onGo={go} onHelp={openHelp} />}
              {screen === "vinculos" && <Vinculos prep={prep} onGo={go} onHelp={openHelp} onConfirm={links.confirmLinks} onRemove={links.removeLink} onOpenEditor={links.openEditor} onAwaitCreated={links.awaitCreated} />}
              {screen === "historico" && <Historico logs={logs.logs} message={logs.message} onRefresh={logs.refresh} onCopy={logs.copy} />}
              {screen === "ajustes" && <Ajustes settings={config.settings} setSettings={config.setSettings} status={config.status} tokens={config.tokens} setTokens={config.setTokens} message={config.message} saving={config.saving} tests={config.tests} theme={theme} setTheme={setTheme} onSave={config.save} onTest={config.test} onHelp={openHelp} />}
              {screen === "ajuda" && <Ajuda topics={help.topics} article={help.article} query={help.query} onQuery={help.search} loadTopic={help.loadTopic} onBack={helpReturn && helpReturn !== "ajuda" ? () => go(helpReturn) : null} />}
            </div>
          </main>
          {screen === "culto" && (
            <div className="action-bar">
              <span className="hint">{hint}</span>
              <button className="ds-button" disabled={!canApply} onClick={() => worship.setConfirming(true)}>Publicar no Holyrics</button>
            </div>
          )}
        </div>
      </div>
      {worship.confirming && prep && <ConfirmApply prep={prep} onCancel={() => worship.setConfirming(false)} onConfirm={worship.apply} />}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
