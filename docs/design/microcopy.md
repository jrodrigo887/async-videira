# Estados e microcopy (pt-BR)

> Regras do DS Videira (seção 8): frase com inicial maiúscula, sem ponto final em botão/label/menu; o botão diz o que acontece; o mesmo verbo atravessa o fluxo; nomear pelo que a pessoa reconhece. Aqui somam-se: **nunca** "API", "ID", "endpoint", "payload", "externalId" na superfície principal — só em "Detalhes técnicos" (recolhido).
>
> Notação: `[Botão primário]`, `[[Botão secundário]]`, `{variável}`.

## 0. Vocabulário fixo

| Conceito técnico | O que a interface diz | Nunca dizer |
|---|---|---|
| playlist selecionada / `GetCurrentSchedule` | **culto selecionado no Holyrics** / **destino** | "schedule", "playlist via API" |
| `SongExternalLink` | **vínculo** / **vincular** | "associação", "mapeamento", "externalId" |
| `resolved` | **Pronta** | "resolvida" |
| sugestão exata única (core: `absent` + `suggestions`) | **Confirmar vínculo** | "match" |
| `ambiguous` | **Escolher versão** | "ambígua" |
| `absent` | **Não está no Holyrics** | "ausente", "not found" |
| `repeated` | **Repetida — entra 1 vez** | "duplicada" (soa como erro do líder) |
| releitura confirmada | **conferido no Holyrics** | "verificado por readback" |
| restauração best-effort | **voltar a playlist ao que era** | "rollback" |
| `sync-report` | **aviso ao Videira** / **relatório** | "report" |
| fingerprint da biblioteca mudou | **a biblioteca de músicas do Holyrics mudou** | "fingerprint" |
| Holyrics Plan | **Holyrics Plan** (nome do produto, sem tradução) | — |

## 1. Primeira execução e pareamento (T0)

### 1.0 Boas-vindas
- Eyebrow: `Primeira configuração`
- H1: **Vamos ligar o Videira Music ao Holyrics**
- Apoio: "Leva uns 5 minutos e só precisa ser feito uma vez neste computador. Você vai precisar do Holyrics aberto e de alguém com acesso de administrador no Videira Music."
- Passos visíveis: `1 Holyrics` · `2 Videira Music` · `3 Pronto`
- `[Começar]`

### 1.1 Holyrics
- H1: **Conectar ao Holyrics**
- Instruções (lista numerada, sempre visível, não em tooltip):
  1. No Holyrics, abra **Arquivo → Configurações → API Server**.
  2. Marque **Ativar (local)**. Deixe a porta **8091**, a não ser que alguém tenha mudado.
  3. Clique em **Gerenciar permissões → Criar token** e dê o nome **async-videira**.
  4. Na coluna **Local**, marque só as permissões da lista abaixo. Deixe **Web** desmarcado.
  5. Copie o token e cole aqui.
- Bloco recolhível "Permissões necessárias (11)": `GetVersion · GetTokenInfo · GetAPIServerInfo · GetHolyricsPlanInfo · SearchLyrics · GetSongs · GetLyrics · GetLyricsPlaylist · AddLyricsToPlaylist · RemoveFromLyricsPlaylist · GetCurrentSchedule` com `[[Copiar lista]]`. Nota: "Estes nomes aparecem iguais no Holyrics. Não marque outras: o app não precisa."
- Campo: label **Token do Holyrics** · ajuda "16 letras e números. Fica guardado no cofre do Windows, nunca em arquivo." · tipo senha com `[[Mostrar]]`
- Campo avançado (recolhido): **Porta** (padrão 8091)
- `[Testar conexão]` → `Testando…`
- Callout informativo (sempre visível neste passo) — **API aberta na rede**:
  > **O Holyrics aceita conexões de outros aparelhos da rede.** O servidor do Holyrics fica disponível para a rede da igreja, sem criptografia. Este app só conversa com o próprio computador, mas outros aparelhos na mesma rede Wi-Fi poderiam usar o token. Use uma rede confiável (não a rede de visitantes) e não compartilhe o token. `Saiba como bloquear no firewall`

