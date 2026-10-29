# Holyrics: o que acontece com os IDs de música ao trocar de computador

> Agente: holyrics-re · Data: 2026-10-29 · Base: código decompilado do Holyrics **2.30.0** (`Update.VERSION`) em `C:\Users\C3POXE\holyrics-re\src\jadx\sources`. Somente leitura: o Holyrics e o banco vivo não foram abertos.
> Caminhos de classe relativos a `com/limagiran/holyrics/` (salvo indicação). As linhas citadas são do jadx.

## TL;DR

| Como a igreja leva as músicas | O `Music.id` original sobrevive? |
|---|---|
| Copiar a pasta `Holyrics/files` (ou a instalação inteira) | **Sim** (cópia byte a byte do `database.db`) |
| Backup/restauração `.hbac` do próprio Holyrics | **Sim** (descompacta os arquivos brutos e reinicia) |
| Sincronização com o Google Drive (e compartilhamento/sync entre PCs) | **Sim** (usa `addKeepId`) |
| Exportar `.muf`/`.mufl` e importar no PC novo | **Não.** Gera id novo (o arquivo guarda o id, mas a importação descarta) |
| Importar TXT / OpenLP / OpenSong / EasyWorship etc. | **Não.** Sempre gera id novo |
| Arrastar arquivo (ex.: `.pro6`) para a lista | **Não.** Gera id novo |
| `CreateSong` pela API | **Não** (o id é sempre gerado pelo Holyrics) |

**Consequência para o async-videira:** o `Music.id` é estável **só** quando a biblioteca é migrada "inteira" (cópia, `.hbac` ou Drive). Em qualquer reimportação, os ids mudam e a deduplicação é feita por **título + artista normalizados**. O app **não pode** usar o id do Holyrics como chave permanente. Ele precisa de um vínculo secundário (marcador próprio dentro da música + título/artista) para re-vincular depois de uma migração.

---

## Base: como os ids nascem e como são inseridos

- Gerador: `util/Utils.java:582` `generateMillisecondId()` retorna `System.currentTimeMillis()`, forçado a ser estritamente crescente dentro do processo (`millisecondId + 1`). Não depende da máquina, mas também não é globalmente único (dois PCs podem gerar o mesmo id).
- `Music.equals` compara **apenas o id** (`model/Music.java:1198`).
- `dao/MusicDao.java` tem dois caminhos de inserção:
  - `add(Music, …)` (`:171`): se `id <= 0`, gera um id novo (`:174-175`); se o id já existe, não faz nada (`:177`).
  - `add(List<Music>, …)` (`:697`): **sempre** zera (`setId(-i)`, `:700`) e depois gera ids novos em `batchAdd` (`:823`, `setId(Utils.generateMillisecondId())`).
  - `addKeepId(Music, …)` (`:419`): **preserva o id**. Se o id já existe, vira `set()` (update) (`:425-426`).
- Busca de duplicata: `MusicDao.searchIdOrTitle` (`:2485`) procura **primeiro pelo id** (`getLazy`) e, se não achar, por `search(titleToSearch, artistToSearch)`. A chave usada é `MusicUtils.getTextToSearchDefault(title) + FOLDER_SEPARATOR + …(artist)` (`:2474-2477`).

## 1. Exportar/importar do próprio Holyrics (`.muf` / `.mufl`)

**Exportação.** `view/MusicBatchExport.java:252` `save()` usa `model/rw/OutputTypeMusic`:
- `MUF` ("Holyrics File", `OutputTypeMusic.java:35`): `saveSingle` faz `RWObj.write(musics, output)` (lista serializada → `.mufl`), e `saveMultiple` faz `Music.save(file)` (uma por arquivo → `.muf`). São objetos `Music` serializados, então **o arquivo carrega o `id` original**. As extensões estão em `util/Values.java:20-23` (`.muf`, `.mufl`).
- `TXT` (`:70`): só texto, sem id.
- `JSON` (`:120`): inclui `"id"` (`:124`), mais título, artista, autor, nota, copyright, idioma, `key`, `bpm`… Não achei importador correspondente para esse JSON no fluxo de músicas.

**Importação.** `worker/BatchImportWorker.java` (filtro `*.muf, *.mufl`, `:75-80`), `doInBackground()` (`:113-129`):
1. Lê as músicas e aplica `distinct()` (por id).
2. `alreadyAdded = MusicDao.searchIdOrTitle(musics)`. As músicas cujo **id já existe** ou cujo **título+artista já existe** são **removidas da importação**, sem atualizar nem perguntar (`:118-123`).
3. As demais recebem `setId(-i)` (`:124-126`) e entram por `MusicDao.add(musics, …)` (`:127`), que **gera ids novos**.

