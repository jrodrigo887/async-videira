# Arquitetura alvo: camadas, portas/adaptadores e eventos

**Status:** proposta · **Data:** 2026-10-30 · **Complementa:** [architecture.md](architecture.md) (comportamento e regras de negócio), [ADR 0007](adr/0007-processos-ipc.md) e [contrato UI-core](contracts/ui-core-ipc.md). Não altera nenhuma regra de negócio já aprovada; muda **onde cada regra mora** e **quem depende de quem**.

## 1. Diagnóstico do código atual (~1,5 mil linhas de código fora UI, testes e protótipo)

O núcleo funcional é bom: `planSync` é puro, `executeSync` recebe o adaptador por parâmetro, há 8 arquivos de teste e fixtures. O problema está na **cola**, que cresceu sem camada própria.

| # | Sintoma | Onde | Princípio violado |
|---|---|---|---|
| 1 | `normalize` de texto implementado 5x (e a mesma regex em outros 2 pontos do protótipo) | `core/sync-plan.mjs:1`, `adapters/holyrics-api/client.mjs:223`, `core/help/index.mjs:19`, `ui/prototype` | DRY |
| 2 | `SYSTEM_SONG_ID` duplicado; filtro do item de sistema feito no adaptador **e** no CLI | `cli.mjs:10`, `holyrics-api/client.mjs:1` | DRY, regra de negócio no lugar errado |
| 3 | `makeClients` (leitura de env + criação de clientes) copiado | `cli.mjs:13`, `links.mjs:13` | DRY, DIP (use case conhece env e construtor concreto) |
| 4 | `plan.itemResults.find(songId === x)` repetido 3x; `String(entry.id ?? entry)` repetido 5x; `sameSequence`/`sameIds` repetidos | `links.mjs`, `holyrics-api/client.mjs`, `sync-plan.mjs` | DRY |
| 5 | `cli.mjs` (311 linhas) mistura: parse de argv, orquestração, projeção de payloads externos, fila de relatórios, persistência, formatação de texto e exit code | `cli.mjs` | SRP |
| 6 | O Electron **chama o CLI com um `stdout` falso** e devolve `text`; a UI recebe dados por um callback `onPrepared` pendurado | `main.mjs` (`worship.prepare/apply`) | Inversão errada: interface de entrada acoplada a outra interface de entrada |
| 7 | `main.mjs` (237 linhas) acumula: janela, cofre de credenciais, settings, validação de URL, log com allowlist, roteamento IPC por `if`, leitura de ajuda | `electron/main.mjs` | SRP, OCP (cada comando novo edita o `invoke`) |
| 8 | Erros mapeados por **regex na mensagem** (`/HTTP 401/`) e em 3 listas de códigos independentes (`logCodes`, `passthroughCodes`, `helpTopicForError`) | `main.mjs:safeErrorCode` | OCP, fonte única da verdade |
| 9 | Parser de frontmatter da ajuda existe em 4 lugares (`core/help`, `main.mjs`, `web-shim.js`, protótipo); o Electron nem usa o `core/help` testado | idem | DRY |
| 10 | Lista de comandos IPC escrita 3x: `preload.cjs`, `ipc` em `main.jsx`, `web-shim.js` | idem | DRY |
| 11 | Use cases (`links.mjs`) leem estado de disco e env a cada chamada e recebem `session` mutável por parâmetro | `links.mjs` | DIP, estado oculto |
| 12 | Estados (`resolved`, `absent`…) são strings soltas em objetos anônimos; invariantes ("nunca OK sem releitura") vivem dentro de `executeSync`, junto com I/O | `sync-plan.mjs` | Domínio anêmico/implícito |
| 13 | O contrato de eventos/progresso/`operationId`/`preparationId` do ADR 0007 não existe no código | — | Contrato aprovado não implementado |
| 14 | `ui/prototype` (≈2,5 mil linhas) e `ADR 0001` (Tauri) contradizem o que existe (Electron + React) | — | Dívida de documentação |

## 2. Decisões de arquitetura (o que entra e o que fica de fora)

Contexto que pesa: app de **um** operador, **uma** igreja, duas fontes externas de verdade (Videira e Holyrics), estado local é **só cache/fila**. Arquitetura demais custa mais que o problema.

