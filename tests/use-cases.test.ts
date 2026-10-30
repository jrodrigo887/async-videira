import assert from "node:assert/strict";
import test from "node:test";
import { applyWorship } from "../src/application/use-cases/apply-worship.ts";
import { prepareWorship } from "../src/application/use-cases/prepare-worship.ts";
import { recoverInterruptedApply } from "../src/application/use-cases/recover-interrupted-apply.ts";
import { createEventBus } from "../src/adapters/event-bus/in-process.ts";
import { auditRowFor } from "../src/application/services/audit-projector.ts";
import type { DomainEvent } from "../src/domain/events.ts";
import type { Deps } from "../src/application/ports/index.ts";
import type { AppState } from "../src/domain/types.ts";
import { createEmptyState, sha256 } from "../src/state/store.ts";

// Fakes em memória das portas: nenhum HTTP, nenhum arquivo.
function makeDeps({ playlist = [], externalId = "10", failReport = false, onApply }: { playlist?: string[]; externalId?: string; failReport?: boolean; onApply?: (saved: AppState) => void } = {}) {
  const sent: unknown[] = [];
  const events: DomainEvent[] = [];
  let saved = createEmptyState();
  let current = playlist.map(String);
  // Só as portas que preparar/aplicar usam; o resto de `Deps` (vínculos, editor) não entra nestes testes.
  const deps = {
    videira: {
      listPublishedSetlists: async () => ({ setlists: [{ id: "s1", title: "Culto" }] }),
      getPublishedSetlist: async () => ({ id: "s1", title: "Culto", items: [{ position: 1, songId: "v1", title: "Canção", artist: "Banda", externalId }] }),
      sendSyncReport: async (report: unknown) => { if (failReport) throw new Error("offline"); sent.push(report); return {}; },
    },
    holyrics: {
      ping: async () => ({ version: { version: "1", baseDir: "C:/H", platform: "win" }, plan: { type: "none" } }),
      getCatalog: async () => [{ id: "10", title: "Canção", artist: "Banda" }],
      getCurrentSchedule: async () => ({ type: "playlist", name: "Domingo" }),
      getPlaylist: async () => current.map((id) => ({ id })),
      applyOrder: async (ids: string[]) => { onApply?.(saved); current = ids.map(String); },
    },
    state: { load: async () => structuredClone(saved), save: async (state: Partial<AppState>) => { saved = structuredClone(state) as AppState; return saved; } },
    clock: { now: () => new Date("2026-10-30T10:00:00Z") },
    hash: sha256,
    events: { publish: async (event: DomainEvent) => { events.push(event); } },
  } as unknown as Deps;
  return { deps, sent, events, playlist: () => current, saved: () => saved };
}

test("prepareWorship faz o dry-run e persiste a preparação sem escrever no Holyrics", async () => {
  const h = makeDeps({ playlist: ["99"] });
  const { preparation, plan } = await prepareWorship(h.deps);
  assert.equal(preparation.setlist.id, "s1");
  assert.deepEqual(plan.targetIds, ["10"]);
  assert.equal(preparation.mutates, true);
  assert.deepEqual(h.playlist(), ["99"]);
  assert.equal(h.saved().prepared!.setlistId, "s1");
});

test("applyWorship aplica, confirma por releitura, reporta e limpa a preparação", async () => {
  const h = makeDeps({ playlist: ["99"] });
  await prepareWorship(h.deps);
  const { result, reportQueued } = await applyWorship(h.deps);
  assert.equal(result.status, "OK");
  assert.equal(result.verified, true);
  assert.equal(reportQueued, false);
  assert.deepEqual(h.playlist(), ["10"]);
  assert.equal(h.sent.length, 1);
  assert.equal(h.saved().prepared, null);
});

test("applyWorship enfileira o relatório quando o Videira está indisponível", async () => {
  const h = makeDeps({ playlist: ["99"], failReport: true });
  await prepareWorship(h.deps);
  const { reportQueued } = await applyWorship(h.deps);
  assert.equal(reportQueued, true);
  assert.equal(h.saved().pendingReports.length, 1);
});

test("applyWorship recusa preparação vencida (destino mudou) sem tocar na playlist", async () => {
  const h = makeDeps({ playlist: ["99"] });
  await prepareWorship(h.deps);
  h.deps.holyrics.getCurrentSchedule = async () => ({ type: "playlist", name: "Outro" });
  await assert.rejects(applyWorship(h.deps), /changed since preparar/);
  assert.deepEqual(h.playlist(), ["99"]);
});

test("applyWorship sem preparação falha cedo", async () => {
  await assert.rejects(applyWorship(makeDeps().deps), /Nenhuma preparação válida/);
});

