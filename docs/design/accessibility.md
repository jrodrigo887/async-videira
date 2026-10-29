# Acessibilidade, tema e janela

> Alvo: WCAG 2.2 AA, igual ao DS Videira (seção 12). Este documento lista só o que o desktop acrescenta ou reforça.

## 1. Teclado

| Tecla | Onde | Faz |
|---|---|---|
| `Tab` / `Shift+Tab` | Tudo | Ordem = ordem visual: navegação lateral → barra de conexões → conteúdo → barra de ação |
| `Ctrl+1…4` | Tudo | Culto, Vínculos, Histórico, Ajustes |
| `F1` | Tudo (também em diálogo; ignorado durante a escrita) | Abre a Ajuda no tópico do contexto ([help-map](help-map.md)); `Voltar para onde estava` devolve a tela e o diálogo |
| `Ctrl+R` / `F5` | Culto | Preparar de novo (reler setlist, biblioteca e destino) |
| `Ctrl+Enter` | Culto, Revisar | Aciona o botão primário da tela (**nunca** confirma o diálogo de substituição) |
| `Esc` | Diálogo | Cancela e devolve o foco ao controle que abriu |
| `Enter` | Diálogo de substituição | **Não** é atalho: o foco inicial vai para `Cancelar`, não para `Substituir playlist` |
| `↑` / `↓` | Lista de músicas, radio de versões | Move entre itens |
| `Espaço` | Checkbox do lote | Marca/desmarca |

- Link "Pular para o conteúdo" como primeiro foco.
- Nenhum atalho executa escrita no Holyrics sem passar pelo diálogo.
- Diálogos: foco preso, `role="dialog"`, `aria-modal`, `aria-labelledby`; com `busy`, botões `disabled` e `Esc` ignorado durante a escrita.

## 2. Foco

- Anel `--color-focus` 4 px a 25% + contorno sólido de 2 px (o anel translúcido do DS sozinho fica abaixo de 3:1 sobre `surface` no claro; o contorno garante 3:1).
- `:focus-visible` apenas; nunca remover outline sem substituto.
- Ao mudar de tela: foco no `h1` (`tabindex="-1"`), anunciado pelo leitor de tela.
- Ao terminar a publicação: foco no `h1` do resultado.

## 3. Leitor de tela

- Região `aria-live="polite"` para progresso ("Etapa 3 de 5: colocando as músicas na ordem") e para resultados curtos ("2 músicas vinculadas").
- Erros de região: `role="alert"` na primeira aparição.
- Chip de status: texto visível ("Pronta"); ícone `aria-hidden`.
- Linha de música: `aria-label` composto "Posição 3, É Ele, DROPS, Confirmar vínculo".
- Barra de conexões: "Holyrics: conectado" / "Videira Music: sem conexão".
- IDs técnicos (mono) recebem `aria-hidden` quando há texto equivalente; no modo reconciliação são lidos ("ID antigo terminando em 267").

## 4. Contraste (tokens do DS)

Verificado sobre `surface` (claro `0 0% 100%`, escuro `240 8% 11%`):

| Par | Claro | Escuro | Mínimo |
|---|---|---|---|
| `content` / surface | ~18:1 | ~16:1 | 4.5 |
| `content-muted` / surface | ~7.5:1 | ~9:1 | 4.5 |
| `content-subtle` / surface | ~4.6:1 | ~5.5:1 | 4.5 (só texto ≥ 14 px; nunca informação essencial) |
| `primary-foreground` / `primary` (botão) | ~5.4:1 | ~8:1 | 4.5 |
| `danger` / `danger-subtle` (chip) | ~7:1 | ~6:1 | 4.5 |
| `warning` / `warning-subtle` | ~7:1 | ~8:1 | 4.5 |
| `success` / `success-subtle` | ~6.6:1 | ~7:1 | 4.5 |
| `border-strong` / surface (input, checkbox) | ~1.6:1 | ~1.9:1 | **3** → inputs e checkboxes usam `content-subtle` como borda (≥ 3:1) |

Valores aproximados; confirmar com ferramenta no build final. Estado nunca só por cor: chip = ícone + texto; item riscado = texto "sai" além do risco.

## 5. Tamanho do texto

