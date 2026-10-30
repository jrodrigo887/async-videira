# Tutorial: configurar o Holyrics e o async-videira

Este guia leva uma igreja do zero até a playlist de letras do Holyrics montada a partir do setlist publicado no Videira Music.

- **Para quem:** o técnico voluntário que configura uma vez e o operador de mídia que usa todo domingo.
- **Tempo:** cerca de 20 a 30 minutos na primeira vez; uns 2 minutos por domingo depois.
- **Premissas validadas:** Windows, Holyrics 2.30.0, **sem Holyrics Plan**, um único computador com Holyrics.
- **Estado do produto hoje:** o núcleo funciona por linha de comando (`node src/cli.ts`). O aplicativo instalável (`.exe`) e a interface gráfica ainda estão em construção; a parte 7 mostra como será. Onde algo ainda não foi testado, está marcado com **(não testado)**.

> **Regra de ouro:** o app nunca escreve no banco de dados do Holyrics. Ele só conversa com a API local do Holyrics e só altera a **playlist de letras selecionada** na tela. As músicas continuam na biblioteca.

---

## 1. Como as peças se encaixam

```
Videira Music (internet)           Computador do Holyrics
  setlist publicado  ──HTTPS──▶  async-videira  ──HTTP local──▶  Holyrics
  vínculos das músicas             (compara, confirma,            API em 127.0.0.1:8091
                                    aplica e confere)             playlist de letras selecionada
```

O que cada parte guarda:

| Onde | O quê |
|---|---|
| **Videira Music** | músicas, cifras, setlists publicados e os **vínculos** (qual música do Videira corresponde a qual música do Holyrics) |
| **Holyrics** | a biblioteca de letras, os ids das músicas e a playlist do culto |
| **async-videira** | um arquivo de estado local (cache e fila de relatórios) e os dois tokens, que nunca saem do computador |

---

## 2. Antes de começar (checklist)

- [ ] Holyrics **2.26.0 ou superior** instalado e abrindo normalmente (testado na 2.30.0).
- [ ] Alguém com perfil de **administrador da igreja** no Videira Music.
- [ ] O setlist do culto **publicado** no Videira, com **data e hora** preenchidas. Só aparecem setlists publicados, não excluídos e com data.
- [ ] Node.js 22.18 ou superior no computador do Holyrics, para o modo de linha de comando (`node --version`).
- [ ] A pasta do projeto `async-videira` no computador.
- [ ] Nenhum culto em andamento. Os testes alteram a playlist selecionada.

---

## 3. Configurar o Holyrics

### 3.1 Ligar a API Server

1. Abra o Holyrics.
2. Vá em **Arquivo → Configurações → API Server**. O nome do menu pode variar um pouco conforme a versão.
3. Marque **Ativar (local)**. A porta padrão é **8091**. Só mude se outra aplicação já usar essa porta.
4. Aguarde alguns segundos. O servidor pode demorar para subir depois de ligar.

Para conferir, abra no navegador `http://127.0.0.1:8091/api/GetVersion`. A resposta `{"status": "error", "error": "invalid token"}` significa que a API está no ar, e é o resultado esperado sem token.

> Não ative a opção **Web** (relay pela internet). O async-videira não usa.

### 3.2 Criar o token com permissões mínimas

1. Na mesma tela, clique em **Gerenciar permissões** e crie um token. Dê o nome `async-videira`.
2. Nas permissões **Local**, marque **somente** estas ações:

| Ação | Para que serve |
|---|---|
| `GetVersion`, `GetTokenInfo`, `GetAPIServerInfo`, `GetHolyricsPlanInfo` | verificar a conexão e confirmar que não há Plan |
| `GetSongs` | ler a biblioteca inteira de músicas (id, título e artista) |
| `SearchLyrics`, `GetLyrics` | buscar músicas |
| `GetLyricsPlaylist` | ler a playlist selecionada |
| `AddLyricsToPlaylist`, `RemoveFromLyricsPlaylist` | montar a playlist na ordem do setlist |
| `GetCurrentSchedule` | saber qual culto ou playlist está selecionado |

3. **Não marque** ações de avançar slide, grupos de músicas, playlist de mídia ou qualquer outra. Quanto menos o token puder, menos estrago ele faz se vazar.
4. Copie o token (16 letras e números). Guarde-o num cofre de senhas, **não** em conversa, e-mail ou arquivo do projeto.

> **Importante:** a API do Holyrics escuta em todas as redes do computador (`0.0.0.0`), não só em `localhost`. Qualquer aparelho da mesma rede que descubra o token consegue chamá-la. Por isso: permissões mínimas, token fora de lugares compartilhados e uma rede de igreja confiável. Se a rede da igreja é aberta ao público, mantenha o firewall do Windows ativo e não libere a porta 8091 para a rede.

