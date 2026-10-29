# Discovery — Mapa da API oficial do Holyrics (async-videira)

> Agente: system-holyrics · Data: 2026-10-29
> Fontes:
> - **[DOC]** Documentação oficial `holyrics/API-Server`, `README-en.md`, commit `3ab96d2` (2026-09-15). Os números de linha citados são desse arquivo.
> - **[CODE]** Código decompilado do Holyrics **2.30.0** em `C:\Users\C3POXE\holyrics-re\src\cfr\com\limagiran\holyrics\...` (versão confirmada pelo literal `"2.30.0"` em `WSController.ws_GetVersion`).
> - **[RE]** Relatório anterior `discovery/holyrics-re.md`.
>
> **Testes ao vivo: nenhum.** O Holyrics não estava aberto (nenhum processo e porta 8091 sem escuta), e decidi **não** abri-lo para não mexer na instalação. Tudo abaixo vem da documentação e do código. Os itens marcados **[NÃO TESTADO]** precisam de um spike com o app aberto.

## TL;DR para o escopo decidido (sem Plan, só aplicar a ordem do setlist)

1. **Dá para fazer sem Plan**, editando a **playlist de letras atualmente selecionada na interface**: `SearchSong`/`GetSongs` para achar ids, `GetSongPlaylist` para ler, `RemoveFromSongPlaylist` (por `indexes`) para limpar e `AddSongsToPlaylist` (com `ids`, já na ordem) para preencher.
2. **O que exige Plan:** passar `event_id` (editar o culto ou evento sem que ele esteja selecionado na tela), `SetCurrentSchedule` (trocar o culto selecionado), `CreateItem`/`EditItem`/`DeleteItem` (CreateSong, CreateEvent etc.) e a gestão de grupos de músicas.
3. **Consequência prática:** o operador precisa **selecionar no Holyrics o culto de destino** (ou a playlist temporária) antes de o async-videira publicar. O app não consegue escolher o culto sozinho sem Plan.
4. **Músicas que não existem no Holyrics** não podem ser criadas pela API sem Plan. Existem dois caminhos assistidos (detalhes no item 6):
   - **`/api/popup-createsong`**: rota sem token, aceita só do próprio computador (loopback). Abre o editor do Holyrics já preenchido e o usuário clica em Salvar. **Não está na documentação.**
   - **Importação de arquivos TXT/OpenLP** pelo menu.
5. **Cuidados com o servidor HTTP:**
   - `Content-Type` precisa ser **exatamente** `application/json`. Se vier com `; charset=utf-8`, a resposta é **415**.
   - O servidor escuta em **0.0.0.0**, ou seja, fica acessível na rede local, e não só em localhost.
   - Não há HTTPS.
   - Os nomes das ações diferenciam maiúsculas de minúsculas na checagem de permissão.

---

## 1. Ações relevantes

Convenções gerais [DOC l.1–20, l.23–137; CODE `webservice/ApiServer.java`]:
- URL: `http://<host>:<porta>/api/<Ação>?token=<token>`. O caminho aceita `/api/`, `/API/` ou `/Api/`.
- Método: `POST` com corpo JSON. **O código também aceita `GET` com `?json=<json url-encoded>`** (`ApiServer.requestAPI`), mas isso não está na documentação.
- Parâmetros da query string (exceto `token`/`json`) são mesclados ao corpo quando o campo não existir no corpo.
- Resposta de sucesso: `{"status":"ok"}` ou `{"status":"ok","data":...}`.
- Resposta de erro da ação: **HTTP 200** com `{"status":"error","error":"<mensagem>"}` (`WSController.action` captura a exceção e devolve `e.getMessage()`). **Não dá para confiar só no status HTTP; é preciso olhar o campo `status`.**

### 1.1 Buscar música

| Ação (alias) | Desde | Parâmetros | Resposta | Erros / observações |
|---|---|---|---|---|
| **`SearchLyrics`** (alias `SearchSong`) | 2.19.0 | `text` (obrigatório); `title`=true, `artist`=true, `note`=true, `lyrics`=false (booleanos opcionais); `group` (nome do grupo); `fields` (2.24+, lista separada por vírgula) | `data: Lyrics[]` | Sem `text`: `"Field 'text' not found"`. **Limite de 50 resultados** (`.limit(50L)`), ordenados por título. **Inclui músicas arquivadas** (`MusicDao.getAllWithArchived()`). O parâmetro `input` aparece na doc, mas **é ignorado pelo código** (`WSGson.createMusicFilter` só lê `text`). [DOC l.710; CODE `WSController.ws_SearchLyrics` l.798, `WSGson.createMusicFilter` l.742] |
| **`GetSongs`** | 2.21.0 | `fields` (2.24+); **`include_archived`** (booleano, só no código) | `data: Lyrics[]`, a biblioteca inteira ordenada por título | Sem paginação: devolve tudo. Use `fields=id,title,artist` para reduzir o payload. Por padrão exclui arquivadas. [DOC l.651; CODE l.349] |
| **`GetLyrics`** (alias `GetSong`) | 2.19.0 | `id` (obrigatório); `fields` | `data: Lyrics` ou `null` | Sem `id`: `"Field 'id' not found"`. Id inexistente: `data:null` com status `ok`. [DOC l.595; CODE l.357] |