- Base 16 px (corpo, linha de música, input). Apoio 14 px. Nada abaixo de 12 px (só badge/dado).
- Ajuste em Ajustes → Aparência: **Normal (100%)**, **Grande (115%)**, **Maior (130%)**, aplicado em `html { font-size }`; toda medida em `rem`.
- Também honrar a escala de exibição do Windows/macOS (o app não fixa px de janela).
- Em 130% e janela mínima, a lista continua legível: a linha de música quebra artista para baixo, nunca trunca o título sem `title`/tooltip.

## 6. Tema claro/escuro

Igual ao DS (seção 9):
1. Sem escolha salva → `prefers-color-scheme`.
2. Escolha salva → `data-theme="light" | "dark"` no `<html>`.
3. Tokens escuros copiados 1:1 de `styles/globals.css`.

Sala de mídia costuma ser escura: o tema automático é o padrão, e a troca é instantânea (sem transição de cor no `body`). Cores de status no escuro usam os tons claros do DS (`danger 0 85% 72%` etc.) e fundos `*-subtle` escuros.

## 7. Movimento

- Um momento: o indicador da etapa atual no progresso (rotação lenta). Com `prefers-reduced-motion: reduce`, vira ponto estático + texto "em andamento".
- Sem slide entre telas; troca instantânea.

## 8. Janela e responsividade

| Largura da janela | Layout |
|---|---|
| **≥ 1200 px** | Navegação lateral com rótulos (220 px); T1 em duas colunas: lista de músicas (2/3) + cartão Destino e resumo (1/3) |
| **900–1199 px** (alvo principal, mínimo 900×600) | Navegação lateral com rótulos (200 px); T1 em uma coluna: Destino em cima, lista embaixo |
| **< 900 px** (janela redimensionada abaixo do mínimo, não suportado oficialmente) | Navegação vira só ícones (64 px) com `aria-label` e tooltip |

- Altura mínima 600 px: a barra de ação é fixa no rodapé da área de conteúdo; a lista rola por dentro. Diálogo de substituição tem as duas colunas com rolagem própria e altura máx. `80vh`.
- O tamanho e a posição da janela são lembrados entre execuções.
- Alvo mínimo 40 px (Mesa) para botões; 44 px para a linha de música inteira clicável e para controles da bandeja.

## 9. Checagem de teclado nos diálogos (2026-10-29)

**Como foi feita:** Edge headless (Chromium) controlado pelo DevTools Protocol, com teclas reais (`Input.dispatchKeyEvent`: Tab, Shift+Tab, Esc, Enter) sobre o protótipo, 14 Tabs para frente e 14 para trás por diálogo. É uma checagem automatizada, equivalente à manual. **Não** inclui leitor de tela real (NVDA/Narrador): isso ainda precisa ser validado com uma pessoa.

| Diálogo (deep-link) | Foco inicial | Ciclo de Tab | Sai do diálogo? | Shift+Tab | Esc |
|---|---|---|---|---|---|
| Substituir, pendências + parcial (`?cenario=pendencias&dialogo=confirm`) | Cancelar | caixa "Publicar mesmo sem" → Cancelar (Substituir desabilitado fica fora do Tab) | não | mesmo ciclo, invertido | fecha |
| Substituir, temporária (`?cenario=temporaria&dialogo=confirm`) | Cancelar | "Estou no culto certo" → Cancelar | não | idem | fecha |
| Substituir, 15 itens (`?cenario=pronto&dialogo=confirm&antes=15`) | Cancelar | Substituir → "+ 7 músicas — mostrar todas" → Cancelar | não | idem | fecha |
| Escolher versão (`?cenario=pendencias&dialogo=choose`) | 1ª opção | grupo de opções (1 parada; ↑/↓ troca) → Cancelar | não | idem | fecha |
| Conferir parecida (`?cenario=loteVazio&dialogo=choose`) | opção | opção → Cancelar | não | idem | fecha |
| Não está no Holyrics (`?cenario=pendencias&dialogo=missing`) | Abrir no Holyrics | Procurar na biblioteca → Fechar → Ler de novo → Abrir no Holyrics | não | idem | fecha |

Também passaram:
- **Enter** com o foco inicial do diálogo de substituição **cancela**; não publica.
- **Esc** devolve o foco ao botão que abriu o diálogo.
- O diálogo abre rolado no topo, com o título visível. Antes, o foco em Cancelar rolava o diálogo e escondia o título; corrigido com `focus({ preventScroll: true })`.
- "Mostrar todas" expõe `aria-expanded` e `aria-controls`, e as 15 linhas aparecem ao expandir.