Resultados do teste:

| Situação | Texto | Ação |
|---|---|---|
| OK | ✓ **Conectado ao Holyrics {versão}.** {n} músicas na biblioteca. Todas as permissões estão certas. | `[Continuar]` |
| Permissões faltando | ⚠ **Faltam {n} permissões.** Abrimos um pedido no Holyrics: clique em **Permitir** na janela que apareceu lá. Faltam: `GetSongs`, `GetCurrentSchedule`. | `[Verificar de novo]` |
| Permissões a mais | ℹ Este token tem permissões que o app não usa ({lista}). Funciona, mas é mais seguro desmarcá-las no Holyrics. | `[Continuar]` (não bloqueia) |
| Holyrics fechado / API desligada | ✕ **Não encontramos o Holyrics neste computador.** Confira se ele está aberto e se **Ativar (local)** está marcado em Arquivo → Configurações → API Server. Depois de ativar, espere uns 15 segundos. | `[Testar de novo]` |
| Token inválido | ✕ **O Holyrics não reconheceu este token.** Copie de novo em Gerenciar permissões — sem espaços antes ou depois. | campo com erro |
| Formato errado | Erro de campo: "O token tem 16 letras e números. Confira se copiou inteiro." | — |

### 1.2 Videira Music
- H1: **Conectar ao Videira Music**
- Instruções:
  1. Peça a quem administra a igreja no Videira Music para abrir **videiramusic.org → Integrações → Holyrics**.
  2. Em **Tokens da igreja**, clicar em **Gerar token**. O valor aparece uma vez só.
  3. Cole aqui.
- Nota: "Esse token só permite ler os setlists publicados da igreja e enviar o resultado. Não dá acesso a membros, cifras nem configurações."
- Campo: **Token do Videira Music** (senha, `[[Mostrar]]`)
- `[Testar conexão]`
- OK: ✓ **Conectado à igreja {nome da organização}.** Próximo culto publicado: {título}, {dia por extenso}.
- Erro token: ✕ **O Videira Music recusou este token.** Ele pode ter sido revogado. Peça um novo a quem administra a igreja.
- Sem internet: ✕ **Sem conexão com a internet.** Você pode terminar a configuração depois; o Holyrics já está pronto. `[[Pular por agora]]`

### 1.3 Pronto
- H1: **Tudo pronto**
- Resumo: ✓ Holyrics {versão} · {n} músicas · ✓ Igreja {nome}
- Pergunta (radio, padrão marcado): **Quando preparar o culto?** ○ Só quando eu abrir o app · ● Lembrar no domingo às {08:00} (mostra notificação; não publica sozinho)
- `[Preparar o próximo culto]`

## 2. Tela principal "Culto" (T1)

- Eyebrow: `Próximo culto`
- H1: **{título do setlist}** — ex.: "Culto de domingo — manhã"
- Apoio: "{domingo, 1 de novembro · 10:00} · publicado por {Marta}" 
- Seletor (só se houver mais de um setlist no dia): label **Setlist do dia** · "{n} setlists publicados para domingo"

### Cartão Destino

Sem Holyrics Plan, o app só enxerga e edita a playlist **selecionada** no Holyrics. Ela chega de dois jeitos (`destination.kind`, ver view-models §3):

