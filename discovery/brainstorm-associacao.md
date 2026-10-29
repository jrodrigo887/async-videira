# Brainstorm crítico: associação Videira Music ↔ Holyrics

Data: 2026-10-29  
Escopo: avaliar a proposta de usar o app desktop para ler o catálogo local do Holyrics, enviar seus IDs ao Videira Music, associar músicas e aplicar setlists publicados. **Não é uma implementação nem uma decisão de produto.**

## Recomendação

Adotar uma **abordagem híbrida e conservadora**: o catálogo remoto existente serve como referência e facilita sugestões; cada vínculo confirmado fica no Videira Music para que o setlist exportado já traga `externalId`; o app desktop mantém cache e pode operar o vínculo/aplicação quando estiver offline. Não aceitar fuzzy match automaticamente e não usar título como chave de aplicação. A associação precisa ter um escopo decidido: organização somente se houver garantia operacional de um único Holyrics; caso contrário, por instalação.

O ponto crítico é que a proposta já está parcialmente implementada no Videira Music: `HolyricsCatalogItem`, `SongExternalLink`, `POST /api/integrations/holyrics/catalog` e `bridge.mjs --catalog` cobrem boa parte do fluxo de catálogo. O trabalho de produto/engenharia está em fechar a identidade da instalação, a experiência de revisar e confirmar vínculos, as regras de reconciliação e o onboarding do app desktop — não em inventar uma tabela de catálogo do zero.

## 1. O que existe e o que falta

### Já existe

- O app local pode consultar a API oficial do Holyrics, sem Plan, para ler catálogo: `GetSongs` (biblioteca inteira, desde 2.21; `fields=id,title,artist` reduz resposta) ou `SearchLyrics`. `GetSongs` é mais apropriado para snapshot completo. IDs são strings numéricas originadas de epoch em milissegundos.
- A ponte `bridge.mjs --catalog` já lê músicas com `SearchLyrics` e publica o catálogo em lotes. O endpoint existente aceita até 200 itens por chamada; o primeiro lote (`mode: start`) substitui o snapshot da organização e os demais continuam o lote.
- `HolyricsCatalogItem` guarda os itens importados; `SongExternalLink` guarda o vínculo entre uma música Videira e um `externalId` do provedor Holyrics. O catálogo é insumo para vínculo, não contém as cifras Videira nem envia conteúdo para o Holyrics.
- O detalhe do setlist publicado já inclui `songId`, título, artista e `externalId`. A ponte usa o ID quando está presente e só recorre à busca de título se ele faltar. Sem match único, ela omite a música e reporta resultado parcial; com IDs resolvidos, escreve na playlist atual pela API local do Holyrics, sem tocar no SQLite.
- A API do Videira é HTTPS com token de integração escopado à organização. O desktop não precisa nem deve acessar o PostgreSQL diretamente.

### Falta ou precisa ser validado

- Confirmar que a associação persistida é selecionável pelo usuário e editável por uma interface; o discovery comprova as entidades e o fluxo de catálogo, mas não estabelece uma tela de reconciliação/revisão completa.
- Definir se a tabela atual é por organização ou por instalação. Pelo comportamento descrito, o catálogo e os links são organizacionais; essa modelagem não distingue dois Holyrics independentes da mesma igreja.
- Definir uma política de matching, aprovação, desempate, arquivamento/exclusão e manutenção de vínculos obsoletos.
- Fechar como o setlist passa a receber um vínculo confirmado — presumivelmente o `SongExternalLink` já alimenta `externalId`, mas validar isso no uso real e no contrato evita depender de fallback por título.
- Tornar explícitos versão, origem e data do snapshot, ou definir um mecanismo equivalente para saber qual instalação enviou o catálogo e se está atualizado. O snapshot atual substitui o catálogo organizacional; clientes simultâneos podem sobrescrever um ao outro.
- O `GetSongs` completo e o `--catalog` precisam representar fielmente arquivadas/excluídas. `GetSongs` exclui arquivadas por padrão, mas o código observado aceita `include_archived`; remoções devem ser reconciliadas por snapshot, pois não há feed de tombstones.
- No desktop, implementar descoberta/conexão local, configuração de token Videira, armazenamento seguro, validação de permissões Holyrics, cache e relatórios. O script Node atual demonstra o mecanismo, não prova que a UX desktop esteja pronta.

## 2. Estratégias de associação

Não há uma regra única que resolva todos os casos. Separar **sugestão** de **vínculo confirmado** evita que títulos parecidos publiquem a música errada.

