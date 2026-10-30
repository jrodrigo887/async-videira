import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createHolyricsClient } from "../src/adapters/holyrics-api/client.ts";
import { helpTopicForError } from "../src/core/help/index.ts";
import { readState } from "../src/state/store.ts";
import { runCli } from "../src/cli.ts";
import { startFakeHolyricsProxy } from "./helpers/fake-holyrics-proxy.ts";
import type { FakeHolyricsOptions } from "./helpers/fake-holyrics-proxy.ts";
import { close, listen, sendJson as json } from "./helpers/http.ts";

const SONGS = [
  { id: "song-a", title: "A Boa Parte", artist: "FHOP" },
  { id: "song-b", title: "Mil Graus", artist: "Renascer Praise" },
];
const ITEMS = SONGS.map((song, index) => ({
  position: index + 1,
  songId: `videira-${song.id}`,
  title: song.title,
  artist: song.artist,
  externalId: song.id,
}));

interface SentReport { status: string; items: Array<{ outcome: string }>; [key: string]: unknown }
type Harness = Awaited<ReturnType<typeof createHarness>>;

async function createHarness(holyricsOptions: FakeHolyricsOptions = {}) {
  const tempDir = await mkdtemp(join(tmpdir(), "async-videira-resilience-"));
  const statePath = join(tempDir, "state.json");
  const holyrics = await startFakeHolyricsProxy({ catalog: SONGS, ...holyricsOptions });
  const videira = { reports: [] as SentReport[], reportStatus: 201, calls: 0 };
  const server = createServer(async (request, response) => {
    if (request.headers.authorization !== "Bearer fake-videira-secret") return json(response, 401, { error: "unauthorized" });
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/api/integrations/holyrics/setlists" && request.method === "GET") {
      return json(response, 200, { setlists: [{ id: "set-1", title: "Culto teste" }] });
    }
    if (url.pathname === "/api/integrations/holyrics/setlists/set-1" && request.method === "GET") {
      return json(response, 200, { setlistId: "set-1", title: "Culto teste", eventAt: "2026-11-01T13:00:00.000Z", items: ITEMS });
    }
    if (url.pathname === "/api/integrations/holyrics/sync-reports" && request.method === "POST") {
      let raw = "";
      for await (const chunk of request) raw += chunk;
      const report = JSON.parse(raw);
      videira.calls += 1;
      if (videira.reportStatus >= 200 && videira.reportStatus < 300) videira.reports.push(report);
      return json(response, videira.reportStatus, videira.reportStatus < 300 ? { ok: true } : { error: "temporary failure" });
    }
    return json(response, 404, { error: "not found" });
  });
  const videiraUrl = await listen(server);
  const env = {
    VIDEIRA_API_BASE: videiraUrl,
    VIDEIRA_TOKEN: "fake-videira-secret",
    HOLYRICS_URL: holyrics.baseUrl,
    HOLYRICS_TOKEN: "fake-holyrics-token",
    SETLIST_ID: "set-1",
    ASYNC_VIDEIRA_STATE_PATH: statePath,
  };
  let stdoutText = "";
  let stderrText = "";
  const io = {
    stdout: { write: (text: string) => { stdoutText += text; } },
    stderr: { write: (text: string) => { stderrText += text; } },
    stdoutText: () => stdoutText,
    stderrText: () => stderrText,
  };
  return {
    holyrics, videira, server, env, statePath, io,
    async cleanup() {
      await holyrics.close();
      await close(server);
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

async function prepare(h: Harness) {
  return runCli(["preparar"], { env: h.env, stdout: h.io.stdout, stderr: h.io.stderr });
}

async function apply(h: Harness) {
  return runCli(["aplicar", "--yes"], { env: h.env, stdout: h.io.stdout, stderr: h.io.stderr });
}

test("connection drop between Remove and Add restores and verifies old playlist", async (t) => {
  const original = ["previous-a", "previous-b"];
  const h = await createHarness({ playlist: original, dropBeforeAddCount: 1 });
  t.after(h.cleanup);
  assert.equal(await prepare(h), 0);
  assert.equal(await apply(h), 1);
  assert.deepEqual(h.holyrics.state.playlist, original);
  const state = await readState(h.statePath);
  assert.equal(state.prepared, null);
  assert.equal(state.lastRun!.status, "FAILED");
  assert.equal(state.lastRun!.restored, true);
  assert.equal("applied" in state.lastRun!, false);
  assert.equal(h.videira.reports.length, 1);
  assert.equal(h.videira.reports[0].status, "FAILED");
  assert.match(h.io.stdoutText(), /A playlist anterior foi restaurada e verificada/);
  assert.match(h.io.stdoutText(), /Ajuda: configurar-holyrics/);
  assert.equal(helpTopicForError("APPLY_FAILED"), "configurar-holyrics");
});

test("HTTP 500 from Add restores and verifies playlist, with a typed failure report", async (t) => {
  const original = ["previous-a"];
  const h = await createHarness({ playlist: original, failAddStatusCount: 1 });
  t.after(h.cleanup);
  assert.equal(await prepare(h), 0);
  assert.equal(await apply(h), 1);
  assert.deepEqual(h.holyrics.state.playlist, original);
  const state = await readState(h.statePath);
  assert.equal(state.lastRun!.errorCode, "APPLY_FAILED");
  assert.equal(state.lastRun!.restored, true);
  assert.deepEqual(h.videira.reports[0].items.map((item) => item.outcome), ["failed", "failed"]);
});

test("reordered readback fails verification and restores old playlist", async (t) => {
  const original = ["previous-b", "previous-a"];
  const target = SONGS.map((song) => song.id);
  const h = await createHarness({ playlist: original, reverseReadbackFor: target });
  t.after(h.cleanup);
  assert.equal(await prepare(h), 0);
  assert.equal(await apply(h), 1);
  assert.deepEqual(h.holyrics.state.playlist, original);
  const state = await readState(h.statePath);
  assert.equal(state.lastRun!.errorCode, "APPLY_FAILED");
  assert.equal(state.lastRun!.restored, true);
});

test("failed restore is explicit and does not claim that old playlist was restored", async (t) => {
  const h = await createHarness({ playlist: ["previous-a"], failAddStatusCount: 2 });
  t.after(h.cleanup);
  assert.equal(await prepare(h), 0);
  assert.equal(await apply(h), 1);
  assert.deepEqual(h.holyrics.state.playlist, []);
  const state = await readState(h.statePath);
  assert.equal(state.lastRun!.status, "FAILED");
  assert.equal(state.lastRun!.errorCode, "RESTORE_FAILED");
  assert.equal(state.lastRun!.restored, false);
  assert.match(h.io.stdoutText(), /não foi possível confirmar a restauração/);
  assert.match(h.io.stdoutText(), /Ajuda: configurar-holyrics/);
  assert.equal(h.videira.reports[0].status, "FAILED");
});

test("offline Holyrics is reported during ping before any playlist write", async (t) => {
  const h = await createHarness();
  t.after(h.cleanup);
  await h.holyrics.close();
  assert.equal(await prepare(h), 1);
  assert.equal(h.holyrics.state.writes.length, 0);
  assert.match(h.io.stderrText(), /HOLYRICS_NOT_RUNNING/);
  assert.match(h.io.stderrText(), /Ajuda: configurar-holyrics/);
});

test("failed report queues once; retry sends it once, then recovered apply is OK and idempotent", async (t) => {
  const h = await createHarness({ playlist: ["previous-a"], dropBeforeAddCount: 1 });
  t.after(h.cleanup);
  h.videira.reportStatus = 503;
  assert.equal(await prepare(h), 0);
  assert.equal(await apply(h), 1);
  let state = await readState(h.statePath);
  assert.equal(state.pendingReports.length, 1);
  assert.equal(state.pendingReports[0].report.status, "FAILED");
  assert.equal(h.videira.reports.length, 0);

  h.videira.reportStatus = 201;
  assert.equal(await prepare(h), 0); // Flushes the queued failure report once.
  state = await readState(h.statePath);
  assert.equal(state.pendingReports.length, 0);
  assert.deepEqual(h.videira.reports.map((report) => report.status), ["FAILED"]);
  assert.equal(await apply(h), 0);
  assert.deepEqual(h.holyrics.state.playlist, SONGS.map((song) => song.id));
  assert.deepEqual(h.videira.reports.map((report) => report.status), ["FAILED", "OK"]);

  const writesAfterSuccess = h.holyrics.state.writes.length;
  assert.equal(await prepare(h), 0);
  assert.equal(await apply(h), 0);
  assert.equal(h.holyrics.state.writes.length, writesAfterSuccess);
  assert.deepEqual(h.videira.reports.map((report) => report.status), ["FAILED", "OK", "OK"]);
  assert.equal((await readState(h.statePath)).pendingReports.length, 0);
});

test("editor 409 is not retried automatically and next call observes the two-second interval", async () => {
  const fake = await startFakeHolyricsProxy({ editorStatus: 409 });
  try {
    let clock = 1_000;
    const waits: number[] = [];
    const client = createHolyricsClient({
      baseUrl: fake.baseUrl,
      token: "fake-holyrics-token",
      now: () => clock,
      sleep: async (ms: number) => { waits.push(ms); clock += ms; },
    });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await assert.rejects(client.openSongEditor({ title: "Nova", artist: "Artista" }), (error: NodeJS.ErrnoException) => {
        assert.equal(error.code, "EDITOR_ALREADY_OPEN");
        assert.match(error.message, /já está aberto/);
        return true;
      });
      assert.equal(fake.state.calls.filter((call) => call.action === "popup-createsong").length, attempt + 1);
    }
    assert.deepEqual(waits, [2_000]);
    assert.equal(helpTopicForError("EDITOR_ALREADY_OPEN"), "musica-nao-esta-no-holyrics");
  } finally {
    await fake.close();
  }
});
