# Discovery — Holyrics (async-videira)

> Agente: holyrics-re · Data: 2026-10-29 · Versão analisada: Holyrics **2.30.x** (Windows, `C:\Holyrics`)
> Método: inspeção de uma **cópia** do `database.db` (somente leitura) + leitura do código decompilado (jadx/CFR) do `holyrics-main.jar`. O arquivo vivo não foi aberto nem alterado.

## TL;DR

1. **O `database.db` não é um banco "legível".** Ele tem só 3 tabelas genéricas, e cada música é **um objeto Java serializado, criptografado com AES e codificado em base64**, guardado numa única coluna `TEXT`. Não existem colunas de título, artista, letra ou tom.
2. **Setlists e agendas não ficam no SQLite.** Ficam em arquivos `.hly`, que também são objetos Java serializados e criptografados (`schedule.hly` e outros).
3. **O Holyrics carrega todas as músicas na memória ao iniciar e não percebe mudanças externas.** A exceção é uma opção de polling que vem desligada por padrão. Se escrevermos com o app aberto, ele ignora a mudança ou pode sobrescrevê-la depois.
4. **Existe uma API HTTP oficial e local** (porta padrão 8091, `/api/{Ação}?token=...`) com `CreateSong`, `EditSong`, `DeleteSong`, `GetSongs`, `AddSongsToPlaylist`, `CreateEvent` e outras. **É o caminho recomendado.** Ressalva: criar, editar ou excluir música exige o **Holyrics Plan ativo** (pago) e a permissão "editar dados importantes".
5. **Recomendação:** usar a **API Server** como integração principal. Como plano B sem o Plan, **gerar arquivos de importação** (TXT, OpenLP XML ou OpenSong) para importação assistida. **Não recomendamos escrever direto no SQLite** (motivos na seção 5).

---

## 1. Localização dos dados e travamento do arquivo

### Como o caminho é definido (código)
- `Holyrics.main` faz `System.setProperty("user.dir", <pasta do jar principal>)`.
- `Values.PATH_FILES = "Holyrics/files/"` (caminho relativo a `user.dir`).
- `SQLite.DIR_DB = new File(PATH_FILES + "database.db")`.

Na prática: **`<pasta de instalação>/Holyrics/files/database.db`**. A instalação é "portátil": os dados ficam junto do executável, e não em AppData ou na pasta do usuário.

| SO | Caminho | Status |
|---|---|---|
| Windows | `C:\Holyrics\Holyrics\files\database.db` (instalação padrão; o instalador permite trocar a pasta) | **Confirmado** nesta máquina |
| macOS | `<pasta onde está o jar/app>/Holyrics/files/database.db` | **Não verificado.** Não tenho um Mac aqui. A lógica é a mesma (relativa ao jar), mas falta descobrir onde o `.app` coloca o jar. **Pendente: validar num Mac.** |

Arquivos relacionados na mesma pasta (`files/`):

| Arquivo | Conteúdo |
|---|---|
| `database.db` | SQLite com músicas (`music`), músicas arquivadas (`archived_music`) e textos/slides (`slides`) |
| `schedule.hly` | Agendas e cultos (criado quando a primeira agenda é salva; ainda não existe nesta instalação) |
| `default/playlist-schedule`, `default/playlist-event` | Playlist temporária / atual |
| `music_db_hash.dat`, `text_db_hash.dat` | Hash e controle do sistema de recuperação ("recovery-files") |
| `recovery-files/` | Snapshots automáticos do próprio Holyrics |
| `settingsApiServerAuth/*.hly` | Tokens e permissões da API Server |
| `set.hly` | Configurações gerais (criptografado) |

Para o app async-videira, **não fixe o caminho no código**: peça a pasta de instalação (padrão `C:\Holyrics`) e valide se `Holyrics/files/database.db` existe. Melhor ainda é nem precisar do caminho e usar a API (seção 3).

### Locks / WAL
- `PRAGMA journal_mode` = **`delete`**, ou seja, journal de rollback clássico. **Não usa WAL.** `user_version` = 0.
- Driver: `sqlite-jdbc-3.8.11.2` (SQLite 3.8.11, de 2015).
- O app **abre e fecha uma conexão a cada operação** (`SQLite.getConnection()` → `close()`). Não segura lock permanente. Logo, o arquivo fica "abrível" com o app rodando, mas isso **não torna seguro** escrever nele (o cache em memória é explicado na seção 3).
- Exceção: `thumbs.db` usa uma conexão mantida aberta (`ThumbDao.KEEP_CONNECTION`). Não é relevante para músicas.
- **Risco grave:** se o Holyrics receber `SQLITE_NOTADB` ao abrir o banco, ele executa `backupAndDelete()` (`util/SQLite.java`). Um arquivo corrompido por escrita externa faz o app **mover o banco para backup e começar um banco vazio**.

