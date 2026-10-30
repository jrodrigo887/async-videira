import { coded } from "../shared/errors.ts";
import type { CredentialTarget, Settings } from "../types.ts";

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  holyricsUrl: "http://127.0.0.1:8091",
  videiraApiBase: "https://videiramusic.org",
  firstRunDone: false,
});

export const VIDEIRA_HOSTS: ReadonlySet<string> = new Set(["videiramusic.org", "www.videiramusic.org"]);
const LOOPBACK: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "[::1]"]);

export interface EndpointOptions {
  /** Só para o smoke do app: permite o Videira falso em http://loopback. */
  allowLoopbackHttp?: boolean;
}

function parseUrl(value: unknown, code: string, message: string): URL {
  try { return new URL(String(value)); } catch { throw coded(code, message); }
}

/** O Holyrics só é falado em loopback e sem TLS (o servidor local não oferece). */
export function validateHolyricsUrl(value: unknown): void {
  const url = parseUrl(value, "INVALID_HOLYRICS_URL", "Endereço Holyrics inválido.");
  if (url.protocol !== "http:" || !LOOPBACK.has(url.hostname) || url.username || url.password) {
    throw coded("INVALID_HOLYRICS_URL", "Endereço Holyrics inválido.");
  }
}

/** O Videira só é falado por HTTPS nos hosts oficiais. */
export function validateVideiraUrl(value: unknown, { allowLoopbackHttp = false }: EndpointOptions = {}): void {
  const url = parseUrl(value, "INVALID_VIDEIRA_URL", "Endereço Videira inválido.");
  const fakeLoopback = allowLoopbackHttp && url.protocol === "http:" && LOOPBACK.has(url.hostname);
  if ((!fakeLoopback && (url.protocol !== "https:" || !VIDEIRA_HOSTS.has(url.hostname))) || url.username || url.password) {
    throw coded("INVALID_VIDEIRA_URL", "Endereço Videira inválido.");
  }
}

export function validateEndpoints(settings: Pick<Settings, "holyricsUrl" | "videiraApiBase">, options?: EndpointOptions): void {
  validateHolyricsUrl(settings.holyricsUrl);
  validateVideiraUrl(settings.videiraApiBase, options);
}

/** Links externos: HTTPS, host oficial, sem credenciais na URL. */
export function validateExternalUrl(value: unknown): string {
  let url: URL;
  try { url = new URL(String(value)); } catch { throw coded("EXTERNAL_LINK_BLOCKED", "Link externo bloqueado."); }
  if (url.protocol !== "https:" || !VIDEIRA_HOSTS.has(url.hostname) || url.username || url.password) {
    throw coded("EXTERNAL_LINK_BLOCKED", "Link externo bloqueado.");
  }
  return url.toString();
}

export const TARGETS: readonly CredentialTarget[] = ["holyrics", "videira"];
export const isCredentialTarget = (value: unknown): value is CredentialTarget => (TARGETS as readonly unknown[]).includes(value);
export const isValidToken = (value: unknown): value is string => typeof value === "string" && value.length >= 8 && value.length <= 512;
