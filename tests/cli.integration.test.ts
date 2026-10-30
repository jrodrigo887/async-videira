import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { ServerResponse } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runCli } from "../src/cli.ts";
import { readState } from "../src/state/store.ts";
import type { FakeBody } from "./helpers/fake-holyrics-proxy.ts";
import { close, listen, sendJson } from "./helpers/http.ts";

const json = (response: ServerResponse, data: unknown, status = 200) => sendJson(response, status, data);
interface SentReport { status: string; items: Array<{ outcome: string }>; libraryFingerprint: string; [key: string]: unknown }

const SONGS = [
  { id: "1792693855267", title: "Mil Graus", artist: "Renascer Praise" },
  { id: "1792693855255", title: "A Boa Parte", artist: "Florianópolis House Of Prayer e Nívea Soares" },
  { id: "1792693855260", title: "E Ele", artist: "DROPS" },
  { id: "fixture-vida", title: "Vida Aos Sepulcros", artist: "DROPS" },
  { id: "1611686353330", title: "Holyrics", artist: "Software & App" },
];

interface FixtureItem { position: number; songId: string; title: string; artist: string; externalId: string | null }

const linkedItems: FixtureItem[] = [
  { position: 1, songId: "song-a", title: "A Boa Parte", artist: SONGS[1].artist, externalId: SONGS[1].id },
  { position: 2, songId: "song-e", title: "É Ele", artist: "DROPS", externalId: SONGS[2].id },
];

