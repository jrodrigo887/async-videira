# View-models: contrato de dados das telas

> **Para:** aba de arquitetura, para validar o que o núcleo (`src/core`, `src/adapters`, `src/state`) deve expor à UI.
> **Regra:** a UI não chama a API do Holyrics nem a do Videira; ela recebe estes objetos e envia **comandos** (seção 13). Textos de interface são derivados na UI a partir de códigos; o núcleo não devolve frases.
> **Convenções:** datas ISO 8601 com fuso (`2026-11-01T10:00:00-03:00`); IDs Holyrics sempre `string`; campos ausentes = `null`, não omitidos; enums em `camelCase` minúsculo. O protótipo (`docs/design/prototype/data.js`) usa exatamente estas formas.

## 0. Tipos compartilhados

```jsonc
// SongRef — uma música de um dos lados
{ "title": "É Ele", "artist": "DROPS" }

// HolyricsSong
{ "id": "1792693855260", "title": "E Ele", "artist": "DROPS", "archived": false }

// Connection
{
  "status": "ok" | "checking" | "unreachable" | "tokenInvalid" | "permissionMissing" | "offline" | "notConfigured",
  "checkedAt": "2026-11-01T09:38:12-03:00",
  "detail": { /* por serviço, ver AppShell */ }
}

// AppError — toda falha que a UI mostra
{
  "code": "HOLYRICS_UNREACHABLE",       // enum fechado, ver tabela abaixo
  "severity": "error" | "warning" | "info",
  "retryable": true,
  "params": { "missing": ["GetCurrentSchedule"] },   // variáveis da mensagem
  "technical": { "at": "…", "message": "ECONNREFUSED 127.0.0.1:8091", "holyricsVersion": "2.30.0" } // nunca contém token
}
```

`AppError.code` (enum fechado): `HOLYRICS_UNREACHABLE`, `HOLYRICS_TOKEN_INVALID`, `HOLYRICS_PERMISSION_MISSING`, `HOLYRICS_TIMEOUT`, `VIDEIRA_OFFLINE`, `VIDEIRA_TOKEN_INVALID`, `VIDEIRA_NO_SETLIST`, `DESTINATION_SUSPECT`, `DESTINATION_CHANGED`, `SETLIST_CHANGED`, `PLAN_REQUIRED`, `LIBRARY_PARTIAL`, `LINK_SAVE_FAILED`, `APPLY_FAILED`, `VERIFY_MISMATCH`, `RESTORE_FAILED`, `STATE_CORRUPTED_REBUILT`.

## 1. AppShell (sempre presente)

```jsonc
{
  "configured": true,                       // false → T0
  "connections": {
    "holyrics": { "status": "ok", "checkedAt": "…", "detail": { "version": "2.30.0", "port": 8091, "songCount": 29, "plan": "none" } },
    "videira":  { "status": "ok", "checkedAt": "…", "detail": { "organizationName": "Igreja Videira Centro" } }
  },
  "pendingReportsCount": 0,
  "reconciliation": { "active": false, "affectsCurrentSetlist": false, "count": 0 },
  "theme": "system" | "light" | "dark",
  "fontScale": 1 | 1.15 | 1.3,
  "appVersion": "0.1.0"
}
```

## 2. Onboarding (T0)

```jsonc
{
  "step": "welcome" | "holyrics" | "videira" | "done",
  "holyrics": {
    "port": 8091,
    "tokenSaved": false,
    "test": null | {
      "result": "ok" | "unreachable" | "tokenInvalid" | "permissionMissing",
      "version": "2.30.0",
      "songCount": 29,
      "requiredPermissions": ["GetVersion","GetTokenInfo","GetAPIServerInfo","GetHolyricsPlanInfo","SearchLyrics","GetSongs","GetLyrics","GetLyricsPlaylist","AddLyricsToPlaylist","RemoveFromLyricsPlaylist","GetCurrentSchedule"],
      "missingPermissions": [],
      "extraPermissions": ["ActionNext","ActionPrevious"],   // aviso, não bloqueia
      "permissionRequestOpened": true,                        // CheckPermissions abriu popup no Holyrics
      "lanExposed": true                                      // servidor escuta em 0.0.0.0 → mostrar aviso
    }
  },
  "videira": {
    "tokenSaved": false,
    "test": null | { "result": "ok" | "tokenInvalid" | "offline", "organizationName": "Igreja Videira Centro", "nextSetlist": { "title": "Culto de domingo — manhã", "eventAt": "…" } }
  },
  "reminder": { "enabled": true, "weekday": 0, "time": "08:00" }
}
```

