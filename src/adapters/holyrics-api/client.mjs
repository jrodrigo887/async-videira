const SYSTEM_SONG_ID = "1611686353330";
const DEFAULT_READ_ATTEMPTS = 4;
const DEFAULT_READ_DELAY_MS = 300;

const idsOf = (items) => (items ?? []).map((entry) => String(entry?.id ?? entry));
const sameIds = (left, right) => left.length === right.length && left.every((id, index) => id === right[index]);
const uniqueIds = (ids) => [...new Set(ids.map((id) => String(id)))];

export class HolyricsApiError extends Error {
  constructor(message, { restored = false, restorationError = null } = {}) {
    super(message);
    this.name = "HolyricsApiError";
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
} = {}) {
  if (!token) throw new Error("HOLYRICS_TOKEN is required.");
  const base = baseUrl.replace(/\/+$/, "");

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

  return { ping, getCatalog, getPlaylist, getCurrentSchedule, applyOrder };
}
