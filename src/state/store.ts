import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { AppState, PendingReport } from "../domain/types.ts";

export const STATE_SCHEMA_VERSION = 1;

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    // Match JSON round-tripping: undefined-valued keys vanish when the state is saved and read back.
    return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value: unknown): string {
  return createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value), "utf8").digest("hex");
}

function assertNoSecretFields(value: unknown): void {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value as object)) {
    if (/(token|secret|password|authorization)/i.test(key)) {
      throw new Error("Local state cannot contain credentials.");
    }
    assertNoSecretFields(nested);
  }
}

function stateChecksum(envelope: Record<string, unknown>): string {
  const { checksum: _checksum, ...unsigned } = envelope;
  return sha256(unsigned);
}

export function createEmptyState(): AppState {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    updatedAt: new Date(0).toISOString(),
    cache: { catalog: null, setlist: null },
    prepared: null,
    pendingReports: [],
    migration: { status: "not-started", previousFingerprint: null, history: [] },
  };
}

export function getDefaultStatePath(env: NodeJS.ProcessEnv = process.env): string {
  if (env.ASYNC_VIDEIRA_STATE_PATH) return env.ASYNC_VIDEIRA_STATE_PATH;
  const base = process.platform === "win32"
    ? (env.APPDATA || join(homedir(), "AppData", "Roaming"))
    : process.platform === "darwin"
      ? join(homedir(), "Library", "Application Support")
      : (env.XDG_STATE_HOME || join(homedir(), ".local", "state"));
  return join(base, "async-videira", "state.json");
}

export async function readState(filePath: string): Promise<AppState> {
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") return createEmptyState();
    throw new Error("Could not read local state file.");
  }

  let envelope: Record<string, unknown>;
  try {
    envelope = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("Local state JSON is invalid; preserve it and prepare again after recovery.");
  }
  if (envelope?.schemaVersion !== STATE_SCHEMA_VERSION || typeof envelope.checksum !== "string") {
    throw new Error("Local state schema is unsupported; preserve it and prepare again after recovery.");
  }
  const expected = Buffer.from(stateChecksum(envelope), "hex");
  const actual = Buffer.from(envelope.checksum as string, "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("Local state checksum mismatch; preserve it and prepare again after recovery.");
  }
  assertNoSecretFields(envelope);
  return envelope as unknown as AppState;
}

export async function writeState(filePath: string, state: Partial<AppState>): Promise<AppState> {
  const next = {
    ...createEmptyState(),
    ...state,
    schemaVersion: STATE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };
  delete next.checksum;
  assertNoSecretFields(next);
  const envelope: AppState = { ...next, checksum: stateChecksum({ ...next }) };
  const text = `${JSON.stringify(envelope, null, 2)}\n`;
  const directory = dirname(filePath);
  const tempPath = join(directory, `.state-${process.pid}-${randomUUID()}.tmp`);
  await mkdir(directory, { recursive: true });
  let handle: FileHandle | undefined;
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

/**
 * Like readState, but a damaged state file (bad JSON, unknown schema, checksum mismatch) never blocks the app:
 * the file is kept next to the original as *.corrupt-<time> for inspection, unsent reports are salvaged when the
 * JSON is still readable, and a clean state is returned. The cache is rebuilt from the APIs on the next preparation.
 */
export async function readStateOrRecover(filePath: string): Promise<AppState> {
  try {
    return await readState(filePath);
  } catch (error) {
    if (!/^Local state /.test(String((error as Error | null)?.message))) throw error;
    let salvaged: PendingReport[] = [];
    try {
      const raw = JSON.parse((await readFile(filePath, "utf8")).replace(/^\uFEFF/, ""));
      if (Array.isArray(raw?.pendingReports)) salvaged = raw.pendingReports.filter((entry: { report?: unknown } | null) => entry && typeof entry === "object" && entry.report);
    } catch {}
    try { await rename(filePath, `${filePath}.corrupt-${Date.now()}`); } catch {}
    return { ...createEmptyState(), pendingReports: salvaged };
  }
}
