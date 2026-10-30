import { app, ipcMain, safeStorage, shell } from "electron";
import type { BrowserWindow } from "electron";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createDesktopContainer } from "../src/composition/desktop-container.ts";
import { createProgressForwarder } from "../src/application/services/progress-forwarder.ts";
import { commands } from "../src/interface/electron/ipc/commands.ts";
import { createIpcRouter } from "../src/interface/electron/ipc/router.ts";
import { runSmoke } from "./smoke-hook.ts";
import { createMainWindow, loadRenderer } from "./window.ts";

// Host Electron: ciclo de vida, janela e ponte IPC. Regras e I/O vivem em src/ (ver docs/architecture-target.md).
const smoke = process.env.ASYNC_VIDEIRA_SMOKE === "1";
app.setName("async-videira");
const userData = app.getPath("userData");
const logDir = process.platform === "win32" && process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, "async-videira", "logs")
  : join(userData, "logs");

const desktop = createDesktopContainer({
  userData,
  logDir,
  safeStorage,
  openExternal: (url) => shell.openExternal(url),
  allowLoopbackVideira: smoke,
});
const router = createIpcRouter({
  commands,
  ctx: desktop,
  onFailure: smoke ? (error) => console.error("SMOKE_IPC_ERROR", String((error as Error | null)?.message ?? "operation failed")) : undefined,
});

let win: BrowserWindow | undefined;
app.whenReady().then(async () => {
  await mkdir(userData, { recursive: true });
  await desktop.events.publish({ type: "AppStarted" });
  ipcMain.handle("av:invoke", (event, envelope) => {
    if (event.sender !== win?.webContents) throw new Error("Requisição IPC inválida.");
    return router.handle(envelope);
  });
  const mainWindow = createMainWindow();
  win = mainWindow;
  desktop.events.subscribe(createProgressForwarder((message) => {
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send("av:progress", message);
  }));
  const loaded = smoke ? new Promise<void>((resolve) => mainWindow.webContents.once("did-finish-load", () => resolve())) : null;
  await loadRenderer(mainWindow);
  if (loaded) runSmoke(mainWindow, app, loaded);
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