Campos de `Lyrics` relevantes: `id` (string numérica, epoch em ms), `title`, `artist`, `author`, `note`, `copyright`, `key`, `bpm`, `time_sig`, `groups` (somente leitura), `extras`, `archived`, `tags` (2.29+), `metadata.modified_time_millis` (2.25+). [DOC `## Lyrics` l.8284]

### 1.2 Playlist de letras (setlist)

| Ação (alias) | Desde | Parâmetros | Resposta | Plan? / observações |
|---|---|---|---|---|
| **`GetLyricsPlaylist`** (alias `GetSongPlaylist`) | 2.19.0 | nenhum | `data: Lyrics[]` | Não exige Plan. **Lê sempre a playlist selecionada na interface.** Não aceita `event_id` nem `fields`. [DOC l.2081; CODE l.374] |
| **`AddLyricsToPlaylist`** (alias `AddSongsToPlaylist`) | 2.19.0 | `id` **ou** `ids[]`; `index` (padrão -1 = final, base 0); `media_playlist` (padrão false); `event_id` (2.26+) | `{"status":"ok"}` | Sem `event_id`: **não exige Plan**. Com `event_id` apontando para um evento específico: **exige Plan** [DOC l.2147; CODE `WSUtils.getScheduleToEdit` l.1730–1763]. Detalhes no item 1.4. |
| **`RemoveFromLyricsPlaylist`** (alias `RemoveFromSongPlaylist`) | 2.19.0 | `id`/`ids[]` **ou** `index`/`indexes[]` (base 0); `event_id` (2.26+) | `ok` | Mesma regra de Plan. Remove por índice em ordem decrescente, então é seguro passar `[0,1,2,...]`. [DOC l.2170; CODE `WSScheduleConsumer.removeFromLyricsPlaylist` l.79] |
| **`SetLyricsPlaylistItem`** (alias `SetSongPlaylistItem`) | 2.22.0 | `index`, `song_id`; `event_id` | `ok` | Mesma regra de Plan. Troca a música de uma posição. Erro `"Song not found by ID: …"`. [DOC l.2211; CODE l.63] |
| `LoadSavedPlaylist` | 2.19.0 | `name` ou `id`; `merge` (2.24+) | — | Carrega um *modelo* de playlist salvo para a **lista de mídia**. Não serve para o caso de uso. [DOC l.3962] |
| `AddToPlaylist` | 2.20.0 | `items[]` (`{type:"song",id}`, `title`, `verse`...), `index`, `ignore_duplicates`, `event_id` | `ok` | Adiciona à **playlist de mídia**, não à de letras. Pode servir no futuro para inserir **títulos/separadores** (`type:"title"`). Mesma regra de Plan para `event_id`. [DOC l.2519] |

> **Não existe ação "ClearLyricsPlaylist".** Para limpar: `GetSongPlaylist` → `RemoveFromSongPlaylist {"indexes":[0..n-1]}`.

### 1.3 Agendas, cultos e eventos

| Ação | Desde | Parâmetros | Plan? | Observação |
|---|---|---|---|---|
| `GetCurrentSchedule` | 2.19.0 | `include_lyrics_slides`, `include_lyrics_history` (2.24+) | Não | Devolve `type` (`temporary`/`service`/`event`), `name`, `datetime`, `lyrics_playlist`, `media_playlist`, `metadata.event` (2.25+, contém o `id` do evento). **É assim que se descobre qual culto está selecionado.** [DOC l.3729, `## Schedule` l.8776] |
| `GetSchedules` | 2.19.0 | `month` (1–12), `year` | Não | Lista os cultos e eventos do mês com suas playlists. [DOC l.3805] |
| `GetEvents` | 2.22.0 | `month`, `year` | Não | Sem os campos: `"…month,year…"` (erro de campo). [DOC l.4411; CODE l.459] |
| `GetServices` | 2.22.0 | `only_active` (2.25+) | Não | Cultos recorrentes (dia e hora). [DOC l.4355] |
| `SetCurrentSchedule` | 2.26.0 | `event_id` | **Sim** | `WSUtils.requireHolyricsPlan()` é a primeira linha. [DOC l.8255; CODE l.503] |
| `CreateEvent` / `EditEvent` / `DeleteEvent` (via `CreateItem`/`EditItem`/`DeleteItem`) | 2.25.0 | objeto `Event` (`name`, `description`, `datetime "YYYY-MM-DD HH:MM"`, `wallpaper`) | **Sim** + permissão avançada | [DOC l.8062–8200; CODE `EditableClassEvent extends EditableClassRequirePlan`] |