async function createHarness({ items = linkedItems, initialPlaylist = ["old-1", "old-2"], failFirstAdd = false }: { items?: FixtureItem[]; initialPlaylist?: string[]; failFirstAdd?: boolean } = {}) {
  const tempDir = await mkdtemp(join(tmpdir(), "async-videira-cli-"));
  const statePath = join(tempDir, "state.json");
  const holyrics = {
    playlist: [...initialPlaylist],
    calls: [] as string[],
    failFirstAdd,
    addCalls: 0,
    schedule: { type: "temporary", name: "Temporário", datetime: "2026-11-01 10:00", datetime_millis: 1793527200000, lyrics_playlist: [], metadata: null } as Record<string, unknown>,
  };
  const videira = { reports: [] as SentReport[], calls: [] as string[], reportStatus: 201 };
  const holyricsServer = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const action = url.pathname.split("/").at(-1);
    holyrics.calls.push(action ?? "");
    if (url.searchParams.get("token") !== "fake-holyrics-secret") return json(response, { status: "error" }, 401);
    let body: FakeBody = {};
    if (request.method === "POST") {
      let text = "";
      for await (const chunk of request) text += chunk;
      body = text ? JSON.parse(text) : {};
    }
    if (action === "GetVersion") return json(response, { status: "ok", data: { version: "2.30.0", baseDir: "C:\\Holyrics", platform: "win", ip_list: ["192.168.1.20"] } });
    if (action === "GetTokenInfo") return json(response, { status: "ok", data: { version: "2.30.0" } });
    if (action === "GetHolyricsPlanInfo") return json(response, { status: "ok", data: { type: "none" } });
    if (action === "GetAPIServerInfo") return json(response, { status: "ok", data: { enabled_local: true, port: 8091, ip_list: ["192.168.1.20"] } });
    if (action === "GetSongs") {
      assert.equal(body.fields, "id,title,artist");
      return json(response, { status: "ok", data: SONGS });
    }
    if (action === "GetCurrentSchedule") return json(response, { status: "ok", data: [holyrics.schedule] });
    if (action === "GetLyricsPlaylist") {
      return json(response, { status: "ok", data: holyrics.playlist.map((id) => SONGS.find((song) => song.id === id) ?? { id, title: "Playlist anterior", artist: "" }) });
    }
    if (action === "RemoveFromLyricsPlaylist") {
      const removing = new Set(body.indexes);
      holyrics.playlist = holyrics.playlist.filter((_, index) => !removing.has(index));
      return json(response, { status: "ok" });
    }
    if (action === "AddLyricsToPlaylist") {
      holyrics.addCalls += 1;
      if (holyrics.failFirstAdd && holyrics.addCalls === 1) {
        holyrics.playlist.push(...(body.ids as string[]).slice(0, 1)); // Simulate a partially applied request.
        return json(response, { status: "error", error: "simulated failure" });
      }
      for (const id of body.ids ?? []) if (!holyrics.playlist.includes(String(id))) holyrics.playlist.push(String(id));
      return json(response, { status: "ok" });
    }
    return json(response, { status: "error", error: "unknown action" });
  });
  const videiraServer = createServer(async (request, response) => {
    videira.calls.push(`${request.method} ${request.url}`);
    if (request.headers.authorization !== "Bearer fake-videira-secret") return json(response, { error: "unauthorized" }, 401);
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/api/integrations/holyrics/setlists" && request.method === "GET") {
      return json(response, { date: "2026-11-01", setlists: [{ id: "set-1", title: "Culto de teste" }] });
    }
    if (url.pathname === "/api/integrations/holyrics/setlists/set-1" && request.method === "GET") {
      return json(response, { setlistId: "set-1", title: "Culto de teste", eventAt: "2026-11-01T13:00:00.000Z", items });
    }
    if (url.pathname === "/api/integrations/holyrics/sync-reports" && request.method === "POST") {
      let text = "";
      for await (const chunk of request) text += chunk;
      const report = JSON.parse(text);
      if (videira.reportStatus >= 200 && videira.reportStatus < 300) videira.reports.push(report);
      return json(response, videira.reportStatus < 300 ? { ok: true } : { error: "INVALID_REQUEST" }, videira.reportStatus);
    }
    return json(response, { error: "not found" }, 404);
  });
  const holyricsUrl = await listen(holyricsServer);
  const videiraUrl = await listen(videiraServer);
  const env = {
    VIDEIRA_API_BASE: videiraUrl,
    VIDEIRA_TOKEN: "fake-videira-secret",
    HOLYRICS_URL: holyricsUrl,
    HOLYRICS_TOKEN: "fake-holyrics-secret",
    SETLIST_ID: "set-1",
    ASYNC_VIDEIRA_STATE_PATH: statePath,
  };
  return {
    env, statePath, holyrics, videira,
    async cleanup() {
      await close(holyricsServer);
      await close(videiraServer);
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

function capture() {
  let out = "";
  let err = "";
  return {
    stdout: { write: (text: string) => { out += text; } },
    stderr: { write: (text: string) => { err += text; } },
    output: () => out,
    errors: () => err,
  };
}

test("preparar then aplicar publishes a verified order and sends a report", async (t) => {
  const h = await createHarness();
  t.after(h.cleanup);
  const io = capture();
  assert.equal(await runCli(["preparar"], { env: h.env, ...io }), 0);
  assert.match(io.output(), /\[resolved\]/);
  assert.match(io.output(), /Destino selecionado: Temporário/);
  assert.match(io.output(), /01\. \[resolved\]/);
  assert.doesNotMatch(io.output(), /02\. \[resolved\] A Boa Parte/);
  assert.equal(h.holyrics.calls.includes("RemoveFromLyricsPlaylist"), false);
  assert.equal(h.videira.reports.length, 0);
  assert.doesNotMatch(await readFile(h.statePath, "utf8"), /fake-(?:holyrics|videira)-secret/);

  assert.equal(await runCli(["aplicar", "--yes"], { env: h.env, ...io }), 0);
  assert.deepEqual(h.holyrics.playlist, [SONGS[1].id, SONGS[2].id]);
  assert.equal(h.videira.reports.length, 1);
  assert.equal(h.videira.reports[0].status, "OK");
  assert.deepEqual(h.videira.reports[0].items.map((item) => item.outcome), ["added", "added"]);
  assert.equal(typeof h.videira.reports[0].libraryFingerprint, "string");
  assert.ok(h.videira.reports[0].libraryFingerprint.length <= 256);
  assert.match(h.videira.reports[0].libraryFingerprint, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(`${io.output()}${io.errors()}`, /fake-(?:holyrics|videira)-secret/);
});

test("É Ele broad-search extra is filtered by exact title+artist and remains a review suggestion", async (t) => {
  const h = await createHarness({
    items: [{ position: 1, songId: "song-e", title: "É Ele", artist: "DROPS", externalId: null }],
  });
  t.after(h.cleanup);
  const io = capture();
  assert.equal(await runCli(["preparar"], { env: h.env, ...io }), 0);
  assert.match(io.output(), /\[absent\] É Ele/);
  assert.match(io.output(), /E Ele — DROPS/);
  assert.doesNotMatch(io.output(), /\[ambiguous\] É Ele/);
  assert.equal(h.holyrics.calls.includes("SearchLyrics"), false);
  assert.equal(h.holyrics.calls.includes("AddLyricsToPlaylist"), false);
  assert.equal(h.videira.reports.length, 0);
});

test("repeated linked song is deduplicated and reported as duplicate", async (t) => {
  const h = await createHarness({ items: [linkedItems[0], linkedItems[1], { ...linkedItems[0], position: 3 }] });
  t.after(h.cleanup);
  const io = capture();
  assert.equal(await runCli(["preparar"], { env: h.env, ...io }), 0);
  assert.match(io.output(), /\[repeated\] A Boa Parte/);
  assert.equal(await runCli(["aplicar", "--yes"], { env: h.env, ...io }), 0);
  assert.deepEqual(h.holyrics.playlist, [SONGS[1].id, SONGS[2].id]);
  assert.deepEqual(h.videira.reports[0].items.map((item) => item.outcome), ["added", "added", "duplicate"]);
});

test("partial Add failure restores the playlist and reports failed items", async (t) => {
  const original = ["old-1", "old-2"];
  const h = await createHarness({ items: [linkedItems[0]], initialPlaylist: original, failFirstAdd: true });
  t.after(h.cleanup);
  const io = capture();
  assert.equal(await runCli(["preparar"], { env: h.env, ...io }), 0);
  assert.equal(await runCli(["aplicar", "--yes"], { env: h.env, ...io }), 1);
  assert.deepEqual(h.holyrics.playlist, original);
  assert.equal(h.videira.reports.length, 1);
  assert.equal(h.videira.reports[0].status, "FAILED");
  assert.deepEqual(h.videira.reports[0].items.map((item) => item.outcome), ["failed"]);
  assert.match(io.output(), /playlist was restored|não verificada/);
});

test("second prepare/apply is idempotent when playlist already matches deduplicated target", async (t) => {
  const h = await createHarness({ items: [linkedItems[0]] });
  t.after(h.cleanup);
  const io = capture();
  assert.equal(await runCli(["preparar"], { env: h.env, ...io }), 0);
  assert.equal(await runCli(["aplicar", "--yes"], { env: h.env, ...io }), 0);
  const firstRemoveCount = h.holyrics.calls.filter((action) => action === "RemoveFromLyricsPlaylist").length;
  const firstAddCount = h.holyrics.calls.filter((action) => action === "AddLyricsToPlaylist").length;

  assert.equal(await runCli(["preparar"], { env: h.env, ...io }), 0);
  assert.equal(await runCli(["aplicar", "--yes"], { env: h.env, ...io }), 0);
  assert.equal(h.holyrics.calls.filter((action) => action === "RemoveFromLyricsPlaylist").length, firstRemoveCount);
  assert.equal(h.holyrics.calls.filter((action) => action === "AddLyricsToPlaylist").length, firstAddCount);
  assert.equal(h.videira.reports.length, 2);
  assert.deepEqual(h.videira.reports[1].items.map((item) => item.outcome), ["unchanged"]);
});

test("pending sync reports survive HTTP 400 and are removed after a successful retry", async (t) => {
  const h = await createHarness({ items: [linkedItems[0]] });
  t.after(h.cleanup);
  const io = capture();
  h.videira.reportStatus = 400;
  assert.equal(await runCli(["preparar"], { env: h.env, ...io }), 0);
  assert.equal(await runCli(["aplicar", "--yes"], { env: h.env, ...io }), 0);
  let state = await readState(h.statePath);
  assert.equal(state.pendingReports.length, 1);
  assert.equal(state.pendingReports[0].attemptCount, 1);
  assert.equal(typeof state.pendingReports[0].report.libraryFingerprint, "object");

  // Preparing starts by retrying the queued report; a rejected request remains queued.
  assert.equal(await runCli(["preparar"], { env: h.env, ...io }), 0);
  state = await readState(h.statePath);
  assert.equal(state.pendingReports.length, 1);
  assert.equal(state.pendingReports[0].attemptCount, 2);

  h.videira.reportStatus = 201;
  assert.equal(await runCli(["preparar"], { env: h.env, ...io }), 0);
  state = await readState(h.statePath);
  assert.equal(state.pendingReports.length, 0);
  assert.equal(h.videira.reports.length, 1);
  assert.equal(typeof h.videira.reports[0].libraryFingerprint, "string");
  assert.ok(h.videira.reports[0].libraryFingerprint.length <= 256);
});

test("aplicar refuses to run without --yes and without a completed preparar", async (t) => {
  const h = await createHarness();
  t.after(h.cleanup);
  const io = capture();
  assert.equal(await runCli(["aplicar"], { env: h.env, ...io }), 1);
  assert.match(io.errors(), /requires --yes/);
  assert.equal(h.holyrics.calls.length, 0);
  assert.equal(await runCli(["aplicar", "--yes"], { env: h.env, ...io }), 1);
  assert.match(io.errors(), /execute preparar/);
  assert.equal(h.holyrics.calls.length, 0);
});

test("aplicar refuses when the selected Holyrics service changes after preparar", async (t) => {
  const h = await createHarness();
  t.after(h.cleanup);
  const io = capture();
  assert.equal(await runCli(["preparar"], { env: h.env, ...io }), 0);
  h.holyrics.schedule = {
    type: "service",
    name: "Outro culto",
    datetime: "2026-11-08 10:00",
    datetime_millis: 1794132000000,
    lyrics_playlist: [],
    metadata: { event: { id: "event-2" } },
  };

  assert.equal(await runCli(["aplicar", "--yes"], { env: h.env, ...io }), 1);
  assert.match(io.errors(), /selected schedule changed/);
  assert.equal(h.holyrics.calls.includes("RemoveFromLyricsPlaylist"), false);
  assert.equal(h.holyrics.calls.includes("AddLyricsToPlaylist"), false);
  assert.equal(h.videira.reports.length, 0);
});
