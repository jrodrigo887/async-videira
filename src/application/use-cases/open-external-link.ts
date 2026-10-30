import type { ExternalLinkDeps } from "../ports/index.ts";
import { validateExternalUrl } from "../../domain/settings/endpoints.ts";

/** Abre no navegador do sistema só links permitidos. */
export async function openExternalLink(deps: ExternalLinkDeps, { url }: { url: unknown }) {
  await deps.externalLinks.open(validateExternalUrl(url));
  return { opened: true };
}
