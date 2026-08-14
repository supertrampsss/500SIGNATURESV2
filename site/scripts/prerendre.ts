/**
 * Le pré-rendu : une page réelle par analyse, lisible sans JavaScript.
 *
 * `rendu()` et `renduIndex()` (analyse-rendu.ts) sont des fonctions pures :
 * elles prennent une analyse et rendent une chaîne. Ce script n'est qu'un
 * appelant de plus, exécuté après `vite build` plutôt que dans le navigateur —
 * c'est tout ce que le pré-rendu ajoute, sans framework (docs/superpowers,
 * spec « L'arbitre rejouable », §7.1).
 *
 * Exécuté par `node --experimental-strip-types`, PAS par Vite : `import.meta.env`
 * (que Vite injecte au build) n'existe pas ici, donc `src/donnees.ts` — qui le
 * lit à son sommet — ne peut pas être importé comme module d'exécution. Seuls
 * ses types le sont ; les fichiers publiés sont lus ici avec un client `fetch`
 * minimal, à la même URL de base.
 *
 * Réseau indisponible pendant le build : le script ÉCHOUE plutôt que de
 * produire des pages sans catalogue ou sans liens vérifiés. Un build qui
 * publierait des pages en silence, sans avoir pu valider leurs liens de
 * simulateur, serait pire qu'un build qui s'arrête (voir plus bas,
 * `validerLiensSimulateur`).
 */

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { rendu, renduIndex, type Analyse } from "../src/analyse-rendu.ts";
import { decoder, type Volet, type VoletBareme, type EtatAtelier } from "../src/atelier.ts";
import { indexer, type Budget } from "../src/simulateur.ts";
import { exercicesPublies } from "../src/simulateur-rendu.ts";
import { appliquer as appliquerBareme, MODELES as MODELES_BAREME, type Bareme } from "../src/bareme.ts";
import { BRANCHES, fusionnerBranches, ECHELONS } from "../src/simulateur-volets.ts";
import { echapper } from "../src/texte.ts";
import type { Indicateur, Jeu, Manifeste } from "../src/donnees.ts";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE_SITE = path.resolve(ICI, "..");
const DIST = path.join(RACINE_SITE, "dist");
const DOSSIER_ANALYSES = path.join(RACINE_SITE, "analyses");

/** Même valeur de repli que `src/donnees.ts` — dupliquée, pas importée : voir
 *  l'en-tête du fichier. */
const BASE = process.env.VITE_DONNEES_URL ?? "https://pub-fc39d357004540a182a907aed4875ef5.r2.dev";

async function lireJson<T>(url: string): Promise<T> {
  let reponse: Response;
  try {
    reponse = await fetch(url);
  } catch (cause) {
    const racine = cause instanceof Error && cause.cause instanceof Error ? cause.cause : cause;
    const detail = racine instanceof Error ? racine.message : String(racine);
    throw new Error(`${url} injoignable : ${detail}`);
  }
  if (!reponse.ok) throw new Error(`${url} indisponible (${reponse.status})`);
  return (await reponse.json()) as T;
}

/* --------------------------------------------------------------------------
 * Les volets du simulateur, construits à la demande — seulement pour les
 * budgets qu'une analyse référence réellement dans son `simulateur.budget`.
 * ----------------------------------------------------------------------- */

// BRANCHES, DIT_LA_BRANCHE et fusionnerBranches viennent de
// simulateur-volets.ts, importés plus haut : ce script ne peut pas importer
// `main.ts` lui-même (il charge MapLibre et appelle `demarrer()` au
// chargement du module, ce qui suppose un DOM), mais il construit désormais
// les mêmes volets que l'atelier interactif, avec le même code.

/** Vrai si la clé est un échelon de collectivités connu — ce qui la rend
 *  indexable dans `ECHELONS` sans passer par un `as`. */
function estEchelon(cle: string): cle is keyof typeof ECHELONS {
  return cle in ECHELONS;
}

/** Le dernier exercice publié d'un volet, ou une erreur qui nomme le volet en cause. */
function dernierExercice(indexBrut: unknown, cle: string): string {
  const trouve = exercicesPublies(indexBrut).sort().reverse()[0];
  if (!trouve) throw new Error(`Aucun exercice publié pour le volet de simulateur "${cle}".`);
  return trouve;
}

/** Construit le volet réel d'une clé, contre les fichiers publiés. Lève pour
 *  toute clé que le simulateur ne connaît pas — un lien qui la référence ne
 *  peut de toute façon ouvrir aucun réglage. */
