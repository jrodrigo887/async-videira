---
id: musica-nao-esta-no-holyrics
titulo: Música que não está no Holyrics
publico: operador
categoria: problema
ordem: 1
palavras-chave: [ausente, cadastrar, nova música, editor, abrir no holyrics, importar, txt, letra não fornecida, placeholder, editor não abre]
relacionados: [musica-ambigua-e-vinculos, problemas-comuns, o-que-ainda-nao-funciona]
---

O app **não cria** músicas no Holyrics, porque isso exige o Holyrics Plan. Você cadastra a música e o app ajuda. Há três caminhos.

## 1. Abrir o editor do Holyrics já preenchido

1. No app, clique em **Abrir no Holyrics**. Abre no Holyrics a janela "Nova música" com o título e o artista.
2. **Cole a letra.**
3. **Apague o texto `[Letra não fornecida]`.** Ele entra no lugar da letra quando o app não tem a letra.
4. Clique em **Salvar** no Holyrics.
5. Volte ao app e clique em **Ler a biblioteca de novo**.
6. Confira a música encontrada e clique em **Confirmar vínculo**.

> **Cuidado:** se você salvar sem trocar `[Letra não fornecida]`, essa frase aparece no telão.

Se a música já foi salva com essa frase, abra a música na biblioteca do Holyrics, troque o texto pela letra e salve. Depois clique em **Ler de novo** no app. Não clique em **Abrir no Holyrics** de novo: isso abre o editor de uma música **nova** e cria uma segunda cópia.

Se o editor não abrir:

- confira se o Holyrics está aberto e com a API ligada;
- se já houver uma janela de música aberta no Holyrics, salve ou feche essa janela;
- espere 2 segundos e tente de novo.

> A abertura do editor depende de uma função interna do Holyrics que não é documentada. Ela foi testada na versão 2.30.0 e pode mudar em outras versões. Se não abrir, use o caminho 2. Abrir com outro editor já aberto: **(não testado)**.

## 2. Importar um arquivo

No Holyrics: **música → Importar → Outros → TXT File (UTF-8)**.

- O nome do arquivo deve ser `Título - Artista.txt`.
- Os slides são separados por uma linha em branco.

Depois, no app, clique em **Ler a biblioteca de novo**.

## 3. Já existe com outro nome?

No app, abra **Outros caminhos → Procurar na biblioteca**, encontre a música certa e clique em **Usar esta**.
