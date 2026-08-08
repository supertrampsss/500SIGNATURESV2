/**
 * La couche d'évolution : ce que la carte peint quand elle montre la variation
 * entre les deux derniers millésimes publiés, plutôt que le dernier niveau.
 *
 * Deux règles y font tout :
 *
 * - **La grandeur décide de l'unité de la variation.** Un montant, un effectif,
 *   une énergie, une surface varient en pourcentage de leur valeur précédente.
 *   Un taux varie en **points** : un taux qui passe de 10 % à 12 % gagne
 *   2 points, il ne « monte pas de 20 % » — dire l'un pour l'autre est
 *   exactement le genre de confusion que ce site existe pour éviter.
 *
 * - **Pas de valeur, pas de couleur.** Un territoire absent d'un des deux
 *   millésimes, ou qui partait de zéro (la variation en % serait infinie),
 *   n'entre pas dans la couche : il reste gris, comme toute donnée absente.
 */

import { moins, pourcentage, quantiles, type Echelle } from "./echelle.ts";

export type ModeVariation = "points" | "pourcent";

/** `rate` est l'ancienne unité du taux de participation (voir echelle.ts) :
 *  un taux, donc des points. Les `pour_1000_*` sont des taux aussi — leur
 *  dénominateur fait partie de l'unité. */
export function modeVariation(unite: string): ModeVariation {
  return unite === "percent" || unite === "rate" || unite.startsWith("pour_1000")
    ? "points"
    : "pourcent";
}

export type Evolution = { avant: number; apres: number; variation: number };

/**
 * La couche : un territoire n'y entre que s'il a une valeur finie dans les
 * DEUX millésimes. En %, le dénominateur est |N−1| — une dépense qui passe de
 * −10 à −5 s'est améliorée de 50 %, pas de −50 % — et une valeur de départ
 * nulle ne produit pas d'infini : elle ne produit rien.
 */
export function coucheEvolution(
  avant: Record<string, number>,
  apres: Record<string, number>,
  mode: ModeVariation,
): Record<string, Evolution> {
  const sortie: Record<string, Evolution> = {};
  for (const [code, valeurApres] of Object.entries(apres)) {
    const valeurAvant = avant[code];
    if (valeurAvant === undefined) continue;
    if (!Number.isFinite(valeurAvant) || !Number.isFinite(valeurApres)) continue;
    if (mode === "pourcent") {
      if (valeurAvant === 0) continue;
      sortie[code] = {
        avant: valeurAvant,
        apres: valeurApres,
        variation: ((valeurApres - valeurAvant) / Math.abs(valeurAvant)) * 100,
      };
    } else {
      sortie[code] = { avant: valeurAvant, apres: valeurApres, variation: valeurApres - valeurAvant };
    }
  }
  return sortie;
}

/** Rampe des baisses : des orangés, du plus foncé (forte baisse) au plus
 *  clair. Pas de rouge « mauvais » ni de vert « bon » (règle d'echelle.ts) :
 *  une baisse de dépenses n'est ni une faute ni une vertu, l'orange et le
 *  bleu disent seulement « de quel côté de zéro ». */
export const RAMPE_BAISSE = ["#b35806", "#e08214", "#fdb863"];
/** Rampe des hausses : les bleus de la palette séquentielle, du clair au
 *  foncé (forte hausse). */
export const RAMPE_HAUSSE = ["#a9c8e0", "#548fbd", "#1b4f77"];

/** Moins de trois classes d'un côté : on garde le contraste — les teintes
 *  extrêmes pour deux classes, la médiane pour une seule. */
function teintes(rampe: string[], classes: number): string[] {
  if (classes >= rampe.length) return rampe;
  return classes === 2 ? [rampe[0], rampe[2]] : [rampe[1]];
}

/**
 * Échelle divergente centrée sur zéro : hausses et baisses sont classées
 * **séparément**, chacune en quantiles (mêmes principes que l'échelle
 * séquentielle : classes égales en effectifs, bornes dédupliquées). Sans cette
 * séparation, une année où presque tout monte rangerait les rares baisses dans
 * la même classe que les petites hausses — et la carte dirait le contraire de
 * la donnée.
 */
