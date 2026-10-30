import { BrowserWindow, app } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Janela única, isolada: sem Node no renderer, sandbox ligado, sem janelas novas e sem navegar para fora do app. */
export function createMainWindow() {
  const win = new BrowserWindow({
    width: 1120,
    height: 800,
    minWidth: 760,
    minHeight: 620,
    show: false,
    // Empacotado, o ícone vem do .exe; em desenvolvimento a janela usa o PNG da marca.
    ...(app.isPackaged ? {} : { icon: join(here, "..", "..", "assets", "brand", "icons", "icon-256.png") }),
    webPreferences: { preload: join(here, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (app.isPackaged && url.startsWith("file:") && new URL(url).pathname.endsWith("/.vite-renderer/index.html")) return;
    if (!app.isPackaged && url === "http://127.0.0.1:5173/") return;
    event.preventDefault();
  });
  win.once("ready-to-show", () => win.show());
  return win;
}

export async function loadRenderer(win: BrowserWindow): Promise<void> {
  if (!app.isPackaged) await win.loadURL("http://127.0.0.1:5173");
  else await win.loadFile(join(here, "..", "..", ".vite-renderer", "index.html"));
}
