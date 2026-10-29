import { readdir, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const ERROR_TOPICS = JSON.parse(readFileSync(new URL("./error-topics.json", import.meta.url), "utf8"));
const VALID_AUDIENCES = new Set(["operador", "tecnico"]);
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
let defaultTopicsPromise;

export class HelpContentError extends Error {
  constructor(errors) {
    super(`Invalid help content:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    this.name = "HelpContentError";
    this.errors = errors;
  }
}

export function normalizeHelpText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

function parseScalar(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseListValue(value, lines, startIndex, file, field) {
  const trimmed = value.trim();
  if (trimmed === "[]") return { value: [], nextIndex: startIndex };
  if (trimmed.startsWith("[")) {
    if (!trimmed.endsWith("]")) return { value: trimmed, nextIndex: startIndex };
    const content = trimmed.slice(1, -1).trim();
    return { value: content ? content.split(",").map(parseScalar) : [], nextIndex: startIndex };
  }
  if (trimmed) return { value: trimmed, nextIndex: startIndex };
  const result = [];
  let index = startIndex;
  while (index < lines.length && /^\s+-\s+/.test(lines[index])) {
    result.push(parseScalar(lines[index].replace(/^\s+-\s+/, "")));
    index += 1;
  }
  return { value: result, nextIndex: index };
}

function parseFrontMatter(text, file) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== "---") throw new Error(`${file}: missing opening --- front matter delimiter.`);
  const end = lines.indexOf("---", 1);
  if (end < 0) throw new Error(`${file}: missing closing --- front matter delimiter.`);
  const metadata = {};
  const frontMatterLines = lines.slice(1, end);
  for (let index = 0; index < frontMatterLines.length;) {
    const line = frontMatterLines[index];
    if (!line.trim()) { index += 1; continue; }
    const match = line.match(/^([\w-]+):(?:\s*(.*))?$/);
    if (!match) throw new Error(`${file}: invalid front matter line ${index + 2}.`);
    const [, key, rawValue = ""] = match;
    if (Object.hasOwn(metadata, key)) throw new Error(`${file}: duplicate front matter field '${key}'.`);
    if (key === "palavras-chave" || key === "relacionados") {
      const parsed = parseListValue(rawValue, frontMatterLines, index + 1, file, key);
      metadata[key] = parsed.value;
      index = parsed.nextIndex;
    } else {
      metadata[key] = parseScalar(rawValue);
      index += 1;
    }
  }
  return { metadata, body: lines.slice(end + 1).join("\n").trim() };
}

function validateMarkdown(body, file) {
  const errors = [];
  const dangerous = [
    [/<\s*\/?\s*(?:script|iframe)\b/i, "contains a forbidden script/iframe tag"],
    [/\bon\w+\s*=/i, "contains a forbidden inline event handler"],
    [/javascript\s*:/i, "contains a forbidden javascript: URL"],
  ];
  for (const [pattern, message] of dangerous) if (pattern.test(body)) errors.push(`${file}: ${message}.`);
  const linkPattern = /\[[^\]]*\]\(topico:([^\s)]+)\)/g;
  const links = [...body.matchAll(linkPattern)].map((match) => match[1]);
  const anyTopicSyntax = /\[[^\]]*\]\(topico:[^)]*\)/g;
  const completeLinks = [...body.matchAll(anyTopicSyntax)].length;
  if (links.length !== completeLinks) errors.push(`${file}: malformed internal topico link.`);
  return { errors, links };
}

function makeTopic(metadata, body, file) {
  const errors = [];
  const required = ["id", "titulo", "publico", "palavras-chave", "relacionados"];
  for (const key of required) if (!Object.hasOwn(metadata, key)) errors.push(`${file}: missing required field '${key}'.`);
  if (metadata.id && !ID_PATTERN.test(metadata.id)) errors.push(`${file}: id must be a lowercase slug.`);
  if (!metadata.titulo?.trim()) errors.push(`${file}: titulo must not be empty.`);
  if (metadata.publico && !VALID_AUDIENCES.has(metadata.publico)) errors.push(`${file}: publico must be 'operador' or 'tecnico'.`);
  for (const field of ["palavras-chave", "relacionados"]) {
    if (Object.hasOwn(metadata, field) && !Array.isArray(metadata[field])) errors.push(`${file}: ${field} must be a YAML-style list or [].`);
  }
  if (metadata.categoria !== undefined && !metadata.categoria.trim()) errors.push(`${file}: categoria must not be empty when provided.`);
  const markdown = validateMarkdown(body, file);
  errors.push(...markdown.errors);
  if (errors.length) throw new HelpContentError(errors);
  return {
    id: metadata.id,
    titulo: metadata.titulo,
    publico: metadata.publico,
    categoria: metadata.categoria || null,
    palavrasChave: metadata["palavras-chave"],
    relacionados: metadata.relacionados,
    corpo: body,
    _links: markdown.links,
    _file: basename(file),
  };
}

export async function loadHelpTopics({ directory = fileURLToPath(new URL("../../help", import.meta.url)) } = {}) {
  let files;
  try {
    files = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
      .map((entry) => join(directory, entry.name))
      .sort();
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const topics = [];
  const errors = [];
  for (const file of files) {
    try {
      const { metadata, body } = parseFrontMatter(await readFile(file, "utf8"), file);
      topics.push(makeTopic(metadata, body, file));
    } catch (error) {
      if (error instanceof HelpContentError) errors.push(...error.errors);
      else errors.push(`${file}: ${error.message}`);
    }
  }
  const byId = new Map();
  for (const topic of topics) {
    if (byId.has(topic.id)) errors.push(`${topic._file}: duplicate topic id '${topic.id}' (also ${byId.get(topic.id)}).`);
    else byId.set(topic.id, topic._file);
  }
  for (const topic of topics) {
    for (const related of topic.relacionados) {
      if (!byId.has(related)) errors.push(`${topic._file}: related topic '${related}' does not exist.`);
    }
    for (const linked of topic._links) {
      if (!byId.has(linked)) errors.push(`${topic._file}: internal link target '${linked}' does not exist.`);
    }
  }
  if (topics.length > 0) {
    for (const [code, topicId] of Object.entries(ERROR_TOPICS)) {
      if (!byId.has(topicId)) errors.push(`error-topics.json: '${code}' maps to missing topic '${topicId}'.`);
    }
  }
  if (errors.length) throw new HelpContentError(errors);
  return topics.map(({ _links, _file, ...topic }) => topic);
}

function defaultHelpTopics() {
  defaultTopicsPromise ??= loadHelpTopics();
  return defaultTopicsPromise;
}

export function buildHelpIndex(topics) {
  return {
    schemaVersion: 1,
    topics: topics.map((topic) => ({
      ...topic,
      search: {
        titulo: normalizeHelpText(topic.titulo),
        palavrasChave: normalizeHelpText(topic.palavrasChave.join(" ")),
        corpo: normalizeHelpText(topic.corpo),
      },
    })),
  };
}

export async function listHelpTopics({ publico, categoria } = {}, topics) {
  topics ??= await defaultHelpTopics();
  return topics
    .filter((topic) => (!publico || topic.publico === publico) && (!categoria || topic.categoria === categoria))
    .map((topic) => ({
      id: topic.id,
      title: topic.titulo,
      summary: summaryFor(topic),
      keywords: [...topic.palavrasChave],
      context: { publico: topic.publico, categoria: topic.categoria },
    }));
}

export async function getHelpTopic(id, topics) {
  topics ??= await defaultHelpTopics();
  const topic = topics.find((item) => item.id === id);
  return topic ? { topicId: topic.id, title: topic.titulo, markdown: topic.corpo } : null;
}

function summaryFor(topic) {
  const firstParagraph = topic.corpo.split(/\n\s*\n/)[0] ?? "";
  const clean = firstParagraph.replace(/[#*_`>\[\]]/g, "").replace(/\s+/g, " ").trim();
  const sentenceEnd = clean.search(/[.!?](?:\s|$)/);
  const summary = sentenceEnd >= 0 ? clean.slice(0, sentenceEnd + 1) : clean;
  return summary.length > 220 ? `${summary.slice(0, 217).trimEnd()}…` : summary;
}

function excerptFor(topic, normalizedQuery) {
  const paragraphs = topic.corpo.split(/\n\s*\n/).map((text) => text.replace(/[#*_`>\[\]]/g, "").trim()).filter(Boolean);
  const found = paragraphs.find((paragraph) => normalizeHelpText(paragraph).includes(normalizedQuery));
  const excerpt = found ?? paragraphs[0] ?? topic.titulo;
  return excerpt.length > 180 ? `${excerpt.slice(0, 177).trimEnd()}…` : excerpt;
}

export async function searchHelp(query, { limit = 20 } = {}, topics) {
  topics ??= await defaultHelpTopics();
  const normalizedQuery = normalizeHelpText(query);
  if (!normalizedQuery) return [];
  const results = [];
  for (const topic of topics) {
    const title = normalizeHelpText(topic.titulo);
    const keywords = topic.palavrasChave.map(normalizeHelpText).join(" ");
    const body = normalizeHelpText(topic.corpo);
    let score = 0;
    let rank = 0;
    if (title.includes(normalizedQuery)) { score = 300; rank = 3; }
    else if (keywords.includes(normalizedQuery)) { score = 200; rank = 2; }
    else if (body.includes(normalizedQuery)) { score = 100; rank = 1; }
    if (score) results.push({
      topicId: topic.id,
      title: topic.titulo,
      excerpt: excerptFor(topic, normalizedQuery),
      score,
      rank,
      context: { publico: topic.publico, categoria: topic.categoria },
    });
  }
  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "pt-BR"))
    .slice(0, Math.max(0, Math.min(100, Number.isFinite(limit) ? Math.trunc(limit) : 20)));
}

export function helpTopicForError(code) {
  return ERROR_TOPICS[code] ?? null;
}

const DIAGNOSTIC_COUNT_KEYS = ["helpTopics", "operatorTopics", "technicalTopics", "holyricsSongs", "setlistSongs"];

export function appDiagnosticInfo({ appVersion = "unknown", build = "unknown", os = process.platform, holyrics = null, videira = null, counts = {}, recentErrors = [] } = {}) {
  const osInfo = typeof os === "string" ? { platform: os } : {
    platform: String(os?.platform ?? process.platform),
    release: String(os?.release ?? "unknown"),
    arch: String(os?.arch ?? "unknown"),
  };
  const connected = holyrics?.connected === true;
  const safeCounts = Object.fromEntries(DIAGNOSTIC_COUNT_KEYS.map((key) => [key, Number.isFinite(Number(counts[key])) ? Number(counts[key]) : 0]));
  return {
    appVersion: String(appVersion),
    build: String(build),
    os: osInfo,
    configuration: {
      videiraConfigured: videira?.configured === true,
      holyricsConfigured: holyrics?.configured === true,
    },
    connections: {
      videira: videira?.connected === true,
      holyrics: holyrics?.connected === true,
    },
    holyrics: {
      connected,
      version: connected ? String(holyrics.version ?? "unknown") : null,
      plan: connected ? String(holyrics.plan ?? "unknown") : null,
    },
    counts: safeCounts,
    recentErrors: recentErrors
      .filter((item) => item && typeof item.code === "string")
      .slice(0, 20)
      .map((item) => ({ code: item.code, correlationId: typeof item.correlationId === "string" ? item.correlationId : null })),
  };
}
