import assert from "node:assert/strict";
import test from "node:test";
import { SYSTEM_SONG_ID, projectCatalog, toCatalog } from "../src/domain/catalog/holyrics-catalog.ts";
import { createLibraryFingerprint, libraryMoved } from "../src/domain/library/fingerprint.ts";
import { findPlanItem, matchSong, offeredIds } from "../src/domain/linking/song-matcher.ts";
import { idsOf, sameSequence, uniqueIds } from "../src/domain/shared/ids.ts";
import type { SyncPlan } from "../src/domain/types.ts";
import { normalizeText } from "../src/domain/shared/text.ts";

test("normalizeText ignora diacríticos, caixa e espaços, mas preserva pontuação", () => {
  assert.equal(normalizeText("  É  Ele  "), "e ele");
  assert.equal(normalizeText("Ele (Ao Vivo)"), "ele (ao vivo)");
  assert.equal(normalizeText(null), "");
});

test("ids: aceita itens soltos ou objetos, deduplica preservando a primeira ocorrência", () => {
  assert.deepEqual(idsOf([{ id: 1 }, "2", 3]), ["1", "2", "3"]);
  assert.deepEqual(uniqueIds(["1", 2, "1"]), ["1", "2"]);
  assert.equal(sameSequence(["1", "2"], ["1", "2"]), true);
  assert.equal(sameSequence(["1", "2"], ["2", "1"]), false);
});

test("catálogo descarta o item de sistema e ordena por id na projeção", () => {
  const raw = [{ id: 20, title: "B" }, { id: SYSTEM_SONG_ID, title: "Holyrics" }, { id: 10, title: "A", artist: "X" }];
  assert.deepEqual(toCatalog(raw).map((song) => song.id), ["20", "10"]);
  assert.deepEqual(projectCatalog(raw), [{ id: "10", title: "A", artist: "X" }, { id: "20", title: "B", artist: "" }]);
});

test("matchSong: externalId presente resolve; ausente vira stale e só sugere por título+artista exatos", () => {
  const catalog = [{ id: "7", title: "É Ele", artist: "Banda" }];
  assert.deepEqual(matchSong({ externalId: "7", title: "x", artist: "y" }, catalog), { kind: "resolved", id: "7", via: "externalId" });
  const stale = matchSong({ externalId: "99", title: "e ele", artist: "BANDA" }, catalog);
  assert.equal(stale.kind, "suggested");
  assert.equal(stale.kind === "suggested" && stale.stale, "99");
  assert.equal(matchSong({ title: "É Ele", artist: "Outra" } as never, catalog).kind, "absent");
});

test("offeredIds e findPlanItem só reconhecem o que a preparação ofereceu", () => {
  const plan = { itemResults: [{ songId: "s1", suggestions: [{ id: 5 }], candidates: ["6", { id: 7 }] }] } as unknown as SyncPlan;
  assert.equal(findPlanItem(plan, "s1")!.songId, "s1");
  assert.equal(findPlanItem(plan, "zz"), undefined);
  assert.deepEqual([...offeredIds(plan.itemResults[0]!, new Set(["8"]))].sort(), ["5", "6", "8"]);
});

test("fingerprint usa o hash injetado e libraryMoved só considera pasta/plataforma", () => {
  const ping = { version: { baseDir: "C:/H", platform: "win", ip_list: ["b", "a"] } };
  const fp = createLibraryFingerprint(ping, [{ id: "2" }, { id: "1" }] as never, (value) => (value as string[]).join(","));
  assert.deepEqual(fp, { baseDir: "C:/H", platform: "win", ip_list: ["a", "b"], idsHash: "1,2" });
  assert.equal(libraryMoved(null, fp), false);
  assert.equal(libraryMoved(fp, { ...fp, idsHash: "x" }), false);
  assert.equal(libraryMoved(fp, { ...fp, platform: "mac" }), true);
});
