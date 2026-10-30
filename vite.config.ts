import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
export default defineConfig({ plugins: [react()], root: "src/ui/app", base: "./", build: { outDir: resolve(".vite-renderer"), emptyOutDir: true } });