### 1.4 Comportamentos do código que a documentação não descreve (importantes)

Fonte: [CODE `WSUtils.getScheduleToEdit` l.1730; `WSScheduleConsumer` l.36–91; `MusicMain.addPlayListMusic` l.3294; `WSUtils.searchMusicByID` l.354].

- **Duplicatas não são permitidas** na playlist de letras. `addPlayListMusic` pula músicas que já estão na lista (`playListContains`), e `ids` é deduplicado por `LinkedHashSet`. Uma música que aparece duas vezes no setlist (por exemplo, reprise) **entra uma vez só**.
- Com `index = -1` (padrão), uma música **que já está na playlist é ignorada e fica na posição antiga**. Com `index >= 0`, as que já existem são **movidas**. **Por isso, limpe antes e adicione depois.**
- A **ordem de `ids` é preservada** (`list.sort(... ids.indexOf ...)`).
- **Ids inexistentes são descartados em silêncio.** Só quando *nenhum* id existe a resposta é `{"status":"error","error":"Item not found"}`. Valide cada id com `GetSong` antes de enviar.
- **`AddSongsToPlaylist` é assíncrono** na playlist da interface: roda via `SwingUtilities.invokeLater`, e o `ok` volta antes de a lista mudar. Um `GetSongPlaylist` logo em seguida pode vir desatualizado. Faça polling curto (por exemplo, 3 × 300 ms) ao verificar.
- Regras do `event_id`:
  - ausente, ou literal `"current"` → edita a playlist da interface, **sem Plan**;
  - **se a playlist selecionada é a temporária** (não há evento atual), o `event_id` é **ignorado** e a edição vai para a playlist temporária, **sem erro**;
  - id de um evento qualquer (mesmo que seja o selecionado) → **exige Plan**;
  - id inexistente → `"Event not found: <id>"`.
- `RemoveFromSongPlaylist` por `ids` filtra a partir da **playlist da interface**, mesmo com `event_id`. Prefira remover por `indexes`.
- Permissão de sincronização multiusuário: se a instalação usa a sincronização com perfis de permissão, `SyncPermissionUtils.checkSchedulePermission` pode bloquear a ação com uma mensagem de "permissão negada". Isso é independente do Plan.

---

## 2. O que funciona SEM Plan e o que exige Plan

O código checa com `WSUtils.requireHolyricsPlan()` → `HolyricsPlanAPI.isActivePlan()`. Se falhar, lança `HolyricsPlanRequired` com a mensagem de `HolyricsPlanUtils.getMessageSubscriptionBasicPlan()` (texto localizado, devolvido em `error` com HTTP 200). Basta o plano **básico**.

| Ação | Sem Plan | Fonte |
|---|---|---|
| `GetVersion`, `GetAPIServerInfo`, `GetHolyricsPlanInfo`, `GetTokenInfo`, `CheckPermissions` | ✅ | DOC (sem aviso de Plan); CODE (sem `requireHolyricsPlan`) |
| `SearchSong`, `GetSongs`, `GetSong` | ✅ | DOC l.595–779; CODE l.349–372, 798 |
| `GetSongPlaylist`, `GetCurrentSchedule`, `GetSchedules`, `GetEvents`, `GetServices` | ✅ | DOC; CODE |
| `AddSongsToPlaylist` / `RemoveFromSongPlaylist` / `SetSongPlaylistItem` / `AddToPlaylist` **sem `event_id`** (playlist da interface) | ✅ | DOC l.2147 (o aviso de Plan está só no `event_id`); CODE `getScheduleToEdit` (o caminho padrão não chama `requireHolyricsPlan`) |
| As mesmas ações **com `event_id`** de um evento | ❌ Plan | DOC l.2147/2184/2223/2531; CODE l.1758 |
| `SetCurrentSchedule` | ❌ Plan | DOC l.8258; CODE l.504 |
| `CreateItem`/`EditItem`/`DeleteItem` (`CreateSong`, `EditSong`, `DeleteSong`, `CreateEvent`, `CreateSongGroup`, ...) | ❌ Plan **+** permissão avançada "editar dados importantes" | DOC l.8065/8166/8179; CODE `IEditableClass.checkPermissionAndPlan`, `EditableClassRequirePlan` |
| `AddSongsToSongGroup` / `RemoveSongsFromSongGroup` | ❌ Plan + permissão avançada | DOC l.8204/8231 |
| `GetHolyricsPlanInfo` (para detectar o plano) | ✅. Devolve `type`: `none`/`basic`/`advanced`/`advanced_content` | DOC l.7022; CODE l.2306 |
| `/api/popup-createsong` (abre o editor pré-preenchido) | ✅ (sem token, sem Plan, só loopback) | CODE `ApiServerUtils.createSong`; **não documentado** |

