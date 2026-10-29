# Brainstorm: troca de PC e SQLite local no async-videira

Data: 2026-10-29  
Premissa atualizada: cada igreja usa **um único computador com Holyrics**. Escopo: avaliar identidade/migração de vínculos na troca de computador e comparar SQLite local com estado remoto ou cache simples. Não é implementação.

## Recomendação

**Não adicionar SQLite local como banco de dados do produto neste momento.** Manter o Videira Music como fonte da verdade de vínculos (`SongExternalLink`) e usar no desktop um estado local pequeno, versionado e respaldado: configuração/segredos no armazenamento seguro do SO; cache de catálogo e setlist; fila de relatórios pendentes; e histórico operacional enxuto em JSON ou armazenamento equivalente. Uma única biblioteca com dezenas ou centenas de músicas não justifica, por volume, um segundo banco relacional e as migrações associadas.

Para troca de PC, tratar `installationId` como identidade de uma **linhagem lógica da biblioteca**, não como hash do computador. Persisti-lo no estado do app e no servidor; carregá-lo ao restaurar/transferir o estado. Detectar troca ou reimportação pelos snapshots do catálogo, não apenas pelo hostname ou pelo ID Holyrics. Ao encontrar mesmos títulos e artistas normalizados com IDs diferentes, preparar uma migração sugerida, pedir confirmação e preservar o vínculo antigo no histórico. O matching exato reduz trabalho, mas duplicatas e diferenças de metadados ainda exigem revisão.

Se a igreja precisa de histórico auditável extenso, consultas locais ou fila transacional robusta, SQLite pode ser uma evolução justificada. Hoje o servidor remoto já é a fonte compartilhada e o volume é pequeno; adicionar SQLite agora duplica responsabilidade sem resolver a identidade por si só.

## Evidência operacional nova

`live-validation.md` confirma Holyrics 2.30.0 em Windows, sem Plan: `GetSongs(fields=id,title,artist)` leu 29 músicas; os IDs retornados coincidiram com `_id` no SQLite Holyrics. A escrita e restauração da playlist selecionada funcionaram pela API oficial. A troca de PC/importação de biblioteca **não foi testada**.

Também foram validados dois detalhes relevantes à UX e ao histórico:

- O Holyrics descarta silenciosamente IDs repetidos na mesma playlist. A bridge atual reportou sucesso mesmo sem confirmar a leitura de volta; portanto o app deve validar a playlist após aplicar e distinguir duplicatas. O histórico não pode registrar “aplicado” baseado só na resposta da chamada.
- O fallback `SearchLyrics` faz busca ampla: “E Ele” trouxe outro título e a bridge pulou uma música que tinha correspondência exata após normalização. A associação explícita por ID funcionou no teste real. Para reconciliação, comparar título/artista normalizados localmente, em vez de tratar a cardinalidade bruta de busca como ambiguidade.

## A) Troca de computador e identidade da biblioteca

### O que `installationId` pode e não pode significar

O ID Holyrics é gerado localmente (epoch ms). A análise não demonstra que exportar/importar preserve IDs; por segurança, assumir que os IDs podem mudar. Um UUID gerado no primeiro pareamento identifica a instalação/linhagem conhecida pelo async-videira, mas **não identifica automaticamente a biblioteca Holyrics**: o Holyrics não oferece, segundo os documentos consultados, um identificador estável de biblioteca pela API.

Não usar hostname, serial do disco, MAC address ou hash de hardware como identidade principal. Eles mudam em manutenção/troca de PC, são difíceis de ler portavelmente em Windows/macOS e não dizem se a biblioteca foi copiada ou recriada. Também não usar só o conjunto de IDs como identidade: justamente esses IDs podem mudar na importação.

Separar conceitos:

- **`installationId` / `libraryLineageId`**: UUID do async-videira que acompanha a biblioteca durante uso e migração intencional. Idealmente manter o nome `installationId` na API já decidida, mas documentar que representa a instalação pareada/linhagem operacional, não o hardware.
- **`catalogSnapshotId` e horário**: identificam cada leitura/snapshot para comparação e auditoria, não são identidade persistente.
- **Assinatura de conteúdo**: resumo derivado de títulos/artistas normalizados (e contagem/duplicatas) ajuda a detectar catálogo parecido. É evidência de continuidade, não prova: duas bibliotecas podem ter o mesmo conteúdo e a própria música pode ser renomeada.
- **IDs Holyrics**: endereço efetivo dos registros na biblioteca corrente. Só válidos para aplicação depois de confirmar que constam no catálogo atual.

