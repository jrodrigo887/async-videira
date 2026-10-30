# Contrato inicial UI ↔ core

**Versão:** `1` · **Status:** proposta para alinhamento com `docs/design/view-models.md`.

Este é um contrato lógico, independente do mecanismo Electron. A UI renderer só acessa a API da preload. Todos os schemas são validados nos dois lados; campos desconhecidos são rejeitados. IDs e tokens são strings opacas. Nenhum token é retornado em resposta, evento, erro ou log.

## Envelope e regras

Todo comando leva `{ requestId: string, payload: ... }`; toda resposta leva `{ requestId, ok: true, data }` ou `{ requestId, ok: false, error: CoreError }`. Comandos longos retornam `operationId`; eventos levam `{ operationId, sequence, at, type, data }`. `sequence` cresce monotonicamente por operação. A UI pode reconectar ao estado atual da operação pelo comando `operation.get`.

Datas são ISO-8601 UTC. Tamanho máximo inicial de payload IPC: 1 MiB; artefatos de diagnóstico são retornados por referência temporária controlada, nunca como caminho arbitrário.

## Comandos

| Comando | Entrada principal | Resultado |
|---|---|---|
| `connection.check` | `{ target: "videira"|"holyrics" }` | versão/estado de conectividade e permissões ausentes; sem segredos |
| `service.credentials.set` | `{ target, token }` | `{ configured: true }`; token consumido pelo main e nunca devolvido |
| `service.credentials.clear` | `{ target }` | `{ configured: false }` |
| `service.credentials.status` | `{}` | status booleano por serviço, sem identificador de segredo |
| `worship.prepare` | `{ setlistId?: string, freshness: "online-required"|"allow-cached" }` | `operationId`; resultado `Preparation` e planos de vínculo |
| `songLinks.confirmBatch` | `{ preparationId, confirmations: [{ videiraSongId, holyricsSongId }] }` | `operationId`; vínculos aceitos/rejeitados por item; apenas confirmações explícitas |
| `song.openEditor` | `{ title, artist, lyrics?: string|null }` | `{ ok: true }` ou `CoreError`; abre o editor local do Holyrics, sem salvar a música |
| `song.awaitCreated` | `{ previousCatalog: HolyricsSong[], title, artist }` | `{ state: "created", song: HolyricsSong }`, `{ state: "not-found", song: null }` ou `{ state: "ambiguous", songs: HolyricsSong[] }` |
| `library.reconcile` | `{ mode: "preview"|"confirm", confirmations?: [...] }` | `operationId`; preview de migração ou migrações confirmadas e histórico |
| `worship.apply` | `{ preparationId, destinationConfirmation: { selectedScheduleId?, label, confirmedAt }, allowPartial: boolean }` | `operationId`; executa apenas plano ainda válido; revalida setlist, catálogo e destino corrente |
| `operation.cancel` | `{ operationId }` | `{ accepted: boolean, phase }`; em `applying` pode rejeitar cancelamento |
| `operation.get` | `{ operationId }` | snapshot de fase, progresso e resultado disponível |
| `diagnostics.preview` | `{}` | categorias/campos que entrarão no export, sem criar arquivo |
| `diagnostics.export` | `{ includeLogs: boolean, redactMore?: boolean }` | referência temporária ao arquivo local e resumo; não envia para fora |
| `help.list` | `{}` | metadados dos tópicos empacotados: `id`, `title`, `summary`, `keywords`, `context` |
| `help.get` | `{ topicId }` | `{ topicId, title, markdown }`; conteúdo validado local, sem HTML confiável |
| `help.search` | `{ query, limit?: number }` | tópicos e trechos ranqueados pelo índice JSON local, sem rede |
| `logs.list` | `{}` | até 300 eventos locais redigidos, sem caminho de arquivo ou conteúdo sensível |
| `app.diagnosticInfo` | `{}` | resumo copiável sem segredos; a UI só copia após ação explícita |
| `externalLink.open` | `{ url }` | `{ opened: boolean }`; main valida esquema/host e abre navegador do sistema |
| `settings.get` / `settings.update` | preferências não secretas e schema versionado | configurações suportadas; não contém tokens |

`preparationId` é opaco, local, expirável e invalidado se setlist, catálogo, destino ou vínculos relevantes mudarem. `destinationConfirmation` registra confirmação humana; o core deve obter novamente o destino corrente imediatamente antes de escrever. Aplicar exige que todas as pendências estejam resolvidas, salvo fluxo parcial explicitamente habilitado e confirmado na UI.

