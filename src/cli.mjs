#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { executeSync, planSync } from "./core/sync-plan.mjs";
import { createHolyricsClient } from "./adapters/holyrics-api/client.mjs";
import { createVideiraClient } from "./adapters/videira/client.mjs";
import { getDefaultStatePath, readState, sha256, writeState } from "./state/store.mjs";

const SYSTEM_SONG_ID = "1611686353330";

function makeClients(env, fetchImpl) {
  if (!env.VIDEIRA_TOKEN) throw new Error("VIDEIRA_TOKEN is required.");
  if (!env.HOLYRICS_TOKEN) throw new Error("HOLYRICS_TOKEN is required.");
  return {
    videira: createVideiraClient({
      baseUrl: env.VIDEIRA_API_BASE || "https://videiramusic.org",
      token: env.VIDEIRA_TOKEN,
      fetchImpl,
    }),
    holyrics: createHolyricsClient({
      baseUrl: env.HOLYRICS_URL || "http://127.0.0.1:8091",
      token: env.HOLYRICS_TOKEN,
      fetchImpl,
    }),
  };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  let yes = false;
  let date;
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (value === "--yes") yes = true;
    else if (value === "--date" && rest[index + 1]) date = rest[++index];
    else if (value.startsWith("--date=")) date = value.slice("--date=".length);
    else throw new Error("Unknown CLI argument.");
  }
  if (command === "preparar" && yes) throw new Error("--yes is only valid with aplicar.");
  if (command === "aplicar" && !yes) throw new Error("aplicar requires --yes.");
  if (!new Set(["preparar", "aplicar"]).has(command)) {
    throw new Error("Usage: node src/cli.mjs preparar [--date YYYY-MM-DD] | aplicar --yes");
  }
  return { command, yes, date };
}

function projectSetlist(detail) {
  return {
    setlistId: String(detail.setlistId ?? detail.id ?? ""),
    title: detail.title ?? "",
    eventAt: detail.eventAt ?? null,
    items: (detail.items ?? []).map((item) => ({
      position: Number(item.position ?? 0),
      songId: item.songId == null ? null : String(item.songId),
      title: item.title ?? "",
      artist: item.artist ?? "",
      externalId: item.externalId == null ? null : String(item.externalId),
    })),
  };
}

