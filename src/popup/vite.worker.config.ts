import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: "./src/extension/background.ts",
      fileName: () => "background.js",
      formats: ["iife"],
      name: "ProjetVoltaireCheatBackground",
    },
    outDir: "../../dist",
  },
});
