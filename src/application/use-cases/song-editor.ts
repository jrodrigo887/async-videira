import type { CatalogSong } from "../../domain/types.ts";
import type { Deps } from "../ports/index.ts";
import { coded } from "../../domain/shared/errors.ts";
import { toHolyricsSlides } from "../../domain/lyrics/holyrics-slides.ts";
import { findPlanItem } from "../../domain/linking/song-matcher.ts";

/** Memória da sessão do operador: editor aberto e músicas que ele acabou de criar (candidatas a vínculo). */
export interface EditorSession {
  editor: { videiraSongId: string; title: string; artist: string; before: CatalogSong[] } | null;
  created: Map<string, Set<string>>;
}

export const createEditorSession = (): EditorSession => ({ editor: null, created: new Map() });

/** Lyrics are a convenience for the operator: any failure here falls back to the editor's placeholder, never blocks it. */
async function fetchLyrics(deps: Deps, videiraSongId: string): Promise<string | null> {
  try {
    const lyrics = await deps.videira.getSongLyrics(videiraSongId);
    return lyrics ? toHolyricsSlides(lyrics) || null : null;
  } catch {
    return null;
  }
}

/**
 * Opens the Holyrics "new song" editor for a song of the current preparation and remembers the catalog as it was before.
 * This is the only moment the full lyrics are requested from Videira, to prefill the editor.
 */
export async function openSongEditor(deps: Deps, { videiraSongId, session }: { videiraSongId: string; session: EditorSession }) {
  const state = await deps.state.load();
  const item = findPlanItem(state.prepared?.plan, videiraSongId);
  if (!item) throw coded("PREPARATION_EXPIRED", "Música fora da preparação atual.");
  const { holyrics } = deps;
  const before = await holyrics.getCatalog();
  const lyrics = await fetchLyrics(deps, String(videiraSongId));
  await holyrics.openSongEditor({ title: item.title, artist: item.artist ?? "", ...(lyrics ? { lyrics } : {}) });
  session.editor = { videiraSongId: String(videiraSongId), title: item.title, artist: item.artist ?? "", before };
  return { opened: true, lyricsFilled: lyrics !== null };
}

/**
 * Re-reads the catalog; a song created by the operator becomes an offered candidate, never a silent link.
 */
export async function awaitCreatedSong(deps: Deps, { session }: { session: EditorSession }) {
  const pending = session.editor;
  if (!pending) throw coded("INVALID_REQUEST", "Nenhum editor aberto.");
  const found = await deps.holyrics.awaitCreatedSong(pending.before, { title: pending.title, artist: pending.artist });
  const songs = found.state === "created" ? [found.song] : found.state === "ambiguous" ? found.songs : [];
  if (songs.length) session.created.set(pending.videiraSongId, new Set(songs.map((song) => String(song.id))));
  return { state: found.state, songs };
}
