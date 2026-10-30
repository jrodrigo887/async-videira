// Fachada de compatibilidade da Ajuda. A lógica vive em src/domain/help (parser, busca) e
// src/adapters/help-fs (leitura de arquivos); o mapa erro → tópico vem do catálogo em domain/shared/errors.ts.
import { loadHelpTopics } from "../../adapters/help-fs/loader.ts";
import type { HelpTopic } from "../../domain/help/help-topics.ts";
import { getTopic, listTopics, searchTopics } from "../../domain/help/help-topics.ts";

export { HelpContentError, buildHelpIndex, normalizeHelpText } from "../../domain/help/help-topics.ts";
export { helpTopicForError } from "../../domain/shared/errors.ts";
export { loadHelpTopics };

let defaultTopicsPromise: Promise<HelpTopic[]> | undefined;
const defaultTopics = () => (defaultTopicsPromise ??= loadHelpTopics());

export async function listHelpTopics(filters?: { publico?: string; categoria?: string }, topics?: readonly HelpTopic[]) {
  return listTopics(topics ?? await defaultTopics(), filters);
}

export async function getHelpTopic(id: string, topics?: readonly HelpTopic[]) {
  return getTopic(topics ?? await defaultTopics(), id);
}

export async function searchHelp(query: unknown, options?: { limit?: number }, topics?: readonly HelpTopic[]) {
  return searchTopics(topics ?? await defaultTopics(), query, options);
}

const DIAGNOSTIC_COUNT_KEYS = ["helpTopics", "operatorTopics", "technicalTopics", "holyricsSongs", "setlistSongs"];

/** Entrada de coletores externos: campos extras (tokens, caminhos) são esperados e nunca saem daqui. */
interface ConnectionInfo { configured?: boolean; connected?: boolean; version?: unknown; plan?: unknown; [key: string]: unknown }

export interface DiagnosticInput {
  appVersion?: unknown;
  build?: unknown;
  os?: string | { platform?: unknown; release?: unknown; arch?: unknown; [key: string]: unknown };
  holyrics?: ConnectionInfo | null;
  videira?: ConnectionInfo | null;
  counts?: Partial<Record<string, unknown>>;
  recentErrors?: Array<{ code?: unknown; correlationId?: unknown; [key: string]: unknown } | null>;
}

export function appDiagnosticInfo({ appVersion = "unknown", build = "unknown", os = process.platform, holyrics = null, videira = null, counts = {}, recentErrors = [] }: DiagnosticInput = {}) {
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
      version: connected ? String(holyrics?.version ?? "unknown") : null,
      plan: connected ? String(holyrics?.plan ?? "unknown") : null,
    },
    counts: safeCounts,
    recentErrors: recentErrors
      .filter((item): item is { code: string; correlationId?: unknown } => typeof item?.code === "string")
      .slice(0, 20)
      .map((item) => ({ code: item.code, correlationId: typeof item.correlationId === "string" ? item.correlationId : null })),
  };
}