## Modelos

`SongState = "resolved" | "ambiguous" | "absent" | "repeated"`.

`SongItem`: `{ videiraSongId, title, artist?, state, holyricsSongId?, candidates: [{ id, title, artist?, match: "linked"|"exact"|"approximate" }], occurrence: number, reasonCode? }`.

`Preparation`: `{ preparationId, setlist: { id, title, serviceDate? }, destination: { label, selectedScheduleId? }, catalog: { count, fingerprint, readAt }, items: SongItem[], targetIds: string[], duplicateCount, canApply, expiresAt }`.

`ApplyResult`: `{ status: "verified"|"partial"|"failed"|"restore-failed", expectedIds, observedIds, outcomes: [{ videiraSongId, outcome: "added"|"duplicate"|"skipped"|"failed", reasonCode? }], report: "sent"|"queued"|"failed" }`. `verified` só é permitido após releitura igual à sequência deduplicada esperada.

`song.openEditor` só chama `POST /api/popup-createsong` em loopback, sem token Holyrics e com timeout curto. `lyrics` é opcional na IPC para manter compatibilidade com a tela de ausentes em `docs/design/view-models.md`; quando vazio/ausente o núcleo envia o placeholder literal `[Letra não fornecida]` porque a API exige `lyrics` ou `paragraphs`. Esse placeholder informa ausência de letra; não é conteúdo inventado. A rota só abre o formulário, e a música só passa a existir após o operador salvá-la no Holyrics. Chamadas são espaçadas em pelo menos 2 segundos.

`song.awaitCreated` recebe o snapshot `previousCatalog` capturado antes de abrir o editor. O núcleo relê `GetSongs` e considera somente IDs novos com título e artista normalizados exatamente iguais. Não vincula a música ao Videira: `state: "created"` é somente uma candidata para confirmação explícita posterior. Zero candidatas retorna `not-found`; mais de uma retorna `ambiguous` com todas as candidatas para escolha humana.

## Eventos

- `operation.phase`: `{ phase: "connecting"|"fetching-setlist"|"reading-catalog"|"resolving"|"awaiting-review"|"validating"|"backing-up"|"applying"|"verifying"|"restoring"|"reporting"|"complete" }`.
- `operation.progress`: `{ completed, total, unit: "songs"|"requests"|"steps", messageKey }`. A UI traduz `messageKey` para pt-BR e não interpreta texto arbitrário do core como HTML.
- `operation.item`: `{ item: SongItem }` para atualização incremental da preparação/reconciliação.
- `operation.warning`: `{ code, details?: Record<string,string|number|boolean> }`.
- `operation.finished`: `{ status, result? }`; `operation.failed`: `{ error: CoreError }`; `operation.cancelled`: `{ safeToClose: boolean, playlistMayHaveChanged: boolean }`.

## Erros tipados

`CoreError = { code, messageKey, retryable, correlationId, details?, helpTopicId?: string }`. `helpTopicId` é opcional, validado contra os IDs do bundle; se ausente/inválido, a UI oferece a ajuda inicial. `details` é limitado a códigos/campos não secretos e nunca inclui header, token, body HTTP integral ou stack trace.

Códigos: `AUTH_REQUIRED`, `AUTH_REJECTED`, `PERMISSION_MISSING`, `SERVICE_UNAVAILABLE`, `HOLYRICS_NOT_RUNNING`, `DESTINATION_CHANGED`, `SETLIST_CHANGED`, `CATALOG_CHANGED`, `PREPARATION_EXPIRED`, `SONG_AMBIGUOUS`, `SONG_ABSENT`, `RECONCILIATION_REQUIRED`, `CONFLICT`, `OPERATION_BUSY`, `CANCEL_NOT_SAFE`, `TIMEOUT`, `RATE_LIMITED`, `INVALID_RESPONSE`, `EDITOR_ALREADY_OPEN`, `EDITOR_UNSUPPORTED`, `EDITOR_FAILED`, `STATE_CORRUPT`, `STATE_UNSUPPORTED`, `APPLY_FAILED`, `VERIFY_FAILED`, `RESTORE_FAILED`, `REPORT_QUEUED`, `HELP_TOPIC_NOT_FOUND`, `HELP_INDEX_INVALID`, `EXTERNAL_LINK_BLOCKED`, `INTERNAL`.

