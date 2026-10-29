import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  HelpContentError,
  appDiagnosticInfo,
  buildHelpIndex,
  getHelpTopic,
  helpTopicForError,
  listHelpTopics,
  loadHelpTopics,
  searchHelp,
} from "../src/core/help/index.mjs";

const fixtures = (name) => fileURLToPath(new URL(`./fixtures/help/${name}`, import.meta.url));

test("loader accepts valid help articles and validates links and related topics", async () => {
  const topics = await loadHelpTopics({ directory: fixtures("valid") });
  assert.equal(topics.length, 5);
  assert.ok(topics.every(({ corpo }) => typeof corpo === "string"));
  const index = buildHelpIndex(topics);
  assert.equal(index.schemaVersion, 1);
  assert.equal(index.topics.find((topic) => topic.id === "musica-nao-esta-no-holyrics").search.titulo, "musica ausente no holyrics");
});

test("front matter requires fields, valid audience, slug ID, and list metadata", async () => {
  await assert.rejects(loadHelpTopics({ directory: fixtures("invalid-frontmatter") }), (error) => {
    assert.ok(error instanceof HelpContentError);
    assert.match(error.message, /id must be a lowercase slug/);
    assert.match(error.message, /titulo must not be empty/);
    assert.match(error.message, /publico must be 'operador' or 'tecnico'/);
    assert.match(error.message, /palavras-chave must be a YAML-style list/);
    assert.match(error.message, /missing required field 'relacionados'/);
    return true;
  });
});

test("loader rejects duplicate topic IDs", async () => {
  await assert.rejects(loadHelpTopics({ directory: fixtures("duplicate-ids") }), /duplicate topic id 'mesmo-id'/);
});

test("loader rejects broken related and internal links", async () => {
  await assert.rejects(loadHelpTopics({ directory: fixtures("broken-link") }), (error) => {
    assert.match(error.message, /related topic 'nao-existe' does not exist/);
    assert.match(error.message, /internal link target 'nao-existe' does not exist/);
    return true;
  });
});

test("loader rejects script, iframe, event handler, and javascript URL markdown", async () => {
  await assert.rejects(loadHelpTopics({ directory: fixtures("xss") }), (error) => {
    assert.match(error.message, /forbidden script\/iframe tag/);
    assert.match(error.message, /forbidden inline event handler/);
    assert.match(error.message, /forbidden javascript: URL/);
    return true;
  });
});

test("build script exits with a clear validation list", async (t) => {
  const outputDir = await mkdtemp(join(tmpdir(), "help-index-test-"));
  t.after(() => rm(outputDir, { recursive: true, force: true }));
  const outputPath = join(outputDir, "index.json");
  const scriptPath = fileURLToPath(new URL("../scripts/build-help-index.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [scriptPath, "--source-dir", fixtures("invalid-frontmatter"), "--output", outputPath], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Help index validation failed/);
  assert.match(result.stderr, /id must be a lowercase slug/);
  assert.match(result.stderr, /publico must be 'operador' or 'tecnico'/);
});

test("search normalizes Portuguese accents and ranks title before keywords and body", async () => {
  const topics = await loadHelpTopics({ directory: fixtures("valid") });
  const results = await searchHelp("musica", {}, topics);
  assert.equal(results[0].topicId, "musica-ambigua-e-vinculos");
  assert.equal(results[0].rank, 3);
  assert.ok(results.some((item) => item.topicId === "musica-nao-esta-no-holyrics" && item.rank === 3));
  assert.ok(results.every((item) => item.excerpt.length > 0));
  assert.deepEqual(await listHelpTopics({ publico: "tecnico" }, topics).then((items) => items.map((item) => item.id)), ["trocar-de-computador"]);
  assert.equal((await getHelpTopic("configurar-holyrics", topics)).title, "Configurar Holyrics");
});

test("error topic map provides planned help links and returns null for unmapped errors", () => {
  assert.equal(helpTopicForError("HOLYRICS_UNREACHABLE"), "configurar-holyrics");
  assert.equal(helpTopicForError("HOLYRICS_NOT_RUNNING"), "configurar-holyrics");
  assert.equal(helpTopicForError("AUTH_REJECTED"), "configurar-holyrics");
  assert.equal(helpTopicForError("EDITOR_ALREADY_OPEN"), "musica-nao-esta-no-holyrics");
  assert.equal(helpTopicForError("DESTINATION_TEMPORARY"), "destino-playlist-temporaria");
  assert.equal(helpTopicForError("CATALOG_CHANGED"), "trocar-de-computador");
  assert.equal(helpTopicForError("LIBRARY_CHANGED"), "trocar-de-computador");
  assert.equal(helpTopicForError("SONG_AMBIGUOUS"), "musica-ambigua-e-vinculos");
  assert.equal(helpTopicForError("unknown"), null);
});

test("diagnostic information includes useful versions/counts but excludes credentials and personal paths", () => {
  const configuredSecrets = ["videira-secret-token", "holyrics-secret-token"];
  const info = appDiagnosticInfo({
    appVersion: "0.1.0",
    build: "2026.10.29",
    os: { platform: "win32", release: "10.0", arch: "x64", hostname: "PERSONAL-PC", homedir: "C:\\Users\\Private" },
    holyrics: {
      connected: true,
      configured: true,
      version: "2.30.0",
      plan: "none",
      token: configuredSecrets[0],
      baseDir: "C:\\Users\\Private\\Holyrics",
    },
    videira: { configured: true, connected: false, token: configuredSecrets[0] },
    counts: { helpTopics: 5, operatorTopics: 4, technicalTopics: 1, holyricsSongs: 29, setlistSongs: 3, token: configuredSecrets[1] },
    recentErrors: [{ code: "HOLYRICS_UNREACHABLE", correlationId: "c-123", message: configuredSecrets[1] }],
  });
  const serialized = JSON.stringify(info);
  for (const secret of configuredSecrets) assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes("C:\\Users\\Private"), false);
  assert.equal(serialized.includes("PERSONAL-PC"), false);
  assert.deepEqual(info, {
    appVersion: "0.1.0",
    build: "2026.10.29",
    os: { platform: "win32", release: "10.0", arch: "x64" },
    configuration: { videiraConfigured: true, holyricsConfigured: true },
    connections: { videira: false, holyrics: true },
    holyrics: { connected: true, version: "2.30.0", plan: "none" },
    counts: { helpTopics: 5, operatorTopics: 4, technicalTopics: 1, holyricsSongs: 29, setlistSongs: 3 },
    recentErrors: [{ code: "HOLYRICS_UNREACHABLE", correlationId: "c-123" }],
  });
});
