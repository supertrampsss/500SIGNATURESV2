/**
 * L'atelier : tous les budgets sur une seule page, un seul plan, un seul total.
 *
 * Le simulateur montrait un budget à la fois, choisi dans une barre de
 * pastilles. On ne peut pas se prendre pour le premier ministre en réglant
 * l'État sans voir la Sécurité sociale, ni décider des retraites sans savoir ce
 * qu'on vient de faire à l'impôt sur le revenu. Les budgets se suivent
 * maintenant dans une même page, et les gestes s'additionnent en un total.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUI S'ADDITIONNE ET CE QUI NE S'ADDITIONNE PAS
 * ─────────────────────────────────────────────────────────────────────────
 *
 * **Les budgets ne s'additionnent pas.** Le budget général de l'État porte
 * 594 036 M€ de crédits, les régimes de base 676 925 M€ de charges, et les deux
 * ne font pas 1 271 Md€ : entre eux circulent des transferts que chacun compte
 * de son côté — 8 049 M€ reçus de l'État, 6 900 M€ de cotisations prises en
 * charge par l'État, 91 352 M€ de recettes fiscales affectées. Ce module
 * n'écrit donc **aucun total de dépense publique**, et n'expose aucune fonction
 * qui en produirait un.
 *
 * **Les gestes, eux, s'additionnent.** Un geste est un écart : couper 10 000 M€
 * ici et lever 5 000 M€ là font 15 000 M€ d'effort, et cette somme est exacte
 * parce qu'un écart ne porte aucun périmètre. C'est le seul total que l'atelier
 * calcule, et il s'appelle « votre effort », jamais « le solde ».
 *
 * **Un transfert reste le piège.** Couper de 10 000 M€ ce que l'État verse à la
 * Sécurité sociale améliore le solde de l'État de 10 000 et dégrade celui de la
 * Sécurité sociale d'autant — mais seulement si l'on règle aussi la ligne d'en
 * face, ce que l'atelier ne fait pas à la place du lecteur. `transferts()`
 * nomme les gestes concernés pour que l'écran le dise, plutôt que d'ajuster en
 * douce une ligne que personne n'a touchée.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * UN JEU DE RÉGLAGES PAR VOLET
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Les nomenclatures ne se sont jamais parlé : « 146 » est un programme de la
 * Défense et « D-PRE » un poste de la Sécurité sociale, mais rien ne garantit
 * qu'un code de l'État ne se retrouve pas à l'identique chez les collectivités.
 * Chaque volet garde donc **sa propre table de réglages**, ce qui rend la
 * collision impossible par construction plutôt que par convention de nommage.
 */

import {
  ecartAuReel,
  plan as planDuBudget,
  chercher as chercherDansIndex,
  type Budget,
  type Entree,
  type Index,
  type LignePlan,
  type Reglages,
} from "./simulateur.ts";
import { rendement, type Bareme, type Taux } from "./bareme.ts";

/** Un budget réglable : l'État, une branche, un échelon de collectivités. */
export type VoletBudget = {
  genre: "budget";
  cle: string;
  /** Ce que le titre de section annonce : « Le budget de l'État ». */
  nom: string;
  budget: Budget;
  index: Index;
};

/**
 * Un barème réglable tranche par tranche.
 *
 * Ce n'est pas un budget — ni dépenses, ni recettes, ni solde — mais il produit
 * un écart en euros comme les autres, et c'est à ce titre qu'il entre dans le
 * total. L'assiette simulée est le revenu fiscal de référence du foyer : le
 * niveau ne se compare pas ligne à ligne à l'impôt réellement émis, l'écart si.
 */
export type VoletBareme = {
  genre: "bareme";
  cle: string;
  nom: string;
  bareme: Bareme;
  /**
   * Le barème en vigueur, celui d'où l'on part.
   *
   * La contribution d'un volet est **ce que le lecteur change**, pas l'écart
   * entre le modèle et la réalité. Mesurée contre l'impôt réellement émis, elle
   * vaudrait −91 719 M€ avant le moindre geste : le simulateur n'applique ni
   * quotient familial, ni décote, ni réductions, et cet écart-là est celui de la
   * méthode, pas d'une décision. Mesurée contre le barème de départ, elle vaut
   * zéro tant qu'on n'a touché à rien.
   */
  depart: Taux;
};

