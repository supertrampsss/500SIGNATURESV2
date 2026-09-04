/** Utilitaires partagés par les aperçus de partage et les données du simulateur.
 *
 * Le rendu de l'ancien atelier n'est plus chargé dans l'application. Ces deux
 * fonctions restent utiles au pré-rendu des cartes OG et à la lecture des
 * index de publication, sans réintroduire son écran.
 */

import { formater } from "./echelle.ts";

/** Un montant d'euros, à l'échelle du site : le million, partout. */
export function euros(montant: number): string {
  return formater(montant, "EUR", false);
}

/** Le même montant avec un signe explicite pour un écart. */
export function eurosSigne(montant: number): string {
  return montant > 0 ? `+${euros(montant)}` : euros(montant);
}

/** Les exercices que la publication déclare dans un index JSON. */
export function exercicesPublies(index: unknown): string[] {
  if (!Array.isArray(index)) return [];
  return index.filter((e): e is string => typeof e === "string" && e !== "");
}
