/**
 * Calculs du récit, purs et partagés par le pré-rendu et le navigateur.
 * Chaque fonction lit des séries publiées et rend `undefined` quand la donnée manque :
 * une étape sans donnée disparaît, elle n'est jamais affichée à zéro.
 */
import type { Territoire } from "../donnees.ts";

type Serie = Record<string, number>;
const series = (t?: Territoire) => (t?.series ?? {}) as Record<string, Serie>;
const fini = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Dernière année présente dans toutes les séries données. */
export function anneeCommune(liste: (Serie | undefined)[]): string | undefined {
  const [premiere, ...autres] = liste;
  return Object.keys(premiere ?? {}).filter(a => /^\d{4}$/.test(a) && fini(premiere![a]) && autres.every(s => fini(s?.[a]))).sort().at(-1);
}

/** Dernière valeur d'une série, quelle que soit sa période (année ou trimestre). */
export function derniere(serie?: Serie): [string, number] | undefined {
  const cle = Object.keys(serie ?? {}).filter(k => fini(serie![k])).sort().at(-1);
  return cle ? [cle, serie![cle]] : undefined;
}

export const SOURCES = {
  eurostat: { nom: "Eurostat", titre: "Comptes des administrations publiques (gov_10a_main, gov_10dd_edpt1)", url: "https://ec.europa.eu/eurostat/databrowser/view/gov_10a_main/default/table" },
  insee: { nom: "Insee", titre: "Dette trimestrielle de Maastricht des administrations publiques", url: "https://www.insee.fr/fr/statistiques/serie/010596747" },
  budget: { nom: "Direction du Budget", titre: "Rapport sur les pensions de retraite de la fonction publique, annexe au PLF 2027", url: "https://www.budget.gouv.fr/documentation/documents-budgetaires" },
  ocde: { nom: "OCDE", titre: "Taxing Wages 2026, France, données 2025", url: "https://www.oecd.org/en/publications/taxing-wages_20725124.html" },
  ofgl: { nom: "OFGL", titre: "Comptes des communes (balances comptables DGFiP)", url: "https://data.ofgl.fr/" },
  fonctions: { nom: "DGFiP", titre: "Balances comptables des collectivités, présentation croisée nature-fonction", url: "https://data.economie.gouv.fr/explore/dataset/balances-comptables-des-collectivites-et-des-etablissements-publics-locaux-avec-la-presentation-croisee-nature-fonction-2025/" },
  fiscalite: { nom: "DGFiP", titre: "Fiscalité locale des particuliers et recensement des éléments d’imposition", url: "https://data.economie.gouv.fr/explore/dataset/fiscalite-locale-des-particuliers/" },
  associations: { nom: "Direction du Budget", titre: "Effort financier de l’État en faveur des associations, versements 2021", url: "https://data.economie.gouv.fr/explore/dataset/plf-2023-effort-financier-de-l-etat-en-faveur-des-associations-liste-des-credits/" },
  ssmsi: { nom: "SSMSI, ministère de l’Intérieur", titre: "Délinquance enregistrée par la police et la gendarmerie, par commune", url: "https://www.data.gouv.fr/fr/datasets/bases-statistiques-communale-et-departementale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales/" },
  territoires: { nom: "Insee, SDES, Éducation nationale", titre: "Recensement, revenus localisés (Filosofi), parc social (RPLS), annuaire de l’éducation", url: "https://www.insee.fr/fr/statistiques" },
} as const;

export type Comptes = { annee: string; recettes: number; depenses: number; ecart: number; nature: "deficit" | "excedent" | "equilibre" };

/** Dernier exercice où recettes et dépenses publiques sont toutes deux publiées. */
export function comptes(france?: Territoire): Comptes | undefined {
  const s = series(france);
  const annee = anneeCommune([s.eurostat_apu_recettes, s.eurostat_apu_depenses]);
  if (!annee) return;
  const recettes = s.eurostat_apu_recettes[annee], depenses = s.eurostat_apu_depenses[annee];
  if (!(recettes > 0) || !(depenses >= 0)) return;
  const ecart = depenses - recettes;
  return { annee, recettes, depenses, ecart, nature: ecart > 0 ? "deficit" : ecart < 0 ? "excedent" : "equilibre" };
}

