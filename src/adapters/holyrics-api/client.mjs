const SYSTEM_SONG_ID = "1611686353330";
const DEFAULT_READ_ATTEMPTS = 4;
const DEFAULT_READ_DELAY_MS = 300;
export const NO_LYRICS_PLACEHOLDER = "[Letra não fornecida]";
const EDITOR_MIN_INTERVAL_MS = 2_000;
const EDITOR_TIMEOUT_MS = 3_000;

const idsOf = (items) => (items ?? []).map((entry) => String(entry?.id ?? entry));
const sameIds = (left, right) => left.length === right.length && left.every((id, index) => id === right[index]);
const uniqueIds = (ids) => [...new Set(ids.map((id) => String(id)))];

export class HolyricsApiError extends Error {
  constructor(message, { code = "HOLYRICS_REQUEST_FAILED", retryable = false, restored = false, restorationError = null } = {}) {
    super(message);
    this.name = "HolyricsApiError";
    this.code = code;
    this.retryable = retryable;
    this.restored = restored;
    this.restorationError = restorationError;
  }
}

export function createHolyricsClient({
  baseUrl = "http://127.0.0.1:8091",
  token,
  fetchImpl = fetch,
  readAttempts = DEFAULT_READ_ATTEMPTS,
  readDelayMs = DEFAULT_READ_DELAY_MS,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
} = {}) {
  if (!token) throw new Error("HOLYRICS_TOKEN is required.");
  const base = baseUrl.replace(/\/+$/, "");
  let nextEditorRequestAt = null;

  async function request(action, body = {}) {
    let response;
    try {
      response = await fetchImpl(`${base}/api/${action}?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new HolyricsApiError(`Holyrics did not respond to ${action}.`);
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new HolyricsApiError(`Holyrics ${action} returned invalid JSON (HTTP ${response.status}).`);
    }
    if (!response.ok || payload?.status !== "ok") {
      throw new HolyricsApiError(`Holyrics ${action} failed (HTTP ${response.status}).`);
    }
    return payload.data;
  }

  async function getPlaylist() {
    const data = await request("GetLyricsPlaylist");
    return Array.isArray(data) ? data : [];
  }

  async function readUntil(expectedIds) {
    let actual = [];
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

  async function restorePlaylist(backupIds) {
    await removeCurrentPlaylist();
    if (backupIds.length > 0) await request("AddLyricsToPlaylist", { ids: backupIds });
    const restored = await readUntil(backupIds);
    if (!sameIds(restored, backupIds)) throw new HolyricsApiError("Playlist restoration did not verify.");
  }

  async function ping() {
    const version = await request("GetVersion");
    const tokenInfo = await request("GetTokenInfo");
    const plan = await request("GetHolyricsPlanInfo");
    const apiServer = await request("GetAPIServerInfo");
    return { version, tokenInfo, plan, apiServer };
  }

  async function getCatalog() {
    const data = await request("GetSongs", { fields: "id,title,artist" });
    if (!Array.isArray(data)) throw new HolyricsApiError("Holyrics GetSongs returned an invalid catalog.");
    return data
      .filter((song) => String(song?.id) !== SYSTEM_SONG_ID)
      .map((song) => ({ id: String(song.id), title: song.title ?? "", artist: song.artist ?? "" }));
  }

  async function getCurrentSchedule() {
    const data = await request("GetCurrentSchedule");
    return Array.isArray(data) ? (data[0] ?? null) : data;
  }

  async function openSongEditor({ title, artist, lyrics } = {}) {
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
    let response;
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
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new HolyricsApiError("O Holyrics respondeu em formato inesperado ao abrir o editor.", { code: "EDITOR_FAILED" });
    }
    if (payload?.status !== "ok") {
      throw new HolyricsApiError("O Holyrics não confirmou a abertura do editor de músicas.", { code: "EDITOR_FAILED" });
    }
    return { opened: true };
  }

  async function awaitCreatedSong(previousCatalog, { title, artist } = {}) {
    const beforeIds = new Set((previousCatalog ?? []).map((song) => String(song.id)));
    const expectedTitle = normalizeSongText(title);
    const expectedArtist = normalizeSongText(artist);
    const currentCatalog = await getCatalog();
    const matches = currentCatalog.filter((song) =>
      !beforeIds.has(String(song.id)) &&
      normalizeSongText(song.title) === expectedTitle &&
      normalizeSongText(song.artist) === expectedArtist,
    );
    if (matches.length === 0) return { state: "not-found", song: null };
    if (matches.length > 1) return { state: "ambiguous", songs: matches };
    return { state: "created", song: matches[0] };
  }

  async function applyOrder(ids) {
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
    } catch {
      try {
        await restorePlaylist(backupIds);
      } catch {
        throw new HolyricsApiError("Playlist application failed and restoration could not be verified.", { restored: false });
      }
      throw new HolyricsApiError("Playlist application failed; the previous playlist was restored.", { restored: true });
    }
  }

  return { ping, getCatalog, getPlaylist, getCurrentSchedule, applyOrder, openSongEditor, awaitCreatedSong };
}

function normalizeSongText(value) {
  return typeof value === "string"
    ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim().replace(/\s+/g, " ")
    : "";
}