Conclusão: no PC novo (biblioteca vazia ou diferente), toda música importada por `.muf`/`.mufl` **ganha id novo**. O id original serve apenas para pular as que já existem com o mesmo id, ou seja, quando reimporta na mesma máquina. Duplicatas por título+artista são **ignoradas silenciosamente**, e a versão local prevalece.

## 2. Backup/restauração completa e cópia da pasta

- **Cópia de `Holyrics/files`:** o `database.db` guarda `_id` igual a `Music.id` (`CREATE TABLE music(_id INTEGER PRIMARY KEY, music TEXT)` em `util/SQLite.java`). Na inicialização, `MusicDao.updateAll()` (`:2186`) faz `SELECT * FROM music` e desserializa, sem regenerar nada. **Os ids são preservados.**
- **Backup `.hbac`:** é um zip da pasta `files` (`backup/BackupExport.java:34`, `BackupUtils.PATH_BACKUP = new File(Values.PATH_FILES)`, `BackupUtils.java:25`). Os grupos de cache ficam excluídos (`BackupGroupType.java:12-15`: cache-theme-bg, dictionary, Bible LG, cache).
- **Restauração:** `backup/BackupImportHBAC.java:88-101` `importBackup()` descompacta o zip (7z ou Java) **sobre a pasta de arquivos** e roda `fixV2_17_0` (só move `files/*` para o nível certo, `:104-113`). Depois, `backup/BackupImport.java:163-170` mostra "o programa será reiniciado" e chama `Holyrics::restart`. Como é **substituição bruta do `database.db`**, **os ids são preservados**.
  - Atenção: a restauração **substitui** a biblioteca do PC destino. Músicas criadas lá antes da restauração desaparecem.
- **Recovery interno** (`backup/RecoveryFileModelMusic.java:119`): também usa `MusicDao.addKeepId(m)`, então preserva.

## 3. Sincronização em nuvem (Google Drive / sync entre PCs)

- `googledrive/SyncModelMusic.java`:
  - `add()` faz `MusicDao.addKeepId(items, true, PermissionType.force_allow)` (`:42`);
  - `recovery()` faz `MusicDao.addKeepId(item, false, …)` (`:55`);
  - `set()` faz `MusicDao.set(m, …)`;
  - `delete()` faz `MusicDao.remove(...)`.
  - **Os ids são preservados**, e a sincronização casa os registros pelo id.
- O equivalente para textos e slides está em `googledrive/SyncModelSlides.java:42,55` (`SlidesDao.addKeepId`).
- O sync de dados compartilhados (`share/ShareSyncDataType.java:60`) também usa `MusicDao.addKeepId(t, false)` e preserva os ids.
- O backup automático no Drive (`googledrive/AutoBackupGoogleDrive.java:62`) envia a pasta `BackupUtils.PATH_BACKUP` (arquivos brutos), então restaurar dele cai no caso do item 2: **preserva**.
- Risco: como o gerador usa milissegundos e não é globalmente único, dois PCs que criam músicas offline podem, em tese, gerar o mesmo id. É improvável, mas possível. Não achei tratamento específico além do `set()` por id, que faria uma sobrescrever a outra.
- Conflitos tratados por popup (`util/popup/PopupConflictItemMusic.java`):
  - "substituir" faz `addKeepId(_new)` e mantém o id (`:55`);
  - "manter os dois" faz `add(_new.setId(-7L))` e **gera id novo** para a cópia (`:68`).
  - O mesmo vale em `PopupConflictItemMusicJustLyrics.java:62,85`.

## 4. Importações TXT / OpenLP / OpenSong / outras

- Formatos em `util/musimport/ImportMusic.java:19-32`: TXT (UTF-8/ISO), EasiSlides, OpenSong, OpenLP, CCLI, Super Cânticos, VideoPsalm, EW7, Datasoul. Os parsers criam `Music` sem id (por exemplo, `Text.run` chama `ImportMusicUtils.create(title, artist, lyrics, "in_txt")`).
- Gravação: `view/MusicBatchImportView.java:351-366`. Faz `searchIdOrTitle(musics)`, remove as que já existem por título+artista (`:358-364`) e chama `MusicDao.add(musics, PermissionType.song)` (`:366`), que **sempre gera ids novos**.
- Arrastar arquivos para a lista (`swing/ListItemTransferHandlerMusic.java:72-80` → `util/FileToMusic.java`, hoje só `.pro6`) passa por `util/popup/PopupImportNewMusics.java:30`, que faz `newMusic.setId(Utils.generateMillisecondId())` **antes** de procurar duplicata. A procura acontece por `src` (`:32-40`) e depois por título+artista (`:41-43`). Em seguida:
  - sem duplicata: `addKeepId` (`:45`), com o id **novo**;
  - com conflito: popup (`:50-51`) que reaproveita o id da música existente.
