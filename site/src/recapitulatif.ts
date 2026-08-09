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

import { formater } from "./echelle.ts";
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

function euros(montant: number): string {
  return formater(montant, "EUR", false);
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