| | **(a) Culto da agenda** (`kind: "schedule"`) | **(b) Playlist temporária** (`kind: "temporary"`) — caso mais comum nos testes reais |
|---|---|---|
| Nome grande | "{Culto de Domingo 01/11}" | **Playlist temporária** |
| Meta | "Culto da agenda · {dom., 01/11, 10:00} · {7} músicas na playlist agora" | "Aparece como “Temporário” no Holyrics · {7} músicas na playlist agora" (**sem data**: o Holyrics devolve a hora atual, que não é data de culto) |
| Checagem | Compara a data com a do setlist (tabela abaixo) | Chip neutro ⓘ **Sem data para conferir** + "É a playlist aberta no Holyrics agora. Ela não tem data de culto, então o app não consegue conferir se é a certa: você confirma antes de substituir." **Nunca** mostrar "Mesmo dia do setlist". |
| Ajuda fixa | "O app só consegue mudar o que está **selecionado** no Holyrics. Para trocar, selecione o culto lá e clique em Verificar de novo." (só quando a data bate) | (a explicação da checagem já cobre) |
| `[[Verificar de novo]]` | Relê o destino | Relê; se continuar temporária: "Continua selecionada a playlist temporária. Se o culto existe na agenda do Holyrics, selecione-o lá; senão, siga com a temporária e confirme antes de substituir." |
| Reconhecimento no diálogo | Só se a data for diferente | **Sempre** ("Estou no culto certo") |

| Estado do culto da agenda | Tom | Texto |
|---|---|---|
| Data bate | ok | ✓ Mesmo dia do setlist |
| Data diferente | warn | ⚠ **O culto selecionado é de {25/10}, o setlist é de {01/11}.** Confira se é o culto certo. Se não for, selecione o culto certo no Holyrics. |
| Playlist vazia (qualquer tipo) | — | meta "playlist vazia agora" |
| Plan ausente (normal) | info (só em Ajustes/ajuda) | "Sem o Holyrics Plan, o Holyrics só deixa mudar o que está selecionado. Por isso você escolhe o culto lá, não aqui." |

Hint da barra de ação: agenda → "A playlist de “{Culto de Domingo 01/11}” será substituída. Você confirma antes."; temporária → "A playlist temporária do Holyrics será substituída. Você confirma antes."

### Resumo
- "**{3} de {4} músicas prontas**" + chips por estado com contagem: `✓ 3 Prontas` `● 1 Confirmar vínculo`.

### Resumo fixo e agrupamento
- O bloco "Músicas do setlist" + "{2} de {7} músicas prontas" + chips fica **fixo no topo** da área de rolagem; a lista passa por baixo. A área de conteúdo tem respiro inferior para a última linha nunca ficar atrás do rodapé.
- Chips no plural: `✓ 4 prontas` `● 1 para confirmar vínculo` `◆ 1 para escolher versão` `✕ 1 fora do Holyrics` `↻ 1 repetidas`.
- Com **mais de 5 músicas e alguma pendência**, a lista agrupa por estado (padrão) com alternância `Por estado` / `Na ordem do setlist`:
  - **PRECISAM DE VOCÊ ({3})** — primeiro, sempre aberto
  - **REPETIDAS ({n})** — se houver
  - **PRONTAS ({4})** — recolhido ("— mostrar" / "— recolher")
- A posição original (número à esquerda) continua visível em todos os grupos.

### Linhas de música

| Estado | Chip | Linha de apoio | Ação na linha |
|---|---|---|---|
| Pronta | ✓ **Pronta** (success) | "{artista}" | — |
| Confirmar vínculo | ● **Confirmar vínculo** (info) | "Achamos “{título}” de {artista} no Holyrics com o mesmo nome." | `[[Revisar]]` |
| Escolher versão | ◆ **Escolher versão** (warning) | "Há {2} músicas com este nome no Holyrics." | `[[Escolher]]` |
| Parecida (aproximada) | ◆ **Conferir parecida** (warning) | "Achamos “{Aquieta Minh'alma}”: nome parecido, mas não igual." | `[[Conferir]]` |
| Não está no Holyrics | ✕ **Não está no Holyrics** (danger) | "Precisa ser cadastrada no Holyrics antes." | `[[Como resolver]]` |
| Repetida | ↻ **Repetida — entra 1 vez** (neutral) | "Já está na posição {1}. O Holyrics não aceita a mesma música duas vezes na playlist." | — |
| Vínculo antigo (reconciliação) | ● **Confirmar vínculo** (info) | "A música vinculada não existe mais nesta biblioteca. Achamos uma igual." | `[[Revisar]]` |

### Ação primária (barra fixa)

