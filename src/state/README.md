# Estado local

`store.ts` lê e grava JSON com `schemaVersion`, `updatedAt` e SHA-256 do conteúdo canônico. Escritas usam temporário no mesmo diretório, `fsync` e rename. Chaves que indiquem token, segredo, senha ou autorização são recusadas.

Guarda apenas cache de setlist/catálogo, preparação pendente, fingerprint da biblioteca, relatórios pendentes e migração. Credenciais são fornecidas por ambiente e nunca persistidas. `ASYNC_VIDEIRA_STATE_PATH` permite configurar o caminho; por padrão usa o diretório de dados do usuário.
