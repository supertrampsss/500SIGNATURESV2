import type { DossierAnalyseValide, VisualisationAnalyse } from "./analyse-contrat.ts";
import { formaterValeurAnalyse, libelleUniteAnalyse } from "./echelle.ts";
import { echapper } from "./texte.ts";

/** Figures statiques : même lecture avec ou sans JavaScript. Chaque unité a
 * sa propre échelle, les barres partent de zéro, les dates gardent leur écart. */
export function graphiqueAnalyse(v: VisualisationAnalyse, contrat: DossierAnalyseValide): string {
  const series = (v.seriesIds ?? []).map(id => contrat.serieParId.get(id)!);
  if (!series.length) {
    const preuves = (v.preuveIds ?? []).map(id => contrat.preuveParId.get(id)!);
    if (v.type !== "bar" || !preuves.length || !preuves[0]!.comparableGroup ||
      preuves.some(p => p.unit !== preuves[0]!.unit || p.comparableGroup !== preuves[0]!.comparableGroup || p.value < 0)) return "";
    const maximum = Math.max(...preuves.map(p => p.value)) || 1;
    return `<ul class="analyse-bars">${preuves.map(p => `<li><div><span>${echapper(p.libelle)}</span><strong>${echapper(formaterValeurAnalyse(p.value, p.unit))} ${echapper(libelleUniteAnalyse(p.unit))}</strong></div><span class="analyse-bars__rail" aria-hidden="true"><span style="width:${p.value / maximum * 100}%"></span></span><small>${echapper(p.period)}</small></li>`).join("")}</ul>`;
  }
  return [...new Set(series.map(s => s.unit))].map(unit => {
    const groupe = series.filter(s => s.unit === unit);
    const valeurs = groupe.flatMap(s => s.observations.map(o => o.value));
    const bas = Math.min(0, ...valeurs);
    const haut = Math.max(0, ...valeurs) || 1;
    const y = (value: number) => 220 - (value - bas) / (haut - bas) * 190;
    const date = (period: string) => {
      const match = /^(\d{4})(?:-(?:S|H)([12]))?$/.exec(period);
      return match ? Number(match[1]) + (Number(match[2] ?? 1) - 1) / 2 : NaN;
    };
    const periodes = [...new Set(groupe.flatMap(s => s.observations.map(o => o.period)))].sort();
    const dates = periodes.map(date);
    const calendrier = dates.every(Number.isFinite);
    const position = (period: string) => calendrier ? date(period) : periodes.indexOf(period);
    const debut = position(periodes[0]!);
    const fin = position(periodes.at(-1)!);
    const x = (period: string) => 66 + (fin === debut ? .5 : (position(period) - debut) / (fin - debut)) * 574;
    const grille = [bas, bas + (haut - bas) / 2, haut].map(value => `<g class="analyse-chart__grille"><line x1="66" x2="640" y1="${y(value)}" y2="${y(value)}"/><text x="56" y="${y(value) + 4}" text-anchor="end">${echapper(formaterValeurAnalyse(value, unit))}</text></g>`).join("");
    const traces = groupe.map((serie, index) => {
      const observations = [...serie.observations].sort((a, b) => position(a.period) - position(b.period));
      const points = observations.map(o => `${x(o.period)},${y(o.value)}`).join(" ");
      const largeur = Math.min(32, 480 / Math.max(1, periodes.length) / groupe.length);
      return `<g class="analyse-chart__serie analyse-chart__serie--${index % 4}">${v.type === "bar" ? observations.map(o => `<rect x="${x(o.period) + (index - groupe.length / 2) * largeur}" y="${Math.min(y(o.value), y(0))}" width="${largeur - 2}" height="${Math.abs(y(o.value) - y(0))}" fill="currentColor"><title>${echapper(serie.libelle)} · ${echapper(o.period)} : ${echapper(formaterValeurAnalyse(o.value, unit))}</title></rect>`).join("") : `<polyline points="${points}"/>${observations.map(o => `<circle cx="${x(o.period)}" cy="${y(o.value)}" r="4"><title>${echapper(serie.libelle)} · ${echapper(o.period)} : ${echapper(formaterValeurAnalyse(o.value, unit))} ${echapper(libelleUniteAnalyse(unit))}</title></circle>`).join("")}`}</g>`;
    }).join("");
    const labels = periodes.filter((_, i) => i === 0 || i === periodes.length - 1 || (periodes.length <= 6)).map(period => `<text x="${x(period)}" y="248" text-anchor="${period === periodes[0] ? "start" : period === periodes.at(-1) ? "end" : "middle"}">${echapper(period)}</text>`).join("");
    return `<div class="analyse-chart"><p class="analyse-chart__unite">${echapper(libelleUniteAnalyse(unit))}</p><svg viewBox="0 0 680 265" role="img" aria-label="${echapper(v.titre)} (${echapper(libelleUniteAnalyse(unit))}). Les valeurs sont disponibles dans le tableau ci-dessous.">${grille}${traces}<g class="analyse-chart__dates">${labels}</g></svg><ul class="analyse-chart__legende">${groupe.map((s, i) => `<li class="analyse-chart__cle analyse-chart__cle--${i % 4}">${echapper(s.libelle)}</li>`).join("")}</ul></div>`;
  }).join("");
}
