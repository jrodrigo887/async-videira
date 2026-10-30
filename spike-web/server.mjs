// Serve a página de teste em dois endereços, para comparar:
//   http://127.0.0.1:5199   -> origem "local" (não reproduz o caso real)
//   https://<IP-da-rede>:5443 -> origem "https fora do localhost": o que a página do videira-music seria.
// O certificado é autoassinado (só para este teste): o navegador vai pedir para continuar mesmo assim.
// Uso: node spike-web/server.mjs <IP-da-rede>
import http from "node:http";
import https from "node:https";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, "index.html"));
const handler = (_req, res) => { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }); res.end(page); };

http.createServer(handler).listen(5199, "127.0.0.1", () => console.log("http://127.0.0.1:5199"));

if (process.argv[2]) http.createServer(handler).listen(5198, process.argv[2], () => console.log(`http://${process.argv[2]}:5198`));

const key = join(here, "key.pem"), cert = join(here, "cert.pem");
const host = process.argv[2];
if (host && existsSync(key) && existsSync(cert)) {
  https.createServer({ key: readFileSync(key), cert: readFileSync(cert) }, handler).listen(5443, host, () => console.log(`https://${host}:5443`));
} else {
  console.log("Sem https: gere key.pem/cert.pem e passe o IP como argumento.");
}
