# UX brief — async-videira (desktop)

> **Status:** proposta de design para validação com a aba de arquitetura e com um operador real.
> **Entregáveis vizinhos:** [microcopy e estados](microcopy.md), [acessibilidade, tema e janela](accessibility.md), [contrato de dados das telas](view-models.md), [protótipo navegável](../../src/ui/prototype/index.html).
> **Base visual:** Design System do Videira Music (`videira-music/docs/design-system.md`, `styles/globals.css`, `packages/contract/src/kernel/design/brand.ts`).

## 1. O problema em uma frase

Todo domingo, minutos antes do culto, alguém da mídia precisa que a playlist de letras do Holyrics fique **exatamente** igual ao setlist publicado no Videira Music, sem apagar por engano o que já estava lá e sem ter de entender IDs, tokens ou APIs.

## 2. Personas

| | **Lucas — operador de mídia** (primária) | **Marta — líder de louvor / admin Videira** (secundária) | **Técnico voluntário** (instalação) |
|---|---|---|---|
| Quem | Voluntário, 17–40 anos, opera Holyrics e projetor | Monta e publica o setlist no Videira durante a semana | Quem instala o app e configura o Holyrics uma vez |
| Quando usa | 1× por semana, domingo, 15–40 min antes do culto, às vezes com o culto já começando | Indiretamente: vê o relatório no Videira | Na instalação e na troca de PC |
| Contexto | Sala de som, outras tarefas em paralelo (som, câmera, transmissão), interrupções, pouca luz | Celular ou notebook, em casa | Calmo, com tempo, mas não é dev |
| Sabe | Usar o Holyrics: selecionar culto, projetar | O repertório e as versões das músicas | Instalar programa, copiar token |
| Não sabe / não quer | O que é token, ID, API, playlist "selecionada via API" | Detalhes do Holyrics | Ler documentação longa |
| Medo | Apagar a playlist do culto e ficar sem letra no telão | Que a banda toque uma música e o telão mostre outra | Deixar a API do Holyrics aberta na rede |

## 3. Jobs-to-be-done

1. **Quando** chego para o culto de domingo, **quero** colocar no Holyrics as músicas do setlist publicado, na ordem certa, **para** não montar a playlist à mão e não errar.
2. **Quando** uma música do setlist não aparece no Holyrics, **quero** saber exatamente qual e o que fazer, **para** resolver antes de começar ou seguir sem ela conscientemente.
3. **Quando** o app vai mexer na playlist, **quero** ver o que vai sair e o que vai entrar, **para** ter certeza de que estou no culto certo.
4. **Quando** algo dá errado no meio, **quero** que a playlist volte a ser o que era, **para** não ficar pior do que antes.
5. **Quando** a igreja troca de computador, **quero** refazer os vínculos em poucos cliques, **para** não ter de vincular música por música de novo.
6. **(Marta)** **Quando** publico o setlist, **quero** saber se ele chegou ao Holyrics, **para** não precisar ligar para a mídia.

## 4. Princípios (e como cada um vira regra de tela)

| Princípio | Regra concreta |
|---|---|
| **Clareza sob pressão** | A tela principal responde em 3 s: *qual culto, qual destino, está tudo pronto?* Resumo numérico no topo ("3 de 3 músicas prontas"). Texto de 16 px no mínimo; nada de tabela densa. |
| **Uma ação primária por tela** | Um único `ds-button` por região (regra 7 do DS). Ele muda de rótulo conforme o estado: `Revisar pendências` → `Publicar no Holyrics` → `Substituir playlist` (no diálogo). |
| **Nunca esconder o risco de apagar a playlist** | Diálogo de confirmação obrigatório com "Hoje no Holyrics" × "Vai ficar", contagem dos itens que saem e nome do culto de destino no título. O botão diz o dano: `Substituir playlist`. |
| **Linguagem humana, sem jargão de API** | "Vincular" em vez de "associar externalId"; "Não está no Holyrics" em vez de "absent"; "Conferido no Holyrics" em vez de "verified by readback". Os códigos técnicos aparecem só em "Detalhes técnicos", recolhido. |
| **Prevenir erro antes de remediar** | Checagem do destino (tipo `temporary`, data diferente do setlist, playlist vazia vs. cheia). Publicação parcial desligada por padrão. Matches aproximados nunca entram em lote. |
| **Feedback claro e honesto** | "Publicado e conferido" só após releitura igual ao esperado. Progresso por etapa, com a etapa atual nomeada. Erros na região, persistentes, com o próximo passo. |
| **Defaults seguros** | Lote só para correspondência exata única, e mesmo assim revisável (pode desmarcar). Destino suspeito exige reconhecimento explícito. Relatório nunca é perdido (fila). |
| **Desfazer sempre que possível** | `Restaurar playlist anterior` após publicar (enquanto o backup existir). Vínculo confirmado pode ser desfeito no histórico do item. Reconciliação nunca apaga o vínculo antigo. |
| **Calma por padrão** | Sem animação decorativa; um único momento de movimento (progresso). Bandeja silenciosa: só notifica quando há algo a fazer. |

