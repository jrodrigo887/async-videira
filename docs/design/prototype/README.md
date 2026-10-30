# Protótipo navegável (arquivado)

> **Congelado.** Referência histórica do desenho de UX; a UI real vive em `src/ui/app` (React + TypeScript). Não é empacotado, não é mantido e não entra no `tsc`. Se `src/help` mudar, `help-data.js` fica desatualizado de propósito.

HTML/CSS/JS estático, sem build e sem dependências. Abra `index.html` direto no navegador (duplo clique) ou sirva a pasta com qualquer servidor estático.

- `styles.css`: tokens do DS Videira Music copiados 1:1 (claro/escuro) + componentes `.ds-*` em CSS puro + padrões novos do desktop.
- `data.js`: dados fictícios no formato de [`docs/design/view-models.md`](../../../docs/design/view-models.md), baseados em `fixtures/sync-core-cases.json` e `discovery/live-validation.md`.
- `help-data.js` (gerado) + `help.js`: tópicos da Ajuda e o renderizador seguro de Markdown.
- `app.js`: telas, fluxos e simulação. Nenhuma chamada de rede além das fontes, exceto no modo Holyrics real (abaixo).

O botão tracejado **“Protótipo: cenários”** (canto inferior esquerdo) troca de cenário: caso real (É Ele precisa de vínculo), tudo pronto, música repetida, lista longa com ambígua/ausente, vínculos em lote (cheio e vazio), playlist já igual, pareamento, troca de PC, falhas ao publicar e erros comuns (Holyrics fechado, token inválido, falta de permissão, sem internet, token Videira revogado, destino = playlist temporária, culto de outra data, nenhum setlist publicado). Ele não faz parte do app.

Teclado: `Ctrl+1…4` navega, `F1` abre a Ajuda do contexto, `Ctrl+R` prepara de novo, `Ctrl+Enter` aciona o botão principal (nunca o de substituir playlist), `Esc` fecha diálogo.

Isto não é o código da UI final (a stack escolhida é Electron + React; ver ADR 0005).

## Ajuda (conteúdo offline)

Os tópicos da tela **Ajuda** ficam em `src/help/*.md`, em Markdown com front matter. O protótipo **não** busca os `.md` pela rede, porque `fetch` não funciona em `file://`. Ele lê `help-data.js`, gerado a partir deles:

```
node docs/design/prototype/build-help.mjs     # depois de editar qualquer src/help/*.md
node docs/design/prototype/build-help.mjs --check   # confere se help-data.js está em dia (para CI)
```

O formato é o mesmo validado por `src/domain/help/help-topics.ts` (listas `[a, b]`, links `[texto](topico:id)`). O gerador falha nestes casos:
- front matter incompleto;
- `publico` ou `categoria` inválidos;
- `relacionados` ou links `(topico:id)` para tópicos que não existem;
- qualquer HTML no texto.

O `help.js` renderiza só um subconjunto seguro: `##`/`###`, parágrafos, listas, tabelas, `>`, **negrito**, `código` e links para outros tópicos. O texto é escapado antes de virar HTML, e links externos viram texto simples. Não é preciso internet: a única coisa externa do protótipo são as fontes, que têm fallback de sistema.

## Modo Holyrics real (demo)

Por padrão tudo é simulado. Para o botão **Abrir no Holyrics** abrir de verdade o editor de música nova no Holyrics deste computador:

1. Sirva por http com `node docs/design/prototype/serve.ts`. Por `file://` o modo real fica bloqueado, e o painel explica o motivo.
2. Abra `http://localhost:5177/?cenario=ausente&dialogo=missing&holyrics=real`, ou ligue **Holyrics de verdade** no painel "Protótipo: cenários".
3. Opcional:
   - `&holyricsUrl=http://127.0.0.1:8091`: só loopback é aceito.
   - `&pergunta=4000`: tempo em ms até perguntar "O editor abriu?".

Como a chamada é feita:
- O protótipo envia `POST {holyricsUrl}/api/popup-createsong`, sem token, com o corpo `{ "title", "artist", "lyrics": "[Letra não fornecida]" }`.
- **1ª tentativa: CORS normal com `Content-Type: application/json`.**
  - O Holyrics responde com `Access-Control-Allow-Origin: *` e exige exatamente `application/json`; com `text/plain` ele devolve 415.
  - Aqui o status é legível: 200 → "O editor abriu", 409 → editor já aberto, 429 → espere, 404 → versão sem suporte.
