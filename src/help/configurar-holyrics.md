---
id: configurar-holyrics
titulo: Configurar o Holyrics (API e token)
publico: tecnico
categoria: tecnico
ordem: 1
palavras-chave: [holyrics, api server, token, permissões, porta, 8091, configurar, gerenciar permissões, invalid token, não responde]
relacionados: [seguranca-dos-tokens, problemas-comuns, configurar-videira]
---

Feito uma vez, pelo técnico. Precisa do **Holyrics 2.26.0 ou superior**. Foi testado na 2.30.0.

## 1. Ligar a API Server

1. Abra o Holyrics.
2. Vá em **Arquivo → Configurações → API Server**. O nome do menu pode variar um pouco conforme a versão.
3. Marque **Ativar (local)**. A porta padrão é **8091**. Só mude se outro programa já usar essa porta.
4. Espere alguns segundos. O servidor pode demorar para subir depois de ligar.

Para conferir, abra no navegador `http://127.0.0.1:8091/api/GetVersion`. Sem token, a resposta esperada é `{"status": "error", "error": "invalid token"}`, e ela quer dizer que a API está no ar.

> Não ative a opção **Web** (acesso pela internet). O app não usa.

## 2. Criar o token com permissões mínimas

1. Na mesma tela, clique em **Gerenciar permissões** e crie um token com o nome `async-videira`.
2. Nas permissões **Local**, marque **somente** estas ações:

| Ação | Para que serve |
|---|---|
| `GetVersion`, `GetTokenInfo`, `GetAPIServerInfo`, `GetHolyricsPlanInfo` | verificar a conexão e se há Plan |
| `GetSongs` | ler a biblioteca de músicas (id, título e artista) |
| `SearchLyrics`, `GetLyrics` | buscar músicas |
| `GetLyricsPlaylist` | ler a playlist selecionada |
| `AddLyricsToPlaylist`, `RemoveFromLyricsPlaylist` | montar a playlist na ordem do setlist |
| `GetCurrentSchedule` | saber qual culto ou playlist está selecionado |

3. **Não marque** mais nada: avançar slide, grupos de músicas, playlist de mídia etc. Quanto menos o token puder, menos estrago ele faz se vazar.
4. Copie o token (16 letras e números) e cole no app, em **Ajustes** ou na primeira configuração. Não mande o token por conversa ou e-mail.

## 3. Sem Holyrics Plan

O app funciona **sem** o Plan, com duas limitações:

- Ele só muda a playlist que está **selecionada** no Holyrics. Não escolhe o culto sozinho.
- Ele não cria músicas. Para isso, veja [Música que não está no Holyrics](topico:musica-nao-esta-no-holyrics).

## 4. Antes do primeiro uso de verdade

Não teste no culto real. No Holyrics, selecione a playlist **Temporário** ou crie um culto de teste. Faça o primeiro teste sem nenhum culto em andamento.

> A API do Holyrics escuta em todas as redes do computador, não só neste computador. Veja [Segurança dos tokens](topico:seguranca-dos-tokens).