export type Volet = VoletBudget | VoletBareme;

/** L'état de l'atelier : une table de réglages par volet, jamais une seule. */
export type EtatAtelier = {
  budgets: Map<string, Reglages>;
  baremes: Map<string, Taux>;
};

export function etatVide(): EtatAtelier {
  return { budgets: new Map(), baremes: new Map() };
}

/** Les réglages d'un volet, créés à la demande. */
export function reglagesDe(etat: EtatAtelier, volet: VoletBudget): Reglages {
  let table = etat.budgets.get(volet.cle);
  if (!table) {
    table = new Map();
    etat.budgets.set(volet.cle, table);
  }
  return table;
}

/** Les taux réglés d'un barème, initialisés au barème en vigueur : un écran de
 *  départ à zéro ne rapporterait rien et n'apprendrait rien. */
export function tauxDe(etat: EtatAtelier, volet: VoletBareme): Taux {
  let table = etat.baremes.get(volet.cle);
  if (!table) {
    table = new Map(volet.depart);
    etat.baremes.set(volet.cle, table);
  }
  return table;
}

/** Ce qu'un volet apporte au total, en euros. Positif : le solde s'améliore. */
export function contribution(volet: Volet, etat: EtatAtelier): number {
  if (volet.genre === "budget") return ecartAuReel(volet.budget, reglagesDe(etat, volet));
  const taux = etat.baremes.get(volet.cle) ?? volet.depart;
  return rendement(volet.bareme, taux) - rendement(volet.bareme, volet.depart);
}

/**
 * **Votre effort**, en euros : la somme des écarts, et rien d'autre.
 *
 * Ce n'est pas un solde. Les soldes votés ne s'additionnent pas ; les écarts,
 * si. Chaque volet garde son propre solde, affiché dans sa section.
 */
export function effort(volets: readonly Volet[], etat: EtatAtelier): number {
  return volets.reduce((somme, volet) => somme + contribution(volet, etat), 0);
}

/** Le nombre de gestes, tous volets confondus. */
export function gestes(volets: readonly Volet[], etat: EtatAtelier): number {
  return volets.reduce(
    (n, volet) =>
      n +
      (volet.genre === "budget"
        ? reglagesDe(etat, volet).size
        : compterTranchesChangees(volet, etat)),
    0,
  );
}

/** Les tranches dont le taux s'écarte du barème en vigueur. Une tranche remise
 *  à sa valeur d'origine n'est pas un geste. */
function compterTranchesChangees(volet: VoletBareme, etat: EtatAtelier): number {
  const taux = tauxDe(etat, volet);
  let n = 0;
  for (const tranche of volet.bareme.tranches) {
    if ((taux.get(tranche.b) ?? 0) !== (volet.depart.get(tranche.b) ?? 0)) n += 1;
  }
  return n;
}

export type LigneAtelier = LignePlan & { volet: VoletBudget };

