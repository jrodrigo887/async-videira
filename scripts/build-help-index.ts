#!/usr/bin/env node
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildHelpIndex, loadHelpTopics } from "../src/core/help/index.ts";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const options = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  if (!["--source-dir", "--output"].includes(key) || !process.argv[index + 1]) {
    process.stderr.write("Usage: node scripts/build-help-index.ts [--source-dir DIR] [--output FILE]\n");
    process.exit(1);
  }
  options.set(key, resolve(process.argv[++index]));
}
const helpDirectory = options.get("--source-dir") ?? join(projectRoot, "src", "help");
const outputPath = options.get("--output") ?? join(helpDirectory, "index.json");

try {
  const topics = await loadHelpTopics({ directory: helpDirectory });
  await mkdir(dirname(outputPath), { recursive: true });
  const tempPath = `${outputPath}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(buildHelpIndex(topics), null, 2)}\n`, "utf8");
  await rename(tempPath, outputPath);
  process.stdout.write(`Help index built: ${topics.length} topic(s) -> ${outputPath}\n`);
} catch (error) {
  const errors: string[] = (error as { errors?: string[] } | null)?.errors ?? [error instanceof Error ? error.message : String(error)];
  process.stderr.write(`Help index validation failed:\n${errors.map((entry: string) => `- ${entry}`).join("\n")}\n`);
  process.exitCode = 1;
}
