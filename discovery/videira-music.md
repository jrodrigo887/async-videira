# Discovery: Videira Music → async-videira

Data da inspeção: 2026-10-29. Fonte: leitura do repositório `videira-music`; nenhum dado de produção foi consultado ou alterado.

## Resumo

O Videira Music já tem uma integração funcional **de setlists publicados para a playlist de letras do Holyrics**, por API HTTPS autenticada por token de integração por organização, com um script dentro do Holyrics e uma ponte Node local. Também importa o catálogo de letras do Holyrics para permitir vínculos explícitos. Isso não é um espelho completo da biblioteca de músicas/cifras: a rota de detalhe exporta somente itens musicais do setlist (ordem, título, artista e ID externo), sem letra, tom escolhido, cifras ou timestamps.

A fonte primária é PostgreSQL, acessado pelo servidor NestJS/Prisma. Não foi encontrada uma conexão para clientes desktop diretamente ao banco; para um app instalado, a superfície apropriada existente é a API pública em `https://videiramusic.org` com token escopado à organização.

## 1. Como músicas e setlists são representados

Schema: `prisma/schema.prisma`; schema Prisma usa PostgreSQL e `DATABASE_URL`/`DIRECT_URL`.

### Música e cifra

- `Song`: `id` (string, PK), `organizationId`, `title`, `label`, `artist?`, `genre?`, `defaultKey?`, `alternateKeys` (JSON), `notes?`, `meta` (string), `searchText`, `publicLyrics`, `sourceOrganizationId?`, `deletedAt?`, `createdAt`, `updatedAt`.
- `ChordChart`: cifra/arranjo associado a `songId`, também com `id`, `organizationId`; `title?`, `versionLabel?`, `format` (`lyrics` ou `grid`), `key`, `timeSignature`, `tempo?`, `capo?`, `sections` (JSON estruturado), fonte/origem, disponibilidade e timestamps.
- `sections` é conteúdo da cifra/letra: seções ordenadas conforme a estrutura JSON, linhas com texto e posições dos acordes (`LyricsSectionContent`), ou compassos/acordes (`GridSectionContent`). Portanto, “letra” não fica em um campo simples da tabela Song. A API de integração Holyrics não exporta esse conteúdo.
- Tom padrão da música é `Song.defaultKey`; o tom concreto de uma cifra é `ChordChart.key`; o tom selecionado no setlist é `SetlistItem.selectedKey`.
- Uma música pode ter múltiplas cifras/versões. `ChordChart` tem timestamps e `ChordChartRevision` guarda snapshots versionados de `sections`, tom, capo e rótulo, com `savedAt`.

### Setlist e ordem

- `Setlist`: `id`, `organizationId`, `ownerTeamId?`, `ownerUserId?`, `title`, `eventType?`, `eventAt?`, `status`, `visibility`, `notes?`, `version` (inicia em 1), `deletedAt?`, `createdAt`, `updatedAt`.
- `SetlistItem`: `id`, `setlistId`, `position` (ordem, única por setlist), `kind` (`song`/`note`), `songId?`, `chartId?`, `selectedKey?`, `text?`, `notes?`. Item musical aponta para música e cifra; item de nota pode carregar texto livre.
- Eventos de setlist e itens são carregados com ordenação por `position`; endpoint de Holyrics filtra `kind: song` e os itens com `songId` não nulo.
- Relações secundárias: `WorshipTeam` organiza setlists, `SetlistFollow` guarda times seguidores, `SetlistShareLink` fornece compartilhamento por token revogável.
- Tipos compartilhados em `packages/contract/src/types/music.ts` e `.../setlist.ts` refletem essas formas e os status `draft`, `published`, `archived` e visibilidade privada/time/organização/pública.

## 2. Sincronização já construída

Documentação: `docs/holyrics-integration.md`; implementação em `server/src/holyrics/`, `server/src/lib/holyrics/`, `integrations/holyrics/`.

### Exportação de setlist para Holyrics

Endpoints HTTPS sob `/api/integrations/holyrics`:

- `GET /setlists`: busca o próximo dia (fuso `America/Sao_Paulo`) com setlist publicado; retorna `{ date, setlists[] }`.
- `GET /setlists?date=AAAA-MM-DD`: lista setlists publicados naquele dia.
- `GET /setlists/{id}`: detalhe `{ setlistId, title, eventAt, items[] }`; cada item exporta `position`, `songId`, `title`, `artist`, `externalId`. Não exporta letra/cifra, tom, notes ou timestamps de atualização.
- `POST /sync-reports`: recebe o resultado da aplicação, incluindo `setlistId`, status, versão do programa Holyrics e itens com resultados/posições.