Pontos de atenção:
- No grupo de radio, um Tab entra e outro sai; a troca de opção é por ↑/↓, que é o padrão nativo. Isso precisa constar na ajuda de teclado da versão final.
- Botões desabilitados ficam fora da ordem de Tab. O motivo aparece em texto ao lado (`.why`) e está ligado ao botão principal por `aria-describedby`.

## 10. Contraste dos elementos novos

| Elemento | Tokens | Claro | Escuro |
|---|---|---|---|
| Chip "Sem data para conferir" | `content-muted` / `surface-muted` | ~6.6:1 | ~7.5:1 |
| "+ N músicas — mostrar todas" | `primary` / `surface-muted` | ~5:1 | ~7:1 |
| Rótulos de grupo (PRECISAM DE VOCÊ…) | `content-muted` / `surface` | ~7.5:1 | ~9:1 |
| Barra "N selecionados" | `content` / `surface-muted` | ~17:1 | ~13:1 |

Valores aproximados, calculados a partir dos HSL do DS. As capturas dos dois temas foram conferidas visualmente; falta a medição com ferramenta no build final.

## 11. Diálogo "Não está no Holyrics": editor e releitura (2026-10-29)

Mesma checagem automatizada da §9, feita em `?cenario=ausente&dialogo=missing` e em cada estado (`&editor=aguardando|pergunta|aberto|naoabriu|jaaberto|fechado`, `&releitura=encontrada|placeholder|naoencontrada|ambigua`). Em todos os estados, 16 Tabs seguidos não saem do diálogo.

| Estado | Foco inicial | Anúncio |
|---|---|---|
| Inicial | `Abrir no Holyrics` | — |
| Pedido enviado / O editor abriu? | `Sim, abriu` | `role=status`: "Pedimos ao Holyrics…" e, depois, "O editor abriu? Responda no diálogo." |
| Não abriu / erro | botão principal | `role=alert` com a causa |
| Encontrada | `Confirmar vínculo` (há Desfazer depois) | `role=status` |
| Placeholder | `Ler de novo`, não "Vincular mesmo assim" | `role=alert` |
| Ambígua | 1ª opção (↑/↓ troca); `Usar esta versão` fica desabilitado até escolher, e o motivo aparece em texto | `role=status` |

Durante os 2 s de espera, o botão fica desabilitado com o rótulo "Aguarde…", sem depender só da cor. O aviso "[Letra não fornecida]" é texto visível: ícone e título, nunca só cor.

## 12. Ajuda (T10)

Checagem automatizada (Edge headless via CDP), 2026-10-29:

| Verificação | Resultado |
|---|---|
| `F1` com erro na tela Culto | abre `configurar-holyrics` com o foco no título do tópico (`h2`, `tabindex=-1`) |
| `F1` dentro do diálogo "Não está no Holyrics" | abre `musica-nao-esta-no-holyrics`; **Voltar para onde estava** reabre o diálogo com o foco dentro dele |
| Busca | filtra a cada tecla; o foco e o cursor continuam no campo; a contagem é anunciada (`aria-live`) |
| Ordem de Tab | busca → Limpar → lista de tópicos → leitor (índice, links, Sim/Não, copiar) |
| Índice "Nesta página" | leva o foco à seção (`h3` com `tabindex=-1`) e rola até ela |
| Tópico atual na lista | `aria-current="page"` mais fundo, cor e barra à esquerda, não só cor |
| Tabelas | `<th scope="col">`; rolagem horizontal só dentro da tabela; a página não rola na horizontal em 900×600 |
| Markdown | nenhum `script`, `img`, `a`, `iframe` ou atributo inline; links internos são `<button>` |
| Avaliação Sim/Não | `aria-pressed` + ícone ✓ + texto de status |
| Tema escuro | tokens do DS; a nota (`md-note`) usa `warning-subtle` + borda `warning` (texto ~16:1 no escuro, ~17:1 no claro, aproximado) |

Pontos de atenção:
- A lista de tópicos fica antes do leitor no Tab. Em listas maiores, vale um "Pular para o tópico".
- O nome do link "Ver ajuda sobre isto" é igual em vários lugares. Dentro de um mesmo erro ou diálogo há só um, e o contexto vem do título do erro. Se o leitor de tela listar links fora de contexto, acrescentar `aria-describedby` para o título do erro.