### 3.3 Conferir se o Holyrics tem o Plan

O app funciona **sem** o Plan, mas com uma limitação: ele só consegue alterar a playlist que está **selecionada** na tela do Holyrics. Não consegue escolher o culto sozinho nem criar músicas pela API. Os dois casos têm solução (seções 5.3 e 6.3).

### 3.4 Preparar uma playlist de teste

Antes do primeiro teste real, não use o culto de verdade. No Holyrics, selecione a playlist **Temporário** ou crie um culto de teste, e deixe-a selecionada.

---

## 4. Configurar o Videira Music

### 4.1 Gerar o token de integração

1. Entre no Videira Music como **administrador** da igreja.
2. Abra a tela da integração com o Holyrics e crie um **token de integração**.
3. Copie o token. **Ele aparece uma única vez.** Se perder, revogue e crie outro.

Esse token só permite ler os setlists publicados da sua igreja e enviar relatórios. Não dá acesso ao banco de dados. Se vazar, revogue na mesma tela.

### 4.2 Publicar o setlist

No Videira, o setlist precisa estar:

- com status **publicado**;
- com **data e hora** definidas (`eventAt`);
- com as músicas na ordem desejada.

### 4.3 Vincular as músicas (primeira vez)

O app precisa saber qual música do Holyrics corresponde a cada música do Videira. Existem três situações:

| Situação | O que o app faz |
|---|---|
| Já existe vínculo salvo no Videira | usa direto. É o caminho mais seguro |
| Não há vínculo, mas título e artista batem **exatamente** (ignorando acento e maiúscula) com **uma** música do Holyrics | sugere o vínculo para você confirmar |
| Há duas músicas parecidas, ou nenhuma | pede que você escolha ou cadastre a música no Holyrics |

O app **nunca** escolhe sozinho uma música "parecida". Você confirma cada vínculo, ou confirma em lote os que são exatos e únicos.

---

## 5. Configurar o async-videira

### 5.1 Variáveis de ambiente (modo linha de comando)

No PowerShell, na pasta do projeto:

```powershell
$env:HOLYRICS_URL     = 'http://127.0.0.1:8091'
$env:HOLYRICS_TOKEN   = '<token do Holyrics>'
$env:VIDEIRA_API_BASE = 'https://videiramusic.org'
$env:VIDEIRA_TOKEN    = '<token de integração do Videira>'
$env:SETLIST_ID       = '<id do setlist>'   # opcional; sem ele usa o próximo setlist publicado
```

Essas variáveis valem só para a janela do PowerShell aberta. Os tokens **não** são gravados no arquivo de estado nem nos logs. Para limpar ao terminar:

```powershell
'HOLYRICS_TOKEN','VIDEIRA_TOKEN','SETLIST_ID' | ForEach-Object { Remove-Item "Env:$_" -ErrorAction SilentlyContinue }
```

O estado local fica em `%APPDATA%\async-videira\state.json`. Para usar outro caminho, defina `ASYNC_VIDEIRA_STATE_PATH`.

### 5.2 Passo 1: preparar (não altera nada)

```powershell
node src/cli.ts preparar
```

Saída esperada:

```
Preparação: Culto de domingo (id-do-setlist)
Destino selecionado: Temporário
01. [resolved] Mil Graus — Renascer Praise (Holyrics 1792693855267; externalId)
02. [resolved] A Boa Parte — Florianópolis House Of Prayer e Nívea Soares (Holyrics 1792693855255; externalId)
03. [resolved] É Ele — DROPS (Holyrics 1792693855260; externalId)
Dry-run concluído: 3 ID(s) resolvido(s), sem repetidos; nenhuma escrita feita.
```

Como ler os estados de cada música:

| Estado | Significado | O que fazer |
|---|---|---|
| `resolved` | encontrada no Holyrics | nada |
| `ambiguous` | mais de uma música candidata | escolher qual é, no Videira |
| `absent` | não está no Holyrics | cadastrar a música (seção 6.3) |
| `repeated` | a música aparece mais de uma vez no setlist | o Holyrics guarda só uma vez; o app avisa |

Confira também a linha **Destino selecionado**. Se não for o culto ou a playlist que você quer, selecione o correto no Holyrics e rode `preparar` de novo.

### 5.3 Passo 2: aplicar

Com tudo resolvido e o destino correto:

```powershell
node src/cli.ts aplicar --yes
```

O que o app faz, nesta ordem:

