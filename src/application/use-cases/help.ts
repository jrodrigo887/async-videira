import type { HelpDeps } from "../ports/index.ts";
import { getTopic, listTopics, searchTopics } from "../../domain/help/help-topics.ts";

// A UI identifica tópicos por `id`; o contrato IPC usa `topicId`. Respondemos com os dois.

export async function listHelp(deps: HelpDeps, filters?: { publico?: string; categoria?: string }) {
  return listTopics(await deps.help.topics(), filters);
}

export async function getHelp(deps: HelpDeps, { topicId }: { topicId: string }) {
  const topic = getTopic(await deps.help.topics(), topicId);
  return topic ? { id: topic.topicId, ...topic } : null;
}

export async function searchHelp(deps: HelpDeps, { query, limit }: { query: unknown; limit?: number }) {
  const results = searchTopics(await deps.help.topics(), query, { ...(limit === undefined ? {} : { limit }) });
  return results.map(({ topicId, title, excerpt, context }) => ({ id: topicId, topicId, title, summary: excerpt, context }));
}