Elegibilidade: mesma organização do token, `status = published`, `deletedAt = null` e `eventAt` preenchido. A lista por dia ordena por `eventAt`; sem data procura a próxima data. A ponte usa `SETLIST_ID` se configurado, caso contrário o primeiro da lista. Em caso de vários setlists num dia, o script interno permite seleção.

Dois aplicadores existentes:

1. `integrations/holyrics/videira-sync.js`, executado no JavaScript do Holyrics via `h.apiRequest` (Holyrics 2.26.0+ e plano com requisições externas; host precisa estar permitido). O mesmo script é servido em `GET /ajuda/holyrics/script`, exigindo sessão de usuário.
2. `integrations/holyrics/bridge/bridge.mjs`, Node 18+ sem dependências, roda no PC do Holyrics e chama `http://127.0.0.1:8091/api/...` com token local do Holyrics. Tem `--dry-run`, execução única e `--watch` (padrão 60 s, mínimo 10 s, backoff até 5 min).

A ponte resolve `externalId` explicitamente; quando ausente pesquisa por título e só aceita correspondência única. Ignora ambiguidades/ausências, reporta `PARTIAL`; se nenhuma faixa resolver, falha. Compara sequência de IDs e só altera playlist se mudou. Ao falhar a aplicação, tenta restaurar a playlist anterior. O relatório é enviado ao Videira.

### Catálogo e vínculos

- `POST /api/integrations/holyrics/catalog`: importa lotes de catálogo (`externalId`, `title`, `artist?`, até 200 itens por requisição). Primeiro lote (`mode: start`) substitui o snapshot do catálogo da organização; lotes subsequentes (`continue`) acrescentam. `--catalog` lê a biblioteca Holyrics por `SearchLyrics` e faz upload. IDs/títulos duplicados ou valores inválidos são descartados conforme validação.
- `HolyricsCatalogItem` mantém o catálogo importado; `SongExternalLink` vincula uma música Videira ao ID externo Holyrics (`provider`, `externalId`, título/artista externos). O catálogo é base para sugerir/registrar vínculos, não um envio de letra para o Holyrics.
- `POST /sync-reports` grava em `HolyricsSyncReport`; administradores consultam histórico por `GET` na mesma rota.

## 3. Detecção de mudanças

- `Song.updatedAt`, `ChordChart.updatedAt`, `Setlist.updatedAt` são atualizados automaticamente pelo Prisma (`@updatedAt`). São úteis para polling/invalidação, mas não se viu um endpoint delta/cursor nem um log imutável de alterações da música ou setlist.
- Setlist também tem `version` inteiro e updates recebem `expectedVersion`, possibilitando concorrência otimista. Itens não têm timestamp próprio; a versão do setlist deve ser o marcador para substituição/ordenação de itens.
- Cifras têm `schemaVersion` (formato do payload) e `ChordChartRevision` histórica com `savedAt`; isso é histórico de cifra, não um feed unificado de alterações.
- Soft delete: `Song.deletedAt`, `Setlist.deletedAt`; `WorshipTeam.archivedAt`. A exportação Holyrics exclui setlists soft-deleted, mas não publica evento de remoção para consumidor offline. Para sync incremental, consumidores precisam receber tombstones ou reconciliar snapshot completo.
- Catálogo Holyrics usa `updatedAt`, mas snapshot/append não representa alterações das músicas Videira.
- A ponte atual detecta alteração do alvo comparando IDs da playlist (`fingerprint(setlistId, targetIds)`) e guarda a última aplicação somente em memória do processo; não detecta conteúdo alterado sob os mesmos IDs nem persiste cursor entre reinicializações.

## 4. Stack e restrições para app intermediário

