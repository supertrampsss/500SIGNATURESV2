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
  epci: "intercommunalités",
  departement: "départements",
  region: "régions",
};

/** Rendu pur, sans DOM : c'est lui qui est testé. */
export function rendu(
  apercu: Apercu | null,
  indicateur: Indicateur,
  niveau: string,
  periode: string,
  parHabitant: boolean,
): string {
  if (!apercu) {
    return `<p class="fiche__vide">Choisissez un territoire sur la carte ou par la recherche.</p>`;
  }
  const montant = (valeur: number) => formater(valeur, indicateur.unite, parHabitant);
  return `
    <h2 class="fiche__titre">${echapper(indicateur.libelle)}</h2>
    <p class="fiche__meta">${apercu.effectif.toLocaleString("fr-FR")} ${
      echapper(NIVEAUX[niveau] ?? niveau)
    } avec une valeur · ${echapper(periode)}${parHabitant ? " · par habitant" : ""}</p>
    <ul class="quartiles">
      <li><span>Quart le plus bas, en dessous de</span><strong>${montant(apercu.q1)}</strong></li>
      <li><span>Médiane</span><strong>${montant(apercu.mediane)}</strong></li>
      <li><span>Quart le plus haut, au-dessus de</span><strong>${montant(apercu.q3)}</strong></li>
    </ul>
    <dl class="mesures">
      <div class="mesure">
        <dt>Valeur la plus élevée</dt>
        <dd><strong>${montant(apercu.haut.valeur)}</strong>
          <span class="denominateur">${echapper(apercu.haut.nom)}</span></dd>
      </div>
      <div class="mesure">
        <dt>Valeur la plus basse</dt>
        <dd><strong>${montant(apercu.bas.valeur)}</strong>
          <span class="denominateur">${echapper(apercu.bas.nom)}</span></dd>
      </div>
    </dl>
    <p class="avertissement">Aperçu de la couche affichée. Aucune moyenne : sur des
      montants aussi dissymétriques, elle serait tirée par quelques très grands
      territoires. Choisissez un territoire pour sa fiche complète.</p>`;
}