/** Le plan, tous volets confondus, le geste le plus lourd d'abord. */
export function plan(volets: readonly Volet[], etat: EtatAtelier): LigneAtelier[] {
  return volets
    .flatMap((volet) =>
      volet.genre === "budget"
        ? planDuBudget(volet.index, reglagesDe(etat, volet)).map((ligne) => ({ ...ligne, volet }))
        : [],
    )
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export type TrouveAtelier = { entree: Entree; volet: VoletBudget };

/**
 * La recherche traverse les budgets.
 *
 * Chercher « logement » doit trouver l'aide au logement de l'État *et* les
 * prestations de la branche famille : le lecteur cherche un sujet, pas une
 * nomenclature. Les résultats sont répartis entre volets plutôt que pris dans
 * l'ordre, sans quoi les mille lignes de l'État noieraient les trente de la
 * Sécurité sociale.
 */
export function chercher(
  volets: readonly Volet[],
  requete: string,
  parVolet = 6,
): TrouveAtelier[] {
  return volets.flatMap((volet) =>
    volet.genre === "budget"
      ? chercherDansIndex(volet.index, requete, parVolet).map((entree) => ({ entree, volet }))
      : [],
  );
}

/* --------------------------------------------------------------------------
 * Les transferts entre budgets
 * ----------------------------------------------------------------------- */

/**
 * Les lignes qui ont une contrepartie dans un autre volet.
 *
 * Régler « Prélèvements sur les recettes de l'État au profit des collectivités
 * territoriales » améliore le solde de l'État sans dégrader celui des communes,
 * parce que personne n'a touché la ligne d'en face. Le total reste juste — il
 * additionne des écarts — mais il décrit alors un geste que le lecteur n'a fait
 * qu'à moitié.
 *
 * L'atelier **n'ajuste pas la contrepartie** : ce serait décider à la place du
 * lecteur quelle ligne du budget d'en face encaisse la coupe, et le fichier
 * publié ne le dit pas. Il la nomme, et c'est l'écran qui le dit.
 */
const CONTREPARTIES: Record<string, { volets: string[]; dit: string }> = {
  // État -> collectivités territoriales.
  r3101: { volets: ["collectivites-commune", "collectivites-departement", "collectivites-region"], dit: "les collectivités" },
  r3106: { volets: ["collectivites-commune", "collectivites-departement", "collectivites-region"], dit: "les collectivités" },
  r3145: { volets: ["collectivites-commune", "collectivites-departement", "collectivites-region"], dit: "les collectivités" },
  // Sécurité sociale -> ce qu'elle reçoit de l'État.
  "rR-TRF-ETA": { volets: ["etat"], dit: "le budget de l'État" },
  "rR-COT-ETA": { volets: ["etat"], dit: "le budget de l'État" },
};

export type Transfert = { libelle: string; dit: string; volet: string };

/** Les gestes posés sur une ligne qui a une contrepartie ailleurs. */
export function transferts(volets: readonly Volet[], etat: EtatAtelier): Transfert[] {
  const trouves: Transfert[] = [];
  for (const volet of volets) {
    if (volet.genre !== "budget") continue;
    for (const code of reglagesDe(etat, volet).keys()) {
      const contrepartie = CONTREPARTIES[code];
      if (!contrepartie) continue;
      const entree = volet.index.get(code);
      if (entree) trouves.push({ libelle: entree.libelle, dit: contrepartie.dit, volet: volet.cle });
    }
  }
  return trouves;
}

/* --------------------------------------------------------------------------
 * L'état dans l'adresse
 * ----------------------------------------------------------------------- */

const SEPARATEUR_VOLET = "/";

/**
 * `etat/146:-20,vieillesse/D-PRE:-5,ir/11294:45`
 *
 * La clé du volet précède le code, séparée par une barre oblique : sans elle,
 * deux nomenclatures qui partagent un code régleraient la même ligne dans deux
 * budgets. Les anciens liens, qui ne portaient pas de volet, ne règlent donc
 * plus rien — un lien partagé avant ce changement ouvre un atelier vierge
 * plutôt qu'un budget réglé au hasard.
 */
export function encoder(volets: readonly Volet[], etat: EtatAtelier): string {
  return volets
    .flatMap((volet) => {
      const table =
        volet.genre === "budget" ? reglagesDe(etat, volet) : tauxDe(etat, volet);
      return [...table].map(
        ([code, valeur]) => `${volet.cle}${SEPARATEUR_VOLET}${code}:${valeur}`,
      );
    })
    .join(",");
}

export function decoder(chaine: string, volets: readonly Volet[]): EtatAtelier {
  const etat = etatVide();
  const parCle = new Map(volets.map((volet) => [volet.cle, volet]));
  for (const morceau of chaine.split(",")) {
    const barre = morceau.indexOf(SEPARATEUR_VOLET);
    const separateur = morceau.lastIndexOf(":");
    if (barre < 0 || separateur < barre) continue;
    const volet = parCle.get(morceau.slice(0, barre));
    if (!volet) continue;
    const code = morceau.slice(barre + 1, separateur);
    const valeur = Number(morceau.slice(separateur + 1));
    if (!Number.isFinite(valeur) || valeur === 0) continue;
    if (volet.genre === "budget") {
      if (volet.index.has(code)) reglagesDe(etat, volet).set(code, borner(valeur));
    } else {
      const borne = Number(code);
      if (volet.bareme.tranches.some((t) => t.b === borne)) {
        tauxDe(etat, volet).set(borne, Math.max(0, Math.min(100, valeur)));
      }
    }
  }
  return etat;
}

function borner(valeur: number): number {
  return Math.max(-100, Math.min(100, Math.round(valeur)));
}
