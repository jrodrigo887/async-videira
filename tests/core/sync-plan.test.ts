import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { planSync } from "../../src/domain/sync/sync-plan.ts";
import { executeSync } from "../../src/application/use-cases/execute-sync.ts";
import type { CatalogSong, SetlistItem } from "../../src/domain/types.ts";

interface Fixture {
  catalog: CatalogSong[];
  confirmedLinks: Array<{ songId: string; externalId: string }>;
  setlists: Array<{ items: SetlistItem[] }>;
}

const fixtureText = await readFile(new URL("../../fixtures/sync-core-cases.json", import.meta.url), "utf8");
const fixture: Fixture = JSON.parse(fixtureText.replace(/^\uFEFF/, ""));
const [ordered, repeated] = fixture.setlists as [{ items: SetlistItem[] }, { items: SetlistItem[] }];
const linkBySongId = new Map(fixture.confirmedLinks.map((link) => [link.songId, link.externalId]));
const withConfirmedLinks = (setlist: { items: SetlistItem[] }) => ({
  ...setlist,
  items: setlist.items.map((item) => ({ ...item, externalId: (item.songId && linkBySongId.get(item.songId)) || null })),
});
const linkedRepeated = withConfirmedLinks(repeated);

const plan = (setlist: { items: SetlistItem[] }, catalog: CatalogSong[] = fixture.catalog, currentIds: string[] = []) =>
  planSync({ items: setlist.items, catalog, currentIds });

test("prefers an explicit externalId even when title and artist disagree", () => {
  const result = planSync({
    items: [{ position: 0, title: "Unrelated title", artist: "Someone else", externalId: "1792693855267" } as SetlistItem],
    catalog: fixture.catalog,
  });
  assert.deepEqual(result.targetIds, [fixture.catalog[0].id]);
  assert.equal(result.itemResults[0].status, "resolved");
  assert.equal(result.itemResults[0].matchedBy, "externalId");
});

test("treats the broad SearchLyrics extra as a suggestion, not a match or ambiguity", () => {
  const result = plan(ordered);
  const ele = result.itemResults[2];
  assert.equal(ele.title, "É Ele");
  assert.equal(ele.status, "absent");
  assert.deepEqual(ele.suggestions, [{ id: "1792693855260", title: "E Ele", artist: "DROPS" }]);
  // “Vida Aos Sepulcros” came back from the broad search but fails the exact normalized title check.
  assert.deepEqual(result.targetIds, []);
});

test("reports ambiguity when multiple exact normalized title+artist candidates exist", () => {
  const duplicateCatalogEntry = { ...fixture.catalog[2], id: "fixture-holyrics-e-ele-copy", title: "É ELE" };
  const result = plan(ordered, [...fixture.catalog, duplicateCatalogEntry]);
  assert.equal(result.itemResults[2].status, "ambiguous");
  assert.deepEqual(result.itemResults[2].candidates, ["1792693855260", "fixture-holyrics-e-ele-copy"]);
});

test("reports absent when no exact title+artist match exists", () => {
  const result = plan(ordered, fixture.catalog.filter((entry) => entry.id !== "1792693855267"));
  assert.equal(result.itemResults[0].status, "absent");
});

test("a stale externalId offers an exact candidate for review without binding it", () => {
  const result = planSync({
    items: [{ ...ordered.items[0], externalId: "stale-explicit-id" }],
    catalog: fixture.catalog,
  });
  assert.equal(result.itemResults[0].status, "absent");
  assert.deepEqual(result.itemResults[0].suggestions, [{ id: "1792693855267", title: "Mil Graus", artist: "Renascer Praise" }]);
  assert.deepEqual(result.targetIds, []);
});

test("marks repeated songs in the dry-run and deduplicates before apply", () => {
  const result = plan(linkedRepeated);
  assert.deepEqual(result.itemResults.map((item) => item.status), ["resolved", "resolved", "repeated"]);
  assert.equal(result.hasRepeated, true);
  assert.deepEqual(result.targetIds, ["1792693855255", "1792693855260"]);
  assert.equal(result.mutates, true);
});

test("does not request another apply when current playlist equals the deduplicated target", () => {
  const result = plan(linkedRepeated, fixture.catalog, ["1792693855255", "1792693855260"]);
  assert.equal(result.mutates, false);
  assert.deepEqual(result.targetIds, ["1792693855255", "1792693855260"]);
});

test("requires post-apply reread and reports repeated items as duplicate", async () => {
  let playlist = ["old-song"];
  const calls: string[] = [];
  const adapter = {
    async getPlaylist() {
      calls.push("getPlaylist");
      return [...playlist];
    },
    async applyOrder(ids: string[]) {
      calls.push("applyOrder");
      playlist = [...new Set(ids)];
    },
  };

  const result = await executeSync({ items: linkedRepeated.items, catalog: fixture.catalog, adapter });
  assert.deepEqual(calls, ["getPlaylist", "applyOrder", "getPlaylist"]);
  assert.equal(result.status, "PARTIAL");
  assert.equal(result.verified, true);
  assert.deepEqual(result.actualIds, ["1792693855255", "1792693855260"]);
  assert.deepEqual(result.reportItems.map((item) => item.outcome), ["added", "added", "duplicate"]);
});

test("never reports OK if the required post-apply reread differs from the deduplicated target", async () => {
  let reads = 0;
  let writes = 0;
  const adapter = {
    async getPlaylist() {
      reads += 1;
      return reads === 1 ? ["old-song"] : ["wrong-song"];
    },
    async applyOrder() { writes += 1; },
  };
  const result = await executeSync({ items: linkedRepeated.items, catalog: fixture.catalog, adapter });
  assert.equal(writes, 1);
  assert.equal(reads, 2);
  assert.equal(result.status, "FAILED");
  assert.equal(result.verified, false);
  assert.deepEqual(result.reportItems.map((item) => item.outcome), ["failed", "failed", "duplicate"]);
});

test("repeated execution is idempotent against the deduplicated playlist", async () => {
  let playlist = ["old-song"];
  let writes = 0;
  const adapter = {
    async getPlaylist() { return [...playlist]; },
    async applyOrder(ids: string[]) { writes += 1; playlist = [...new Set(ids)]; },
  };

  const first = await executeSync({ items: linkedRepeated.items, catalog: fixture.catalog, adapter });
  const second = await executeSync({ items: linkedRepeated.items, catalog: fixture.catalog, adapter });
  assert.equal(first.applied, true);
  assert.equal(first.verified, true);
  assert.equal(second.applied, false);
  assert.equal(second.status, "PARTIAL");
  assert.deepEqual(second.reportItems.map((item) => item.outcome), ["unchanged", "unchanged", "duplicate"]);
  assert.equal(writes, 1);
});

test("a Videira link pointing at an ID missing from the library is flagged stale and only suggests, never binds", () => {
  const plan = planSync({
    items: [{ position: 1, songId: "v1", title: "Santo", artist: "Fernandinho", externalId: "old-id" }],
    catalog: [{ id: "new-id", title: "Santo", artist: "Fernandinho" }],
  });
  const [item] = plan.itemResults;
  assert.equal(item.staleExternalId, "old-id");
  assert.equal(item.status, "absent");
  assert.deepEqual(item.suggestions!.map((song) => song.id), ["new-id"]);
  assert.deepEqual(plan.targetIds, []);
});