function projectCatalog(catalog) {
  return catalog
    .filter((song) => String(song.id) !== SYSTEM_SONG_ID)
    .map((song) => ({ id: String(song.id), title: song.title ?? "", artist: song.artist ?? "" }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function createLibraryFingerprint(ping, catalog) {
  const version = ping.version ?? {};
  const server = ping.apiServer ?? {};
  const ipList = version.ip_list ?? server.ip_list ?? [];
  return {
    baseDir: version.baseDir ?? null,
    platform: version.platform ?? null,
    ip_list: Array.isArray(ipList) ? [...ipList].map(String).sort() : String(ipList),
    idsHash: sha256(projectCatalog(catalog).map((song) => song.id).sort()),
  };
}

function scheduleIdentity(schedule) {
  return {
    type: schedule?.type ?? null,
    name: schedule?.name ?? null,
    datetime: schedule?.datetime ?? null,
    eventId: schedule?.metadata?.event?.id == null ? null : String(schedule.metadata.event.id),
  };
}

function selectSetlist(setlists, preferredId) {
  if (preferredId) return setlists.find((item) => String(item.id) === String(preferredId)) ?? null;
  return setlists[0] ?? null;
}

function showPlan(plan, stdout) {
  for (const [index, item] of plan.itemResults.entries()) {
    const label = `${String(index + 1).padStart(2, "0")}. [${item.status}] ${item.title}${item.artist ? ` — ${item.artist}` : ""}`;
    if (item.status === "resolved") stdout.write(`${label} (Holyrics ${item.holyricsId}; ${item.matchedBy})\n`);
    else if (item.suggestions?.length) {
      stdout.write(`${label}; sugestão para revisão: ${item.suggestions.map((candidate) => `${candidate.title} — ${candidate.artist ?? "(sem artista)"} [${candidate.id}]`).join(" | ")}\n`);
    } else if (item.candidates?.length) stdout.write(`${label}; candidatos: ${item.candidates.join(", ")}\n`);
    else stdout.write(`${label}\n`);
  }
}

function catalogContentHash(catalog) {
  return sha256(projectCatalog(catalog));
}

async function saveLocalState(statePath, state, env) {
  const serialized = JSON.stringify(state);
  const configuredSecrets = [env.VIDEIRA_TOKEN, env.HOLYRICS_TOKEN].filter(Boolean);
  if (configuredSecrets.some((secret) => serialized.includes(secret))) {
    throw new Error("Local state cannot contain configured credentials.");
  }
  return writeState(statePath, state);
}

function setlistContentHash(detail) {
  return sha256(projectSetlist(detail));
}

async function prepare({ env, fetchImpl, statePath, stdout, date }) {
  const { videira, holyrics } = makeClients(env, fetchImpl);
  const listed = await videira.listPublishedSetlists({ date: date || undefined });
  const chosen = selectSetlist(listed.setlists, env.SETLIST_ID);
  if (!chosen) throw new Error(env.SETLIST_ID ? "SETLIST_ID is not among the published setlists." : "No published setlist is available.");
  const detail = await videira.getPublishedSetlist(chosen.id);
  const ping = await holyrics.ping();
  const catalog = await holyrics.getCatalog();
  const schedule = await holyrics.getCurrentSchedule();
  const currentPlaylist = await holyrics.getPlaylist();
  const setlist = projectSetlist(detail);
  if (setlist.items.length === 0) throw new Error("The selected published setlist contains no song items.");
  const normalizedCatalog = projectCatalog(catalog);
  const currentIds = currentPlaylist.map((item) => String(item.id ?? item));
  const plan = planSync({ items: setlist.items, catalog: normalizedCatalog, currentIds });
  const fingerprint = createLibraryFingerprint(ping, normalizedCatalog);
  const scheduleKey = scheduleIdentity(schedule);
  const prepared = {
    setlistId: setlist.setlistId || String(chosen.id),
    title: setlist.title,
    preparedAt: new Date().toISOString(),
    setlistHash: setlistContentHash(setlist),
    catalogHash: catalogContentHash(normalizedCatalog),
    libraryFingerprint: fingerprint,
    schedule: scheduleKey,
    plan,
  };
  const previous = await readState(statePath);
  await saveLocalState(statePath, {
    ...previous,
    cache: {
      catalog: { items: normalizedCatalog, fingerprint, readAt: new Date().toISOString() },
      setlist: { value: setlist, fetchedAt: new Date().toISOString() },
    },
    prepared,
    migration: { ...previous.migration, previousFingerprint: fingerprint },
  }, env);

  stdout.write(`Preparação: ${setlist.title} (${prepared.setlistId})\n`);
  stdout.write(`Destino selecionado: ${scheduleKey.name ?? scheduleKey.type ?? "desconhecido"}\n`);
  showPlan(plan, stdout);
  stdout.write(`Dry-run concluído: ${plan.targetIds.length} ID(s) resolvido(s), ${plan.hasRepeated ? "há repetidos" : "sem repetidos"}; nenhuma escrita feita.\n`);
  if (ping.plan?.type && ping.plan.type !== "none") stdout.write("Aviso: o Holyrics informou plano ativo; este fluxo usa somente a playlist selecionada.\n");
  return 0;
}

async function applyPrepared({ env, fetchImpl, statePath, stdout }) {
  const state = await readState(statePath);
  const prepared = state.prepared;
  if (!prepared) throw new Error("Nenhuma preparação válida encontrada; execute preparar primeiro.");
  if (env.SETLIST_ID && String(env.SETLIST_ID) !== String(prepared.setlistId)) {
    throw new Error("SETLIST_ID differs from the prepared setlist; execute preparar again.");
  }

  const { videira, holyrics } = makeClients(env, fetchImpl);
  const listed = await videira.listPublishedSetlists();
  const chosen = selectSetlist(listed.setlists, prepared.setlistId);
  if (!chosen) throw new Error("The prepared setlist is no longer published; execute preparar again.");
  const detail = await videira.getPublishedSetlist(prepared.setlistId);
  const ping = await holyrics.ping();
  const catalog = await holyrics.getCatalog();
  const schedule = await holyrics.getCurrentSchedule();
  const setlist = projectSetlist(detail);
  const normalizedCatalog = projectCatalog(catalog);
  const fingerprint = createLibraryFingerprint(ping, normalizedCatalog);
  if (
    setlistContentHash(setlist) !== prepared.setlistHash ||
    catalogContentHash(normalizedCatalog) !== prepared.catalogHash ||
    sha256(fingerprint) !== sha256(prepared.libraryFingerprint) ||
    sha256(scheduleIdentity(schedule)) !== sha256(prepared.schedule)
  ) {
    throw new Error("Videira data, Holyrics catalog, library or selected schedule changed since preparar; prepare again.");
  }

  const result = await executeSync({ items: setlist.items, catalog: normalizedCatalog, adapter: holyrics });
  const report = {
    setlistId: prepared.setlistId,
    status: result.status,
    holyricsVersion: String(ping.version?.version ?? "unknown"),
    items: result.reportItems,
    libraryFingerprint: fingerprint,
  };
  let reportQueued = false;
  try {
    await videira.sendSyncReport(report);
  } catch {
    state.pendingReports.push({ report, queuedAt: new Date().toISOString() });
    reportQueued = true;
  }
  await saveLocalState(statePath, {
    ...state,
    prepared: null,
    pendingReports: state.pendingReports,
    migration: { ...state.migration, previousFingerprint: fingerprint, status: "observed" },
    lastRun: { setlistId: prepared.setlistId, status: result.status, verified: result.verified, finishedAt: new Date().toISOString() },
  }, env);
  stdout.write(`Aplicação: ${prepared.title} — ${result.status}${result.verified ? " (releitura confirmada)" : " (não verificada)"}\n`);
  for (const [index, item] of result.reportItems.entries()) stdout.write(`${String(index + 1).padStart(2, "0")}. ${item.outcome}\n`);
  if (reportQueued) stdout.write("sync-report não enviado; enfileirado no estado local.\n");
  return result.status === "FAILED" ? 1 : 0;
}

export async function runCli(argv = process.argv.slice(2), options = {}) {
  const env = options.env ?? process.env;
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const parsed = parseArgs(argv);
    const statePath = options.statePath ?? getDefaultStatePath(env);
    if (parsed.command === "preparar") return await prepare({ env, fetchImpl, statePath, stdout, date: parsed.date });
    return await applyPrepared({ env, fetchImpl, statePath, stdout });
  } catch (error) {
    stderr.write(`Erro: ${error instanceof Error ? error.message : "command failed"}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await runCli();
}
