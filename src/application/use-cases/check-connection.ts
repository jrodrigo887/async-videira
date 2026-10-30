import { coded } from "../../domain/shared/errors.ts";
import type { ConnectionDeps } from "../ports/index.ts";
import type { CredentialTarget } from "../../domain/types.ts";
import { isValidToken, validateHolyricsUrl, validateVideiraUrl } from "../../domain/settings/endpoints.ts";

/**
 * Testa uma conexão com o que está na tela (token e endereço digitados) e cai para o que está salvo.
 * Nada é gravado aqui. `deps.gateways` cria o cliente: `{ holyrics({baseUrl, token}), videira({baseUrl, token}) }`.
 */
export async function checkConnection(
  deps: ConnectionDeps,
  { target, token, url }: { target: CredentialTarget; token?: string | undefined; url?: unknown },
): Promise<{ connected: true; version: string | null } | { connected: true; count: number }> {
  const settings = await deps.settings.read();
  const saved = await deps.vault.read();
  const typedToken = token === undefined || token === "" ? undefined : token;
  if (typedToken !== undefined && !isValidToken(typedToken)) throw coded("INVALID_CREDENTIAL", "Credencial inválida.");
  const typedUrl = typeof url === "string" && url.trim() ? url.trim() : undefined;

  if (target === "holyrics") {
    const baseUrl = typedUrl ?? settings.holyricsUrl;
    validateHolyricsUrl(baseUrl);
    const result = await deps.gateways.holyrics({ baseUrl, token: typedToken ?? saved.holyrics }).ping();
    return { connected: true, version: result.version?.version ?? null };
  }
  const baseUrl = typedUrl ?? settings.videiraApiBase;
  validateVideiraUrl(baseUrl, { allowLoopbackHttp: deps.allowLoopbackVideira });
  const result = await deps.gateways.videira({ baseUrl, token: typedToken ?? saved.videira }).listPublishedSetlists();
  return { connected: true, count: result.setlists?.length ?? 0 };
}