| Situação | Botão | Texto ao lado |
|---|---|---|
| Carregando | (desabilitado) `Preparando…` | "Lendo setlist e biblioteca do Holyrics…" |
| Há pendências resolvíveis | `[Revisar pendências]` | "{2} músicas precisam de você antes de publicar." |
| Tudo pronto | `[Publicar no Holyrics]` | "A playlist de {destino} será substituída. Você confirma antes." |
| Pendências sem solução agora | `[Publicar no Holyrics]` | "{1} música vai ficar de fora. Você confirma antes." |
| Já igual | `[Conferir de novo]` | ✓ "A playlist do Holyrics já está igual ao setlist." |
| Nenhuma música pronta | (desabilitado) `Publicar no Holyrics` | "Nenhuma música do setlist está no Holyrics ainda." |

### Vazios
- Nenhum setlist publicado: H2 **Nenhum culto publicado ainda** · "Quando o setlist de domingo for publicado no Videira Music, ele aparece aqui." · `[[Procurar de novo]]`
- Setlist sem músicas: **Este setlist não tem músicas.** · "Peça à liderança para conferir no Videira Music."

## 3. Revisar músicas (T2)

- Eyebrow: `Culto de domingo` · H1: **Revisar músicas** · Apoio: "Confirme uma vez; nas próximas semanas estas músicas já entram sozinhas."

### 3.1 Lote — "Mesmo nome e mesmo artista"
- Entram **somente** candidatos exatos únicos (título + artista normalizados iguais e uma única opção no Holyrics). Ambíguos e aproximados **nunca** entram; vão para 3.2.
- H2: **Mesmo nome e mesmo artista ({4})**
- Apoio: "Só entram aqui músicas com uma única opção igual no Holyrics. Confira cada par e desmarque o que não for a mesma música."
- Barra: "**{3} selecionados** de {4}" (anunciado ao mudar) · `Marcar todos` · `Desmarcar todos`
- Linha (checkbox, **marcada por padrão**, desmarcável): **Videira:** É Ele — DROPS → **Holyrics:** E Ele — DROPS
- Botão: `[Confirmar {3} vínculos]` / `[Confirmar 1 vínculo]` → `Confirmando…` → ✓ **"{3} vínculos confirmados."** "Nas próximas semanas estas músicas entram sozinhas." `[[Desfazer]]` (fica até a próxima ação; depois, desfazer pelo histórico do vínculo)
- Ajuda ao lado do botão: "O vínculo fica salvo no Videira Music. Dá para desfazer."
- 0 marcadas: botão desabilitado, "Marque ao menos uma música."
- **Vazio** (sem exatos únicos, mas com decisões individuais): H2 **Nenhuma música para confirmar em lote** · "Só entram no lote músicas com nome e artista iguais e uma única opção no Holyrics. As músicas abaixo precisam de uma decisão por vez."
- Seção individual: H2 **Decida uma por vez ({2})** · "Mais de uma opção com o mesmo nome, ou nome só parecido. Estas nunca entram no lote."

### 3.2 Escolher versão (T2a, diálogo)
Variante **aproximada**: título **“{Aquieta Minh’alma}” é esta música?** · "No Holyrics achamos uma com nome parecido, mas não igual. Confira antes de vincular:" · uma opção + "Nenhuma destas" · botão `[Usar esta música]`. Com "Nenhuma destas" marcada, o botão vira `[Marcar como não encontrada]`.

- Título: **Qual “{Santo}” é a do setlist?**
- Apoio: "No Videira: **{Santo}** — {Ministério X}. No Holyrics há {2} com este nome:"
- Opções (radio, **nenhuma marcada** por padrão): "{Santo} — {Ministério X} · cadastrada em {12/03/2025}" / "{Santo} — {Ministério X} (Ao vivo) · …" / "Nenhuma destas"
- `[[Cancelar]]` `[Usar esta versão]` (desabilitado até escolher)
- "Nenhuma destas" → linha vira "Não está no Holyrics".