| Padrão | Decisão | Motivo |
|---|---|---|
| Clean Architecture / camadas (domain → application → adapters) | **Sim** | O núcleo já é quase isso; falta formalizar e proibir imports no sentido errado. |
| Ports & Adapters (hexagonal) | **Sim, é o centro** | Há 2 sistemas externos, cofre, disco, relógio, shell. Cada um vira porta, o que também elimina `fetchImpl` espalhado e permite testes com fakes. |
| Service / Use case | **Sim** | Um use case por intenção do operador (Preparar, Aplicar, Confirmar vínculos…). Substitui `prepare()`/`applyPrepared()` do CLI e `links.mjs`. |
| Domain (core) com modelos explícitos | **Sim, enxuto** | Entidades/VOs com invariantes (`Preparation`, `SyncPlan`, `SongMatch`, `LibraryFingerprint`). Sem agregados formais nem repositórios genéricos. |
| Eventos de domínio (pub/sub síncrono em processo) | **Sim** | Resolve log espalhado (`appendLog` em 12 pontos), progresso da UI (ADR 0007), histórico de migração e fila de relatórios sem acoplar use cases. |
| **Event Sourcing completo** | **Não** | O estado verdadeiro está no Videira e no Holyrics; o JSON local é descartável por design ([architecture.md](architecture.md), "reconstruir o cache a partir das APIs"). Reprocessar eventos não traria nada e custaria schema de eventos, snapshots e upcasting. |
| **Journal de operação (event log só onde paga)** | **Sim, só no `apply`** | É a única operação destrutiva e não atômica. Registrar `ApplyStarted{backupIds,targetIds}` **antes** da primeira escrita permite recuperar de crash/queda de energia no meio do Remove+Add (hoje "recuperado por releitura" sem dado para restaurar). Detalhe em §6. |
| CQRS completo | **Não**; só separação leve | Comandos (mutam) e queries (ajuda, logs, settings) em pastas distintas. Sem bus nem read model. |
| Container de DI | **Não** | Um `composition-root` com fábricas manuais basta. |
| Monorepo / pacotes npm separados | **Não agora** | Pastas + regra de dependência verificada por teste. Reavaliar se surgir segundo shell (ADR 0001 ainda cita Tauri). |
| TypeScript | **Decidido e feito** (todo o projeto, `strict`; ver Andamento) · plano original: **Recomendado, incremental** | Começar com JSDoc `@typedef` nas portas + `// @ts-check` e `tsc --noEmit` no CI; migrar arquivo a arquivo. As portas são o ganho. |

## 3. Estrutura de pastas

> Os nomes de arquivo abaixo estão com `.mjs` por serem o desenho original; no código atual todos são `.ts` (e `.tsx` na UI), com os mesmos nomes e pastas.

