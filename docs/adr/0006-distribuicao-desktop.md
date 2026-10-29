# ADR 0006: instaladores, atualização e ciclo de vida

- **Status:** Recomendado; detalhes finais dependem do spike de release
- **Data:** 2026-10-29

## Contexto

O primeiro alvo é Windows, instalação simples por operador sem privilégios administrativos. O estado operacional fica em JSON sob `%APPDATA%`; tokens ficam no cofre do SO. Depois haverá distribuição macOS.

## Decisão

Distribuir no Windows um **instalador NSIS por usuário** (Electron Builder ou ferramenta equivalente), sem serviço Windows e sem exigir elevação. Assinar executáveis e instalador com certificado Authenticode de publisher verificável. Atualizações usam canal estável HTTPS, metadados/artefatos assinados ou verificados por assinatura, rollout gradual e rollback operacional. O app oferece estável como canal padrão; prévia só por escolha explícita. Atualizar não apaga dados.

Desinstalação remove binários e atalhos. Preserva `%APPDATA%` por padrão, com opção explícita “remover também meus dados” no desinstalador ou fluxo de remoção documentado. Essa ação remove estado/cache/logs e tenta apagar credenciais do cofre após confirmação. Não remover relatórios pendentes sem avisar/exportar.

Para macOS, gerar `.dmg` com app `.app` assinado por Developer ID, hardened runtime e notarização Apple; stapling do ticket antes de publicar. Primeiro release Mac deve ser manual/estável e só habilitar updater após validar assinatura, notarização e rollback.

## Alternativas

- **MSI:** apropriado para distribuição corporativa e políticas IT, porém frequentemente exige elevação e adiciona manutenção de WiX/Windows Installer. Não é padrão para instalação individual.
- **MSIX:** bom isolamento e atualização gerenciada, mas restrições de integração/per-user e distribuição/certificados complicam suporte e instalação fora da Store.
- **NSIS:** instalação por usuário, experiência simples e suporte amplo no ecossistema Electron; escolha para o público-alvo.

## Consequências

- Sem certificado confiável, SmartScreen pode exibir aviso de publisher desconhecido. Certificado reduz a fricção, mas reputação do arquivo/publisher pode levar tempo; orientar download somente do canal oficial e nunca instruir a ignorar verificação.
- Chave privada de assinatura não fica no repositório nem em artefatos CI; usar segredo protegido/HSM ou serviço de assinatura, com acesso auditável e rotação/revogação planejadas.
- Update metadata e binário devem vir do mesmo canal HTTPS, ser autenticados criptograficamente e rejeitar downgrade não autorizado. Um endpoint comprometido não pode publicar código sem chave de release.
- Manter cópia recuperável dos dados antes de migração de schema e tornar migrações compatíveis com rollback da versão quando possível.