- O `CreateSong` da API (`webservice/pojo/EditableClass.java:88`, `newInstance` faz `Music.create().setId(Utils.generateMillisecondId())`) sempre gera id novo.

**Resposta: sim, todas essas importações geram ids novos.**

## 5. Existe identificador estável da instalação ou da biblioteca?

| Identificador | Onde fica | Vai junto ao copiar `files`, `.hbac` ou Drive? | Exposto via API? | Utilidade para "mudou de PC" |
|---|---|---|---|---|
| `local_device_id` (12 caracteres legíveis) | `Settings.SET` → `files/set.hly` (`settings/SettingsFactory.java:21-22`), gerado sob demanda em `js/JSLibUtils.java:214-226` | **Sim** (está dentro de `files/`) | Não via HTTP. Só para módulos JS (`js/JSLibHolyrics.java:698`, `h.getDeviceID()`) | **Fraco:** acompanha a biblioteca, não a máquina. Também não existia no `set.hly` exportado desta instalação (só nasce quando algum módulo JS pede) |
| `device_id` do Google Drive Sync (7 caracteres) | `~/.holyrics/google-drive-sync-settings_<md5>.dat` (`googledrive/GoogleDriveSync.java:96-101` com `settingsFolder = Dir.fileUserHomeHolyrics("")`, `holyrics/googledrive/GoogleDriveSyncHolyrics.java:50`; gerado em `googledrive/GDSyncLocalSettings.java:22-33`) | **Não** (fica no perfil do usuário, fora da pasta Holyrics) | Não | Bom sinal de "máquina/usuário", mas o arquivo é criptografado e só existe se o Drive Sync foi configurado. O backup automático tem um análogo em `google-drive-backup-settings_*.dat` (`AutoBackupGoogleDrive.java:150-160`) |
| `baseDir`, `platform`, `platformDescription`, `ip_list` | runtime | n/a | **Sim**: `GetVersion` (`webservice/WSController.java`, `ws_GetVersion`) devolve `version`, `platform`, `platformDescription`, `platformLanguage`, `ip_list`, `baseDir` (= `Values.PATH_FULL`, a pasta de instalação), `language`, `theme`, `jscVersion` | **Útil e barato:** mudanças de `baseDir`, `platform` ou do conjunto de IPs indicam outra máquina ou instalação (não é prova, mas é um bom gatilho) |
| `GetAPIServerInfo` | runtime | n/a | Sim: `enabled_local`, `enabled_web`, `port`, `ip_list` (`webservice/WSConsumer.java:261-268`) | Complementar |
| Token da API | `files/settingsApiServerAuth/*.hly` (`js/ApiServerAuth.java:18-19`: `id` e `token` aleatórios) | **Sim** (está em `files/`) | (é a própria credencial) | Se o token parar de funcionar (401), houve reinstalação limpa ou importação sem copiar `files` |

Não encontrei UUID de instalação nem machine id (MAC, hardware) exposto pela API HTTP. Existe `Utils.getMacAddress()` (`util/Utils.java:593`), mas o uso é interno.

## Recomendação para o async-videira

1. **Não use o `Music.id` como chave primária do vínculo.** Guarde `videira_id → holyrics_id` como *cache*, sempre revalidado.
2. **Escreva um marcador próprio dentro da música** ao criar ou editar pela API. Candidatos: `extras.extra`, o campo `note` ou um parâmetro customizado; ver `EditableClass.java`, bloco `extras`. Exemplo: `videira:<uuid>`. Esse marcador viaja em **todos** os caminhos que carregam o objeto `Music` (cópia, `.hbac`, Drive, `.muf`). **Pendente: confirmar no spike qual campo sobrevive ao `.muf` e ao `GetSongs`.** Nas importações TXT/OpenLP o marcador se perde.
3. **Re-vinculação em cada sync**, nesta ordem:
   - (a) `holyrics_id` em cache ainda existe e o marcador confere: OK;
   - (b) procurar o marcador em `GetSongs`;
   - (c) fallback por título+artista normalizados, a mesma regra do Holyrics (minúsculas, sem acento): vínculo provisório, com confirmação do usuário se houver ambiguidade;
   - (d) não achou: criar.
4. **Gatilho de "mudou de computador/biblioteca"**: guardar a última impressão digital = `GetVersion.baseDir` + `platform` + `ip_list` + um **hash do conjunto de ids** de `GetSongs`.
   - Se `baseDir` ou `platform` mudarem, ou se mais de X% dos `holyrics_id` em cache sumirem enquanto títulos equivalentes existem, entrar em **modo de re-vinculação** (passo 3), e não em modo de criação. Isso evita duplicar a biblioteca inteira.
5. Documentar para a igreja que o jeito recomendado de trocar de PC é **copiar a pasta ou usar backup `.hbac`/Drive**, que preservam os ids. Exportar `.muf` ou TXT gera ids novos e exige re-vinculação.
