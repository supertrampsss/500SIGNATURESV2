/**
 * Pré-rendu : écrit le récit et la page Salaires avec les données publiées au moment du build,
 * pour que les pages se lisent sans JavaScript et que les moteurs voient le texte.
 * Le build échoue si la publication est injoignable : mieux vaut ne pas publier qu'un site vide.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Territoire } from "../src/donnees.ts";
import { renduRecit } from "../src/recit/rendu.ts";
import { renduSalaires } from "../src/salaires.ts";
import { contenuAdsTxt, injecterAdsense } from "./adsense.ts";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const BASE = process.env.VITE_DONNEES_URL ?? "https://pub-fc39d357004540a182a907aed4875ef5.r2.dev";
const SITE = (process.env.SITE_URL ?? "https://500signatures.fr").replace(/\/$/, "");
const PAGES = ["/", "/salaires/", "/mandats/", "/confidentialite/"];

async function lireJson<T>(url: string): Promise<T> {
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`${url} indisponible (${reponse.status})`);
  return (await reponse.json()) as T;
}

/** Remplace un repère unique ; échoue s'il manque, pour ne jamais publier une page vide. */
export function remplacer(html: string, repere: string, contenu: string): string {
  if (html.split(repere).length !== 2) throw new Error(`Repère ${repere} absent ou dupliqué.`);
  return html.replace(repere, () => contenu);
}

/** Service hors connexion de Mandats, demandé par le joueur : la page, ses fichiers et ses illustrations. */
async function ecrireHorsLigne() {
  const html = await readFile(path.join(DIST, "mandats", "index.html"), "utf8");
  const code = (await Promise.all([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map(m => readFile(path.join(DIST, m[1]), "utf8")))).join("\n");
  const fichiers = new Set(["/mandats/", ...[...(html + code).matchAll(/["'(](\/(?:assets|mandats\/art|mandats\/fonts|polices|brand)\/[^"')\s]+)/g)].map(m => m[1])]);
  for (const css of [...html.matchAll(/href="(\/assets\/[^"]+\.css)"/g)].map(m => m[1])) {
    for (const m of (await readFile(path.join(DIST, css), "utf8")).matchAll(/url\(["']?(\/[^"')]+)/g)) fichiers.add(m[1]);
  }
  const liste = [...fichiers].sort();
  const cle = createHash("sha256").update(liste.join("\n") + html).digest("hex").slice(0, 16);
  const sw = `const CLE="mandats-${cle}";const FICHIERS=${JSON.stringify(liste)};
self.addEventListener("install",e=>e.waitUntil(caches.open(CLE).then(c=>c.addAll(FICHIERS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith("mandats-")&&x!==CLE).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);if(e.request.method!=="GET"||u.origin!==location.origin)return;const page=u.pathname==="/mandats/"||u.pathname==="/mandats/index.html";
e.respondWith(page?fetch(e.request).then(r=>{const c=r.clone();caches.open(CLE).then(x=>x.put("/mandats/",c));return r;}).catch(()=>caches.match("/mandats/")):caches.match(e.request).then(r=>r||fetch(e.request)));});
`;
  await writeFile(path.join(DIST, "mandats", "sw.js"), sw, "utf8");
  console.log(`Mandats hors connexion : ${liste.length} ressources, version ${cle}.`);
}

async function principal() {
  const { version } = await lireJson<{ version: string }>(`${BASE}/data/derniere.json`);
  const pays = await lireJson<Record<string, Territoire>>(`${BASE}/data/${version}/territoires/pays/tous.json`);
  const adsense = process.env.ADSENSE_PUBLISHER_ID;

  const index = path.join(DIST, "index.html");
  const recit = renduRecit(pays);
  if (!recit.includes("etape__gros")) throw new Error("Le récit pré-rendu ne porte aucun chiffre : publication incomplète.");
  await writeFile(index, injecterAdsense(remplacer(await readFile(index, "utf8"), "<!--recit-->", recit), adsense), "utf8");

  const salaires = path.join(DIST, "salaires", "index.html");
  await writeFile(salaires, remplacer(await readFile(salaires, "utf8"), '<main id="contenu"></main>', `<main id="contenu">${renduSalaires(pays.FR?.series)}</main>`), "utf8");

  await ecrireHorsLigne();

  const ads = contenuAdsTxt(adsense);
  if (ads) await writeFile(path.join(DIST, "ads.txt"), ads, "utf8");
  await writeFile(path.join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PAGES.map(p => `  <url><loc>${SITE}${p}</loc></url>`).join("\n")}\n</urlset>\n`, "utf8");
  await writeFile(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`, "utf8");
  console.log(`Pré-rendu : récit et salaires écrits (publication ${version}), ${PAGES.length} pages au plan du site.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await principal();
