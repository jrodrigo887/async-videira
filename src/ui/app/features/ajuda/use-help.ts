import { useCallback, useState } from "react";
import { call } from "../../shared/api.ts";
import type { HelpArticle, HelpEntry } from "../../shared/api.ts";

export function useHelp() {
  const [topics, setTopics] = useState<HelpEntry[]>([]);
  const [article, setArticle] = useState<HelpArticle | null>(null);
  const [query, setQuery] = useState("");

  const loadList = useCallback(async () => { try { setTopics(await call("help.list")); } catch {} }, []);
  const open = useCallback(async (topicId: string) => { try { setArticle(await call("help.get", { topicId })); } catch { setArticle(null); } }, []);
  const loadTopic = useCallback((topicId: string) => call("help.get", { topicId }), []);
  async function search(value: string) {
    setQuery(value);
    try { setTopics(value.trim() ? await call("help.search", { query: value, limit: 30 }) : await call("help.list")); } catch {}
  }
  return { topics, article, query, loadList, open, loadTopic, search };
}