## 2. Schema

```sql
CREATE TABLE music(_id INTEGER PRIMARY KEY, music TEXT);
CREATE TABLE archived_music(_id INTEGER PRIMARY KEY, music TEXT);
CREATE TABLE slides(_id TEXT PRIMARY KEY, _bytes BLOB);
-- índice: sqlite_autoindex_slides_1 (PK de slides)
-- sem triggers, sem FKs, sem views
```

Contagem na cópia: `music` = 29, `archived_music` = 0, `slides` = 0.

- `_id` (music): epoch em **milissegundos** (`Utils.generateMillisecondId()`), por exemplo `1792693855255`. Igual a `Music.id`.
- `music` (TEXT): `base64( AES( ObjectOutputStream(Music) ) )`. A chave AES vem de uma string ofuscada no binário (`S.get(4)`). O `serialVersionUID` de `Music` é `12491`.
- `slides._id`: UUID. `_bytes`: objeto `Slides` serializado e criptografado.

**Não existe tabela de playlist, setlist ou ordem no SQLite.** Agendas (`Schedule`/`Event`) ficam em `schedule.hly`, gerenciado por `ControllerFactory`, e também são serializadas e criptografadas.

### Modelo `com.limagiran.holyrics.model.Music` (campos persistidos)
`id`, `title`, `artist`, `author`, `lyrics`, `order (List<Integer>)`, `note`, `language`, `formatting`, `set`, `translations (String[][])`, `archived`, `modifiedTime`, `midi`, `strParams (String[])`, `version`, além de campos derivados de busca e HTML (`titleToSearch`, `lyricsToSearch`, `lyricsHTML`, ...).

`strParams` é um array posicional. Os metadados musicais ficam nele:

| índice | campo |
|---|---|
| 0 | extra |
| 1 | **bpm** |
| 2 | time signature |
| 3 | **tom (song key)** |
| 4 | parâmetros customizados |
| 5 | Holyrics song ID |
| 6 | copyright |
| 7 | URI (streaming) |
| 8 / 9 | áudio vinculado / playback |
| 10 | tags |
| 11 / 12 | arranjos / arranjo padrão |

## 3. Como o Holyrics lê e recarrega mudanças

- Na inicialização, `MusicDao.updateAll()` faz `SELECT * FROM music`, desserializa tudo e mantém **a lista inteira em memória**. A partir daí, a UI e a API trabalham sobre esse cache.
- Escritas do app são pontuais: `INSERT INTO music VALUES (?,?)`, `UPDATE music SET music=? WHERE _id=?`, `DELETE ... WHERE _id=?`. Existe também `DELETE FROM music WHERE 1 = 1` (usado em restauração e sincronização), que apaga tudo.
- **Detecção de mudança externa:** `DaoUtils.load()` registra um `FileCacheUpdaterDefault` sobre o `database.db`. Uma thread compara `lastModified` e `length` a cada N segundos e, se mudaram, chama `MusicDao.updateAll()`.
  - N vem da configuração `FILE_CACHE_UPDATER_DELAY`. **O padrão é `"0"` (desligado).** As opções são 0/15/30/60/120/300/600 s, e o controle **só aparece na tela de configurações se já estiver diferente de 0**. Esse recurso existe para bancos compartilhados em pasta de rede.
  - Com o padrão, **uma mudança externa só é vista depois de reiniciar o Holyrics.**
- **Conclusão:** escrever direto no arquivo exige **fechar o Holyrics** antes, ou depende de um ajuste oculto. Mesmo com o polling ligado, existe uma janela de corrida com escritas do próprio app.

### Alternativa oficial: API Server (recomendada)
- Servidor HTTP próprio, **porta padrão 8091** (`ApiServerSettings.DEFAULT_PORT`), rotas `/api/{Ação}`, autenticação por `?token=` (ou `dtoken` digest). Os tokens são criados na UI do Holyrics, e **cada token tem permissões por ação**, separadas para acesso local e web.
- Ações relevantes encontradas no `WSController`:

| Objetivo | Ação | Exige Holyrics Plan? |
|---|---|---|
| Listar músicas (para conciliação) | `GetSongs` (`include_archived`), `GetSong`/`GetLyrics`, `SearchSong` | Não |
| Criar música | `CreateSong` (alias `CreateLyrics`) | **Sim**, mais a permissão `EDIT_IMPORTANT_USER_DATA` nas configurações de JS/API |
| Atualizar música | `EditSong` (alias `EditLyrics`) | **Sim**, mais a mesma permissão |
| Excluir música | `DeleteSong` (alias `DeleteLyrics`) | **Sim**, mais a mesma permissão |
| Agenda / culto | `GetSchedules`, `CreateEvent`, `EditEvent`, `DeleteEvent`, `GetCurrentSchedule` | Create/Edit/Delete: **sim**. `SetCurrentSchedule`: **sim** |
| Montar o setlist | `AddSongsToPlaylist` (`id`/ids, `index`, `event_id`), `RemoveFromSongPlaylist`, `SetSongPlaylistItem`, `GetSongPlaylist` | Na playlist atual (sem `event_id` ou `event_id=current`): não. Num evento específico: **sim** |
| Grupos de músicas | `CreateSongGroup`, `AddSongsToSongGroup` | (não verificado) |

