// Monta build/app.ico a partir dos PNGs da marca já redimensionados em assets/brand/icons/ (origem: videira-marca/direcao-2/icone-app-1024.png).
// Cada tamanho entra como PNG dentro do .ico (aceito pelo Windows desde o Vista).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assets = resolve(root, "assets/brand");
const build = resolve(root, "build");
const SIZES = [16, 24, 32, 48, 64, 128, 256];

const images = await Promise.all(SIZES.map(async (size) => ({ size, data: await readFile(resolve(assets, "icons", `icon-${size}.png`)) })));
const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = header.length + images.length * 16;
const entries = images.map(({ size, data }) => {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0);
  entry.writeUInt8(size === 256 ? 0 : size, 1);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(data.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += data.length;
  return entry;
});
const target = resolve(build, "app.ico");
await mkdir(dirname(target), { recursive: true });
await writeFile(target, Buffer.concat([header, ...entries, ...images.map((image) => image.data)]));
process.stdout.write(`${target}\n`);
