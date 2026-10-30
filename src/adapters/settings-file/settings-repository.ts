import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { SettingsRepository } from "../../application/ports/index.ts";
import type { Settings } from "../../domain/types.ts";
import { DEFAULT_SETTINGS } from "../../domain/settings/endpoints.ts";

/** Preferências não secretas em JSON. Arquivo ausente ou ilegível = padrões. */
export function createSettingsRepository({ path }: { path: string }): SettingsRepository {
  return {
    async read(): Promise<Settings> {
      try { return { ...DEFAULT_SETTINGS, ...JSON.parse(await readFile(path, "utf8")) }; } catch { return { ...DEFAULT_SETTINGS }; }
    },
    async write(settings: Settings) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(settings, null, 2));
      return settings;
    },
  };
}
