import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const page = (chemin: string) => fileURLToPath(new URL(chemin, import.meta.url));

/** Quatre pages : le récit, Salaires, le jeu Mandats et la confidentialité. */
export default defineConfig({
  server: { host: "0.0.0.0" },
  build: { rollupOptions: { input: {
    recit: page("./index.html"),
    salaires: page("./salaires/index.html"),
    mandats: page("./mandats/index.html"),
    confidentialite: page("./confidentialite/index.html"),
  } } },
});
