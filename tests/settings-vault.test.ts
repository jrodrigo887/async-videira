import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSettingsRepository } from "../src/adapters/settings-file/settings-repository.ts";
import { createVault } from "../src/adapters/vault-electron/vault.ts";
import { validateExternalUrl, validateHolyricsUrl, validateVideiraUrl } from "../src/domain/settings/endpoints.ts";

const fakeStorage = (available = true) => ({
  isAsyncEncryptionAvailable: async () => available,
  encryptStringAsync: async (text: string) => Buffer.from(`enc:${text}`),
  decryptStringAsync: async (buffer: Buffer) => ({ result: buffer.toString().slice(4), shouldReEncrypt: false }),
});

test("endereços: Holyrics só em loopback/http; Videira só https nos hosts oficiais; smoke libera http local", () => {
  validateHolyricsUrl("http://127.0.0.1:8091");
  validateHolyricsUrl("http://localhost:8091");
  for (const bad of ["https://127.0.0.1:8091", "http://192.168.0.2:8091", "http://user:pw@127.0.0.1:8091", "não é url"]) {
    assert.throws(() => validateHolyricsUrl(bad), { code: "INVALID_HOLYRICS_URL" }, bad);
  }
  validateVideiraUrl("https://videiramusic.org");
  for (const bad of ["http://videiramusic.org", "https://outro.org", "https://u:p@videiramusic.org", "http://127.0.0.1:9"]) {
    assert.throws(() => validateVideiraUrl(bad), { code: "INVALID_VIDEIRA_URL" }, bad);
  }
  validateVideiraUrl("http://127.0.0.1:9", { allowLoopbackHttp: true });
  assert.equal(validateExternalUrl("https://www.videiramusic.org/x"), "https://www.videiramusic.org/x");
  assert.throws(() => validateExternalUrl("javascript:alert(1)"), { code: "EXTERNAL_LINK_BLOCKED" });
});

test("configurações: padrão sem arquivo, mescla o que existe e grava legível", async () => {
  const dir = await mkdtemp(join(tmpdir(), "av-settings-"));
  try {
    const path = join(dir, "sub", "settings.json");
    const repo = createSettingsRepository({ path });
    assert.equal((await repo.read()).holyricsUrl, "http://127.0.0.1:8091");
    await repo.write({ holyricsUrl: "http://localhost:9", videiraApiBase: "https://videiramusic.org", firstRunDone: true });
    assert.equal((await repo.read()).holyricsUrl, "http://localhost:9");
    await writeFile(path, "{quebrado");
    assert.equal((await repo.read()).firstRunDone, false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("cofre: cifra em disco, lê de volta e falha com VAULT_UNAVAILABLE sem criptografia", async () => {
  const dir = await mkdtemp(join(tmpdir(), "av-vault-"));
  try {
    const path = join(dir, "credentials.bin");
    const vault = createVault({ path, safeStorage: fakeStorage() });
    assert.deepEqual(await vault.read(), {});
    await vault.write({ holyrics: "token-holyrics" });
    assert.deepEqual(await vault.read(), { holyrics: "token-holyrics" });
    assert.match((await readFile(path)).toString(), /^enc:/);

    const unavailable = createVault({ path: join(dir, "x.bin"), safeStorage: fakeStorage(false) });
    assert.deepEqual(await unavailable.read(), {});
    await assert.rejects(unavailable.write({ holyrics: "t" }), { code: "VAULT_UNAVAILABLE" });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
