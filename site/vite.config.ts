import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  // Vite extracts shared CSS before entry CSS. The approved theme must remain
  // last in every generated document, just as it is in the source imports.
  plugins: [{
    name: "shared-design-last",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const links = [...html.matchAll(/<link\b[^>]*href="[^\"]*\/shared-design-[^\"]+\.css"[^>]*>/g)].map(match => match[0]);
        if (!links.length) return html;
        for (const link of links) html = html.replace(link, "");
        return html.replace("</head>", `${links.join("\n")}\n</head>`);
      },
    },
  }],
  server: { host: "0.0.0.0", allowedHosts: ["terminal.local"] },
  build: { rollupOptions: { input: {
    salaires: fileURLToPath(new URL("./salaires/index.html", import.meta.url)),
    principal: fileURLToPath(new URL("./index.html", import.meta.url)),
    hiver: fileURLToPath(new URL("./mandats/france/hiver/index.html", import.meta.url)),
    mandats: fileURLToPath(new URL("./mandats/index.html", import.meta.url)),
    methodeMandats: fileURLToPath(new URL("./mandats/methode/index.html", import.meta.url)),
  } } },
});
