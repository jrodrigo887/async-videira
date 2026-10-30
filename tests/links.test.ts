import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { awaitMissingCreated, confirmSongLinks, openMissingEditor, removeSongLink } from "../src/links.ts";
import { createEmptyState, readState, writeState } from "../src/state/store.ts";

const env = { VIDEIRA_TOKEN: "videira-token", HOLYRICS_TOKEN: "holyrics-token", HOLYRICS_URL: "http://127.0.0.1:8091", VIDEIRA_API_BASE: "https://videira.test" };
const plan = {
  itemResults: [
    { position: 1, songId: "v1", title: "É Ele", artist: "DROPS", status: "absent", suggestions: [{ id: "h9", title: "É Ele", artist: "DROPS" }] },
    { position: 2, songId: "v2", title: "Santo", artist: "Fernandinho", status: "ambiguous", candidates: ["h2", "h3"] },
    { position: 3, songId: "v3", title: "Nova", artist: "Banda", status: "absent", candidates: undefined },
    { position: 4, songId: "v4", title: "Linked", artist: "X", status: "resolved", holyricsId: "h5", matchedBy: "externalId" },
    { position: 5, songId: "v5", title: "Old", artist: "Y", status: "absent", suggestions: [{ id: "h8", title: "Old", artist: "Y" }], staleExternalId: "h-old" },
    { position: 6, songId: "v6", title: "Exact", artist: "Z", status: "resolved", holyricsId: "h6", matchedBy: "title" },
  ],
  targetIds: [],
} as never;

type LyricsReply = (songId: string) => Response;
const okLyrics: LyricsReply = (songId) => new Response(JSON.stringify({ songId, title: "Nova", artist: "Banda", lyrics: "Primeira linha\nSegunda linha\n\nCoro" }), { status: 200, headers: { "Content-Type": "application/json" } });

async function setup(catalogs = [[{ id: "h9", title: "É Ele", artist: "DROPS" }, { id: "h2", title: "Santo", artist: "Fernandinho" }, { id: "h3", title: "Santo", artist: "Outro" }]], lyricsReply: LyricsReply = okLyrics) {
  const dir = await mkdtemp(join(tmpdir(), "av-links-"));
  const statePath = join(dir, "state.json");
  await writeState(statePath, { ...createEmptyState(), prepared: { setlistId: "s1", plan } as never });
  const calls = { batches: [] as Array<Array<{ externalId: string }>>, editor: 0, removed: [] as string[], lyricsRequests: [] as string[], editorBodies: [] as Array<{ title: string; artist: string; lyrics: string }> };
  let read = 0;
  const fetchImpl = async (url: string | URL | Request, init: RequestInit = {}) => {
    const u = new URL(url as string);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    if (u.hostname === "videira.test" && init.method === "DELETE") {
      calls.removed.push(u.pathname);
      return u.pathname.endsWith("/gone") ? json({ error: { code: "LINK_NOT_FOUND" } }, 404) : new Response(null, { status: 204 });
    }
    if (u.hostname === "videira.test" && u.pathname.endsWith("/lyrics")) {
      calls.lyricsRequests.push(u.pathname);
      return lyricsReply(u.pathname.split("/").at(-2)!);
    }
    if (u.hostname === "videira.test") {
      const body = JSON.parse(init.body as string) as { items: Array<{ songId: string; externalId: string }> };
      calls.batches.push(body.items);
      return json({ results: body.items.map((item, index: number) => ({ index, songId: item.songId, externalId: item.externalId, outcome: "created" })) });
    }
    if (u.pathname === "/api/GetSongs") return json({ status: "ok", data: catalogs[Math.min(read++, catalogs.length - 1)] });
    if (u.pathname === "/api/popup-createsong") { calls.editor += 1; calls.editorBodies.push(JSON.parse(init.body as string)); return json({ status: "ok" }); }
    return json({ status: "ok", data: null });
  };
  return { dir, statePath, fetchImpl, calls };
}

