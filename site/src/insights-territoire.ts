import type { Indicateur, Territoire } from "./donnees.ts";
import { formater } from "./echelle.ts";
import { periodeCommune, variation, type Insight, type PreuveInsight } from "./insights.ts";

type Series = Territoire["series"];
type BorneCommune = {
  debut: string;
  fin: string;
  debutA: number;
  finA: number;
  debutB: number;
  finB: number;
};

const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

function pct(valeur: number): string {
  return `${nombre.format(Math.abs(valeur))} %`;
}

function pctSigne(valeur: number): string {
  const signe = valeur > 0 ? "+" : valeur < 0 ? "−" : "";
  return `${signe}${pct(valeur)}`;
}

function preuve(indicateur: string, periode: string, valeur: number, libelle: string): PreuveInsight {
  return { indicateur, periode, valeur, libelle };
}

function unite(catalogue: Indicateur[], id: string, attendue: string): boolean {
  return catalogue.find((indicateur) => indicateur.id === id)?.unite === attendue;
}

function bornesCommunes(serieA?: Record<string, number>, serieB?: Record<string, number>): BorneCommune | null {
  if (!serieA || !serieB) return null;
  const periodes = Object.keys(serieA)
    .filter((periode) => Number.isFinite(serieA[periode]) && Number.isFinite(serieB[periode]))
    .sort((a, b) => a.localeCompare(b));
  if (periodes.length < 2) return null;
  const debut = periodes[0];
  const fin = periodes.at(-1)!;
  return {
    debut,
    fin,
    debutA: serieA[debut],
    finA: serieA[fin],
    debutB: serieB[debut],
    finB: serieB[fin],
  };
}

function insightFoncier(series: Series, catalogue: Indicateur[]): Insight | null {
  const id = "dgfip_taux_tfb_global";
  if (!unite(catalogue, id, "percent")) return null;
  const evolution = variation(series[id]);
  if (!evolution) return null;
  const points = evolution.arrivee - evolution.depart;
  const direction = points >= 0 ? "augmenté" : "baissé";
  return {
    id: "foncier",
    famille: "fiscalite",
    surtitre: "Fiscalité locale · le taux voté",
    titre: `Taxe foncière : ${pct(evolution.arrivee)}`,
    texte: `Le taux global a ${direction} de ${nombre.format(Math.abs(points))} points entre ${evolution.de} et ${evolution.a}. Le montant payé dépend aussi de la valeur cadastrale du bien.`,
    reserve: "Le taux n'est pas la facture : les bases cadastrales évoluent séparément.",
    preuves: [
      preuve(id, evolution.de, evolution.depart, "Taux initial"),
      preuve(id, evolution.a, evolution.arrivee, "Dernier taux"),
    ],
  };
}

function insightImpotsFaceDepenses(series: Series, catalogue: Indicateur[]): Insight | null {
  const impotsId = "ofgl_impots_locaux";
  const depensesId = "ofgl_depenses_fonctionnement";
  if (!unite(catalogue, impotsId, "EUR") || !unite(catalogue, depensesId, "EUR")) return null;
  const bornes = bornesCommunes(series[impotsId], series[depensesId]);
  if (!bornes || bornes.debutA <= 0 || bornes.debutB <= 0 || bornes.finA < 0 || bornes.finB < 0) return null;
  const impots = ((bornes.finA - bornes.debutA) / bornes.debutA) * 100;
  const depenses = ((bornes.finB - bornes.debutB) / bornes.debutB) * 100;
  const ecart = impots - depenses;
  const lecture = ecart >= 0
    ? `Les impôts ont progressé ${nombre.format(Math.abs(ecart))} points plus vite que les dépenses courantes.`
    : `Les dépenses courantes ont progressé ${nombre.format(Math.abs(ecart))} points plus vite que les impôts.`;
  return {
    id: "impots-face-depenses",
    famille: "fiscalite",
    surtitre: "Fiscalité locale · ce que la hausse finance",
    titre: `Impôts locaux ${pctSigne(impots)} · dépenses ${pctSigne(depenses)}`,
    texte: `${lecture} Comparaison entre ${bornes.debut} et ${bornes.fin}.`,
    reserve: "",
    preuves: [
      preuve(impotsId, bornes.debut, bornes.debutA, "Impôts locaux initiaux"),
      preuve(impotsId, bornes.fin, bornes.finA, "Derniers impôts locaux"),
      preuve(depensesId, bornes.debut, bornes.debutB, "Dépenses initiales"),
      preuve(depensesId, bornes.fin, bornes.finB, "Dernières dépenses"),
    ],
  };
}

