import { useCallback, useEffect, useRef, useState } from "react";
import type { PreparationView } from "../../../../application/use-cases/prepare-worship.ts";
import type { CredentialTarget } from "../../../../domain/types.ts";
import type { ProgressMessage } from "../../../../application/services/progress-forwarder.ts";
import { call, codeOf } from "../../shared/api.ts";
import type { ResultBanner } from "./culto.tsx";
import type { Interrupted } from "./recovery.tsx";

export type Conn = "checking" | "ok" | "down" | "offline" | "rejected" | "failed" | null;

const ATTEMPTS = 3;
const RETRY_DELAY_MS = 1200;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const FAILURE: Record<string, Conn> = { HOLYRICS_NOT_RUNNING: "down", SERVICE_UNAVAILABLE: "offline", AUTH_REJECTED: "rejected" };

/** Dados e ações da tela do culto: preparar, publicar, estado das conexões e aviso de publicação interrompida. */
export function useWorship() {
  const [prep, setPrep] = useState<PreparationView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultBanner | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [conn, setConn] = useState<Record<CredentialTarget, Conn>>({ holyrics: null, videira: null });
  const [interrupted, setInterrupted] = useState<Interrupted | null>(null);
  const [progress, setProgress] = useState<ProgressMessage | null>(null);
  const busy = useRef(false);

  useEffect(() => window.asyncVideira.onProgress?.((message) => {
    if (message.operation !== "prepare" && message.operation !== "apply") return;
    setProgress(message.step === "succeeded" || message.step === "failed" ? null : message);
  }), []);

  const prepare = useCallback(async (setlistId?: string, keepResult: ResultBanner | null = null) => {
    if (busy.current) return;
    busy.current = true; setLoading(true); setError(null); setResult(keepResult);
    try {
      const data = await call("worship.prepare", typeof setlistId === "string" ? { setlistId } : {});
      setPrep(data.preparation); setConn({ holyrics: "ok", videira: "ok" });
    } catch (e) {
      const code = codeOf(e);
      setError(code === "INTERNAL" ? "Ocorreu um erro inesperado ao preparar o culto. Tente de novo; se continuar, veja o Histórico." : code);
      setConn((c) => ({
        holyrics: code === "HOLYRICS_NOT_RUNNING" ? "down" : c.holyrics,
        // Sem setlist publicado o Videira respondeu normalmente: o token e a conexão estão bons.
        videira: code === "SERVICE_UNAVAILABLE" ? "offline" : code === "AUTH_REJECTED" ? "rejected" : code === "NO_SETLIST" ? "ok" : c.videira,
      }));
    } finally { busy.current = false; setLoading(false); }
  }, []);

  async function apply() {
    setConfirming(false); setLoading(true); busy.current = true; setResult(null);
    let outcome: ResultBanner;
    try {
      const data = await call("worship.apply");
      const partial = /PARTIAL/.test(String(data.text ?? "").split(/\r?\n/)[0]);
      outcome = { ok: true, title: partial ? "Playlist atualizada, com músicas de fora" : "Playlist atualizada no Holyrics", body: partial ? "A ordem foi aplicada e conferida, mas algumas músicas ainda precisam de você." : "A ordem do setlist foi aplicada e conferida no Holyrics." };
    } catch (e) {
      outcome = { ok: false, title: "Não foi possível publicar", body: codeOf(e) === "HOLYRICS_NOT_RUNNING" ? "O Holyrics não respondeu." : "O Holyrics ou o setlist mudou desde a preparação, ou a escrita falhou. A playlist anterior foi restaurada quando possível: confira no Holyrics e prepare de novo." };
    } finally { busy.current = false; setLoading(false); }
    prepare(undefined, outcome);
  }

  /** Na abertura: uma publicação que caiu no meio precisa de decisão do operador antes de qualquer outra coisa. */
  async function checkInterrupted() {
    try { const r = await call("worship.recover", {}); if (r.status === "interrupted") setInterrupted(r); } catch {}
  }

  /** Verifica um serviço com o que está salvo, em segundo plano: só declara falha depois de todas as tentativas. */
  const probe = useCallback(async (target: CredentialTarget) => {
    setConn((c) => ({ ...c, [target]: "checking" }));
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        await call("connection.probe", { target });
        setConn((c) => ({ ...c, [target]: "ok" }));
        return true;
      } catch (e) {
        const code = codeOf(e);
        const final = attempt === ATTEMPTS || code === "AUTH_REJECTED" || code === "AUTH_REQUIRED";
        if (final) {
          setConn((c) => ({ ...c, [target]: code === "AUTH_REQUIRED" ? null : FAILURE[code] ?? "failed" }));
          return false;
        }
        await wait(RETRY_DELAY_MS);
      }
    }
    return false;
  }, []);

  const markConnected = useCallback((target: CredentialTarget) => setConn((c) => ({ ...c, [target]: "ok" })), []);

  return { progress, prep, error, loading, result, confirming, setConfirming, conn, markConnected, probe, interrupted, clearInterrupted: () => setInterrupted(null), prepare, apply, checkInterrupted };
}
