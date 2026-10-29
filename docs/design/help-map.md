# Mapa de ajuda contextual

Este mapa liga códigos de erro, estados e telas aos tópicos de `src/help/*.md`. Ele é usado em dois lugares:

- o link **Ver ajuda sobre isto**, dentro do erro ou do diálogo;
- a tecla **F1**, que abre o tópico do contexto atual.

No protótipo, o mapa vive em `HELP_FOR_CODE` e `contextTopic()`, em `src/ui/prototype/app.js`. No app final, a UI faz o mesmo mapeamento sobre `CoreError.code` (docs/contracts/ui-core-ipc.md), sem depender do texto da mensagem.

Regras:
- O link é um botão de texto com ícone `?` e o rótulo "Ver ajuda sobre isto", ou um rótulo específico (§3). Ele nunca substitui a ação principal do erro: "Tentar de novo" continua primeiro.
- Ao abrir a ajuda, o app guarda a tela e o diálogo de origem. **Voltar para onde estava** devolve os dois.
- Durante a escrita no Holyrics (publicando, ou um diálogo `busy`), F1 é ignorado para não interromper.

## 1. Códigos de erro → tópico

| Código / estado | Onde aparece | Tópico | Ligado no protótipo |
|---|---|---|---|
| `HOLYRICS_UNREACHABLE` | região de erro em Culto; erro do editor | `configurar-holyrics` | ✓ link + F1 |
| `HOLYRICS_TOKEN_INVALID` | região de erro em Culto | `configurar-holyrics` | ✓ link + F1 |
| `HOLYRICS_PERMISSION_MISSING` | região de erro em Culto | `configurar-holyrics` | ✓ link + F1 |
| `VIDEIRA_TOKEN_INVALID` | região de erro em Culto | `configurar-videira` | ✓ link + F1 |
| `VIDEIRA_NO_SETLIST` | tela "Nenhum culto publicado ainda" | `configurar-videira` ("Por que o setlist não aparece?") | ✓ link + F1 |
| `VIDEIRA_OFFLINE` | aviso "Sem conexão com o Videira Music" | `problemas-comuns` | F1 |
| `EDITOR_ALREADY_OPEN` | diálogo Não está no Holyrics | `musica-nao-esta-no-holyrics` | ✓ link + F1 |
| `EDITOR_UNSUPPORTED` | diálogo Não está no Holyrics | `musica-nao-esta-no-holyrics` | ✓ link + F1 |
| `EDITOR_FAILED`, `RATE_LIMITED` | diálogo Não está no Holyrics | `musica-nao-esta-no-holyrics` | ✓ link + F1 |
| `DESTINATION_SUSPECT` (`kind: temporary` ou `check: dateMismatch`) | cartão Destino; diálogo Substituir | `destino-playlist-temporaria` | ✓ link + F1 |
| `DESTINATION_CHANGED` | ao publicar | `destino-playlist-temporaria` | mapeado (sem cenário) |
| `SETLIST_CHANGED` | ao publicar | `problemas-comuns` | mapeado (sem cenário) |
| Reconciliação ativa (`reconciliation.active`) | banner "A biblioteca de músicas do Holyrics mudou"; tela Vínculos | `trocar-de-computador` | ✓ link + F1 |
| Item `chooseVersion` / `approximate` | diálogo Escolher versão / Conferir parecida | `musica-ambigua-e-vinculos` | ✓ link + F1 |
| Item `missing` | diálogo Não está no Holyrics | `musica-nao-esta-no-holyrics` | ✓ link + F1 |
| Item `repeated` | linha "Repetida — entra 1 vez" | `musica-repetida` | — (proposta: link na linha) |
| Item `ready` + `lyricsPlaceholder` | linha "Pronta — sem letra"; diálogo Substituir | `musica-nao-esta-no-holyrics` | — (proposta) |
| Resultado `failed` / `restore-failed` | tela Resultado | `problemas-comuns` | F1 |

**Alinhamento com o núcleo:** `src/core/help/error-topics.json` (`helpTopicForError`, ADR 0009) já aponta para os mesmos IDs. Ele também usa códigos-sinônimo que a UI deve tratar igual:

| Código no núcleo | Tópico |
|---|---|
| `HOLYRICS_NOT_RUNNING`, `AUTH_REJECTED`, `PERMISSION_MISSING` | `configurar-holyrics` |
| `DESTINATION_TEMPORARY` | `destino-playlist-temporaria` |
| `LIBRARY_CHANGED`, `CATALOG_CHANGED` | `trocar-de-computador` |
| `SONG_AMBIGUOUS` | `musica-ambigua-e-vinculos` |
| `SONG_ABSENT` | `musica-nao-esta-no-holyrics` |

Diferenças: `VIDEIRA_TOKEN_INVALID`, `VIDEIRA_NO_SETLIST`, `VIDEIRA_OFFLINE`, `RATE_LIMITED` e `SETLIST_CHANGED` estão neste mapa, mas ainda não em `error-topics.json`. Proposta para a arquitetura: acrescentar esses cinco códigos (não editei `src/core`). Quando `CoreError.helpTopicId` vier preenchido, ele tem prioridade sobre este mapa.

## 2. Telas → tópico (F1 sem erro)

| Tela / diálogo | Tópico |
|---|---|
| Primeira configuração: boas-vindas | `comecar` |
| Primeira configuração: Holyrics | `configurar-holyrics` |
| Primeira configuração: Videira Music | `configurar-videira` |
| Culto | `rotina-de-domingo`, ou `destino-playlist-temporaria` se o destino for suspeito |
| Revisar músicas | `musica-ambigua-e-vinculos` |
| Diálogo Substituir playlist | `destino-playlist-temporaria` se o destino for suspeito; senão `rotina-de-domingo` |
| Diálogo Remover token | `seguranca-dos-tokens` |
| Vínculos | `trocar-de-computador` em reconciliação; senão `musica-ambigua-e-vinculos` |
| Histórico, Resultado | `problemas-comuns` |
| Ajustes | `seguranca-dos-tokens` |

## 3. Links com rótulo próprio

| Onde | Rótulo | Tópico |
|---|---|---|
| Boas-vindas da primeira configuração | "Como o app funciona" · "Guia do técnico: configurar o Holyrics" | `comecar`, `configurar-holyrics` |
| Passo Holyrics da primeira configuração | "Ajuda: configurar o Holyrics passo a passo" | `configurar-holyrics` |
| Aviso "API aberta na rede" | "Saiba como bloquear no firewall" | `seguranca-dos-tokens` |
| Nenhum culto publicado | "Por que o setlist não aparece?" | `configurar-videira` |
| Busca sem resultado | "Ver problemas comuns" | `problemas-comuns` |

## 4. Deep-links para conferir

- `?cenario=holyricsFechado`: link no erro → `configurar-holyrics`; também `F1`.
- `?cenario=tokenHolyrics` · `?cenario=permissao` · `?cenario=tokenVideira` · `?cenario=semSetlist`
- `?cenario=temporaria` (cartão Destino) · `?cenario=temporaria&dialogo=confirm` · `?cenario=dataErrada`
- `?cenario=reconciliacao` (banner)
- `?cenario=pendencias&dialogo=choose` · `?cenario=ausente&dialogo=missing&editor=jaaberto`
- `?cenario=primeira` (boas-vindas) · `?cenario=primeira&onb=holyrics`
