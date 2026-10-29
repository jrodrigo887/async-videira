# Protótipo navegável

HTML/CSS/JS estático, sem build e sem dependências. Abra `index.html` direto no navegador (duplo clique) ou sirva a pasta com qualquer servidor estático.

- `styles.css`: tokens do DS Videira Music copiados 1:1 (claro/escuro) + componentes `.ds-*` em CSS puro + padrões novos do desktop.
- `data.js`: dados fictícios no formato de [`docs/design/view-models.md`](../../../docs/design/view-models.md), baseados em `fixtures/sync-core-cases.json` e `discovery/live-validation.md`.
- `app.js`: telas, fluxos e simulação. Nenhuma chamada de rede além das fontes.

O botão tracejado **“Protótipo: cenários”** (canto inferior esquerdo) troca de cenário: caso real (É Ele precisa de vínculo), tudo pronto, música repetida, ambígua/ausente, playlist já igual, pareamento, troca de PC, falhas ao publicar e erros comuns (Holyrics fechado, token inválido, falta de permissão, sem internet, token Videira revogado, Temporário selecionado, culto de outra data, nenhum setlist publicado). Ele não faz parte do app.

Teclado: `Ctrl+1…4` navega, `Ctrl+R` prepara de novo, `Ctrl+Enter` aciona o botão principal (nunca o de substituir playlist), `Esc` fecha diálogo.

Isto não é o código da UI final: a stack ainda está em avaliação (ADR 0001).

Deep-link para revisar um estado direto: `index.html?cenario=pendencias&tela=review`, `?cenario=pendencias&dialogo=confirm`, `?cenario=primeira&onb=holyrics`, `?cenario=reconciliacao&tela=vinculos`, `?tema=dark`. Telas: `culto`, `review`, `vinculos`, `historico`, `ajustes`, `bandeja`; diálogos: `confirm`, `choose`, `missing`.
