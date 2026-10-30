import assert from "node:assert/strict";
import { appendFile, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createAuditLog } from "../src/adapters/audit-jsonl/audit-log.ts";
import { sanitizeAuditEntry } from "../src/domain/audit/audit-entry.ts";
import type { AuditData } from "../src/domain/audit/audit-entry.ts";

test("política: só eventos e campos enumerados; texto livre e tokens são descartados", () => {
  assert.equal(sanitizeAuditEntry("evento.inventado", {}, "2026-01-01T00:00:00Z"), null);
  assert.equal(sanitizeAuditEntry("app.started", {}, undefined), null);
  const entry = sanitizeAuditEntry("connection.failed", { target: "videira", code: "AUTH_REJECTED", status: "failed", token: "segredo", message: "livre", count: 3 } as AuditData, "2026-01-01T00:00:00Z");
  assert.deepEqual(entry, { at: "2026-01-01T00:00:00Z", event: "connection.failed", target: "videira", status: "failed", code: "AUTH_REJECTED", count: 3 });
  assert.equal(sanitizeAuditEntry("app.started", { code: "CODIGO_LIVRE", count: -1 }, "t")?.code, undefined);
  assert.equal(sanitizeAuditEntry("app.started", { count: 1e9 }, "t")?.count, undefined);
});

test("log: grava, lista do mais novo para o mais antigo e filtra linhas adulteradas na leitura", async () => {
  const dir = await mkdtemp(join(tmpdir(), "av-audit-"));
  try {
    let tick = 0;
    const log = createAuditLog({ dir, clock: { now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)) } });
    await log.append("app.started");
    await log.append("links.removed", { count: 1 });
    await log.append("nao.permitido");
    await appendFile(join(dir, "activity.jsonl"), `{"at":"x","event":"links.removed","token":"vazou","code":"XPTO"}\nnão é json\n`);
    const entries = await log.list();
    assert.deepEqual(entries.map((entry) => entry.event), ["links.removed", "links.removed", "app.started"]);
    assert.doesNotMatch(JSON.stringify(entries), /vazou|XPTO/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("log: gira ao passar do limite e mantém no máximo `keep` cópias antigas", async () => {
  const dir = await mkdtemp(join(tmpdir(), "av-audit-"));
  try {
    const log = createAuditLog({ dir, maxBytes: 200, keep: 2 });
    for (let index = 0; index < 40; index += 1) await log.append("worship.succeeded", { action: "prepare", status: "prepared" });
    const files = (await readdir(dir)).sort();
    assert.deepEqual(files, ["activity.jsonl", "activity.jsonl.1", "activity.jsonl.2"]);
    assert.ok((await log.list()).length > 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