function insightTauxEpargne(series: Series, catalogue: Indicateur[]): Insight | null {
  const recettesId = "ofgl_recettes_fonctionnement";
  const epargneId = "ofgl_epargne_brute";
  if (!unite(catalogue, recettesId, "EUR") || !unite(catalogue, epargneId, "EUR")) return null;
  const periode = periodeCommune([series[recettesId], series[epargneId]]);
  if (!periode) return null;
  const recettes = series[recettesId][periode];
  const epargne = series[epargneId][periode];
  if (!(recettes > 0) || !Number.isFinite(epargne)) return null;
  const part = (epargne / recettes) * 100;
  const titre = part >= 0
    ? `${pct(part)} des recettes reste après le fonctionnement`
    : `Le fonctionnement dépasse les recettes de ${pct(part)}`;
  return {
    id: "taux-epargne",
    famille: "budget",
    surtitre: "Budget local · la marge pour investir",
    titre,
    texte: `En ${periode}, l'épargne brute atteint ${formater(epargne, "EUR", false)} sur ${formater(recettes, "EUR", false)} de recettes de fonctionnement.`,
    reserve: "",
    preuves: [
      preuve(epargneId, periode, epargne, "Épargne brute"),
      preuve(recettesId, periode, recettes, "Recettes de fonctionnement"),
    ],
  };
}

function insightDetteSurEpargne(series: Series, catalogue: Indicateur[]): Insight | null {
  const detteId = "ofgl_encours_dette";
  const epargneId = "ofgl_epargne_brute";
  if (!unite(catalogue, detteId, "EUR") || !unite(catalogue, epargneId, "EUR")) return null;
  const periode = periodeCommune([series[detteId], series[epargneId]]);
  if (!periode) return null;
  const dette = series[detteId][periode];
  const epargne = series[epargneId][periode];
  if (dette < 0 || !(epargne > 0)) return null;
  const annees = dette / epargne;
  return {
    id: "dette-sur-epargne",
    famille: "budget",
    surtitre: "Dette locale · la capacité de désendettement",
    titre: `La dette représente ${nombre.format(annees)} années d'épargne brute`,
    texte: `En ${periode}, ${formater(dette, "EUR", false)} de dette sont rapportés à ${formater(epargne, "EUR", false)} d'épargne brute.`,
    reserve: "",
    preuves: [
      preuve(detteId, periode, dette, "Encours de dette"),
      preuve(epargneId, periode, epargne, "Épargne brute"),
    ],
  };
}

function insightPoidsPersonnel(series: Series, catalogue: Indicateur[]): Insight | null {
  const personnelId = "ofgl_frais_personnel";
  const depensesId = "ofgl_depenses_fonctionnement";
  if (!unite(catalogue, personnelId, "EUR") || !unite(catalogue, depensesId, "EUR")) return null;
  const periode = periodeCommune([series[personnelId], series[depensesId]]);
  if (!periode) return null;
  const personnel = series[personnelId][periode];
  const depenses = series[depensesId][periode];
  if (personnel < 0 || !(depenses > 0) || personnel > depenses) return null;
  const part = (personnel / depenses) * 100;
  return {
    id: "poids-personnel",
    famille: "services",
    surtitre: "Services publics · le poids de la masse salariale",
    titre: `Le personnel représente ${pct(part)} des dépenses de fonctionnement`,
    texte: `En ${periode}, les frais de personnel atteignent ${formater(personnel, "EUR", false)} sur ${formater(depenses, "EUR", false)} de dépenses courantes.`,
    reserve: "",
    preuves: [
      preuve(personnelId, periode, personnel, "Frais de personnel"),
      preuve(depensesId, periode, depenses, "Dépenses de fonctionnement"),
    ],
  };
}

