# Scripts

Scripts auxiliares em TypeScript, executados direto pelo Node (`node scripts/<nome>.ts`):

- `copy-assets.ts`: copia a ajuda (`src/help`) para `out/src/help`; roda dentro de `npm run build:main`.
- `create-icon.ts`: gera `build/app.ico`.
- `build-help-index.ts`: valida os tópicos de ajuda e gera o índice JSON.