async function construireVolet(cle: string, racineDonnees: string): Promise<Volet> {
  const lire = <T>(chemin: string) => lireJson<T>(`${racineDonnees}/${chemin}`);

  if (cle === "etat") {
    const exercice = dernierExercice(await lire("simulateur/index.json"), cle);
    const budget = await lire<Budget>(`simulateur/etat-${exercice}.json`);
    return { genre: "budget", cle, nom: "État", budget, index: indexer(budget) };
  }

  if (cle === "secu") {
    const exercice = dernierExercice(await lire("simulateur/index-secu.json"), cle);
    const [consolide, ...branches] = await Promise.all([
      lire<Budget>(`simulateur/secu-${exercice}.json`),
      ...BRANCHES.map(([branche]) => lire<Budget>(`simulateur/branche-${branche}-${exercice}.json`)),
    ]);
    const fusionne = fusionnerBranches(
      consolide,
      BRANCHES.map(([cleBranche, nom], rang) => [cleBranche, nom, branches[rang]!] as [string, string, Budget]),
    );
    return { genre: "budget", cle, nom: "Sécurité sociale", budget: fusionne, index: indexer(fusionne) };
  }

  if (cle === "bareme") {
    const exercice = dernierExercice(await lire("simulateur/index-bareme.json"), cle);
    const bareme = await lire<Bareme>(`simulateur/bareme-${exercice}.json`);
    const volet: VoletBareme = {
      genre: "bareme",
      cle,
      nom: "Impôt sur le revenu",
      bareme,
      depart: appliquerBareme(bareme, MODELES_BAREME[0]),
      pilote: { volet: "etat", code: "r1101" },
    };
    return volet;
  }

  if (cle.startsWith("collectivites-")) {
    const echelon = cle.slice("collectivites-".length);
    if (!estEchelon(echelon)) throw new Error(`Échelon de collectivité inconnu : "${echelon}".`);
    const budget = await lire<Budget>(`simulateur/collectivites-${echelon}.json`);
    return { genre: "budget", cle, nom: ECHELONS[echelon], budget, index: indexer(budget) };
  }

  throw new Error(`Volet de simulateur inconnu : "${cle}".`);
}

/** Les clés de volet qu'une chaîne encodée référence — même syntaxe que
 *  `decoder()` (atelier.ts) : `<volet>/<code>:<valeur>`, jointes par `,`. */
function clesReferencees(budget: string): string[] {
  const cles = new Set<string>();
  for (const morceau of budget.split(",")) {
    const barre = morceau.indexOf("/");
    if (barre > 0) cles.add(morceau.slice(0, barre));
  }
  return [...cles];
}

/** Vrai si l'état décodé ouvre au moins un réglage — un budget touché, ou une
 *  tranche de barème qui s'écarte de son départ. Un lien qui décode vers un
 *  état vide n'ouvrirait rien : un bouton « Rejouer » mort. */
function ouvreUnReglage(etat: EtatAtelier, volets: readonly Volet[]): boolean {
  for (const table of etat.budgets.values()) {
    if (table.size > 0) return true;
  }
  for (const [cle, taux] of etat.baremes) {
    const volet = volets.find((v): v is VoletBareme => v.genre === "bareme" && v.cle === cle);
    if (!volet) continue;
    for (const [borne, valeur] of taux) {
      if ((volet.depart.get(borne) ?? 0) !== valeur) return true;
    }
  }
  return false;
}

/**
 * Valide chaque lien de simulateur déclaré par une analyse contre le vrai
 * `decoder()`, chargé avec les fichiers publiés. Un lien qui décode vers
 * aucun réglage fait échouer le build — un bouton « Rejouer » qui n'ouvre
 * rien est pire que pas de bouton.
 */
async function validerLiensSimulateur(analyses: readonly Analyse[], racineDonnees: string): Promise<void> {
  const aValider = analyses
    .map((analyse) => ({ analyse, budget: analyse.simulateur.budget }))
    .filter((x) => x.budget !== "");
  if (!aValider.length) return;

  const cles = new Set<string>();
  for (const { budget } of aValider) for (const cle of clesReferencees(budget)) cles.add(cle);

  const volets = await Promise.all([...cles].map((cle) => construireVolet(cle, racineDonnees)));

  for (const { analyse, budget } of aValider) {
    const etat = decoder(budget, volets);
    if (!ouvreUnReglage(etat, volets)) {
      throw new Error(
        `L'analyse "${analyse.slug}" porte un lien de simulateur qui n'ouvre aucun réglage ` +
          `(simulateur.budget = "${budget}").`,
      );
    }
  }
}