- **Reserva: `mode: "no-cors"` com `text/plain`.**
  - Só entra quando a 1ª falha no navegador, por exemplo com o preflight bloqueado.
  - A resposta é opaca, então o protótipo mostra "Pedimos ao Holyrics para abrir o editor — olhe a janela do Holyrics". Alguns segundos depois, pergunta "O editor abriu? [Sim, abriu] [Não abriu]".
  - O Holyrics real provavelmente recusa esse corpo com 415, e é por isso que a pergunta existe.
- Só o editor é real.
  - A releitura ("Ler a biblioteca de novo") continua simulada.
  - O protótipo nunca grava no Holyrics: quem salva é o operador, na janela do Holyrics.

**No app real esta chamada não sai da interface.**
- Ela passa pelo processo principal (`song.openEditor`, `docs/contracts/ui-core-ipc.md`), que lê o status HTTP real e devolve `{ ok: true }` ou um `CoreError` tipado.
- Por isso "Pedimos ao Holyrics…" e "O editor abriu?" existem só no protótipo.
- A releitura usa `song.awaitCreated`, com o snapshot do catálogo tirado antes de abrir o editor.

Teste automatizado: Edge headless via CDP contra um Holyrics falso local. Passaram:
- 200 → aberto
- 409 → já aberto
- sem CORS → reserva opaca e a pergunta
- servidor fora do ar → erro

## Deep-links

Parâmetros: `cenario`, `tela` (culto, review, vinculos, historico, ajustes, bandeja), `dialogo` (confirm, choose, missing), `editor` / `releitura` / `resposta` / `proxima` (estados do diálogo missing, abaixo), `holyrics=real`, `onb` (holyrics, videira, done), `antes` (0–15: tamanho da playlist atual), `expandir=1` (abre as colunas longas), `acao=vincular` (executa o lote → sucesso com Desfazer), `tema` (light, dark).

- Destino temporário: `?cenario=temporaria` · diálogo: `?cenario=temporaria&dialogo=confirm`
- Culto da agenda de outra data: `?cenario=dataErrada&dialogo=confirm`
- Substituição com 7 / 15 / 0 itens: `?cenario=pronto&dialogo=confirm&antes=7` · `&antes=15` · `&antes=15&expandir=1` · `&antes=0`
- Lista longa agrupada: `?cenario=pendencias` (janela 900×600 para ver o resumo fixo)
- Lote: `?cenario=lote&tela=review` · sucesso com Desfazer: `?cenario=lote&tela=review&acao=vincular` · vazio: `?cenario=loteVazio&tela=review`
- Parecida (individual): `?cenario=loteVazio&dialogo=choose`
- Música ausente → editor do Holyrics: `?cenario=ausente&dialogo=missing`
  - Editor: `&editor=aguardando` · `&editor=pergunta` · `&editor=aberto` · `&editor=naoabriu` · `&editor=jaaberto` · `&editor=fechado`
  - Releitura: `&releitura=encontrada` · `&releitura=placeholder` · `&releitura=naoencontrada` · `&releitura=ambigua`
  - Simular o clique: `&resposta=opaco` (vai a "Pedimos…" e depois a "O editor abriu?") · `&resposta=jaaberto` · `&resposta=fechado`
  - Próxima leitura ao clicar: `&proxima=placeholder` · `&proxima=ambigua` · `&proxima=naoencontrada`
  - Real (via http): `http://localhost:5177/?cenario=ausente&dialogo=missing&holyrics=real`
- Ajuda: `?tela=ajuda`
  - Por tópico: `?tela=ajuda&topico=comecar` · `rotina-de-domingo` · `configurar-holyrics` · `configurar-videira` · `musica-nao-esta-no-holyrics` · `musica-ambigua-e-vinculos` · `musica-repetida` · `destino-playlist-temporaria` · `trocar-de-computador` · `seguranca-dos-tokens` · `problemas-comuns` · `o-que-ainda-nao-funciona`
  - Com busca: `?tela=ajuda&busca=token` · sem resultado: `?tela=ajuda&busca=xyz`
  - Antes de configurar: `?cenario=primeira&tela=ajuda&topico=configurar-holyrics`
  - Links contextuais: veja `docs/design/help-map.md` §4
- Escuro: acrescente `&tema=dark` a qualquer URL.