O token **nunca volta** para a UI depois de salvo; só `tokenSaved` e `tokenHint` (últimos 4 caracteres) em Ajustes.

## 3. Culto — Preparar culto (T1)

```jsonc
{
  "phase": "loading" | "ready" | "error",
  "loadingStep": null | "setlist" | "library" | "destination",
  "preparedAt": "2026-11-01T09:38:20-03:00",
  "setlistSource": "live" | "cache",
  "setlistCachedAt": null | "2026-10-31T21:14:00-03:00",
  "setlistChoices": [                         // >1 setlist no dia → seletor
    { "id": "async-test-setlist-ordered", "title": "Culto de domingo — manhã", "eventAt": "2026-11-01T10:00:00-03:00" }
  ],
  "setlist": {
    "id": "async-test-setlist-ordered",
    "title": "Culto de domingo — manhã",
    "eventAt": "2026-11-01T10:00:00-03:00",
    "publishedBy": "Marta",                 // GAP: endpoint atual não expõe; opcional
    "updatedAt": null                       // GAP: necessário para SETLIST_CHANGED
  },
  "destination": {                          // GetCurrentSchedule + GetLyricsPlaylist (DestinationVM, abaixo)
    "kind": "schedule" | "temporary",
    "name": "Culto de Domingo 01/11",       // temporária: o nome que o Holyrics mostra ("Temporário")
    "type": "service" | "event" | "temporary", // valor bruto do Holyrics, só para diagnóstico
    "datetime": "2026-11-01T10:00:00-03:00" | null,   // OBRIGATORIAMENTE null quando kind = "temporary"
    "eventId": "…" | null,
    "currentItems": [ { "id": "1792693855001", "title": "Bondade de Deus", "artist": "Isaias Saad" } ],
    "check": "match" | "dateMismatch" | "unverifiable"
  },
  "items": [ /* ItemVM, abaixo */ ],
  "summary": { "total": 3, "ready": 2, "needsLink": 1, "chooseVersion": 0, "missing": 0, "repeated": 0 },
  "target": { "ids": ["1792693855267","1792693855255","1792693855260"], "alreadyApplied": false },
  "primaryAction": "review" | "publish" | "recheck" | "none",
  "blockers": [],                           // códigos que impedem publicar (ex.: HOLYRICS_UNREACHABLE)
  "warnings": [],                           // AppError com severity warning
  "error": null | AppError
}
```

### DestinationVM — dois tipos de destino

Sem Holyrics Plan, só a playlist **selecionada** na interface do Holyrics é visível/editável. Na validação ao vivo, `GetCurrentSchedule` devolveu `type: "temporary"`, `name: "Temporário"` e `datetime` = **hora atual** (não é data de culto).

| `kind` | Quando | `datetime` | `check` | Reconhecimento em `apply()` |
|---|---|---|---|---|
| `schedule` | `type` = `service` ou `event` (culto/evento da agenda) | data/hora do culto | `match` se o dia (fuso `America/Sao_Paulo`) = dia de `setlist.eventAt`; senão `dateMismatch` | só se `dateMismatch` |
| `temporary` | `type` = `temporary` | **`null`** — o núcleo descarta o `datetime` do Holyrics para a UI nunca comparar "agora" com a data do setlist | sempre `unverifiable` | **sempre** (`destinationAck: true`) |

Regra de UI: `kind = "temporary"` **nunca** exibe "Mesmo dia do setlist". O núcleo deve recusar `apply()` sem `destinationAck` quando `check ≠ "match"` (defesa em profundidade, não só na UI).

### ItemVM

