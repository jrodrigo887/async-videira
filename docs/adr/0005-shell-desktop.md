# ADR 0005: shell e stack do aplicativo desktop

- **Status:** Recomendado; validar no spike de empacotamento
- **Data:** 2026-10-29

## Contexto

O núcleo existente era JavaScript ESM (`.mjs`; hoje TypeScript estrito, executado direto pelo Node 22.18+ e compilado para `out/` no empacotamento), usa `fetch` nativo e `node:test`. O design system Videira é React/Vite. O produto precisa de UI local, acesso ao cofre do SO, bandeja/agendamento e chamadas à API Holyrics em `127.0.0.1:8091` e à API HTTPS Videira. A manutenção do núcleo está em outra frente; reescrevê-lo cria divergência e risco de publicação.

## Decisão

Adotar **Electron + React/Vite + Node.js**, com o núcleo JS executado exclusivamente no processo principal (ou worker Node controlado pelo principal). O renderer não recebe tokens, não tem `nodeIntegration`, não acessa rede arbitrária nem filesystem. Uma preload mínima expõe uma API IPC tipada. O processo principal mantém credenciais no Credential Manager/Keychain por adaptadores nativos e chama os serviços.

## Alternativas

| Opção | Reuso do núcleo e DS | Pacote/segurança | Adequação e custo |
|---|---|---|---|
| **Electron (escolhida)** | Reuso direto de Node e React/Vite | Instalador maior por Chromium/Node; segurança boa com renderer isolado, CSP, IPC allowlist e segredos no main | Menor risco de portabilidade e curva para equipe web/Node; suporte maduro a bandeja, updater e macOS |
| **Tauri 2 + sidecar Node** | Reusa o core empacotando Node e `.mjs`; DS web pode ser hospedado no webview | Pacote potencialmente menor; ciclo de vida, distribuição, assinatura e comunicação com sidecar aumentam a superfície operacional | Rust/toolchain Tauri para shell e manutenção de duas runtimes; opção válida se tamanho virar requisito medido |
| **Tauri 2 + core Rust** | React/Vite reaproveitável, mas core precisa ser reimplementado ou manter Node auxiliar | Bundle menor e permissões nativas explícitas | Não escolhida: duplica lógica crítica e testes durante fase de produto |
| **.NET MAUI** | DS web precisa de WebView/ponte; core JS requer processo Node ou reescrita | Integração nativa e pacote aceitável, mas runtime e bridge adicionam dependências | Boa se equipe fosse .NET; maior curva e menor reaproveitamento neste projeto |

Tamanho real do Electron deve ser medido no primeiro instalador. A API Holyrics usa HTTP em `0.0.0.0`; o cliente sempre chama loopback, mas isso não protege o servidor de outros hosts na LAN. Electron não muda esse risco: firewall, rede confiável e token de escopo mínimo são necessários.

## Consequências

- O core JS mantém uma única implementação; importar seus módulos no main/worker não autoriza alterações à frente que o mantém.
- React/Vite pode reaproveitar componentes e tokens do DS Videira; renderer continua não confiável.
- Cofre, agendamento, bandeja e atualização terão adaptadores Electron/OS e testes Windows/macOS.
- macOS é tecnicamente viável com o mesmo shell, mas exige build, assinatura, notarização e validação do Holyrics naquele ambiente.
- Se tamanho, consumo ou requisitos de hardening não forem aceitáveis, reavaliar Tauri + sidecar com benchmark comparável, sem portar o core antes do spike.