Exceção no código: módulos JS com bypass `hly#edit` não precisam de Plan (`IEditableClass.isPlanRequired`). Isso só vale para módulos internos e oficiais, **não para clientes HTTP**.

---

## 3. Autenticação, porta, rede e HTTPS

**Como o usuário ativa e cria o token** [DOC l.12–18]:
1. No Holyrics, abrir **Arquivo → Configurações → API Server**.
2. Marcar **Ativar (local)**. A porta padrão é 8091 e aceita de 1025 a 65535 (`ApiServerSettings`).
3. Clicar em **Gerenciar permissões → criar token** e dar um nome (por exemplo, "async-videira").
4. Marcar **por ação** o que o token pode fazer, separado entre **Local** e **Web**. Por padrão **tudo vem negado** (`ApiServerAuth.isAllowedLocal` devolve false sem entrada).
5. Copiar o token (16 caracteres alfanuméricos, `StrUtils.random62(16)`) para o async-videira.

**Permissões mínimas para o nosso escopo (Local):** `GetVersion, GetTokenInfo, GetAPIServerInfo, GetHolyricsPlanInfo, SearchLyrics, GetSongs, GetLyrics, GetLyricsPlaylist, AddLyricsToPlaylist, RemoveFromLyricsPlaylist, GetCurrentSchedule`. As permissões são gravadas pelo **nome canônico** (o nome sem alias: `SearchLyrics`, não `SearchSong`) — `JSApiServer.defaultRequestImpl` resolve o alias antes de checar.

**Onboarding facilitado:** `CheckPermissions {"actions":"SearchLyrics,GetLyricsPlaylist,..."}` devolve **401** com `unauthorized_actions` e `request_status: pending|denied`. Além disso, **abre um popup no Holyrics pedindo ao operador que conceda as permissões** (`PopupApiServerManagePermissions.openRequestPermissionsForToken`). O app pode chamar isso logo depois de o usuário colar o token. [DOC l.554; CODE `JSApiServer.defaultRequestTokenImpl`]

**Formas de autenticação** [DOC l.23–170; CODE `ApiServer.extractToken`, `ApiServerDigestTokenController`]:
- `?token=<token>` na URL. É o mais simples. Em loopback, o token não trafega na rede.
- **Digest:**
  1. `POST /api/Auth` sem parâmetros devolve `{sid, nonce}`.
  2. Autenticar em até **cerca de 15 s** com `GET /api/Auth?sid=&rid=0&dtoken=sha256(nonce:0:token:auth)`.
  3. Nas chamadas seguintes, usar `?sid=&rid=<sempre crescente>&dtoken=sha256(nonce:rid:token:<corpo exato>)`.
  4. As sessões ficam só em memória e se perdem quando o Holyrics reinicia.
  Use esse modo se a integração for chamada de outra máquina da rede.

**Rede e binding:**
- O código faz `new ServerSocket(port, 48, InetAddress.getByName("0.0.0.0"))`, ou seja, escuta em **todas as interfaces**. **Não fica restrito a localhost.** Qualquer dispositivo da LAN que alcance a porta pode chamar, e o código trata todo acesso via socket como "local" (`info.local = true`).
- O firewall do sistema operacional pode bloquear o acesso pela rede, mas não bloqueia o loopback.
- "Web" é outra coisa: um relay via `https://api.holyrics.com.br/{send|request}/<Ação>` com os headers `api_key` e `token` [DOC l.173–290]. Não precisamos disso.