- Payload de `CreateSong`/`EditSong` (de `EditableClass.SONG.set`): `title`, `artist`, `author`, `copyright`, `note`, `language`, `bpm` (0–320), `key`, `time_sig`, `theme`, `slides[]` (`text`, `styled_text`, `slide_description`, `translations`, `background_id`...), `formatting_type` (`basic`|`styled`|`advanced`), `order` ("1,2,1,3", 1-based), `arrangements[]` (`name`, `sequence`, `collections`), `title_translations`, `extras`, `streaming`, `midi`, `linked_audio_file`.
- **O `id` é gerado pelo Holyrics** na criação (`generateMillisecondId`). Não dá para escolher o id. A resposta de `CreateSong` devolve a música com o id, e o async-videira precisa **guardar o mapeamento** `videira_id ↔ holyrics_id`.
- Vantagens: o app atualiza cache, UI, recovery e sync sozinho, sem fechar nada e sem risco de corromper o banco.
- **Pendente:** confirmar se a igreja tem Holyrics Plan. Sem ele, a sincronização automática de músicas pela API não é possível. Ainda dá para ler músicas e montar a playlist atual.

### Alternativa sem Plan: importação assistida por arquivo
Importadores nativos (`util/musimport/ImportMusic.Type`): **TXT (UTF-8 / ISO-8859-1)**, **OpenLP XML**, **OpenSong**, EasiSlides XML, CCLI `.usr`, Super Cânticos `.scct`, VideoPsalm JSON, EasyWorship 7 TXT e Datasoul. No TXT, título e artista saem do **nome do arquivo** (`ImportMusicUtils.titleAndArtistResolve`) e os slides são separados por linha em branco.
O async-videira pode gerar esses arquivos numa pasta. O usuário importa pelo menu, e o próprio Holyrics faz a deduplicação e a gravação. **Não encontrei pasta "hot folder" de importação automática.**

## 4. Formato de letra e slides e mapeamento

| videira-music | Holyrics (API) | Observações |
|---|---|---|
| título | `title` | |
| artista | `artist` | `author` existe separado (compositor) |
| tom | `key` | Rótulos de `EnumSongKey` com `$` trocado por `#`: `C, C#, Db, D, D#, Eb, E, F, F#, Gb, G, G#, Ab, A, A#, Bb, B` e as versões menores (`Cm, C#m, ... Bm`). Valor fora da lista gera erro de campo. Fica em `strParams[3]` |
| bpm | `bpm` | 0–320 |
| compasso | `time_sig` | rótulos de `EnumSongTimeSig` |
| letra | `slides[].text` | Cada item vira um slide (`Paragraph`). Internamente o Holyrics junta tudo em `lyrics`, com slides separados por **linha em branco** |
| nome da seção (Verso, Refrão...) | `slides[].slide_description` | Guardado como `##(Refrão)` na formatação do slide |
| ordem / roteiro | `order` ("1,2,1,3") ou `arrangements[]` | Índices 1-based sobre os slides |
| observação | `note` | |
| idioma / traduções | `language`, `slides[].translations` | |
| setlist | `CreateEvent` + `AddSongsToPlaylist` (`event_id`) | ou só `AddSongsToPlaylist` na playlist atual |

Detalhes internos (só importam se escrevermos fora da API): `formatting` é uma string paralela às linhas, com 4 segmentos separados por `¦` (cor da fonte, formatação da linha, comentário). `order` é `List<Integer>` 0-based. Os campos `*ToSearch` e `*HTML` são derivados e recalculados pelo app.

## 5. Estratégia de escrita segura e riscos

### Recomendado: API Server
1. **Descoberta:** fazer ping em `GetVersion` ou `GetAPIServerInfo`. Tratar erro 401 (token inválido) e mensagens de "Holyrics Plan required" ou de permissão negada, e mostrá-las ao usuário.
2. **Conciliação idempotente:** chamar `GetSongs` e fazer o match por, nesta ordem:
   - o `holyrics_id` guardado no mapeamento local;
   - um marcador nosso em `extras` ou `note` (por exemplo, o `videira_id`). **Validar se esse campo sobrevive ao round-trip** antes de depender dele;
   - como último recurso, título e artista normalizados. O Holyrics faz o mesmo internamente: `getTextToSearchDefault(title) + separador + artist`.
