import { coded } from "../../domain/shared/errors.ts";
import { publish } from "../services/events.ts";
import type { CredentialDeps } from "../ports/index.ts";
import { isCredentialTarget, isValidToken } from "../../domain/settings/endpoints.ts";

export async function setCredential(deps: CredentialDeps, { target, token }: { target: unknown; token: unknown }) {
  if (!isCredentialTarget(target) || !isValidToken(token)) throw coded("INVALID_CREDENTIAL", "Credencial inválida.");
  const credentials = await deps.vault.read();
  credentials[target] = token;
  await deps.vault.write(credentials);
  await publish(deps, { type: "CredentialsSaved", target });
  return { configured: true };
}

/** Só diz se há token; o valor nunca sai do cofre. */
export async function credentialStatus(deps: CredentialDeps) {
  const credentials = await deps.vault.read();
  return { holyrics: Boolean(credentials.holyrics), videira: Boolean(credentials.videira) };
}
