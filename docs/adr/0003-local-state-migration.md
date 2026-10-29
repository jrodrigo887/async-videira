# ADR 0003: estado local e troca de biblioteca/PC

- **Status:** Aceito
- **Data:** 2026-10-29

## Decisão

Não usar SQLite local neste momento. Manter um JSON de estado versionado contendo `schemaVersion`, `updatedAt`, checksum SHA-256, cache de catálogo/setlist, fila de relatórios pendentes, fingerprint da biblioteca e estado/histórico de migração. Tokens nunca entram no JSON: usar Credential Manager (Windows) e Keychain (macOS).

Escrever o JSON em arquivo temporário no mesmo diretório, sincronizar e renomear atomicamente. Cache corrompido é reconstruível via APIs; não é fonte da verdade. Reavaliar SQLite somente se surgir necessidade concreta de histórico offline pesquisável.

A fingerprint da biblioteca é composta por `GetVersion.baseDir`, `platform`, `ip_list` e hash do conjunto ordenado de IDs de `GetSongs`. Mudança de fingerprint ou desaparecimento de muitos IDs enquanto títulos/artistas equivalentes aparecem sob IDs novos inicia modo de reconciliação com confirmação.

## Migração de PC

Copiar `Holyrics/files`, restaurar `.hbac` ou usar Google Drive preserva IDs. Exportar/importar `.muf`/`.mufl` ou importar TXT/OpenLP/OpenSong gera IDs novos. Após migração com IDs novos, sugerir remapeamento exato, revisar em lote somente candidatos únicos e registrar old→new. Manter os vínculos antigos como históricos; nunca apagá-los automaticamente.

Não criar `installationId` formal enquanto o produto suportar um único PC por igreja.
