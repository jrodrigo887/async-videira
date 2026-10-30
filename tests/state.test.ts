import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createEmptyState, readState, writeState } from "../src/state/store.ts";

test("state is checksummed, atomically replaced, and does not serialize credentials", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "async-videira-state-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, "state.json");
  const state = { ...createEmptyState(), prepared: { setlistId: "set-1" } as never };
  const saved = await writeState(file, state);
  assert.equal(typeof saved.checksum, "string");
  assert.equal((await readState(file)).prepared!.setlistId, "set-1");
  assert.doesNotMatch(await readFile(file, "utf8"), /token|secret/i);
  await assert.rejects(() => writeState(file, { ...state, videiraToken: "must-not-persist" } as never), /cannot contain credentials/i);
});

test("state checksum mismatch is rejected", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "async-videira-state-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, "state.json");
  await writeState(file, { ...createEmptyState(), prepared: null });
  const data = JSON.parse(await readFile(file, "utf8"));
  data.pendingReports.push({ report: { status: "OK" } });
  await writeFile(file, JSON.stringify(data));
  await assert.rejects(() => readState(file), /checksum mismatch/i);
});

test("state with undefined-valued fields round-trips with a valid checksum", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = await mkdtemp(join(tmpdir(), "av-undef-"));
  try {
    const file = join(dir, "state.json");
    await writeState(file, { ...createEmptyState(), prepared: { plan: { itemResults: [{ status: "absent", candidates: undefined, suggestions: [] }] } } as never });
    assert.equal((await readState(file)).prepared!.plan.itemResults[0]!.status, "absent");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("readStateOrRecover keeps a damaged state file aside, salvages unsent reports and returns a clean state", async () => {
  const { readdir } = await import("node:fs/promises");
  const { readStateOrRecover } = await import("../src/state/store.ts");
  const dir = await mkdtemp(join(tmpdir(), "av-recover-"));
  try {
    const file = join(dir, "state.json");
    await writeFile(file, JSON.stringify({ schemaVersion: 1, checksum: "00", pendingReports: [{ report: { setlistId: "s1" }, queuedAt: "2026-01-01T00:00:00Z" }, "lixo"] }));
    const recovered = await readStateOrRecover(file);
    assert.equal(recovered.prepared, null);
    assert.deepEqual(recovered.pendingReports.map((entry) => entry.report.setlistId), ["s1"]);
    assert.ok((await readdir(dir)).some((name) => name.startsWith("state.json.corrupt-")));
    assert.equal((await readStateOrRecover(file)).pendingReports.length, 0, "no file left to read: starts empty");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