export function echelleDivergente(variations: number[]): Echelle {
  const finies = variations.filter(Number.isFinite);
  if (finies.length === 0) return { bornes: [], couleurs: [] };
  const baisses = finies.filter((v) => v < 0);
  const hausses = finies.filter((v) => v >= 0);
  const coteBaisse = quantiles(baisses, RAMPE_BAISSE.length);
  const coteHausse = quantiles(hausses, RAMPE_HAUSSE.length);
  if (baisses.length === 0) {
    return { bornes: coteHausse.bornes, couleurs: teintes(RAMPE_HAUSSE, coteHausse.bornes.length + 1) };
  }
  if (hausses.length === 0) {
    return { bornes: coteBaisse.bornes, couleurs: teintes(RAMPE_BAISSE, coteBaisse.bornes.length + 1) };
  }
  // Zéro est une borne : aucune classe ne mélange une hausse et une baisse.
  return {
    bornes: [...coteBaisse.bornes, 0, ...coteHausse.bornes],
    couleurs: [
      ...teintes(RAMPE_BAISSE, coteBaisse.bornes.length + 1),
      ...teintes(RAMPE_HAUSSE, coteHausse.bornes.length + 1),
    ],
  };
}

/**
 * Une variation s'affiche signée : « +12 % », « −3,3 % », « +2 pts ». Le signe
 * plus fait partie de l'information — sans lui, une hausse se lit comme un
 * niveau. Une variation qui s'arrondit à zéro s'écrit « 0 », sans signe.
 * Les taux `pour_1000_*` s'affichent en % à l'écran (÷ 10, voir echelle.ts) :
 * leurs points suivent la même conversion, sinon l'infobulle contredirait la
 * carte.
 */
export function formaterVariation(variation: number, unite: string, mode: ModeVariation): string {
  if (mode === "pourcent") {
    const arrondie = Math.round(variation * 10) / 10;
    return `${arrondie > 0 ? "+" : ""}${pourcentage(variation)}`;
  }
  const affichee = unite.startsWith("pour_1000") ? variation / 10 : variation;
  const arrondie = Math.round(affichee * 10) / 10;
  const nombre = moins(
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(arrondie === 0 ? 0 : affichee),
  );
  // La même espace fine insécable que devant le % (echelle.ts).
  return `${arrondie > 0 ? "+" : ""}${nombre}\u202f${Math.abs(arrondie) >= 2 ? "pts" : "pt"}`;
}

/** La variation telle qu'elle s'exporte en CSV : même conversion ÷ 10 des
 *  `pour_1000_*` que l'écran — un fichier qui contredirait la carte serait
 *  pire qu'un fichier absent. */
export function variationExportee(variation: number, unite: string, mode: ModeVariation): number {
  return mode === "points" && unite.startsWith("pour_1000") ? variation / 10 : variation;
}

/** Ce que la légende annonce : « Évolution 2024 vs 2023, en % » ou
 *  « en points ». */
export function libelleEvolution(avant: string, apres: string, mode: ModeVariation): string {
  return `Évolution ${apres} vs ${avant}, en ${mode === "points" ? "points" : "%"}`;
}

/** La note sous la légende : comment les classes sont faites, ce que mesure la
 *  variation, et pourquoi un territoire peut rester gris. */
export function noteEvolution(mode: ModeVariation, parHabitant: boolean): string {
  const classes =
    "Classes égales en nombre de territoires, hausses et baisses classées séparément, zéro pour pivot.";
  const quoi =
    mode === "points"
      ? "Écart en points, pas en % : un taux qui passe de 10 % à 12 % gagne 2 points."
      : parHabitant
        ? "Évolution du montant par habitant : la population change aussi d'une année à l'autre, la variation diffère de celle du montant brut."
        : "Variation en % de la valeur du millésime précédent.";
  const gris =
    "Un territoire gris n'a pas de valeur publiée dans l'une des deux années, ou partait de zéro.";
  return `${classes} ${quoi} ${gris}`;
}