test("applyWorship grava o journal ANTES de escrever e o encerra depois, publicando os eventos em ordem", async () => {
  let atWrite: AppState["journal"];
  const h = makeDeps({ playlist: ["99"], onApply: (saved) => { atWrite = saved.journal; } });
  await prepareWorship(h.deps);
  await applyWorship(h.deps);
  assert.deepEqual(atWrite, { phase: "started", setlistId: "s1", backupIds: ["99"], targetIds: ["10"], at: "2026-10-30T10:00:00.000Z" });
  assert.equal(h.saved().journal?.phase, "done");
  const types = h.events.map((event) => event.type);
  assert.ok(types.indexOf("ApplyStarted") < types.indexOf("PlaylistApplied"));
  assert.deepEqual(h.events.find((event) => event.type === "ApplyStarted"), { type: "ApplyStarted", setlistId: "s1", backupIds: ["99"], targetIds: ["10"] });
});

test("recoverInterruptedApply: sem journal pendente não faz nada", async () => {
  const h = makeDeps();
  assert.deepEqual(await recoverInterruptedApply(h.deps), { status: "none" });
});

async function interrupted(playlist: string[]) {
  const h = makeDeps({ playlist });
  await h.deps.state.save({ ...createEmptyState(), journal: { phase: "started", setlistId: "s1", backupIds: ["99", "98"], targetIds: ["10"], at: "2026-10-30T09:59:00.000Z" } });
  return h;
}

test("recoverInterruptedApply: relê a playlist e diz onde ela está, sem presumir sucesso nem escrever", async () => {
  for (const [playlist, where] of [[["10"], "target"], [["99", "98"], "backup"], [[], "other"]] as const) {
    const h = await interrupted([...playlist]);
    const report = await recoverInterruptedApply(h.deps);
    assert.deepEqual(report, { status: "interrupted", setlistId: "s1", at: "2026-10-30T09:59:00.000Z", playlist: where, backupCount: 2, targetCount: 1, canRestore: true });
    assert.equal(h.saved().journal?.phase, "started");
    assert.deepEqual(h.playlist(), playlist);
  }
});

test("recoverInterruptedApply: restaurar devolve a playlist anterior e encerra o journal; dispensar só encerra", async () => {
  const restore = await interrupted([]);
  assert.deepEqual(await recoverInterruptedApply(restore.deps, { action: "restore" }), { status: "restored", setlistId: "s1" });
  assert.deepEqual(restore.playlist(), ["99", "98"]);
  assert.equal(restore.saved().journal, null);
  assert.deepEqual(restore.events.at(-1), { type: "PlaylistRestored", ok: true });

  const dismiss = await interrupted(["10"]);
  assert.deepEqual(await recoverInterruptedApply(dismiss.deps, { action: "dismiss" }), { status: "dismissed", setlistId: "s1" });
  assert.deepEqual(dismiss.playlist(), ["10"]);
  assert.equal(dismiss.saved().journal, null);
});

test("event bus: entrega em ordem e uma falha de assinante não derruba a operação nem os demais", async () => {
  const bus = createEventBus();
  const seen: string[] = [];
  bus.subscribe(() => { throw new Error("log cheio"); });
  const off = bus.subscribe((event) => { seen.push(event.type); });
  await bus.publish({ type: "AppStarted" });
  off();
  await bus.publish({ type: "SettingsUpdated" });
  assert.deepEqual(seen, ["AppStarted"]);
});

test("projeção de auditoria: só eventos de operador viram linha; fases e journal não", () => {
  assert.deepEqual(auditRowFor({ type: "OperationFailed", operation: "apply", code: "DESTINATION_CHANGED" }), { event: "worship.failed", data: { action: "apply", code: "DESTINATION_CHANGED" } });
  assert.equal(auditRowFor({ type: "OperationPhaseChanged", operation: "apply", phase: "writing" }), null);
  assert.equal(auditRowFor({ type: "ApplyStarted", setlistId: "s1", backupIds: [], targetIds: [] }), null);
  assert.equal(auditRowFor({ type: "OperationStarted", operation: "recover" }), null);
});

test("progresso: preparar e aplicar publicam fases em ordem e o encaminhador entrega só operação e etapa", async () => {
  const { createProgressForwarder } = await import("../src/application/services/progress-forwarder.ts");
  const h = makeDeps({ playlist: ["99"] });
  const sent: unknown[] = [];
  const forward = createProgressForwarder((message) => sent.push(message));
  const bus = createEventBus();
  bus.subscribe(forward);
  (h.deps as { events?: unknown }).events = bus;
  await prepareWorship(h.deps);
  await applyWorship(h.deps);
  assert.deepEqual(sent, [
    { operation: "prepare", step: "reading" },
    { operation: "prepare", step: "planning" },
    { operation: "apply", step: "validating" },
    { operation: "apply", step: "writing" },
    { operation: "apply", step: "reporting" },
  ]);
  await bus.publish({ type: "ApplyStarted", setlistId: "s1", backupIds: ["1"], targetIds: ["2"] });
  assert.equal(sent.length, 5);
});
