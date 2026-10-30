# async-videira

Aplicativo desktop instalável para preparar e publicar o setlist publicado de um culto do Videira Music na playlist atualmente selecionada do Holyrics. O produto é voltado a uma igreja com **um único computador Holyrics**, sem Holyrics Plan.

## Escopo decidido

- Ler setlists publicados e vínculos `SongExternalLink` pela API HTTPS do Videira, autenticada por token da organização.
- Ler o catálogo atual em cada preparação pela API local do Holyrics (`127.0.0.1:8091`) usando `GetSongs`; ignorar o item de sistema `1611686353330`.
- Resolver publicação pelo vínculo confirmado (`externalId`). Título e artista normalizados exatos geram sugestões revisáveis; fuzzy/duplicatas exigem decisão manual individual.
- Aplicar ordem à playlist/culto que o operador selecionou no Holyrics. Não criar ou espelhar músicas, nem escrever no SQLite ou em arquivos `.hly` do Holyrics.
- Oferecer importação assistida TXT, OpenLP XML ou OpenSong para músicas ausentes, sujeita à disponibilidade de conteúdo autorizado.
- Guardar cache operacional, fila de relatórios e estado de migração em JSON versionado; guardar segredos no Credential Manager/Keychain.

## Interface e fluxo

A ação principal é **Preparar culto**; o operador pode iniciá-la manualmente ou configurar horário de domingo. O dry-run mostra o estado de cada item, sugere vínculos exatos e aponta ambiguidades/ausências/repetições antes de alterar a playlist. Aplicação exige backup em memória, `Remove(indexes)` + `Add(ids)`, releitura obrigatória, comparação com a sequência deduplicada e restauração best-effort. Só depois da verificação o app envia `sync-report`.

## Fora de escopo

- Espelhar a biblioteca, letras, cifras ou metadados de músicas.
- Criar, editar ou excluir músicas pela API Holyrics (requer Plan) ou alterar banco/arquivos internos.
- Sincronizar eventos sem que estejam selecionados na interface do Holyrics.
- SQLite local neste estágio; reavaliar apenas se surgir necessidade real de histórico offline pesquisável.
- Embutir credenciais, acessar diretamente o PostgreSQL Videira, controlar o projetor ou versionar dados reais.

## Estrutura

- `src/core/`: planejamento/resolução pura do sync-core.
- `src/adapters/videira/`: integração HTTPS, vínculos e relatórios.
- `src/adapters/holyrics-api/`: API local e aplicação verificada da playlist.
- `src/ui/`: UI desktop.
- `tests/core/`: testes unitários; `fixtures/`: casos sintéticos baseados nos discoveries.
- `docs/`: arquitetura, ADRs e itens ainda não validados.

## Aplicativo desktop (primeiro marco)

Requer Node.js 22.18+ (o projeto é TypeScript e o Node executa `.ts` direto) e npm. O shell Electron/React está em construção; instale dependências e execute `npm run dev` para servir a UI. `npm run build` gera UI e diretório Electron descompactado; `npm run dist:win` gera instalador NSIS por usuário em `dist/`. O instalador não exige admin e preserva `%APPDATA%\\async-videira` ao desinstalar. O primeiro build é sem assinatura: o Windows SmartScreen pode avisar que o editor é desconhecido; obtenha o instalador somente do canal oficial e confira a origem. Assinatura futura usa `CSC_LINK` e `CSC_KEY_PASSWORD` no ambiente de release, sem certificado incluído.

Tokens digitados no app são criptografados por `safeStorage` do Electron e mantidos fora de `settings.json`; no Windows o backend usa DPAPI. Logs locais ficam em `%LOCALAPPDATA%\\async-videira\\logs`, com rotação; a aba Logs mostra eventos redigidos e só copia o conteúdo após ação explícita. macOS está apenas configurado como alvo DMG e não foi testado. A tela inicial oferece publicação e Ajuda empacotada; a configuração testa conexões individualmente. O smoke abre o app empacotado e chama `worship.prepare` contra servidores falsos locais, sem gravar no Holyrics. Device Guard pode bloquear executáveis de teste sem assinatura.

```powershell
npm install
npm run dev
npm run build
npm run dist:win
npm run smoke
```

`npm run dev` compila o processo principal para `out/`, abre o renderer Vite e o shell Electron. A UI chama os mesmos casos de uso da CLI pela ponte IPC (`src/interface/electron/ipc/commands.ts`).

Todo o código é TypeScript (`strict`). `npm run typecheck` roda o `tsc --noEmit`; `npm test` roda a suíte direto sobre os `.ts`; `npm run check` faz os dois. `npm run build:main` emite o JavaScript do Electron e da CLI em `out/` (é o que o empacotamento usa).

## CLI de ponta a ponta

Node.js 22.18+ (executa `.ts` sem etapa de build) com `fetch` nativo; sem dependências adicionais. Configure `VIDEIRA_TOKEN`, `HOLYRICS_TOKEN`; opcionalmente `VIDEIRA_API_BASE` (padrão `https://videiramusic.org`), `HOLYRICS_URL` (padrão `http://127.0.0.1:8091`) e `SETLIST_ID`.

```sh
node src/cli.ts preparar
node src/cli.ts aplicar --yes
```

`preparar` mostra o dry-run e grava o plano local para a etapa seguinte, sem escrita nas APIs. `aplicar` exige essa preparação e `--yes`, revalida setlist/catálogo/destino, aplica e verifica a playlist e só então envia o relatório. Tokens são lidos do ambiente, nunca persistidos nem impressos. Estado fica em JSON no diretório de dados do usuário; testes definem `ASYNC_VIDEIRA_STATE_PATH` para usar arquivos temporários.

Testes: `npm test` (ou `npm run check` para tipos + testes).

## Tutorial

Guia completo de configuração do Holyrics e do async-videira (passo a passo, rotina de domingo, troca de PC e problemas comuns): [docs/tutorial/configurar-holyrics-e-async-videira.md](docs/tutorial/configurar-holyrics-e-async-videira.md).
