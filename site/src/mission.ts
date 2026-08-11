/**
 * La mission, et le contrat qu'on signe avant d'y toucher.
 *
 * Le simulateur savait calculer, il ne savait pas jouer : on pouvait couper la
 * charge de la dette de 100 % et repartir. Trois choses manquaient — un but,
 * une contrainte, et de savoir qui paie. Ce module porte les deux premières.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE BUT : L'ÉQUILIBRE DE CHACUN, PAS UNE SOMME DE SOLDES
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Les budgets ne s'additionnent pas — c'est la règle du module `atelier`, et
 * elle tient ici aussi. Ce qui s'additionne, c'est **ce qu'il reste à trouver
 * dans chacun** : neuf déficits mesurés chacun dans son propre périmètre, dont
 * la somme ne prétend à rien d'autre qu'à un compteur de mission.
 *
 * Un budget en excédent ne comble pas le déficit d'un autre. La branche famille
 * dégage 731 M€ ; ils ne paient pas les 12 510 M€ de la branche maladie, parce
 * que rien dans le droit ne les y verse. La mission, c'est l'équilibre de
 * chacun, et le compteur ne compte donc que les déficits.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA CONTRAINTE : UN CONTRAT QU'ON SIGNE D'ABORD
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Sans contrainte, l'exercice se termine en trois clics et n'apprend rien. Un
 * contrat interdit une famille de gestes, et il faut atteindre l'équilibre
 * quand même. Il se vérifie sur les réglages **effectifs** : lever une tranche
 * du barème brise « sans lever un seul impôt » parce que la ligne d'impôt sur
 * le revenu de l'État monte, et couper la dotation globale brise « sans faire
 * payer les collectivités » parce que leurs concours baissent. Un contrat qui
 * ne verrait que les clics se contournerait par la ligne d'en face.
 */

import { reglagesEffectifs, type EtatAtelier, type Volet, type VoletBudget } from "./atelier.ts";
import { impact, totaux, type Entree } from "./simulateur.ts";

/* --------------------------------------------------------------------------
 * Le but
 * ----------------------------------------------------------------------- */

/** Les volets qui ont un solde : un barème n'en a pas. */
function budgets(volets: readonly Volet[]): VoletBudget[] {
  return volets.filter((v): v is VoletBudget => v.genre === "budget");
}

/**
 * Ce qu'il reste à trouver pour que chaque budget soit à l'équilibre.
 *
 * Les excédents ne comptent pas : `max(0, −solde)`. Voir l'en-tête.
 */
export function resteATrouver(volets: readonly Volet[], etat: EtatAtelier): number {
  return budgets(volets).reduce((somme, volet) => {
    const solde = totaux(volet.budget, reglagesEffectifs(volet, etat, volets)).solde;
    return somme + Math.max(0, -solde);
  }, 0);
}

/** Le même compteur avant le premier geste : c'est l'échelle de la mission. */
export function aTrouverAuDepart(volets: readonly Volet[]): number {
  return budgets(volets).reduce(
    (somme, volet) => somme + Math.max(0, -totaux(volet.budget, new Map()).solde),
    0,
  );
}

/** Les budgets déjà à l'équilibre, et leur nombre total. */
export function budgetsTenus(
  volets: readonly Volet[],
  etat: EtatAtelier,
): { tenus: number; total: number } {
  const liste = budgets(volets);
  const tenus = liste.filter(
    (volet) => totaux(volet.budget, reglagesEffectifs(volet, etat, volets)).solde >= 0,
  ).length;
  return { tenus, total: liste.length };
}

/* --------------------------------------------------------------------------
 * La contrainte
 * ----------------------------------------------------------------------- */

/** Ce qu'un geste a fait qui rompt le contrat, nommé. */
export type Rupture = {
  volet: string;
  nomVolet: string;
  libelle: string;
  pourcentage: number;
};

export type Contrat = {
  cle: string;
  /** L'intitulé de la pastille. */
  nom: string;
  /** Ce qu'il interdit, en une ligne, sous la pastille choisie. */
  interdit: string;
  /** Vrai si ce mouvement-là le rompt. */
  rompuPar(volet: VoletBudget, entree: Entree, delta: number): boolean;
};