test("confirmSongLinks sends only offered pairs with title/artist taken from the Holyrics catalog", async () => {
  const t = await setup();
  try {
    const { outcomes } = await confirmSongLinks({ env, fetchImpl: t.fetchImpl, statePath: t.statePath, confirmations: [
      { videiraSongId: "v1", holyricsSongId: "h9" },
      { videiraSongId: "v2", holyricsSongId: "h3" },
      { videiraSongId: "v1", holyricsSongId: "h2" },
      { videiraSongId: "v2", holyricsSongId: "unknown" },
      { videiraSongId: "nope", holyricsSongId: "h9" },
    ] });
    assert.deepEqual(t.calls.batches[0], [
      { songId: "v1", externalId: "h9", externalTitle: "É Ele", externalArtist: "DROPS" },
      { songId: "v2", externalId: "h3", externalTitle: "Santo", externalArtist: "Outro" },
    ]);
    assert.deepEqual(outcomes.map((o) => o.outcome).sort(), ["created", "created", "rejected", "rejected", "rejected"]);
    assert.equal((await readState(t.statePath)).prepared, null, "stored plan is stale after linking");
  } finally { await rm(t.dir, { recursive: true, force: true }); }
});

test("confirmSongLinks does not call Videira when nothing was offered", async () => {
  const t = await setup();
  try {
    const { outcomes } = await confirmSongLinks({ env, fetchImpl: t.fetchImpl, statePath: t.statePath, confirmations: [{ videiraSongId: "v3", holyricsSongId: "h9" }] });
    assert.equal(t.calls.batches.length, 0);
    assert.equal(outcomes[0].outcome, "rejected");
    assert.ok((await readState(t.statePath)).prepared);
  } finally { await rm(t.dir, { recursive: true, force: true }); }
});

test("confirmSongLinks requires a current preparation", async () => {
  const t = await setup();
  try {
    await writeState(t.statePath, createEmptyState());
    await assert.rejects(confirmSongLinks({ env, fetchImpl: t.fetchImpl, statePath: t.statePath, confirmations: [{ videiraSongId: "v1", holyricsSongId: "h9" }] }), { code: "PREPARATION_EXPIRED" });
  } finally { await rm(t.dir, { recursive: true, force: true }); }
});

test("a song created in the Holyrics editor becomes an offered candidate, not an automatic link", async () => {
  const before = [{ id: "h9", title: "É Ele", artist: "DROPS" }];
  const t = await setup([before, [...before, { id: "h77", title: "Nova", artist: "Banda" }], [...before, { id: "h77", title: "Nova", artist: "Banda" }]]);
  const session = { editor: null, created: new Map() };
  try {
    await openMissingEditor({ env, fetchImpl: t.fetchImpl, statePath: t.statePath, videiraSongId: "v3", session });
    assert.equal(t.calls.editor, 1);
    const found = await awaitMissingCreated({ env, fetchImpl: t.fetchImpl, session });
    assert.equal(found.state, "created");
    assert.equal(t.calls.batches.length, 0);
    const { outcomes } = await confirmSongLinks({ env, fetchImpl: t.fetchImpl, statePath: t.statePath, created: session.created, confirmations: [{ videiraSongId: "v3", holyricsSongId: "h77" }] });
    assert.equal(outcomes[0].outcome, "created");
    assert.equal(t.calls.batches[0][0].externalId, "h77");
  } finally { await rm(t.dir, { recursive: true, force: true }); }
});

test("opening the editor prefills it with the full lyrics from Videira", async () => {
  const t = await setup();
  try {
    const opened = await openMissingEditor({ env, fetchImpl: t.fetchImpl, statePath: t.statePath, videiraSongId: "v3", session: { editor: null, created: new Map() } });
    assert.deepEqual(opened, { opened: true, lyricsFilled: true });
    assert.deepEqual(t.calls.lyricsRequests, ["/api/integrations/holyrics/songs/v3/lyrics"]);
    assert.equal(t.calls.editorBodies[0]!.lyrics, "Primeira linha\nSegunda linha\n\nCoro");
  } finally { await rm(t.dir, { recursive: true, force: true }); }
});

