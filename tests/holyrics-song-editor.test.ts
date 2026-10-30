import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { RequestListener, ServerResponse } from "node:http";
import test from "node:test";
import { createHolyricsClient, NO_LYRICS_PLACEHOLDER } from "../src/adapters/holyrics-api/client.ts";
import type { HolyricsApiError } from "../src/adapters/holyrics-api/client.ts";
import { close, listen, sendJson } from "./helpers/http.ts";

async function withServer(handler: RequestListener, run: (baseUrl: string) => Promise<void>) {
  const server = createServer(handler);
  const baseUrl = await listen(server);
  try {
    await run(baseUrl);
  } finally {
    await close(server);
  }
}

const response = (res: ServerResponse, status: number, data: unknown = { status: "ok" }) => sendJson(res, status, data);

test("openSongEditor posts without token and supplies the documented no-lyrics placeholder", async () => {
  let requestInfo: { url?: string; body: unknown } | undefined;
  await withServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    requestInfo = { url: req.url, body: JSON.parse(body) };
    response(res, 200);
  }, async (baseUrl) => {
    const client = createHolyricsClient({ baseUrl, token: "never-send-this", sleep: async () => {} });
    assert.deepEqual(await client.openSongEditor({ title: "Canção Nova", artist: "Artista" }), { opened: true });
  });
  assert.equal(requestInfo?.url, "/api/popup-createsong");
  assert.deepEqual(requestInfo?.body, { title: "Canção Nova", artist: "Artista", lyrics: NO_LYRICS_PLACEHOLDER });
});

for (const [status, code] of [[400, "EDITOR_FAILED"], [409, "EDITOR_ALREADY_OPEN"], [403, "EDITOR_FAILED"], [404, "EDITOR_UNSUPPORTED"]] as Array<[number, string]>) {
  test(`openSongEditor maps HTTP ${status} to ${code}`, async () => {
    await withServer((_req, res) => response(res, status, { status: "error" }), async (baseUrl) => {
      const client = createHolyricsClient({ baseUrl, token: "fake", sleep: async () => {} });
      await assert.rejects(client.openSongEditor({ title: "Test", artist: "Artist" }), (error: HolyricsApiError) => {
        assert.equal(error.code, code);
        assert.ok(error.message);
        return true;
      });
    });
  });
}

test("openSongEditor maps network failure to a retryable editor error", async () => {
  const client = createHolyricsClient({ token: "fake", fetchImpl: async () => { throw new Error("offline"); }, sleep: async () => {} });
  await assert.rejects(client.openSongEditor({ title: "Test", artist: "Artist" }), (error: HolyricsApiError) => {
    assert.equal(error.code, "EDITOR_FAILED");
    assert.equal(error.retryable, true);
    return true;
  });
});

test("openSongEditor waits so calls are at least two seconds apart", async () => {
  let clock = 10_000;
  const callTimes: number[] = [];
  const waits: number[] = [];
  const client = createHolyricsClient({
    baseUrl: "http://127.0.0.1:8091",
    token: "fake",
    now: () => clock,
    sleep: async (ms: number) => { waits.push(ms); clock += ms; },
    fetchImpl: async () => {
      callTimes.push(clock);
      return new Response(JSON.stringify({ status: "ok" }));
    },
  });
  await client.openSongEditor({ title: "One", artist: "Artist" });
  await client.openSongEditor({ title: "Two", artist: "Artist" });
  assert.deepEqual(waits, [2_000]);
  assert.ok(callTimes[1]! - callTimes[0]! >= 2_000);
});

test("awaitCreatedSong returns only a unique new exact title+artist match", async () => {
  const catalog = [
    { id: "old-1", title: "Canção Nova", artist: "Artista" },
    { id: "new-1", title: "Cancao Nova", artist: "ARTISTA" },
    { id: "broad-extra", title: "Canção Nova (Ao Vivo)", artist: "Artista" },
  ];
  const client = createHolyricsClient({
    token: "fake",
    fetchImpl: async (_url: unknown, options?: RequestInit) => {
      assert.equal(JSON.parse(options!.body as string).fields, "id,title,artist");
      return new Response(JSON.stringify({ status: "ok", data: catalog }));
    },
  });
  const result = await client.awaitCreatedSong([{ id: "old-1", title: "", artist: "" }], { title: "Canção Nova", artist: "Artista" });
  assert.deepEqual(result, { state: "created", song: catalog[1] });
});

test("awaitCreatedSong reports ambiguous when multiple new exact duplicates exist", async () => {
  const catalog = [
    { id: "new-1", title: "Canção Nova", artist: "Artista" },
    { id: "new-2", title: "Cancao Nova", artist: "ARTISTA" },
  ];
  const client = createHolyricsClient({ token: "fake", fetchImpl: async () => new Response(JSON.stringify({ status: "ok", data: catalog })) });
  const result = await client.awaitCreatedSong([], { title: "Canção Nova", artist: "Artista" });
  assert.equal(result.state, "ambiguous");
  assert.deepEqual(result.songs, catalog);
});

test("awaitCreatedSong reports not-found when no new exact pair exists", async () => {
  const catalog = [{ id: "old-1", title: "Canção Nova", artist: "Artista" }];
  const client = createHolyricsClient({ token: "fake", fetchImpl: async () => new Response(JSON.stringify({ status: "ok", data: catalog })) });
  const result = await client.awaitCreatedSong(catalog, { title: "Canção Nova", artist: "Artista" });
  assert.deepEqual(result, { state: "not-found", song: null });
});
