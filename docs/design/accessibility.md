# Acessibilidade, tema e janela

> Alvo: WCAG 2.2 AA, igual ao DS Videira (seção 12). Este documento lista só o que o desktop acrescenta ou reforça.

## 1. Teclado

| Tecla | Onde | Faz |
|---|---|---|
| `Tab` / `Shift+Tab` | Tudo | Ordem = ordem visual: navegação lateral → barra de conexões → conteúdo → barra de ação |
| `Ctrl+1…4` | Tudo | Culto, Vínculos, Histórico, Ajustes |
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
