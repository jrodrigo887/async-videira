import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// O tsc emite só código. O conteúdo da Ajuda (src/help/*.md) é lido em tempo de execução ao lado do código compilado.
const root = fileURLToPath(new URL("../", import.meta.url));
await mkdir(`${root}out/src`, { recursive: true });
await cp(`${root}src/help`, `${root}out/src/help`, { recursive: true });
