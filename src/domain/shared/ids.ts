type WithId = { id?: unknown } | string | number;

/** IDs externos são strings opacas; aceita item solto ou objeto `{ id }`. */
export const asId = (entry: WithId): string => String((entry as { id?: unknown } | null)?.id ?? entry);
export const idsOf = (items: readonly WithId[] | null | undefined): string[] => (items ?? []).map(asId);
export const uniqueIds = (ids: readonly unknown[]): string[] => [...new Set(ids.map((id) => String(id)))];
export const sameSequence = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);