/** Prélèvements obligatoires en part du PIB, dernière année publiée. */
export function prelevements(france?: Territoire): { annee: string; part: number } | undefined {
  const d = derniere(series(france).eurostat_prelevements_obligatoires_pib);
  return d && /^\d{4}$/.test(d[0]) ? { annee: d[0], part: d[1] } : undefined;
}

export type Dette = { periode: string; stock: number; partPib?: number; interets?: { annee: string; montant: number } };

/** Dette de Maastricht (Insee, trimestrielle) et intérêts versés (Eurostat, annuels). */
export function dette(france?: Territoire): Dette | undefined {
  const s = series(france);
  const stock = derniere(s.insee_dette_apu_montant);
  if (!stock || !(stock[1] > 0)) return;
  const part = s.insee_dette_apu_part_pib?.[stock[0]];
  const interets = derniere(s.eurostat_apu_interets);
  return {
    periode: stock[0], stock: stock[1], partPib: fini(part) ? part : undefined,
    interets: interets && /^\d{4}$/.test(interets[0]) ? { annee: interets[0], montant: interets[1] } : undefined,
  };
}

/** « 2026-Q1 » → « fin du 1er trimestre 2026 ». */
export function periodeLisible(periode: string): string {
  const m = /^(\d{4})-Q([1-4])$/.exec(periode);
  if (!m) return periode;
  return `fin du ${m[2] === "1" ? "1er" : `${m[2]}e`} trimestre ${m[1]}`;
}

export type Poste = { nom: string; part: number };

/** Dépenses publiques pour 100 € de recettes, par poste (Eurostat, dernière année complète). */
export function repartition(france?: Territoire): { annee: string; total: number; postes: Poste[] } | undefined {
  const s = series(france);
  const ids: [string, string][] = [
    ["eurostat_apu_prestations_vieillesse", "Retraites"], ["eurostat_apu_remunerations", "Rémunérations des agents publics"],
    ["eurostat_apu_transferts_nature", "Soins et services remboursés"], ["eurostat_apu_consommations", "Achats de biens et services"],
    ["eurostat_apu_investissement", "Investissement"], ["eurostat_apu_interets", "Intérêts de la dette"],
    ["eurostat_apu_prestations_chomage", "Chômage"], ["eurostat_apu_prestations_famille", "Famille et enfants"],
    ["eurostat_apu_prestations_exclusion", "RSA et minima sociaux"],
  ];
  const annee = anneeCommune([s.eurostat_apu_recettes, s.eurostat_apu_depenses, s.eurostat_apu_prestations_survivants, ...ids.map(([id]) => s[id])]);
  if (!annee || !(s.eurostat_apu_recettes[annee] > 0)) return;
  const r = s.eurostat_apu_recettes[annee], total = s.eurostat_apu_depenses[annee] / r * 100;
  const postes = ids.map(([id, nom]) => ({ nom, part: (s[id][annee] + (id === "eurostat_apu_prestations_vieillesse" ? s.eurostat_apu_prestations_survivants[annee] : 0)) / r * 100 }));
  postes.push({ nom: "Autres dépenses", part: total - postes.reduce((a, p) => a + p.part, 0) });
  return { annee, total, postes };
}

/** Part des pensions dans les crédits de l'Éducation nationale (Direction du Budget, PLF 2027). */
export const PENSIONS_EDUCATION = { part: 32, pensions: 28.5, credits: 89.1, annee: "2027" } as const;

/** OCDE, Taxing Wages 2026, France 2025 : célibataire sans enfant au salaire moyen, en % du coût employeur. */
export const PAIE = { patronales: 26.7, salariales: 8.3, impot: 12.2, reste: 52.8 } as const;

export const PAYS_EUROPE: readonly [string, string][] = [["FR", "France"], ["DE", "Allemagne"], ["IT", "Italie"], ["ES", "Espagne"]];
export type Comparaison = { annee: string; valeurs: { code: string; nom: string; valeur: number }[] };