```text
src/
  domain/                      # puro: sem node:*, sem fetch, sem Electron, sem Date.now()
    shared/
      text.mjs                 # normalizeText()  ← única implementação (elimina 5 cópias)
      ids.mjs                  # asId(), sameSequence(), uniqueIds()
      errors.mjs               # catálogo único de códigos + DomainError  (§7)
    catalog/
      holyrics-catalog.mjs     # SYSTEM_SONG_ID, projeção/filtragem do catálogo
    setlist/
      setlist.mjs              # entidade + projeção do payload Videira
    linking/
      song-matcher.mjs         # resolve(): externalId → sugestão exata → ambíguo/ausente
      link-offer.mjs           # regra "só confirma par oferecido na última preparação"
    sync/
      sync-plan.mjs            # planSync() (hoje core/sync-plan.mjs)
      sync-outcome.mjs         # política OK/PARTIAL/FAILED + reportItems (extraída de executeSync)
    library/
      fingerprint.mjs          # createLibraryFingerprint(), libraryMoved()
    preparation/
      preparation.mjs          # entidade; isStale(snapshotAtual) concentra o hash-check do apply
    events.mjs                 # fábricas dos eventos de domínio (§5)

  application/                 # orquestra; depende só de domain + ports
    ports/                     # contratos (JSDoc typedef); nenhum código de I/O
      videira-gateway.mjs      # listPublishedSetlists, getPublishedSetlist, sendSyncReport, confirmLinks, removeLink
      holyrics-gateway.mjs     # ping, getCatalog, getCurrentSchedule, getPlaylist, applyOrder, openSongEditor, awaitCreatedSong
      state-repository.mjs     # load(), save(mutator)  (checksum/atomicidade ficam no adaptador)
      credential-vault.mjs     # get(target), set(target, token), status()
      settings-repository.mjs
      audit-log.mjs            # append(event), list()
      help-catalog.mjs         # list/get/search
      clock.mjs                # now()
      event-bus.mjs            # publish(event), subscribe(type, handler)
    use-cases/
      prepare-worship.mjs
      apply-worship.mjs
      recover-interrupted-apply.mjs
      confirm-song-links.mjs
      remove-song-link.mjs
      open-song-editor.mjs
      await-created-song.mjs
      check-connection.mjs
      settings.mjs             # get / update
      credentials.mjs          # set / status
      help.mjs                 # list / get / search
    services/
      report-outbox.mjs        # fila de sync-reports (flush, retry, expiração) — sai do cli.mjs
      operation-runner.mjs     # 1 operação mutável por vez, fases, cancelamento (ADR 0007)
      preparation-guard.mjs    # revalida setlist/catálogo/fingerprint/destino antes de aplicar
    subscribers/
      audit-projector.mjs      # evento → linha de log (allowlist em um só lugar)
      migration-history.mjs    # LinkConfirmed/Removed → histórico oldId→newId
      progress-forwarder.mjs   # evento → operation.phase/progress para a UI

  adapters/                    # implementam as portas (I/O mora aqui)
    videira-http/              # client.mjs atual + mapeamento payload→domínio (anti-corruption)
    holyrics-http/             # client.mjs atual; retry/readUntil/restore ficam aqui
    state-file/                # store.mjs atual (envelope, checksum, escrita atômica)
    vault-electron/            # safeStorage
    settings-file/
    audit-jsonl/               # rotação 512 KiB × 4 — sai do main.mjs
    help-fs/                   # usa core/help (já testado) — único parser de frontmatter
    clock-system/

  interface/                   # adaptadores de ENTRADA (driving)
    cli/
      main.mjs                 # parse argv → chama use case → presenter de texto
      presenter.mjs            # formata plano e resultado (showPlan)
    electron/
      main.mjs                 # só ciclo de vida + janela + composição
      window.mjs               # BrowserWindow, CSP, will-navigate
      ipc/
        router.mjs             # registra handlers; valida schema; mapeia erro → CoreError
        commands.mjs           # MANIFESTO único: nome, schema de entrada, handler, mutável?
        error-mapper.mjs       # DomainError.code → { messageKey, retryable, helpTopicId }
      preload.cjs              # gerado/derivado do manifesto
    renderer/                  # React (§8)

  composition/
    container.mjs              # monta adaptadores + use cases (env, Electron, teste)
```

**Regra de dependência (verificada em teste, §9):**
`domain` ← `application` ← `adapters` e `interface` ← `composition`. `domain` importa só `domain`. `application` importa `domain` e as próprias `ports`. `adapters` nunca importam `interface`. `interface/*` nunca importa `adapters/*` diretamente (recebe use cases prontos do `composition`).

```text
        ┌────────────── interface (CLI · Electron IPC) ──────────────┐
        │  traduz entrada → comando; saída → apresentação/CoreError  │
        └───────────────┬────────────────────────────────────────────┘
                        ▼
        ┌────────────── application ────────────────────────────────┐
        │ use-cases · services · subscribers        ports (contratos)│
        └───────────────┬───────────────────────────────▲───────────┘
                        ▼                               │ implementa
        ┌────────────── domain (core) ──────┐   ┌───────┴────────────┐
        │ entidades · regras · eventos      │   │ adapters (I/O)     │
        └───────────────────────────────────┘   │ Videira · Holyrics │
                                                │ State · Vault · FS │
                                                └────────────────────┘
```

## 4. SOLID aplicado a pontos concretos

