# Validação do dry-run: lado Videira

Data: 2026-10-29. Inspeção somente leitura do código e documentação do repositório. Não foram consultados ambientes remotos nem alterados código ou dados.

## 1. Comando para testar a API Videira

No PowerShell, a partir da raiz do repositório (`videira-music`), com um token de integração de teste e a API local, de staging ou de produção escolhida explicitamente:

```powershell
$env:VIDEIRA_API_BASE = 'https://<host-da-api>'
$env:VIDEIRA_TOKEN = '<token-de-integracao>'
$env:HOLYRICS_URL = 'http://127.0.0.1:8091'
$env:HOLYRICS_TOKEN = '<token-api-holyrics>'
$env:SETLIST_ID = '<id-do-setlist-publicado>'
node integrations/holyrics/bridge/bridge.mjs --dry-run
```

Para API local, use por exemplo `http://localhost:3000` conforme a porta configurada no Nest. O padrão do cliente é `https://videiramusic.org`; o padrão local do Holyrics é `http://127.0.0.1:8091`. `SETLIST_ID` é opcional, mas recomendado para não depender da escolha do primeiro setlist. Para limpar as variáveis ao fim da sessão:

```powershell
'VIDEIRA_API_BASE','VIDEIRA_TOKEN','HOLYRICS_URL','HOLYRICS_TOKEN','SETLIST_ID' | ForEach-Object { Remove-Item "Env:$_" -ErrorAction SilentlyContinue }
```

**O que `--dry-run` faz:** lista setlists elegíveis na API Videira, obtém o detalhe do setlist escolhido, consulta a playlist atual no Holyrics e pesquisa por título no Holyrics para itens sem `externalId`. Se resolver pelo menos uma faixa e a sequência diferir, informa quantas aplicaria. Não chama `RemoveFromLyricsPlaylist`, `AddLyricsToPlaylist` nem envia sync report. Portanto é sem escrita nos dois lados, mas requer conectividade e chamadas de leitura nos dois serviços. Não rode sem `--dry-run` se a intenção for apenas validar.

**O que o token Videira precisa:** deve ser um token Holyrics ativo, não revogado, criado para a organização que contém o setlist. O guard valida `Authorization: Bearer ...`, localiza o hash do token e deriva a organização associada. Para o percurso de dry-run, autoriza leitura de `GET /api/integrations/holyrics/setlists` e `GET /api/integrations/holyrics/setlists/{id}`. A ponte não precisa de permissão administrativa/sessão de usuário para essas rotas. Token inválido/revogado resulta em erro de autenticação. Não há como usar token de outra organização para enxergar esse setlist.

O código também exige `HOLYRICS_TOKEN` mesmo em `--dry-run`. Ele deve permitir as ações locais de leitura `GetLyricsPlaylist` e `SearchLyrics`; a documentação de configuração da integração também recomenda as ações de escrita `AddLyricsToPlaylist` e `RemoveFromLyricsPlaylist`, necessárias para execução real, não para aplicar o dry-run. O token Holyrics não é enviado à API Videira.

## 2. Ambiente e dados de teste

Não encontrei configuração ou prova no repositório de um ambiente de staging nem de setlist publicado disponível agora. Não consultei produção. `prisma/seed.ts` cria/garante a organização padrão e identidades simuladas em `NODE_ENV !== production`; ele **não** cria músicas, cifras ou setlists. `server/src/lib/setlists/setlist-test-fixture.ts` é fixture de testes com uma música e uma cifra, sem setlist criado ali. `docs/holyrics-song-linking.md` registra um teste anterior com três músicas chamado “Setlist teste”, mas não informa que esteja presente hoje nem em qual ambiente.

Para uma validação isolada, use banco PostgreSQL local descartável, aplicação local e Holyrics com biblioteca de teste. Não aponte `DATABASE_URL`/`DIRECT_URL` locais para produção. No ambiente local:

1. Rode migrations e seed apenas contra o banco descartável (`npm run db:migrate`, `npm run db:seed`).
2. Entre na aplicação local como administrador da organização seeded.
3. Crie três músicas/cifras de teste (ou use músicas fictícias) e um setlist com `eventAt` no futuro em horário de `America/Sao_Paulo`.
4. Adicione as três músicas em ordem e publique o setlist. A listagem de integração só retorna `published`, não excluído e com `eventAt` preenchido.
5. Se quiser testar a resolução vinculada, importe o catálogo Holyrics para essa organização e grave/revise os vínculos; se testar fallback, deixe vínculo ausente e use títulos que correspondam inequivocamente à biblioteca de teste do Holyrics.
6. Emita token na tela de integração Holyrics da aplicação local como administrador da mesma organização. Guarde o segredo exibido uma única vez e use-o em `VIDEIRA_TOKEN`. Alternativamente, a API `POST /api/integrations/holyrics/tokens` exige sessão autenticada de administrador e aceita `label`; a chamada retorna o token em claro uma única vez. Faça tudo no banco/API locais.
7. Execute o comando acima com `VIDEIRA_API_BASE` apontando ao servidor local e `SETLIST_ID` do setlist de teste.

O seed de identidades simuladas não equivale a uma credencial administrativa de staging. O fluxo de login local depende das configurações de desenvolvimento; não use atalhos de autenticação em ambiente de produção.

## 3. `externalId` e limite do catálogo

**Sim:** `GET /api/integrations/holyrics/setlists/{id}` preenche `externalId` se existir uma linha `SongExternalLink` da organização para aquele `songId` e provider Holyrics (`HOLYRICS_PROVIDER`). Sem vínculo, retorna `null`. Isso pode ser verificado em `server/src/lib/holyrics/setlist-integration-service.ts`, que consulta `songExternalLink` e monta `linkBySong`.

**Limite SearchLyrics / `--catalog`:** a implementação atual chama uma vez `SearchLyrics` com `{ text: "" }`, transforma todos os itens retornados e divide o envio Videira em lotes de no máximo 200 itens (`mode: start` no primeiro, `continue` nos demais). Ela **não pagina** a leitura no Holyrics nem chama `GetSongs`. Se a API local truncar `SearchLyrics` em 50 resultados, os demais não serão obtidos e o primeiro lote pode substituir o snapshot no Videira por um catálogo parcial. Entretanto, o código/documentação local não confirma limite de 50: `docs/holyrics-song-linking.md` registra verificação de `SearchLyrics` vazio retornando “a biblioteca inteira” num teste de 29 músicas. Isso não prova comportamento acima de 50. A afirmação de que `GetSongs` retorna tudo não está implementada nem verificada neste repositório. Antes de sincronizar catálogo grande, comparar contagem com a biblioteca real em ambiente de teste e validar a API oficial do Holyrics para paginação/`GetSongs`; não executar `--catalog` contra a organização real como diagnóstico, pois ele faz POST e o primeiro lote substitui o snapshot.

## Referências verificadas

- `integrations/holyrics/bridge/bridge.mjs` — variáveis, chamadas do dry-run e percurso do catálogo.
- `integrations/holyrics/bridge/sync-logic.mjs` — lotes de 200, resolução por ID/título e fingerprint.
- `server/src/holyrics/holyrics-setlists.controller.ts`, `holyrics-tokens.controller.ts` — rotas e guards.
- `server/src/lib/holyrics/setlist-integration-service.ts` — elegibilidade, ordenação e `externalId`.
- `server/src/lib/holyrics/token-service.ts` — criação/revogação de token.
- `server/src/auth/integration-bearer.guard.ts` — autenticação bearer e escopo organizacional.
- `prisma/seed.ts`, `server/src/lib/setlists/setlist-test-fixture.ts` — conteúdo do seed e fixture.
- `docs/holyrics-integration.md`, `docs/holyrics-song-linking.md` — requisitos e teste anterior de catálogo.