**CORS:** toda resposta inclui `Access-Control-Allow-Origin: *`, `Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`, `Allow-Headers: *` e `Max-Age: 3600`. `OPTIONS` devolve `{}` com 200 (`ApiHTTPServerUtils.getHeaderDefault`). Um front Electron/Tauri consegue chamar direto do renderer.

**HTTPS:** **não existe** no servidor local. É HTTP/1.1 puro, com `Connection: close` (sem keep-alive). A documentação recomenda o modo digest justamente por isso [DOC l.25–27].

**Descobrir host e porta:** `GetAPIServerInfo` (2.26+) devolve `enabled_local`, `enabled_web`, `port`, `ip_list`. Mas para chamá-lo já é preciso conhecer a porta. Na prática: tentar `127.0.0.1:8091` e deixar a porta configurável na UI.

---

## 4. Versões mínimas e aliases

Na matriz abaixo, **a versão-alvo mínima recomendada é 2.26.0**. Abaixo dela, o comportamento é diferente: `event_id` é ignorado sem aviso e os campos de `GetVersion` são outros.

| Recurso | Versão mínima [DOC] |
|---|---|
| `SearchLyrics`, `GetLyrics`, `GetLyricsPlaylist`, `AddLyricsToPlaylist`, `RemoveFromLyricsPlaylist`, `GetCurrentSchedule`, `GetSchedules` | 2.19.0 |
| `GetSongs` | 2.21.0 |
| `SetLyricsPlaylistItem`, `GetVersion`, `GetEvents`, `GetServices` | 2.22.0 |
| Parâmetro `fields` nas consultas | 2.24.0 |
| `GetTokenInfo`, `CheckPermissions`, `CreateItem`/`EditItem`/`DeleteItem`, ETag, `metadata.event` em `Schedule` | 2.25.0 |
| `event_id` nas ações de playlist, `GetAPIServerInfo`, `SetCurrentSchedule` | 2.26.0 (antes disso, `event_id` é **ignorado sem aviso**) |
| `GetHolyricsPlanInfo` | 2.28.0 |
| Versão instalada nesta máquina | **2.30.0** [CODE] |

**Aliases** (anotação `@WSAliasRequest`, `WSController` l.200–267). São **idênticos em comportamento**: o alias só chama o método canônico. Diferem só no nome usado para checar a permissão (sempre o canônico):

| Canônico (é o nome que aparece no gerenciador de permissões) | Alias |
|---|---|
| `GetLyrics` | `GetSong` |
| `SearchLyrics` | `SearchSong` |
| `GetLyricsPlaylist` | `GetSongPlaylist` |
| `AddLyricsToPlaylist` | `AddSongsToPlaylist` |
| `RemoveFromLyricsPlaylist` | `RemoveFromSongPlaylist` |
| `SetLyricsPlaylistItem` | `SetSongPlaylistItem` |
| `LyricsPlaylistAction` | `SongPlaylistAction` |
| `ShowLyrics` | `ShowSong` |
| `CreateLyrics` / `EditLyrics` / `DeleteLyrics` | `CreateSong` / `EditSong` / `DeleteSong` |

> ⚠️ **Maiúsculas e minúsculas:** o despacho da ação ignora a caixa, mas a checagem de permissão usa `fixCase`, que só conhece a grafia exata, a toda minúscula e a toda maiúscula. Algo como `getLyricsPlaylist` é despachado, mas **falha na permissão (401 "unauthorized action")**. **Use sempre a grafia exata.**

`GetVersion.version` e `GetTokenInfo.version` vêm de uma **string fixa** no código (`"2.30.0"`), então são confiáveis para a matriz de compatibilidade.

---

## 5. Limites e erros comuns

**Limites** [CODE `ApiServer`]:
- Pool de **2 threads** (`Executors.newFixedThreadPool(2)`) e backlog de 48 conexões. Não existe rate limit geral, mas chamadas paralelas fazem fila. **Serialize as chamadas.**
- `/api/popup-createsong`: no máximo **1 chamada a cada 2 s** (se passar, **429** "too many requests").
- Corpo: não há teto explícito. Exige `Content-Length`; sem ele, **411**. O corpo é lido como UTF-8, caractere a caractere.
- `SearchLyrics`: no máximo **50** resultados.
- `GetSongs`: biblioteca inteira, sem paginação. Use `fields`. Suporta **ETag** (`If-None-Match` → 304) a partir da 2.25, útil para cache.
- O servidor reinicia quando as configurações mudam e tem *throttle* de 15 s entre tentativas de start (`startServer`). Logo depois de ativar a API na UI, ela pode levar alguns segundos para responder.

**Erros** (corpo `{"status":"error","error":...}`):

