import assert from "node:assert/strict";
import type { DomainEvent } from "../src/domain/events.ts";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ERRORS, coded, errorCode, errorInfo, helpTopicForError } from "../src/domain/shared/errors.ts";
import { commands } from "../src/interface/electron/ipc/commands.ts";
import { toCoreError } from "../src/interface/electron/ipc/error-mapper.ts";
import { createIpcRouter } from "../src/interface/electron/ipc/router.ts";
import { createDesktopContainer } from "../src/composition/desktop-container.ts";
import { VideiraApiError } from "../src/adapters/videira/client.ts";
import { HolyricsApiError } from "../src/adapters/holyrics-api/client.ts";
import type { AuditEntry } from "../src/domain/audit/audit-entry.ts";
import type { CoreError, DesktopContext, IpcResponse } from "../src/interface/electron/ipc/types.ts";

// Resposta como os testes a leem: `data` varia por comando, então fica solta aqui (e só aqui).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Reply { requestId: string; ok: boolean; data?: any; error?: CoreError }
const replying = (router: { handle(envelope: unknown): Promise<IpcResponse> }) => ({
  handle: async (envelope: unknown) => (await router.handle(envelope)) as Reply,
});

test("catálogo: código desconhecido vira INTERNAL e só o catálogo define chave, retry e ajuda", () => {
  assert.equal(errorCode(coded("AUTH_REJECTED", "x")), "AUTH_REJECTED");
  assert.equal(errorCode(coded("HOLYRICS_REQUEST_FAILED", "x")), "INTERNAL");
  assert.equal(errorCode(new Error("HTTP 401")), "INTERNAL");
  assert.deepEqual(errorInfo("SERVICE_UNAVAILABLE"), { code: "SERVICE_UNAVAILABLE", messageKey: "service.unavailable", retryable: true, helpTopicId: null });
  assert.equal(errorInfo("AUTH_REQUIRED").messageKey, "credentials.required");
  assert.equal(helpTopicForError("HOLYRICS_NOT_RUNNING"), "configurar-holyrics");
  assert.equal(helpTopicForError("TIMEOUT"), null);
  assert.ok(Object.keys(ERRORS).length > 20);
});

test("o mapeador nunca expõe mensagem, stack nem detalhes do erro original", () => {
  const error = Object.assign(new Error("token abc123 vazou aqui"), { code: "AUTH_REJECTED", detail: "segredo" });
  const mapped = toCoreError(error);
  assert.deepEqual(Object.keys(mapped).sort(), ["code", "helpTopicId", "messageKey", "retryable"]);
  assert.doesNotMatch(JSON.stringify(mapped), /abc123|segredo/);
});

test("adaptadores classificam o erro na borda: 401 → AUTH_REJECTED, 5xx/sem resposta → SERVICE_UNAVAILABLE", () => {
  assert.equal(new VideiraApiError("x", { status: 401 }).code, "AUTH_REJECTED");
  assert.equal(new VideiraApiError("x", { status: 503 }).code, "SERVICE_UNAVAILABLE");
  assert.equal(new VideiraApiError("x", { unreachable: true }).code, "SERVICE_UNAVAILABLE");
  assert.equal(new VideiraApiError("x", { status: 404 }).code, undefined);
  assert.equal(new HolyricsApiError("x", { code: "AUTH_REJECTED" }).code, "AUTH_REJECTED");
});

function makeRouter(handlerOverrides: Record<string, unknown> = {}) {
  const calls: DomainEvent[] = [];
  const ctx = { events: { publish: async (event: DomainEvent) => { calls.push(event); } }, ...handlerOverrides } as unknown as DesktopContext;
  const failures: Array<[string, string | undefined]> = [];
  const router = replying(createIpcRouter({ commands, ctx, onFailure: (error, name) => failures.push([name, (error as { code?: string }).code]) }));
  return { router, calls, failures };
}

test("router: comando fora do manifesto é recusado; envelope malformado lança", async () => {
  const { router } = makeRouter();
  const unknown = await router.handle({ requestId: "1", command: "fs.readFile", payload: { path: "C:/x" } });
  assert.deepEqual(unknown, { requestId: "1", ok: false, error: { code: "INVALID_REQUEST", messageKey: "operation.failed", retryable: false } });
  await assert.rejects(router.handle({ command: "settings.get" }), /inválida/);
  await assert.rejects(router.handle(null), /inválida/);
});

test("router: payload que não é objeto ou é grande demais é recusado antes do handler", async () => {
  const { router } = makeRouter({ getSettings: async () => { throw new Error("não deveria chamar"); } });
  assert.equal((await router.handle({ requestId: "a", command: "settings.get", payload: [] })).error?.code, "INVALID_REQUEST");
  assert.equal((await router.handle({ requestId: "b", command: "settings.get", payload: { x: "y".repeat(1024 * 1024 + 1) } })).error?.code, "INVALID_REQUEST");
});

test("router: sucesso devolve data; falha vira CoreError tipado e publica OperationFailed", async () => {
  const { router, calls, failures } = makeRouter({
    getSettings: async () => ({ holyricsUrl: "http://127.0.0.1:8091" }),
    checkConnection: async () => { throw coded("AUTH_REJECTED", "HTTP 401 com token"); },
  });
  assert.deepEqual(await router.handle({ requestId: "1", command: "settings.get" }), { requestId: "1", ok: true, data: { holyricsUrl: "http://127.0.0.1:8091" } });

  const failed = await router.handle({ requestId: "2", command: "connection.check", payload: { target: "videira" } });
  assert.equal(failed.ok, false);
  assert.deepEqual(failed.error, { code: "AUTH_REJECTED", messageKey: "credentials.rejected", retryable: false, helpTopicId: "configurar-holyrics" });
  assert.deepEqual(calls.at(-1), { type: "OperationFailed", operation: "connection", target: "videira", code: "AUTH_REJECTED" });
  assert.deepEqual(failures, [["connection.check", "AUTH_REJECTED"]]);
});

