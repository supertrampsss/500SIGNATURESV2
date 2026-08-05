/**
 * Aperçu de la couche affichée, à la place du panneau vide.
 *
 * « Choisissez un territoire » n'apprend rien à qui vient de charger la page.
 * Tant qu'aucun territoire n'est sélectionné, le panneau montre ce que la carte
 * dit déjà : combien de territoires portent une valeur, où se situe la moitié
 * d'entre eux, et les deux extrêmes — nommés, parce qu'un extrême anonyme
 * n'apprend rien non plus.
 *
 * Aucune moyenne : sur des distributions aussi dissymétriques que des budgets
 * communaux, elle serait tirée par quelques très grandes villes. La médiane et
 * les quartiles décrivent la masse, ce qui est l'objet d'un aperçu.
 */

import type { Indicateur } from "./donnees.ts";
import { formater } from "./echelle.ts";

export type Extreme = { code: string; nom: string; valeur: number };
export type Apercu = {
  effectif: number;
  q1: number;
  mediane: number;
  q3: number;
  bas: Extreme;
  haut: Extreme;
};

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** `null` quand la couche est trop maigre pour qu'un aperçu veuille dire quelque chose. */
export function resumer(
  valeurs: Record<string, number>,
  noms: Record<string, string>,
  minimum = 5,
): Apercu | null {
  const points = Object.entries(valeurs)
    .filter(([, v]) => Number.isFinite(v))
    .sort(([, a], [, b]) => a - b);
  if (points.length < minimum) return null;
  const quantile = (part: number) => points[Math.min(points.length - 1, Math.floor(part * points.length))][1];
  const extreme = ([code, valeur]: [string, number]): Extreme => ({
    code,
    nom: noms[code] ?? code,
    valeur,
  });
  return {
    effectif: points.length,
    q1: quantile(0.25),
    mediane: quantile(0.5),
    q3: quantile(0.75),
    bas: extreme(points[0]),
    haut: extreme(points[points.length - 1]),
  };
}

const NIVEAUX: Record<string, string> = {
  commune: "communes",
  departement: "départements",
  region: "régions",
};

/** Rendu pur, sans DOM : c'est lui qui est testé.
 *
 *  Volontairement court : une phrase de médiane. Les extrêmes vivent dans le
 *  palmarès juste en dessous — les répéter ici faisait deux blocs pour la
 *  même information, et le lecteur ne savait plus où regarder. */
export function rendu(
  apercu: Apercu | null,
  indicateur: Indicateur,
  niveau: string,
  periode: string,
  parHabitant: boolean,
  /** Somme de la couche, quand l'indicateur s'additionne : le niveau national
   *  manquait à l'écran — on lisait la dispersion sans jamais voir le total
   *  France. Une médiane ou un taux ne s'additionnent pas : rien n'est affiché
   *  dans ce cas plutôt qu'un nombre faux. */
  totalNational?: number,
): string {
  if (!apercu) {
    return `<p class="fiche__vide">Choisissez un territoire sur la carte ou par la recherche.</p>`;
  }
  const montant = (valeur: number) => formater(valeur, indicateur.unite, parHabitant);
  const national =
    totalNational !== undefined && Number.isFinite(totalNational)
      ? `<p class="apercu__national"><span>France entière</span>
         <strong>${formater(totalNational, indicateur.unite, false)}</strong></p>`
      : "";
  return `
    <h2 class="fiche__titre">${echapper(indicateur.libelle)}</h2>
    <p class="fiche__meta">${apercu.effectif.toLocaleString("fr-FR")} ${
      echapper(NIVEAUX[niveau] ?? niveau)
    } avec une valeur · ${echapper(periode)}${parHabitant ? " · par habitant" : ""}</p>
    ${national}
    <p class="apercu__mediane">Médiane : <strong>${montant(apercu.mediane)}</strong></p>
    <p class="apercu__masse">La moitié se situe entre ${montant(apercu.q1)} et ${montant(
      apercu.q3,
    )}. Aucune moyenne : elle serait tirée par les plus grands territoires.</p>`;
}