| HTTP | `error` | Causa |
|---|---|---|
| 401 | `invalid token` | Token ausente, inválido ou revogado |
| 401 | `unauthorized action` | O token não tem a permissão Local da ação (ou a caixa do nome da ação está errada) |
| 401 | `{unauthorized_actions, request_status}` | Resposta do `CheckPermissions` |
| 400 | `exception` | Exceção no despacho ou no script JS customizado |
| 400 | `required field: "<campo>"` | Rotas `popup-createsong` e `CheckPermissions` |
| 400/422 | `session not found`, `'rid' is required`, ... | Modo digest |
| 403 | `only loopback requests are accepted` | `popup-createsong` chamado de fora do próprio computador |
| 404 | `{}` | Rota fora de `/api/`, método diferente de GET/POST/OPTIONS, corpo nulo |
| 409 | `edit window already open` | `popup-createsong` com o editor de música já aberto |
| 411 | `{}` | POST sem `Content-Length` |
| 412 / 304 | `{}` | Pré-condições de ETag |
| **415** | `{}` | **`Content-Type` diferente de exatamente `application/json`** (`equalsIgnoreCase`). Bibliotecas que mandam `application/json; charset=utf-8` (por exemplo, alguns usos de `fetch`/axios/OkHttp) **caem aqui** |
| 429 | `too many requests` | `popup-createsong` |
| **200** | `Request not found` | Nome de ação desconhecido |
| **200** | `Field 'text' not found`, `Item not found`, `Event not found: …`, `Song not found by ID: …` | Validação da ação |
| **200** | *(mensagem localizada de assinatura do Holyrics Plan)* | Ação exige Plan |
| **200** | *(mensagem de permissão negada)* | Permissão de sincronização ou permissão avançada de JS |

Detalhe extra: se o operador escreveu um **script JS de API Server** (Configurações → JavaScript), ele intercepta todas as requisições e pode alterar as respostas (`JSApiServer.request`). `GetTokenInfo` e `CheckPermissions` nunca passam por esse script.

---

## 6. Criar ou editar música SEM Plan

Pela API "normal", **não é possível** (`CreateSong`/`EditSong` exigem Plan, ver item 2). Existem três alternativas, todas **assistidas**: o operador confirma no Holyrics.

### 6.1 `POST /api/popup-createsong` (recomendada; não documentada)
Fonte: [CODE `ApiServer.requestAPI` → `ApiServerUtils.createSong` → `MusicMain.newMusic` → `MusicView.main`]. **[NÃO TESTADO]**
- **Não exige token nem Plan.** Só exige: API local ativada, chamada vinda de **127.0.0.1/::1** (senão 403), intervalo de 2 s entre chamadas e nenhum editor de música aberto (senão 409).
- Abre a janela **"Nova música" já preenchida** e traz o Holyrics para frente (`focus`, padrão true). **Nada é gravado até o operador clicar em Salvar.** A resposta `ok` significa apenas que o editor abriu, **não devolve o id**. Depois de salvar, o app descobre o id com `SearchSong`.
- Corpo (campos lidos por `WSJsonParser.fill(Music, …)`):
  - **`title`** (obrigatório) e **`lyrics`** (slides separados por linha em branco) **ou** `paragraphs[] {text}`;
  - opcionais: `artist`, `author`, `copyright`, `note`, `bpm`, `language`, `key`, `time_sig`, `streaming.audio.{spotify,youtube,deezer,...}`, `extras` (só chaves já cadastradas como parâmetros personalizados, mais `extra`), `chordpro_compatible`, `focus`.
- Também respeita a permissão de sincronização `song` (`PermissionType.song`).
- Exemplo:
  ```bash
  curl -X POST 'http://127.0.0.1:8091/api/popup-createsong' \
    -H 'Content-Type: application/json' \
    -d '{"title":"Nome da Música","artist":"Artista","key":"G","lyrics":"Verso 1 linha 1\nVerso 1 linha 2\n\nRefrão linha 1"}'
  ```
- Risco: é uma rota interna e pode mudar sem aviso entre versões. Trate como recurso opcional e detecte a falha (404 ou erro).

