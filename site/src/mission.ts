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
 * Sans contrainte, l'exercice se termine en trois clics et n'apprend rien.
 *
 * **Un contrat verrouille, il n'avertit pas.** Une règle qu'on peut enfreindre
 * sans conséquence n'est pas une règle : c'est un pense-bête. Signer « sans
 * toucher à l'école » grise ces lignes et le bouton refuse. Il faut trouver les
 * 160 Md€ ailleurs.
 *
 * **Le verrou a un sens.** « Sans lever un seul impôt » interdit la hausse et
 * laisse la baisse : on doit pouvoir alléger un impôt sous ce contrat. Un
 * verrou aveugle interdirait les deux et rendrait le contrat absurde.
 *
 * **Ils se cumulent.** On n'a aucune raison d'en signer un seul : quatre
 * contraintes en même temps, c'est l'exercice intéressant.
 *
 * **Et ils portent sur ce qui bouge, pas sur ce qu'on clique.** Le barème se
 * verrouille tranche par tranche : une flat tax à 30 % baisse les tranches
 * hautes et lève les basses, et seules les secondes sont refusées. Juger sur le
 * rendement agrégé aurait dit « vous levez un impôt » à qui en baisse la moitié.
 */

import { reglagesEffectifs, type EtatAtelier, type Volet, type VoletBudget } from "./atelier.ts";
import { PREFIXE_RECETTE, totaux, type Entree } from "./simulateur.ts";

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

/**
 * Les paliers de la mission.
 *
 * Un compteur qui descend de 160 028 M€ ne récompense rien avant l'arrivée, et
 * l'arrivée est très loin. Quatre marches donnent une prise : la première est
 * franchie en deux gestes, la dernière est la mission.
 *
 * Les seuils sont ronds et arbitraires, et c'est très bien : ce sont des
 * marches, pas des mesures. Le dernier ne l'est pas — c'est l'équilibre.
 */
export const PALIERS: { nom: string; seuil: number }[] = [
  { nom: "10 Md€", seuil: 10e9 },
  { nom: "50 Md€", seuil: 50e9 },
  { nom: "100 Md€", seuil: 100e9 },
  { nom: "L'équilibre", seuil: Infinity },
];

/** Les paliers, et lesquels sont franchis. Le dernier l'est quand il ne reste
 *  plus rien à trouver, pas quand on a comblé un montant. */
export function paliers(
  volets: readonly Volet[],
  etat: EtatAtelier,
): { nom: string; franchi: boolean }[] {
  const reste = resteATrouver(volets, etat);
  const comble = aTrouverAuDepart(volets) - reste;
  return PALIERS.map(({ nom, seuil }) => ({
    nom,
    franchi: Number.isFinite(seuil) ? comble >= seuil : reste === 0,
  }));
}

/* --------------------------------------------------------------------------
 * La contrainte
 * ----------------------------------------------------------------------- */

/** Ce qu'un contrat interdit sur une ligne. */
export type Sens = "aucun" | "hausse" | "baisse" | "tout";