/** Un indicateur en % du PIB pour les quatre pays, sur leur dernière année commune. */
export function comparaison(pays: Record<string, Territoire | undefined>, indicateur: string): Comparaison | undefined {
  const liste = PAYS_EUROPE.map(([code]) => series(pays[code])[indicateur]);
  const annee = anneeCommune(liste);
  if (!annee) return;
  return { annee, valeurs: PAYS_EUROPE.map(([code, nom], i) => ({ code, nom, valeur: liste[i]![annee] })) };
}

/* ---------- Communes (OFGL, DGFiP, SSMSI, Insee) ---------- */

/** Faits et délits enregistrés (SSMSI), du plus grave au plus courant ; taux pour 1 000 habitants. */
export const DELITS: readonly [string, string][] = [
  ["violences_hors_famille", "Violences physiques hors famille"], ["violences_intrafamiliales", "Violences dans la famille"],
  ["violences_sexuelles", "Violences sexuelles"], ["vols_violents", "Vols avec violence"], ["cambriolages", "Cambriolages"],
  ["vols_sans_violence", "Vols sans violence"], ["vols_dans_vehicules", "Vols dans les véhicules"], ["vols_vehicules", "Vols de véhicules"],
  ["degradations", "Dégradations"], ["trafic_stupefiants", "Trafic de stupéfiants"],
];

/** Les repères nationaux qu'une commune peut regarder en face : même définition, même année. */
export type RepereFrance = { delits?: { annee: string; taux: Record<string, number> }; pauvrete?: [string, number]; niveauVie?: [string, number]; salaire?: [string, number] };

export function repereFrance(fr?: Territoire): RepereFrance {
  const s = series(fr);
  const r: RepereFrance = {};
  const annee = derniere(s.ssmsi_violences_hors_famille_nombre)?.[0];
  const pop = annee ? s.eurostat_population?.[annee] : undefined;
  if (annee && fini(pop) && pop > 0) {
    const taux = Object.fromEntries(DELITS.flatMap(([id]) => { const n = s[`ssmsi_${id}_nombre`]?.[annee]; return fini(n) ? [[id, n / pop * 1000]] : []; }));
    if (Object.keys(taux).length) r.delits = { annee, taux };
  }
  const p = derniere(s.insee_taux_pauvrete_60); if (p) r.pauvrete = p;
  const n = derniere(s.insee_niveau_vie_d5); if (n) r.niveauVie = n;
  const w = derniere(s.insee_salaire_net_eqtp_mensuel); if (w) r.salaire = w;
  return r;
}

type Ligne = [string, number];
/** Les six postes communs aux nomenclatures M14 et M57 (pipeline : fonctions_communes.py). */
const MISSIONS_COMMUNE: Record<string, string> = {
  services_generaux: "Administration générale", enseignement: "Écoles et formation", culture_sport: "Culture, sport, jeunesse",
  social_famille: "Social, santé, famille", amenagement_economie: "Urbanisme, logement, environnement", securite: "Sécurité et salubrité",
};

export type Ville = {
  nom: string; code: string; population?: number;
  annee: string; recettes: number; depenses: number; epargne: number;
  parts?: { fonctionnement: number; capital?: number; nette?: number; brute?: number };
  dette?: { annee: string; stock: number; precedent?: number; emprunts?: number; remboursements?: number };
  investissement?: { annee: string; montant: number; lignes: Ligne[] };
  impots?: number; dotations?: number; services?: number;
  /** Ce qui rentre et ce qui sort dans l'année, poste par poste ; « Autres » complète au total publié. */
  entrees?: Ligne[]; sorties?: Ligne[];
  missions?: { annee: string; lignes: Ligne[] };
  associations?: { annee: string; montant: number; etat?: { annee: string; montant: number; nombre?: number } };
  foncier?: { annee: string; taux: number; tauxGlobal?: number; lignes: Ligne[] };
  delits?: { annee: string; lignes: [string, string, number, number][] };
  portrait?: { pauvrete?: [string, number]; niveauVie?: [string, number]; salaire?: [string, number]; chomage?: [string, number]; logementsSociaux?: [string, number]; ecoles?: [string, number]; colleges?: [string, number] };
};