test("manifesto: valida entrada de cada comando (alvo, ids, link, tópico)", async () => {
  const { router } = makeRouter({ openExternalLink: async () => ({ opened: true }) });
  const code = async (command: string, payload: unknown) => (await router.handle({ requestId: "1", command, payload })).error?.code;
  assert.equal(await code("connection.check", { target: "outro" }), "INVALID_REQUEST");
  assert.equal(await code("songLinks.remove", { videiraSongId: "" }), "INVALID_REQUEST");
  assert.equal(await code("songLinks.remove", { videiraSongId: "x".repeat(65) }), "INVALID_REQUEST");
  assert.equal(await code("songLinks.confirmBatch", { confirmations: "nope" }), "INVALID_REQUEST");
  assert.equal(await code("songLinks.confirmBatch", { confirmations: [{ videiraSongId: "v" }] }), "INVALID_REQUEST");
  assert.equal(await code("help.get", {}), "INVALID_REQUEST");
  assert.equal(await code("externalLink.open", {}), "INVALID_REQUEST");
});

test("manifesto: nomes únicos e os comandos que a UI usa existem", () => {
  const names = commands.map((command) => command.name);
  assert.equal(new Set(names).size, names.length);
  for (const needed of ["settings.get", "settings.update", "service.credentials.set", "service.credentials.status", "connection.check", "worship.prepare", "worship.apply", "songLinks.confirmBatch", "songLinks.remove", "song.openEditor", "song.awaitCreated", "help.list", "help.get", "help.search", "logs.list", "externalLink.open"]) {
    assert.ok(names.includes(needed), needed);
  }
});

test("contêiner desktop de ponta a ponta: configurações, credenciais, ajuda, links externos e log (sem Electron)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "av-desktop-"));
  try {
    const opened: string[] = [];
    const safeStorage = {
      isAsyncEncryptionAvailable: async () => true,
      encryptStringAsync: async (text: string) => Buffer.from(`enc:${text}`),
      decryptStringAsync: async (buffer: Buffer) => ({ result: buffer.toString().slice(4), shouldReEncrypt: false }),
    };
    const desktop = createDesktopContainer({ userData: dir, logDir: join(dir, "logs"), safeStorage, openExternal: async (url) => { opened.push(url); } });
    const router = replying(createIpcRouter({ commands, ctx: desktop }));
    const call = (command: string, payload: Record<string, unknown> = {}) => router.handle({ requestId: "r", command, payload });

    assert.equal((await call("settings.get")).data.holyricsUrl, "http://127.0.0.1:8091");
    assert.equal((await call("settings.update", { holyricsUrl: "http://192.168.0.5:8091" })).error?.code, "INVALID_HOLYRICS_URL");
    assert.equal((await call("settings.update", { videiraApiBase: "https://evil.example" })).error?.code, "INVALID_VIDEIRA_URL");
    assert.equal((await call("settings.update", { holyricsUrl: "http://localhost:8091", firstRunDone: true })).data.firstRunDone, true);

    assert.deepEqual((await call("service.credentials.status")).data, { holyrics: false, videira: false });
    assert.equal((await call("service.credentials.set", { target: "holyrics", token: "curto" })).error?.code, "INVALID_CREDENTIAL");
    assert.equal((await call("service.credentials.set", { target: "holyrics", token: "token-longo-ok" })).data.configured, true);
    assert.deepEqual((await call("service.credentials.status")).data, { holyrics: true, videira: false });
    assert.doesNotMatch(JSON.stringify((await call("service.credentials.status"))), /token-longo-ok/);

    // Sem token do Videira configurado, o culto falha com AUTH_REQUIRED (nunca por texto de mensagem).
    assert.equal((await call("worship.prepare")).error?.code, "AUTH_REQUIRED");

    const help = (await call("help.list")).data;
    assert.ok(help.length >= 10 && help.every((topic: { id?: string; title?: string }) => topic.id && topic.title));
    const article = (await call("help.get", { topicId: "comecar" })).data;
    assert.equal(article.id, "comecar");
    assert.match(article.markdown, /\S/);
    assert.equal((await call("help.get", { topicId: "nao-existe" })).data, null);
    assert.ok((await call("help.search", { query: "TOKEN" })).data.every((topic: { id?: string; summary?: string }) => topic.id && topic.summary));

    assert.equal((await call("externalLink.open", { url: "https://videiramusic.org/ajuda" })).data.opened, true);
    assert.equal((await call("externalLink.open", { url: "https://evil.example/" })).error?.code, "EXTERNAL_LINK_BLOCKED");
    assert.equal((await call("externalLink.open", { url: "file:///C:/Windows" })).error?.code, "EXTERNAL_LINK_BLOCKED");
    assert.deepEqual(opened, ["https://videiramusic.org/ajuda"]);

    const log = (await call("logs.list")).data;
    assert.ok(log.some((entry: AuditEntry) => entry.event === "settings.updated"));
    assert.ok(log.some((entry: AuditEntry) => entry.event === "credentials.saved" && entry.target === "holyrics"));
    assert.ok(log.some((entry: AuditEntry) => entry.event === "worship.failed" && entry.code === "AUTH_REQUIRED"));
    assert.doesNotMatch(JSON.stringify(log), /token-longo-ok/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
