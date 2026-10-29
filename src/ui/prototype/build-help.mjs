// Gera help-data.js a partir de src/help/*.md, para a Ajuda funcionar offline (inclusive por file://).
// Uso: node src/ui/prototype/build-help.mjs           → escreve help-data.js
//      node src/ui/prototype/build-help.mjs --check   → só confere (sai com 1 se help-data.js estiver desatualizado ou inválido)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const helpDir = path.resolve(here, "../../help");
const outFile = path.join(here, "help-data.js");
const CATEGORIES = ["comecar", "domingo", "problema", "tecnico"];
const AUDIENCES = ["operador", "tecnico"];
const LIST_FIELDS = ["palavras-chave", "relacionados"];

const errors = [];
const topics = fs.readdirSync(helpDir).filter((f) => f.endsWith(".md")).sort().map((file) => {
  const raw = fs.readFileSync(path.join(helpDir, file), "utf8").replace(/\r\n/g, "\n");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) { errors.push(`${file}: sem front matter`); return null; }
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-z-]+):\s*(.*)$/);
    if (!kv) { if (line.trim()) errors.push(`${file}: linha inválida no front matter: ${line}`); continue; }
    // Mesmo formato que src/core/help/index.mjs aceita: listas entre colchetes, ex.: relacionados: [a, b]
    if (LIST_FIELDS.includes(kv[1]) && !/^\[.*\]$/.test(kv[2].trim())) errors.push(`${file}: ${kv[1]} deve ser uma lista [a, b]`);
    meta[kv[1]] = LIST_FIELDS.includes(kv[1]) ? kv[2].trim().replace(/^\[|\]$/g, "").split(",").map((s) => s.trim()).filter(Boolean) : kv[2].trim();
  }
  for (const k of ["id", "titulo", "publico", "categoria", "ordem", ...LIST_FIELDS]) if (meta[k] == null) errors.push(`${file}: falta "${k}"`);
  if (meta.id && `${meta.id}.md` !== file) errors.push(`${file}: id "${meta.id}" diferente do nome do arquivo`);
  if (meta.publico && !AUDIENCES.includes(meta.publico)) errors.push(`${file}: publico deve ser ${AUDIENCES.join("|")}`);
  if (meta.categoria && !CATEGORIES.includes(meta.categoria)) errors.push(`${file}: categoria deve ser ${CATEGORIES.join("|")}`);
  return { id: meta.id, titulo: meta.titulo, publico: meta.publico, categoria: meta.categoria, ordem: Number(meta.ordem) || 99,
    palavrasChave: meta["palavras-chave"] || [], relacionados: meta.relacionados || [], body: m[2].trim() + "\n" };
}).filter(Boolean);

const ids = new Set(topics.map((t) => t.id));
for (const t of topics) {
  for (const r of t.relacionados) if (!ids.has(r)) errors.push(`${t.id}: relacionado inexistente "${r}"`);
  for (const [, link] of t.body.matchAll(/\]\(topico:([^)]+)\)/g)) if (!ids.has(link)) errors.push(`${t.id}: link para tópico inexistente "topico:${link}"`);
  if (/<[a-z!/]/i.test(t.body.replace(/`[^`]*`/g, ""))) errors.push(`${t.id}: HTML não é permitido nos tópicos`);
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }

const out = `// GERADO por build-help.mjs a partir de src/help/*.md. Não edite à mão: edite o .md e rode node src/ui/prototype/build-help.mjs\nwindow.PROTO_HELP = ${JSON.stringify({ source: "src/help", topics }, null, 1)};\n`;
if (process.argv.includes("--check")) {
  const cur = fs.existsSync(outFile) ? fs.readFileSync(outFile, "utf8").replace(/\r\n/g, "\n") : "";
  if (cur !== out) { console.error("help-data.js está desatualizado: rode node src/ui/prototype/build-help.mjs"); process.exit(1); }
  console.log(`help-data.js em dia (${topics.length} tópicos).`);
} else {
  fs.writeFileSync(outFile, out);
  console.log(`help-data.js gerado: ${topics.length} tópicos.`);
}
