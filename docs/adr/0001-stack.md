# ADR 0001: stack inicial

- **Status:** Proposta de stack ajustada; decisões de produto e integração estão fechadas, validação multiplataforma pendente.
- **Data:** 2026-10-29

## Contexto

App desktop Windows/macOS para publicar setlists publicados do Videira Music na playlist Holyrics atualmente selecionada, em igreja com um computador e sem Holyrics Plan. Integração HTTPS do Videira usa token organizacional; Holyrics usa API local HTTP em `127.0.0.1:8091`. Não escrever no SQLite ou `.hly` do Holyrics.

## Proposta

Avaliar **Tauri 2 + TypeScript/React na UI + Rust no core nativo**, gerando instaladores `.msi` e `.dmg`. O core isola acesso seguro a tokens, estado local JSON, agendamento, sync-core e APIs. A UI oferece Preparar culto, revisão de vínculos e dry-run.

Tauri mantém o pacote desktop enxuto e permite colocar operações locais no processo nativo. Trade-off: exige Rust e validação da ponte/permissões nos dois sistemas. A stack continua proposta até um spike de build e API no macOS.

## Alternativas consideradas

| Stack | Trade-off principal |
|---|---|
| Electron + TypeScript/React | Ecossistema maduro e familiar; pacote e consumo de memória maiores por incluir Chromium/Node, além de fronteira de segurança entre renderer e processo principal. |
| .NET MAUI | Boa opção para equipe .NET e APIs nativas integradas; validar paridade de UI/bandeja, chamada local e empacotamento Windows/macOS para este uso. |
| Tauri 2 + TypeScript/React + Rust (proposta) | Aplicativo mais enxuto e backend nativo; curva de Rust e toolchain/assinatura multiplataforma por validar. |

## Consequências

- Sem dependências instaladas nesta etapa; core puro e testes Node atuais servem como especificação executável, não fixam runtime final.
- Builds e assinatura de `.msi`/`.dmg`, Credential Manager/Keychain e compatibilidade Holyrics no Mac precisam de spike.
- Os ADRs 0002–0004 definem vínculo, estado local, migração, aplicação e segurança independentemente da UI escolhida.