| Estratégia | Uso recomendado | Risco / tratamento |
|---|---|---|
| ID explícito (`externalId`) | Regra final de aplicação, depois de um vínculo confirmado | É inequívoco apenas dentro da instalação Holyrics de onde veio. Validar que o ID ainda existe no snapshot atual; não assumir portabilidade entre PCs. |
| Título + artista normalizados | Gerar candidatos e pré-selecionar correspondências muito fortes | Normalizar caixa, espaços, acentos e pontuação com cuidado; artista ausente, versão ao vivo, tradução, subtítulo e grafias distintas geram falso positivo/negativo. Mesmo match exato não deve sobrescrever um vínculo explícito silenciosamente. |
| Fuzzy matching | Ordenar candidatos por similaridade e reduzir trabalho manual | Nunca publicar automaticamente. Mostrar título/artista dos dois lados e exigir confirmação; limiar e margem entre primeiro e segundo candidatos são decisões de produto. |
| Tela de vínculo/revisão | Resolver candidatos, ambiguidades e ausências; também corrigir ou remover ligações | Deve mostrar estado (vinculada, sugestão, ambígua, ausente, obsoleta), catálogo de origem e ação explícita. Proteger contra duas músicas Videira apontarem acidentalmente ao mesmo registro. |
| Aprendizado de vínculos | Reusar uma decisão confirmada em setlists e futuras importações | Aprender apenas de confirmação explícita, nunca de mera aplicação ou de sugestão aceita implicitamente. Guardar histórico/origem e permitir desfazer; não propagar para outras instalações sem política definida. |

### Ambiguidades, duplicatas e ausências

- **Vários candidatos** (versões, artistas homônimos, título repetido): mostrar a lista e pedir escolha. Se não houver escolha, marcar como não resolvida e impedir aplicação integral ou permitir uma aplicação parcial só após confirmação clara.
- **Duplicatas no catálogo Holyrics**: preservar os registros distintos e seus IDs. A API/validação pode descartar IDs ou títulos duplicados no upload; não reduzir duas músicas a uma só por título. Expor a duplicidade na tela.
- **Uma música Videira ligada a vários IDs**: só oferecer isso se houver suporte explícito a versões/arranjos e uma regra de escolha no setlist. Caso contrário, manter um vínculo ativo por escopo e apresentar os demais como candidatos/inativos.
- **Várias músicas Videira ligadas ao mesmo ID**: pode ser legítimo em casos raros, mas tende a indicar erro. Sinalizar conflito e exigir confirmação. A playlist Holyrics não aceita o mesmo item duas vezes; setlists com repetição precisam de regra definida e relatório.
- **Música ausente no Holyrics**: indicar “não encontrada”, oferecer importar/criar manualmente e depois recarregar o catálogo. Sem Plan, a API não cria música diretamente; importação TXT/OpenLP ou editor são assistidos. Não fingir que o vínculo existe e não publicar por título aproximado.
- **Música arquivada no Holyrics**: distinguir de ausente; por padrão `GetSongs` exclui arquivadas. Pode ser vinculável, mas a UI deve alertar e a política de inclusão precisa ser deliberada.

## 3. Identidade da instalação/igreja e escopo do vínculo

O ID Holyrics é um epoch em milissegundos gerado localmente. A evidência disponível não garante que seja global, sincronizado ou estável entre PCs. Deve ser tratado como ID local de uma biblioteca/instalação. Copiar a pasta completa ou restaurar backup pode preservar IDs; importar/criar a mesma música em outro PC pode produzir outro ID. Há múltiplas máquinas por igreja? Isso precisa ser respondido antes de decidir a chave.

### Opções

- **Vínculo por organização**: mais simples e compatível com o modelo atual. Funciona se a organização tem um único catálogo Holyrics autoritativo, ou se todos os operadores usam uma biblioteca compartilhada/sincronizada e IDs preservados. Com PCs independentes, o último upload pode substituir o catálogo anterior e o mesmo vínculo pode apontar para IDs inexistentes em outra máquina.
- **Vínculo por instalação**: modelo robusto quando existem PCs/bibliotecas diferentes. Cada instalação tem uma identidade gerada pelo app e um catálogo separado; links são por `(organizationId, installationId, provider, externalId)`. Setlist precisa ser resolvido para a instalação conectada ao publicar. Requer API e UI adicionais e política para troca/reinstalação do computador.
- **Vínculo por organização com catálogo de instalações**: cada instalação publica seu catálogo, mas associações podem ser sugeridas/compartilhadas. Evita sobrescrita e permite reaproveitar decisões, mas requer detectar conflitos de IDs e confirmação quando um vínculo não existe no destino.