for (const [name, reply] of [
  ["Videira has no lyrics for the song", () => new Response(JSON.stringify({ error: { code: "LYRICS_NOT_FOUND" } }), { status: 404 })],
  ["Videira is down", () => new Response("boom", { status: 500 })],
  ["Videira answers garbage", () => new Response(JSON.stringify({ lyrics: 42 }), { status: 200 })],
] as Array<[string, LyricsReply]>) {
  test(`the editor still opens with the placeholder when ${name}`, async () => {
    const t = await setup(undefined, reply);
    try {
      const opened = await openMissingEditor({ env, fetchImpl: t.fetchImpl, statePath: t.statePath, videiraSongId: "v3", session: { editor: null, created: new Map() } });
      assert.deepEqual(opened, { opened: true, lyricsFilled: false });
      assert.equal(t.calls.editorBodies[0]!.lyrics, "[Letra não fornecida]");
    } finally { await rm(t.dir, { recursive: true, force: true }); }
  });
}

test("lyrics are requested only when the editor opens, never while removing or confirming links", async () => {
  const confirming = await setup();
  const removing = await setup();
  try {
    await confirmSongLinks({ env, fetchImpl: confirming.fetchImpl, statePath: confirming.statePath, confirmations: [{ videiraSongId: "v1", holyricsSongId: "h9" }] });
    await removeSongLink({ env, fetchImpl: removing.fetchImpl, statePath: removing.statePath, videiraSongId: "v4" });
    assert.deepEqual([...confirming.calls.lyricsRequests, ...removing.calls.lyricsRequests], []);
  } finally {
    await rm(confirming.dir, { recursive: true, force: true });
    await rm(removing.dir, { recursive: true, force: true });
  }
});

test("removeSongLink deletes only links of the current preparation and keeps an unlinked history entry", async () => {
  const t = await setup();
  try {
    assert.deepEqual(await removeSongLink({ env, fetchImpl: t.fetchImpl, statePath: t.statePath, videiraSongId: "v4" }), { removed: true });
    assert.deepEqual(t.calls.removed, ["/api/integrations/holyrics/song-links/v4"]);
    const state = await readState(t.statePath);
    assert.equal(state.prepared, null);
    assert.deepEqual(state.migration.history.map(({ songId, oldExternalId, newExternalId, action }) => ({ songId, oldExternalId, newExternalId, action })), [{ songId: "v4", oldExternalId: "h5", newExternalId: null, action: "unlinked" }]);
  } finally { await rm(t.dir, { recursive: true, force: true }); }
});

test("removeSongLink refuses songs without a link or outside the preparation", async () => {
  const t = await setup();
  try {
    await assert.rejects(removeSongLink({ env, fetchImpl: t.fetchImpl, statePath: t.statePath, videiraSongId: "v6" }), { code: "INVALID_REQUEST" });
    await assert.rejects(removeSongLink({ env, fetchImpl: t.fetchImpl, statePath: t.statePath, videiraSongId: "zzz" }), { code: "PREPARATION_EXPIRED" });
    assert.equal(t.calls.removed.length, 0);
  } finally { await rm(t.dir, { recursive: true, force: true }); }
});

test("relinking a song whose old Holyrics ID vanished records old → new history without deleting anything", async () => {
  const t = await setup([[{ id: "h8", title: "Old", artist: "Y" }]]);
  try {
    const { outcomes } = await confirmSongLinks({ env, fetchImpl: t.fetchImpl, statePath: t.statePath, confirmations: [{ videiraSongId: "v5", holyricsSongId: "h8" }] });
    assert.equal(outcomes[0].outcome, "created");
    assert.equal(t.calls.removed.length, 0);
    const [entry] = (await readState(t.statePath)).migration.history;
    assert.deepEqual({ songId: entry.songId, oldExternalId: entry.oldExternalId, newExternalId: entry.newExternalId, action: entry.action }, { songId: "v5", oldExternalId: "h-old", newExternalId: "h8", action: "relinked" });
  } finally { await rm(t.dir, { recursive: true, force: true }); }
});
