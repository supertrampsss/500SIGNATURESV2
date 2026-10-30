/** Les comptes annuels du récit, partagés par le pré-rendu et le navigateur. */
import type { Territoire } from "./donnees.ts";

export const INDICATEURS_RECIT = {
  recettes: "eurostat_apu_recettes",
  depenses: "eurostat_apu_depenses",
} as const;

/** Métadonnées du jeu déclaré par le catalogue pour ces deux séries. */
export const SOURCE_RECIT = {
  producteur: "Eurostat",
  jeu: "eurostat-gov-10a-main",
  url: "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/gov_10a_main",
} as const;

export type ComptesRecit = {
  annee: string;
  recettes: number;
  depenses: number;
  depensesPour100: number;
  /** Dépenses moins recettes : positif en déficit, négatif en excédent. */
  ecartPour100: number;
  nature: "deficit" | "excedent" | "equilibre";
};

/**
 * Dernier exercice annuel commun exploitable. Les ventilations et le PIB ne
 * conditionnent pas les totaux : ils peuvent être publiés sur un autre rythme.
 * Les calculs gardent toute leur précision ; seul l'affichage est arrondi.
 */
export function comptesRecit(france?: Territoire): ComptesRecit | null {
  if (!france) return null;
  const recettes = france.series[INDICATEURS_RECIT.recettes] ?? {};
  const depenses = france.series[INDICATEURS_RECIT.depenses] ?? {};
  const annees = Object.keys(recettes).filter((annee) => /^\d{4}$/.test(annee)).sort().reverse();
  for (const annee of annees) {
    const r = recettes[annee];
    const d = depenses[annee];
    if (!Number.isFinite(r) || !Number.isFinite(d) || r <= 0 || d < 0) continue;
    const ecart = d - r;
    const depensesPour100 = d / r * 100;
    const ecartPour100 = ecart / r * 100;
    if (!Number.isFinite(depensesPour100) || !Number.isFinite(ecartPour100)) continue;
    return {
      annee, recettes: r, depenses: d, depensesPour100, ecartPour100,
      nature: ecart > 0 ? "deficit" : ecart < 0 ? "excedent" : "equilibre",
    };
  }
  return null;
}

const nombreFrancais = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

/** Deux décimales au plus, sans faire passer un petit montant pour zéro. */
export function formaterRecit(nombre: number): string {
  if (nombre > 0 && nombre < 0.01) return "< 0,01";
  if (nombre < 0 && nombre > -0.01) return "> -0,01";
  return nombreFrancais.format(nombre === 0 ? 0 : nombre);
}
