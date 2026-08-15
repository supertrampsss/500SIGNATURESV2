/**
 * comparaison.ts — aligner deux ou trois états de l'atelier, ligne à ligne.
 *
 * Un lecteur pose son propre budget à côté d'un lien qu'on lui a envoyé, ou
 * d'une analyse publiée : ce module ne fait que ça, aligner les lignes que
 * chaque état touche et rendre leur écart en euros. Il ne rend aucun HTML, ne
 * formate aucun montant — c'est le travail de l'écran, pas du sien — et il ne
 * fait pas non plus la somme des colonnes : les budgets ne s'additionnent
 * pas, seul l'écart s'additionne, et `atelier.ts` le calcule déjà.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'ALIGNEMENT SE FAIT SUR (VOLET, CODE), JAMAIS LE LIBELLÉ NI LE CODE SEUL
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Les nomenclatures ne se sont jamais parlé : `D-PRE` est la ligne des
 * prestations dans *chaque* branche de la Sécurité sociale, et un index par
 * code seul fusionnerait la vieillesse et la famille en une seule rangée.
 * C'est la raison pour laquelle `atelier.ts` garde une table de réglages par
 * volet ; ce module respecte la même règle pour les aligner.
 */

import { plan, type EtatAtelier, type Volet } from "./atelier.ts";

/**
 * Une colonne du tableau comparé : un état de l'atelier, nommé, avec son
 * effort et son nombre de gestes déjà calculés par `effort()` et `gestes()`
 * d'`atelier.ts`. Ce module ne les recalcule pas.
 */
export type Colonne = { nom: string; etat: EtatAtelier; effort: number; gestes: number };

/**
 * Une ligne alignée entre colonnes.
 *
 * `cellules[i]` est l'écart en euros que la colonne `i` pose sur cette ligne,
 * ou `null` si cette colonne ne la touche pas. « Non réglé » et « réglé à
 * zéro » sont deux décisions différentes du lecteur ; les confondre en `0`
 * ferait mentir le tableau sur ce que chacun a choisi.
 */
export type LigneComparee = {
  volet: string;
  code: string;
  libelle: string;
  base: number;
  cellules: (number | null)[];
};

/**
 * Aligne les lignes touchées par au moins une colonne, la plus lourde
 * d'abord.
 *
 * Chaque colonne fournit son propre plan via `plan()` d'`atelier.ts` — rien
 * n'est recalculé ici. Une colonne qui ne règle rien ne contribue aucune
 * ligne ; l'état neutre (aucun réglage) en est le cas le plus fréquent.
 */
export function comparer(volets: readonly Volet[], colonnes: Colonne[]): LigneComparee[] {
  const lignes = new Map<string, LigneComparee>();

  colonnes.forEach((colonne, i) => {
    for (const ligne of plan(volets, colonne.etat)) {
      const cle = `${ligne.volet.cle}/${ligne.entree.code}`;
      let comparee = lignes.get(cle);
      if (!comparee) {
        comparee = {
          volet: ligne.volet.cle,
          code: ligne.entree.code,
          libelle: ligne.entree.libelle,
          base: ligne.entree.base,
          cellules: new Array<number | null>(colonnes.length).fill(null),
        };
        lignes.set(cle, comparee);
      }
      comparee.cellules[i] = ligne.delta;
    }
  });

  return [...lignes.values()].sort((a, b) => plusGrandEcart(b) - plusGrandEcart(a));
}

/** Le plus gros écart absolu de la ligne, toutes colonnes confondues — c'est
 *  lui qui décide de sa place dans le tri. */
function plusGrandEcart(ligne: LigneComparee): number {
  return Math.max(...ligne.cellules.map((c) => Math.abs(c ?? 0)));
}
