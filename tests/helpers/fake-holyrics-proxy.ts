import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export interface FakeSong { id: string | number; title: string; artist: string }
export interface FakeBody { fields?: string; indexes?: number[]; ids?: unknown[]; [key: string]: unknown }
export interface FakeHolyricsOptions {
  playlist?: string[];
  catalog?: FakeSong[];
  schedule?: Record<string, unknown>;
  expectedToken?: string;
  dropBeforeAddCount?: number;
  failAddStatusCount?: number;
  reverseReadbackFor?: string[];
  editorStatus?: number;
  forwardReadOnly?: boolean;
  holyricsBaseUrl?: string;
}

const DEFAULT_SONGS: FakeSong[] = [
  { id: "song-a", title: "A Boa Parte", artist: "FHOP" },
  { id: "song-b", title: "Mil Graus", artist: "Renascer Praise" },
];
const WRITE_ACTIONS = new Set(["RemoveFromLyricsPlaylist", "AddLyricsToPlaylist", "popup-createsong"]);

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

async function readBody(request: IncomingMessage): Promise<FakeBody> {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

/**
 * Start an in-memory fake by default. Optional read-only forwarding sends only
 * Get* requests to the local Holyrics instance; playlist writes are always blocked.
 */
export async function startFakeHolyricsProxy({
  playlist = ["previous-a", "previous-b"],
  catalog = DEFAULT_SONGS,
  schedule = { type: "temporary", name: "Temporário", datetime: "2026-11-01 10:00", lyrics_playlist: [], metadata: null },
  expectedToken = "fake-holyrics-token",
  dropBeforeAddCount = 0,
  failAddStatusCount = 0,
  reverseReadbackFor = [],
  editorStatus = 200,
  forwardReadOnly = false,
  holyricsBaseUrl = "http://127.0.0.1:8091",
}: FakeHolyricsOptions = {}) {
  const state = {
    calls: [] as Array<{ action: string; body: FakeBody }>,
    writes: [] as Array<{ action: string; body: FakeBody }>,
    playlist: playlist.map(String),
    catalog: catalog.map((song): { id: string; title: string; artist: string } => ({ ...song, id: String(song.id) })),
    schedule,
    dropBeforeAddCount,
    failAddStatusCount,
    reverseReadbackFor: reverseReadbackFor.map(String),
    editorStatus,
    closed: false,
  };

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const action = url.pathname.split("/").at(-1) ?? "";
    let body: FakeBody = {};
    try {
      body = await readBody(request);
    } catch {
      return sendJson(response, 400, { status: "error" });
    }
    state.calls.push({ action, body });
    if (action !== "popup-createsong" && url.searchParams.get("token") !== expectedToken) {
      return sendJson(response, 401, { status: "error" });
    }

    if (forwardReadOnly && action.startsWith("Get")) {
      let forwarded: Response;
      try {
        const target = `${holyricsBaseUrl.replace(/\/+$/, "")}/api/${action}?token=${encodeURIComponent(process.env.HOLYRICS_TOKEN ?? "")}`;
        forwarded = await fetch(target, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const raw = await forwarded.text();
        response.writeHead(forwarded.status, { "Content-Type": forwarded.headers.get("content-type") ?? "application/json" });
        return response.end(raw);
      } catch {
        return response.destroy();
      }
    }
    if (forwardReadOnly && WRITE_ACTIONS.has(action)) return sendJson(response, 403, { status: "error", error: "fake proxy blocks writes" });

    if (action === "GetVersion") return sendJson(response, 200, { status: "ok", data: { version: "2.30.0", baseDir: "C:\\Holyrics", platform: "win", ip_list: ["192.168.1.20"] } });
    if (action === "GetTokenInfo") return sendJson(response, 200, { status: "ok", data: { version: "2.30.0" } });
    if (action === "GetHolyricsPlanInfo") return sendJson(response, 200, { status: "ok", data: { type: "none" } });
    if (action === "GetAPIServerInfo") return sendJson(response, 200, { status: "ok", data: { enabled_local: true, port: 8091, ip_list: ["192.168.1.20"] } });
    if (action === "GetSongs") return sendJson(response, 200, { status: "ok", data: state.catalog });
    if (action === "GetCurrentSchedule") return sendJson(response, 200, { status: "ok", data: [state.schedule] });
    if (action === "GetLyricsPlaylist") {
      let ids = state.playlist;
      if (state.reverseReadbackFor.length && ids.length === state.reverseReadbackFor.length && ids.every((id, index) => id === state.reverseReadbackFor[index])) {
        ids = [...ids].reverse();
      }
      return sendJson(response, 200, { status: "ok", data: ids.map((id) => state.catalog.find((song) => song.id === id) ?? { id, title: id, artist: "" }) });
    }
    if (action === "RemoveFromLyricsPlaylist") {
      state.writes.push({ action, body });
      const indexes = new Set(body.indexes ?? []);
      state.playlist = state.playlist.filter((_, index) => !indexes.has(index));
      return sendJson(response, 200, { status: "ok" });
    }
    if (action === "AddLyricsToPlaylist") {
      state.writes.push({ action, body });
      if (state.dropBeforeAddCount > 0) {
        state.dropBeforeAddCount -= 1;
        return response.destroy();
      }
      if (state.failAddStatusCount > 0) {
        state.failAddStatusCount -= 1;
        return sendJson(response, 500, { status: "error", error: "injected Add failure" });
      }
      for (const id of body.ids ?? []) if (!state.playlist.includes(String(id))) state.playlist.push(String(id));
      return sendJson(response, 200, { status: "ok" });
    }
    if (action === "popup-createsong") return sendJson(response, state.editorStatus, { status: state.editorStatus === 200 ? "ok" : "error" });
    return sendJson(response, 404, { status: "error", error: "unknown action" });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  return {
    baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    state,
    close: async () => {
      if (state.closed) return;
      state.closed = true;
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
