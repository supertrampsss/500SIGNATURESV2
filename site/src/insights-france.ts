import type { Indicateur, Territoire } from "./donnees.ts";
import { insightsFranceGeneriques } from "./insights-france-generiques.ts";
import { comparaisonVoisins } from "./insights-europe.ts";
import {
  derniere,
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
  const trimestre = /^(\d{4})-Q([1-4])$/.exec(periode);
  if (trimestre) {
    const rang = trimestre[2] === "1" ? "1er" : `${trimestre[2]}e`;
    return `${rang} trimestre ${trimestre[1]}`;
  }
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
    reserve: "",
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

function insightPoidsPersonnelEtat(series: Series): Insight | null {
  const personnelId = "etat_depenses_personnel";
  const budgetId = "etat_depenses_nettes_bg";
  const periode = periodeCommune([series[personnelId], series[budgetId]]);
  if (!periode) return null;
  const personnel = series[personnelId][periode];
  const budget = series[budgetId][periode];
  if (!(personnel >= 0) || !(budget > 0)) return null;
  const part = (personnel / budget) * 100;
  return {
    id: "poids-personnel-etat",
    famille: "budget",
    surtitre: "Fonction publique · ce que paie le budget",
    titre: `${pourcentage(part)} du budget général finance les personnels`,
    texte: `En ${periode}, l'État inscrit ${montant(personnel)} de dépenses de personnel sur ${montant(budget)} de dépenses nettes du budget général. Un peu plus d'un euro sur trois est donc lié aux rémunérations et charges de personnel.`,
    reserve: "Ce ratio porte sur le budget général de l'État, pas sur les trois fonctions publiques ni sur toute la dépense publique.",
    preuves: [
      preuve(personnelId, periode, personnel, "Dépenses de personnel"),
      preuve(budgetId, periode, budget, "Dépenses nettes du budget général"),
    ],
  };
}

function insightPoidsImpotRevenu(series: Series): Insight | null {
  const impotId = "etat_impot_revenu";
  const recettesId = "etat_recettes_fiscales";
  const periode = periodeCommune([series[impotId], series[recettesId]]);
  if (!periode) return null;
  const impot = series[impotId][periode];
  const recettes = series[recettesId][periode];
  if (!(impot >= 0) || !(recettes > 0)) return null;
  const part = (impot / recettes) * 100;
  return {
    id: "poids-impot-revenu",
    famille: "fiscalite",
    surtitre: "Impôt sur le revenu · central dans le débat, minoritaire dans les recettes",
    titre: `${pourcentage(part)} des recettes fiscales nettes de l'État`,
    texte: `En ${periode}, l'impôt sur le revenu rapporte ${montant(impot)} sur ${montant(recettes)} de recettes fiscales nettes. Il concentre le débat fiscal, mais ne représente qu'environ un quart de ce que l'État encaisse par l'impôt.`,
    reserve: "Le périmètre est celui de l'État : cotisations sociales et impôts locaux n'entrent pas dans ce total.",
    preuves: [
      preuve(impotId, periode, impot, "Impôt sur le revenu"),
      preuve(recettesId, periode, recettes, "Recettes fiscales nettes"),
    ],
  };
}

function insightDettePorteeParEtat(series: Series): Insight | null {
  const etatId = "insee_dette_etat_montant";
  const totalId = "insee_dette_apu_montant";
  const periode = periodeCommune([series[etatId], series[totalId]]);
  if (!periode) return null;
  const etat = series[etatId][periode];
  const total = series[totalId][periode];
  if (!(etat >= 0) || !(total > 0)) return null;
  const part = (etat / total) * 100;
  return {
    id: "dette-portee-par-etat",
    famille: "budget",
    surtitre: "Dette · qui porte réellement l'addition",
    titre: `${pourcentage(part)} de la dette publique est portée par l'État`,
    texte: `À la fin du ${periodeLisible(periode)}, l'État porte ${montant(etat)} sur ${montant(total)} de dette publique. Le reste appartient aux organismes centraux, aux collectivités et à la Sécurité sociale.`,
    reserve: "Cette répartition désigne le débiteur comptable ; elle ne préjuge pas de l'administration qui bénéficie de la dépense financée.",
    preuves: [
      preuve(etatId, periode, etat, "Dette de l'État"),
      preuve(totalId, periode, total, "Dette publique totale"),
    ],
  };
}

function insightProtectionVieillesseSante(series: Series): Insight | null {
  const vieillesseId = "drees_protection_sociale_vieillesse";
  const santeId = "drees_protection_sociale_sante";
  const totalId = "drees_protection_sociale_total";
  const periode = periodeCommune([series[vieillesseId], series[santeId], series[totalId]]);
  if (!periode) return null;
  const vieillesse = series[vieillesseId][periode];
  const sante = series[santeId][periode];
  const total = series[totalId][periode];
  if (!(vieillesse >= 0) || !(sante >= 0) || !(total > 0)) return null;
  const part = ((vieillesse + sante) / total) * 100;
  return {
    id: "protection-sociale-vieillesse-sante",
    famille: "services",
    surtitre: "Modèle social · où part l'essentiel",
    titre: `Vieillesse et santé absorbent ${pourcentage(part)} des prestations`,
    texte: `En ${periode}, ces deux risques représentent ${montant(vieillesse + sante)} sur ${montant(total)} de prestations de protection sociale. Le cœur du modèle social français finance d'abord l'âge et la santé.`,
    reserve: "Ces comptes couvrent l'ensemble de la protection sociale, au-delà des seuls budgets de l'État et de la Sécurité sociale.",
    preuves: [
      preuve(vieillesseId, periode, vieillesse, "Vieillesse et survie"),
      preuve(santeId, periode, sante, "Santé"),
      preuve(totalId, periode, total, "Total des prestations"),
    ],
  };
}

function insightProtectionVieillesseFamille(series: Series): Insight | null {
  const vieillesseId = "drees_protection_sociale_vieillesse";
  const familleId = "drees_protection_sociale_famille";
  const periode = periodeCommune([series[vieillesseId], series[familleId]]);
  if (!periode) return null;
  const vieillesse = series[vieillesseId][periode];
  const famille = series[familleId][periode];
  if (!(vieillesse >= 0) || !(famille > 0)) return null;
  const multiple = vieillesse / famille;
  return {
    id: "protection-sociale-vieillesse-famille",
    famille: "generation",
    surtitre: "Générations · le rapport de force budgétaire",
    titre: `${ratio.format(multiple)} fois plus pour la vieillesse que pour la famille`,
    texte: `En ${periode}, les prestations vieillesse et survie atteignent ${montant(vieillesse)}, contre ${montant(famille)} pour le risque famille. Ce rapport mesure la structure du système, pas le niveau de vie de chaque génération.`,
    reserve: "Comparer les masses ne tient compte ni du nombre de bénéficiaires ni de la durée des droits.",
    preuves: [
      preuve(vieillesseId, periode, vieillesse, "Vieillesse et survie"),
      preuve(familleId, periode, famille, "Famille"),
    ],
  };
}

function insightRedistributionInterquintile(series: Series): Insight | null {
  const avantId = "insee_rapport_interquintile_avant_redistribution";
  const apresId = "insee_rapport_interquintile";
  const periode = periodeCommune([series[avantId], series[apresId]]);
  if (!periode) return null;
  const avant = series[avantId][periode];
  const apres = series[apresId][periode];
  if (!(avant > 0) || !(apres > 0) || apres > avant) return null;
  const reduction = ((avant - apres) / avant) * 100;
  return {
    id: "redistribution-interquintile",
    famille: "services",
    surtitre: "Redistribution · ce qu'elle change vraiment",
    titre: `L'écart entre les 20 % extrêmes recule de ${pourcentage(reduction)}`,
    texte: `En ${periode}, le rapport de niveau de vie entre les 20 % les plus aisés et les 20 % les plus modestes passe de ${ratio.format(avant)} avant redistribution à ${ratio.format(apres)} après impôts directs et prestations.`,
    reserve: "Ce rapport compare deux groupes entiers et ne décrit pas les écarts à l'intérieur de chacun.",
    preuves: [
      preuve(avantId, periode, avant, "Avant redistribution"),
      preuve(apresId, periode, apres, "Après redistribution"),
    ],
  };
}

function insightRedistributionBasEchelle(series: Series): Insight | null {
  const avantId = "insee_niveau_vie_d1_avant_redistribution";
  const apresId = "insee_niveau_vie_d1";
  const periode = periodeCommune([series[avantId], series[apresId]]);
  if (!periode) return null;
  const avant = series[avantId][periode];
  const apres = series[apresId][periode];
  if (!(avant > 0) || !(apres > 0) || apres < avant) return null;
  const hausse = ((apres - avant) / avant) * 100;
  return {
    id: "redistribution-bas-echelle",
    famille: "services",
    surtitre: "Redistribution · le bas de l'échelle",
    titre: `Le premier décile est relevé de ${pourcentage(hausse)}`,
    texte: `En ${periode}, le seuil de niveau de vie des 10 % les plus modestes passe de ${montant(avant)} avant redistribution à ${montant(apres)} après impôts directs et prestations.`,
    reserve: "Un décile est un seuil statistique : la différence n'est pas le transfert reçu par une même personne.",
    preuves: [
      preuve(avantId, periode, avant, "Seuil avant redistribution"),
      preuve(apresId, periode, apres, "Seuil après redistribution"),
    ],
  };
}

function insightInteretsDette(series: Series): Insight | null {
  const id = "eurostat_apu_interets";
  const depart = series[id]?.["2021"];
  const arrivee = derniere(series[id]);
  if (!(depart > 0) || !arrivee || arrivee.periode === "2021") return null;
  const hausse = ecartRelatif(depart, arrivee.valeur);
  if (hausse === null) return null;
  return {
    id: "interets-dette",
    famille: "budget",
    surtitre: "Dette · la dépense qui ne finance aucun service",
    titre: `${montant(arrivee.valeur)} d'intérêts en ${arrivee.periode}`,
    texte: `La charge d'intérêts des administrations publiques a augmenté de ${pourcentage(hausse)} depuis 2021. Ce montant rémunère la dette passée avant de financer une politique publique nouvelle.`,
    reserve: "La charge varie avec les taux, l'inflation, l'encours et le calendrier de refinancement.",
    preuves: [
      preuve(id, "2021", depart, "Intérêts en 2021"),
      preuve(id, arrivee.periode, arrivee.valeur, "Derniers intérêts publiés"),
    ],
  };
}

function insightPrelevements(series: Series, pays?: Record<string, Territoire>): Insight | null {
  const id = "eurostat_prelevements_obligatoires_pib";
  const depart = series[id]?.["2017"];
  const arrivee = derniere(series[id]);
  if (!(depart > 0) || !arrivee || arrivee.periode === "2017") return null;
  const points = arrivee.valeur - depart;
  const direction = points >= 0 ? "augmenté" : "reculé";
  return {
    id: "prelevements-obligatoires",
    famille: "fiscalite",
    surtitre: "Fiscalité · le taux et le montant ne racontent pas la même chose",
    titre: `${nombre.format(arrivee.valeur)} % du PIB en prélèvements obligatoires`,
    texte: `Le ratio a ${direction} de ${nombre.format(Math.abs(points))} points depuis 2017. Une baisse de part dans le PIB ne signifie pas nécessairement que chaque contribuable paie moins en euros.`,
    reserve: "Le ratio agrège impôts et cotisations de l'ensemble des administrations publiques.",
    comparaison: comparaisonVoisins(pays, id, arrivee.periode, "percent"),
    preuves: [
      preuve(id, "2017", depart, "Ratio en 2017"),
      preuve(id, arrivee.periode, arrivee.valeur, "Dernier ratio publié"),
    ],
  };
}

function insightTauxEmploi(series: Series, pays?: Record<string, Territoire>): Insight | null {
  const id = "eurostat_taux_emploi";
  const evolution = variation(series[id]);
  if (!evolution || evolution.arrivee < 0) return null;
  const points = evolution.arrivee - evolution.depart;
  const direction = points >= 0 ? "progressé" : "reculé";
  return {
    id: "taux-emploi",
    famille: "travail",
    surtitre: "Emploi · le mouvement de fond",
    titre: `${nombre.format(evolution.arrivee)} % des 20-64 ans en emploi`,
    texte: `Le taux harmonisé a ${direction} de ${nombre.format(Math.abs(points))} points entre ${evolution.de} et ${evolution.a}. Il mesure la part en emploi, pas la qualité ni la durée des contrats.`,
    reserve: "Étudiants, inactifs et personnes hors emploi ne sont pas tous comptés comme chômeurs.",
    comparaison: comparaisonVoisins(pays, id, evolution.a, "percent"),
    preuves: [
      preuve(id, evolution.de, evolution.depart, "Taux initial"),
      preuve(id, evolution.a, evolution.arrivee, "Dernier taux publié"),
    ],
  };
}

function insightChomageJeunes(series: Series, pays?: Record<string, Territoire>): Insight | null {
  const jeunesId = "eurostat_chomage_jeunes";
  const ensembleId = "eurostat_chomage";
  const periode = periodeCommune([series[jeunesId], series[ensembleId]]);
  if (!periode) return null;
  const jeunes = series[jeunesId][periode];
  const ensemble = series[ensembleId][periode];
  if (!(jeunes >= 0) || !(ensemble > 0)) return null;
  const multiple = jeunes / ensemble;
  return {
    id: "chomage-jeunes",
    famille: "travail",
    surtitre: "Emploi · la moyenne masque l'âge",
    titre: `Le chômage des jeunes est ${ratio.format(multiple)} fois plus élevé`,
    texte: `En ${periode}, le taux harmonisé atteint ${nombre.format(jeunes)} % chez les 15-24 ans, contre ${nombre.format(ensemble)} % pour l'ensemble de la population active.`,
    reserve: "Le taux porte sur les jeunes actifs, pas sur l'ensemble des 15-24 ans, dont beaucoup étudient.",
    comparaison: comparaisonVoisins(pays, jeunesId, periode, "percent"),
    preuves: [
      preuve(jeunesId, periode, jeunes, "Chômage des 15-24 ans"),
      preuve(ensembleId, periode, ensemble, "Chômage de l'ensemble"),
    ],
  };
}

function insightPauvrete(series: Series): Insight | null {
  const tauxId = "insee_taux_pauvrete_60";
  const personnesId = "insee_personnes_pauvres_60";
  const periode = periodeCommune([series[tauxId], series[personnesId]]);
  if (!periode) return null;
  const taux = series[tauxId][periode];
  const personnes = series[personnesId][periode];
  if (!(taux >= 0) || !(personnes >= 0)) return null;
  return {
    id: "pauvrete",
    famille: "services",
    surtitre: "Niveaux de vie · ce que la moyenne nationale efface",
    titre: `${nombre.format(personnes / 1_000_000)} millions de personnes sous le seuil de pauvreté`,
    texte: `En ${periode}, ${nombre.format(taux)} % de la population vit avec moins de 60 % du niveau de vie médian. Le nombre et le taux décrivent deux faces du même phénomène.`,
    reserve: "Le seuil est relatif au niveau de vie médian : il évolue avec la distribution des revenus.",
    preuves: [
      preuve(personnesId, periode, personnes, "Personnes sous le seuil"),
      preuve(tauxId, periode, taux, "Taux de pauvreté"),
    ],
  };
}

function insightDensiteCarcerale(series: Series): Insight | null {
  const densiteId = "justice_densite_carcerale";
  const detenusId = "justice_personnes_detenues";
  const evolution = variation(series[densiteId]);
  if (!evolution) return null;
  const debutDetenus = series[detenusId]?.[evolution.de];
  const finDetenus = series[detenusId]?.[evolution.a];
  if (!(debutDetenus >= 0) || !(finDetenus >= 0)) return null;
  return {
    id: "densite-carcerale",
    famille: "securite",
    surtitre: "Justice · la capacité derrière la dépense",
    titre: `${nombre.format(evolution.arrivee)} détenus pour 100 places`,
    texte: `La population détenue est passée de ${nombre.format(debutDetenus)} à ${nombre.format(finDetenus)} personnes entre ${periodeLisible(evolution.de)} et ${periodeLisible(evolution.a)} ; la densité a gagné ${nombre.format(evolution.arrivee - evolution.depart)} points.`,
    reserve: "La densité nationale agrège des établissements et quartiers dont les situations diffèrent fortement.",
    preuves: [
      preuve(densiteId, evolution.de, evolution.depart, "Densité initiale"),
      preuve(densiteId, evolution.a, evolution.arrivee, "Dernière densité"),
      preuve(detenusId, evolution.de, debutDetenus, "Détenus au départ"),
      preuve(detenusId, evolution.a, finDetenus, "Détenus à l'arrivée"),
    ],
  };
}

export function insightsFrance(
  france: Territoire | undefined,
  catalogue: Indicateur[],
  pays?: Record<string, Territoire>,
): Insight[] {
  if (!france) return [];
  return [
    insightNiches(france.series),
    insightExecution(france.series, catalogue),
    insightCotisants(france.series),
    insightPensions(france.series),
    insightDefaillances(france.series),
    insightRedistribution(france.series),
    insightPoidsPersonnelEtat(france.series),
    insightPoidsImpotRevenu(france.series),
    insightDettePorteeParEtat(france.series),
    insightProtectionVieillesseSante(france.series),
    insightProtectionVieillesseFamille(france.series),
    insightRedistributionInterquintile(france.series),
    insightRedistributionBasEchelle(france.series),
    insightInteretsDette(france.series),
    insightPrelevements(france.series, pays),
    insightTauxEmploi(france.series, pays),
    insightChomageJeunes(france.series, pays),
    insightPauvrete(france.series),
    insightDensiteCarcerale(france.series),
    ...insightsFranceGeneriques(france.series, catalogue, pays),
  ].filter((insight): insight is Insight => insight !== null);
}
