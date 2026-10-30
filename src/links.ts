import { createContainer } from "./composition/container.ts";
import type { EditorSession } from "./application/use-cases/song-editor.ts";

// Fachada de compatibilidade: a lógica vive em src/application/use-cases/{song-links,song-editor}.ts.
// O Electron e os testes chamam estas funções com `env`; cada chamada monta o container a partir dele.
export interface LinkOptions {
  env: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  statePath?: string;
}

const app = ({ env, fetchImpl = fetch, statePath }: LinkOptions) => createContainer({ env, fetchImpl, ...(statePath === undefined ? {} : { statePath }) });

export const confirmSongLinks = ({ env, fetchImpl, statePath, confirmations, created }: LinkOptions & { confirmations: unknown; created?: ReadonlyMap<string, Iterable<string>> }) =>
  app({ env, fetchImpl, statePath }).confirmSongLinks({ confirmations, created });

export const removeSongLink = ({ env, fetchImpl, statePath, videiraSongId }: LinkOptions & { videiraSongId: string }) =>
  app({ env, fetchImpl, statePath }).removeSongLink({ videiraSongId });

export const openMissingEditor = ({ env, fetchImpl, statePath, videiraSongId, session }: LinkOptions & { videiraSongId: string; session: EditorSession }) =>
  app({ env, fetchImpl, statePath }).openSongEditor({ videiraSongId, session });

export const awaitMissingCreated = ({ env, fetchImpl, statePath, session }: LinkOptions & { session: EditorSession }) =>
  app({ env, fetchImpl, statePath }).awaitCreatedSong({ session });
