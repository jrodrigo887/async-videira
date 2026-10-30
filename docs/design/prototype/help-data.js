// GERADO por build-help.mjs a partir de src/help/*.md. Não edite à mão: edite o .md e rode node src/ui/prototype/build-help.mjs
window.PROTO_HELP = {
 "source": "src/help",
 "topics": [
  {
   "id": "comecar",
   "titulo": "Como o app funciona",
   "publico": "operador",
   "categoria": "comecar",
   "ordem": 1,
   "palavrasChave": [
    "início",
    "visão geral",
    "o que é",
    "para que serve",
    "setlist",
    "playlist"
   ],
   "relacionados": [
    "rotina-de-domingo",
    "configurar-holyrics",
    "configurar-videira"
   ],
   "body": "O async-videira coloca no Holyrics as músicas do setlist publicado no Videira Music.\n\n1. A liderança de louvor publica o setlist no Videira Music, com data e hora.\n2. Você abre o Holyrics e seleciona o culto do dia.\n3. O app mostra as músicas e diz o que está pronto e o que precisa de você.\n4. Você clica em **Publicar no Holyrics** e confirma o que sai e o que entra.\n5. O app monta a playlist na ordem do setlist e confere no próprio Holyrics.\n\n> O app só muda a **playlist que está selecionada** no Holyrics. Ele não apaga músicas da biblioteca e não mexe no banco de dados do Holyrics.\n\n## O que cada lugar guarda\n\n| Onde | O quê |\n|---|---|\n| Videira Music | músicas, setlists publicados e os vínculos (qual música do Videira é qual música do Holyrics) |\n| Holyrics | a biblioteca de letras e a playlist do culto |\n| Este computador | os dois tokens, guardados no cofre do sistema, e um arquivo de estado sem tokens |\n\n## Tempo\n\nA primeira configuração leva de 20 a 30 minutos e normalmente é feita por um técnico. Depois disso, cada domingo leva uns 2 minutos.\n"
  },
  {
   "id": "configurar-holyrics",
   "titulo": "Configurar o Holyrics (API e token)",
   "publico": "tecnico",
   "categoria": "tecnico",
   "ordem": 1,
   "palavrasChave": [
    "holyrics",
    "api server",
    "token",
    "permissões",
    "porta",
    "8091",
    "configurar",
    "gerenciar permissões",
    "invalid token",
    "não responde"
   ],
   "relacionados": [
    "seguranca-dos-tokens",
    "problemas-comuns",
    "configurar-videira"
   ],
   "body": "Feito uma vez, pelo técnico. Precisa do **Holyrics 2.26.0 ou superior**. Foi testado na 2.30.0.\n\n## 1. Ligar a API Server\n\n1. Abra o Holyrics.\n2. Vá em **Arquivo → Configurações → API Server**. O nome do menu pode variar um pouco conforme a versão.\n3. Marque **Ativar (local)**. A porta padrão é **8091**. Só mude se outro programa já usar essa porta.\n4. Espere alguns segundos. O servidor pode demorar para subir depois de ligar.\n\nPara conferir, abra no navegador `http://127.0.0.1:8091/api/GetVersion`. Sem token, a resposta esperada é `{\"status\": \"error\", \"error\": \"invalid token\"}`, e ela quer dizer que a API está no ar.\n\n> Não ative a opção **Web** (acesso pela internet). O app não usa.\n\n## 2. Criar o token com permissões mínimas\n\n1. Na mesma tela, clique em **Gerenciar permissões** e crie um token com o nome `async-videira`.\n2. Nas permissões **Local**, marque **somente** estas ações:\n\n| Ação | Para que serve |\n|---|---|\n| `GetVersion`, `GetTokenInfo`, `GetAPIServerInfo`, `GetHolyricsPlanInfo` | verificar a conexão e se há Plan |\n| `GetSongs` | ler a biblioteca de músicas (id, título e artista) |\n| `SearchLyrics`, `GetLyrics` | buscar músicas |\n| `GetLyricsPlaylist` | ler a playlist selecionada |\n| `AddLyricsToPlaylist`, `RemoveFromLyricsPlaylist` | montar a playlist na ordem do setlist |\n| `GetCurrentSchedule` | saber qual culto ou playlist está selecionado |\n\n3. **Não marque** mais nada: avançar slide, grupos de músicas, playlist de mídia etc. Quanto menos o token puder, menos estrago ele faz se vazar.\n4. Copie o token (16 letras e números) e cole no app, em **Ajustes** ou na primeira configuração. Não mande o token por conversa ou e-mail.\n\n## 3. Sem Holyrics Plan\n\nO app funciona **sem** o Plan, com duas limitações:\n\n- Ele só muda a playlist que está **selecionada** no Holyrics. Não escolhe o culto sozinho.\n- Ele não cria músicas. Para isso, veja [Música que não está no Holyrics](topico:musica-nao-esta-no-holyrics).\n\n## 4. Antes do primeiro uso de verdade\n\nNão teste no culto real. No Holyrics, selecione a playlist **Temporário** ou crie um culto de teste. Faça o primeiro teste sem nenhum culto em andamento.\n\n> A API do Holyrics escuta em todas as redes do computador, não só neste computador. Veja [Segurança dos tokens](topico:seguranca-dos-tokens).\n"
  },
  {
   "id": "configurar-videira",
   "titulo": "Configurar o Videira Music",
   "publico": "operador",
   "categoria": "comecar",
   "ordem": 2,
   "palavrasChave": [
    "videira",
    "token de integração",
    "setlist",
    "publicar",
    "data",
    "hora",
    "administrador",
    "não aparece",
    "recusou"
   ],
   "relacionados": [
    "configurar-holyrics",
    "seguranca-dos-tokens",
    "problemas-comuns"
   ],
   "body": "## Token de integração\n\nQuem cria é uma pessoa com perfil de **administrador da igreja** no Videira Music.\n\n1. Entre no Videira Music como administrador.\n2. Abra a tela da integração com o Holyrics e crie um **token de integração**.\n3. Copie o token. **Ele aparece uma única vez.** Se perder, revogue e crie outro.\n4. Cole o token no app, na primeira configuração ou em **Ajustes**.\n\nEsse token só permite ler os setlists publicados da sua igreja e enviar os avisos de resultado. Se vazar, revogue na mesma tela do Videira.\n\n## Para o setlist aparecer no app\n\nNo Videira Music, o setlist precisa estar:\n\n- com status **publicado**;\n- com **data e hora** preenchidas;\n- com as músicas na ordem desejada.\n\nSetlists em rascunho, excluídos ou sem data **não aparecem**.\n"
  },
  {
   "id": "destino-playlist-temporaria",
   "titulo": "Destino e playlist temporária",
   "publico": "operador",
   "categoria": "domingo",
   "ordem": 4,
   "palavrasChave": [
    "destino",
    "temporário",
    "playlist temporária",
    "culto errado",
    "selecionado",
    "data diferente",
    "estou no culto certo"
   ],
   "relacionados": [
    "rotina-de-domingo",
    "problemas-comuns"
   ],
   "body": "O app só consegue mudar a playlist que está **selecionada** no Holyrics. Esse é o **destino**, mostrado no cartão **Destino no Holyrics**.\n\n## Para trocar o destino\n\n1. No Holyrics, selecione o culto certo.\n2. No app, clique em **Verificar de novo**.\n\n## Culto de outra data\n\nSe o culto selecionado for de um dia diferente do setlist, o app avisa. Confira e, se estiver errado, selecione o culto certo no Holyrics.\n\n## Playlist temporária\n\nSem o Holyrics Plan, o app **não consegue ver a data** da playlist temporária. Ele mostra \"Playlist temporária\" e pede que **você** confirme.\n\nAntes de substituir, marque **Estou no culto certo**. Só marque se tiver certeza de que essa é a playlist que vai para o telão agora.\n"
  },
  {
   "id": "musica-ambigua-e-vinculos",
   "titulo": "Música ambígua e vínculos",
   "publico": "operador",
   "categoria": "domingo",
   "ordem": 2,
   "palavrasChave": [
    "ambígua",
    "escolher versão",
    "vínculo",
    "confirmar",
    "lote",
    "parecida",
    "duas músicas",
    "mesmo nome"
   ],
   "relacionados": [
    "musica-nao-esta-no-holyrics",
    "trocar-de-computador",
    "rotina-de-domingo"
   ],
   "body": "O **vínculo** diz ao app qual música do Holyrics corresponde a cada música do Videira. Ele fica salvo no Videira Music, e você confirma uma vez só.\n\n## Como o app encontra cada música\n\n| Situação | O que o app faz |\n|---|---|\n| Já existe vínculo salvo | usa direto, que é o caminho mais seguro |\n| Sem vínculo, mas título e artista **iguais** (acentos e maiúsculas não importam) a **uma** música do Holyrics | sugere o vínculo para você confirmar |\n| Duas músicas parecidas, ou nenhuma | pede que você escolha ou cadastre a música |\n\nO app **nunca** escolhe sozinho uma música \"parecida\".\n\n## Confirmar em lote\n\nEm **Revisar músicas**, as sugestões exatas e únicas já vêm marcadas. Desmarque o que não quiser e clique em **Confirmar vínculos**. Dá para desfazer logo em seguida.\n\n## Escolher versão\n\nQuando há duas músicas com o mesmo nome no Holyrics (versões diferentes, por exemplo), clique em **Escolher** e marque a certa. A escolha fica salva e não será pedida de novo.\n\n## Nome parecido, mas não igual\n\nSe a diferença for de pontuação ou de uma letra, a música aparece como **Conferir parecida**. Ela nunca entra no lote: confira e confirme essa música sozinha.\n"
  },
  {
   "id": "musica-nao-esta-no-holyrics",
   "titulo": "Música que não está no Holyrics",
   "publico": "operador",
   "categoria": "problema",
   "ordem": 1,
   "palavrasChave": [
    "ausente",
    "cadastrar",
    "nova música",
    "editor",
    "abrir no holyrics",
    "importar",
    "txt",
    "letra não fornecida",
    "placeholder",
    "editor não abre"
   ],
   "relacionados": [
    "musica-ambigua-e-vinculos",
    "problemas-comuns",
    "o-que-ainda-nao-funciona"
   ],
   "body": "O app **não cria** músicas no Holyrics, porque isso exige o Holyrics Plan. Você cadastra a música e o app ajuda. Há três caminhos.\n\n## 1. Abrir o editor do Holyrics já preenchido\n\n1. No app, clique em **Abrir no Holyrics**. Abre no Holyrics a janela \"Nova música\" com o título e o artista.\n2. **Cole a letra.**\n3. **Apague o texto `[Letra não fornecida]`.** Ele entra no lugar da letra quando o app não tem a letra.\n4. Clique em **Salvar** no Holyrics.\n5. Volte ao app e clique em **Ler a biblioteca de novo**.\n6. Confira a música encontrada e clique em **Confirmar vínculo**.\n\n> **Cuidado:** se você salvar sem trocar `[Letra não fornecida]`, essa frase aparece no telão.\n\nSe a música já foi salva com essa frase, abra a música na biblioteca do Holyrics, troque o texto pela letra e salve. Depois clique em **Ler de novo** no app. Não clique em **Abrir no Holyrics** de novo: isso abre o editor de uma música **nova** e cria uma segunda cópia.\n\nSe o editor não abrir:\n\n- confira se o Holyrics está aberto e com a API ligada;\n- se já houver uma janela de música aberta no Holyrics, salve ou feche essa janela;\n- espere 2 segundos e tente de novo.\n\n> A abertura do editor depende de uma função interna do Holyrics que não é documentada. Ela foi testada na versão 2.30.0 e pode mudar em outras versões. Se não abrir, use o caminho 2. Abrir com outro editor já aberto: **(não testado)**.\n\n## 2. Importar um arquivo\n\nNo Holyrics: **música → Importar → Outros → TXT File (UTF-8)**.\n\n- O nome do arquivo deve ser `Título - Artista.txt`.\n- Os slides são separados por uma linha em branco.\n\nDepois, no app, clique em **Ler a biblioteca de novo**.\n\n## 3. Já existe com outro nome?\n\nNo app, abra **Outros caminhos → Procurar na biblioteca**, encontre a música certa e clique em **Usar esta**.\n"
  },
  {
   "id": "musica-repetida",
   "titulo": "Música repetida no setlist",
   "publico": "operador",
   "categoria": "domingo",
   "ordem": 3,
   "palavrasChave": [
    "repetida",
    "duas vezes",
    "duplicada",
    "mesma música",
    "refrão"
   ],
   "relacionados": [
    "rotina-de-domingo"
   ],
   "body": "O Holyrics **não aceita a mesma música duas vezes** na playlist: ele ignora a segunda sem avisar.\n\nO app percebe isso antes de publicar e deixa a música **uma vez só**, na primeira posição em que ela aparece. A linha mostra **Repetida — entra 1 vez**.\n\nSe você precisa mesmo repetir a música (um refrão no fim, por exemplo), faça isso no Holyrics durante o culto.\n"
  },
  {
   "id": "o-que-ainda-nao-funciona",
   "titulo": "O que ainda não foi testado",
   "publico": "operador",
   "categoria": "problema",
   "ordem": 3,
   "palavrasChave": [
    "limitações",
    "macos",
    "mac",
    "não testado",
    "versão",
    "instalador",
    "atualização"
   ],
   "relacionados": [
    "problemas-comuns",
    "musica-nao-esta-no-holyrics"
   ],
   "body": "O app está em construção. Estes pontos ainda **não foram validados**:\n\n- **macOS** **(não testado)**: caminho dos arquivos do Holyrics, firewall e a API. O suporte está previsto.\n- **Holyrics fechado no meio da publicação** **(não testado)**: o app tenta devolver a playlist anterior, mas o cenário real ainda não foi testado.\n- **Abrir o editor com outro editor já aberto** **(não testado)**.\n- **Versões do Holyrics diferentes da 2.30.0** **(não testado)**.\n- **Instalador, atualização automática e assinatura** **(não testado)**: ainda não existem.\n\nOs testes foram feitos no Windows, com Holyrics 2.30.0, sem Holyrics Plan e com um único computador com Holyrics.\n\nSe encontrar um comportamento diferente do descrito aqui, use **Copiar informações para suporte** e envie para a equipe técnica, contando o que aconteceu.\n"
  },
  {
   "id": "problemas-comuns",
   "titulo": "Problemas comuns",
   "publico": "operador",
   "categoria": "problema",
   "ordem": 2,
   "palavrasChave": [
    "erro",
    "problema",
    "não funciona",
    "não responde",
    "token recusado",
    "permissão",
    "setlist não aparece",
    "telão",
    "aviso pendente",
    "sem internet"
   ],
   "relacionados": [
    "configurar-holyrics",
    "configurar-videira",
    "musica-nao-esta-no-holyrics",
    "trocar-de-computador"
   ],
   "body": "| O que aparece | Causa provável | O que fazer |\n|---|---|---|\n| **O Holyrics não está respondendo** | Holyrics fechado, API desligada ou porta diferente | Abra o Holyrics, ligue a API Server e confira a porta (8091): [Configurar o Holyrics](topico:configurar-holyrics) |\n| **O Holyrics não aceita mais o token** | token errado ou apagado no Holyrics | Gere um token novo no Holyrics e cole em **Ajustes** |\n| **Falta permissão no Holyrics** | falta uma ação no token | Em **Gerenciar permissões**, marque a ação que falta |\n| Aviso de assinatura do Holyrics Plan | a ação exige o Plan | Use a playlist selecionada; para músicas novas, veja [Música que não está no Holyrics](topico:musica-nao-esta-no-holyrics) |\n| **Nenhum culto publicado ainda** | setlist não publicado, sem data, ou token de outra igreja | No Videira, publique e preencha data e hora; confira o token |\n| **O Videira Music recusou o token** | o token foi revogado | Peça um novo ao administrador da igreja e cole em **Ajustes** |\n| O app pede para preparar de novo | algo mudou entre preparar e publicar | Clique em **Preparar de novo** |\n| O destino não é o culto certo | outra playlist está selecionada no Holyrics | Selecione o culto certo no Holyrics e clique em **Verificar de novo** |\n| Uma música ficou de fora | música ausente, ambígua ou repetida | Veja o estado da música na tela **Culto** |\n| O editor \"Nova música\" não abre | editor já aberto, versão diferente do Holyrics ou API desligada | Feche o editor aberto, espere 2 segundos e tente de novo; se continuar, importe por arquivo |\n| Apareceu `[Letra não fornecida]` no telão | a música foi salva sem trocar o texto | Edite a música no Holyrics e cole a letra |\n| Aviso ao Videira pendente | sem internet ou Videira fora do ar | Nada a fazer: o aviso é reenviado depois |\n| Depois de reinstalar, os vínculos sumiram | os números das músicas mudaram | [Trocar de computador](topico:trocar-de-computador) |\n"
  },
  {
   "id": "rotina-de-domingo",
   "titulo": "Rotina de domingo",
   "publico": "operador",
   "categoria": "domingo",
   "ordem": 1,
   "palavrasChave": [
    "domingo",
    "culto",
    "publicar",
    "passo a passo",
    "rotina",
    "todo domingo"
   ],
   "relacionados": [
    "destino-playlist-temporaria",
    "musica-nao-esta-no-holyrics",
    "musica-ambigua-e-vinculos"
   ],
   "body": "Leva menos de 2 minutos.\n\n1. **Abra o Holyrics** e **selecione o culto de destino**, ou a playlist temporária, se for o caso.\n2. No app, abra a tela **Culto** e confira três coisas: o destino, as músicas e o estado de cada uma.\n3. **Resolva o que faltar.** Uma música pode precisar de vínculo, de escolha de versão ou de cadastro no Holyrics.\n4. Clique em **Publicar no Holyrics** e confirme.\n5. **Olhe no Holyrics** se a ordem está certa e projete normalmente.\n\n## O que acontece quando você publica\n\n1. O app confere se o setlist, a biblioteca e o destino **não mudaram** desde que você abriu a tela. Se algo mudou, ele para e pede para preparar de novo.\n2. Guarda uma cópia da playlist atual.\n3. Limpa a playlist selecionada e coloca as músicas na ordem do setlist.\n4. **Lê a playlist de volta** e compara com o esperado.\n5. Se algo deu errado, **devolve** a playlist anterior.\n6. Por fim, avisa o Videira Music do resultado.\n\nO app só diz que deu certo depois de conferir no Holyrics. Publicar de novo com a playlist já certa não muda nada.\n\n> **Atenção:** publicar **substitui** a playlist selecionada. As músicas que estavam nela saem da lista, mas continuam na biblioteca. Por isso o app mostra o destino antes de você confirmar.\n\n## Estados de cada música\n\n| Estado | O que significa | O que fazer |\n|---|---|---|\n| Pronta | encontrada no Holyrics | nada |\n| Confirmar vínculo | achamos uma música com o mesmo nome e artista | confirme uma vez |\n| Escolher versão | há mais de uma música candidata | escolha a certa: [Música ambígua e vínculos](topico:musica-ambigua-e-vinculos) |\n| Não está no Holyrics | a música não está cadastrada | [Música que não está no Holyrics](topico:musica-nao-esta-no-holyrics) |\n| Repetida | aparece duas vezes no setlist | entra uma vez só: [Música repetida](topico:musica-repetida) |\n"
  },
  {
   "id": "seguranca-dos-tokens",
   "titulo": "Segurança dos tokens",
   "publico": "operador",
   "categoria": "tecnico",
   "ordem": 3,
   "palavrasChave": [
    "segurança",
    "token",
    "senha",
    "vazou",
    "revogar",
    "firewall",
    "rede",
    "cofre"
   ],
   "relacionados": [
    "configurar-holyrics",
    "configurar-videira"
   ],
   "body": "O app usa dois tokens. Os dois ficam guardados no **cofre do sistema** deste computador e nunca aparecem em arquivos ou relatórios.\n\n| Token | O que ele permite |\n|---|---|\n| Holyrics | mexer na playlist do culto, pela rede local |\n| Videira Music | ler os setlists publicados da igreja e enviar os avisos de resultado |\n\n## Boas práticas\n\n- **Nunca cole** nenhum dos dois em conversas, e-mails, prints ou documentos compartilhados.\n- **Troque os tokens** quando um voluntário sair da equipe ou quando um token aparecer onde não devia.\n- No token do Holyrics, mantenha **só as permissões mínimas**. Se um dia precisar de outra, adicione só ela.\n- Mantenha o **firewall do Windows ligado** no computador do Holyrics. Não libere a porta 8091 para a rede ou para a internet.\n- Antes de uma mudança grande, teste numa playlist de teste.\n\n> A API do Holyrics escuta em todas as redes do computador. Qualquer aparelho da mesma rede que descubra o token consegue usá-la. Se a rede da igreja é aberta ao público, isso importa ainda mais.\n\nO arquivo de estado do app **não contém tokens**. Se um dia encontrar um token nele, trate como falha e avise a equipe.\n"
  },
  {
   "id": "trocar-de-computador",
   "titulo": "Trocar de computador ou reinstalar o Holyrics",
   "publico": "tecnico",
   "categoria": "tecnico",
   "ordem": 2,
   "palavrasChave": [
    "trocar de computador",
    "reinstalar",
    "backup",
    "hbac",
    "google drive",
    "muf",
    "importar",
    "vínculos sumiram",
    "reconciliação",
    "biblioteca mudou"
   ],
   "relacionados": [
    "musica-ambigua-e-vinculos",
    "configurar-holyrics",
    "seguranca-dos-tokens"
   ],
   "body": "O Holyrics identifica cada música por um número criado no próprio computador. Se esses números mudarem, os vínculos antigos deixam de valer.\n\n## O que mantém os números\n\n| Como levar as músicas | O número de cada música é mantido? |\n|---|---|\n| Copiar a pasta `Holyrics\\files` | **Sim** |\n| Backup `.hbac` do Holyrics | **Sim** |\n| Sincronização pelo Google Drive do Holyrics | **Sim** |\n| Exportar `.muf` ou `.mufl` e importar no computador novo | **Não** |\n| Importar TXT, OpenLP, OpenSong e similares | **Não** |\n\n**Recomendação:** use a cópia da pasta, o backup `.hbac` ou o Google Drive.\n\n## Se os números mudarem\n\nO app percebe que a biblioteca mudou e mostra **A biblioteca de músicas do Holyrics mudou**. Em **Vínculos**, ele:\n\n- procura as mesmas músicas pelo título e artista exatos;\n- propõe os novos vínculos para você confirmar em lote;\n- **não apaga** os vínculos antigos.\n\n## No computador novo\n\n1. Configure o Holyrics de novo: [Configurar o Holyrics](topico:configurar-holyrics).\n2. Gere um **token novo** no Holyrics.\n3. O token do Videira pode ser o mesmo. Se preferir, crie outro e revogue o antigo.\n"
  }
 ]
};
