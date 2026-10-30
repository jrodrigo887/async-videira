import { join } from "node:path";
import { createEventBus } from "../adapters/event-bus/in-process.ts";
import { createAuditLog } from "../adapters/audit-jsonl/audit-log.ts";
import { createHelpCatalog } from "../adapters/help-fs/help-catalog.ts";
import { createHolyricsClient } from "../adapters/holyrics-api/client.ts";
import { createSettingsRepository } from "../adapters/settings-file/settings-repository.ts";
import type { SafeStorageLike } from "../adapters/vault-electron/vault.ts";
import type { AuditLog, Clock, ConnectionDeps, ExternalLinkDeps, HelpDeps } from "../application/ports/index.ts";
import { createVault } from "../adapters/vault-electron/vault.ts";
import { createVideiraClient } from "../adapters/videira/client.ts";
import { createAuditProjector } from "../application/services/audit-projector.ts";
import { checkConnection } from "../application/use-cases/check-connection.ts";
import { credentialStatus, setCredential } from "../application/use-cases/credentials.ts";
import { getHelp, listHelp, searchHelp } from "../application/use-cases/help.ts";
import { openExternalLink } from "../application/use-cases/open-external-link.ts";
import { createEditorSession } from "../application/use-cases/song-editor.ts";
import { getSettings, updateSettings } from "../application/use-cases/settings.ts";
import { validateEndpoints } from "../domain/settings/endpoints.ts";
import { createContainer } from "./container.ts";

/**
 * Monta tudo o que o app desktop usa fora do Electron em si. As peças do Electron (`safeStorage`, `shell`)
 * entram por parâmetro, então este módulo roda em testes de Node.
 *
 * Devolve o "contexto" que os comandos IPC consomem: casos de uso já ligados aos adaptadores.
 */
export interface DesktopContainerOptions {
  userData: string;
  logDir: string;
  safeStorage: SafeStorageLike;
  openExternal: (url: string) => Promise<void> | void;
  allowLoopbackVideira?: boolean;
  clock?: Clock;
  fetchImpl?: typeof fetch;
}

export function createDesktopContainer({ userData, logDir, safeStorage, openExternal, allowLoopbackVideira = false, clock, fetchImpl = fetch }: DesktopContainerOptions) {
  const settings = createSettingsRepository({ path: join(userData, "settings.json") });
  const vault = createVault({ path: join(userData, "credentials.bin"), safeStorage });
  const audit = createAuditLog({ dir: logDir, clock });
  const events = createEventBus();
  events.subscribe(createAuditProjector(audit));
  const help = createHelpCatalog();
  const editorSession = createEditorSession();

  const deps: ConnectionDeps & HelpDeps & ExternalLinkDeps & { audit: AuditLog } = {
    events,
    settings,
    vault,
    audit,
    help,
    allowLoopbackVideira,
    externalLinks: { open: openExternal },
    gateways: {
      holyrics: ({ baseUrl, token }) => createHolyricsClient({ baseUrl, token, fetchImpl }),
      videira: ({ baseUrl, token }) => createVideiraClient({ baseUrl, token, fetchImpl }),
    },
  };
  type DesktopDeps = typeof deps;
  const bind = <I, O>(useCase: (deps: DesktopDeps, input: I) => Promise<O>) => (input: I) => useCase(deps, input);

  /** Container do culto com as configurações e credenciais de agora (lidas a cada chamada, pois mudam em Ajustes). */
  async function worship() {
    const [current, credentials] = await Promise.all([settings.read(), vault.read()]);
    validateEndpoints(current, { allowLoopbackHttp: allowLoopbackVideira });
    return createContainer({
      fetchImpl,
      clock,
      events,
      env: {
        ...process.env,
        HOLYRICS_URL: current.holyricsUrl,
        VIDEIRA_API_BASE: current.videiraApiBase,
        HOLYRICS_TOKEN: credentials.holyrics,
        VIDEIRA_TOKEN: credentials.videira,
      },
    });
  }

  return {
    audit,
    events,
    editorSession,
    worship,
    getSettings: () => getSettings(deps),
    updateSettings: bind(updateSettings),
    setCredential: bind(setCredential),
    credentialStatus: () => credentialStatus(deps),
    checkConnection: bind(checkConnection),
    listHelp: bind(listHelp),
    getHelp: bind(getHelp),
    searchHelp: bind(searchHelp),
    openExternalLink: bind(openExternalLink),
  };
}
