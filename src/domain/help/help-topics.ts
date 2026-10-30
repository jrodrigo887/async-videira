import { helpTopicsByError } from "../shared/errors.ts";

export type HelpAudience = "operador" | "tecnico";

export interface HelpTopic {
  id: string;
  titulo: string;
  publico: HelpAudience;
  categoria: string | null;
  palavrasChave: string[];
  relacionados: string[];
  corpo: string;
}

interface ParsedTopic extends HelpTopic {
  _links: string[];
  _file: string;
}

type FrontMatter = Record<string, string | string[]>;

export interface HelpFile {
  file: string;
  text: string;
}

export interface HelpListItem {
  id: string;
  title: string;
  summary: string;
  keywords: string[];
  context: { publico: HelpAudience; categoria: string | null };
}

export interface HelpSearchHit {
  topicId: string;
  title: string;
  excerpt: string;
  score: number;
  rank: number;
  context: { publico: HelpAudience; categoria: string | null };
}

// Núcleo puro da Ajuda: interpreta e valida o conteúdo, lista, busca. Ler arquivos é com adapters/help-fs;
// no navegador o mesmo parser roda sobre `import.meta.glob`. Fonte única (antes havia 4 parsers).

const VALID_AUDIENCES: ReadonlySet<string> = new Set(["operador", "tecnico"]);
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const fileName = (file: unknown): string => String(file).split(/[\\/]/).pop() ?? "";

export class HelpContentError extends Error {
  errors: string[];

