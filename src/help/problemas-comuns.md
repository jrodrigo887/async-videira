---
id: problemas-comuns
titulo: Problemas comuns
publico: operador
categoria: problema
ordem: 2
palavras-chave: [erro, problema, não funciona, não responde, token recusado, permissão, setlist não aparece, telão, aviso pendente, sem internet]
relacionados: [configurar-holyrics, configurar-videira, musica-nao-esta-no-holyrics, trocar-de-computador]
---

| O que aparece | Causa provável | O que fazer |
|---|---|---|
| **O Holyrics não está respondendo** | Holyrics fechado, API desligada ou porta diferente | Abra o Holyrics, ligue a API Server e confira a porta (8091): [Configurar o Holyrics](topico:configurar-holyrics) |
| **O Holyrics não aceita mais o token** | token errado ou apagado no Holyrics | Gere um token novo no Holyrics e cole em **Ajustes** |
| **Falta permissão no Holyrics** | falta uma ação no token | Em **Gerenciar permissões**, marque a ação que falta |
| Aviso de assinatura do Holyrics Plan | a ação exige o Plan | Use a playlist selecionada; para músicas novas, veja [Música que não está no Holyrics](topico:musica-nao-esta-no-holyrics) |
| **Nenhum culto publicado ainda** | setlist não publicado, sem data, ou token de outra igreja | No Videira, publique e preencha data e hora; confira o token |
| **O Videira Music recusou o token** | o token foi revogado | Peça um novo ao administrador da igreja e cole em **Ajustes** |
| O app pede para preparar de novo | algo mudou entre preparar e publicar | Clique em **Preparar de novo** |
| O destino não é o culto certo | outra playlist está selecionada no Holyrics | Selecione o culto certo no Holyrics e clique em **Verificar de novo** |
| Uma música ficou de fora | música ausente, ambígua ou repetida | Veja o estado da música na tela **Culto** |
| O editor "Nova música" não abre | editor já aberto, versão diferente do Holyrics ou API desligada | Feche o editor aberto, espere 2 segundos e tente de novo; se continuar, importe por arquivo |
| Apareceu `[Letra não fornecida]` no telão | a música foi salva sem trocar o texto | Edite a música no Holyrics e cole a letra |
| Aviso ao Videira pendente | sem internet ou Videira fora do ar | Nada a fazer: o aviso é reenviado depois |
| Depois de reinstalar, os vínculos sumiram | os números das músicas mudaram | [Trocar de computador](topico:trocar-de-computador) |
