import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * The duplicated prototype can pull real dōTERRA catalogue data in its original repo. A test tool that is handed to
 * other people must never carry it, so this module is hard-wired to the empty fallback. There is deliberately no path
 * to any live data folder in this config.
 */
function emptyLiveCatalogue(): Plugin {
  const id = "virtual:live-catalogue";
  const resolved = "\0" + id;
  return {
    name: "empty-live-catalogue",
    resolveId(source) { return source === id ? resolved : undefined; },
    load(source) { return source === resolved ? "export const liveCatalogue = null;\nexport const liveImages = {};" : undefined; },
  };
}

// One JS and one CSS file, every font and image inlined, so scripts/build-single.mjs can fold them into one HTML document.
export default defineConfig({
  root: here,
  cacheDir: path.join(here, ".vite-cache"),
  plugins: [react(), emptyLiveCatalogue()],
  define: { "import.meta.env.VITE_ROUTER": JSON.stringify("memory") },
  build: {
    outDir: "dist-proto",
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 100_000,
    rollupOptions: { input: path.join(here, "proto.html"), output: { inlineDynamicImports: true } },
  },
});
