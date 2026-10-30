import type { StateRepository } from "../../application/ports/index.ts";
import type { AppState } from "../../domain/types.ts";
import { readStateOrRecover, writeState } from "../../state/store.ts";

/** Implementa a porta StateRepository sobre o arquivo JSON versionado. `secrets` nunca podem aparecer no estado. */
export function createStateRepository({ path, secrets = [] }: { path: string; secrets?: Array<string | undefined> }): StateRepository {
  return {
    load: () => readStateOrRecover(path),
    async save(state: Partial<AppState>) {
      const serialized = JSON.stringify(state);
      if (secrets.filter((secret): secret is string => Boolean(secret)).some((secret) => serialized.includes(secret))) {
        throw new Error("Local state cannot contain configured credentials.");
      }
      return writeState(path, state);
    },
  };
}
