import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createEmptyState, readState, writeState } from "../src/state/store.mjs";

test("state is checksummed, atomically replaced, and does not serialize credentials", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "async-videira-state-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, "state.json");
  const state = { ...createEmptyState(), prepared: { setlistId: "set-1" } };
  const saved = await writeState(file, state);
  assert.equal(typeof saved.checksum, "string");
  assert.equal((await readState(file)).prepared.setlistId, "set-1");
  assert.doesNotMatch(await readFile(file, "utf8"), /token|secret/i);
  await assert.rejects(() => writeState(file, { ...state, videiraToken: "must-not-persist" }), /cannot contain credentials/i);
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