  constructor(errors: string[]) {
    super(`Invalid help content:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    this.name = "HelpContentError";
    this.errors = errors;
  }
}

export function normalizeHelpText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

function parseScalar(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseListValue(value: string, lines: string[], startIndex: number): { value: string | string[]; nextIndex: number } {
  const trimmed = value.trim();
  if (trimmed === "[]") return { value: [], nextIndex: startIndex };
  if (trimmed.startsWith("[")) {
    if (!trimmed.endsWith("]")) return { value: trimmed, nextIndex: startIndex };
    const content = trimmed.slice(1, -1).trim();
    return { value: content ? content.split(",").map(parseScalar) : [], nextIndex: startIndex };
  }
  if (trimmed) return { value: trimmed, nextIndex: startIndex };
  const result: string[] = [];
  let index = startIndex;
  while (index < lines.length && /^\s+-\s+/.test(lines[index])) {
    result.push(parseScalar(lines[index].replace(/^\s+-\s+/, "")));
    index += 1;
  }
  return { value: result, nextIndex: index };
}

function parseFrontMatter(text: string, file: string): { metadata: FrontMatter; body: string } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== "---") throw new Error(`${file}: missing opening --- front matter delimiter.`);
  const end = lines.indexOf("---", 1);
  if (end < 0) throw new Error(`${file}: missing closing --- front matter delimiter.`);
  const metadata: FrontMatter = {};
  const frontMatterLines = lines.slice(1, end);
  for (let index = 0; index < frontMatterLines.length;) {
    const line = frontMatterLines[index];
    if (!line.trim()) { index += 1; continue; }
    const match = line.match(/^([\w-]+):(?:\s*(.*))?$/);
    if (!match) throw new Error(`${file}: invalid front matter line ${index + 2}.`);
    const [, key, rawValue = ""] = match;
    if (Object.hasOwn(metadata, key)) throw new Error(`${file}: duplicate front matter field '${key}'.`);
    if (key === "palavras-chave" || key === "relacionados") {
      const parsed = parseListValue(rawValue, frontMatterLines, index + 1);
      metadata[key] = parsed.value;
      index = parsed.nextIndex;
    } else {
      metadata[key] = parseScalar(rawValue);
      index += 1;
    }
  }
  return { metadata, body: lines.slice(end + 1).join("\n").trim() };
}

function validateMarkdown(body: string, file: string): { errors: string[]; links: string[] } {
  const errors: string[] = [];
  const dangerous: Array<[RegExp, string]> = [
    [/<\s*\/?\s*(?:script|iframe)\b/i, "contains a forbidden script/iframe tag"],
    [/\bon\w+\s*=/i, "contains a forbidden inline event handler"],
    [/javascript\s*:/i, "contains a forbidden javascript: URL"],
  ];
  for (const [pattern, message] of dangerous) if (pattern.test(body)) errors.push(`${file}: ${message}.`);
  const links = [...body.matchAll(/\[[^\]]*\]\(topico:([^\s)]+)\)/g)].map((match) => match[1]!);
  const completeLinks = [...body.matchAll(/\[[^\]]*\]\(topico:[^)]*\)/g)].length;
  if (links.length !== completeLinks) errors.push(`${file}: malformed internal topico link.`);
  return { errors, links };
}

function makeTopic(metadata: FrontMatter, body: string, file: string): ParsedTopic {
  const errors: string[] = [];
  for (const key of ["id", "titulo", "publico", "palavras-chave", "relacionados"]) {
    if (!Object.hasOwn(metadata, key)) errors.push(`${file}: missing required field '${key}'.`);
  }
  const { id, titulo, publico, categoria } = metadata as Record<string, string | undefined>;
  if (id && !ID_PATTERN.test(id)) errors.push(`${file}: id must be a lowercase slug.`);
  if (!titulo?.trim()) errors.push(`${file}: titulo must not be empty.`);
  if (publico && !VALID_AUDIENCES.has(publico)) errors.push(`${file}: publico must be 'operador' or 'tecnico'.`);
  for (const field of ["palavras-chave", "relacionados"]) {
    if (Object.hasOwn(metadata, field) && !Array.isArray(metadata[field])) errors.push(`${file}: ${field} must be a YAML-style list or [].`);
  }
  if (categoria !== undefined && !categoria.trim()) errors.push(`${file}: categoria must not be empty when provided.`);
  const markdown = validateMarkdown(body, file);
  errors.push(...markdown.errors);
  if (errors.length) throw new HelpContentError(errors);
  return {
    id: id!,
    titulo: titulo!,
    publico: publico as HelpAudience,
    categoria: categoria || null,
    palavrasChave: metadata["palavras-chave"] as string[],
    relacionados: metadata.relacionados as string[],
    corpo: body,
    _links: markdown.links,
    _file: fileName(file),
  };
}

/**
 * Interpreta e valida um conjunto de arquivos `{ file, text }`. Falha com todos os erros de uma vez
 * (formato, ids duplicados, relacionados/links inexistentes e tópicos de erro do catálogo ausentes).
 */
export function parseHelpFiles(entries: readonly HelpFile[], { errorTopics = helpTopicsByError() }: { errorTopics?: Record<string, string> } = {}): HelpTopic[] {
  const topics: ParsedTopic[] = [];
  const errors: string[] = [];
  for (const { file, text } of entries) {
    try {
      const { metadata, body } = parseFrontMatter(text, file);
      topics.push(makeTopic(metadata, body, file));
    } catch (error) {
      if (error instanceof HelpContentError) errors.push(...error.errors);
      else errors.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const byId = new Map<string, string>();
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
    for (const [code, topicId] of Object.entries(errorTopics)) {
      if (!byId.has(topicId)) errors.push(`error catalog: '${code}' maps to missing help topic '${topicId}'.`);
    }
  }
  if (errors.length) throw new HelpContentError(errors);
  return topics.map(({ _links, _file, ...topic }) => topic);
}

export function buildHelpIndex(topics: readonly HelpTopic[]) {
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

function summaryFor(topic: HelpTopic): string {
  const firstParagraph = topic.corpo.split(/\n\s*\n/)[0] ?? "";
  const clean = firstParagraph.replace(/[#*_`>\[\]]/g, "").replace(/\s+/g, " ").trim();
  const sentenceEnd = clean.search(/[.!?](?:\s|$)/);
  const summary = sentenceEnd >= 0 ? clean.slice(0, sentenceEnd + 1) : clean;
  return summary.length > 220 ? `${summary.slice(0, 217).trimEnd()}…` : summary;
}

function excerptFor(topic: HelpTopic, normalizedQuery: string): string {
  const paragraphs = topic.corpo.split(/\n\s*\n/).map((text) => text.replace(/[#*_`>\[\]]/g, "").trim()).filter(Boolean);
  const found = paragraphs.find((paragraph) => normalizeHelpText(paragraph).includes(normalizedQuery));
  const excerpt = found ?? paragraphs[0] ?? topic.titulo;
  return excerpt.length > 180 ? `${excerpt.slice(0, 177).trimEnd()}…` : excerpt;
}

export function listTopics(topics: readonly HelpTopic[], { publico, categoria }: { publico?: string; categoria?: string } = {}): HelpListItem[] {
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

export function getTopic(topics: readonly HelpTopic[], id: string): { topicId: string; title: string; markdown: string } | null {
  const topic = topics.find((item) => item.id === id);
  return topic ? { topicId: topic.id, title: topic.titulo, markdown: topic.corpo } : null;
}

export function searchTopics(topics: readonly HelpTopic[], query: unknown, { limit = 20 }: { limit?: number } = {}): HelpSearchHit[] {
  const normalizedQuery = normalizeHelpText(query);
  if (!normalizedQuery) return [];
  const results: HelpSearchHit[] = [];
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