/** Les masses que « l'école et la santé » désigne, à l'État comme à la Sécu. */
const ECOLE_ET_SANTE = /enseignement|scolaire|université|universitaire|santé|hôpital|hospitali/i;
const PRESTATION = /prestation|allocation|minim(a|um) social|pension|retraite/i;

/**
 * Quatre contrats, et rien de plus.
 *
 * Chacun se vérifie sur la nomenclature publiée, jamais sur une opinion : le
 * chapitre 31 des recettes de l'État est celui des prélèvements au profit des
 * collectivités, le côté d'une ligne dit si elle dépense ou encaisse, et le
 * signe d'une ligne de recette dit si elle s'ajoute ou se déduit.
 */
export const CONTRATS: Contrat[] = [
  {
    cle: "ecole-sante",
    nom: "Sans toucher à l'école ni à la santé",
    interdit: "Aucune baisse sur l'enseignement, l'université, la santé, ni sur la branche maladie.",
    rompuPar: (volet, entree, delta) =>
      entree.cote === "depense" &&
      delta < 0 &&
      (volet.cle === "branche-maladie" ||
        ECOLE_ET_SANTE.test(`${entree.libelle} ${entree.chemin}`)),
  },
  {
    cle: "sans-impot",
    nom: "Sans lever un seul impôt",
    interdit: "Aucune recette en hausse, barème de l'impôt sur le revenu compris.",
    // Un prélèvement sur recettes se déduit : le baisser fait monter son delta
    // sans lever quoi que ce soit. Le signe le distingue, pas l'intitulé.
    rompuPar: (_volet, entree, delta) =>
      entree.cote === "recette" && entree.signe > 0 && delta > 0,
  },
  {
    cle: "sans-prestation",
    nom: "Sans baisser une seule prestation",
    interdit: "Aucune baisse sur les prestations, allocations et pensions.",
    rompuPar: (_volet, entree, delta) =>
      entree.cote === "depense" && delta < 0 && PRESTATION.test(`${entree.libelle} ${entree.chemin}`),
  },
  {
    cle: "sans-collectivites",
    nom: "Sans faire payer les collectivités",
    interdit:
      "Aucune coupe dans les prélèvements de l'État à leur profit, aucune de leurs recettes en baisse.",
    rompuPar: (volet, entree, delta) =>
      (volet.cle === "etat" && entree.code.startsWith("r31") && delta > 0) ||
      (volet.cle.startsWith("collectivites-") && entree.cote === "recette" && delta < 0),
  },
];

export function contratDe(cle: string | null): Contrat | null {
  return CONTRATS.find((c) => c.cle === cle) ?? null;
}

/**
 * Ce qui rompt le contrat, dans l'ordre où ça pèse.
 *
 * Toutes les ruptures, pas la première : l'écran en montre une, mais il doit
 * pouvoir dire combien il y en a. Une ligne pilotée depuis un autre volet
 * compte comme les autres — c'est tout l'intérêt de lire les réglages
 * effectifs.
 */
export function ruptures(
  contrat: Contrat | null,
  volets: readonly Volet[],
  etat: EtatAtelier,
): Rupture[] {
  if (!contrat) return [];
  const trouvees: { rupture: Rupture; poids: number }[] = [];
  for (const volet of budgets(volets)) {
    const reglages = reglagesEffectifs(volet, etat, volets);
    for (const [code, pourcentage] of reglages) {
      const entree = volet.index.get(code);
      if (!entree) continue;
      const { delta } = impact(entree, reglages);
      if (!contrat.rompuPar(volet, entree, delta)) continue;
      trouvees.push({
        rupture: {
          volet: volet.cle,
          nomVolet: volet.nom,
          libelle: entree.libelle,
          pourcentage,
        },
        poids: Math.abs(delta),
      });
    }
  }
  return trouvees.sort((a, b) => b.poids - a.poids).map((t) => t.rupture);
}