### 3.3 Não está no Holyrics (T2b, diálogo)
- Título: **“{título}” não está no Holyrics**
- Apoio: "O app não cria músicas no Holyrics. Cadastre por um destes caminhos e depois leia a biblioteca de novo:"
  1. **Abrir o editor do Holyrics já com o nome** — `[[Abrir no Holyrics]]` ("Você cola a letra e clica em Salvar lá.")
  2. **Importar um arquivo** (TXT, OpenLP ou OpenSong) se você tem a letra.
  3. **Já está no Holyrics com outro nome?** `[[Procurar na biblioteca]]` (busca manual; resultado vira escolha individual)
- `[[Fechar]]` `[Ler a biblioteca de novo]` → `Lendo…` → "Encontrada! Confirme o vínculo." / "Ainda não encontramos “{título}”."

## 4. Confirmar substituição (T3, diálogo)

- Título: agenda → **Substituir a playlist de “{Culto de Domingo 01/11}”?**; temporária → **Substituir a playlist temporária do Holyrics?**
- Colunas: **Hoje no Holyrics ({7})** (itens que saem riscados com rótulo "sai") × **Vai ficar ({3})** (lista numerada).
  - **Sem rolagem escondida.** Até 10 itens: todas as linhas aparecem. Acima de 10: as 8 primeiras + botão de largura total **"+ {7} músicas — mostrar todas"** (`aria-expanded`, `aria-controls`, alcançável por Tab) → "Mostrar menos". Vale para as duas colunas.
  - **Playlist vazia (0):** a coluna mostra "Vazia — nenhuma música vai sair." (sem "sai") e o aviso de risco vira info: **A playlist está vazia agora** · "Nada vai sair. As {4} músicas do setlist entram nela."
- Linha de risco (warning, com itens): "As {7} músicas de hoje saem da playlist. Elas continuam na biblioteca do Holyrics; só saem desta playlist. Guardamos uma cópia para voltar se der errado."
- Se parcial: caixa **desmarcada** "Publicar mesmo sem: {Santo}" (lista). Sem marcar: botão desabilitado + "Marque para publicar sem essas músicas."
- Se **temporária**: caixa **desmarcada** **Estou no culto certo** · "A playlist temporária não tem data, então o app não consegue conferir. Olhe no Holyrics se é a playlist que vai para o telão agora." Sem marcar: "Marque “Estou no culto certo” para continuar."
- Se agenda com **data diferente**: caixa **desmarcada** "Confirmo que {Culto de Domingo 25/10} é o destino certo" · "A data do culto selecionado é diferente da data do setlist."
- Se Videira offline: info "Sem internet: usando o setlist baixado {sábado 21:14}. O aviso ao Videira será enviado depois."
- `[[Cancelar]]` `[Substituir playlist]` (`ds-button-danger` com ícone de aviso, regra 7 do DS: o botão que executa o dano usa `danger`; nunca um "OK" verde). Foco inicial em `Cancelar`.

## 5. Publicando (T4)

- H1: **Publicando no Holyrics…**
- Etapas (cada uma: pendente ○ / atual ◌ animado / feita ✓ / falhou ✕):
  1. Guardando uma cópia da playlist atual
  2. Tirando as músicas antigas
  3. Colocando as {3} músicas na ordem
  4. Conferindo no Holyrics
  5. Avisando o Videira Music
- Rodapé: "Não feche o Holyrics agora. Leva uns 5 segundos."
- Se demorar > 10 s na etapa 4: "O Holyrics está demorando para responder. Continuamos conferindo…"

## 6. Resultado (T5)

