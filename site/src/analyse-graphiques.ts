import type { DossierAnalyseValide, SerieAnalyse, VisualisationAnalyse } from "./analyse-contrat.ts";
import { libelleUniteAnalyse, valeurEtUniteAnalyse } from "./echelle.ts";
import { echapper } from "./texte.ts";

function periodeNumerique(period: string): number {
  const match = /^(\d{4})(?:-(?:S|H)([12]))?$/.exec(period);
  return match ? Number(match[1]) + (Number(match[2] ?? 1) - 1) / 2 : NaN;
}

/** Deux compositions SVG, et non un graphique desktop rétréci jusqu'à rendre
 * ses axes illisibles. Le CSS ne montre qu'une composition à la fois. */
function traceSeries(v: VisualisationAnalyse, groupe: SerieAnalyse[], unit: string, compact: boolean): string {
  const largeurSVG = compact ? 340 : 680;
  const gauche = 58;
  const droite = largeurSVG - 22;
  const valeurs = groupe.flatMap(s => s.observations.map(o => o.value));
  const bas = Math.min(0, ...valeurs);
  const haut = Math.max(0, ...valeurs) || 1;
  const y = (value: number) => 215 - (value - bas) / (haut - bas) * 185;
  const periodes = [...new Set(groupe.flatMap(s => s.observations.map(o => o.period)))].sort();
  const largeurBarre = Math.max(3, Math.min(32, (droite - gauche) * .8 / Math.max(1, periodes.length) / groupe.length));
  const margeBarre = v.type === "bar" ? largeurBarre * groupe.length / 2 + 4 : 0;
  const calendrier = periodes.every(p => Number.isFinite(periodeNumerique(p)));
  const position = (period: string) => calendrier ? periodeNumerique(period) : periodes.indexOf(period);
  const debut = position(periodes[0]!);
  const fin = position(periodes.at(-1)!);
  const x = (period: string) => gauche + margeBarre + (fin === debut ? .5 : (position(period) - debut) / (fin - debut)) * (droite - gauche - 2 * margeBarre);
  const nombre = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 4 }).format(value);
  const grille = [bas, bas + (haut - bas) / 2, haut].map(value => `<g class="analyse-chart__grille"><line x1="${gauche}" x2="${droite}" y1="${y(value)}" y2="${y(value)}"/><text x="${gauche - 8}" y="${y(value) + 4}" text-anchor="end">${echapper(nombre(value))}</text></g>`).join("");
  const traces = groupe.map((serie, index) => {
    const observations = [...serie.observations].sort((a, b) => position(a.period) - position(b.period));
    const titre = (o: {period: string; value: number}) => `<title>${echapper(serie.libelle)} · ${echapper(o.period)} : ${echapper(valeurEtUniteAnalyse(o.value, unit))}</title>`;
    // Une rupture ou plusieurs années non observées ne deviennent pas une
    // trajectoire continue. Les observations restent toutes consultables.
    const segments = observations.slice(1).flatMap((o, i) => {
      const precedent = observations[i]!;
      if (o.qualityFlags?.some(f => f.includes("rupture")) ||
        (calendrier && position(o.period) - position(precedent.period) > 1)) return [];
      return [`<polyline points="${x(precedent.period)},${y(precedent.value)} ${x(o.period)},${y(o.value)}"/>`];
    }).join("");
    const largeur = largeurBarre;
    const dessin = v.type === "bar"
      ? observations.map(o => `<rect x="${x(o.period) + (index - groupe.length / 2) * largeur}" y="${Math.min(y(o.value), y(0))}" width="${largeur - 2}" height="${Math.abs(y(o.value) - y(0))}" fill="currentColor">${titre(o)}</rect>`).join("")
      : segments + observations.map(o => `<circle cx="${x(o.period)}" cy="${y(o.value)}" r="4">${titre(o)}</circle>`).join("");
    return `<g class="analyse-chart__serie analyse-chart__serie--${index % 4}">${dessin}</g>`;
  }).join("");
  const labels = periodes.filter((_, i) => i === 0 || i === periodes.length - 1 || (compact ? i === Math.floor(periodes.length / 2) : periodes.length <= 6)).map(period => `<text x="${x(period)}" y="246" text-anchor="${period === periodes[0] ? "start" : period === periodes.at(-1) ? "end" : "middle"}">${echapper(period)}</text>`).join("");
  return `<svg class="analyse-chart__${compact ? "mobile" : "desktop"}" viewBox="0 0 ${largeurSVG} 265" role="img" aria-label="${echapper(v.titre)} (${echapper(libelleUniteAnalyse(unit))}). ${echapper(groupe.map(s => s.libelle + " : " + s.observations.map(o => o.period + ", " + nombre(o.value)).join(" ; ")).join(". "))}">${grille}${traces}<g class="analyse-chart__dates">${labels}</g></svg>`;
}

/** Rendu statique. Une échelle par unité ; barres avec origine à zéro. */
export function graphiqueAnalyse(v: VisualisationAnalyse, contrat: DossierAnalyseValide): string {
  const series = (v.seriesIds ?? []).map(id => contrat.serieParId.get(id)!);
  if (!series.length) {
    const preuves = (v.preuveIds ?? []).map(id => contrat.preuveParId.get(id)!);
    if (v.type !== "bar" || !preuves.length || !preuves[0]!.comparableGroup ||
      preuves.some(p => p.unit !== preuves[0]!.unit || p.comparableGroup !== preuves[0]!.comparableGroup || p.value < 0)) return "";
    const maximum = Math.max(...preuves.map(p => p.value)) || 1;
    return `<ul class="analyse-bars">${preuves.map(p => `<li><div><span>${echapper(p.libelle)}</span><strong>${echapper(valeurEtUniteAnalyse(p.value, p.unit))}</strong></div><span class="analyse-bars__rail" aria-hidden="true"><span style="width:${p.value / maximum * 100}%"></span></span><small>${echapper(p.period)}</small></li>`).join("")}</ul>`;
  }
  return [...new Set(series.map(s => s.unit))].map(unit => {
    const groupe = series.filter(s => s.unit === unit);
    return `<div class="analyse-chart">${traceSeries(v, groupe, unit, false)}${traceSeries(v, groupe, unit, true)}<ul class="analyse-chart__legende">${groupe.map((s, i) => `<li class="analyse-chart__cle analyse-chart__cle--${i % 4}">${echapper(s.libelle)}</li>`).join("")}</ul></div>`;
  }).join("");
}

