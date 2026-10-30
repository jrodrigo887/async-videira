import { appendFile, mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { sanitizeAuditEntry } from "../../domain/audit/audit-entry.ts";
import type { AuditData, AuditEntry } from "../../domain/audit/audit-entry.ts";
import type { AuditLog, Clock } from "../../application/ports/index.ts";

const MAX_BYTES = 512 * 1024;
const KEEP = 4;
const LIST_LIMIT = 300;

/**
 * Log de atividade em JSON Lines com rotação (512 KiB × 4 cópias). A política do que pode ser gravado é do
 * domínio (`sanitizeAuditEntry`) e vale na escrita e na leitura. Escritas são serializadas numa fila e nunca
 * derrubam quem chama.
 */
export function createAuditLog({ dir, clock = { now: () => new Date() }, maxBytes = MAX_BYTES, keep = KEEP }: { dir: string; clock?: Clock; maxBytes?: number; keep?: number }): AuditLog {
  const file = join(dir, "activity.jsonl");
  let queue: Promise<void> = Promise.resolve();

  async function rotate() {
    try {
      if ((await stat(file)).size < maxBytes) return;
      await rm(`${file}.${keep}`, { force: true });
      for (let index = keep - 1; index >= 1; index -= 1) {
        try { await rename(`${file}.${index}`, `${file}.${index + 1}`); } catch {}
      }
      await rename(file, `${file}.1`);
    } catch {}
  }

  function append(event: string, data: AuditData = {}): Promise<void> {
    const entry = sanitizeAuditEntry(event, data, clock.now().toISOString());
    if (!entry) return Promise.resolve();
    queue = queue.then(async () => {
      await mkdir(dir, { recursive: true });
      await rotate();
      await appendFile(file, `${JSON.stringify(entry)}\n`, { encoding: "utf8" });
    }).catch(() => {});
    return queue;
  }

  async function list(): Promise<AuditEntry[]> {
    await queue;
    const entries: AuditEntry[] = [];
    for (let index = keep; index >= 0; index -= 1) {
      let content: string;
      try { content = await readFile(index === 0 ? file : `${file}.${index}`, "utf8"); } catch { continue; }
      for (const line of content.split(/\r?\n/)) {
        if (!line) continue;
        try {
          const raw = JSON.parse(line);
          const clean = sanitizeAuditEntry(raw.event, raw, raw.at);
          if (clean) entries.push(clean);
        } catch {}
      }
    }
    return entries.slice(-LIST_LIMIT).reverse();
  }

  return { append, list };
}
