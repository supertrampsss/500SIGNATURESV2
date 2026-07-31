/**
 * Échelle de couleurs. Règle du produit (docs/04) : aucune couleur porteuse de
 * jugement — pas de rouge « mauvais », pas de vert « bon ». Une seule teinte,
 * du clair au foncé, qui dit « peu » et « beaucoup », rien d'autre.
 *
 * Les classes sont des quantiles : elles répartissent les territoires en parts
 * égales, ce qui évite qu'une poignée de valeurs extrêmes écrase toute la carte.
 * Les bornes sont affichées ; sans elles, une carte choroplèthe est un argument
 * caché.
 */

export const PALETTE = [
  "#eef3f8",
  "#cfe0ee",
  "#a9c8e0",
  "#7fadd0",
  "#548fbd",
  "#2f6fa6",
  "#1b4f77",
];

export type Echelle = { bornes: number[]; couleurs: string[] };

export function quantiles(valeurs: number[], classes = PALETTE.length): Echelle {
  const tri = valeurs.filter(Number.isFinite).sort((a, b) => a - b);
  if (tri.length === 0) return { bornes: [], couleurs: [] };
  const bornes: number[] = [];
  for (let i = 1; i < classes; i += 1) {
    bornes.push(tri[Math.floor((i / classes) * tri.length)]);
  }
  return { bornes, couleurs: PALETTE.slice(0, classes) };
}

/** Expression MapLibre : couleur d'un territoire selon sa valeur jointe. */
export function expressionCouleur(
  valeurs: Record<string, number>,
  echelle: Echelle,
  parHabitant: boolean,
  populations: Record<string, number>,
): unknown {
  const paires: unknown[] = [];
  for (const [code, brut] of Object.entries(valeurs)) {
    const population = populations[code];
    if (parHabitant && !population) continue; // pas de dénominateur, pas de ratio
    const valeur = parHabitant ? brut / population : brut;
    let index = echelle.bornes.findIndex((borne) => valeur < borne);
    if (index === -1) index = echelle.couleurs.length - 1;
    paires.push(code, echelle.couleurs[index]);
  }
  // « Donnée non disponible » se voit : gris neutre, jamais la couleur du zéro.
  return paires.length
    ? ["match", ["get", "code"], ...paires, "#d9d9d9"]
    : "#d9d9d9";
}

export function formater(valeur: number, unite: string, parHabitant: boolean): string {
  if (unite === "count") {
    return new Intl.NumberFormat("fr-FR").format(Math.round(valeur));
  }
  const options: Intl.NumberFormatOptions = {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: parHabitant ? 0 : 0,
  };
  if (!parHabitant && Math.abs(valeur) >= 1e6) {
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
      valeur / 1e6,
    )} M€`;
  }
  return new Intl.NumberFormat("fr-FR", options).format(valeur);
}
