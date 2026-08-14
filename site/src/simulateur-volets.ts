/**
 * Ce que les deux appelants du simulateur — l'atelier interactif (`main.ts`)
 * et le pré-rendu (`scripts/prerendre.ts`) — doivent construire à l'identique
 * pour ouvrir les mêmes volets. Module sans DOM : `scripts/prerendre.ts` ne
 * peut pas importer `main.ts` (il charge MapLibre et appelle `demarrer()` au
 * chargement du module, ce qui suppose un navigateur), et dupliquer cette
 * logique à la main avait déjà divergé au moment où le second exemplaire a été
 * écrit — deux champs manquaient au pré-rendu sans qu'aucun test ne le voie.
 * Il n'y a donc plus qu'un exemplaire.
 */

import { CODE_ELIMINATION, type Budget, type Noeud } from "./simulateur.ts";

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