function insightInteretsSurImpots(series: Series, catalogue: Indicateur[]): Insight | null {
  const interetsId = "ofgl_charges_financieres";
  const impotsId = "ofgl_impots_locaux";
  if (!unite(catalogue, interetsId, "EUR") || !unite(catalogue, impotsId, "EUR")) return null;
  const periode = periodeCommune([series[interetsId], series[impotsId]]);
  if (!periode) return null;
  const interets = series[interetsId][periode];
  const impots = series[impotsId][periode];
  if (interets < 0 || !(impots > 0)) return null;
  const part = (interets / impots) * 100;
  return {
    id: "interets-sur-impots",
    famille: "budget",
    surtitre: "Dette locale · le coût des intérêts",
    titre: `Les intérêts équivalent à ${pct(part)} des impôts locaux`,
    texte: `En ${periode}, les charges financières atteignent ${formater(interets, "EUR", false)}, contre ${formater(impots, "EUR", false)} d'impôts locaux.`,
    reserve: "",
    preuves: [
      preuve(interetsId, periode, interets, "Charges financières"),
      preuve(impotsId, periode, impots, "Impôts locaux"),
    ],
  };
}

function insightChomage(series: Series, catalogue: Indicateur[]): Insight | null {
  const actifsId = "insee_actifs";
  const chomeursId = "insee_chomeurs_rp";
  if (!unite(catalogue, actifsId, "count") || !unite(catalogue, chomeursId, "count")) return null;
  const bornes = bornesCommunes(series[actifsId], series[chomeursId]);
  if (!bornes || bornes.debutA <= 0 || bornes.finA <= 0) return null;
  if (bornes.debutB < 0 || bornes.finB < 0 || bornes.debutB > bornes.debutA || bornes.finB > bornes.finA) return null;
  const debut = (bornes.debutB / bornes.debutA) * 100;
  const fin = (bornes.finB / bornes.finA) * 100;
  const points = fin - debut;
  const direction = points >= 0 ? "de plus" : "de moins";
  return {
    id: "chomage",
    famille: "travail",
    surtitre: "Travail · au-delà du nombre brut",
    titre: `${pct(fin)} des actifs se déclarent au chômage`,
    texte: `Le ratio calculé à partir du recensement était de ${pct(debut)} en ${bornes.debut}, soit ${nombre.format(Math.abs(points))} points ${direction} en ${bornes.fin}.`,
    reserve: "Le chômage au recensement n'est pas le taux de chômage au sens du Bureau international du travail.",
    preuves: [
      preuve(actifsId, bornes.fin, bornes.finA, "Population active"),
      preuve(chomeursId, bornes.fin, bornes.finB, "Chômeurs déclarés"),
      preuve(actifsId, bornes.debut, bornes.debutA, "Population active initiale"),
      preuve(chomeursId, bornes.debut, bornes.debutB, "Chômeurs initiaux"),
    ],
  };
}

function insightVacance(series: Series, catalogue: Indicateur[]): Insight | null {
  const logementsId = "insee_logements";
  const vacantsId = "insee_logements_vacants";
  if (!unite(catalogue, logementsId, "count") || !unite(catalogue, vacantsId, "count")) return null;
  const bornes = bornesCommunes(series[logementsId], series[vacantsId]);
  if (!bornes || bornes.debutA <= 0 || bornes.finA <= 0) return null;
  if (bornes.debutB < 0 || bornes.finB < 0 || bornes.debutB > bornes.debutA || bornes.finB > bornes.finA) return null;
  const debut = (bornes.debutB / bornes.debutA) * 100;
  const fin = (bornes.finB / bornes.finA) * 100;
  const points = fin - debut;
  const direction = points >= 0 ? "progressé" : "reculé";
  return {
    id: "logements-vacants",
    famille: "logement",
    surtitre: "Logement · la réserve invisible",
    titre: `${pct(fin)} des logements sont vacants`,
    texte: `La part calculée à partir du recensement a ${direction} de ${nombre.format(Math.abs(points))} points entre ${bornes.debut} et ${bornes.fin}.`,
    reserve: "Un logement recensé vacant n'est pas nécessairement disponible immédiatement à la location.",
    preuves: [
      preuve(logementsId, bornes.fin, bornes.finA, "Logements"),
      preuve(vacantsId, bornes.fin, bornes.finB, "Logements vacants"),
      preuve(logementsId, bornes.debut, bornes.debutA, "Logements initiaux"),
      preuve(vacantsId, bornes.debut, bornes.debutB, "Vacants initiaux"),
    ],
  };
}

