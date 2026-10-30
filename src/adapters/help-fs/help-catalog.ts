import type { HelpCatalog } from "../../application/ports/index.ts";
import type { HelpTopic } from "../../domain/help/help-topics.ts";
import { loadHelpTopics } from "./loader.ts";

/** Implementa a porta HelpCatalog; o conteúdo é empacotado com o app, então lê uma vez. */
export function createHelpCatalog({ directory }: { directory?: string } = {}): HelpCatalog {
  let topics: Promise<HelpTopic[]> | undefined;
  return { topics: () => (topics ??= loadHelpTopics({ directory })) };
}
