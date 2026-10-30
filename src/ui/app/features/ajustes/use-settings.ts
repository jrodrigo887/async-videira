import { useState } from "react";
import type { CredentialTarget, Settings } from "../../../../domain/types.ts";
import { call, codeOf } from "../../shared/api.ts";
import { plural } from "../../shared/ui.tsx";
import type { TestState } from "./ajustes.tsx";

const SAVE_ERRORS: Record<string, string> = {
  INVALID_HOLYRICS_URL: "O endereço do Holyrics não é aceito. Ele precisa ser o deste computador, com http, como http://127.0.0.1:8091.",
  INVALID_VIDEIRA_URL: "O endereço do Videira Music não é aceito. Use o endereço oficial, com https, como https://videiramusic.org.",
  INVALID_CREDENTIAL: "O token parece curto ou longo demais (o app aceita de 8 a 512 caracteres). Copie o token inteiro, sem espaços.",
  VAULT_UNAVAILABLE: "O token não foi guardado: o cofre seguro do Windows não respondeu. Tente de novo; se continuar, feche e abra o app.",
};

const TARGETS = ["holyrics", "videira"] as const;
const NONE = { holyrics: false, videira: false };

/** Ajustes: endereços, tokens (só em memória até salvar) e teste de conexão. */
export function useSettings({ onReady, onConnected }: { onReady: (configured: Record<CredentialTarget, boolean>) => void; onConnected: (target: CredentialTarget) => void }) {
  const [settings, setSettings] = useState<Settings>({ holyricsUrl: "http://127.0.0.1:8091", videiraApiBase: "https://videiramusic.org", firstRunDone: false });
  const [status, setStatus] = useState<Record<CredentialTarget, boolean>>(NONE);
  const [tokens, setTokens] = useState<Record<CredentialTarget, string>>({ holyrics: "", videira: "" });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [tests, setTests] = useState<Record<CredentialTarget, TestState>>({ holyrics: null, videira: null });

  /** Na abertura: devolve quais serviços já têm token. */
  async function load(): Promise<Record<CredentialTarget, boolean>> {
    try { setSettings(await call("settings.get")); } catch {}
    let st = NONE;
    try { st = await call("service.credentials.status"); setStatus(st); } catch {}
    return st;
  }

  async function save() {
    setSaving(true);
    try {
      await call("settings.update", settings);
      for (const target of TARGETS) if (tokens[target]) await call("service.credentials.set", { target, token: tokens[target] });
      const hadTokens = tokens.holyrics || tokens.videira;
      setTokens({ holyrics: "", videira: "" });
      const st = await call("service.credentials.status"); setStatus(st);
      setMessage("Configuração salva neste computador.");
      setTests({ holyrics: null, videira: null });
      if (hadTokens) onReady(st);
      return true;
    } catch (e) {
      setMessage(SAVE_ERRORS[codeOf(e)] ?? "Não foi possível salvar por um motivo inesperado. Tente de novo; se continuar, veja o Histórico.");
      return false;
    } finally { setSaving(false); }
  }

  async function test(target: CredentialTarget) {
    const name = target === "holyrics" ? "Holyrics" : "Videira Music";
    const set = (value: TestState) => setTests((t) => ({ ...t, [target]: value }));
    const typed = tokens[target];
    set({ phase: "testing" });
    setMessage("");
    try {
      const r = await call("connection.check", { target, token: typed || undefined, url: target === "holyrics" ? settings.holyricsUrl : settings.videiraApiBase });
      const unsaved = typed ? " Este token ainda não foi salvo: clique em Salvar configuração para guardá-lo." : "";
      if (!typed) onConnected(target);
      set({ phase: "ok", title: `Conexão com o ${name} funcionando`, body: (target === "videira" ? `Token aceito. ${plural(r.count ?? 0, "setlist publicado encontrado", "setlists publicados encontrados")}.` : `Token aceito. Holyrics ${r.version ?? "respondendo"}.`) + unsaved });
    } catch (err) {
      const code = codeOf(err);
      const help = target === "holyrics" ? "configurar-holyrics" : "configurar-videira";
      const invalid = SAVE_ERRORS[code];
      set({ phase: "error", help, ...(
        code === "AUTH_REQUIRED" ? { title: "Falta o token", body: `Cole o token do ${name} acima e teste de novo.` }
        : code === "AUTH_REJECTED" ? { title: `O ${name} recusou o token`, body: "Ele pode ter sido revogado ou copiado incompleto. Gere outro e cole aqui." }
        : code === "HOLYRICS_NOT_RUNNING" ? { title: "O Holyrics não respondeu", body: "Abra o Holyrics e confira Arquivo → Configurações → API Server → Ativar (local), e o endereço acima." }
        : code === "SERVICE_UNAVAILABLE" ? { title: `Não foi possível alcançar o ${name}`, body: "Confira a conexão com a internet e o endereço." }
        : invalid ? { title: code === "INVALID_CREDENTIAL" ? "Token inválido" : "Endereço inválido", body: invalid.replace("O token não foi guardado: ", "") }
        : { title: "Não foi possível testar a conexão", body: "Confira o endereço e as credenciais." }) });
    }
  }

  return { settings, setSettings, status, tokens, setTokens, message, saving, tests, load, save, test };
}
