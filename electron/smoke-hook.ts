// Teste de fumaça do app empacotado (ASYNC_VIDEIRA_SMOKE=1): configura os servidores falsos de electron/smoke.ts
// pela mesma ponte IPC que a UI usa e confere que o dry-run funciona de ponta a ponta.
import type { App, BrowserWindow } from "electron";

export function runSmoke(win: BrowserWindow, app: App, loaded: Promise<unknown>): void {
  loaded.then(async () => {
    try {
      const script = `(async () => {
        const call = async (command, payload) => { const r = await window.asyncVideira.invoke(command, payload); if (!r.ok) throw Error(command + ":" + r.error.code); return r.data; };
        await call("settings.update", { holyricsUrl: ${JSON.stringify(process.env.SMOKE_HOLYRICS_URL)}, videiraApiBase: ${JSON.stringify(process.env.SMOKE_VIDEIRA_URL)} });
        for (const target of ["holyrics", "videira"]) await call("service.credentials.set", { target, token: "smoke-token" });
        return call("worship.prepare");
      })()`;
      const data = await win.webContents.executeJavaScript(script);
      if (!data?.text?.includes("Smoke setlist") || !data.text.includes("nenhuma escrita feita")) throw new Error("Unexpected preparation result");
      console.log("SMOKE_OK", data.text.trim().replaceAll("\n", " | "));
      app.exit(0);
    } catch (error) { console.error("SMOKE_FAILED", (error as Error | null)?.message ?? "unknown"); app.exit(1); }
  });
}
