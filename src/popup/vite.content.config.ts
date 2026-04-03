import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: "./src/extension/content.ts",
      fileName: () => "content.js",
      formats: ["iife"],
      name: "ProjetVoltaireCheatContent",
    },
    outDir: "../../dist",
  },
});
