import type { AppState, MigrationEntry, MigrationState } from "../types.ts";

export const GOOD_LINK_OUTCOMES = ["created", "updated", "unchanged"];
const MAX_HISTORY = 500;

/** Old → new IDs stay as history; nothing is deleted from Videira by a migration. */
export function withHistory(state: Pick<AppState, "migration">, entries: MigrationEntry[]): MigrationState {
  const history = [...(state.migration?.history ?? []), ...entries].slice(-MAX_HISTORY);
  return { ...state.migration, history };
}