O melhor modo de preservar a linhagem é incluir o estado async-videira no procedimento de backup/transferência do PC. Ao restaurar, importar as músicas Holyrics e o estado do app, o mesmo `installationId` segue junto. Se não houver cópia desse estado, o app não deve deduzir identidade com certeza: oferece reconhecer catálogo e iniciar reconciliação como migração da instalação anterior.

### Como detectar catálogo alterado

Ao conectar ou antes de publicar, ler um snapshot completo com `GetSongs` e comparar com o snapshot anterior:

1. **Mesmo ID e metadados iguais**: registro estável.
2. **Mesmo ID, título/artista mudou**: provável edição/renomeação; manter o vínculo por ID, atualizar rótulo externo e registrar a alteração. Se a mudança for inesperada, sinalizar revisão.
3. **ID antigo desapareceu; aparece novo ID com chave normalizada exata de título + artista**: candidato forte de migração/reimportação; propor remapeamento e exigir confirmação (em lote, com revisão dos casos únicos).
4. **Um antigo para vários novos ou vários antigos para um novo**: duplicata/fusão; não migrar automaticamente. Pedir decisão por música e evitar apontar silenciosamente dois vínculos ao mesmo ID.
5. **Sem candidato exato**: deixar o vínculo antigo como obsoleto/histórico e colocar a música em “não resolvida”. Oferecer busca manual e fuzzy somente como sugestão confirmável.

Normalização exata pode ignorar caixa, espaços repetidos, acentos e pontuação definida. Não remover palavras semanticamente importantes como “ao vivo”, “versão”, “acústico” ou qualificadores de artista. Artista vazio não deve equivaler automaticamente a qualquer artista. Guardar os campos originais, a chave normalizada e a regra/versão de normalização para explicar uma sugestão.

O snapshot precisa ter estado de conclusão. Uma leitura incompleta, falha de API ou upload interrompido não pode ser interpretada como exclusão em massa. Usar contagem/checksum e confirmar uma sincronização completa antes de marcar IDs ausentes como obsoletos. Considerar arquivadas separadamente, pois `GetSongs` exclui arquivadas por padrão.

### Confirmação, migração e histórico

Uma migração confirmada não deve sobrescrever nem apagar o rastro anterior. Modelo conceitual:

- vínculo ativo: música Videira + escopo/`installationId` + provider + `externalId` atual + título/artista observados + estado + data/origem da confirmação;
- histórico de mudanças: ID anterior, ID novo, snapshot de origem/destino, regra de sugestão, quem confirmou e quando;
- ID anterior fica inativo/aposentado para aplicação, mas consultável para auditoria e rollback.

Fazer a troca como operação consistente: validar que o novo ID está no catálogo atual, verificar conflitos, confirmar a proposta e só então atualizar o vínculo ativo. O setlist publicado passa a emitir o novo `externalId`; a bridge ainda deve validar localmente antes da escrita e reler a playlist depois. Se a migração der errado, o histórico permite reverter o ID ativo.

`SongExternalLink` atual já é a peça de vínculo remoto, mas o discovery não garante que tenha campos para identidade de instalação, status histórico e migração. A menor evolução provável é acrescentar o escopo e manter histórico/auditoria (ou uma tabela de histórico), sem criar uma cópia local autoritativa.

### Reinstalação no mesmo PC

Há vários casos diferentes; “mesmo computador” não garante que o estado do app sobreviveu:

