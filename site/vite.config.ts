import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  server: { host: "0.0.0.0", allowedHosts: ["terminal.local"] },
  build: { rollupOptions: { input: {
    salaires: fileURLToPath(new URL("./salaires/index.html", import.meta.url)),
    principal: fileURLToPath(new URL("./index.html", import.meta.url)),
    hiver: fileURLToPath(new URL("./mandats/france/hiver/index.html", import.meta.url)),
    mandats: fileURLToPath(new URL("./mandats/index.html", import.meta.url)),
    methodeMandats: fileURLToPath(new URL("./mandats/methode/index.html", import.meta.url)),
  } } },
});
