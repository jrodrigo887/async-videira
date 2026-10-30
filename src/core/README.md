# sync-core

> O planejador e as regras de vínculo agora vivem em `src/domain/` (`sync/sync-plan.ts`, `linking/song-matcher.ts`, `sync/sync-outcome.ts`) e a execução em `src/application/use-cases/execute-sync.ts`. Ver [architecture-target.md](../../docs/architecture-target.md). Esta pasta mantém só a ajuda (`help/`).

`sync-plan.ts` é um planejador puro usado para fixar e testar as regras. Runtime final do core desktop continua conforme ADR-0001; a suíte usa Node.js `node:test`, sem dependências.

Contrato de associação e aplicação:

1. Resolver por `externalId` confirmado e presente no `GetSongs` atual. Sem ID válido, título **e** artista normalizados exatamente geram sugestão revisável, nunca autorização direta para aplicar. `SearchLyrics` pode ser amplo e seus resultados precisam de filtro exato. Normalização ignora diacríticos, caixa e espaços repetidos; preserva pontuação e qualificadores.
2. Cada item recebe `resolved`, `ambiguous`, `absent` ou `repeated`. Match exato único sem vínculo permanece `absent` com `suggestions`. O dry-run mostra estado e candidatos; vínculos exatos únicos podem ser revisados e confirmados em lote; duplicatas/aproximações exigem revisão individual.
3. Deduplicar IDs resolvidos preservando primeira ocorrência e avisar antes de aplicar.
4. Após `applyOrder`, reler obrigatoriamente a playlist; não retornar `OK` até confirmar a lista deduplicada esperada.
5. Relatório por item: `added`, `duplicate`, `skipped` ou `failed`. Não reaplicar quando a playlist já está igual ao alvo deduplicado. Nunca marcar `OK` sem releitura pós-aplicação.
6. Fingerprint/estado usa a sequência deduplicada para impedir reapply em loop.

Execute com `node --test tests/core/sync-plan.test.ts`.