3. **Upsert:** se não encontrar, `CreateSong` e gravar o id devolvido. Se encontrar, comparar um hash do conteúdo e só chamar `EditSong` quando mudou. Nunca chamar `DeleteSong` automaticamente sem confirmação.
4. **Setlist:** `CreateEvent` (ou escolher um evento existente), depois `AddSongsToPlaylist` com `event_id`, preservando a ordem.
5. **Backup:** antes de cada sync, copiar `database.db` e `schedule.hly` como snapshot (só leitura, cópia do arquivo). Isso é barato e permite restaurar. O Holyrics também mantém `recovery-files/`.
6. **Compatibilidade de versão:** chamar `GetVersion` e manter uma matriz testada. Os nomes das ações têm aliases (`CreateLyrics`/`CreateSong`), o que indica que a API é tratada como contrato estável.

### Desaconselhado: escrever direto no SQLite
Para escrever direto seria preciso:
- extrair a chave AES ofuscada do binário;
- reproduzir a **serialização binária Java** de `Music`, com todas as classes internas e o `serialVersionUID` exato. Na prática, isso exige rodar código Java com o `holyrics-main.jar` no classpath;
- recalcular os campos derivados;
- garantir que o Holyrics esteja **fechado**.

Riscos:
- **Corrupção ou perda total:** um banco ilegível faz o Holyrics rodar `backupAndDelete()` e abrir vazio.
- **Quebra a cada atualização do Holyrics:** a classe `Music` muda entre versões (`version`, `strParams` novos), e um objeto incompatível falha ao desserializar e a música some da lista.
- **Corrida com o cache em memória** e com a sincronização na nuvem do próprio Holyrics (Google Drive, Plan), que pode sobrescrever o banco (`DELETE FROM music WHERE 1 = 1` no restore).
- **Questão legal e de licença:** contornar a criptografia do app e reutilizar o jar proprietário num produto distribuído. Isso pede validação jurídica e com o fabricante (Lima Giran) antes de qualquer decisão.
- Setlists continuariam fora do alcance (`.hly` criptografado).

Se, mesmo assim, o projeto optar por escrever direto como último recurso, os requisitos mínimos são: Holyrics fechado (checar o processo); cópia de backup com hash; transação única (`BEGIN IMMEDIATE ... COMMIT`); `PRAGMA integrity_check` antes e depois; somente `INSERT` e `UPDATE` de ids próprios; verificar a versão do Holyrics contra uma lista permitida; e um teste de leitura com o próprio código do Holyrics antes de liberar.

## 6. Pendências e próximos passos
- [ ] Confirmar se a igreja tem **Holyrics Plan** ativo. É isso que decide entre sincronizar pela API e a importação assistida.
- [ ] **Validar o caminho no macOS** e o comportamento da API Server no Mac.
- [ ] Spike: criar um token de API com as permissões mínimas e testar `GetSongs`, `CreateSong`, `EditSong` e `AddSongsToPlaylist` numa **instalação de teste** (não na de produção).
- [ ] Confirmar quais campos (`extras`, `note`) preservam o `videira_id` no round-trip.
- [ ] Ler a documentação oficial da API do Holyrics para confirmar os formatos de request e response (este relatório se baseia no código decompilado da 2.30.x).

## Evidências (arquivos decompilados)
- `com/limagiran/holyrics/util/SQLite.java`: caminho, `CREATE TABLE`, `backupAndDelete`
- `com/limagiran/holyrics/util/Values.java` e `Holyrics.java` (`main`): `PATH_FILES`, `user.dir`
- `com/limagiran/holyrics/model/Music.java`: campos, `create(String)` e `getSerial()` (AES + serialização Java), índices de `strParams`
- `com/limagiran/holyrics/dao/MusicDao.java`, `DaoUtils.java`: cache em memória, SQL, watcher
- `com/limagiran/holyrics/control/BackgroundFileCacheUpdater.java`, `settings/SettingsView.java`: `FILE_CACHE_UPDATER_DELAY`
- `com/limagiran/holyrics/control/ScheduleController.java`: `schedule.hly`
- `com/limagiran/holyrics/webservice/WSController.java`, `WSScheduleConsumer.java`, `WSUtils.java`, `pojo/EditableClass.java`, `pojo/IEditableClass.java`: API e exigência do Plan
- `com/limagiran/holyrics/webservice/ApiServer.java`, `js/ApiServerSettings.java`, `js/ApiServerAuth.java`: porta, token, permissões
- `com/limagiran/holyrics/util/musimport/ImportMusic.java`: formatos de importação
- `com/limagiran/enums/EnumSongKey.java`: rótulos de tom
