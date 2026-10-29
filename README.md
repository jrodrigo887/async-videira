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

## CLI de ponta a ponta

Node.js 18+ com `fetch` nativo; sem dependências adicionais. Configure `VIDEIRA_TOKEN`, `HOLYRICS_TOKEN`; opcionalmente `VIDEIRA_API_BASE` (padrão `https://videiramusic.org`), `HOLYRICS_URL` (padrão `http://127.0.0.1:8091`) e `SETLIST_ID`.

```sh
node src/cli.mjs preparar
node src/cli.mjs aplicar --yes
```

`preparar` mostra o dry-run e grava o plano local para a etapa seguinte, sem escrita nas APIs. `aplicar` exige essa preparação e `--yes`, revalida setlist/catálogo/destino, aplica e verifica a playlist e só então envia o relatório. Tokens são lidos do ambiente, nunca persistidos nem impressos. Estado fica em JSON no diretório de dados do usuário; testes definem `ASYNC_VIDEIRA_STATE_PATH` para usar arquivos temporários.

Testes: `node --test tests/**/*.test.mjs`.

## Tutorial

Guia completo de configuração do Holyrics e do async-videira (passo a passo, rotina de domingo, troca de PC e problemas comuns): [docs/tutorial/configurar-holyrics-e-async-videira.md](docs/tutorial/configurar-holyrics-e-async-videira.md).
