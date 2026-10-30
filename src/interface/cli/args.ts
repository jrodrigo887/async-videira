export interface ParsedArgs {
  command: "preparar" | "aplicar";
  yes: boolean;
  date: string | undefined;
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const [command, ...rest] = argv;
  let yes = false;
  let date: string | undefined;
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (value === "--yes") yes = true;
    else if (value === "--date" && rest[index + 1]) date = rest[++index];
    else if (value.startsWith("--date=")) date = value.slice("--date=".length);
    else throw new Error("Unknown CLI argument.");
  }
  if (command === "preparar" && yes) throw new Error("--yes is only valid with aplicar.");
  if (command === "aplicar" && !yes) throw new Error("aplicar requires --yes.");
  if (command !== "preparar" && command !== "aplicar") {
    throw new Error("Usage: node src/cli.ts preparar [--date YYYY-MM-DD] | aplicar --yes");
  }
  return { command, yes, date };
}
