# Proposta: mudanças mínimas no servidor para async-videira

Status: desenho registrado antes da implementação. Escopo de implementação desta tarefa: branch `async-videira-server`, código e migration no repositório, e validação da migration exclusivamente em `127.0.0.1:5434/async_videira_disposable`. Nenhum outro banco será migrado.

## Decisões de desenho

### A. Gravação em lote dos vínculos

- Nova rota `POST /api/integrations/holyrics/song-links/batch`, protegida por `IntegrationBearerGuard`. Provider é fixo como `HOLYRICS`, derivado no servidor; organização vem exclusivamente do token.
- Corpo `{ items: [{ songId, externalId, externalTitle, externalArtist? }] }`, entre 1 e 200 entradas. Rejeitar corpo/itens malformados antes de gravar.
- Resposta com resultado para cada item: `created`, `updated`, `unchanged`, `duplicate` ou `not_found`; conflitos repetidos de `externalId` não sobrescrevem outro vínculo. Se o mesmo `externalId` aparecer em mais de uma música no lote, marcar todas as ocorrências conflitantes como `duplicate`. Se já pertence a outra música na organização, também `duplicate`.
- Idempotência natural por `(organizationId, songId, provider)` usando upsert; repetir o mesmo vínculo resulta em `unchanged`.
- Fortalecer a unicidade no banco com `@@unique([organizationId, provider, externalId])`, além da chave existente por música/provider, para impedir corrida entre requisições. Antes de aplicar a migration em qualquer banco compartilhado, executar consulta de preflight de duplicados por organização/provider/externalId e resolver conflitos manualmente.
- Sem transação all-or-nothing para lote: resultados são por item; itens sem conflito podem persistir mesmo quando outro item é rejeitado. Proteção de corrida pela constraint e tratamento de conflito como `duplicate`.

### B. Catálogo remoto

O app desktop lê a biblioteca Holyrics diretamente na máquina do usuário; ele não precisa enviar snapshots de catálogo ao Videira. Portanto não implementar staging/commit remoto nesta etapa. O app deve enviar somente vínculos confirmados ao endpoint em lote. Manter as rotas/tabela de catálogo existentes por compatibilidade com a ponte antiga; não usar o endpoint atual `mode=start`, que substitui imediatamente o snapshot.

### C. Sync reports

- Aceitar e persistir `libraryFingerprint` opcional (máximo 256 caracteres) no cabeçalho `HolyricsSyncReport`; devolver na consulta administrativa de relatórios.
- Aceitar outcome `duplicate` nos itens, sem alterar os outcomes existentes.

### D. Versão de setlist

`GET /api/integrations/holyrics/setlists/:id` ganha `version` e `updatedAt` ISO-8601 da linha Setlist. A versão é a revisão de conteúdo/meta já mantida pelo serviço; `updatedAt` é útil para comparação e diagnóstico. Não adicionar mecanismo delta nesta mudança.

## Migration

Uma migration Prisma pequena adiciona `libraryFingerprint String?` a `HolyricsSyncReport` e unique index composto em `SongExternalLink(organizationId, provider, externalId)`. A unicidade pode falhar se já houver vínculos duplicados; incluir comando de preflight no relatório e não executar fora do banco descartável sem aprovação separada. No Postgres descartável recém-criado, aplicar migration após atualizar schema/client.

## Testes planejados

- Serviço/controller de batch: bearer ligado à organização, criação, repetição idempotente, atualização do próprio songId, rejeição por externalId repetido dentro do lote e já ligado a outra música, songId inexistente, limite de 200 e nenhuma mutação para os itens conflitantes.
- Sync report: aceita/persiste/devolve fingerprint e outcome duplicate; rejeita fingerprint acima do limite e mantém validações anteriores.
- Setlist detail: devolve version/updatedAt sem remover campos existentes; escopo organizacional/status publicado permanece.
- Rodar suíte inteira do servidor. O helper atual de testes usa uma porta hardcoded (5433), ligada a outro container local. Para respeitar o limite de banco desta tarefa, adicionar configuração opcional `VIDEIRA_TEST_ADMIN_URL` ao helper e apontá-la explicitamente ao container descartável em 5434 durante a suíte; só criar/apagar bancos de teste nesse container.

## Riscos/limites

- Constraint nova exige limpeza prévia de duplicados em ambientes com dados históricos.
- O resultado por item não torna lote atômico; cliente deve persistir/mostrar cada resultado.
- Fingerprint é opaco ao servidor; o app é responsável por uma assinatura estável do catálogo local.
- Catálogo atual continua disponível para consumidores legados, mas não é caminho do async-videira.

## Implementação realizada nesta tarefa

- Branch criada: `async-videira-server` (a partir de `relational-holyrics`).
- Migration `20261029140000_async_videira_server_changes` aplicada apenas a `127.0.0.1:5434/async_videira_disposable`; não aplicada a qualquer outro banco.
- Endpoint implementado: `POST /api/integrations/holyrics/song-links/batch`, com Bearer de integração, provider `HOLYRICS` fixo, limite 200 e resposta `{ results: [{ index, songId, externalId, outcome }] }`. Duplicidade em lote rejeita todas as músicas conflitantes; vínculo já usado por outra música retorna `duplicate`; repetição idêntica retorna `unchanged`.
- Constraint de banco por `(organizationId, provider, externalId)` adicionada para impedir duplicidade também em requisições concorrentes. Antes de aplicar em ambiente compartilhado, preflight necessário:

```sql
SELECT "organizationId", "provider", "externalId", COUNT(*) AS total,
       ARRAY_AGG("songId") AS song_ids
FROM "SongExternalLink"
GROUP BY "organizationId", "provider", "externalId"
HAVING COUNT(*) > 1;
```

- App desktop não precisa enviar catálogo remoto porque lê o Holyrics na máquina. Não foi criado staging/commit de catálogo; catálogo legado permanece disponível para a ponte anterior.
- Sync report persiste/devolve `libraryFingerprint`; valida `duplicate` como outcome.
- Detalhe do setlist agora devolve `version` e `updatedAt`.
- `docs/holyrics-integration.md` atualizado. `integrations/holyrics/bridge/bridge.mjs` permaneceu intocado.
- Helper de testes recebeu override `VIDEIRA_TEST_ADMIN_URL`; suíte foi executada contra bancos temporários criados/removidos no Postgres descartável da porta 5434.

## Verificação

- `npx vitest run server/src --testTimeout=20000`: **150 arquivos, 786 testes passaram**.
- `npx tsc --noEmit -p server/tsconfig.json`: passou.
- API local reiniciada em `http://127.0.0.1:3001`, apontada ao banco descartável. POST autenticado com os três vínculos existentes retornou `unchanged` para cada item; GET autenticado de `async-test-setlist-ordered` confirmou `version: 1`, `updatedAt` ISO e os três `externalId` na ordem esperada.
- Nenhum dado de produção acessado ou alterado; migration não foi aplicada fora do banco descartável.

