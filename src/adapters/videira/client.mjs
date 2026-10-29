export class VideiraApiError extends Error {
  constructor(message) {
    super(message);
    this.name = "VideiraApiError";
  }
}

export function createVideiraClient({ baseUrl = "https://videiramusic.org", token, fetchImpl = fetch } = {}) {
  if (!token) throw new Error("VIDEIRA_TOKEN is required.");
  const base = baseUrl.replace(/\/+$/, "");
  const root = "/api/integrations/holyrics";

  async function request(path, { method = "GET", body } = {}) {
    let response;
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
      throw new VideiraApiError("Videira API did not respond.");
    }
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      if (!response.ok) payload = null;
    }
    if (!response.ok) throw new VideiraApiError(`Videira API request failed (HTTP ${response.status}).`);
    return payload;
  }

  async function listPublishedSetlists({ date } = {}) {
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    const result = await request(`${root}/setlists${query}`);
    if (!result || !Array.isArray(result.setlists)) throw new VideiraApiError("Videira returned an invalid published setlist list.");
    return result;
  }

  async function getPublishedSetlist(setlistId) {
    if (!setlistId) throw new Error("A setlist ID is required.");
    return request(`${root}/setlists/${encodeURIComponent(setlistId)}`);
  }

  async function sendSyncReport(report) {
    return request(`${root}/sync-reports`, { method: "POST", body: report });
  }

  return { listPublishedSetlists, getPublishedSetlist, sendSyncReport };
}
