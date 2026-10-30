import { coded } from "../../domain/shared/errors.ts";
import type { RawSetlistDetail } from "../../domain/setlist/setlist.ts";
import type { LinkRequest, LinkResult, PublishedSetlistSummary, WireReport } from "../../application/ports/index.ts";

/** `code` é o do catálogo interno (derivado do HTTP); `apiCode` é o código que o servidor mandou no corpo. */
export class VideiraApiError extends Error {
  status: number | undefined;
  apiCode: string | undefined;
  code: string | undefined;

  constructor(message: string, { status, code, unreachable = false }: { status?: number | undefined; code?: string | undefined; unreachable?: boolean } = {}) {
    super(message);
    this.name = "VideiraApiError";
    this.status = status;
    this.apiCode = code;
    // 404 sem código no corpo: a rota não existe neste servidor (versão antiga), diferente de "setlist/vínculo não encontrado".
    this.code = unreachable ? "SERVICE_UNAVAILABLE" : status === 401 ? "AUTH_REJECTED" : status !== undefined && status >= 500 ? "SERVICE_UNAVAILABLE" : status === 404 && !code ? "VIDEIRA_ENDPOINT_MISSING" : undefined;
  }
}

export interface VideiraClientOptions {
  baseUrl?: string;
  token?: string | undefined;
  fetchImpl?: typeof fetch;
}

export function createVideiraClient({ baseUrl = "https://videiramusic.org", token, fetchImpl = fetch }: VideiraClientOptions = {}) {
  if (!token) throw coded("AUTH_REQUIRED", "VIDEIRA_TOKEN is required.");
  const base = baseUrl.replace(/\/+$/, "");
  const root = "/api/integrations/holyrics";

  async function request<T = unknown>(path: string, { method = "GET", body }: { method?: string; body?: unknown } = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new VideiraApiError("Videira API did not respond.", { unreachable: true });
    }
    let payload = null as { error?: { code?: unknown } } | null;
    try {
      payload = await response.json() as typeof payload;
    } catch {
      if (!response.ok) payload = null;
    }
    if (!response.ok) {
      const code = typeof payload?.error?.code === "string" ? payload.error.code : undefined;
      throw new VideiraApiError(`Videira API request failed (HTTP ${response.status}).`, { status: response.status, code });
    }
    return payload as T;
  }

  async function listPublishedSetlists({ date }: { date?: string } = {}): Promise<{ setlists: PublishedSetlistSummary[] }> {
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    let result: { setlists?: PublishedSetlistSummary[] } | null;
    try {
      result = await request(`${root}/setlists${query}`);
    } catch (error) {
      // The server answers 404 SETLISTS_NOT_FOUND when nothing is published from today on.
      if (error instanceof VideiraApiError && error.status === 404 && error.apiCode === "SETLISTS_NOT_FOUND") return { setlists: [] };
      throw error;
    }
    if (!result || !Array.isArray(result.setlists)) throw new VideiraApiError("Videira returned an invalid published setlist list.");
    return { ...result, setlists: result.setlists };
  }

  async function getPublishedSetlist(setlistId: string | number): Promise<RawSetlistDetail> {
    if (!setlistId) throw new Error("A setlist ID is required.");
    return request<RawSetlistDetail>(`${root}/setlists/${encodeURIComponent(setlistId)}`);
  }

  async function sendSyncReport(report: WireReport) {
    return request(`${root}/sync-reports`, { method: "POST", body: report });
  }

  async function confirmSongLinks(items: LinkRequest[]): Promise<LinkResult[]> {
    if (!Array.isArray(items) || items.length < 1 || items.length > 200) throw new Error("A link batch needs 1 to 200 items.");
    const result = await request<{ results?: LinkResult[] } | null>(`${root}/song-links/batch`, { method: "POST", body: { items } });
    if (!result || !Array.isArray(result.results)) throw new VideiraApiError("Videira returned an invalid link batch result.");
    return result.results;
  }

  /** Removes the Holyrics link of a Videira song. A link that is already gone counts as removed. */
  async function removeSongLink(songId: string): Promise<{ removed: boolean }> {
    if (!songId) throw new Error("A song ID is required.");
    try {
      await request(`${root}/song-links/${encodeURIComponent(songId)}`, { method: "DELETE" });
    } catch (error) {
      if (error instanceof VideiraApiError && error.status === 404 && error.apiCode === "LINK_NOT_FOUND") return { removed: false };
      throw error;
    }
    return { removed: true };
  }

  /** Full lyrics of a Videira song, or null when the song has none (only used to prefill the Holyrics editor). */
  async function getSongLyrics(songId: string): Promise<string | null> {
    if (!songId) throw new Error("A song ID is required.");
    let result: { lyrics?: unknown } | null;
    try {
      result = await request<{ lyrics?: unknown } | null>(`${root}/songs/${encodeURIComponent(songId)}/lyrics`);
    } catch (error) {
      if (error instanceof VideiraApiError && error.status === 404 && (error.apiCode === "LYRICS_NOT_FOUND" || error.apiCode === "SONG_NOT_FOUND")) return null;
      throw error;
    }
    if (typeof result?.lyrics !== "string") throw new VideiraApiError("Videira returned invalid lyrics.");
    return result.lyrics.trim() ? result.lyrics : null;
  }

  return { listPublishedSetlists, getPublishedSetlist, sendSyncReport, confirmSongLinks, removeSongLink, getSongLyrics };
}

export type VideiraClient = ReturnType<typeof createVideiraClient>;
