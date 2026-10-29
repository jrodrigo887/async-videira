# ADR 0008: observabilidade, segurança e release

- **Status:** Aceito como baseline
- **Data:** 2026-10-29

## Contexto

O app trata tokens de organização e token Holyrics em uma API HTTP sem TLS que pode escutar na LAN. O operador precisa de suporte simples, e o fluxo ocorre semanalmente sob pressão. Logs e diagnósticos não podem reproduzir segredos nem conteúdo desnecessário.

## Decisão

Sem telemetria por padrão. Diagnóstico é local e exportado somente por ação explícita. Logs estruturados em `%LOCALAPPDATA%/Videira/AsyncVideira/logs` (ou diretório equivalente macOS), rotação por tamanho e retenção limitada; redigir tokens, headers `Authorization`, URLs com credencial, letras/cifras e payloads completos. Pacote de diagnóstico inclui versão/OS, checks de conectividade sem credencial, timestamps, códigos de erro, resumo do estado e logs redigidos; revisão prévia e opção de remover antes de salvar/compartilhar.

Threat model e controles mínimos:

- **Token vazado:** Credential Manager/Keychain, nunca JSON/log/renderer; escopo mínimo, substituir/revogar no onboarding; apagar na remoção solicitada.
- **API Holyrics exposta na LAN:** chamadas apenas para `127.0.0.1`, alerta de HTTP/0.0.0.0, recomendar firewall e rede confiável, permissões mínimas, não descobrir ou conectar a hosts arbitrários.
- **Atualização maliciosa:** assinatura de código e metadados, chave de release fora do CI comum, HTTPS, canal e versão visíveis, sem downgrade silencioso.
- **Arquivos locais adulterados/roubados:** ACL de diretório de usuário, JSON sem segredo, escrita atômica + checksum já definidos, logs com dados mínimos; checksum detecta corrupção, não é autenticação.
- **Renderer comprometido/XSS:** sandbox, context isolation, CSP sem código remoto, sem Node, IPC de comandos allowlist, validação de payload e nenhuma API genérica de filesystem/rede.

CI deve gerar builds reproduzíveis quanto possível em runners Windows e macOS, executar lint/typecheck/unitários e testes de integração contra servidores falsos; publicar artefato somente após smoke E2E assinado em ambiente limpo. Versionamento SemVer: major para mudança incompatível de IPC/estado, minor para capacidade compatível, patch para correção compatível. Cada release tem changelog legível para operador, notas de migração e artefatos/assinaturas verificáveis.

## Alternativas

- Telemetria automática: rejeitada no lançamento por não ser necessária para operação e ampliar coleta/superfície de privacidade.
- SQLite/log remoto como observabilidade: desproporcional ao uso semanal; suporte começa com exportação local explícita.

## Consequências

- Diagnóstico pode conter metadados operacionais; a tela de exportação deve mostrar o conteúdo/resumo e pedir consentimento para qualquer envio externo.
- A política de privacidade deve informar finalidade, dados locais, serviços Videira/Holyrics contactados, retenção e ausência de telemetria padrão.
- Assinatura, notarização, secrets CI, updater e recuperação após interrupção são gates de release, não tarefas pós-lançamento.
