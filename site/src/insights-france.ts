import type { Indicateur, Territoire } from "./donnees.ts";
import {
  ecartRelatif,
  periodeCommune,
  variation,
  type Insight,
  type PreuveInsight,
} from "./insights.ts";

type Series = Territoire["series"];

const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const ratio = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const moisAnnee = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

function pourcentage(valeur: number): string {
  return `${nombre.format(Math.abs(valeur))} %`;
}

function montant(valeur: number): string {
  const absolu = Math.abs(valeur);
  if (absolu >= 1_000_000_000) return `${nombre.format(valeur / 1_000_000_000)} Md€`;
  if (absolu >= 1_000_000) return `${nombre.format(valeur / 1_000_000)} M€`;
  return `${nombre.format(valeur)} €`;
}

function periodeLisible(periode: string): string {
  const correspondance = /^(\d{4})-(\d{2})$/.exec(periode);
  if (!correspondance) return periode;
  const annee = Number(correspondance[1]);
  const mois = Number(correspondance[2]);
  if (mois < 1 || mois > 12) return periode;
  return moisAnnee.format(new Date(Date.UTC(annee, mois - 1, 1)));
}

function preuve(
  indicateur: string,
  periode: string,
  valeur: number,
  libelle: string,
): PreuveInsight {
  return { indicateur, periode, valeur, libelle };
}

function insightNiches(series: Series): Insight | null {
  const ids = [
    "depense_fiscale_totale",
    "depense_fiscale_impot_revenu",
    "depense_fiscale_impot_revenu_societes",
    "depense_fiscale_impot_societes",
    "depense_fiscale_tva",
  ];
  const periode = periodeCommune(ids.map((id) => series[id]));
  if (!periode) return null;

  const total = series.depense_fiscale_totale[periode];
  const detail = ids.slice(1).reduce((somme, id) => somme + series[id][periode], 0);
  if (!(total > 0) || !Number.isFinite(detail)) return null;
  const part = (detail / total) * 100;

  return {
    id: "niches-fiscales",
    famille: "fiscalite",
    surtitre: "Fiscalité · ce que le budget ne montre pas",
    titre: `${montant(total)} d'impôts ne sont pas encaissés`,
    texte: `Les principales niches sur le revenu, les sociétés et la TVA représentent ${pourcentage(part)} du total chiffré en ${periode}. Ce sont des recettes auxquelles l'État renonce, pas une ligne de dépense.`,
    reserve: "Les catégories détaillées affichées ne couvrent pas nécessairement toutes les niches du total.",
    preuves: ids.map((id) =>
      preuve(id, periode, series[id][periode], id === "depense_fiscale_totale" ? "Total des niches" : "Composante"),
    ),
  };
}

