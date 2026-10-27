import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { emptyLiveCatalogue } from "./vite.proto.config.ts";

const here = path.dirname(fileURLToPath(import.meta.url));

// The participant edition of the shell (set up and run by the participant alone). One JS and one CSS file with the font inlined; scripts/build-single.mjs
// folds them, and the prototype document, into one HTML file.
// The dev server also serves /proto.html (the prototype the shell frames), so it needs the prototype's own plugin and router setting; the build does not.
export default defineConfig(({ command }) => ({
  root: here,
  cacheDir: path.join(here, ".vite-cache"),
  plugins: command === "serve" ? [react(), emptyLiveCatalogue()] : [react()],
  define: command === "serve" ? { __SELF_RUN__: "true", "import.meta.env.VITE_ROUTER": JSON.stringify("memory") } : { __SELF_RUN__: "true" },
  build: {
    outDir: "dist-participant",
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: { input: path.join(here, "participant.html"), output: { inlineDynamicImports: true } },
  },
}));