/* --------------------------------------------------------------------------
 * Le gabarit : le shell construit par Vite, réutilisé pour chaque page.
 * ----------------------------------------------------------------------- */

type Page = { titre: string; description: string; canonique: string; corps: string };

/**
 * Injecte une page dans le shell. `echapper` (texte.ts) échappe `&<>"'` — donc
 * valable aussi bien en contenu de texte (le `<title>`) qu'en valeur
 * d'attribut entre guillemets doubles (`content="…"`, `href="…"`) : les deux
 * contextes sont couverts par le même échappement, jamais par une
 * concaténation brute.
 */
function injecter(shell: string, page: Page): string {
  // Remplaçants sous forme de fonction partout, jamais de chaîne : passée en
  // second argument de `replace`, une chaîne de remplacement interprète `$&`,
  // `$1`, `$$`… comme des motifs spéciaux — un titre ou une phrase de verdict
  // qui contiendrait un `$` littéral corromprait alors la page injectée.
  let html = shell;

  html = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${echapper(page.titre)}</title>`);

  html = html.replace(
    /<meta\s+name="description"[\s\S]*?\/>/,
    () => `<meta name="description" content="${echapper(page.description)}" />`,
  );

  html = html.replace(
    "</head>",
    () => `  <link rel="canonical" href="${echapper(page.canonique)}" />\n  </head>`,
  );

  html = html.replace(
    /<body([^>]*)>/,
    (_correspondance, attributs: string) => `<body${attributs} data-page="editorial">`,
  );

  html = html.replace(
    /(<main id="contenu">)[\s\S]*?(<\/main>)/,
    (_correspondance, ouverture: string, fermeture: string) => `${ouverture}\n${page.corps}\n${fermeture}`,
  );

  return html;
}

/* --------------------------------------------------------------------------
 * Le programme.
 * ----------------------------------------------------------------------- */

async function chargerAnalyses(): Promise<Analyse[]> {
  const fichiers = (await readdir(DOSSIER_ANALYSES)).filter((f) => f.endsWith(".json"));
  return Promise.all(
    fichiers.map(async (fichier) => {
      const brut = await readFile(path.join(DOSSIER_ANALYSES, fichier), "utf8");
      return JSON.parse(brut) as Analyse;
    }),
  );
}

async function chargerPublication(): Promise<{ catalogue: Indicateur[]; jeux: Jeu[]; racineDonnees: string }> {
  const { version } = await lireJson<{ version: string }>(`${BASE}/data/derniere.json`);
  const racineDonnees = `${BASE}/data/${version}`;
  const [catalogue, manifeste] = await Promise.all([
    lireJson<Indicateur[]>(`${racineDonnees}/indicateurs.json`),
    lireJson<Manifeste>(`${racineDonnees}/manifeste.json`),
  ]);
  return { catalogue, jeux: manifeste.jeux, racineDonnees };
}

async function ecrirePage(dossier: string, html: string): Promise<void> {
  await mkdir(dossier, { recursive: true });
  await writeFile(path.join(dossier, "index.html"), html, "utf8");
}

async function main(): Promise<void> {
  const shell = await readFile(path.join(DIST, "index.html"), "utf8");
  const analyses = await chargerAnalyses();
  const { catalogue, jeux, racineDonnees } = await chargerPublication();

  await validerLiensSimulateur(analyses, racineDonnees);

  for (const analyse of analyses) {
    const page: Page = {
      titre: analyse.titre,
      description: analyse.verdict.phrase,
      canonique: `/analyses/${analyse.slug}/`,
      corps: rendu(analyse, catalogue, jeux),
    };
    await ecrirePage(path.join(DIST, "analyses", analyse.slug), injecter(shell, page));
  }

  const pageIndex: Page = {
    titre: "Analyses — Où va l'argent public",
    description: "Un chiffre couramment cité, opposé au chiffre publié : le verdict, le détail, la preuve.",
    canonique: "/analyses/",
    corps: renduIndex(analyses),
  };
  await ecrirePage(path.join(DIST, "analyses"), injecter(shell, pageIndex));

  console.log(`Pré-rendu : ${analyses.length} analyse(s), dist/analyses/index.html.`);
}

main().catch((erreur: unknown) => {
  console.error(erreur instanceof Error ? erreur.message : String(erreur));
  process.exit(1);
});