**Implicação:** uma tabela remota de catálogo organizacional não basta para provar que o ID é utilizável pela máquina conectada. O desktop deve comparar os IDs do setlist com o catálogo local atual antes de alterar a playlist.

## 4. Frescor do catálogo e reconciliação

- Fazer upload de snapshot ao parear e sob demanda (“Atualizar catálogo”), além de refresh antes de aplicar se o último snapshot for velho ou a máquina mudou. Não é necessário polling constante; o catálogo pode mudar enquanto o Holyrics está fechado.
- Um snapshot completo é preferível a append para refletir desaparecimentos. Fazer upload atômico por sessão/versão: só marcar catálogo novo como atual quando todos os lotes concluírem. O comportamento atual substitui no primeiro lote; interrupção no meio pode deixar snapshot parcial caso não exista staging/commit no servidor — validar e, se necessário, corrigir o contrato.
- Mesmo ID com título/artista diferentes entre snapshots = provável renomeação/edição. Atualizar metadados e conservar o vínculo pelo ID; mostrar registro de alteração para revisão, sobretudo se mudou para um título que já existe.
- ID ausente em snapshot posterior = removido, arquivado ou catálogo incompleto. Não apagar vínculo imediatamente: marcar obsoleto, distinguir arquivadas quando disponíveis, e confirmar após snapshot completo bem-sucedido. Nunca interpretar upload interrompido como exclusão em massa.
- Guardar `lastSeenAt`, timestamp da sincronização, versão da instalação e checksum/contagem do snapshot. O cliente deve apresentar “última leitura” e deixar atualizar antes de aplicar.
- Desconexão: conservar último snapshot e vínculos confirmados localmente; permitir preparar/revisar, mas declarar que a confirmação de existência do ID é baseada em cache. Exigir conexão ao Holyrics para aplicar. Sem rede com Videira, usar setlist já baixado/cacheado somente se estiver publicado e mostrar quando foi sincronizado.

## 5. Fonte da verdade e fluxo offline

- **Videira Music** é a fonte da verdade para músicas, cifras, setlist publicado, status e vínculos duráveis `SongExternalLink`. O catálogo Holyrics é uma fotografia externa de referência, não a autoridade sobre a música/cifra Videira.
- **Holyrics local** é autoridade para o ID e estado corrente da biblioteca daquela instalação e para a playlist atualmente aberta. O app não escreve no SQLite nem em `.hly`; usa API local autorizada.
- **Desktop** mantém cache operacional de catálogo, vínculos baixados, setlists escolhidos e último relatório. Não vira um banco paralelo autoritativo. A escrita de vínculos deve sincronizar ao servidor quando online e lidar com conflito, revisão ou fila pendente.
- Offline Videira: permitir consulta de cache e preparar dry-run; aplicação pode seguir apenas com setlist publicado previamente baixado e catálogo local válido. Registrar relatório pendente e reenviar quando online. Deixar explícito que o setlist pode ter sido alterado desde o cache.
- Offline Holyrics/API local: nenhuma aplicação; orientar a abrir o Holyrics e verificar API/token. Não marcar “publicado” até reler a playlist e confirmar sequência de IDs.
- O vínculo salvo no Videira pode ser reaproveitado por outra instalação somente como **sugestão** até validar o ID naquele catálogo.

## 6. UX do app desktop

### Primeira execução e pareamento

1. Explicar o pré-requisito: Holyrics aberto, API Server local ativada e token local com permissões de leitura de músicas e edição da playlist. A API sem Plan permite alterar somente a playlist atualmente selecionada; o usuário seleciona o culto/playlist de destino no Holyrics.
2. Conectar a `127.0.0.1:8091` (porta configurável), validar `GetVersion`, `GetTokenInfo` e permissões. A API local é HTTP e escuta em todas as interfaces segundo o discovery; o app deve chamar loopback e orientar permissões mínimas. Não pedir caminho do SQLite.
3. Parear com Videira via token de integração da organização, armazenado no Credential Manager/Keychain, com teste, nome da organização e opção de revogar/substituir. Não misturar token Holyrics com token Videira.
4. Criar/identificar a instalação. Mostrar nome do computador e permitir renomear o dispositivo; explicar se o vínculo será compartilhado com a organização ou específico desta instalação.
5. Importar catálogo, mostrar contagem, data, músicas arquivadas/duplicatas e progresso. Em upload segmentado, finalizar somente após confirmação de todos os lotes.

### Vínculo e aplicação

