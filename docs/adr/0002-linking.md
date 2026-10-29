# ADR 0002: vínculos e catálogo Holyrics

- **Status:** Aceito
- **Data:** 2026-10-29

## Decisão

`SongExternalLink` no Videira Music é a fonte da verdade dos vínculos, no escopo da organização. O app atende um computador Holyrics por igreja; não criar `installationId` até existir necessidade de mais de um computador.

Ler o catálogo atual sob demanda com `GetSongs(fields=id,title,artist)` e validar localmente todo `externalId` antes de aplicar. `SearchLyrics` não é catálogo completo (limite 50) e sua cardinalidade bruta não é critério de match. Ignorar sempre o item do sistema `1611686353330`.

A associação é sob demanda, apenas para músicas que entram no setlist em preparação. Resolução operacional:

1. `externalId` confirmado que existe no catálogo atual resolve o item.
2. Sem ID válido, título + artista com normalização exata formam sugestão, nunca vínculo/aplicação automática.
3. Candidatos aproximados ou ausentes vão para busca/manual; fuzzy não é aplicado automaticamente.

Matches exatos únicos podem ser apresentados numa lista revisável e confirmados em lote pelo usuário. Duplicatas exatas e aproximações sempre exigem decisão individual. Enviar ao Videira apenas vínculos confirmados; nunca upload periódico/cego de catálogo completo.

## Reconciliação

Se o ID associado não existir mais, preservar o vínculo antigo e sugerir substituto por título/artista exatos. Confirmação cria histórico `oldId → newId`; não apagar o vínculo antigo. Não gravar marcadores em músicas Holyrics: criação/edição via API exige Plan.

## Consequências

O Videira precisa de endpoint autenticado e organizacional para gravação de vínculos confirmados em lote e histórico de migração. Snapshot remoto de catálogo, caso usado para interface/reconciliação, deve ser atômico; o fluxo desktop de publicação continua lendo o Holyrics ao vivo e não depende desse snapshot.
