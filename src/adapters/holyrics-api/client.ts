import { coded } from "../../domain/shared/errors.ts";
import { toCatalog } from "../../domain/catalog/holyrics-catalog.ts";
import { idsOf, sameSequence as sameIds, uniqueIds } from "../../domain/shared/ids.ts";
import { normalizeText } from "../../domain/shared/text.ts";
import type { CatalogSong, HolyricsPing, HolyricsSchedule } from "../../domain/types.ts";
import type { CreatedSongResult } from "../../application/ports/index.ts";

const DEFAULT_READ_ATTEMPTS = 4;
const DEFAULT_READ_DELAY_MS = 300;
export const NO_LYRICS_PLACEHOLDER = "[Letra não fornecida]";
const EDITOR_MIN_INTERVAL_MS = 2_000;
const EDITOR_TIMEOUT_MS = 3_000;

export interface HolyricsErrorOptions {
  code?: string | undefined;
  retryable?: boolean;
  restored?: boolean;
  restorationError?: string | null;
  causeCode?: string | null;
}

const causeCodeOf = (error: unknown): string | null => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
};

export class HolyricsApiError extends Error {
  code: string;
  retryable: boolean;
  restored: boolean;
  restorationError: string | null;
  causeCode: string | null;

  constructor(message: string, { code = "HOLYRICS_REQUEST_FAILED", retryable = false, restored = false, restorationError = null, causeCode = null }: HolyricsErrorOptions = {}) {
    super(message);
    this.name = "HolyricsApiError";
    this.code = code;
    this.retryable = retryable;
    this.restored = restored;
    this.restorationError = restorationError;
    this.causeCode = causeCode;
  }
}

