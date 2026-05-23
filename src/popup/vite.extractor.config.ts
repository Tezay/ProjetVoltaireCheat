import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: "./src/extension/extractor-main.ts",
      fileName: () => "extractor.js",
      formats: ["iife"],
      name: "ProjetVoltaireCheatExtractor",
    },
    outDir: "../../dist",
  },
});
