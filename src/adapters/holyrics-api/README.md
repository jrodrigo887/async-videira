# Adaptador Holyrics API

Integração local sem Holyrics Plan, sem acesso ao SQLite nem a arquivos `.hly`. O operador seleciona o culto/playlist de destino na interface do Holyrics; só a playlist atualmente selecionada pode ser alterada.

## Métodos

- `ping()`: validar versão, token, servidor, permissões e plano.
- `getCatalog()`: ler na hora `GetSongs(fields=id,title,artist)` e ignorar `id=1611686353330`. `SearchLyrics` não é catálogo completo: tem limite 50 e retorna resultados amplos.
- `getPlaylist()`: ler `GetLyricsPlaylist` e consultar o culto selecionado com `GetCurrentSchedule`.
- `applyOrder(ids)`: exigir IDs resolvidos por vínculos confirmados; alertar/deduplicar repetidos preservando a primeira ocorrência; guardar a playlist atual; remover com `RemoveFromLyricsPlaylist(indexes)` e adicionar com `AddLyricsToPlaylist(ids)`, sem `event_id`; reler obrigatoriamente após a adição assíncrona e comparar à sequência deduplicada. Em erro/divergência, restauração best-effort e releitura da playlist anterior. O sync-core só marca sucesso depois da releitura.

No-op: se a playlist já equivale ao alvo deduplicado, não chamar Remove/Add. Só então enviar o relatório por item com outcomes `added`, `duplicate`, `skipped` ou `failed`; em falha de rede, manter relatório na fila JSON até confirmação do Videira.

## Segurança

Permissões locais aprovadas: `GetVersion`, `GetTokenInfo`, `GetAPIServerInfo`, `GetHolyricsPlanInfo`, `SearchLyrics`, `GetSongs`, `GetLyrics`, `GetLyricsPlaylist`, `AddLyricsToPlaylist`, `RemoveFromLyricsPlaylist`, `GetCurrentSchedule`.

O app chama somente `127.0.0.1:8091`, mas a API Server escuta em `0.0.0.0` por HTTP sem TLS. Avisar durante configuração e orientar firewall/rede confiável; token no Credential Manager/Keychain.

Aplicação sem Plan, ordem, restauração e IDs repetidos foram testados em Windows/Holyrics 2.30.0. macOS, biblioteca acima de 50 e interrupção do Holyrics durante aplicação ainda aguardam validação.