- **S** — `cli.mjs` vira 4 responsabilidades em 4 lugares: `PrepareWorship`/`ApplyWorship` (orquestrar), `ReportOutbox` (fila), `presenter` (texto), `interface/cli/main` (argv). `main.mjs` do Electron perde cofre, settings, log e ajuda para adaptadores próprios.
- **O** — Hoje, novo comando IPC = editar o `if` gigante de `invoke`. Com `commands.mjs`, é **adicionar uma entrada** `{ name, schema, mutating, handler }`; router, preload e shim derivam dele. Novo tipo de erro = uma linha no catálogo (§7), não 3 listas.
- **L** — Toda implementação de `HolyricsGateway`/`VideiraGateway` (HTTP real, fake em memória, replay de fixtures) obedece ao mesmo **teste de contrato** (§9); o use case não distingue.
- **I** — Portas pequenas e por papel. O use case de "abrir editor" não depende da porta que aplica playlist. Hoje `createHolyricsClient` devolve um objeto único com 7 métodos usados por consumidores diferentes; dividir em `HolyricsCatalogReader`, `HolyricsPlaylistWriter`, `HolyricsSongEditor` (um adaptador pode implementar as 3).
- **D** — Use cases recebem portas no construtor; ninguém lê `process.env` fora de `composition`. `links.mjs` deixa de chamar `readState(getDefaultStatePath(env))` e `createVideiraClient(...)`.

## 5. Domínio e eventos

### Modelo (explícito em vez de objetos anônimos)

- `SongKey` (VO): `{ title, artist }` já normalizado por `normalizeText`. Substitui as 5 normalizações.
- `SongMatch`: união discriminada `Resolved | Suggested | Ambiguous | Absent`, com `staleExternalId` como atributo. `song-matcher.resolve()` devolve isso; `planSync` só compõe.
- `SyncPlan`: `itemResults`, `targetIds`, `mutates`. Permanece pura.
- `SyncOutcome` (`sync-outcome.mjs`): recebe plano + resultado da escrita/releitura e devolve `status` + `reportItems`. Extrai de `executeSync` os 3 caminhos que repetem a montagem de `reportItems`.
- `Preparation`: `{ id, setlistId, hashes, fingerprint, schedule, plan, expiresAt }` + `isStale(current)` — o `if` de 4 hashes do `applyPrepared` vira método testável de domínio.
- `LibraryFingerprint`: criação + `moved(previous)`.
- `LinkOffer`: `offeredIds(item, createdIds)` e `canConfirm(pair)`, regra que hoje está em `links.mjs`.

### Eventos de domínio

Imutáveis, nome no passado, publicados pelo use case **depois** da mudança durável.

| Evento | Publicado por | Consumidores |
|---|---|---|
| `PreparationCreated {setlistId, counts}` | PrepareWorship | audit, progress |
| `LibraryMoved {from,to}` / `ReconciliationStarted` | PrepareWorship | audit, migration-history |
| `LinksConfirmed {pairs[]}` / `LinkRemoved {songId, old}` | ConfirmSongLinks / RemoveSongLink | audit, migration-history |
| `ApplyStarted {backupIds, targetIds}` | ApplyWorship (antes de escrever) | journal (§6), progress |
| `PlaylistApplied {verified}` / `PlaylistRestored {ok}` | ApplyWorship | audit, progress |
| `SyncReportSent` / `SyncReportQueued {attempt}` | ReportOutbox | audit |
| `OperationPhaseChanged`, `OperationProgress` | OperationRunner | progress-forwarder → IPC `operation.*` |

Efeito imediato: os 12 `appendLog(...)` espalhados em `main.mjs` somem; `audit-projector` mapeia evento → linha com a **allowlist num único lugar**.

## 6. Journal do apply (o "event source" que vale a pena)

```text
ApplyWorship
  1. PreparationGuard.assertFresh()          ← falha cedo: DESTINATION_CHANGED / CATALOG_CHANGED…
  2. backup = holyrics.getPlaylist()
  3. state.journal = { phase:"started", backupIds, targetIds, at }   ← durável ANTES de escrever
  4. holyrics.applyOrder(targetIds)          (Remove + Add + releitura)
  5. SyncOutcome.from(...)                   → OK | PARTIAL | FAILED
  6. state.journal = { phase:"done", status }   ; ReportOutbox.send/queue
```

