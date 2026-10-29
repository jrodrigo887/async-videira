# Arquitetura aprovada

## Shell desktop

Recomendação de stack: Electron + React/Vite + Node, mantendo o núcleo JavaScript existente no processo principal e expondo somente IPC tipado à UI. A análise comparativa, trade-offs de pacote e condição de reavaliação estão em [ADR 0005](adr/0005-shell-desktop.md). Instalador Windows por usuário, atualização e plano macOS estão em [ADR 0006](adr/0006-distribuicao-desktop.md). Processos e contrato UI-core estão em [ADR 0007](adr/0007-processos-ipc.md) e [contrato IPC](contracts/ui-core-ipc.md). Segurança, observabilidade e release estão em [ADR 0008](adr/0008-operacao-seguranca-release.md). Ajuda local offline, geração/validação de conteúdo e segurança de renderização estão em [ADR 0009](adr/0009-ajuda-no-app.md).

```text
                      ┌──────────────────────────────┐
                      │ Videira Music API (HTTPS)    │
                      │ setlist publicado            │
                      │ SongExternalLink por org     │
                      │ token protegido no SO        │
                      └──────────────┬───────────────┘
                                     │ setlist + externalId
                                     ▼
┌────────────────────────┐   ┌──────────────────────────────┐
│ Estado local JSON      │◄─►│ UI / sync-core               │
│ cache setlist/catalogo │   │ dry-run e estado por item    │
│ reports pendentes      │   │ externalId → sugestão exata  │
│ migração/checksum      │   │ → confirmação/manual         │
└────────────────────────┘   └──────────────┬───────────────┘
                                             │ ordem Holyrics deduplicada
                                             ▼
                              ┌──────────────────────────────┐
                              │ Adaptador Holyrics API       │
                              │ HTTP 127.0.0.1:8091          │
                              │ GetSongs + playlist atual    │
                              │ backup → Remove + Add        │
                              │ reler → restaurar se falha   │
                              └──────────────┬───────────────┘
                                             ▼
                              ┌──────────────────────────────┐
                              │ Playlist selecionada no UI   │
                              │ do Holyrics (sem Plan)       │
                              └──────────────────────────────┘

Fallback para música ausente: arquivo TXT / OpenLP / OpenSong
                                 └── usuário importa no Holyrics
Segredos: Credential Manager (Windows) / Keychain (macOS)
```

## Escopo e restrições confirmadas

Uma igreja usa um computador com Holyrics. O app publica somente o setlist publicado do culto na playlist atualmente selecionada na interface do Holyrics; sem Plan, não pode selecionar ou editar outro culto via API. O operador confirma o destino no Holyrics antes de aplicar. Não se escreve em `database.db`, `.hly` ou qualquer formato interno do Holyrics.

A API de integração Videira fornece o setlist em ordem, título, artista, `songId` e `externalId`, mas não letras/cifras. A API principal é HTTPS com token por organização. O app não conecta ao PostgreSQL diretamente.

## Vínculos e resolução

- O vínculo confirmado `SongExternalLink` do Videira, no escopo da organização, é a fonte da verdade e a chave de aplicação.
- O app só busca associação para músicas que aparecem no setlist em preparação. Primeiro valida `externalId` contra o catálogo Holyrics atual; se não estiver presente, compara título e artista normalizados exatamente para formar sugestão de reconciliação.
- Normalização exata: Unicode sem diacríticos, caixa e espaços normalizados; pontuação e qualificadores semânticos preservados. Nunca aceitar a cardinalidade bruta de `SearchLyrics` como match: ela é busca ampla (por exemplo, “É Ele” também retornou “Vida Aos Sepulcros”). O catálogo para resolução vem de `GetSongs`.
- Candidatos únicos exatos aparecem numa lista revisável que pode ser confirmada em lote. Duplicatas exatas e candidatos aproximados são revisados individualmente; aproximações nunca viram vínculo automaticamente. Até a confirmação e persistência no Videira, um candidato não autoriza aplicação.
- Após confirmação, enviar ao Videira apenas os vínculos confirmados; o setlist atualizado deve retornar o `externalId`. Ignorar sempre o item de sistema `1611686353330` (“Holyrics” / “Software & App”).

## Catálogo e dados remotos

Ler `GetSongs(fields=id,title,artist)` ao parear, ao preparar o culto e durante reconciliação; a leitura completa ao vivo retornou 29 músicas. `SearchLyrics` tem limite de 50 e não é a fonte do catálogo. Não depender de upload periódico nem enviar catálogo inteiro no fluxo normal de sincronização. Um snapshot remoto só é auxiliar para revisão/reconciliação e, quando atualizado, precisa ser atômico/completo; nunca substituir um snapshot por leitura parcial.

## Estado local, cache e credenciais

