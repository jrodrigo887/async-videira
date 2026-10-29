---
id: trocar-de-computador
titulo: Trocar de computador ou reinstalar o Holyrics
publico: tecnico
categoria: tecnico
ordem: 2
palavras-chave: [trocar de computador, reinstalar, backup, hbac, google drive, muf, importar, vínculos sumiram, reconciliação, biblioteca mudou]
relacionados: [musica-ambigua-e-vinculos, configurar-holyrics, seguranca-dos-tokens]
---

O Holyrics identifica cada música por um número criado no próprio computador. Se esses números mudarem, os vínculos antigos deixam de valer.

## O que mantém os números

| Como levar as músicas | O número de cada música é mantido? |
|---|---|
| Copiar a pasta `Holyrics\files` | **Sim** |
| Backup `.hbac` do Holyrics | **Sim** |
| Sincronização pelo Google Drive do Holyrics | **Sim** |
| Exportar `.muf` ou `.mufl` e importar no computador novo | **Não** |
| Importar TXT, OpenLP, OpenSong e similares | **Não** |

**Recomendação:** use a cópia da pasta, o backup `.hbac` ou o Google Drive.

## Se os números mudarem

O app percebe que a biblioteca mudou e mostra **A biblioteca de músicas do Holyrics mudou**. Em **Vínculos**, ele:

- procura as mesmas músicas pelo título e artista exatos;
- propõe os novos vínculos para você confirmar em lote;
- **não apaga** os vínculos antigos.

## No computador novo

1. Configure o Holyrics de novo: [Configurar o Holyrics](topico:configurar-holyrics).
2. Gere um **token novo** no Holyrics.
3. O token do Videira pode ser o mesmo. Se preferir, crie outro e revogue o antigo.
