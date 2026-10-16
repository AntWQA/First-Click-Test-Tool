import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const here = path.dirname(fileURLToPath(import.meta.url));

// The participant edition of the shell (set up and run by the participant alone). One JS and one CSS file with the font inlined; scripts/build-single.mjs
// folds them, and the prototype document, into one HTML file.
export default defineConfig({
  root: here,
  cacheDir: path.join(here, ".vite-cache"),
  plugins: [react()],
  define: { __SELF_RUN__: "true" },
  build: {
    outDir: "dist-participant",
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: { input: path.join(here, "participant.html"), output: { inlineDynamicImports: true } },
  },
});