```jsonc
{
  "position": 2,
  "songId": "fixture-videira-e-ele",
  "song": { "title": "É Ele", "artist": "DROPS" },
  "state": "ready" | "needsLink" | "chooseVersion" | "missing" | "repeated",
  "holyrics": null | { "id": "1792693855260", "title": "E Ele", "artist": "DROPS" },
  "matchedBy": null | "externalId" | "exactTitleArtist",
  "suggestion": null | { "id": "1792693855260", "title": "E Ele", "artist": "DROPS", "reason": "exactTitleArtist" },
  "candidates": [],                          // chooseVersion: HolyricsSong[] com título/artista (não só IDs) + "reason": "exactDuplicate" | "similar"
  "approximate": false,                      // true: candidato só parecido (ex.: ’ × ' — pontuação é preservada) → sempre individual, nunca lote
  "repeatOf": null | 0,                      // repeated: posição da 1ª ocorrência
  "staleLink": null | { "oldId": "1611…", "reason": "notInLibrary" },  // vínculo existia mas ID sumiu
  "lyricsPlaceholder": false                 // ready: a letra no Holyrics ainda é exatamente "[Letra não fornecida]" → linha "Pronta — sem letra", chip "N sem letra" no resumo e aviso no T3
}
```

**Mapeamento do núcleo atual (`planSync`) → `ItemVM.state`:**

| `planSync.itemResults[].status` | Condição | `state` |
|---|---|---|
| `resolved` | — | `ready` |
| `absent` | `suggestions.length === 1` | `needsLink` |
| `absent` | sem `suggestions` | `missing` |
| `ambiguous` | — | `chooseVersion` |
| `repeated` | — | `repeated` |

## 4. Revisar músicas (T2, T2a, T2b)

Regra do lote: `batch` contém **somente** exatos únicos (`state = needsLink`, `suggestion.reason = "exactTitleArtist"`, uma única música no catálogo com a mesma chave normalizada). Ambíguos (`chooseVersion`) e aproximados (`approximate: true`) vão para `individual`, **nunca** para `batch`. `selected: true` é só o padrão da UI; o núcleo recebe apenas os pares marcados em `confirmLinks`. Lote vazio (`batch: []`) com `individual`/`missing` não vazios tem estado próprio na UI.

```jsonc
{
  "batch": [                                  // somente exatos únicos
    { "position": 2, "songId": "fixture-videira-e-ele", "videira": { "title": "É Ele", "artist": "DROPS" },
      "holyrics": { "id": "1792693855260", "title": "E Ele", "artist": "DROPS" }, "selected": true }
  ],
  "individual": [                             // chooseVersion
    { "position": 3, "songId": "…", "videira": { "title": "Santo", "artist": "Ministério X" },
      "candidates": [ { "id": "…", "title": "Santo", "artist": "Ministério X", "createdAt": "2025-03-12" } ] }
  ],
  "missing": [
    { "position": 4, "songId": "…", "videira": { "title": "…", "artist": "…" },
      "importOptions": ["holyricsEditor", "txt", "openlp", "opensong"], "canOpenEditor": true }
  ],
  "lastLinkResult": null | { "linked": 2, "failed": 0, "undoToken": "link-batch-…" }
}
```

`createdAt` do candidato: o ID Holyrics é epoch em ms, então a data pode ser derivada sem API extra.

### MissingDialogVM — "Não está no Holyrics" (T2b)

Estado local da UI montado a partir de `song.openEditor` e `song.awaitCreated` (docs/contracts/ui-core-ipc.md). O núcleo não guarda esse estado.

```jsonc
{
  "position": 4,
  "videira": { "title": "Deus de Promessas", "artist": "Davi Sacer" },
  "previousCatalogTaken": true,              // snapshot GetSongs tirado ANTES do 1º song.openEditor; reusado em todas as releituras
  "editor": null | "opening" | "requested" | "askConfirm" | "opened" | "notOpened" | "error",
  "editorConfirmedBy": null | "status" | "operator",   // "status" = o núcleo leu 200; "operator" = respondeu "Sim, abriu"
  "errorCode": null | "EDITOR_ALREADY_OPEN" | "EDITOR_UNSUPPORTED" | "RATE_LIMITED" | "HOLYRICS_UNREACHABLE" | "EDITOR_FAILED",
  "cooldownUntil": 0,                        // epoch ms; botão desabilitado por 2 s depois de cada chamada
  "reread": null | "reading" | "created" | "placeholder" | "notFound" | "ambiguous",
  "found": null | { "id": "1793000000001", "title": "Deus de Promessas", "artist": "Davi Sacer", "lyricsPlaceholder": false },
  "candidates": [ { "id": "…", "title": "…", "artist": "…", "savedAt": "09:31", "lyricsPlaceholder": false } ],
  "pick": null | "1793000000002"
}
```

