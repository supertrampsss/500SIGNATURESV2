/**
 * Ce que les trois appelants du simulateur — l'atelier interactif (`main.ts`),
 * le pré-rendu (`scripts/prerendre.ts`) et la fonction d'aperçu
 * (`functions/simulateur/_middleware.ts`) — doivent construire à l'identique
 * pour ouvrir les mêmes volets. Module sans DOM : `scripts/prerendre.ts` ne
 * peut pas importer `main.ts` (il charge MapLibre et appelle `demarrer()` au
 * chargement du module, ce qui suppose un navigateur), et dupliquer cette
 * logique à la main avait déjà divergé au moment où le second exemplaire a été
 * écrit — deux champs manquaient au pré-rendu sans qu'aucun test ne le voie.
 * Il n'y a donc plus qu'un exemplaire.
 *
 * Sans DOM **et sans système de fichiers** : la fonction d'aperçu tourne dans
 * un travailleur d'edge, qui n'a ni l'un ni l'autre. Les fichiers publiés y
 * entrent par un lecteur passé en paramètre (`LirePublie`), jamais par un
 * `fetch` écrit ici — c'est ce qui rend `construireVolet` appelable des trois
 * côtés sans que chacun réécrive la nomenclature.
 */

import { appliquer as appliquerBareme, MODELES as MODELES_BAREME, type Bareme } from "./bareme.ts";
import { exercicesPublies } from "./simulateur-format.ts";
import { indexer, CODE_ELIMINATION, type Budget, type Noeud } from "./simulateur.ts";
import type { Volet, VoletBareme } from "./atelier.ts";

/**
 * Les cinq branches des régimes de base, dans l'ordre où on en débat, et ce que
 * chacune paie.
 *
 * Le mot « branche » ne sort pas à l'écran : c'est le vocabulaire du code de la
 * Sécurité sociale, pas celui du lecteur. « Le budget de la branche vieillesse
 * (retraites), poste par poste » demandait de savoir avant de lire ; « Retraites »
 * se lit.
 */
export const BRANCHES = [
  ["vieillesse", "Retraites", "Les pensions du régime général"],
  ["maladie", "Maladie", "Soins de ville, hôpital, indemnités journalières"],
  ["famille", "Famille", "Allocations familiales, garde d'enfant, rentrée scolaire"],
  ["autonomie", "Autonomie", "Grand âge et handicap : EHPAD, APA, PCH"],
  ["atmp", "Accidents du travail", "Accidents et maladies professionnelles"],
] as const;

/** Ce que chaque branche paie, en une clause. « Autonomie » ne dit rien seul. */
export const DIT_LA_BRANCHE: Record<string, string> = Object.fromEntries(
  BRANCHES.map(([cle, , dit]) => [cle, dit]),
);

/**
 * Les cinq branches, en un seul budget.
 *
 * Cinq sections pour un même ensemble, c'est la nomenclature du code de la
 * Sécurité sociale posée à l'écran telle quelle. Il n'y en a plus qu'une, et
 * les branches en sont le premier niveau.
 *
 * **Leur somme n'est pas le budget de la Sécurité sociale.** Elles s'échangent
 * 19 019 M€ que l'une compte en charge et l'autre en produit : additionnées
 * telles quelles, elles annoncent 695 944 M€ de charges quand le consolidé
 * publié en dit 676 925. L'écart entre les deux entre donc dans l'arbre, en
 * ligne visible et verrouillée, des deux côtés. Les soldes, eux, se somment
 * exactement — c'est ce qui rend l'opération licite.
 *
 * Les codes sont préfixés par branche : les cinq fichiers emploient les mêmes
 * (`D-PRE` est le poste des prestations dans chacun), et un index commun les
 * confondrait.
 */