/** Postes non nuls d'une même année, complétés d'une ligne « Autres » quand le total publié l'exige. */
function postes(s: Record<string, Serie>, annee: string, total: number, ids: [string, string][]): Ligne[] | undefined {
  const lignes = ids.flatMap(([id, nom]) => { const v = s[id]?.[annee]; return fini(v) && v > 0 ? [[nom, v] as Ligne] : []; }).sort((a, b) => b[1] - a[1]);
  if (lignes.length < 2) return;
  const reste = total - lignes.reduce((a, l) => a + l[1], 0);
  if (reste > total * .005) lignes.push(["Autres", reste]);
  return lignes;
}

/** Une valeur et son année, la dernière publiée. */
const dernier = (s?: Serie): [string, number] | undefined => { const d = derniere(s); return d && /^\d{4}$/.test(d[0]) ? d : undefined; };

/** Le dernier exercice où recettes, dépenses et épargne brute de fonctionnement se recoupent. */
export function ville(t: Territoire, code: string): Ville | undefined {
  const s = series(t);
  const r = s.ofgl_recettes_fonctionnement ?? {}, d = s.ofgl_depenses_fonctionnement ?? {}, b = s.ofgl_epargne_brute ?? {};
  const annee = Object.keys(r).filter(a => r[a] > 0 && fini(d[a]) && fini(b[a]) && Math.abs(r[a] - d[a] - b[a]) < Math.max(1, r[a] * 1e-5)).sort().at(-1);
  if (!annee) return;
  const recettes = r[annee], depenses = d[annee], epargne = b[annee];
  const capital = s.ofgl_remboursements_d_emprunts_hors_gad?.[annee], nette = s.ofgl_epargne_nette?.[annee];
  const complet = depenses >= 0 && epargne >= 0 && fini(capital) && fini(nette) && capital >= 0 && nette >= 0 && Math.abs(epargne - capital - nette) < Math.max(1, recettes * 1e-5);
  const parts = complet ? { fonctionnement: depenses / recettes * 100, capital: capital / recettes * 100, nette: nette / recettes * 100 }
    : depenses >= 0 && epargne >= 0 ? { fonctionnement: depenses / recettes * 100, brute: epargne / recettes * 100 } : undefined;
  const stock = derniere(s.ofgl_encours_dette);
  const dette = stock ? {
    annee: stock[0], stock: stock[1], precedent: s.ofgl_encours_dette?.[String(Number(stock[0]) - 1)],
    emprunts: s.ofgl_emprunts_hors_gad?.[stock[0]], remboursements: s.ofgl_remboursements_d_emprunts_hors_gad?.[stock[0]],
  } : undefined;
  const inv = derniere(s.ofgl_depenses_d_investissement_hors_remb);
  const p0 = t.population ?? derniere(s.ofgl_population_reference)?.[1];
  const population = fini(p0) && p0 > 0 ? p0 : undefined;

  const entrees = postes(s, annee, recettes, [["ofgl_impots_locaux", "Impôts locaux"], ["ofgl_autres_impots_et_taxes", "Autres impôts et taxes"], ["ofgl_concours_de_l_etat", "Dotations de l’État"], ["ofgl_ventes_de_biens_et_services", "Cantines, crèches, piscines…"], ["ofgl_subventions_recues_et_participations", "Subventions reçues"]]);
  const sorties = postes(s, annee, depenses, [["ofgl_frais_personnel", "Salaires des agents"], ["ofgl_achats_et_charges_externes", "Achats et entretien"], ["ofgl_depenses_d_intervention", "Aides et subventions versées"], ["ofgl_charges_financieres", "Intérêts de la dette"]]);

  const fonctions = Object.keys(s).filter(k => k.startsWith("fonction_commune_") && !k.endsWith("retraitements_ofgl"));
  const anMissions = anneeCommune(fonctions.map(k => s[k]));
  const missions = anMissions ? fonctions.flatMap(k => { const v = s[k][anMissions]; const id = k.slice("fonction_commune_".length); return v > 0 ? [[MISSIONS_COMMUNE[id] ?? id.replace(/_/g, " ").replace(/^./, c => c.toUpperCase()), v] as Ligne] : []; }).sort((a, b) => b[1] - a[1]) : [];

  const asso = dernier(s.ofgl_subventions_aux_personnes_de_droit_prive), etat = dernier(s.etat_subventions_associations);
  const nbAsso = etat ? s.etat_subventions_associations_etablissements?.[etat[0]] : undefined;

  const taux = dernier(s.dgfip_taux_tfb_commune);
  const foncier = taux ? { annee: taux[0], taux: taux[1], tauxGlobal: s.dgfip_taux_tfb_global?.[taux[0]], lignes: ([["dgfip_produit_foncier_bati", "Taxe foncière, part communale"], ["dgfip_taxe_fonciere_ordures_menageres", "Ordures ménagères"], ["dgfip_produit_th_residences_secondaires", "Résidences secondaires"], ["dgfip_produit_foncier_non_bati", "Terrains non bâtis"]] as [string, string][]).flatMap(([id, nom]) => { const v = s[id]?.[taux[0]]; return fini(v) && v > 0 ? [[nom, v] as Ligne] : []; }) } : undefined;

  const anDelits = derniere(s.ssmsi_violences_hors_famille_nombre)?.[0];
  const delits = anDelits && population ? { annee: anDelits, lignes: DELITS.flatMap(([id, nom]) => { const n = s[`ssmsi_${id}_nombre`]?.[anDelits]; return fini(n) ? [[id, nom, n, n / population * 1000] as [string, string, number, number]] : []; }) } : undefined;

  const actifs = dernier(s.insee_actifs), chomeurs = actifs ? s.insee_chomeurs_rp?.[actifs[0]] : undefined;
  const sociaux = dernier(s.rpls_logements_sociaux), menages = derniere(s.insee_residences_principales);
  const portrait = {
    pauvrete: dernier(s.insee_taux_pauvrete), niveauVie: dernier(s.insee_niveau_vie_median), salaire: dernier(s.insee_salaire_net_eqtp_mensuel),
    chomage: actifs && fini(chomeurs) && actifs[1] > 0 ? [actifs[0], chomeurs / actifs[1] * 100] as [string, number] : undefined,
    logementsSociaux: sociaux && menages && menages[1] > 0 ? [sociaux[0], sociaux[1] / menages[1] * 100] as [string, number] : undefined,
    ecoles: dernier(s.menj_ecoles), colleges: dernier(s.menj_colleges_lycees),
  };

  return {
    nom: t.nom, code, population, annee, recettes, depenses, epargne, parts, dette,
    investissement: inv ? { annee: inv[0], montant: inv[1], lignes: postes(s, inv[0], inv[1], [["ofgl_depenses_d_equipement", "Travaux et équipements"], ["ofgl_subventions_d_equipement_versees", "Aides aux projets d’autres acteurs"]]) ?? [] } : undefined,
    impots: s.ofgl_impots_et_taxes?.[annee], dotations: s.ofgl_concours_de_l_etat?.[annee], services: s.ofgl_ventes_de_biens_et_services?.[annee],
    entrees, sorties,
    missions: anMissions && missions.length >= 2 ? { annee: anMissions, lignes: missions } : undefined,
    associations: asso && asso[1] > 0 ? { annee: asso[0], montant: asso[1], etat: etat && etat[1] > 0 ? { annee: etat[0], montant: etat[1], nombre: fini(nbAsso) ? nbAsso : undefined } : undefined } : undefined,
    foncier: foncier && foncier.taux > 0 ? foncier : undefined,
    delits: delits && delits.lignes.length >= 3 ? delits : undefined,
    portrait: Object.values(portrait).some(Boolean) ? portrait : undefined,
  };
}
