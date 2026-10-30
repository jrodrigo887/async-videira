import type { CatalogSong } from "../types.ts";

/** Item de sistema do Holyrics ("Holyrics" / "Software & App"); nunca entra no catálogo nem na playlist alvo. */
export const SYSTEM_SONG_ID = "1611686353330";

interface RawSong {
  id?: string | number;
  title?: string | null;
  artist?: string | null;
}

/** Catálogo como o domínio o enxerga: sem item de sistema, só id/title/artist, tudo string. */
export function toCatalog(songs: readonly RawSong[]): CatalogSong[] {
  return songs
    .filter((song) => String(song?.id) !== SYSTEM_SONG_ID)
    .map((song) => ({ id: String(song.id), title: song.title ?? "", artist: song.artist ?? "" }));
}

/** Catálogo em ordem estável por id, para hash e fingerprint reproduzíveis. */
export function projectCatalog(songs: readonly RawSong[]): CatalogSong[] {
  return toCatalog(songs).sort((a, b) => a.id.localeCompare(b.id));
}
