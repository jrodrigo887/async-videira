# Interface

Renderer React + TypeScript do app desktop (Vite, `root: src/ui/app`). Conversa com o processo principal só pela ponte IPC tipada (`shared/api.ts`).

```text
app/
  main.tsx            raiz: roteamento entre telas, tema, atalhos, ordem de abertura
  style.css
  shared/             api.ts (call tipado), ui.tsx (Icon, Callout, chips…), use-theme.ts, web-shim.ts (navegador sem Electron)
  features/
    culto/            culto.tsx, confirm-apply.tsx, recovery.tsx (publicação interrompida), use-worship.ts
    vinculos/         vinculos.tsx, use-links.ts
    ajustes/          ajustes.tsx, use-settings.ts
    ajuda/            ajuda.tsx, use-help.ts
    historico/        historico.tsx, use-logs.ts
```

Cada funcionalidade tem a tela (`*.tsx`) e um hook de dados (`use-*.ts`) que chama os comandos IPC; as telas recebem tudo por props. Uma funcionalidade não importa de outra: o que for comum vai para `shared/`.

O protótipo de design (HTML estático) está arquivado em `docs/design/prototype/`.