- **Atualização/reinstalação preserva dados do usuário e Keychain/Credential Manager**: reusar o `installationId` e o cache persistidos.
- **App reinstalado, estado local removido, biblioteca Holyrics intacta**: parear de novo; consultar servidor pelo vínculo existente da organização/instalação e comparar o catálogo. Permitir recuperar o `installationId` anterior de um backup/código de recuperação. Se não recuperar, oferecer “reconhecer esta biblioteca” pela assinatura do snapshot, mas solicitar confirmação antes de reassociar.
- **PC novo e Holyrics importado, IDs preservados**: IDs continuam presentes; após pareamento, conferir catálogo e manter vínculos existentes. A transferência do estado local continua recomendada para preservar instalação e histórico.
- **PC novo e músicas reimportadas, IDs novos**: fluxo de reconciliação por título/artista normalizados exatos, com confirmação. Criar nova identidade/geração para o novo estado e aposentar a anterior após a migração.
- **PC reinstalado e biblioteca recriada sem backup**: não existe base segura para reconstruir casos sem match exato. Recuperar vínculos do Videira, apresentar candidatos e exigir revisão dos restantes.

Evitar gerar um ID novo em toda reinstalação do executável; a identidade deve viver nos dados do usuário, sobreviver a upgrade e ser recuperável via servidor/backup. Também evitar reutilizar automaticamente identidade quando o catálogo é radicalmente diferente: pode ser outra biblioteca no mesmo PC.

## B) SQLite local como intermediário

Comparação para uma igreja, um PC e uso semanal (domingo):

| Opção | Fonte da verdade | Offline e recuperação | Complexidade / adequação |
|---|---|---|---|
| **SQLite local autoritativo** para vínculos, catálogo e histórico | Vira o banco operacional do desktop; o Videira pode não conhecer o vínculo vigente ou recebe cópias | Bom offline após sync; backup precisa incluir DB e segredos/configuração. Restaurar DB antigo pode ressuscitar vínculos/snapshots velhos | Mais garantias transacionais e consultas, mas precisa versionar/migrar schema, lidar com corrupção/backup, sincronização e conflitos com Postgres. Excesso para dezenas/centenas de músicas e um operador principal. Não confundir com escrita no SQLite do Holyrics: são bancos diferentes; a recomendação contra alterar o banco do Holyrics continua valendo. |
| **SongExternalLink remoto + cache local JSON/arquivo** | Videira Music/Postgres é a verdade dos vínculos; Holyrics é verdade do catálogo/IDs correntes | Cache permite preparar setlist e dry-run sem internet; enfileira relatórios e operações pendentes. Backup simples, mas precisa ser atômico e versionado | Boa proporção para o caso. Menos infraestrutura e migrações; validar versão do JSON e tolerar cache ausente/corrompido reconstruindo do servidor e Holyrics. |
| **Somente servidor + app sem estado persistente** | Videira para vínculos; Holyrics para catálogo | Requer internet para buscar vínculos/setlist e perde contexto de migração/fila quando offline ou app fecha | Mais simples inicialmente, mas ruim para internet instável, uso semanal e relatórios pendentes. Repetir leitura do catálogo é barato; perder fila/confirmações é o problema. |
| **Cache em memória apenas** | Igual ao remoto | Offline só enquanto o processo continua aberto; fechamento/reinício perde cache, fila e progresso | Inadequado como única estratégia para app desktop usado uma vez por semana. |

### Tamanho e portabilidade

Dezenas a centenas de pares título/artista/ID ocupam pouco espaço; snapshots compactos continuam pequenos. O desafio não é desempenho nem tamanho, e sim sincronização, integridade e recuperação. Windows e macOS têm armazenamento seguro de segredos próprio; manter tokens fora do JSON em texto aberto. Para dados de catálogo/cache não secretos, um arquivo JSON versionado em diretório de dados do usuário é suficiente no início. Escrever por arquivo temporário + rename, guardar `schemaVersion`, `updatedAt`, `installationId` e checksum, e tolerar reconstrução.

SQLite funciona nos dois sistemas, mas sua portabilidade multiplataforma não elimina o custo de migração de schema, backup coerente e sincronização remota. Se for adotado no futuro, ele deve ser **cache/índice local reconstruível** ou fila/histórico com propósito definido; não uma segunda verdade de vínculos concorrente com `SongExternalLink`.

### Histórico de aplicações