Na inicialização, `RecoverInterruptedApply` vê `phase:"started"` sem `done`: relê a playlist, compara com `backupIds` e `targetIds` e propõe **restaurar** (a UI pede confirmação; nunca presume sucesso). Isso cumpre o que o ADR 0007 promete ("encerramento forçado é recuperado por releitura") com dados suficientes para recuperar de fato, sem adotar ES para o resto.

## 7. Erros: uma fonte da verdade

`domain/shared/errors.mjs` define o catálogo (o mesmo conjunto do contrato IPC):

```js
export const ERRORS = {
  AUTH_REQUIRED:      { retryable: false, messageKey: "credentials.required", helpTopic: "configurar-videira" },
  AUTH_REJECTED:      { retryable: false, messageKey: "credentials.rejected" },
  SERVICE_UNAVAILABLE:{ retryable: true,  messageKey: "service.unavailable" },
  // …
};
export class DomainError extends Error { constructor(code, details) { /* code ∈ ERRORS */ } }
```

- Adaptadores **traduzem na borda**: o cliente Videira lança `DomainError("AUTH_REJECTED")` ao ver HTTP 401 (hoje o `main.mjs` faz regex no texto da mensagem).
- `error-mapper.mjs` (Electron) e `presenter.mjs` (CLI) só leem o catálogo; `logCodes`, `passthroughCodes`, `helpTopicForError` e o `safeErrorCode` por regex deixam de existir.

## 8. Renderer e contrato UI↔core