## 5. Arquitetura de informação

Navegação lateral com 4 destinos (poucos de propósito; o operador vive na primeira):

```
┌──────────────┬──────────────────────────────────────────────┐
│ V  Async     │  Barra de conexões: ● Holyrics  ● Videira    │
│              ├──────────────────────────────────────────────┤
│ ▸ Culto      │                                              │
│   Vínculos   │   conteúdo da tela                           │
│   Histórico  │                                              │
│   Ajustes    │                                              │
│              │                                              │
│ v0.1 · Igreja│                                [ação única]  │
└──────────────┴──────────────────────────────────────────────┘
```

### Mapa de telas

| # | Tela | Entra por | Ação primária |
|---|---|---|---|
| T0 | **Boas-vindas / pareamento** (3 passos: Holyrics, Videira, pronto) | Primeira execução; token removido | `Testar conexão` → `Continuar` → `Começar` |
| T1 | **Culto** (Preparar culto: setlist, destino, músicas) | Abertura do app; notificação de domingo; bandeja | `Revisar pendências` ou `Publicar no Holyrics` |
| T2 | **Revisar músicas** (lote exato + individuais + ausentes) | T1 com pendências | `Vincular N músicas` |
| T2a | Diálogo **Escolher versão** (ambíguo) | Linha ambígua em T1/T2 | `Usar esta versão` |
| T2b | Diálogo **Música não está no Holyrics** | Linha ausente | `Ler a biblioteca de novo` |
| T3 | Diálogo **Confirmar substituição** | `Publicar no Holyrics` | `Substituir playlist` |
| T4 | **Publicando** (progresso por etapa) | T3 | — (sem ação; cancelar só antes da escrita) |
| T5 | **Resultado** (conferido / parcial / falhou e restaurou / falhou sem restaurar) | Fim de T4 | `Pronto` (secundária: `Restaurar playlist anterior`) |
| T6 | **Vínculos** (inclui modo de reconciliação após troca de PC) | Menu; banner "A biblioteca mudou" | `Confirmar N trocas` |
| T7 | **Histórico** (execuções + relatórios pendentes) | Menu; badge de pendentes | `Enviar relatórios pendentes` |
| T8 | **Ajustes** (conexões, agendamento, aparência, bandeja, dados) | Menu | por seção (`Salvar`) |
| T9 | **Bandeja e notificações** | Sistema | item de menu `Preparar culto` |

### Fluxo principal (caminho feliz, alvo: ≤ 3 cliques e < 1 min)

```
Abrir app ─► T1 carrega sozinho (setlist + biblioteca + destino)
              │
              ├─ tudo pronto ─► [Publicar no Holyrics] ─► T3 [Substituir playlist] ─► T4 ─► T5 "Publicado e conferido"
              │
              └─ pendências ─► [Revisar pendências] ─► T2
                                 ├─ lote exato: [Vincular 2 músicas]
                                 ├─ ambíguo:   T2a [Usar esta versão]
                                 └─ ausente:   T2b importar no Holyrics ─► [Ler a biblioteca de novo]
                               ─► volta a T1 com tudo pronto
```

### Fluxos alternativos

- **Destino errado:** T1 mostra alerta no cartão "Destino" ("Está selecionada a playlist Temporário"). Ação: o operador seleciona o culto no Holyrics e clica em `Verificar de novo`. Se insistir, T3 exige marcar "Confirmo que é este o culto".
- **Publicação parcial:** com itens pendentes não resolvidos, T3 mostra a lista do que fica de fora e uma caixa desmarcada "Publicar mesmo sem estas 1 música". Sem marcar, o botão fica desabilitado com o motivo ao lado.
- **Nada a fazer:** se a playlist já é igual ao alvo, T1 mostra "A playlist já está igual ao setlist" e o primário vira `Conferir de novo` (não reescreve).
- **Falha durante publicação:** T4 → T5 "Não deu certo. A playlist voltou ao que era." com lista conferida; ou, se a restauração falhar, T5 lista os itens originais para refazer manualmente no Holyrics, com `Copiar lista`.
- **Troca de PC:** ao detectar mudança de biblioteca, T1 ganha banner. Se o setlist depende de vínculos afetados, as linhas ficam "Confirmar vínculo" e T6 abre filtrado.
- **Sem internet:** T1 usa o último setlist baixado, com o horário ("baixado sábado 21:14"), permite publicar com aviso, e o relatório vai para a fila (T7).

## 6. Design System: o que reaproveitar e o que é específico do desktop

### Reaproveitado sem mudança