O Videira já recebe `HolyricsSyncReport`, e a validação confirmou gravação do relatório. Usar esse histórico remoto como registro compartilhado de execução. Localmente, manter somente o necessário para resiliência: relatórios não enviados, último setlist processado, hora do último snapshot e estado de migração incompleto. Se a igreja exigir consulta offline de histórico de longo prazo, cachear os relatórios baixados; SQLite só se volume/consulta justificar.

O relatório deve refletir a verificação por releitura, não apenas retorno `status: ok` da chamada de adição. A validação ao vivo provou falso positivo com música repetida: Holyrics descarta duplicatas silenciosamente e a bridge atual reportou `OK` sem verificar sequência efetiva. Antes de registrar aplicação bem-sucedida, detectar IDs repetidos, comparar resultado esperado deduplicado com playlist relida e classificar cada item como aplicado, duplicado ou omitido.

## Fluxo recomendado para troca de PC

1. No PC antigo, fazer backup do estado async-videira (inclui `installationId`, último snapshot, cache e migrações pendentes) e garantir que os vínculos remotos estejam sincronizados. O backup normal do Holyrics deve ser tratado separadamente.
2. No PC novo, instalar/parear o app e importar a biblioteca Holyrics. Restaurar o estado async-videira quando disponível; se não, recuperar vínculos remotos e solicitar identificação da biblioteca anterior.
3. Ler catálogo completo e classificar: IDs preservados, candidatos de renomeação, IDs novos com match exato, ambiguidades, ausentes e arquivados.
4. Mostrar resumo e exigir confirmação para remapeamentos (pode oferecer “confirmar todos os matches únicos exatos” como uma ação consciente, com lista revisável). Fuzzy nunca migra sem escolha.
5. Registrar migração e aposentadoria dos IDs antigos; atualizar os vínculos ativos no Videira. Guardar cópia local/cache e relatório da migração.
6. Fazer dry-run do próximo setlist, confirmar destino atualmente selecionado no Holyrics, aplicar, reler e só então enviar relatório de sucesso.

## Riscos e limites

- Título e artista normalizados iguais não provam identidade musical: covers, traduções, arranjos ou duplicatas podem compartilhar metadados. A confirmação humana é necessária mesmo para matches exatos.
- Se o app for reinstalado sem backup, a identidade da linhagem pode ser recuperada do servidor ou reconhecida por snapshot, mas não pode ser inferida com certeza só do hardware.
- Backup antigo restaurado pode reverter cache e reabrir um ID obsoleto. Sempre revalidar contra snapshot atual antes de aplicar.
- Múltiplos IDs do Holyrics podem ser perdidos/colapsados na mesma playlist; duplicatas precisam de regra explícita e relatório verificado por leitura de volta.
- O desktop depende de duas conectividades distintas: rede com Videira para setlists/vínculos/relatórios e Holyrics local ativo para catálogo/aplicação. Cache permite preparação e fila, não aplicação se a API local estiver indisponível.
- O estado JSON deve ser substituível e recuperável; se crescer para sincronização concorrente, consultas complexas, auditoria offline ou milhares de itens, reavaliar SQLite local.

## Decisões para o usuário

1. **A igreja vai incluir o estado async-videira no backup/migração junto com a biblioteca Holyrics?** Recomendado: sim, mas o pareamento também deve poder recuperar vínculos do servidor quando esse backup faltar.
2. **Pode o app propor matches exatos e permitir confirmação em lote revisável, ou cada vínculo deve ser confirmado individualmente?** Recomendado: lote explícito apenas para candidatos únicos exatos; duplicatas e fuzzy sempre individuais.
3. **Qual requisito de histórico offline existe?** Se basta fila de relatórios e cache recente (recomendado para uso semanal), JSON/arquivo local basta. Se há exigência de histórico local auditável e pesquisável por anos sem internet, isso pode justificar SQLite local.

## Fontes consultadas

- `discovery/brainstorm-associacao.md`: decisões de escopo, vínculos, catálogo, UX e offline.
- `discovery/live-validation.md`: validação real da API, escrita sem Plan, matching, duplicatas e relatórios.
- `discovery/holyrics-re.md`: IDs locais, armazenamento e limites do Holyrics.
- `discovery/holyrics-api-map.md`: ações e comportamento da API.
- `discovery/holyrics-troca-pc.md`: não existia na data desta análise.
