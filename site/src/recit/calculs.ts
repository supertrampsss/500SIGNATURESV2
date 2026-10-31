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

/* ---------- Communes (OFGL) ---------- */

export type Ville = {
  nom: string; code: string; population?: number;
  annee: string; recettes: number; depenses: number; epargne: number;
  parts?: { fonctionnement: number; capital?: number; nette?: number; brute?: number };
  dette?: { annee: string; stock: number; precedent?: number; emprunts?: number; remboursements?: number };
  investissement?: { annee: string; montant: number };
  impots?: number; dotations?: number; services?: number;
};

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
  const pop = t.population ?? derniere(s.ofgl_population_reference)?.[1];
  return {
    nom: t.nom, code, population: fini(pop) && pop > 0 ? pop : undefined, annee, recettes, depenses, epargne, parts,
    dette, investissement: inv ? { annee: inv[0], montant: inv[1] } : undefined,
    impots: s.ofgl_impots_et_taxes?.[annee], dotations: s.ofgl_concours_de_l_etat?.[annee], services: s.ofgl_ventes_de_biens_et_services?.[annee],
  };
}
