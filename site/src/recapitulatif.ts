/**
 * Le récapitulatif en comptabilité nationale : le seul endroit du site où
 * l'État, la Sécurité sociale et les collectivités ont le droit d'être
 * additionnés.
 *
 * Ce module ne calcule rien — pas même la somme des trois lignes. Le
 * rapprochement est fait au dépôt, à partir de quatre séries des comptes
 * nationaux de l'INSEE, et l'écart entre la somme des sous-secteurs et le total
 * publié voyage avec le fichier. L'afficher plutôt que le taire est ce qui
 * distingue « ils se somment » d'une affirmation : ici l'écart vaut zéro, et on
 * le montre.
 *
 * Cet écran existe pour dire une chose que le reste du simulateur ne peut pas
 * dire : les budgets qu'on règle à côté ne s'ajoutent pas les uns aux autres.
 * Il n'a donc pas de réglage — rien à y toucher, tout à y lire.
 */

import { moins } from "./echelle.ts";
import { echapper } from "./texte.ts";

export type LigneRecapitulatif = { c: string; l: string; v: number };

export type Recapitulatif = {
  exercice: string;
  titre: string;
  cadre: string;
  note: string;
  lignes: LigneRecapitulatif[];
  total: LigneRecapitulatif;
  /** Somme des sous-secteurs moins le total publié. Zéro attendu. */
  ecart: number;
};

/**
 * Une décimale, contre la règle générale — parce qu'ici la somme EST l'argument.
 *
 * `millions()` n'en met aucune au-delà du milliard, et les quatre montants de
 * ce tableau la dépassent. Or les trois sous-secteurs arrondissaient tous vers
 * le haut : −130 254,6 / −6 722,5 / −15 554,9 s'affichaient −130 255 / −6 723 /
 * −15 555, dont la somme fait −152 533 quand le total publié dit −152 532. La
 * phrase juste en dessous affirme qu'ils « font exactement le total publié » :
 * elle était vraie des données (`ecart` vaut zéro) et démentie par les chiffres
 * qu'elle commente, sur le seul écran du site dont c'est la raison d'être.
 *
 * La décimale ne vaut que pour ce tableau : ailleurs la règle des M€ tient, et
 * c'est elle qui rend les colonnes comparables. Ici, ce qu'il faut pouvoir
 * comparer, c'est une addition à son résultat.
 */
function euros(montant: number): string {
  return moins(
    `${new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(montant / 1e6)} M€`,
  );
}

/** La phrase de l'écart. Nulle part ailleurs sur le site un contrôle interne ne
 *  s'affiche : ici il est l'argument, pas une coquetterie d'atelier. */
export function mention(recapitulatif: Recapitulatif): string {
  return recapitulatif.ecart === 0
    ? "Les trois sous-secteurs font exactement le total publié : c'est ce que la"
      + " comptabilité nationale garantit, et que les budgets ne garantissent pas."
    : `Les trois sous-secteurs s'écartent de ${euros(
        recapitulatif.ecart,
      )} du total publié.`;
}

export function rendu(recapitulatif: Recapitulatif): string {
  return `<div class="simu__cockpit">
      <div class="simu__titres">
        <h2>${echapper(recapitulatif.titre)}</h2>
        <p class="simu__perimetre">${echapper(recapitulatif.cadre)}</p>
      </div>
    </div>
    <p class="simu__note">${echapper(recapitulatif.note)}</p>
    <div class="simu__arbre">${recapitulatif.lignes
      .map(
        (ligne) => `<div class="simu__ligne recap__ligne">
          <span class="simu__intitule"><span class="simu__lib">${echapper(
            ligne.l,
          )}</span></span>
          <span class="simu__montant nombre">${euros(ligne.v)}</span>
        </div>`,
      )
      .join("")}<div class="simu__ligne recap__ligne recap__total">
        <span class="simu__intitule"><span class="simu__lib">${echapper(
          recapitulatif.total.l,
        )}</span></span>
        <span class="simu__montant nombre">${euros(recapitulatif.total.v)}</span>
      </div></div>
    <p class="simu__note">${echapper(mention(recapitulatif))}</p>`;
}

export function afficherRecapitulatif(bloc: HTMLElement, recapitulatif: Recapitulatif): void {
  bloc.innerHTML = rendu(recapitulatif);
}