Mapeamento:

| Fonte | Resultado | `editor` / `reread` |
|---|---|---|
| `song.openEditor` | `{ ok: true }` | `editor: "opened"`, `editorConfirmedBy: "status"` |
| `song.openEditor` | `CoreError.code` | `editor: "error"`, `errorCode` |
| (só no protótipo, `no-cors`) | resposta opaca | `editor: "requested"` → após ~4 s `askConfirm` → `opened` / `notOpened` pela resposta do operador |
| `song.awaitCreated` | `{ state: "created", song }` e letra ≠ placeholder | `reread: "created"` |
| `song.awaitCreated` | `{ state: "created", song }` e letra = `[Letra não fornecida]` | `reread: "placeholder"` |
| `song.awaitCreated` | `{ state: "not-found" }` | `reread: "notFound"` |
| `song.awaitCreated` | `{ state: "ambiguous", songs }` | `reread: "ambiguous"`, `candidates = songs` |

- `requested`/`askConfirm` existem só no protótipo. No app real, `song.openEditor` passa pelo processo principal, que lê o status. A UI vai direto de `opening` para `opened` ou `error`.
- `savedAt` vem do ID do Holyrics (epoch em ms), formatado como hora local.
- Confirmar: `songLinks.confirmBatch` com um único par (`found.id`, ou `pick` em `ambiguous`). O item vira `state: "ready"` e carrega `lyricsPlaceholder` do candidato (ver ItemVM).
- Não há comando para editar uma música existente. Reabrir o editor cria uma duplicata (veja G13).


## 5. Confirmar substituição (T3)

```jsonc
{
  "destination": { "kind": "temporary", "name": "Temporário", "check": "unverifiable" },
  "before": [ { "id": "…", "title": "…", "artist": "…" } ],          // lista COMPLETA (0..N); a UI decide como mostrar (>10 → 8 + "mostrar todas")
  "after":  [ { "position": 1, "id": "…", "title": "Mil Graus", "artist": "Renascer Praise" } ],
  "removedCount": 7,
  "leftOut": [ { "position": 4, "title": "Santo", "state": "missing" } ],
  "repeatedCollapsed": [ { "title": "A Boa Parte", "positions": [1, 3] } ],
  "requiresPartialAck": true,
  "requiresDestinationAck": true,           // true se destination.kind = "temporary" ou check = "dateMismatch"
  "setlistSource": "live" | "cache",
  "planFingerprint": "sha256:…"            // enviado de volta em apply() para detectar mudanças
}
```

## 6. Publicando (T4) — eventos

O núcleo emite eventos (stream/callback); a UI não faz polling.

```jsonc
{ "type": "step", "step": "backup" | "remove" | "add" | "verify" | "report", "status": "running" | "done" | "failed", "at": "…" }
{ "type": "slow", "step": "verify", "elapsedMs": 10000 }
{ "type": "finished", "result": ResultVM }
```

## 7. Resultado (T5)

```jsonc
{
  "outcome": "verified" | "partial" | "failedRestored" | "failedNotRestored" | "unchanged",
  "verifiedAt": "2026-11-01T09:41:03-03:00",
  "destinationName": "Culto de Domingo 01/11",
  "playlistNow": [ { "id": "…", "title": "…", "ok": true } ],      // releitura
  "originalPlaylist": [ { "id": "…", "title": "…" } ],             // para copiar se não restaurou
  "items": [ { "position": 0, "songId": "…", "title": "Mil Graus", "outcome": "added" | "duplicate" | "skipped" | "failed" | "unchanged" } ],
  "report": { "status": "sent" | "queued" | "notSent", "queuedId": null },
  "canRestore": true,                       // backup ainda em memória e playlist não mudou depois
  "error": null | AppError
}
```

## 8. Reconciliação (T6)