export type Contrat = {
  cle: string;
  /** L'intitulé de la pastille. */
  nom: string;
  /** Ce qu'il interdit, en une ligne, sous les pastilles signées. */
  interdit: string;
  /** Le verrou qu'il pose sur une ligne de budget. */
  surLaLigne(volet: VoletBudget, entree: Entree): Sens;
  /** Le verrou qu'il pose sur une tranche de barème. Le barème n'est pas une
   *  ligne de budget : il n'a ni côté, ni signe, seulement un taux. */
  surLaTranche?(): Sens;
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
    interdit: "L'enseignement, l'université, la santé et l'assurance maladie sont verrouillés.",
    surLaLigne: (volet, entree) =>
      entree.cote === "depense" &&
      (entree.code.startsWith("maladie:") ||
        ECOLE_ET_SANTE.test(`${entree.libelle} ${entree.chemin}`))
        ? "tout"
        : "aucun",
  },
  {
    cle: "sans-impot",
    nom: "Sans lever un seul impôt",
    interdit: "Aucune recette ne peut monter. Les baisser reste permis.",
    // Un prélèvement sur recettes se déduit : le baisser ne lève rien. Le signe
    // le distingue, pas l'intitulé.
    surLaLigne: (_volet, entree) =>
      entree.cote === "recette" && entree.signe > 0 ? "hausse" : "aucun",
    surLaTranche: () => "hausse",
  },
  {
    cle: "sans-prestation",
    nom: "Sans baisser une seule prestation",
    interdit: "Les prestations, allocations et pensions ne peuvent pas baisser.",
    surLaLigne: (_volet, entree) =>
      entree.cote === "depense" && PRESTATION.test(`${entree.libelle} ${entree.chemin}`)
        ? "baisse"
        : "aucun",
  },
  {
    cle: "sans-collectivites",
    nom: "Sans faire payer les collectivités",
    interdit:
      "Ni coupe dans les prélèvements de l'État à leur profit, ni baisse de leurs recettes.",
    surLaLigne: (volet, entree) => {
      // Un prélèvement se déduit : le réduire, c'est mettre un pourcentage
      // négatif, et c'est cette baisse-là qui prive les collectivités.
      if (volet.cle === "etat" && entree.code.startsWith("r31")) return "baisse";
      if (volet.cle.startsWith("collectivites-") && entree.cote === "recette") return "baisse";
      return "aucun";
    },
  },
];

/** Les contrats signés, dans l'ordre de la liste. Une clé inconnue ne signe
 *  rien plutôt que de signer le premier venu. */
export function contratsDe(cles: readonly string[]): Contrat[] {
  return CONTRATS.filter((c) => cles.includes(c.cle));
}

/** Le verrou le plus fort de tous les contrats signés. */
export function fusionner(sens: readonly Sens[]): Sens {
  if (sens.includes("tout")) return "tout";
  const hausse = sens.includes("hausse");
  const baisse = sens.includes("baisse");
  if (hausse && baisse) return "tout";
  if (hausse) return "hausse";
  if (baisse) return "baisse";
  return "aucun";
}

/**
 * Les lignes verrouillées d'un budget, et par quoi.
 *
 * La ligne d'élimination des transferts entre branches y est toujours : elle
 * n'est pas un poste, c'est la soustraction qui rend le total exact. La régler
 * ferait apparaître 19 019 M€ venus de nulle part.
 */
export function verrous(
  volet: VoletBudget,
  contrats: readonly Contrat[],
  codeStructurel: string,
): Map<string, { sens: Sens; par: string }> {
  const table = new Map<string, { sens: Sens; par: string }>();
  for (const entree of volet.index.values()) {
    if (entree.code === codeStructurel || entree.code === `${PREFIXE_RECETTE}${codeStructurel}`) {
      table.set(entree.code, { sens: "tout", par: "la comptabilité" });
      continue;
    }
    const poses = contrats
      .map((c) => [c, c.surLaLigne(volet, entree)] as const)
      .filter(([, sens]) => sens !== "aucun");
    if (!poses.length) continue;
    table.set(entree.code, {
      sens: fusionner(poses.map(([, sens]) => sens)),
      par: poses[0]![0].nom,
    });
  }
  return table;
}

/** Le verrou que les contrats signés posent sur les tranches du barème. */
export function verrouDuBareme(contrats: readonly Contrat[]): { sens: Sens; par: string } | null {
  const poses = contrats
    .map((c) => [c, c.surLaTranche?.() ?? "aucun"] as const)
    .filter(([, sens]) => sens !== "aucun");
  if (!poses.length) return null;
  return { sens: fusionner(poses.map(([, sens]) => sens)), par: poses[0]![0].nom };
}

/** Vrai si ce mouvement-là est permis. */
export function permis(sens: Sens, avant: number, apres: number): boolean {
  if (sens === "tout") return apres === avant;
  if (sens === "hausse") return apres <= avant;
  if (sens === "baisse") return apres >= avant;
  return true;
}