### 6.2 Importação de arquivos pelo menu (documentada pela UI; já citada em [RE])
- Formatos (`util/musimport/ImportMusic.Type`): TXT (UTF-8 ou ISO-8859-1), OpenLP XML, OpenSong, EasiSlides, CCLI `.usr`, Super Cânticos `.scct`, VideoPsalm `.json`, EasyWorship 7 TXT e Datasoul `.song`. O código de importação não checa Plan (`worker/MusicImportWorker.java` não chama `requireHolyricsPlan`).
- **Passos:**
  1. O async-videira gera um arquivo por música faltante numa pasta (por exemplo, `~/async-videira/import/`).
  2. **TXT:** nome do arquivo `Título - Artista.txt` (ou `Título (Artista).txt`), conforme `ImportMusicUtils.titleAndArtistResolve`, que procura o último `" - "` e, na falta dele, o último `(`. Conteúdo em UTF-8, com estrofes (slides) separadas por **uma linha em branco**.
  3. No Holyrics: menu de música → **Importar → Outros → "TXT File (UTF-8)"** (`MusicMainPopupUtils.fillMenuItemMusicImport`) → selecionar os arquivos. Em versões com importadores da comunidade, o item fica no submenu de compatibilidade (v2.23.0+).
  4. Depois, `SearchSong` para obter os ids.
- **Não existe pasta monitorada** nem hot-folder, nem protocolo `holyrics://` ou associação de arquivo para importar (busquei por handlers de protocolo e de abertura de arquivo e não encontrei).

### 6.3 Digitar ou colar manualmente no editor
Óbvio, mas é o fallback universal.

> Escrever direto no `database.db` continua **desaconselhado** (motivos em [RE] §5).

---

## 7. Diferenças Windows x Mac que afetam a integração

- **API:** o código do servidor e das ações **não tem nenhum ramo por sistema operacional**. Busquei `isMac`/`isWindows`/`osx` em `webservice/*` e `js/ApiServer*` e não encontrei. Porta, rotas, autenticação e CORS são iguais nos dois.
- **Detecção:** `GetVersion.platform` vale `win`, `osx` ou `uni`. `baseDir` (2.24+) é a pasta de dados (`Values.PATH_FULL`, relativa ao jar, ver [RE] §1).
- **Firewall:** só importa se o app chamar o Holyrics de **outra máquina**. Em loopback não interfere. No Windows, o Java do Holyrics pode pedir liberação no primeiro start do servidor; no macOS, o firewall de aplicativos pode perguntar se aceita conexões de entrada.
- **`popup-createsong`:** traz a janela para frente via `toFront()`. No macOS, o roubo de foco costuma ser limitado pelo sistema, então a janela pode só piscar no Dock. **[NÃO TESTADO]**
- **Caminhos** (só importam para a importação de arquivos ou para backup): Windows `C:\Holyrics\Holyrics\files\` (confirmado); Mac **não verificado** ([RE] §1, pendente).
- **Não testado num Mac:** porta padrão, tela de configuração e comportamento da API. A recomendação é validar com `GetVersion` e `GetTokenInfo` num Mac real.

---

## 8. Sequência de exemplo (curl): achar por título → limpar → adicionar na ordem

Pré-requisitos:
- API local ativada;
- token com as permissões do item 3;
- **no Holyrics, o operador selecionou o culto de destino** (ou a playlist temporária).

```bash
H='http://127.0.0.1:8091/api'
T='SEU_TOKEN'
CT='Content-Type: application/json'   # exatamente isso; sem "; charset=utf-8"

# 0) Sanidade: versão, plano e permissões
curl -s -X POST "$H/GetVersion?token=$T"          -H "$CT" -d '{}'
curl -s -X POST "$H/GetHolyricsPlanInfo?token=$T" -H "$CT" -d '{}'
curl -s -X POST "$H/CheckPermissions?token=$T"    -H "$CT" \
  -d '{"actions":"SearchLyrics,GetLyrics,GetLyricsPlaylist,AddLyricsToPlaylist,RemoveFromLyricsPlaylist,GetCurrentSchedule"}'

# 1) Confirmar qual culto/playlist está selecionado (mostrar ao usuário antes de sobrescrever)
curl -s -X POST "$H/GetCurrentSchedule?token=$T" -H "$CT" -d '{}'
#   -> data.type, data.name, data.datetime, data.metadata.event.id

# 2) Achar cada música do setlist por título (buscar só no título; filtrar o artista no cliente)
curl -s -X POST "$H/SearchLyrics?token=$T" -H "$CT" \
  -d '{"text":"Bondade de Deus","title":true,"artist":false,"note":false,"lyrics":false,"fields":"id,title,artist,archived"}'
#   -> escolher o item com título normalizado igual e artista igual; evitar archived=true
#   (repetir para cada música; ex.: ids resolvidos 1792693855255, 1792693860001, 1792693871234)

