#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { createContainer } from "./composition/container.ts";
import { parseArgs } from "./interface/cli/args.ts";
import { formatApplication, formatError, formatPreparation } from "./interface/cli/presenter.ts";

/** Interface de linha de comando: traduz argv → use case → texto. Nenhuma regra de negócio aqui. */
export interface CliOptions {
  env?: Record<string, string | undefined>;
  stdout?: { write(chunk: string): unknown };
  stderr?: { write(chunk: string): unknown };
  fetchImpl?: typeof fetch;
  statePath?: string;
}

export async function runCli(argv: string[] = process.argv.slice(2), options: CliOptions = {}): Promise<number> {
  const env = options.env ?? process.env;
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  try {
    const parsed = parseArgs(argv);
    const app = createContainer({ env, fetchImpl: options.fetchImpl ?? fetch, statePath: options.statePath });
    const setlistId = env.SETLIST_ID || undefined;
    if (parsed.command === "preparar") {
      stdout.write(formatPreparation(await app.prepareWorship({ date: parsed.date, setlistId })));
      return 0;
    }
    const applied = await app.applyWorship({ setlistId });
    stdout.write(formatApplication(applied));
    return applied.result.status === "FAILED" ? 1 : 0;
  } catch (error) {
    stderr.write(formatError(error));
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await runCli();
}