1. Confere que o setlist, a biblioteca e o destino **não mudaram** desde o `preparar`. Se mudaram, para e pede um novo `preparar`.
2. Guarda uma cópia da playlist atual.
3. Limpa a playlist selecionada e adiciona as músicas na ordem do setlist.
4. **Lê a playlist de volta** e compara com o esperado.
5. Se algo deu errado, **restaura** a playlist anterior.
6. Só então envia o relatório ao Videira.

Saída esperada: `OK (releitura confirmada)`. O app só diz que deu certo depois de conferir no próprio Holyrics. Rodar `aplicar` de novo com a playlist já correta não altera nada (resultado `unchanged`).

> **Atenção:** o `aplicar` **substitui** a playlist selecionada. As músicas que estavam nela saem da lista, mas continuam na biblioteca. Por isso o `preparar` mostra o destino antes.

---

## 6. Rotina de domingo

Para o operador de mídia (menos de 2 minutos):

1. **Abra o Holyrics** e **selecione o culto de destino** (ou a playlist temporária, se for o caso).
2. Rode `preparar` e confira: destino, músicas e estados.
3. Resolva o que faltar (6.2 e 6.3).
4. Rode `aplicar --yes`.
5. Veja no Holyrics se a ordem está certa e projete normalmente.

### 6.1 Se o destino for a "playlist temporária"

Sem o Plan, o app não consegue verificar a data do culto na playlist temporária. Ele mostra "Temporário" e **você** precisa ter certeza de que é a playlist que vai para o telão agora.

### 6.2 Música ambígua

Duas músicas com o mesmo nome no Holyrics (versões diferentes, por exemplo). Escolha a correta e confirme o vínculo no Videira. A escolha fica salva e não será pedida de novo.

### 6.3 Música que não está no Holyrics

O app **não cria** músicas no Holyrics (isso exige o Plan). Há três caminhos, todos assistidos por você:

1. **Abrir o editor do Holyrics já preenchido.** O app abre a janela "Nova música" com título e artista. Se o Videira não tiver a letra, ela vem com o texto **`[Letra não fornecida]`**. **Cole a letra e apague esse texto antes de salvar.** Se você salvar sem trocar, essa linha aparece no telão. Depois de salvar, peça ao app para ler a biblioteca de novo e confirme o vínculo.
2. **Importar um arquivo.** No Holyrics: música → Importar → Outros → *TXT File (UTF-8)*. O nome do arquivo deve ser `Título - Artista.txt`, e os slides são separados por uma linha em branco.
3. **Já existe com outro nome?** Procure na biblioteca e vincule a música certa.

> A abertura do editor depende de uma rota interna do Holyrics (`/api/popup-createsong`), que não é documentada. Foi testada na 2.30.0 e pode mudar em outras versões. Se não abrir, use o caminho 2.

### 6.4 Música repetida no setlist

O Holyrics ignora, sem avisar, a segunda ocorrência da mesma música na playlist. O app detecta antes de aplicar e deixa uma só. Se você realmente precisa repetir uma música (um refrão no fim, por exemplo), ajuste isso no Holyrics durante o culto.

---

## 7. Instalação do aplicativo

O projeto configura um instalador de teste NSIS por usuário, sem pedir administrador. Para executar ou criar o pacote a partir do código, use Node.js 22.18+:

```powershell
npm install
npm run dev
npm run build
npm run dist:win
npm run smoke
```

O instalador será gerado em `dist/`. Builds de teste ainda não têm assinatura; o Windows SmartScreen pode avisar que o editor é desconhecido. Confira que o instalador veio do canal oficial e mantenha as verificações do Windows ativas. A desinstalação preserva `%APPDATA%\\async-videira` por padrão.

`npm run smoke` abre o app empacotado e prepara um setlist sintético contra APIs falsas em loopback; não chama nem altera o Holyrics real. Políticas de Device Guard podem bloquear binários de teste sem assinatura.

Na primeira execução, configure os endereços e tokens em **Configuração** e teste as conexões. Tokens usam `safeStorage` do sistema e não ficam no JSON de preferências. Esta versão inicial ainda não tem o assistente completo, revisão de vínculos ou confirmação visual do destino antes da aplicação; confira a playlist selecionada no Holyrics. A Ajuda offline abre pelo menu lateral.

O protótipo das telas pode ser visto localmente:

```powershell
node docs/design/prototype/serve.ts
```

e aberto em `http://localhost:5177/` (cenários: `?cenario=pronto`, `pendencias`, `temporaria`, `lote`, `primeira`, `reconciliacao`).

Suporte a macOS: DMG previsto na configuração, ainda **não testado**. O comportamento da API do Holyrics não tem diferença de código entre os sistemas, mas o caminho dos arquivos e o firewall do Mac precisam ser validados num computador real.

---

## 8. Trocar de computador ou reinstalar o Holyrics