## Concorrência, cancelamento e timeouts

Somente uma operação mutável por vez; outra retorna `OPERATION_BUSY`. Preparações concorrentes são serializadas para evitar corrida sobre JSON/fingerprint. Vínculos em lote são uma transação lógica com resultado item a item; conflito não sobrescreve vínculo silenciosamente.

Timeout inicial configurável e mensurável: conexão/uma chamada HTTP 10 s; operação Videira 30 s; aplicação total 90 s, incluindo estabilização/releitura; restauração pode estender até 60 s. Não aplicar timeout cego durante escrita. Releitura é repetida com backoff curto até sequência estável ou limite. Cancelamento é aceito antes de `applying`; depois disso, terminar verificação e restauração. Encerramento forçado é recuperado por releitura no próximo início e nunca presume sucesso.

## Ajuda offline

Ajuda é conteúdo local empacotado na mesma versão do app. `help.list/get/search` nunca fazem rede. Renderer desenha Markdown sem HTML bruto e links internos navegam por `topicId` validado. Links externos só abrem por `externalLink.open`; o main permite HTTPS apenas para hosts aprovados, recusa credenciais na URL e redirecionamentos a hosts não permitidos, e encaminha ao navegador padrão do SO. `app.diagnosticInfo` retorna somente versão/build, SO, estados booleanos de configuração/conectividade, versão Holyrics conhecida e códigos/correlation IDs; não retorna token, hostname/IP, caminhos locais ou conteúdo musical. A cópia para clipboard requer ação explícita do usuário.

## Segurança da ponte

Renderer sem `nodeIntegration`, com sandbox, `contextIsolation`, CSP local e sem conteúdo remoto. Preload expõe funções nomeadas, sem `ipcRenderer` genérico. Main permite destinos HTTPS Videira configurados e loopback Holyrics; rejeita redirecionamento para host externo, protocolo não esperado e URL contendo credencial. Validar limites, tipos e tamanho antes de iniciar operação. Segredos entram somente pelo canal de credenciais e são guardados diretamente no cofre do SO.
## Mapa inicial de erros para ajuda

IDs abaixo são estáveis e devem existir no front matter. Campo opcional; manter fallback quando um erro ainda não tem artigo.

| `CoreError.code` | `helpTopicId` |
|---|---|
| `AUTH_REQUIRED`, `AUTH_REJECTED` | `configurar-credenciais` |
| `PERMISSION_MISSING`, `HOLYRICS_NOT_RUNNING` | `configurar-holyrics` |
| `SERVICE_UNAVAILABLE`, `TIMEOUT` | `verificar-conexao` |
| `DESTINATION_CHANGED` | `selecionar-culto-destino` |
| `SONG_AMBIGUOUS`, `SONG_ABSENT`, `RECONCILIATION_REQUIRED` | `resolver-musicas` |
| `APPLY_FAILED`, `VERIFY_FAILED`, `RESTORE_FAILED` | `aplicar-e-recuperar` |
| `STATE_CORRUPT`, `STATE_UNSUPPORTED` | `dados-locais-e-suporte` |
## Ajuda contextual


Se `CoreError.helpTopicId` estiver presente e corresponder a `help.list`, a UI mostra link contextual para `help.get`; o erro continua utilizável sem esse campo. `F1` abre Ajuda no Windows; `Cmd+?` (com fallback `Cmd+/` conforme layout) no macOS. Menu Ajuda e boas-vindas de primeira execução são responsabilidade da UI. A primeira execução é marcada como vista em preferência local não secreta.

## Alinhamento pendente com design

Os comandos `song.openEditor` e `song.awaitCreated` alimentam a linha `missing`/`importOptions` de `docs/design/view-models.md` (§4), e `awaitCreated` devolve uma sugestão que segue o fluxo de confirmação de vínculo (§4); não alteram `src/ui` nem os view models. `song.openEditor` é o nome IPC para a operação de design `openHolyricsEditor` (§13): mantém `{title, artist}`, aceita `lyrics` opcional e mapeia `{ opened: true }` do adapter para `{ ok: true }` na fronteira IPC. O placeholder é interno; a UI não precisa criar nem enviar letra fictícia. A UI deve mostrar os códigos tipados como mensagens localizadas.
