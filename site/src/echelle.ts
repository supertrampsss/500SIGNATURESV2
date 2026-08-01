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

/** Un montant ne se ramène à l'habitant que s'il s'additionne.
 *
 *  Un budget communal divisé par la population donne une dépense par habitant.
 *  Un **niveau de vie médian** divisé par la population ne donne rien : c'est
 *  déjà une valeur par personne, et une médiane ne s'additionne pas. La règle
 *  suit donc la sommabilité déclarée de l'indicateur, pas sa seule unité.
 */
export function parHabitantAUnSens(indicateur: {
  unite: string;
  sommable?: boolean;
}): boolean {
  return indicateur.unite === "EUR" && indicateur.sommable !== false;
}

/** Typographie française du pourcentage, définie une fois : espace fine
 *  insécable avant le signe, virgule décimale, et surtout **pas**
 *  `style: "percent"` — les valeurs publiées sont déjà en points de
 *  pourcentage, le multiplier par cent les rendrait absurdes. */
export function pourcentage(valeur: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(valeur)} %`;
}

/** La note sous la légende dit ce que sont les nombres qu'on vient de lire.
 *
 *  Elle était écrite en dur — « Montants en euros courants » — et s'affichait
 *  donc aussi sous une échelle de taux de pauvreté. Une légende qui se trompe
 *  d'unité est pire qu'une légende absente : elle affirme. */
export function noteEchelle(unite: string, parHabitant: boolean): string {
  const classes = "Classes de valeurs égales en nombre de territoires.";
  if (parHabitant) return `${classes} Dénominateur : population de référence OFGL.`;
  if (unite === "percent") {
    return `${classes} Taux en pourcentage : ils ne s'additionnent pas et ne se ramènent pas à l'habitant.`;
  }
  if (unite === "count") return `${classes} Effectifs, en nombre d'unités.`;
  return `${classes} Montants en euros courants.`;
}

export function formater(valeur: number, unite: string, parHabitant: boolean): string {
  if (unite === "count") {
    return new Intl.NumberFormat("fr-FR").format(Math.round(valeur));
  }
  // Un taux n'est pas une somme d'argent. Sans cette branche, tout ce qui
  // n'était pas un effectif tombait dans le chemin devise : un taux de pauvreté
  // de 51 % s'affichait « 51 € », légende comprise. C'est l'erreur que ce site
  // existe pour ne pas commettre.
  //
  // Les valeurs sont déjà exprimées en pourcentage (12,4 vaut 12,4 %), donc pas
  // de `style: "percent"`, qui multiplierait par cent. Espace fine insécable
  // avant le signe, comme le veut l'usage français.
  if (unite === "percent") {
    return pourcentage(valeur);
  }
  const options: Intl.NumberFormatOptions = {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: parHabitant ? 0 : 0,
  };
  // Un budget d'État se lit en milliards, un budget communal en millions :
  // « 441 194,3 M€ » est exact et illisible.
  if (!parHabitant && Math.abs(valeur) >= 1e9) {
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
      valeur / 1e9,
    )} Md€`;
  }
  if (!parHabitant && Math.abs(valeur) >= 1e6) {
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
      valeur / 1e6,
    )} M€`;
  }
  return new Intl.NumberFormat("fr-FR", options).format(valeur);
}
