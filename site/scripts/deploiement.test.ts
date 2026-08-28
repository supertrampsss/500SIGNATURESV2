/**
 * Le déploiement compile-t-il vraiment la fonction d'aperçu ?
 *
 * C'est le mode d'échec le plus dangereux du lot : `wrangler pages deploy`
 * cherche le répertoire `functions` **relativement au répertoire courant** de
 * l'étape. Publié depuis la racine du dépôt, il ne verrait jamais
 * `site/functions/` — et une fonction absente se manifeste EXACTEMENT comme
 * une fonction présente qui rend les métadonnées génériques : le déploiement
 * réussit, le site marche, les liens partagés n'ont pas d'aperçu propre, et
 * rien ne rougit nulle part.
 *
 * Un commentaire dans le workflow ne tient pas cette garantie ; ce fichier la
 * tient. Il lit le workflow réel, en extrait le répertoire d'où part la
 * publication, et vérifie que `functions/` s'y trouve. Déplacer l'étape hors
 * de `site/`, renommer le répertoire ou publier un autre chemin fait échouer
 * la suite avant que le déploiement ne parte.
 */

import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE_SITE = path.resolve(ICI, "..");
const RACINE_DEPOT = path.resolve(RACINE_SITE, "..");
const WORKFLOW = path.join(RACINE_DEPOT, ".github", "workflows", "deploy.yml");

test("le domaine public canonique est 500signatures.fr", async () => {
  const workflow = await readFile(WORKFLOW, "utf8");
  assert.match(workflow, /SITE_URL:\s*https:\/\/500signatures\.fr/);
  assert.doesNotMatch(workflow, /SITE_URL:\s*https:\/\/plateforme-9sz\.pages\.dev/);
});

/** Une étape du workflow : son bloc de texte, tel que le fichier l'écrit. */
type Etape = { bloc: string; repertoire: string; commande: string };

/**
 * Les étapes du workflow, découpées sur le tiret de liste.
 *
 * Pas d'analyseur YAML : le dépôt n'en embarque aucun, et cette lecture-ci ne
 * porte que sur deux clés d'une liste plate. Ce qu'elle ne sait pas lire, elle
 * ne le rend pas — et une étape introuvable fait échouer l'assertion plutôt
 * que passer en silence.
 */
async function etapes(): Promise<Etape[]> {
  const texte = (await readFile(WORKFLOW, "utf8")).replace(/\r\n/g, "\n");
  return texte
    .split(/^ {6}- /m)
    .slice(1)
    .map((bloc) => ({
      bloc,
      // Sans `working-directory`, une étape s'exécute à la racine du dépôt :
      // c'est le défaut de GitHub Actions, et c'est le piège de cette tâche.
      repertoire: bloc.match(/^ {8}working-directory: *(\S+)/m)?.[1] ?? ".",
      commande: bloc.match(/^ {8}run: *\|?\n?([\s\S]*?)(?=\n {8}\w[\w-]*:|$)/m)?.[1] ?? "",
    }));
}

/** L'étape qui publie sur Cloudflare Pages, reconnue à sa commande — pas à son
 *  nom, qui se réécrit sans rien changer au déploiement. */
async function etapePublication(): Promise<Etape> {
  const trouvee = (await etapes()).find(
    (etape) => /wrangler/.test(etape.commande) && /pages\s+deploy/.test(etape.commande),
  );
  assert.ok(trouvee, "aucune étape de `wrangler pages deploy` dans deploy.yml");
  return trouvee;
}

test("la publication part du répertoire qui porte les fonctions d'edge", async () => {
  const etape = await etapePublication();
  const depuis = path.resolve(RACINE_DEPOT, etape.repertoire);
  const fonctions = path.join(depuis, "functions");
  try {
    await access(fonctions);
  } catch {
    throw new Error(
      `deploy.yml publie depuis « ${etape.repertoire} », où ${fonctions} n'existe pas : ` +
        "wrangler cherche `functions` relativement au répertoire courant, et la fonction " +
        "d'aperçu partirait sans bruit.",
    );
  }
  assert.equal(depuis, RACINE_SITE, "les fonctions du site vivent sous site/functions");
});

test("la fonction d'aperçu est bien dans ce répertoire-là", async () => {
  const etape = await etapePublication();
  const depuis = path.resolve(RACINE_DEPOT, etape.repertoire);
  await access(path.join(depuis, "functions", "simulateur", "_middleware.ts"));
});

test("la publication porte le répertoire que le build écrit", async () => {
  const etape = await etapePublication();
  const chemin = etape.commande.match(/pages\s+deploy\s+(\S+)/)?.[1];
  assert.ok(chemin, "la commande de publication ne nomme aucun répertoire");
  assert.equal(
    path.resolve(RACINE_DEPOT, etape.repertoire, chemin),
    path.join(RACINE_SITE, "dist"),
    "le répertoire publié n'est pas celui que `npm run build` écrit",
  );
});

test("le build compile ce que le déploiement enverra", async () => {
  // Une fonction que `tsc` ne regarde pas est une fonction dont les erreurs
  // n'apparaissent qu'à l'edge, sur un aperçu resté générique.
  const paquet = JSON.parse(
    await readFile(path.join(RACINE_SITE, "package.json"), "utf8"),
  ) as { scripts: Record<string, string> };
  assert.match(paquet.scripts.build, /tsconfig\.functions\.json/);
});