export interface HolyricsClientOptions {
  baseUrl?: string;
  token?: string | undefined;
  fetchImpl?: typeof fetch;
  readAttempts?: number;
  readDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

type PlaylistEntry = { id?: string | number } | string | number;

export function createHolyricsClient({
  baseUrl = "http://127.0.0.1:8091",
  token,
  fetchImpl = fetch,
  readAttempts = DEFAULT_READ_ATTEMPTS,
  readDelayMs = DEFAULT_READ_DELAY_MS,
  sleep = (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
}: HolyricsClientOptions = {}) {
  if (!token) throw coded("AUTH_REQUIRED", "HOLYRICS_TOKEN is required.");
  const authToken: string = token;
  const base = baseUrl.replace(/\/+$/, "");
  let nextEditorRequestAt: number | null = null;

  async function request<T = unknown>(action: string, body: unknown = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(`${base}/api/${action}?token=${encodeURIComponent(authToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new HolyricsApiError(`O Holyrics não respondeu à chamada ${action}.`, { code: "HOLYRICS_NOT_RUNNING", retryable: true });
    }
    let payload: { status?: unknown; data?: unknown } | null;
    try {
      payload = await response.json() as typeof payload;
    } catch {
      throw new HolyricsApiError(`Holyrics ${action} returned invalid JSON (HTTP ${response.status}).`);
    }
    if (!response.ok || payload?.status !== "ok") {
      // 401 e 5xx têm significado próprio para a UI; o resto fica com o código genérico.
      const code = response.status === 401 ? "AUTH_REJECTED" : response.status >= 500 ? "SERVICE_UNAVAILABLE" : undefined;
      throw new HolyricsApiError(`Holyrics ${action} failed (HTTP ${response.status}).`, { code });
    }
    return payload?.data as T;
  }

  async function getPlaylist(): Promise<PlaylistEntry[]> {
    const data = await request("GetLyricsPlaylist");
    return Array.isArray(data) ? data as PlaylistEntry[] : [];
  }

  async function readUntil(expectedIds: string[]) {
    let actual: string[] = [];
    for (let attempt = 0; attempt < readAttempts; attempt += 1) {
      actual = idsOf(await getPlaylist());
      if (sameIds(actual, expectedIds)) return actual;
      if (attempt + 1 < readAttempts) await sleep(readDelayMs);
    }
    return actual;
  }

  async function removeCurrentPlaylist() {
    const current = await getPlaylist();
    if (current.length > 0) {
      await request("RemoveFromLyricsPlaylist", { indexes: current.map((_, index) => index) });
    }
  }

  async function restorePlaylist(backupIds: string[]) {
    await removeCurrentPlaylist();
    if (backupIds.length > 0) await request("AddLyricsToPlaylist", { ids: backupIds });
    const restored = await readUntil(backupIds);
    if (!sameIds(restored, backupIds)) throw new HolyricsApiError("Playlist restoration did not verify.");
  }

  async function ping(): Promise<HolyricsPing> {
    const version = await request<HolyricsPing["version"]>("GetVersion");
    const tokenInfo = await request("GetTokenInfo");
    const plan = await request<HolyricsPing["plan"]>("GetHolyricsPlanInfo");
    const apiServer = await request<HolyricsPing["apiServer"]>("GetAPIServerInfo");
    return { version, tokenInfo, plan, apiServer };
  }

  async function getCatalog(): Promise<CatalogSong[]> {
    const data = await request("GetSongs", { fields: "id,title,artist" });
    if (!Array.isArray(data)) throw new HolyricsApiError("Holyrics GetSongs returned an invalid catalog.");
    return toCatalog(data);
  }

  async function getCurrentSchedule(): Promise<HolyricsSchedule | null> {
    const data = await request<HolyricsSchedule | HolyricsSchedule[] | null>("GetCurrentSchedule");
    return Array.isArray(data) ? (data[0] ?? null) : data;
  }

  async function openSongEditor({ title, artist, lyrics }: { title?: unknown; artist?: unknown; lyrics?: unknown } = {}): Promise<{ opened: true }> {
    const url = new URL(base);
    if (!["127.0.0.1", "localhost", "[::1]", "::1"].includes(url.hostname.toLowerCase())) {
      throw new HolyricsApiError("O editor de músicas só pode ser aberto pela conexão local do Holyrics.", { code: "EDITOR_FAILED" });
    }
    if (typeof title !== "string" || !title.trim() || typeof artist !== "string" || !artist.trim()) {
      throw new HolyricsApiError("Informe o título e o artista para abrir o editor do Holyrics.", { code: "EDITOR_FAILED" });
    }
    const currentTime = now();
    const requestAt = Math.max(currentTime, nextEditorRequestAt ?? currentTime);
    nextEditorRequestAt = requestAt + EDITOR_MIN_INTERVAL_MS;
    if (requestAt > currentTime) await sleep(requestAt - currentTime);
    let response: Response;
    try {
      response = await fetchImpl(`${base}/api/popup-createsong`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          artist,
          lyrics: typeof lyrics === "string" && lyrics.trim() ? lyrics : NO_LYRICS_PLACEHOLDER,
        }),
        signal: AbortSignal.timeout(EDITOR_TIMEOUT_MS),
      });
    } catch {
      throw new HolyricsApiError("Não foi possível conectar ao editor de músicas do Holyrics.", { code: "EDITOR_FAILED", retryable: true });
    }
    if (response.status === 404) {
      throw new HolyricsApiError("Esta versão do Holyrics não oferece o editor de músicas por API.", { code: "EDITOR_UNSUPPORTED" });
    }
    if (response.status === 409) {
      throw new HolyricsApiError("O editor de músicas do Holyrics já está aberto. Feche-o antes de tentar novamente.", { code: "EDITOR_ALREADY_OPEN" });
    }
    if (response.status === 403) {
      throw new HolyricsApiError("O Holyrics recusou a abertura do editor de músicas.", { code: "EDITOR_FAILED" });
    }
    if (response.status === 400) {
      throw new HolyricsApiError("O Holyrics não aceitou os dados para abrir o editor de músicas.", { code: "EDITOR_FAILED" });
    }
    if (!response.ok) {
      throw new HolyricsApiError(`Falha ao abrir o editor de músicas do Holyrics (HTTP ${response.status}).`, { code: "EDITOR_FAILED", retryable: response.status >= 500 });
    }
    let payload: { status?: unknown } | null;
    try {
      payload = await response.json() as typeof payload;
    } catch {
      throw new HolyricsApiError("O Holyrics respondeu em formato inesperado ao abrir o editor.", { code: "EDITOR_FAILED" });
    }
    if (payload?.status !== "ok") {
      throw new HolyricsApiError("O Holyrics não confirmou a abertura do editor de músicas.", { code: "EDITOR_FAILED" });
    }
    return { opened: true };
  }

  async function awaitCreatedSong(previousCatalog: readonly CatalogSong[] | null | undefined, { title, artist }: { title?: unknown; artist?: unknown } = {}): Promise<CreatedSongResult> {
    const beforeIds = new Set((previousCatalog ?? []).map((song) => String(song.id)));
    const expectedTitle = normalizeText(title);
    const expectedArtist = normalizeText(artist);
    const currentCatalog = await getCatalog();
    const matches = currentCatalog.filter((song) =>
      !beforeIds.has(String(song.id)) &&
      normalizeText(song.title) === expectedTitle &&
      normalizeText(song.artist) === expectedArtist,
    );
    if (matches.length === 0) return { state: "not-found", song: null };
    if (matches.length > 1) return { state: "ambiguous", songs: matches };
    return { state: "created", song: matches[0]! };
  }

  async function applyOrder(ids: readonly unknown[]) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new HolyricsApiError("Refusing to replace the playlist with an empty target.");
    }
    const targetIds = uniqueIds(ids);
    if (targetIds.some((id) => !id || id === "undefined" || id === "null")) {
      throw new HolyricsApiError("Cannot apply an empty or invalid Holyrics song ID.");
    }
    const backupIds = idsOf(await getPlaylist());
    if (sameIds(backupIds, targetIds)) {
      return { applied: false, verified: true, ids: targetIds, duplicates: ids.length - targetIds.length };
    }

    try {
      if (backupIds.length > 0) {
        await request("RemoveFromLyricsPlaylist", { indexes: backupIds.map((_, index) => index) });
      }
      if (targetIds.length > 0) await request("AddLyricsToPlaylist", { ids: targetIds });
      const actualIds = await readUntil(targetIds);
      if (!sameIds(actualIds, targetIds)) throw new HolyricsApiError("Playlist did not match the requested order after reread.");
      return { applied: true, verified: true, ids: targetIds, duplicates: ids.length - targetIds.length };
    } catch (error) {
      try {
        await restorePlaylist(backupIds);
      } catch (restoreError) {
        throw new HolyricsApiError("A publicação falhou e não foi possível confirmar a restauração da playlist anterior. Confira o Holyrics antes de tentar novamente.", {
          code: "RESTORE_FAILED",
          restored: false,
          causeCode: causeCodeOf(error),
          restorationError: causeCodeOf(restoreError) ?? "RESTORE_FAILED",
        });
      }
      throw new HolyricsApiError("Não foi possível publicar a playlist. A playlist anterior foi restaurada e verificada.", {
        code: "APPLY_FAILED",
        restored: true,
        causeCode: causeCodeOf(error),
      });
    }
  }

  return { ping, getCatalog, getPlaylist, getCurrentSchedule, applyOrder, openSongEditor, awaitCreatedSong };
}

export type HolyricsClient = ReturnType<typeof createHolyricsClient>;
