import type { ChartSeries } from "./chart-studio.ts";
import type { Indicateur } from "./donnees.ts";
import type { Insight } from "./insights.ts";
import type { Territoire } from "./donnees.ts";
import { formater } from "./echelle.ts";
import { nomPays } from "./pays-noms.ts";

/** Quatre grands voisins continentaux : assez pour situer la France sans
 * transformer chaque carte en tableau. Un pays sans la valeur du même
 * exercice disparaît ; aucune donnée ancienne n'est recyclée. */
const VOISINS = ["DE", "BE", "ES", "IT"] as const;

export function comparaisonVoisins(
  pays: Record<string, Territoire> | undefined,
  indicateur: string,
  periode: string,
  unite: string,
): string | undefined {
  if (!pays) return undefined;

  const valeurs = VOISINS.flatMap((code) => {
    const valeur = pays[code]?.series[indicateur]?.[periode];
    return Number.isFinite(valeur)
      ? [`${nomPays(code)} ${formater(valeur, unite, false, indicateur)}`]
      : [];
  });

  // Une valeur isolée n'est pas une comparaison européenne.
  if (valeurs.length < 2) return undefined;
  return `Voisins européens : ${valeurs.join(" · ")}.`;
}


const PAYS_UE = ["FR", "DE", "AT", "BE", "BG", "CY", "HR", "DK", "ES", "EE", "FI", "EL", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "CZ", "RO", "SK", "SI", "SE"];

/** Same Eurostat indicator, frequency and observation window for every country. */
export function courbesEurope(
  france: Record<string, number>,
  pays: Record<string, Territoire> | undefined,
  indicateur: string,
  debut?: string,
  fin?: string,
): ChartSeries[] {
  if (!indicateur.startsWith("eurostat_")) return [];
  const periods = Object.keys(france).filter(p => Number.isFinite(france[p])).sort();
  if (!periods.length) return [];
  const from = debut ?? periods[0], to = fin ?? periods.at(-1)!;
  const frequency = (p: string) => /^\d{4}$/.test(p) ? "annual" : /^\d{4}-Q[1-4]$/.test(p) ? "quarterly" : /^\d{4}-\d{2}$/.test(p) ? "monthly" : "other";
  const frequencies = new Set(periods.map(frequency));
  return PAYS_UE.flatMap((code, index) => {
    const source = code === "FR" ? france : pays?.[code]?.series[indicateur];
    const values = Object.fromEntries(Object.entries(source ?? {}).filter(([p,v]) =>
      Number.isFinite(v) && p >= from && p <= to && frequencies.has(frequency(p))));
    return Object.keys(values).length ? [{name: nomPays(code), values,
      color: code === "FR" ? "#1763c6" : `hsl(${(index * 137.508) % 360} 48% 43%)`,
      emphasized: code === "FR"}] : [];
  });
}

/** Enrich observed Eurostat curves only; custom ratios and national definitions stay intact. */
export function avecCourbesEurope(insight: Insight, france: Territoire["series"], catalogue: Indicateur[], pays?: Record<string, Territoire>): Insight {
  if (insight.graphique) return insight;
  const ids = [...new Set(insight.preuves.map(p => p.indicateur))];
  if (!ids.length || ids.some(id => !id.startsWith("eurostat_"))) return insight;
  const indicators = ids.map(id => catalogue.find(i => i.id === id));
  if (indicators.some(i => !i) || indicators.some(i => i!.unite !== indicators[0]!.unite)) return insight;
  const curves = ids.flatMap((id, index) => courbesEurope(france[id] ?? {}, pays, id).map(s => ({
    ...s, name: ids.length > 1 ? `${s.name} · ${indicators[index]!.libelle}` : s.name,
    dashed: index > 0,
  })));
  if (!curves.some(s => !s.emphasized)) return insight;
  const rawUnit = indicators[0]!.unite;
  const maximum = Math.max(...curves.flatMap(s => Object.values(s.values)).map(Math.abs));
  const scale = rawUnit === "EUR" ? maximum >= 1e9 ? 1e9 : maximum >= 1e6 ? 1e6 : 1 : 1;
  const unit = rawUnit === "EUR" ? scale === 1e9 ? "Md€" : scale === 1e6 ? "M€" : "€"
    : rawUnit === "percent" ? "%" : rawUnit === "annees" ? "ans" : rawUnit === "ratio" ? "ratio" : rawUnit;
  return {...insight, graphique: {
    titre: `${ids.length === 1 ? indicators[0]!.libelle : insight.surtitre} · Union européenne`,
    unite: unit,
    series: curves.map(s => ({...s, values: Object.fromEntries(Object.entries(s.values).map(([p,v]) => [p,v/scale]))})),
  }};
}