| Do DS Videira | Uso no async-videira |
|---|---|
| Tokens primitivos e semânticos (`--videira-*`, `--neutral-*`, `--color-*`, claro e escuro) | Copiados 1:1 em `src/ui/prototype/styles.css`. Fonte da verdade continua no `videira-music`. |
| Marca (`videiraBrand`: `primary 136 42% 33%`…) | `--brand-*` no `:root`. |
| Status `danger` / `warning` / `success` | Estados das músicas e alertas. Nunca a paleta `red` solta. |
| Atkinson Hyperlegible (UI) + JetBrains Mono (dado) | Mono para ID Holyrics, horário de releitura e código de erro em "Detalhes técnicos". |
| Escala tipográfica (eyebrow, h1 `text-3xl`, h2 `text-lg`, corpo 16, apoio 14, dado 12) | Igual. |
| Espaço 4 px, raios (`full` botão/badge, `2xl` card, `xl` input/bloco) | Igual. |
| `.ds-card`, `.ds-card-muted`, `.ds-button`, `.ds-button-secondary`, `.ds-button-danger`, `.ds-input`, `.ds-badge`, `.ds-eyebrow`, `.ds-link` | Reimplementados em CSS puro com os mesmos valores (o protótipo não usa Tailwind). |
| Anatomia "Mesa" (eyebrow → h1 + ação → apoio → filtro → conteúdo → vazio no lugar) | Todas as telas. |
| Dialog (role, foco preso, `Esc`, volta do foco, sem fechar no overlay quando `busy`) | T2a, T2b, T3. |
| Feedback 7.6 (erro na região, sem toast para erro) | Erros de conexão e de publicação. |
| Texto de interface (seção 8: verbo que atravessa o fluxo, sem ponto em botão) | "Publicar" → "Publicando…" → "Publicado e conferido". |

### Específico do desktop (novo; candidatos a voltar para o DS se repetirem)

| Padrão | Por quê | Nome proposto |
|---|---|---|
| **Shell com navegação lateral** | Janela desktop ≥ 900 px; o header sticky do web não cabe com barra de conexões | `.app-shell`, `.app-nav` |
| **Barra de conexões** (Holyrics / Videira com ponto + texto) | Dependência de dois serviços; o operador precisa ver qual caiu | `.conn-pill` |
| **Linha de música com status** (posição, título, artista, estado, ação) | Equivalente "Mesa" do item de setlist, com estado de sync | `.song-row` |
| **Chip de status** (ícone + texto, tons success/warning/danger/neutral) | `ds-badge` só tem o tom primário | `.status-chip` (`--ok`, `--warn`, `--danger`, `--info`) |
| **Comparação antes × depois** | Prevenir o apagamento acidental | `.diff-columns` |
| **Lista de etapas de progresso** | Aplicação não atômica com várias fases | `.step-list` |
| **Alerta de região** (ícone + título + texto + ação) | O DS tem só `Alert` em texto; aqui o erro precisa de ação | `.callout` (`--warn`, `--danger`, `--info`, `--ok`) |
| **Barra de ação fixa no rodapé** | Lista longa + ação primária sempre visível na janela | `.action-bar` |
| **Menu da bandeja e notificação do SO** | Nativos do sistema; o app só define texto e itens | ver [microcopy](microcopy.md#bandeja-e-notificacoes) |

Não usados: densidade "Estante" e classes `.music-*` (o app não mostra cifra), `chord` (não há acorde; IDs usam `content-muted` em mono).

> **Fontes no desktop:** o app roda sem internet às vezes. O build final deve **empacotar** Atkinson Hyperlegible e JetBrains Mono (licença OFL) em vez de carregar do Google Fonts. O protótipo usa o Google Fonts com fallback de sistema.

## 7. Riscos de UX e mitigação

| Risco | Mitigação |
|---|---|
| Operador confirma o lote sem ler | Lote só com correspondência exata única; lista visível com título + artista dos dois lados; o verbo traz a contagem ("Vincular 2 músicas"); desfazer por item. |
| Culto errado selecionado no Holyrics | Checagem de tipo e data; nome do destino no título do diálogo; reconhecimento explícito quando suspeito. |
| Falso sucesso (repetida descartada pelo Holyrics) | Estado "Repetida — entra 1 vez" antes de aplicar; sucesso só após releitura comparada com a lista sem repetição. |
| Holyrics fechado no meio | Etapa atual nomeada; resultado "falhou" com restauração tentada e conferida; lista original para copiar. |
| Pânico com o culto começando | Tudo ou nada é o padrão, mas a publicação parcial consciente existe; erros dizem o próximo passo em uma frase. |
| Token exposto / API aberta na rede | Aviso no pareamento e em Ajustes; token mascarado; nunca exibido de novo. |
| Troca de PC esquecida | Detecção automática e banner; nunca apaga vínculo antigo. |

## 8. Métricas de sucesso (para validar com operador real)

- Caminho feliz concluído em < 60 s e ≤ 3 cliques após abrir o app.
- 0 publicações no culto errado em teste de usabilidade com destino "Temporário" selecionado.
- Operador explica, sem ajuda, o que é "Repetida — entra 1 vez" e "Não está no Holyrics".
- Primeira configuração concluída pelo técnico voluntário em < 10 min sem documentação externa.
