import type { Indicateur, Territoire } from "./donnees.ts";
import { formater } from "./echelle.ts";
import {
  RECETTES_TENDANCES,
  type RecetteTendance,
} from "./insights-france-catalogue.ts";
import { type Insight, type PreuveInsight } from "./insights.ts";
import { comparaisonVoisins, courbesEurope } from "./insights-europe.ts";

type Series = Territoire["series"];
type Point = { periode: string; valeur: number };

const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const nombreSigne = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

function points(serie?: Record<string, number>): Point[] {
  return Object.entries(serie ?? {})
    .filter((entree): entree is [string, number] => Number.isFinite(entree[1]))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periode, valeur]) => ({ periode, valeur }));
}

function uniteValide(catalogue: Indicateur[], id: string, unite: string): boolean {
  return catalogue.find((indicateur) => indicateur.id === id)?.unite === unite;
}

function preuve(indicateur: string, point: Point, libelle: string): PreuveInsight {
  return { indicateur, periode: point.periode, valeur: point.valeur, libelle };
}

export function creerInsightTendance(
  recette: RecetteTendance,
  series: Series,
  catalogue: Indicateur[],
  pays?: Record<string, Territoire>,
): Insight | null {
  if (!uniteValide(catalogue, recette.indicateur, recette.unite)) return null;
  const observations = points(series[recette.indicateur]);
  if (observations.length < 2) return null;
  const observationsRecentes = observations.filter(({ periode }) => periode >= "2017");
  const estComparaisonDeGenerations = recette.indicateur.startsWith("insee_retraite_");
  const depart = !estComparaisonDeGenerations && observationsRecentes.length >= 2
    ? observationsRecentes[0]
    : observations[0];
  const arrivee = observations.at(-1)!;
  const delta = arrivee.valeur - depart.valeur;
  const enPoints = recette.unite === "percent";
  if (!enPoints && depart.valeur === 0) return null;
  const evolution = enPoints ? delta : (delta / Math.abs(depart.valeur)) * 100;
  const amplitude = `${nombreSigne.format(evolution)} ${enPoints ? "points" : "%"}`;
  const mouvement = delta >= 0 ? "une hausse" : "une baisse";

  return {
    id: recette.id,
    famille: recette.famille,
    surtitre: recette.surtitre,
    titre: `${recette.sujet} : ${amplitude}`,
    texte: `La série publiée passe de ${formater(depart.valeur, recette.unite, false, recette.indicateur)} à ${formater(arrivee.valeur, recette.unite, false, recette.indicateur)} entre ${depart.periode} et ${arrivee.periode}, soit ${mouvement} de ${nombre.format(Math.abs(evolution))} ${enPoints ? "points" : "%"}.`,
    graphique: recette.indicateur === "eurostat_gini" ? {
      titre: "Gini après redistribution · France et ses voisins",
      unite: "0 à 100",
      series: courbesEurope(series.eurostat_gini, pays, "eurostat_gini", depart.periode, arrivee.periode),
    } : undefined,
    reserve: recette.reserve,
    comparaison: recette.indicateur.startsWith("eurostat_")
      ? comparaisonVoisins(pays, recette.indicateur, arrivee.periode, recette.unite)
      : undefined,
    preuves: [
      preuve(recette.indicateur, depart, "Point de départ"),
      preuve(recette.indicateur, arrivee, "Dernière observation"),
    ],
  };
}

export function insightsFranceGeneriques(
  series: Series,
  catalogue: Indicateur[],
  pays?: Record<string, Territoire>,
): Insight[] {
  return [
    ...RECETTES_TENDANCES.map((recette) => creerInsightTendance(recette, series, catalogue, pays)),
  ].filter((insight): insight is Insight => insight !== null);
}
