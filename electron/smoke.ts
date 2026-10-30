import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { spawn } from "node:child_process";
import type { ChildProcess, ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const listen = (server: Server) => new Promise<number>((resolveListen, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", () => resolveListen((server.address() as AddressInfo).port)); });
const holyrics = createServer(async (req, res) => {
  let body = ""; for await (const chunk of req) body += chunk;
  const action = new URL(req.url ?? "/", "http://127.0.0.1").pathname.split("/").pop();
  const responses: Record<string, unknown> = {
    GetVersion: { version: "2.30.0", baseDir: "fixture", platform: "win32", ip_list: [] }, GetTokenInfo: {},
    GetHolyricsPlanInfo: { type: "none" }, GetAPIServerInfo: {},
    GetSongs: [{ id: "song-1", title: "Canção smoke", artist: "Banda smoke" }],
    GetCurrentSchedule: { type: "temporary", name: "Destino smoke" }, GetLyricsPlaylist: [],
  };
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ status: "ok", data: responses[action ?? ""] ?? null }));
});
const videira = createServer((req, res) => {
  const path = new URL(req.url ?? "/", "https://videiramusic.org").pathname;
  const data = path.endsWith("/setlists") ? { setlists: [{ id: "set-smoke" }] } : { id: "set-smoke", setlistId: "set-smoke", title: "Smoke setlist", items: [{ position: 1, songId: "videira-1", title: "Canção smoke", artist: "Banda smoke", externalId: "song-1" }] };
  res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(data));
});

const temp = await mkdtemp(join(tmpdir(), "async-videira-smoke-"));
let child: ChildProcess | undefined;

function launch(executable: string, args: string[], env: NodeJS.ProcessEnv): ChildProcessWithoutNullStreams {
  try {
    return spawn(executable, args, { cwd: process.cwd(), windowsHide: true, env });
  } catch (error) {
    if ((error as NodeJS.ErrnoException | null)?.code === "UNKNOWN") throw new Error("Windows refused to launch the unsigned packaged app (spawn UNKNOWN). The smoke must run on a machine whose Device Guard policy allows this test build.");
    throw error;
  }
}

try {
  const [holyricsPort, videiraPort] = await Promise.all([listen(holyrics), listen(videira)]);
  const executable = resolve("dist/win-unpacked/async-videira.exe");
  const proc = launch(executable, [`--user-data-dir=${join(temp, "profile")}`], { ...process.env, ASYNC_VIDEIRA_SMOKE: "1", ASYNC_VIDEIRA_STATE_PATH: join(temp, "state.json"), SMOKE_HOLYRICS_URL: `http://127.0.0.1:${holyricsPort}`, SMOKE_VIDEIRA_URL: `http://127.0.0.1:${videiraPort}` });
  child = proc;
  const result = await new Promise<string>((resolveResult, reject) => {
    let logs = ""; const timer = setTimeout(() => reject(new Error(`Smoke timeout. ${logs}`)), 90_000);
    proc.on("error", (error) => { clearTimeout(timer); reject(new Error(`Could not launch the packaged app: ${error.message}`)); });
    proc.stdout.on("data", (data: Buffer) => { logs += data; if (logs.includes("SMOKE_OK")) { clearTimeout(timer); resolveResult(logs); } });
    proc.stderr.on("data", (data: Buffer) => { logs += data; if (logs.includes("SMOKE_FAILED")) { clearTimeout(timer); reject(new Error(logs)); } });
    proc.once("exit", (code) => { if (code && !logs.includes("SMOKE_OK")) { clearTimeout(timer); reject(new Error(`Electron exited ${code}. ${logs}`)); } });
  });
  process.stdout.write(result);
} finally {
  if (child && child.exitCode === null) {
    const running = child;
    const exited = new Promise<void>((resolveExit) => running.once("exit", () => resolveExit()));
    const finished = await Promise.race([exited.then(() => true), new Promise<boolean>((resolveWait) => setTimeout(() => resolveWait(false), 5000))]);
    if (!finished) { running.kill(); await exited; }
  }
  holyrics.close(); videira.close(); await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
}
