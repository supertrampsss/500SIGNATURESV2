import type { Territoire } from "./donnees.ts";
import { formater } from "./echelle.ts";
import { nomPays } from "./pays-noms.ts";

/** Quatre grands voisins continentaux : assez pour situer la France sans
 * transformer chaque carte en tableau. Un pays sans la valeur du même
 * exercice disparaît ; aucune donnée ancienne n'est recyclée. */
const VOISINS = ["DE", "BE", "ES", "IT"] as const;

export function comparaisonVoisins(
  pays: Record<string, Territoire> | undefined,
  indicateur: string,
  periode: string,
  unite: string,
): string | undefined {
  if (!pays) return undefined;

  const valeurs = VOISINS.flatMap((code) => {
    const valeur = pays[code]?.series[indicateur]?.[periode];
    return Number.isFinite(valeur)
      ? [`${nomPays(code)} ${formater(valeur, unite, false, indicateur)}`]
      : [];
  });

  // Une valeur isolée n'est pas une comparaison européenne.
  if (valeurs.length < 2) return undefined;
  return `Voisins européens — ${valeurs.join(" · ")}.`;
}
