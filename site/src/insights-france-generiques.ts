import type { Indicateur, Territoire } from "./donnees.ts";
import { formater } from "./echelle.ts";
import {
  RECETTES_MISSIONS,
  RECETTES_TENDANCES,
  type RecetteMission,
  type RecetteTendance,
} from "./insights-france-catalogue.ts";
import { periodeCommune, type Insight, type PreuveInsight } from "./insights.ts";

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
    texte: `La série publiée passe de ${formater(depart.valeur, recette.unite, false)} à ${formater(arrivee.valeur, recette.unite, false)} entre ${depart.periode} et ${arrivee.periode}, soit ${mouvement} de ${nombre.format(Math.abs(evolution))} ${enPoints ? "points" : "%"}.`,
    reserve: recette.reserve,
    preuves: [
      preuve(recette.indicateur, depart, "Point de départ"),
      preuve(recette.indicateur, arrivee, "Dernière observation"),
    ],
  };
}

function creerInsightMission(
  recette: RecetteMission,
  series: Series,
  catalogue: Indicateur[],
): Insight | null {
  if (!uniteValide(catalogue, recette.vote, "EUR") || !uniteValide(catalogue, recette.consomme, "EUR")) return null;
  const periode = periodeCommune([series[recette.vote], series[recette.consomme]]);
  if (!periode) return null;
  const vote = series[recette.vote][periode];
  const consomme = series[recette.consomme][periode];
  if (!(vote > 0) || !Number.isFinite(consomme)) return null;
  const ecart = ((consomme - vote) / vote) * 100;
  const position = ecart >= 0 ? "au-dessus" : "au-dessous";

  return {
    id: recette.id,
    famille: recette.famille,
    surtitre: "Budget · la promesse face à l'exécution",
    titre: `${recette.sujet} : ${nombre.format(Math.abs(ecart))} % ${position} du vote`,
    texte: `En ${periode}, ${formater(consomme, "EUR", false)} ont été consommés sur ${formater(vote, "EUR", false)} votés, soit un écart de ${nombreSigne.format(ecart)} %.`,
    reserve: recette.reserve,
    preuves: [
      { indicateur: recette.vote, periode, valeur: vote, libelle: "Crédits votés" },
      { indicateur: recette.consomme, periode, valeur: consomme, libelle: "Crédits consommés" },
    ],
  };
}

export function insightsFranceGeneriques(series: Series, catalogue: Indicateur[]): Insight[] {
  return [
    ...RECETTES_TENDANCES.map((recette) => creerInsightTendance(recette, series, catalogue)),
    ...RECETTES_MISSIONS.map((recette) => creerInsightMission(recette, series, catalogue)),
  ].filter((insight): insight is Insight => insight !== null);
}
