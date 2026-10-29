# Adaptador Videira

Cliente HTTPS com `Authorization: Bearer <VIDEIRA_TOKEN>`, sem acesso direto ao banco. Expõe listagem de setlists publicados, detalhe de setlist e envio de `sync-reports` em `/api/integrations/holyrics`.

O token é lido do ambiente pelo CLI, nunca gravado no estado JSON nem incluído em logs/erros. Falhas HTTP são reportadas sem ecoar headers ou corpo potencialmente sensível.
