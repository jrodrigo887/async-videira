# Perguntas abertas e validações pendentes

As decisões de produto e arquitetura estão registradas nos ADRs 0001–0004. Esta lista contém somente validações técnicas e mudanças de contrato ainda necessárias.

## Holyrics / desktop

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