```jsonc
{
  "detectedAt": "…",
  "reason": "fingerprintChanged" | "manyIdsMissing",
  "previousLibrary": { "baseDir": "C:\\Users\\midia\\Holyrics", "songCount": 29 },
  "currentLibrary":  { "baseDir": "D:\\Holyrics",  "songCount": 31 },
  "summary": { "unchanged": 12, "exactPair": 14, "multiple": 2, "noPair": 3 },
  "batch": [ { "songId": "…", "videira": { "title": "Mil Graus", "artist": "Renascer Praise" },
               "oldId": "1792693855267", "new": { "id": "1801000000004", "title": "Mil Graus", "artist": "Renascer Praise" },
               "inCurrentSetlist": true, "selected": true } ],
  "individual": [ { "songId": "…", "videira": { … }, "oldId": "…", "candidates": [ HolyricsSong ] } ],
  "noPair": [ { "songId": "…", "videira": { … }, "oldId": "…" } ],
  "affectsCurrentSetlist": true
}
```

## 9. Histórico (T7)

```jsonc
{
  "pendingReports": [ { "id": "q-1", "setlistTitle": "…", "createdAt": "…", "attempts": 3, "lastError": "VIDEIRA_OFFLINE" } ],
  "runs": [ { "id": "…", "at": "…", "setlistTitle": "…", "destinationName": "…", "outcome": "verified", "songCount": 3, "reportStatus": "sent" } ],
  "linkChanges": [ { "at": "…", "songTitle": "É Ele", "fromId": null, "toId": "1792693855260", "source": "batch" | "individual" | "reconciliation", "undoable": true } ]
}
```

`runs` pode vir do Videira (`HolyricsSyncReport`) com fallback ao cache local; não exige SQLite.

## 10. Ajustes (T8)

```jsonc
{
  "holyrics": { "port": 8091, "tokenHint": "a1B9", "connection": Connection, "lanExposed": true },
  "videira":  { "apiBase": "https://videiramusic.org", "tokenHint": "7Qx2", "organizationName": "…", "connection": Connection },
  "reminder": { "enabled": true, "weekday": 0, "time": "08:00" },
  "appearance": { "theme": "system", "fontScale": 1 },
  "tray": { "startWithOs": true, "closeToTray": true },
  "data": { "statePath": "%APPDATA%\\async-videira\\state.json", "lastRebuildAt": null }
}
```

## 11. Bandeja (T9)

```jsonc
{
  "icon": "normal" | "attention" | "error",
  "tooltip": "async-videira — culto pronto para publicar",
  "summary": { "setlistTitle": "Culto de domingo — manhã", "ready": 3, "total": 4 },
  "holyricsStatus": "ok",
  "pendingReportsCount": 0
}
```

Notificação: `{ "kind": "reminderReady" | "reminderPending" | "setlistChanged" | "backgroundError", "params": { … } }`.

## 12. O que o núcleo precisa expor além do que existe hoje (gaps)

| # | Necessidade da UI | Situação atual | Proposta |
|---|---|---|---|
| G1 | Distinguir "Confirmar vínculo" de "Não está no Holyrics" | `planSync` devolve `status: "absent"` + `suggestions` | Manter, com o mapeamento da seção 3; ou acrescentar `status: "suggested"` |
| G2 | Candidatos ambíguos com título/artista | `candidates` são só IDs no caminho `ambiguous` | Devolver `HolyricsSong[]` |
| G3 | Vínculo velho (ID sumiu) | Comentário no código; não sinaliza | `staleLink: { oldId }` no item |
| G4 | Destino selecionado e checagem | Não exposto | `getDestination()` via `GetCurrentSchedule` → `kind` (`schedule`/`temporary`), `datetime` null na temporária, `check` (§3 DestinationVM) |
| G5 | Progresso por etapa | `executeSync` é uma promessa só | Callback/evento `onStep` |
| G6 | Restauração automática e "desfazer" | `executeSync` não restaura; backup não é retido | Restaurar + reler em falha; manter backup em memória e expor `restorePrevious()` com `canRestore` |
| G7 | Códigos de erro estáveis | `error` é string | Enum `AppError.code` |
| G8 | Plano revalidado na aplicação | CLI revalida | `apply({ planFingerprint })` → `DESTINATION_CHANGED` / `SETLIST_CHANGED` |
| G9 | Outcome `unchanged` | Existe no núcleo, mas o ADR 0004 lista só added/duplicate/skipped/failed | Alinhar com o Videira |
| G10 | Desfazer vínculo | Não existe endpoint | `unlink(songId)` mantendo histórico (depende do endpoint de vínculo em lote) |
| G11 | `publishedBy` / `updatedAt` do setlist | Endpoint não expõe | Opcional para UX; `updatedAt` necessário para G8 |
| G12 | Abrir editor do Holyrics para ausente | Resolvido: `song.openEditor` + `song.awaitCreated` (contrato IPC) | UI segue MissingDialogVM (§4) |
| G13 | Detectar letra provisória (`lyricsPlaceholder`) | `awaitCreated` devolve só `HolyricsSong` (sem letra) | Depois de `created`/`ambiguous`, o núcleo chama `GetLyrics(id)` (já está nas permissões mínimas) e marca `lyricsPlaceholder: true` quando o texto é exatamente `[Letra não fornecida]`; repetir em `prepare` para itens `ready` vinculados nesta sessão. Sem isso, a UI só mostra o aviso fixo do passo 2 |
| G14 | Editar música existente (corrigir letra) | Não há rota; `popup-createsong` só cria | Fora do escopo: a UI orienta a editar no Holyrics e `[Ler de novo]`; nunca oferece "Abrir de novo para editar" |

