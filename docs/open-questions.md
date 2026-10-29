# Perguntas abertas e validações pendentes

As decisões de produto e arquitetura estão registradas nos ADRs 0001–0008. Esta lista contém somente validações técnicas e mudanças de contrato ainda necessárias.

## Holyrics / desktop

- Fazer spike Electron com build NSIS por usuário, Credential Manager, bandeja, agendamento sem sessão interativa e update assinado; medir tamanho e consumo reais (P0).
- Definir implementação/adaptador Keychain e validar `.app`/`.dmg` assinado e notarizado em macOS com Holyrics (P1).
- Prototipar IPC do contrato `docs/contracts/ui-core-ipc.md` contra o core atual sem mover responsabilidades da frente do núcleo; alinhar com `docs/design/view-models.md` quando existir (P0).
- Definir serviço/fornecedor de assinatura Authenticode, armazenamento seguro da chave e política de rotação/revogação; validar reputação SmartScreen (P0 para distribuição pública).
- Validar atualização assinada com rollback, downgrade bloqueado e migração recuperável do estado JSON (P0).
- Testar recuperação após encerramento durante cada fase da aplicação e confirmar estado incerto via releitura (P0).
- Definir retenção/limite de logs e revisar política de privacidade e conteúdo do diagnóstico exportado (P1).
- Medir a superfície de hosts/rotas Videira permitida e testar bloqueio de redirects para fora da allowlist (P0).

- Validar o fluxo completo em macOS: servidor local, porta, firewall, permissões mínimas, Credential Keychain e pacote `.dmg`.
- Medir `SearchLyrics` com biblioteca acima de 50 resultados e confirmar que a resolução sempre filtra candidatos por título/artista exatos; o catálogo principal permanece `GetSongs`.
- Validar encerramento/reinício do Holyrics durante remoção, adição, releitura e restauração best-effort.
- Validar na instalação alvo o conjunto mínimo de permissões definido em `docs/architecture.md`; o token da validação ao vivo tinha permissões extras.

## Contratos Videira necessários

- Criar endpoint autenticado de vínculo em lote, escopado pela organização do token; aceitar apenas vínculos confirmados pelo usuário e manter histórico old→new sem apagar o vínculo antigo.
- Definir snapshot de catálogo remoto atômico/completo para revisão e reconciliação, sem torná-lo dependência do fluxo normal de publicação nem exigir upload periódico do catálogo pelo desktop.
- Incluir fingerprint da biblioteca (`baseDir`, `platform`, `ip_list`, hash do conjunto de IDs) nos `sync-reports` e validar outcomes `added`, `duplicate`, `skipped` e `failed`.

## Fallback de importação

- Definir a fonte/procedimento de fornecimento de conteúdo autorizado (letra/estrofes) para arquivos TXT, OpenLP XML ou OpenSong; o endpoint de setlist atual contém apenas título/artista/IDs e não traz letras.
