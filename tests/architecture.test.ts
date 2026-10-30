import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const src = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");
const IMPORT = /(?:import|export)\s[^"']*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

async function filesIn(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await filesIn(path));
    else if (/\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

async function importsOf(file: string): Promise<string[]> {
  const text = await readFile(file, "utf8");
  return [...text.matchAll(IMPORT)].map((match) => (match[1] ?? match[2])!);
}

// Regra de dependência: domain ← application ← (adapters, interface). Ver docs/architecture-target.md.
// `allowPaths`: subcaminhos de camadas não permitidas que ainda podem ser importados (ex.: as portas, que são só tipos).
async function violations(layer: string, allowedLayers: string[], { allowNode = false, allowPaths = [] as string[] } = {}) {
  const found: string[] = [];
  for (const file of await filesIn(join(src, layer))) {
    for (const spec of await importsOf(file)) {
      if (spec.startsWith("node:")) {
        if (allowNode) continue;
        found.push(`${relative(src, file)} → ${spec}`);
        continue;
      }
      if (!spec.startsWith(".")) continue;
      const resolved = relative(src, resolve(dirname(file), spec));
      const target = resolved.split(sep)[0]!;
      if (allowPaths.some((allowed) => resolved.split(sep).join("/").startsWith(allowed))) continue;
      if (!allowedLayers.includes(target)) found.push(`${relative(src, file)} → ${spec}`);
    }
  }
  return found;
}

test("domain é puro: sem node:*, sem I/O e só importa domain", async () => {
  assert.deepEqual(await violations("domain", ["domain"]), []);
});

test("application importa apenas domain e application (sem node:* nem adapters)", async () => {
  assert.deepEqual(await violations("application", ["domain", "application"]), []);
});

// `state` (store.ts) ainda é um módulo legado; sai da lista quando o store migrar para o adaptador.
// Adaptadores implementam as portas, então podem importar os contratos (só tipos) de application/ports.
test("adapters só dependem de domain e das portas (nunca de use cases, interface nem composition)", async () => {
  const found = await violations("adapters", ["adapters", "domain", "state"], { allowNode: true, allowPaths: ["application/ports/"] });
  assert.deepEqual(found, []);
});

test("interface fala com use cases via composition, nunca com adapters", async () => {
  assert.deepEqual(await violations("interface", ["interface", "domain", "application", "composition"], { allowNode: true }), []);
});

// Renderer por funcionalidade: cada pasta de features/ é independente; o que for comum mora em shared/.
test("renderer: uma funcionalidade não importa de outra (usa shared/)", async () => {
  const ui = join(src, "ui", "app", "features");
  const found: string[] = [];
  for (const file of await filesIn(ui)) {
    const own = relative(ui, file).split(sep)[0];
    for (const spec of await importsOf(file)) {
      if (!spec.startsWith(".")) continue;
      const target = relative(ui, resolve(dirname(file), spec));
      if (target.startsWith("..")) continue;
      if (target.split(sep)[0] !== own) found.push(`${relative(src, file)} → ${spec}`);
    }
  }
  assert.deepEqual(found, []);
});
