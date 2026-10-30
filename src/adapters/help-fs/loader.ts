import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { HelpTopic } from "../../domain/help/help-topics.ts";
import { parseHelpFiles } from "../../domain/help/help-topics.ts";

export const DEFAULT_HELP_DIRECTORY = fileURLToPath(new URL("../../help", import.meta.url));

/** Lê os `.md` da pasta e delega interpretação/validação ao domínio. Pasta inexistente = sem tópicos. */
export async function loadHelpTopics({ directory = DEFAULT_HELP_DIRECTORY }: { directory?: string } = {}): Promise<HelpTopic[]> {
  let files: string[];
  try {
    files = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
      .map((entry) => join(directory, entry.name))
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") return [];
    throw error;
  }
  return parseHelpFiles(await Promise.all(files.map(async (file) => ({ file, text: await readFile(file, "utf8") }))));
}