| Resultado | Tom | H1 | Corpo | Ações |
|---|---|---|---|---|
| Conferido | ok | **Publicado e conferido** | "A playlist de {destino} tem as {3} músicas na ordem do setlist. Conferido às {09:41}." + lista com ✓ | `[Pronto]` `[[Restaurar playlist anterior]]` |
| Conferido com repetida | ok | **Publicado e conferido** | "+ “A Boa Parte” aparece 1 vez (estava repetida no setlist)." | idem |
| Parcial (pendências) | warn | **Publicado sem {1} música** | "Ficou de fora: {Santo} (não está no Holyrics). As outras {3} estão na ordem e foram conferidas." | `[Pronto]` `[[Resolver “Santo”]]` |
| Falhou, restaurado | danger | **Não deu certo — a playlist voltou ao que era** | "{O Holyrics parou de responder enquanto colocávamos as músicas.} Conferimos: as {7} músicas de antes estão de volta." | `[Tentar de novo]` `[[Detalhes técnicos]]` |
| Falhou, sem restaurar | danger | **Não deu certo e a playlist ficou incompleta** | "Não conseguimos voltar a playlist de {destino}. Refaça no Holyrics com a lista abaixo, ou tente publicar de novo." + lista original | `[Tentar de novo]` `[[Copiar lista]]` |
| Relatório na fila | info (linha extra) | — | "O Videira Music será avisado quando a internet voltar." | — |

Restaurar (desfazer):
- Diálogo: **Voltar a playlist ao que era antes?** · "As {3} músicas do setlist saem e as {7} de antes voltam." · `[[Cancelar]]` `[Restaurar playlist]` → `Restaurando…` → "Playlist restaurada e conferida."
- Indisponível: "Não dá mais para restaurar: o app foi fechado ou a playlist mudou no Holyrics depois."

## 7. Erros comuns (sempre na região, com próximo passo)

| Código | Título | Texto | Ação |
|---|---|---|---|
| `HOLYRICS_UNREACHABLE` | **O Holyrics não está respondendo** | "Abra o Holyrics neste computador. Se ele já está aberto, confira Arquivo → Configurações → API Server → Ativar (local)." | `[Tentar de novo]` |
| `HOLYRICS_TOKEN_INVALID` | **O Holyrics não aceita mais o token** | "Ele pode ter sido apagado em Gerenciar permissões. Crie um novo e cole em Ajustes." | `[Trocar token]` |
| `HOLYRICS_PERMISSION_MISSING` | **Falta permissão no Holyrics** | "Abrimos um pedido no Holyrics: clique em Permitir lá. Falta: {GetCurrentSchedule}." | `[Verificar de novo]` |
| `VIDEIRA_OFFLINE` | **Sem conexão com o Videira Music** | Com cache: "Usando o setlist baixado {sábado 21:14}. Se ele mudou depois, a mudança não aparece aqui." Sem cache: "Conecte o computador à internet para baixar o setlist." | `[[Tentar de novo]]` |
| `VIDEIRA_TOKEN_INVALID` | **O Videira Music recusou o token** | "Ele pode ter sido revogado. Peça um novo a quem administra a igreja e cole em Ajustes." | `[Trocar token]` |
| `DESTINATION_SUSPECT` | **Confira o culto selecionado** | ver cartão Destino | `[[Verificar de novo]]` |
| `DESTINATION_CHANGED` | **O culto selecionado mudou** | "Entre a preparação e a publicação, outro culto foi selecionado no Holyrics. Confira antes de continuar." | `[Revisar de novo]` |
| `SETLIST_CHANGED` | **O setlist mudou no Videira** | "{Marta} alterou o setlist {há 3 min}. Atualizamos a lista; confira." | `[Revisar de novo]` |
| `PLAN_REQUIRED` (info) | **Isso precisa do Holyrics Plan** | "Sem o Plan, o app só muda o culto que está selecionado no Holyrics. Selecione o culto lá." | `[[Entendi]]` |
| `LIBRARY_PARTIAL` | **Não conseguimos ler a biblioteca inteira** | "Nada foi alterado. Tente de novo em alguns segundos." | `[Tentar de novo]` |

"Detalhes técnicos" (recolhido): código, horário, versão do Holyrics, mensagem bruta, `[[Copiar detalhes]]` — **nunca** contém token.

## 8. Reconciliação após troca de PC (T6)