- **Manifesto único** `interface/electron/ipc/commands.mjs`: lista de comandos com schema. Dele derivam (a) o router do main, (b) `preload.cjs`, (c) o `web-shim.js`, (d) o mapa `ipc` de `main.jsx`. Elimina a triplicação (achado #10) e dá validação de entrada dos dois lados, como o contrato pede.
- UI por funcionalidade (`culto/`, `vinculos/`, `ajustes/`, `ajuda/`, `historico/`), cada uma com seus componentes, hook de dados e testes; `shared/ui` para `Icon`, `plural`, diálogo. `main.jsx` fica só com roteamento e tema (hoje 272 linhas incluindo `ConfirmApply`).
- `ui/prototype/` sai do pacote e do repositório principal (ou vai para `docs/design/prototype/` congelado); a Ajuda usa **um** parser (`adapters/help-fs`; no navegador, o mesmo parser sobre `import.meta.glob`).

## 9. Qualidade e testes

| Camada | Estratégia |
|---|---|
| domain | Testes unitários puros e rápidos; os de `sync-plan` e `fixtures/sync-core-cases.json` migram sem mudança de expectativa. Opcional: property tests em `normalizeText` e `planSync` (idempotência, "nunca duplica ID"). |
| application | Use cases com **fakes em memória** das portas (`FakeHolyrics`, `FakeVideira`, `InMemoryState`, `FixedClock`). Cenários de `apply-resilience.test.mjs` passam a rodar sem HTTP. |
| ports | **Suíte de contrato** parametrizada: roda os mesmos casos contra o fake e contra o adaptador real (este, via `fake-holyrics-proxy.mjs` já existente). Garante L. |
| adapters | Testes de integração atuais (`holyrics-api`, `videira-client`, `state`) permanecem. |
| interface | `cli.integration.test.mjs` e `smoke.mjs` continuam como testes ponta a ponta de regressão durante toda a migração. |
| arquitetura | Teste que varre `import` de cada arquivo e falha se violar a regra de dependência (§3). Pode ser `eslint-plugin-import`/`no-restricted-paths` ou ~30 linhas de Node. |

## 10. Plano de migração (estrangulamento, sempre verde)

Cada fase termina com `npm test` e `npm run smoke` passando e pode ser um PR independente.

| Fase | Entrega | Risco | Resultado |
|---|---|---|---|
| 0 | Teste de dependência (só para `domain`), `@ts-check` nas portas | baixo | Trava de qualidade |
| 1 | **Domain**: mover `sync-plan`, criar `shared/text.mjs`, `SYSTEM_SONG_ID`, `ids.mjs`, `fingerprint`, `sync-outcome`; adaptadores passam a importar daí | baixo (só move código) | Achados 1, 2, 4, 12 resolvidos |
| 2 | **Portas + use cases**: `PrepareWorship`/`ApplyWorship`/`ReportOutbox` fora do `cli.mjs`; `links.mjs` → 4 use cases; `composition/container.mjs`; CLI vira interface fina + presenter | médio (maior diff) | Achados 3, 5, 6, 11; Electron deixa de usar stdout falso e recebe dados estruturados |
| 3 | **Catálogo de erros + router IPC**: `errors.mjs`, `commands.mjs`, `error-mapper`; cofre, settings, audit e ajuda viram adaptadores; `main.mjs` encolhe | médio | Achados 7, 8, 9, 10 |
| 4 | **Eventos + OperationRunner + journal**: bus em processo, subscribers, `operation.*`, `RecoverInterruptedApply` | médio | Achado 13; ADR 0007 cumprido |
| 5 | **Renderer por funcionalidade**, remover `ui/prototype`, atualizar ADR 0001 e `architecture.md` | baixo | Achado 14 |

Ordem recomendada: 0 → 1 → 2 (já entrega a maior parte do valor) → 3 → 4 → 5. A fase 4 pode ser antecipada se a UI de progresso for prioridade de produto.

### Andamento

- **Fase 1 — feita** (`src/domain/*`, `execute-sync`, teste de dependência).
- **Fase 2 — feita.** `prepareWorship`, `applyWorship`, `confirmSongLinks`, `removeSongLink`, `openSongEditor`, `awaitCreatedSong` em `src/application/use-cases/`; `ReportOutbox` em `application/services/`; portas documentadas em `application/ports/index.mjs`; `adapters/state-file/repository.mjs`; `composition/container.mjs` (clientes criados sob demanda); `interface/cli/{args,presenter}.mjs`. `src/cli.mjs` e `src/links.mjs` ficaram como fachadas finas (os testes e o Electron continuam chamando as mesmas assinaturas). O Electron usa o container e o presenter direto, sem `stdout` falso nem `onPrepared`. Desvios do plano: as portas são typedefs JSDoc num arquivo único; `cli.mjs` fica na raiz de `src/` por ser o ponto de entrada; `store.mjs` segue em `src/state/` (o adaptador o envolve).
- **Fase 3 — feita.** Catálogo único de erros em `domain/shared/errors.mjs` (chave de mensagem, retry, tópico de ajuda e allowlist do log); `error-topics.json` e as 3 listas de códigos do `main.mjs` foram removidos. Adaptadores classificam na borda (HTTP 401 → `AUTH_REJECTED`, 5xx/sem resposta → `SERVICE_UNAVAILABLE`, token ausente → `AUTH_REQUIRED`, sem setlist → `NO_SETLIST`); nada mais lê o texto da mensagem. Novos: `domain/{audit,settings,help}`, use cases `settings`, `credentials`, `check-connection`, `help`, `open-external-link`, adaptadores `audit-jsonl`, `settings-file`, `vault-electron` (`safeStorage` injetado), `help-fs`, `composition/desktop-container.mjs`, e `interface/electron/ipc/{commands,router,error-mapper}.mjs`. `electron/main.mjs` caiu de 237 para ~45 linhas (janela em `window.mjs`, smoke em `smoke-hook.mjs`). O preload expõe só `invoke(command, payload)`: a allowlist e a validação ficam no manifesto do processo principal, a UI chama por nome, e o shim do navegador usa o mesmo parser/casos de uso da Ajuda. Mudanças de comportamento: `HOLYRICS_NOT_RUNNING` agora é `retryable`; erros antes classificados como `INTERNAL` por falta de código passam a ter o código real; a busca da Ajuda no app agora é ranqueada e ignora acentos; comando IPC desconhecido responde `INVALID_REQUEST`.
- **Migração para TypeScript — feita** (decisão do dono do projeto, 2026-10-30). Todo `src/`, `electron/`, `scripts/`, `tests/` e a UI viraram `.ts`/`.tsx` com `strict`, `verbatimModuleSyntax` e `erasableSyntaxOnly` (o Node executa os `.ts` direto: testes e CLI rodam sem compilar). As portas deixaram de ser typedefs JSDoc e são `interface`s reais em `application/ports/index.ts`, usadas pelos adaptadores (`implements` estrutural) e pelos use cases (que declaram só o recorte de dependências que usam: `SettingsDeps`, `ConnectionDeps`, `HelpDeps`…). O manifesto IPC é tipado (`IpcCommand<Input>`, `defineCommand`) e a UI tem um mapa de comandos tipado em `src/ui/app/api.ts`. Electron e a CLI empacotada vêm de `tsc -p tsconfig.build.json` para `out/` (`npm run build:main`); o `package.json` aponta `main` para `out/electron/main.js` e o preload é `electron/preload.cts` → `preload.cjs`. A regra de arquitetura passou a permitir que `adapters` importem **só** `application/ports/` (contratos, apenas tipos); use cases, interface e composition continuam proibidos.
- **Fase 4 — feita (com um corte).** Eventos de domínio em `domain/events.ts`; porta `EventBus` e bus em processo `adapters/event-bus` (assinante que falha não derruba a operação); `runOperation` (`application/services/events.ts`) envolve preparar, aplicar e testar conexão com `OperationStarted/Succeeded/Failed`; os 12 `audit.append` dos comandos IPC sumiram e o log passou a ser uma projeção (`audit-projector.ts`, allowlist continua em `sanitizeAuditEntry`). Use cases publicam `PreparationCreated`, `ApplyStarted`, `PlaylistApplied/Restored`, `LinksConfirmed`, `LinkRemoved`, `SettingsUpdated`, `CredentialsSaved`. **Journal do apply**: `AppState.journal` (`started{backupIds,targetIds}` gravado antes da primeira escrita via `executeSync({beforeWrite})`, `done{status}` no fim) e `RecoverInterruptedApply` (`inspect` | `restore` | `dismiss`, nunca automático) exposto como `worship.recover`; a UI mostra um aviso na abertura. O backup do journal é o mesmo `current` lido pelo `executeSync` (uma só fonte). **Cortado:** o encaminhamento de `OperationPhaseChanged` para a UI (`operation.*` por push). Os eventos de fase já são publicados no bus; falta um `progress-forwarder` + `webContents.send` + `onEvent` no preload, só quando houver uma tela de progresso a alimentar.
- **Fase 5 — feita.** Renderer por funcionalidade em `src/ui/app/features/{culto,vinculos,ajustes,ajuda,historico}` (tela + hook `use-*.ts`) e `shared/` (`api`, `ui`, `use-theme`, `web-shim`); `main.tsx` caiu de 265 para ~120 linhas (rotas, tema, atalhos, abertura); regra "funcionalidade não importa funcionalidade" verificada em `tests/architecture.test.ts`. `ui/prototype` foi **arquivado** (não apagado, pois não há controle de versão no diretório) em `docs/design/prototype/`, fora do build e do `tsc`. ADR 0001 marcado como substituído pelo 0005; `architecture.md` e ADR 0007 atualizados.

## 11. Riscos e como mitigar

- **Over-engineering** em app pequeno → portas só onde há I/O real (9 portas), sem bus assíncrono, sem container, sem repositórios genéricos. Se uma porta tiver uma só implementação *e* nenhum fake útil, juntar com o vizinho.
- **Regressão no apply** (operação destrutiva) → fase 2 não muda `applyOrder`; os testes `apply-resilience` e `cli.integration` são o contrato de caracterização.
- **Eventos virando fluxo de controle escondido** → eventos só *notificam* (log, progresso, histórico); decisões de negócio ficam nos use cases.
- **Dois "backups" divergentes** (memória do adaptador vs. journal) → o journal grava o backup lido pelo use case e o repassa ao adaptador; uma só fonte.

## 12. Perguntas abertas

1. ~~Confirmar Electron como stack definitiva~~ **Registrado**: ADR 0001 está marcado como substituído pelo 0005. Se Tauri voltar, a camada `domain`+`application` em JS não é reaproveitável, o que muda o peso da fase 1–2.
2. ~~TypeScript ou JSDoc?~~ **Decidido e executado: TypeScript em todo o projeto** (2026-10-30).
3. ~~`ui/prototype`: apagar ou arquivar?~~ **Arquivado** em `docs/design/prototype/`; apagar de vez quando o repositório estiver sob controle de versão.
