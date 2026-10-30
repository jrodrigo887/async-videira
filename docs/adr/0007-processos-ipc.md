# ADR 0007: processos e contrato IPC UI-core

- **Status:** Aceito como contrato inicial
- **Data:** 2026-10-29

## Contexto

A UI precisa operar preparação, aplicação, vínculos e reconciliação. Rede, arquivos e segredos não podem ser acessíveis diretamente pelo renderer. Aplicação é destrutiva para a playlist selecionada e exige releitura confirmada.

## Decisão

O Electron main é o broker privilegiado e executa o core Node. O renderer chama apenas comandos da allowlist via preload; nunca recebe token ou cliente HTTP. Uma única operação mutável (`apply`, confirmação de vínculos ou reconciliação) pode estar ativa por vez. Preparações são canceláveis; aplicação só cancela antes da primeira escrita. Depois disso, concluir verificação/restauração best-effort e retornar resultado final.

Contrato de comandos, eventos de progresso, erros, timeouts e payloads está em [`../contracts/ui-core-ipc.md`](../contracts/ui-core-ipc.md). Seleção do culto de destino permanece no Holyrics; antes de aplicar, o usuário confirma o destino que a API informa e a substituição da playlist.

## Alternativas

- Renderer chamar Videira/Holyrics diretamente: rejeitada, pois exporia credenciais, ampliaria superfície de ataque e permitiria operações fora do fluxo verificado.
- Um processo Node filho por comando: isolamento útil, mas lifecycle, serialização, cancelamento e acesso concorrente ao estado aumentam complexidade; reavaliar se hangs/crashes do core afetarem o shell.
- Fazer tudo no main: suficiente inicialmente; mover chamadas longas a worker controlado se a responsividade ou isolamento exigir.

## Consequências

- Todas as chamadas de rede usam allowlist de hosts/rotas e validação de entrada no main.
- Timeout de rede não implica timeout global da operação de escrita; polling e espera de estabilização têm prazo explícito e falha verificável.
- Reinício no meio de aplicação é estado incerto: ao iniciar, ler a playlist, nunca inferir sucesso pelo estado anterior, e oferecer recuperação/novo dry-run.
  - Implementação: o apply grava `journal = started{backupIds, targetIds}` no estado ANTES da primeira escrita e `done{status}` depois. Na abertura, `worship.recover` (`inspect`) relê a playlist e informa se ela está como o alvo, como o backup ou diferente; `restore` reaplica o backup, `dismiss` só encerra o aviso. Nenhuma ação é automática.