export function fusionnerBranches(consolide: Budget, branches: [string, string, Budget][]): Budget {
  const prefixer = (cle: string, noeud: Noeud): Noeud => ({
    ...noeud,
    c: `${cle}:${noeud.c}`,
    ...(noeud.enfants ? { enfants: noeud.enfants.map((e: Noeud) => prefixer(cle, e)) } : {}),
  });
  const somme = (budget: Budget) => ({
    depenses: budget.depenses.reduce((s, n) => s + n.v, 0),
    recettes: budget.recettes.reduce(
      (s, g) => s + g.signe * g.lignes.reduce((t, l) => t + l.v, 0),
      0,
    ),
  });
  const totalConsolide = somme(consolide);
  const totalBranches = branches.reduce(
    (acc, [, , b]) => {
      const t = somme(b);
      return { depenses: acc.depenses + t.depenses, recettes: acc.recettes + t.recettes };
    },
    { depenses: 0, recettes: 0 },
  );
  const elimineDepense = totalBranches.depenses - totalConsolide.depenses;
  const elimineRecette = totalBranches.recettes - totalConsolide.recettes;
  const dit = "Transferts entre branches, comptés deux fois (se déduit)";
  return {
    ...consolide,
    depenses: [
      ...branches.map(([cle, nom, budget]) => ({
        c: cle,
        l: nom,
        v: somme(budget).depenses,
        d: DIT_LA_BRANCHE[cle],
        enfants: budget.depenses.map((n) => prefixer(cle, n)),
      })),
      { c: CODE_ELIMINATION, l: dit, v: -elimineDepense },
    ],
    // Les recettes de chaque branche restent groupées comme son fichier les
    // groupe, et le groupe devient une ligne dépliable : à plat, les cinq
    // branches posaient soixante-cinq lignes de recettes d'un coup.
    recettes: [
      ...branches.map(([cle, nom, budget]) => ({
        t: nom,
        signe: 1,
        lignes: budget.recettes.map((g) => ({
          c: `${cle}:groupe:${g.t}`,
          l: g.t,
          v: g.signe * g.lignes.reduce((t, l) => t + l.v, 0),
          enfants: g.lignes.map((l) => prefixer(cle, g.signe < 0 ? { ...l, v: -l.v } : l)),
        })),
      })),
      {
        t: "Transferts entre branches",
        signe: -1,
        lignes: [{ c: CODE_ELIMINATION, l: dit, v: elimineRecette }],
      },
    ],
  };
}

/** Le nom de section de chaque échelon de collectivités. */
export const ECHELONS = { commune: "Communes", departement: "Départements", region: "Régions" } as const;

/* --------------------------------------------------------------------------
 * Les volets, construits contre les fichiers publiés.
 * ----------------------------------------------------------------------- */

/**
 * L'entrepôt des fichiers publiés, quand rien ne le remplace.
 *
 * `src/donnees.ts` porte la même adresse pour le navigateur, où elle se lit
 * dans `import.meta.env` — que Vite injecte au build et qui n'existe ni sous
 * Node ni dans un travailleur d'edge. Les deux ne peuvent donc pas partager la
 * ligne ; un test (`apercu-scenario.test.ts`) constate qu'elles portent la même
 * valeur, faute de quoi l'aperçu d'un scénario décrirait un autre entrepôt que
 * celui que le lecteur ouvrira.
 */
export const BASE_DONNEES = "https://pub-fc39d357004540a182a907aed4875ef5.r2.dev";

/**
 * Lit un fichier publié, par son chemin sous la racine de la publication
 * (« simulateur/etat-2025.json »).
 *
 * Un paramètre, pas un `fetch` en dur : le pré-rendu lit sous Node, l'aperçu
 * sous un travailleur d'edge qui met en cache, et un test lit des fixtures. Ce
 * qu'ils partagent, c'est la nomenclature — pas le transport.
 */
export type LirePublie = <T>(chemin: string) => Promise<T>;

/**
 * Les volets du simulateur, dans l'ordre où l'atelier les monte.
 *
 * Trois échelons de collectivités, jamais une quatrième entrée qui les
 * résumerait : une part de ce que départements et régions dépensent est
 * reversée aux communes (`main.ts`, `VOLETS_PUBLIES`).
 */
export const CLES_VOLETS = [
  "etat",
  "secu",
  "bareme",
  "collectivites-commune",
  "collectivites-departement",
  "collectivites-region",
] as const;

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
export async function construireVolet(cle: string, lire: LirePublie): Promise<Volet> {
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
      BRANCHES.map(
        ([cleBranche, nom], rang) => [cleBranche, nom, branches[rang]!] as [string, string, Budget],
      ),
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
      // La ligne 1101 des recettes fiscales de l'État, que ce barème calcule.
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

/**
 * **Tous** les volets, jamais seulement ceux que l'adresse nomme.
 *
 * Un geste posé sur un prélèvement sur recettes de l'État retire autant aux
 * trois échelons de collectivités (`PASSAGES`, atelier.ts), et cette
 * contrepartie entre dans la somme des écarts comme dans le plan. Ne charger
 * que les volets référencés annoncerait donc un effort que le lecteur ne verra
 * pas à l'écran — précisément la divergence qu'un aperçu ne doit pas produire.
 */
export function construireVolets(lire: LirePublie): Promise<Volet[]> {
  return Promise.all(CLES_VOLETS.map((cle) => construireVolet(cle, lire)));
}