- UI web: Vite + React Router em `apps/web`; API NestJS em `server/`; contratos compartilhados; deploy via Vercel rewrites para `/api/*` e `/ajuda/holyrics/script` (`vercel.json`).
- Banco: PostgreSQL via Prisma no serviço backend. Credenciais são variáveis de ambiente server-side `DATABASE_URL` e `DIRECT_URL`; não devem ir no app desktop. Não há evidência de acesso público/direto ao banco ou mecanismo de credenciais por cliente.
- API de integração é pública via HTTPS, aceita bearer token de integração, hash do token guardado no banco e vinculado a uma organização. Tokens são criados/revogados por administrador autenticado; valor aparece uma vez. Guard rejeita bearer inválido e exige o escopo organizacional derivado no servidor, não do corpo. Endpoints de catálogo/setlists/relatório aceitam integração bearer.
- Rotas administrativas de gestão de tokens e consulta de relatórios usam sessão de usuário + papel de administrador; autenticação do app web é sessão (Better Auth). Não se deve embutir credencial administrativa ou do banco num instalador distribuído.
- Para Holyrics, API local é HTTP em `127.0.0.1:8091` (configurável), com token e permissões explícitas. O fluxo documentado requer `GetLyricsPlaylist`, `SearchLyrics`, `AddLyricsToPlaylist`, `RemoveFromLyricsPlaylist`; nenhuma escrita direta em arquivos do Holyrics.
- A API atual é orientada à playlist/setlist e não inclui export completo de biblioteca, letra/cifra, cursor, tombstone, seleção de chart/key nem atualização incremental. O app intermediário precisaria de contrato novo ou adaptação do endpoint; não deve presumir acesso remoto Postgres.
- Desktop Windows/Mac implica armazenamento seguro dos tokens, atualização/revogação, TLS e endpoint de loopback protegido; integração Holyrics e sincronização de conteúdo podem ter disponibilidades distintas (online Videira vs. máquina com Holyrics ligada).

## 5. Riscos e perguntas em aberto

### Riscos identificados

- **Perda/ambiguidade de conteúdo:** atual payload não inclui letra ou cifra; match por título pode escolher errado, por isso o fluxo já só aceita uma correspondência exata na busca do Holyrics.
- **Incremental incompleto:** timestamps/versionamento não têm API delta nem tombstones; deletar/alterar registros pode deixar cópias obsoletas no cliente.
- **Mudanças simultâneas:** setlist tem controle otimista na API interna, mas consumidores externos não recebem versão no payload Holyrics.
- **Segredos:** token bearer da integração permite acesso de leitura aos setlists publicados da organização, importação do catálogo e envio de relatórios; vazamento requer revogação. Token de API Holyrics também controla ações de playlist conforme permissões concedidas.
- **Aplicação não atômica:** ponte remove a playlist antes de adicionar e tenta restaurar em erro; a restauração também pode falhar. Recomenda-se prever dry-run, backup e confirmação/status no app desktop.
- **Disponibilidade:** fluxo depende de API web e do Holyrics aberto/API local autorizada; modo offline e retomada após desconexão não estão definidos.
- **Privacidade/licença:** `publicLyrics` sinaliza que letras podem ser públicas; ainda falta definir autorização para copiar/sincronizar conteúdo integral entre sistemas e retenção local.
- **Timezone:** regra de próxima data usa `America/Sao_Paulo`; clientes em outros fusos precisam preservar a semântica do evento.

### Perguntas para produto/arquitetura

1. O escopo do async-videira é apenas aplicar setlists publicados ao Holyrics, ou também espelhar biblioteca completa de músicas, cifras e letras?
2. Quais dados do setlist devem sincronizar (notas, tom selecionado, cifras alternativas, itens de texto) e como representar mudanças de ordem?
3. Deve haver sync de mão única Videira → SQLite Holyrics, ou resolução de conflitos/edição local em ambos os lados?
4. Qual latência de atualização, comportamento offline e estratégia de remoções/tombstones são esperados?
5. O servidor pode oferecer endpoint dedicado de snapshot/delta com versão/cursor e conteúdo autorizado, sem expor DB? Como tratar paginação, rate limit e tamanhos de letras?
6. Como mapear entidades Videira ↔ tabelas/IDs do SQLite do Holyrics com segurança, e quais versões do schema/cliente Holyrics serão suportadas? Há API oficial que evite escrita SQLite direta?
7. Qual modelo de identidade do desktop: um token por organização/instalação, OAuth/device flow ou login de usuário? Como revogar uma máquina perdida e armazenar segredo no Windows Credential Manager/macOS Keychain?
8. Quem autoriza exportar letras/cifras e manter cópias locais, especialmente músicas de origem compartilhada e conteúdo que não seja `publicLyrics`?
9. Qual canal de distribuição/atualização do app, assinatura de instaladores, telemetria e suporte a Windows/Mac?

## Referências do repositório

- `prisma/schema.prisma`
- `packages/contract/src/types/music.ts`, `packages/contract/src/types/setlist.ts`
- `server/src/holyrics/holyrics-setlists.controller.ts`, `holyrics-catalog.controller.ts`, `holyrics-tokens.controller.ts`, `holyrics-sync-reports.controller.ts`
- `server/src/lib/holyrics/setlist-integration-service.ts`
- `server/src/auth/integration-bearer.guard.ts`
- `integrations/holyrics/bridge/bridge.mjs`, `sync-logic.mjs`
- `docs/holyrics-integration.md`, `vercel.json`, `package.json`