## 13. Comandos (UI → núcleo)

| Comando | Entrada | Saída |
|---|---|---|
| `testHolyrics` | `{ port, token }` | `Onboarding.holyrics.test` |
| `requestHolyricsPermissions` | — | `{ opened: boolean }` |
| `testVideira` | `{ token }` | `Onboarding.videira.test` |
| `saveToken` / `removeToken` | `{ service, token? }` | `{ ok, tokenHint }` |
| `prepare` | `{ setlistId? }` | `PrepareVM` |
| `refreshDestination` | — | `PrepareVM.destination` |
| `rereadLibrary` | — | `PrepareVM` |
| `confirmLinks` | `{ links: [{ songId, holyricsId }] }` | `{ linked, failed, undoToken }` |
| `undoLinks` | `{ undoToken }` | `{ ok }` |
| `song.openEditor` (era `openHolyricsEditor`) | `{ title, artist }` | `{ ok: true } \| CoreError` |
| `song.awaitCreated` | `{ previousCatalog, title, artist }` | `{ state: "created" \| "not-found" \| "ambiguous", song?, songs? }` (+ `lyricsPlaceholder`, G13) |
| `getApplyPreview` | — | `ApplyConfirmVM` |
| `apply` | `{ planFingerprint, allowPartial, destinationAck }` | eventos + `ResultVM` |
| `restorePrevious` | — | `ResultVM` |
| `getReconciliation` / `confirmRemaps` | `{ remaps: [{ songId, oldId, newId }] }` | `ReconciliationVM` |
| `retryReports` | — | `{ sent, remaining }` |
| `getHistory` / `getSettings` / `saveSettings` | … | VMs 9–10 |

## 14. Ajuda (T10)

Conteúdo estático, empacotado com o app e sem chamada ao núcleo. A UI lê o mesmo formato que o protótipo, `help-data.js`, gerado de `src/help/*.md`:

```jsonc
{
  "id": "configurar-holyrics",                 // = nome do arquivo
  "titulo": "Configurar o Holyrics (API e token)",
  "publico": "operador" | "tecnico",
  "categoria": "comecar" | "domingo" | "problema" | "tecnico",
  "ordem": 1,
  "palavrasChave": ["holyrics", "api server", "token"],
  "relacionados": ["seguranca-dos-tokens", "problemas-comuns"],
  "body": "…markdown, subconjunto seguro, sem HTML…"
}
```

- Estado local: `topic`, `query`, `returnTo: { screen, dialog }` e `feedback[id]: "yes" | "no"`. A avaliação fica só em armazenamento local.
- `Copiar informações para suporte` usa um diagnóstico **sem segredos**. No app final, é o resumo de `diagnostics.preview` (contrato IPC): versão do app, versão, porta e Plan do Holyrics, estado das conexões e último `CoreError.code`. Nunca header, token ou corpo HTTP.
- Mapa código → tópico: [help-map.md](help-map.md).
