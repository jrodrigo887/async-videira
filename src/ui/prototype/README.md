# Protótipo navegável

HTML/CSS/JS estático, sem build e sem dependências. Abra `index.html` direto no navegador (duplo clique) ou sirva a pasta com qualquer servidor estático.

- `styles.css`: tokens do DS Videira Music copiados 1:1 (claro/escuro) + componentes `.ds-*` em CSS puro + padrões novos do desktop.
- `data.js`: dados fictícios no formato de [`docs/design/view-models.md`](../../../docs/design/view-models.md), baseados em `fixtures/sync-core-cases.json` e `discovery/live-validation.md`.
- `app.js`: telas, fluxos e simulação. Nenhuma chamada de rede além das fontes.

O botão tracejado **“Protótipo: cenários”** (canto inferior esquerdo) troca de cenário: caso real (É Ele precisa de vínculo), tudo pronto, música repetida, lista longa com ambígua/ausente, vínculos em lote (cheio e vazio), playlist já igual, pareamento, troca de PC, falhas ao publicar e erros comuns (Holyrics fechado, token inválido, falta de permissão, sem internet, token Videira revogado, destino = playlist temporária, culto de outra data, nenhum setlist publicado). Ele não faz parte do app.

Teclado: `Ctrl+1…4` navega, `Ctrl+R` prepara de novo, `Ctrl+Enter` aciona o botão principal (nunca o de substituir playlist), `Esc` fecha diálogo.

Isto não é o código da UI final: a stack ainda está em avaliação (ADR 0001).


## Deep-links

Parâmetros: `cenario`, `tela` (culto, review, vinculos, historico, ajustes, bandeja), `dialogo` (confirm, choose, missing), `onb` (holyrics, videira, done), `antes` (0–15: tamanho da playlist atual), `expandir=1` (abre as colunas longas), `acao=vincular` (executa o lote → sucesso com Desfazer), `tema` (light, dark).

- Destino temporário: `?cenario=temporaria` · diálogo: `?cenario=temporaria&dialogo=confirm`
- Culto da agenda de outra data: `?cenario=dataErrada&dialogo=confirm`
- Substituição com 7 / 15 / 0 itens: `?cenario=pronto&dialogo=confirm&antes=7` · `&antes=15` · `&antes=15&expandir=1` · `&antes=0`
- Lista longa agrupada: `?cenario=pendencias` (janela 900×600 para ver o resumo fixo)
- Lote: `?cenario=lote&tela=review` · sucesso com Desfazer: `?cenario=lote&tela=review&acao=vincular` · vazio: `?cenario=loteVazio&tela=review`
- Parecida (individual): `?cenario=loteVazio&dialogo=choose`
- Escuro: acrescente `&tema=dark` a qualquer URL.