- Banner em T1 (info): **A biblioteca de músicas do Holyrics mudou** · "Parece que o Holyrics foi reinstalado ou as músicas foram importadas de novo. {2} músicas deste culto precisam ser vinculadas outra vez." · `[[Revisar vínculos]]`
- Se não afeta o culto: "… {14} vínculos antigos precisam de revisão. Isso não afeta o culto de domingo." · `[[Revisar depois]]`
- T6 H1: **Atualizar vínculos** · Apoio: "Os vínculos antigos ficam guardados no histórico. Nada é apagado."
- Resumo: `✓ {12} continuam iguais` `● {14} acharam par igual` `◆ {2} têm mais de uma opção` `✕ {3} sem par`
- Lote: H2 **{14} músicas com par igual na nova biblioteca** · linhas "Mil Graus — Renascer Praise · {antigo 1792…267} → {novo 1801…004}" (IDs em mono, apoio) · `[Confirmar {14} trocas]`
- Individuais: como 3.2.
- Sem par: "Ficam como vínculo antigo. Quando a música aparecer no Holyrics, sugerimos de novo."
- Sucesso: "{14} vínculos atualizados. Os antigos ficaram no histórico."

## 9. Histórico e relatórios pendentes (T7)

- H1: **Histórico**
- Pendentes (callout info, topo): **{2} avisos ao Videira ainda não foram enviados** · "Ficam guardados neste computador até a internet voltar." · `[Enviar agora]` → `Enviando…` → "Enviados."
- Item: "{dom 01/11 09:41} · Culto de domingo — manhã → Culto de Domingo 01/11 · **Publicado e conferido** · 3 músicas" (chip de status) · `[[Ver detalhes]]`
- Vazio: **Nenhuma publicação ainda.** · "Depois de publicar um culto, ele aparece aqui."

## 10. Ajustes (T8)

Seções (cada uma com seu `[Salvar]` só quando houver mudança):
- **Holyrics**: "Conectado · Holyrics 2.30.0 · porta 8091 · token ••••••••••••a1B9" · `[[Testar]]` `[[Trocar token]]` `[[Remover token]]` (remover pede confirmação: **Remover o token do Holyrics deste computador?** "O app para de funcionar até você colar um novo." `[[Cancelar]]` `[Remover token]` danger). Callout "API aberta na rede" repetido.
- **Videira Music**: "Igreja Videira Centro · token ••••7Qx2" · `[[Testar]]` `[[Trocar token]]` `[[Remover token]]`
- **Lembrete de domingo**: toggle "Lembrar de preparar o culto" · dia (Domingo) · horário (08:00) · nota "O app nunca publica sozinho; ele só prepara e avisa."
- **Aparência**: Tema (Automático / Claro / Escuro) · Tamanho do texto (Normal / Grande / Maior)
- **Bandeja**: "Iniciar com o Windows" · "Ao fechar a janela, continuar na bandeja"
- **Dados deste computador**: `[[Abrir pasta de dados]]` · `[[Refazer cache]]` ("Baixa de novo setlist e biblioteca. Vínculos ficam no Videira e não são afetados.")
- **Sobre**: versão, link de ajuda.

## Bandeja e notificações

Menu da bandeja (clique direito):
- **Culto de domingo — 3 de 4 prontas** (desabilitado, informativo)
- Preparar culto
- Abrir async-videira
- ─
- Holyrics: conectado / ⚠ não está respondendo
- {2} avisos pendentes (se houver)
- ─
- Sair

Ícone: normal / com ponto de aviso (pendência ou erro). Tooltip: "async-videira — culto pronto para publicar" / "… 1 música precisa de você".

Notificações (só quando há o que fazer; clique abre T1):
| Gatilho | Título | Corpo |
|---|---|---|
| Lembrete de domingo, tudo pronto | Culto de domingo pronto | 4 músicas prontas para publicar no Holyrics. |
| Lembrete, com pendências | Culto de domingo: 1 música precisa de você | “Santo” não está no Holyrics. |
| Setlist mudou depois de publicar | O setlist de domingo mudou | {Marta} alterou o setlist. Publique de novo para atualizar o Holyrics. |
| Relatórios enviados | — | (não notifica; aparece no histórico) |
| Erro em segundo plano | O Holyrics não está respondendo | Abra o Holyrics para preparar o culto. |