function insightCambriolages(series: Series, catalogue: Indicateur[]): Insight | null {
  const id = "ssmsi_cambriolages_taux";
  if (!unite(catalogue, id, "pour_1000_logements")) return null;
  const evolution = variation(series[id]);
  if (!evolution || evolution.arrivee < 0) return null;
  const direction = evolution.delta >= 0 ? "augmenté" : "reculé";
  return {
    id: "cambriolages",
    famille: "securite",
    surtitre: "Sécurité · une fréquence, pas une impression",
    titre: `${nombre.format(evolution.arrivee)} cambriolages pour 1 000 logements`,
    texte: `Le taux enregistré a ${direction} de ${pct(evolution.pourcentage)} entre ${evolution.de} et ${evolution.a}.`,
    reserve: "Les faits enregistrés dépendent aussi du dépôt de plainte et des pratiques d'enregistrement.",
    preuves: [
      preuve(id, evolution.de, evolution.depart, "Taux initial"),
      preuve(id, evolution.a, evolution.arrivee, "Dernier taux"),
    ],
  };
}

function insightElectricite(series: Series, catalogue: Indicateur[]): Insight | null {
  const id = "ore_conso_electricite";
  if (!unite(catalogue, id, "mwh")) return null;
  const evolution = variation(series[id]);
  if (!evolution || evolution.arrivee < 0) return null;
  const direction = evolution.delta >= 0 ? "augmenté" : "diminué";
  return {
    id: "electricite",
    famille: "environnement",
    surtitre: "Énergie · la trajectoire mesurée",
    titre: `La consommation d'électricité a ${direction} de ${pct(evolution.pourcentage)}`,
    texte: `Le territoire est passé de ${nombre.format(evolution.depart)} à ${nombre.format(evolution.arrivee)} MWh entre ${evolution.de} et ${evolution.a}.`,
    reserve: "La météo, la population, l'activité économique et les changements d'énergie influencent cette évolution.",
    preuves: [
      preuve(id, evolution.de, evolution.depart, "Consommation initiale"),
      preuve(id, evolution.a, evolution.arrivee, "Dernière consommation"),
    ],
  };
}

function insightParcLogements(series: Series, catalogue: Indicateur[]): Insight | null {
  const id = "insee_logements";
  if (!unite(catalogue, id, "count")) return null;
  const evolution = variation(series[id]);
  if (!evolution || evolution.arrivee < 0) return null;
  const direction = evolution.delta >= 0 ? "agrandi" : "réduit";
  return {
    id: "parc-logements",
    famille: "logement",
    surtitre: "Habitat · le stock avant les promesses",
    titre: `Le parc de logements s'est ${direction} de ${pct(evolution.pourcentage)}`,
    texte: `Le recensement compte ${nombre.format(evolution.arrivee)} logements en ${evolution.a}, contre ${nombre.format(evolution.depart)} en ${evolution.de}.`,
    reserve: "Une hausse du parc ne dit ni où sont les logements, ni leur prix, ni leur occupation.",
    preuves: [
      preuve(id, evolution.de, evolution.depart, "Parc initial"),
      preuve(id, evolution.a, evolution.arrivee, "Dernier parc publié"),
    ],
  };
}

