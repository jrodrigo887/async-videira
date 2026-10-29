# Validacao ao vivo da API do Holyrics (2026-10-29)
Holyrics 2.30.0 Windows, token local, playlist "Temporario". Resultados:
- GetVersion/GetTokenInfo/GetAPIServerInfo/GetHolyricsPlanInfo OK. Plano = none (confirmado).
- GetSongs (fields=id,title,artist) OK apos conceder a permissao: 29 musicas. SearchLyrics text="" tambem devolve 29, mas limite de 50.
- Catalogo contem 1 item de sistema: id 1611686353330 " Holyrics" / "Software & App" -> ignorar.
- ids da API == _id (epoch ms) do database.db.
- ESCRITA SEM PLAN VALIDADA: RemoveFromLyricsPlaylist{indexes:[0..n-1]} + AddLyricsToPlaylist{ids:[...]} (sem event_id) na playlist selecionada; ordem enviada = ordem lida (3,0,1 conferiu); restauracao da playlist original (7 itens) identica. Sequencia em ~2 s.
- Playlist selecionada na UI e a unica editavel sem Plan (operador deve selecionar o culto de destino).
- NAO testado: ids duplicados na mesma playlist, macOS, tokens digest, Holyrics fechado/reiniciado no meio.
- Token de teste tinha permissoes alem do necessario (ActionNext/Previous, grupos, midia); recomendar o conjunto minimo.

## Ids repetidos (testado em 2026-10-29, playlist Temporario, restaurada ao fim)
- AddLyricsToPlaylist{ids:[a,b,a]} -> status ok, mas a playlist fica [a,b]: o 2o "a" e descartado SILENCIOSAMENTE.
- Duas chamadas separadas com o mesmo id -> ok nas duas, playlist com 1 item.
- Consequencia: setlist do Videira com musica repetida nunca sera igual a playlist lida de volta. O app deve (1) detectar repeticao ANTES de aplicar e avisar, (2) comparar o resultado com a lista deduplicada esperada, senao a verificacao por releitura falha para sempre e o fingerprint da bridge reaplica a cada ciclo.

## Dry-run da bridge com ambiente local (2026-10-29) - sem escrita; playlist Temporario seguiu com 7 itens
Setlists de teste (Videira local, sem SongExternalLink => resolucao por titulo):
- async-test-setlist-ordered (Mil Graus, A Boa Parte, E Ele): dry-run "aplicaria 2 musicas". Esperado 3.
  Causa: SearchLyrics{text:"E Ele"} devolve 2 resultados (E Ele + "Vida Aos Sepulcros", match amplo) e resolveExternalId exige results.length===1 -> pula. Mil Graus e A Boa Parte tem 1 resultado.
- async-test-setlist-repeat (A Boa Parte, E Ele, A Boa Parte): "aplicaria 2" = [A Boa Parte, A Boa Parte]; E Ele pulado pela mesma causa. Se aplicado, o Holyrics deixaria 1 item e a bridge reaplicaria sempre.
Conclusoes:
1. Fallback por titulo da bridge e fragil: SearchLyrics faz busca ampla (nao exata). O async-videira deve preferir vinculo explicito (externalId) e, no fallback, filtrar resultados por titulo (e artista) normalizados exatos antes de contar candidatos.
2. O dry-run nao lista quais itens foram pulados nem por que. O app deve mostrar por item: resolvido / ambiguo / ausente / repetido.
3. Dry-run nao detecta repeticao (conta 2 onde o resultado real seria 1).

## Aplicacao REAL da bridge (2026-10-29) - Videira local descartavel + Holyrics 2.30.0, playlist Temporario (restaurada ao fim, 7 itens identicos)
Com SongExternalLink criados no Postgres descartavel (Mil Graus 1792693855267, A Boa Parte 1792693855255, E Ele 1792693855260):
- async-test-setlist-ordered: "Playlist sincronizada ... 3 musicas". Playlist lida: Mil Graus | A Boa Parte | E Ele (ordem correta). Com externalId o problema de ambiguidade do titulo desaparece.
- HolyricsSyncReport gravado no Videira local com status OK e outcome "added" por item (fluxo de retorno validado).
- async-test-setlist-repeat (A, E, A): bridge diz "3 musicas" e reporta OK/added para os 3 itens, mas a playlist fica com 2 (A, E). Segunda execucao: reaplica de novo (limpa e adiciona) e reporta OK de novo, porque targetIds [A,E,A] != playlist [A,E]. Ou seja: relatorio FALSO-POSITIVO (nao ha releitura) + reaplicacao a cada ciclo no modo --watch (fingerprint so evita se !mutate). Confirmado.
- Restauracao da playlist original foi feita com os mesmos comandos do app (Remove por indices + Add ids).
Requisitos para o async-videira: releitura apos aplicar e comparacao com a lista deduplicada esperada; relatorio por item (added / duplicate / skipped); nunca reportar OK sem releitura.

## Limite de 50 do SearchLyrics (CONFIRMADO ao vivo, 2026-10-29)
Biblioteca com 59 musicas (29 reais + 30 "ZZ TESTE", importadas por TXT):
- GetSongs {fields}: 59 (com e sem include_archived).
- SearchLyrics {text:""}: 50 (CORTA). Apenas 21 das 30 "ZZ TESTE" apareceram.
- SearchLyrics {text:"ZZ TESTE"}: 30 (filtro especifico abaixo de 50 nao corta).
- Consequencia: bridge.mjs --catalog (SearchLyrics text:"") sobe catalogo truncado em bibliotecas >50 e o 1o lote SUBSTITUI o snapshot no Videira. O app novo deve usar GetSongs.
- Playlist Temporario permaneceu com 7 itens durante o teste.