Usar um arquivo de estado JSON versionado, sem SQLite local. O envelope inclui `schemaVersion`, `updatedAt` UTC e `checksum` (SHA-256 sobre representação canônica do conteúdo sem o próprio checksum). O conteúdo operacional inclui cache recente do catálogo e setlist, fila de `sync-reports` pendentes, fingerprint observado da biblioteca e estado/histórico de migração. Escrever para arquivo temporário no mesmo diretório, sincronizar o conteúdo e renomear atomicamente para o arquivo final. Ao detectar checksum inválido ou versão desconhecida, reconstruir o cache a partir das APIs sem descartar vínculos no Videira.

Tokens Videira e Holyrics ficam no Credential Manager do Windows ou Keychain do macOS; nunca no JSON, logs, fixtures ou relatórios. Relatórios não enviados permanecem na fila local e só são removidos após confirmação do servidor.

## Troca de computador/biblioteca

A impressão digital da biblioteca combina `GetVersion.baseDir`, `platform`, `ip_list` e hash do conjunto ordenado de IDs retornado por `GetSongs`. Mudança de fingerprint, ou desaparecimento de muitos IDs antigos com títulos/artistas exatos presentes sob novos IDs, entra em modo de reconciliação em vez de falhar silenciosamente.

Nesse modo, sugerir vínculos antigos → novos por título + artista exatos. Correspondências únicas entram numa lista revisável para confirmação em lote; duplicatas e aproximações exigem revisão individual. Registrar histórico `oldId → newId`, manter o vínculo antigo como histórico/inativo e nunca apagá-lo automaticamente. Não usar marcador dentro da música Holyrics: criação/edição não está disponível sem Plan. Não criar `installationId` formal enquanto houver apenas um PC por igreja.

Orientação de migração à igreja: copiar toda a pasta `Holyrics/files`, restaurar backup Holyrics `.hbac` ou usar Google Drive preserva IDs. Exportar/importar `.muf`/`.mufl` e importar TXT/OpenLP/OpenSong gera IDs novos; nesses casos, o app deve reconciliar vínculos antes da publicação.

## Preparar e aplicar culto

1. A ação **Preparar culto** obtém setlist publicado, catálogo fresco com `GetSongs` e playlist/culto atual via `GetCurrentSchedule`/`GetLyricsPlaylist`.
2. Resolver itens: `externalId` confirmado e presente → `resolved`; sem vínculo, comparar título/artista exatos para sugestão; vários candidatos → `ambiguous`; sem candidato confirmado → `absent`; ID repetido no alvo → `repeated`. Mostrar estado por item no dry-run.
3. Confirmar sugestões de vínculo numa lista revisável; duplicatas/aproximações individualmente. Persistir somente vínculos confirmados no Videira e atualizar o setlist/IDs antes de preparar a ordem.
4. Avisar que a playlist selecionada será substituída e guardar sua sequência atual em memória como backup.
5. Deduplicar IDs preservando a primeira ocorrência; reportar por item `duplicate` para ocorrências repetidas. Se a playlist já for a sequência deduplicada esperada, não escrever de novo.
6. Aplicar `RemoveFromLyricsPlaylist(indexes)` e `AddLyricsToPlaylist(ids)` sem `event_id`. A adição é assíncrona; reler até estabilizar/timeout e comparar a sequência lida com o alvo deduplicado.
7. Se escrita ou verificação falhar, tentar restaurar a sequência original e verificar a restauração (best-effort). Emitir `failed` nos itens afetados; nunca reportar `OK` sem releitura confirmada.
8. Depois do resultado verificado, enviar o `sync-report` ao Videira com fingerprint da biblioteca e outcomes `added`, `duplicate`, `skipped` ou `failed`. Em indisponibilidade da API Videira, persistir na fila JSON.

Uso por botão manual ou agendamento dominical; modo `watch` contínuo não é obrigatório.

## Segurança

O token Holyrics recebe somente as permissões locais necessárias: `GetVersion`, `GetTokenInfo`, `GetAPIServerInfo`, `GetHolyricsPlanInfo`, `SearchLyrics`, `GetSongs`, `GetLyrics`, `GetLyricsPlaylist`, `AddLyricsToPlaylist`, `RemoveFromLyricsPlaylist`, `GetCurrentSchedule`. Validar o conjunto no onboarding e explicar qualquer permissão negada.

Embora o app chame `127.0.0.1:8091`, o servidor Holyrics escuta em `0.0.0.0`, usa HTTP sem TLS e pode estar acessível na rede local. Avisar o operador, recomendar firewall/rede confiável e não expor porta/token; manter chamada do app estritamente em loopback. O token Videira é escopado à organização e também fica no cofre seguro do SO.

## Fallback para músicas ausentes

Oferecer exportação/importação assistida em TXT, OpenLP XML ou OpenSong; o usuário importa no Holyrics, que gera IDs novos. A rota atual de setlist Videira não fornece letras, então a geração do conteúdo musical depende de conteúdo autorizado obtido por outra via ou fornecido pelo usuário. Após importar, reler `GetSongs`, sugerir vínculo exato, confirmar e enviar o vínculo ao Videira.
