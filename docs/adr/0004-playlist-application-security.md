# ADR 0004: aplicação da playlist e segurança

- **Status:** Aceito
- **Data:** 2026-10-29

## Decisão de aplicação

Sem Holyrics Plan, o operador seleciona o culto/playlist de destino na UI do Holyrics; o app só altera a playlist selecionada. O comando principal é **Preparar culto**, manual ou agendado para domingo; polling `watch` contínuo não é obrigatório.

O dry-run exibe por item `resolved`, `ambiguous`, `absent` ou `repeated`. Antes da escrita, deduplicar IDs preservando a primeira ocorrência e avisar; guardar a playlist atual em memória; executar `RemoveFromLyricsPlaylist(indexes)` e `AddLyricsToPlaylist(ids)` sem `event_id`; reler obrigatoriamente e comparar com a lista deduplicada esperada. Se já estiver igual, não reaplicar. Em falha/divergência, tentar restaurar e verificar a playlist anterior (best-effort). Só enviar sync-report após releitura/resultado; outcomes por item: `added`, `duplicate`, `skipped`, `failed`. Nunca retornar `OK` sem verificação pós-aplicação.

Para músicas ausentes, oferecer TXT/OpenLP XML/OpenSong assistido. Importações geram IDs novos e exigem nova leitura e vínculo confirmado. O app não escreve em SQLite/.hly e não cria/edita músicas via API.

## Segurança

Token Holyrics com permissões locais mínimas: `GetVersion`, `GetTokenInfo`, `GetAPIServerInfo`, `GetHolyricsPlanInfo`, `SearchLyrics`, `GetSongs`, `GetLyrics`, `GetLyricsPlaylist`, `AddLyricsToPlaylist`, `RemoveFromLyricsPlaylist`, `GetCurrentSchedule`. Token Videira é escopado à organização. Ambos ficam em Credential Manager/Keychain, nunca em JSON/logs.

O app conecta somente a loopback, mas avisa que o API Server do Holyrics escuta em `0.0.0.0`, por HTTP sem TLS, e pode aceitar tráfego da LAN. Orientar firewall e rede confiável; não expor porta ou token.

## Consequências

A aplicação não é atômica: backup e restauração são best-effort. A releitura é a prova de sucesso; falha de leitura/aplicação gera outcome `failed` e relatório após a tentativa de restauração.