O Holyrics identifica cada música por um número gerado no próprio computador. Se esses números mudarem, os vínculos antigos deixam de valer. Depende de como você leva as músicas:

| Como levar as músicas | O número de cada música é mantido? |
|---|---|
| Copiar a pasta `Holyrics\files` | **Sim** |
| Backup `.hbac` do Holyrics | **Sim** |
| Sincronização pelo Google Drive do Holyrics | **Sim** |
| Exportar `.muf` ou `.mufl` e importar no PC novo | **Não** |
| Importar TXT, OpenLP, OpenSong e similares | **Não** |

**Recomendação:** use a cópia da pasta, o backup `.hbac` ou o Google Drive.

Se os números mudarem de qualquer forma, o app percebe que a biblioteca mudou (a lista de ids não bate mais) e entra num **modo de reconciliação**: ele procura as mesmas músicas pelo título e artista exatos, propõe os novos vínculos para você confirmar em lote e **não apaga** os vínculos antigos.

No computador novo, repita as seções 3 (Holyrics) e 5 (tokens). Gere um token novo no Holyrics. O token do Videira pode ser o mesmo, ou crie outro e revogue o antigo.

---

## 9. Segurança e boas práticas

- **Dois tokens, dois cofres.** O do Holyrics dá acesso à playlist do culto na rede local. O do Videira dá acesso de leitura aos setlists publicados. Nunca cole nenhum dos dois em conversas, e-mails, repositórios ou prints.
- **Permissões mínimas** no token do Holyrics (seção 3.2). Se precisar de outra ação algum dia, adicione só ela.
- **Revogue e troque** os tokens quando um voluntário sair da equipe ou quando um token aparecer onde não devia.
- **Firewall ativo** no computador do Holyrics. Não abra a porta 8091 para a internet.
- **Teste sempre em playlist de teste** antes de usar numa mudança grande.
- O arquivo de estado local **não contém tokens**. Se um dia encontrar um token nele, trate como falha e avise a equipe.

---

## 10. Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `Holyrics did not respond` | Holyrics fechado, API desligada ou porta diferente | Abra o Holyrics, ative a API Server e confira a porta (8091) |
| `invalid token` | token errado ou apagado no Holyrics | Gere um token novo e atualize `HOLYRICS_TOKEN` |
| `unauthorized action` | falta uma permissão no token | Em **Gerenciar permissões**, marque a ação da seção 3.2 que falta (`GetSongs`, por exemplo) |
| Mensagem de assinatura do Holyrics Plan | a ação exige o Plan | Use só a playlist selecionada; para criar músicas, use a seção 6.3 |
| O setlist não aparece | não está publicado, ou está sem data, ou token de outra igreja | No Videira, publique e preencha data e hora; confira o token |
| `Videira data, Holyrics catalog ... changed since preparar` | algo mudou entre o preparar e o aplicar | Rode `preparar` de novo |
| "Destino selecionado" não é o culto certo | outra playlist está selecionada no Holyrics | Selecione o culto certo no Holyrics e rode `preparar` de novo |
| A música ficou de fora da playlist | música ausente, ambígua ou repetida | Veja o estado no `preparar` e use a seção 6 |
| O editor "Nova música" não abre | editor já aberto, versão do Holyrics diferente ou API desligada | Feche o editor aberto, espere 2 segundos e tente de novo; se persistir, importe por arquivo |
| Apareceu `[Letra não fornecida]` no telão | a música foi salva sem trocar o texto | Edite a música no Holyrics e cole a letra |
| `sync-report não enviado; enfileirado` | sem internet ou Videira indisponível | Nada a fazer: o relatório é reenviado na próxima execução |
| Depois de reinstalar, os vínculos sumiram | os números das músicas mudaram | Siga a seção 8 (reconciliação) |

---

## 11. O que ainda não foi validado

- macOS: caminho dos arquivos do Holyrics, firewall e a API.
- Comportamento quando o Holyrics fecha **durante** a aplicação (o app tenta restaurar a playlist, mas o cenário real não foi testado).
- Abertura do editor com um editor já aberto (resposta 409).
- Versões do Holyrics diferentes da 2.30.0.
- O instalador, a atualização automática e a assinatura de código.

Se encontrar um comportamento diferente do descrito aqui, registre em `docs/open-questions.md` com a versão do Holyrics e o que aconteceu.

---

## 12. Referências no projeto

- Decisões de arquitetura: `docs/adr/` e `docs/architecture.md`.
- Contrato entre a interface e o núcleo: `docs/contracts/ui-core-ipc.md`.
- UX e protótipo: `docs/design/` e `docs/design/prototype/` (arquivado).
- Relatórios de investigação e validações ao vivo: `discovery/` (`holyrics-api-map.md`, `live-validation.md`).
