import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export const STATE_SCHEMA_VERSION = 1;

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value), "utf8").digest("hex");
}

function assertNoSecretFields(value) {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (/(token|secret|password|authorization)/i.test(key)) {
      throw new Error("Local state cannot contain credentials.");
    }
    assertNoSecretFields(nested);
  }
}

function stateChecksum(envelope) {
  const { checksum: _checksum, ...unsigned } = envelope;
  return sha256(unsigned);
}

export function createEmptyState() {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    updatedAt: new Date(0).toISOString(),
    cache: { catalog: null, setlist: null },
    prepared: null,
    pendingReports: [],
    migration: { status: "not-started", previousFingerprint: null, history: [] },
  };
}

export function getDefaultStatePath(env = process.env) {
  if (env.ASYNC_VIDEIRA_STATE_PATH) return env.ASYNC_VIDEIRA_STATE_PATH;
  const base = process.platform === "win32"
    ? (env.APPDATA || join(homedir(), "AppData", "Roaming"))
    : process.platform === "darwin"
      ? join(homedir(), "Library", "Application Support")
      : (env.XDG_STATE_HOME || join(homedir(), ".local", "state"));
  return join(base, "async-videira", "state.json");
}

export async function readState(filePath) {
  let text;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return createEmptyState();
    throw new Error("Could not read local state file.");
  }

  let envelope;
  try {
    envelope = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("Local state JSON is invalid; preserve it and prepare again after recovery.");
  }
  if (envelope?.schemaVersion !== STATE_SCHEMA_VERSION || typeof envelope.checksum !== "string") {
    throw new Error("Local state schema is unsupported; preserve it and prepare again after recovery.");
  }
  const expected = Buffer.from(stateChecksum(envelope), "hex");
  const actual = Buffer.from(envelope.checksum, "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("Local state checksum mismatch; preserve it and prepare again after recovery.");
  }
  assertNoSecretFields(envelope);
  return envelope;
}

export async function writeState(filePath, state) {
  const next = {
    ...createEmptyState(),
    ...state,
    schemaVersion: STATE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };
  delete next.checksum;
  assertNoSecretFields(next);
  const envelope = { ...next, checksum: stateChecksum(next) };
  const text = `${JSON.stringify(envelope, null, 2)}\n`;
  const directory = dirname(filePath);
  const tempPath = join(directory, `.state-${process.pid}-${randomUUID()}.tmp`);
  await mkdir(directory, { recursive: true });
  let handle;
  try {
    handle = await open(tempPath, "wx", 0o600);
    await handle.writeFile(text, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(tempPath, filePath);
    return envelope;
  } catch {
    if (handle) await handle.close().catch(() => {});
    await rm(tempPath, { force: true }).catch(() => {});
    throw new Error("Could not atomically save local state.");
  }
}
