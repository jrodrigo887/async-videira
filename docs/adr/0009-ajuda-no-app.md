# ADR 0009: ajuda offline integrada ao aplicativo

- **Status:** Aceito
- **Data:** 2026-10-29

## Contexto

O operador precisa de instruções rápidas durante configuração e uso dominical, inclusive sem internet. O conteúdo de ajuda e sua tela estão sendo produzidos pela frente de design; há também um tutorial longo em `docs/tutorial/configurar-holyrics-e-async-videira.md`. A UI Electron não deve transformar Markdown em HTML executável, buscar conteúdo remoto ou abrir destinos arbitrários.

## Decisão

Empacotar `src/help/*.md` junto com o app. Os artigos têm front matter validado (`id`, `title`, `summary`, `order`, `keywords`, opcional `context`); o build valida IDs únicos, campos, links internos e referências a âncoras e gera índice JSON de busca. Markdown e índice são recursos locais versionados no mesmo release do executável; a versão da ajuda é a versão do app. Busca é local e funciona offline; runtime não faz requisição de rede para ler ou buscar ajuda.

`docs/tutorial/configurar-holyrics-e-async-videira.md` permanece a fonte longa e referência operacional mantida pela arquitetura/produto. Para evitar duas cópias concorrentes, arquivos `src/help` devem ser produzidos a partir de seções marcadas/IDs estáveis desse tutorial por etapa de geração documentada, ou o build deve falhar se a cópia derivada divergir. A frente de design define divisão dos tópicos, títulos, resumos, palavras-chave e apresentação; arquitetura mantém a fonte longa e o validador/gerador. Não editar manualmente a cópia gerada. A migração inicial deve preservar os IDs de tópico usados por links contextuais.

O renderer apresenta Markdown com parser/renderizador configurado sem HTML bruto (`html: false`), sem plugins que executem HTML ou scripts. Links internos usam apenas IDs/rotas locais. Links externos são renderizados como ação controlada: renderer solicita abertura via IPC e main aceita somente `https:` para domínios explicitamente permitidos, mostra o destino ao usuário quando necessário e abre no navegador padrão do sistema; rejeitar `file:`, `javascript:`, `data:`, credenciais na URL, redirects não permitidos e esquemas customizados. CSP proíbe scripts inline/remotos e `object-src`; conteúdo de ajuda nunca injeta HTML.

Não oferecer ajuda “online” no lançamento. Atualizações de documentação passam pelo mesmo release assinado e revisado que o app; busca remota criaria canal de conteúdo mutável, tracking potencial, novos domínios de confiança e possibilidade de instruções incompatíveis com o binário instalado. Se no futuro houver atualização remota, exigirá ADR próprio, assinatura/versionamento do pacote de conteúdo, compatibilidade com versão do app, consentimento e cache offline, sem HTML executável.

Acesso: item **Ajuda** no menu do app, atalho `F1` no Windows e `Cmd+?` no macOS (permitir também `Cmd+/` se o layout do teclado não produzir `?`); link “Ajuda” em erros com tópico contextual; primeira execução abre boas-vindas/primeiros passos uma vez, com opção “não mostrar novamente”. F1/Cmd+? funciona de qualquer tela sem interromper uma operação em andamento.

## Contrato

Adicionar `help.list`, `help.get`, `help.search`, `app.diagnosticInfo` e `externalLink.open` à allowlist IPC. `app.diagnosticInfo` fornece somente informações copiáveis para suporte (versão/build, SO, estado booleano de configuração e conectividade, versão Holyrics se conhecida, códigos de erro/correlation ID); não inclui tokens, headers, conteúdo de setlist/letras, IPs/hostname ou caminhos pessoais. A UI copia o objeto formatado para clipboard após ação explícita. `CoreError.helpTopicId` é opcional e aponta para ID existente no índice empacotado. Especificação em `docs/contracts/ui-core-ipc.md`.

## Alternativas

- Ajuda servida online em runtime: rejeitada por dependência de conectividade, risco de conteúdo remoto incompatível/tamper e superfície de privacidade maior.
- Manter tutorial longo e artigos independentes como textos editáveis: rejeitada por duplicação e divergência. Geração/validação mantém um conteúdo canônico.
- HTML arbitrário ou links diretos do renderer: rejeitados por XSS, navegação externa não controlada e quebra de isolamento.

## Consequências

- Conteúdo novo chega em release do app; erro na geração de ajuda bloqueia o build.
- Busca e navegação funcionam sem Videira, Holyrics ou internet.
- Links contextuais dependem de estabilidade dos IDs e validação no build; ID ausente deve cair para a tela inicial da ajuda sem quebrar a operação.
- Recomendam-se testes automatizados de front matter e schema, IDs duplicados, links/âncoras internas quebrados, índice gerado determinístico e busca por título/palavra-chave; testes de renderização XSS com tags/scripts, atributos de evento e URLs `javascript:`/`data:`; e teste de IPC de links externos para domínio permitido, host malicioso e redirect.
- Verificar smoke de abertura offline e consistência entre versão do app e metadados do bundle em Windows/macOS.