function nomMission(id: string, catalogue: Indicateur[]): string {
  const libelle = catalogue.find((indicateur) => indicateur.id === id)?.libelle;
  if (libelle) return libelle.replace(/\s*(?:[—-]|\()\s*crédits votés.*$/i, "").trim();
  const brut = id.replace(/^etat_mission_/, "").replace(/_credits_votes$/, "");
  return brut
    .split("_")
    .map((mot) => mot.charAt(0).toUpperCase() + mot.slice(1))
    .join(" ");
}

function insightExecution(series: Series, catalogue: Indicateur[]): Insight | null {
  let maximum:
    | { voteId: string; consommeId: string; periode: string; vote: number; consomme: number; ecart: number }
    | null = null;

  for (const voteId of Object.keys(series).filter((id) => /^etat_mission_.+_credits_votes$/.test(id))) {
    const consommeId = voteId.replace(/_credits_votes$/, "_credits_consommes");
    const periode = periodeCommune([series[voteId], series[consommeId]]);
    if (!periode) continue;
    const vote = series[voteId][periode];
    const consomme = series[consommeId][periode];
    const ecart = consomme - vote;
    if (!Number.isFinite(ecart) || vote === 0) continue;
    if (!maximum || Math.abs(ecart) > Math.abs(maximum.ecart)) {
      maximum = { voteId, consommeId, periode, vote, consomme, ecart };
    }
  }
  if (!maximum) return null;

  const relatif = ecartRelatif(maximum.vote, maximum.consomme);
  if (relatif === null) return null;
  const mission = nomMission(maximum.voteId, catalogue);
  const direction = maximum.ecart >= 0 ? "au-dessus" : "au-dessous";

  return {
    id: "budget-vote-execute",
    famille: "budget",
    surtitre: "Budget · le vote face à l'exécution",
    titre: `${mission} : ${montant(Math.abs(maximum.ecart))} d'écart`,
    texte: `En ${maximum.periode}, cette mission a consommé ${pourcentage(relatif)} ${direction} des crédits votés. C'est le plus grand écart en euros parmi les missions comparables publiées.`,
    reserve: "Un écart d'exécution ne dit pas, à lui seul, si la dépense était utile ou évitable.",
    preuves: [
      preuve(maximum.voteId, maximum.periode, maximum.vote, "Crédits votés"),
      preuve(maximum.consommeId, maximum.periode, maximum.consomme, "Crédits consommés"),
    ],
  };
}

function insightCotisants(series: Series): Insight | null {
  const evolution = variation(series.drees_cotisants_par_retraite);
  if (!evolution) return null;
  const direction = evolution.delta < 0 ? "de moins" : "de plus";
  return {
    id: "cotisants-retraites",
    famille: "generation",
    surtitre: "Retraites · l'équation démographique",
    titre: `${ratio.format(evolution.arrivee)} cotisant pour un retraité`,
    texte: `Le ratio était de ${ratio.format(evolution.depart)} en ${evolution.de}. Il y en a ${pourcentage(evolution.pourcentage)} ${direction} à la dernière observation publiée (${evolution.a}).`,
    reserve: "Ce ratio démographique ne mesure ni le niveau des pensions ni le taux des cotisations.",
    preuves: [
      preuve("drees_cotisants_par_retraite", evolution.de, evolution.depart, "Point de départ"),
      preuve("drees_cotisants_par_retraite", evolution.a, evolution.arrivee, "Dernier point"),
    ],
  };
}

function insightPensions(series: Series): Insight | null {
  const femmeId = "drees_pension_moyenne_brute_femmes";
  const hommeId = "drees_pension_moyenne_brute_hommes";
  const periode = periodeCommune([series[femmeId], series[hommeId]]);
  if (!periode) return null;
  const femmes = series[femmeId][periode];
  const hommes = series[hommeId][periode];
  if (!(hommes > 0) || !Number.isFinite(femmes)) return null;
  const ecart = ((hommes - femmes) / hommes) * 100;
  return {
    id: "pensions-femmes-hommes",
    famille: "generation",
    surtitre: "Retraites · l'écart derrière la moyenne",
    titre: `Les femmes perçoivent ${pourcentage(ecart)} de moins`,
    texte: `En ${periode}, la pension brute moyenne publiée est de ${montant(femmes)} par mois pour les femmes, contre ${montant(hommes)} pour les hommes.`,
    reserve: "L'écart reflète notamment les carrières et temps de travail ; il ne compare pas des parcours identiques.",
    preuves: [
      preuve(femmeId, periode, femmes, "Pension moyenne des femmes"),
      preuve(hommeId, periode, hommes, "Pension moyenne des hommes"),
    ],
  };
}

function insightDefaillances(series: Series): Insight | null {
  const id = "bdf_defaillances_taille_ensemble";
  const points = Object.entries(series[id] ?? {})
    .filter((entree): entree is [string, number] => Number.isFinite(entree[1]))
    .sort(([a], [b]) => a.localeCompare(b));
  if (points.length < 2) return null;
  const [periodeDepart, depart] = points.at(-2)!;
  const [periodeArrivee, arrivee] = points.at(-1)!;
  const evolution = ecartRelatif(depart, arrivee);
  if (evolution === null) return null;
  const direction = evolution >= 0 ? "augmenté" : "reculé";
  return {
    id: "defaillances",
    famille: "travail",
    surtitre: "Entreprises · le thermomètre réel",
    titre: `${nombre.format(arrivee)} défaillances sur douze mois`,
    texte: `Le cumul a ${direction} de ${pourcentage(evolution)} entre ${periodeLisible(periodeDepart)} et ${periodeLisible(periodeArrivee)}. Une défaillance correspond à l'ouverture d'un redressement ou d'une liquidation judiciaire.`,
    reserve: "Le nombre d'entreprises existantes et les créations ne sont pas déduits de ce total brut.",
    preuves: [
      preuve(id, periodeDepart, depart, "Cumul de départ"),
      preuve(id, periodeArrivee, arrivee, "Dernier cumul"),
    ],
  };
}

function insightRedistribution(series: Series): Insight | null {
  const apresId = "insee_gini";
  const avantId = "insee_gini_avant_redistribution";
  const periode = periodeCommune([series[apresId], series[avantId]]);
  if (!periode) return null;
  const apres = series[apresId][periode];
  const avant = series[avantId][periode];
  if (!(avant > 0) || !(apres >= 0) || apres > avant) return null;
  const reduction = ((avant - apres) / avant) * 100;
  return {
    id: "redistribution",
    famille: "budget",
    surtitre: "Redistribution · avant / après",
    titre: `Impôts et prestations réduisent l'inégalité de ${pourcentage(reduction)}`,
    texte: `En ${periode}, l'indice de Gini passe de ${ratio.format(avant)} avant redistribution à ${ratio.format(apres)} après redistribution. Plus l'indice est proche de zéro, plus les niveaux de vie sont égaux.`,
    reserve: "L'indice résume toute la distribution des niveaux de vie ; il ne décrit pas chaque ménage.",
    preuves: [
      preuve(avantId, periode, avant, "Avant redistribution"),
      preuve(apresId, periode, apres, "Après redistribution"),
    ],
  };
}

export function insightsFrance(france: Territoire | undefined, catalogue: Indicateur[]): Insight[] {
  if (!france) return [];
  return [
    insightNiches(france.series),
    insightExecution(france.series, catalogue),
    insightCotisants(france.series),
    insightPensions(france.series),
    insightDefaillances(france.series),
    insightRedistribution(france.series),
  ].filter((insight): insight is Insight => insight !== null);
}