# 3) Ler a playlist atual e limpar por índice
curl -s -X POST "$H/GetLyricsPlaylist?token=$T" -H "$CT" -d '{}'
#   -> n itens; montar [0..n-1]
curl -s -X POST "$H/RemoveFromLyricsPlaylist?token=$T" -H "$CT" -d '{"indexes":[0,1,2,3]}'

# 4) Adicionar na ordem do setlist, numa única chamada (a ordem de "ids" é preservada)
curl -s -X POST "$H/AddLyricsToPlaylist?token=$T" -H "$CT" \
  -d '{"ids":["1792693855255","1792693860001","1792693871234"]}'

# 5) Verificar (a adição é assíncrona: tentar até 3x com 300 ms de intervalo)
curl -s -X POST "$H/GetLyricsPlaylist?token=$T" -H "$CT" -d '{}'
#   -> comparar a sequência de ids com a esperada; se faltar alguma, o id não existia
#      ou era duplicata (o Holyrics não permite a mesma música duas vezes)
```

Notas para a implementação:
- Use os nomes canônicos (`SearchLyrics` etc.). Funcionam desde a 2.19 e batem com os nomes das permissões.
- Entre o passo 3 e o 4, a playlist fica vazia por um instante. Se o operador estiver projetando a partir dela, avise na UI ("vai substituir a playlist de *<nome do culto>*").
- Com Plan (no futuro), basta acrescentar `"event_id":"<id>"` nos passos 3 e 4 para publicar num culto sem selecioná-lo. Lembre que `GetLyricsPlaylist` não aceita `event_id`; para ler, use `GetSchedules`.

---

## Pendências (precisam do Holyrics aberto, em instalação de teste)
- [ ] **[NÃO TESTADO]** Toda a sequência do item 8, incluindo o 415 com `charset` e o comportamento assíncrono do `AddLyricsToPlaylist`.
- [ ] **[NÃO TESTADO]** `popup-createsong`: o editor abre preenchido? Funciona com o app minimizado? E no Mac?
- [ ] Texto exato da mensagem de "Holyrics Plan required" (é localizada) para detectar o caso na UI. Alternativa robusta: checar `GetHolyricsPlanInfo.type == "none"` antes.
- [ ] Validar no Mac: tela de configurações da API, porta e firewall.
- [ ] Já existe um token criado nesta instalação (`Holyrics/files/settingsApiServerAuth/1e2f73b8….hly`, criptografado). Não foi lido nem alterado. O usuário pode reaproveitá-lo ou criar um específico.

## Evidências (arquivos)
- DOC: `README-en.md` @ `3ab96d2`: l.1–330 (convenções, autenticação, web), 554 (CheckPermissions), 595–779 (Get/Search), 2081–2240 (playlist de letras), 2519 (AddToPlaylist), 3729–3962 (agendas), 4355–4470 (Services/Events), 6978–7090 (Version/Plan/ServerInfo), 8062–8270 (Create/Edit/Delete, SetCurrentSchedule), 8284+ (classes).
- CODE (`src/cfr/com/limagiran/holyrics/`):
  - `webservice/ApiServer.java`: bind 0.0.0.0, pool de 2 threads, GET/POST/OPTIONS, 411/415, `popup-createsong`, códigos de erro, ETag
  - `webservice/ApiHTTPServerUtils.java`: headers CORS, `Connection: close`
  - `webservice/ApiServerUtils.java`: `createSong` (loopback, 2 s, 409)
  - `webservice/ApiServerDigestTokenController.java`: nonce de ~15 s, `rid`
  - `js/JSApiServer.java`: token, aliases → permissão, `CheckPermissions` com popup, versão fixa
  - `js/ApiServerSettings.java`, `js/ApiServerAuth.java`: porta 8091 (1025–65535), token de 16 caracteres, permissões Local e Web negadas por padrão
  - `webservice/WSController.java`: registro `ws_*`, `@WSAliasRequest`, `fixCase`, ações
  - `webservice/WSScheduleConsumer.java`, `webservice/WSUtils.java` (`getScheduleToEdit`, `requireHolyricsPlan`, `searchMusicByID`)
  - `view/music/MusicMain.java`: `addPlayListMusic` (sem duplicatas), `execEDT` assíncrono, `newMusic`
  - `webservice/pojo/IEditableClass.java`, `EditableClassRequirePlan.java`: Plan + `EDIT_IMPORTANT_USER_DATA`
  - `webservice/WSGson.java`: `createMusicFilter` (ignora `input`)
  - `webservice/WSJsonParser.java`: campos aceitos em `toMusic`
  - `util/musimport/ImportMusic.java`, `ImportMusicUtils.java`, `view/music/MusicMainPopupUtils.java`: importação
