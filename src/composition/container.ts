import { createHolyricsClient } from "../adapters/holyrics-api/client.ts";
import { createStateRepository } from "../adapters/state-file/repository.ts";
import { createVideiraClient } from "../adapters/videira/client.ts";
import type { Clock, Deps, EventPublisher } from "../application/ports/index.ts";
import { applyWorship } from "../application/use-cases/apply-worship.ts";
import { recoverInterruptedApply } from "../application/use-cases/recover-interrupted-apply.ts";
import { prepareWorship } from "../application/use-cases/prepare-worship.ts";
import { awaitCreatedSong, openSongEditor } from "../application/use-cases/song-editor.ts";
import { confirmSongLinks, removeSongLink } from "../application/use-cases/song-links.ts";
import { coded } from "../domain/shared/errors.ts";
import { getDefaultStatePath, sha256 } from "../state/store.ts";

const systemClock: Clock = { now: () => new Date() };

export type Env = Record<string, string | undefined>;

export interface ContainerOptions {
  env?: Env;
  fetchImpl?: typeof fetch;
  statePath?: string;
  clock?: Clock;
  events?: EventPublisher;
}

function makeClients(env: Env, fetchImpl: typeof fetch) {
  if (!env.VIDEIRA_TOKEN) throw coded("AUTH_REQUIRED", "VIDEIRA_TOKEN is required.");
  if (!env.HOLYRICS_TOKEN) throw coded("AUTH_REQUIRED", "HOLYRICS_TOKEN is required.");
  return {
    videira: createVideiraClient({ baseUrl: env.VIDEIRA_API_BASE || "https://videiramusic.org", token: env.VIDEIRA_TOKEN, fetchImpl }),
    holyrics: createHolyricsClient({ baseUrl: env.HOLYRICS_URL || "http://127.0.0.1:8091", token: env.HOLYRICS_TOKEN, fetchImpl }),
  };
}

/**
 * Único lugar que lê `env`, escolhe adaptadores concretos e monta os use cases.
 * Os clientes são criados na primeira necessidade (credenciais ausentes só falham quando usadas),
 * então use cases que só leem o estado local continuam funcionando sem tokens.
 */
export function createContainer({ env = process.env, fetchImpl = fetch, statePath, clock = systemClock, events }: ContainerOptions = {}) {
  let clients: ReturnType<typeof makeClients> | undefined;
  const deps: Deps = {
    get videira() { return (clients ??= makeClients(env, fetchImpl)).videira; },
    get holyrics() { return (clients ??= makeClients(env, fetchImpl)).holyrics; },
    state: createStateRepository({ path: statePath ?? getDefaultStatePath(env), secrets: [env.VIDEIRA_TOKEN, env.HOLYRICS_TOKEN] }),
    clock,
    hash: sha256,
    events,
  };
  const bind = <I, O>(useCase: (deps: Deps, input: I) => Promise<O>) => (input: I) => useCase(deps, input);
  return {
    prepareWorship: (input?: Parameters<typeof prepareWorship>[1]) => prepareWorship(deps, input),
    applyWorship: (input?: Parameters<typeof applyWorship>[1]) => applyWorship(deps, input),
    confirmSongLinks: bind(confirmSongLinks),
    removeSongLink: bind(removeSongLink),
    recoverInterruptedApply: (input?: Parameters<typeof recoverInterruptedApply>[1]) => recoverInterruptedApply(deps, input),
    openSongEditor: bind(openSongEditor),
    awaitCreatedSong: bind(awaitCreatedSong),
  };
}
