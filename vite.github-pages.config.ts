import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const pagesBase = process.env.GITHUB_PAGES_BASE_PATH
  ?? (repositoryName ? `/${repositoryName}/` : "/");

export default defineConfig({
  root: path.resolve("github-pages"),
  base: pagesBase,
  publicDir: path.resolve("public"),
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve("."),
    },
  },
  build: {
    outDir: path.resolve("dist-pages"),
    emptyOutDir: true,
  },
});
