# Testes

Os testes usam `node:test`, `node:http` com servidores locais falsos e fixtures JSON; não fazem chamadas à instalação Holyrics nem exigem dependências externas. Os arquivos são TypeScript (`*.test.ts`) e o Node os executa direto, sem compilar. Execute a suíte inteira com `npm test` e confira os tipos com `npm run typecheck` (ou os dois com `npm run check`). `helpers/` guarda os servidores falsos (`fake-holyrics-proxy.ts`, `http.ts`) compartilhados pelos testes de integração.
