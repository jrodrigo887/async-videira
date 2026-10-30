import { projectCatalog } from "../catalog/holyrics-catalog.ts";
import type { CatalogSong, Hash, HolyricsPing, LibraryFingerprint } from "../types.ts";

/** `hash` é injetado (o domínio não importa node:crypto). */
export function createLibraryFingerprint(ping: HolyricsPing, catalog: readonly CatalogSong[], hash: Hash): LibraryFingerprint {
  const version = ping.version ?? {};
  const server = ping.apiServer ?? {};
  const ipList = version.ip_list ?? server.ip_list ?? [];
  return {
    baseDir: version.baseDir ?? null,
    platform: version.platform ?? null,
    ip_list: Array.isArray(ipList) ? [...ipList].map(String).sort() : String(ipList),
    idsHash: hash(projectCatalog(catalog).map((song) => song.id).sort()),
  };
}

/** Outra pasta de instalação ou plataforma indica outro computador/biblioteca; mudar só o conjunto de IDs é normal. */
export function libraryMoved(before: LibraryFingerprint | null, current: LibraryFingerprint): boolean {
  return before !== null && (before.baseDir !== current.baseDir || before.platform !== current.platform);
}
