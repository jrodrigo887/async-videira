// Fora do Electron (navegador, servidor de desenvolvimento) não existe a ponte IPC. Este shim mantém a UI
// utilizável: a Ajuda usa o mesmo parser e os mesmos casos de uso do app (src/domain/help, application/use-cases/help),
// lendo os tópicos de src/help empacotados no build. As demais operações respondem "indisponível".
// No Electron, window.asyncVideira vem do preload e este arquivo não faz nada.
import { getHelp, listHelp, searchHelp } from "../../../application/use-cases/help.ts";
import { parseHelpFiles } from "../../../domain/help/help-topics.ts";
import type { HelpTopic } from "../../../domain/help/help-topics.ts";
import { DEFAULT_SETTINGS } from "../../../domain/settings/endpoints.ts";
import type { AsyncVideiraBridge } from "./api.ts";

const files = import.meta.glob<string>("../../../help/*.md", { query: "?raw", import: "default", eager: true });

let topics: HelpTopic[] = [];
try {
  topics = parseHelpFiles(Object.entries(files).map(([file, text]) => ({ file, text })));
} catch (error) {
  console.error("Conteúdo de ajuda inválido", (error as { errors?: string[] } | null)?.errors ?? error);
}
const deps = { help: { topics: async () => topics } };

type Payload = Record<string, unknown>;
type Result = Awaited<ReturnType<AsyncVideiraBridge["invoke"]>>;

const ok = (data: unknown): Result => ({ ok: true, data });
const unavailable: Result = { ok: false, error: { code: "SERVICE_UNAVAILABLE", messageKey: "service.unavailable", retryable: false } };

const handlers: Record<string, (payload: Payload) => Promise<unknown>> = {
  "help.list": (payload) => listHelp(deps, payload),
  "help.get": (payload) => getHelp(deps, payload as { topicId: string }),
  "help.search": (payload) => searchHelp(deps, { limit: 10, ...payload } as { query: string; limit?: number }),
  "logs.list": async () => [],
  "settings.get": async () => ({ ...DEFAULT_SETTINGS }),
  "service.credentials.status": async () => ({ holyrics: false, videira: false }),
};

if (typeof window !== "undefined" && !window.asyncVideira) {
  window.asyncVideira = Object.freeze<AsyncVideiraBridge>({
    invoke: async (command, payload = {}) => {
      const handler = handlers[command];
      return handler ? ok(await handler(payload as Payload)) : unavailable;
    },
  });
}