- Tela “Resolver músicas” filtrável por pendentes/ambíguas/vinculadas/ausentes. Colunas Videira (título, artista) e Holyrics (título, artista, ID), origem e estado; ações explícitas para vincular, trocar, remover e ignorar.
- Auto-sugestão pode pré-ordenar por ID previamente conhecido, título/artista normalizados e similaridade, mostrando confiança e razão. Confirmações manuais têm precedência.
- Antes de aplicar: mostrar setlist e data, nome da playlist/culto local obtido via API, quantidade de faixas que serão incluídas/omitidas e se a playlist atual será substituída. Resumo de itens sem vínculo, obsoletos, duplicados e IDs ausentes. Dry-run sempre acessível e preview por padrão no primeiro uso.
- Com ambiguidades ou ausências, bloquear publicação integral por padrão. Se produto optar por parcial, exigir confirmação explícita e listar o que será omitido.
- Após aplicar: reler a playlist e comparar IDs/ordem; enviar `sync-report` ao Videira. Exibir sucesso, parcial ou falha, o que mudou e próximos passos. Manter cópia da playlist anterior em memória/cache para tentativa de restauração, sem prometer atomicidade.

## 7. Riscos e alternativas

### Riscos principais

- IDs locais tratados como universais causam publicação da música errada ou ausente em outro PC.
- Snapshot organizacional substituído por outra instalação ou upload parcial deixa associações inconsistentes.
- Matching fuzzy automático e títulos sem artista tornam erro silencioso provável.
- Renomeações, arquivamentos e exclusões são difíceis de separar sem snapshots completos e estado explícito.
- A playlist editada é a atualmente selecionada; sem Plan, o app não seleciona culto nem edita diretamente a agenda. Confirmar destino antes de substituir.
- API local usa HTTP sem TLS; token Holyrics é sensível, e o servidor escuta todas as interfaces. Usar loopback, armazenamento seguro e permissões mínimas.
- Sequência limpar/adicionar não é transação atômica. Uma falha pode deixar playlist vazia/parcial; verificar e reportar, com restauração best-effort.
- A API de Holyrics e a sequência ainda têm itens marcados não testados em instalação ao vivo e macOS. Fazer spike antes de prometer compatibilidade total.
- Vínculos compartilhados no servidor são dados operacionais da organização; conflitos e alterações acidentais precisam de auditoria/recuperação.

### Alternativa: não manter tabela remota de catálogo

Guardar vínculos no desktop, indexados por instalação, e enviar somente o catálogo/ID necessário na aplicação. **Vantagens:** escopo local correto, menos alterações no servidor, funcionamento offline e nenhum catálogo de cada igreja armazenado remotamente. **Custos:** não compartilha decisões entre usuários/PCs, migração e backup ficam sob responsabilidade do cliente, links não aparecem no Videira web e o servidor não consegue montar o `externalId` do setlist sem receber os vínculos.

Uma variação é guardar os vínculos localmente e incluí-los no pedido de aplicação do setlist; o backend valida organização e autorização, mas não persiste esses links. Isso evita que o setlist exportado seja específico de uma máquina, porém a ponte passa a resolver todos os itens a cada execução. É adequada se o app desktop for o único consumidor Holyrics.

### Alternativa: só sugestão local e vínculo remoto confirmado

Manter a tabela remota atual, adicionar identidade de instalação e versionamento de snapshot; persistir vínculo confirmado no servidor com escopo de instalação. Essa opção preserva compartilhamento e gera `externalId` diretamente no endpoint atual de setlist. É a recomendada se usuários precisam compartilhar mapeamentos ou aplicar pelo script/bridge.

## 8. Decisões que o usuário precisa tomar

1. **Quantos Holyrics independentes existem por organização?** Se mais de um ou incerto, escolher escopo por instalação (recomendado). Se existe um catálogo autoritativo compartilhado, organização pode bastar.
2. **Onde os vínculos devem morar e ser compartilhados?** Vínculo remoto por instalação no Videira (recomendado para compartilhar e preencher `externalId` no setlist) ou somente local no desktop (mais simples no servidor, isolado por máquina).
3. **Qual política de publicação para músicas não resolvidas?** Bloquear até tudo estar vinculado (recomendado para segurança) ou permitir aplicação parcial após confirmação explícita; em ambos os casos, nunca escolher fuzzy automaticamente.

## Fontes internas consultadas

- `discovery/videira-music.md`: modelos, APIs de catálogo/setlist/relatórios, bridge e riscos.
- `discovery/holyrics-re.md`: armazenamento, IDs locais, requisitos sem Plan, segurança e recomendação de API oficial.
- `discovery/holyrics-api-map.md`: ações de leitura e playlist, payloads, limites, permissões e pendências de teste.