function insightPassoiresSociales(series: Series, catalogue: Indicateur[]): Insight | null {
  const etiquetesId = "rpls_logements_sociaux_etiquetes";
  const passoiresId = "rpls_logements_sociaux_passoires";
  if (!unite(catalogue, etiquetesId, "count") || !unite(catalogue, passoiresId, "count")) return null;
  const periode = Object.keys(series[etiquetesId] ?? {})
    .filter((annee) => Number.isFinite(series[etiquetesId][annee]) && Number.isFinite(series[passoiresId]?.[annee]))
    .sort((a, b) => a.localeCompare(b))
    .at(-1);
  if (!periode) return null;
  const etiquetes = series[etiquetesId][periode];
  const passoires = series[passoiresId][periode];
  if (!(etiquetes > 0) || passoires < 0 || passoires > etiquetes) return null;
  const part = (passoires / etiquetes) * 100;
  return {
    id: "passoires-sociales",
    famille: "logement",
    surtitre: "Logement social · la rénovation à accomplir",
    titre: `${pct(part)} du parc social étiqueté est classé F ou G`,
    texte: `En ${periode}, ${nombre.format(passoires)} logements sociaux très mal isolés sont recensés parmi ${nombre.format(etiquetes)} logements disposant d'une étiquette énergie.`,
    reserve: "Le ratio ne couvre que les logements sociaux dont l'étiquette énergétique est connue.",
    preuves: [
      preuve(passoiresId, periode, passoires, "Passoires thermiques"),
      preuve(etiquetesId, periode, etiquetes, "Logements étiquetés"),
    ],
  };
}

function insightGaz(series: Series, catalogue: Indicateur[]): Insight | null {
  const id = "ore_conso_gaz";
  if (!unite(catalogue, id, "mwh")) return null;
  const evolution = variation(series[id]);
  if (!evolution || evolution.arrivee < 0) return null;
  const direction = evolution.delta >= 0 ? "augmenté" : "diminué";
  return {
    id: "gaz",
    famille: "environnement",
    surtitre: "Énergie · la dépendance au gaz en mouvement",
    titre: `La consommation de gaz a ${direction} de ${pct(evolution.pourcentage)}`,
    texte: `Le territoire est passé de ${nombre.format(evolution.depart)} à ${nombre.format(evolution.arrivee)} MWh entre ${evolution.de} et ${evolution.a}.`,
    reserve: "La météo, l'activité, les rénovations et les changements d'énergie influencent cette série.",
    preuves: [
      preuve(id, evolution.de, evolution.depart, "Consommation initiale"),
      preuve(id, evolution.a, evolution.arrivee, "Dernière consommation"),
    ],
  };
}

function insightVolsVehicules(series: Series, catalogue: Indicateur[]): Insight | null {
  const id = "ssmsi_vols_vehicules_taux";
  if (!unite(catalogue, id, "pour_1000_habitants")) return null;
  const evolution = variation(series[id]);
  if (!evolution || evolution.arrivee < 0) return null;
  const direction = evolution.delta >= 0 ? "augmenté" : "reculé";
  return {
    id: "vols-vehicules",
    famille: "securite",
    surtitre: "Sécurité · le risque rapporté à la population",
    titre: `${nombre.format(evolution.arrivee)} vols de véhicules pour 1 000 habitants`,
    texte: `Le taux enregistré a ${direction} de ${pct(evolution.pourcentage)} entre ${evolution.de} et ${evolution.a}.`,
    reserve: "Les faits enregistrés dépendent aussi du dépôt de plainte et des pratiques d'enregistrement.",
    preuves: [
      preuve(id, evolution.de, evolution.depart, "Taux initial"),
      preuve(id, evolution.a, evolution.arrivee, "Dernier taux"),
    ],
  };
}

export function insightsTerritoire(territoire: Territoire, catalogue: Indicateur[]): Insight[] {
  return [
    insightFoncier(territoire.series, catalogue),
    insightImpotsFaceDepenses(territoire.series, catalogue),
    insightTauxEpargne(territoire.series, catalogue),
    insightDetteSurEpargne(territoire.series, catalogue),
    insightPoidsPersonnel(territoire.series, catalogue),
    insightInteretsSurImpots(territoire.series, catalogue),
    insightChomage(territoire.series, catalogue),
    insightVacance(territoire.series, catalogue),
    insightCambriolages(territoire.series, catalogue),
    insightElectricite(territoire.series, catalogue),
    insightParcLogements(territoire.series, catalogue),
    insightPassoiresSociales(territoire.series, catalogue),
    insightGaz(territoire.series, catalogue),
    insightVolsVehicules(territoire.series, catalogue),
  ].filter((insight): insight is Insight => insight !== null);
}
