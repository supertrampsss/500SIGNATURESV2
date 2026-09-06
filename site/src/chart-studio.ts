/** Original SVG/HTML charts. Rendering is pure; interaction lives in chart-controls.ts. */
export type ChartSeries = { name: string; values: Record<string, number>; dashed?: boolean; pointsOnly?: boolean };
export type ChartOptions = { title: string; description: string; series: ChartSeries[]; unit: string; format: (value: number) => string; gap?: boolean };
export const escapeChart = (text: string): string => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

export function chartPeriods(series: ChartSeries[]): string[] {
  return [...new Set(series.flatMap(s => Object.keys(s.values).filter(p => Number.isFinite(s.values[p]))))].sort();
}
export function chartReadout(options: ChartOptions, period: string): string {
  return `<b>${escapeChart(period)}</b><span class="chart-readout__values">${options.series.map((s, i) => `<span class="chart-key chart-key--${i}"><span>${escapeChart(s.name)}</span><strong>${Number.isFinite(s.values[period]) ? escapeChart(options.format(s.values[period])) : 'Non publié'}</strong></span>`).join('')}</span>`;
}

export function timeChart(options: ChartOptions): string {
  const periods = chartPeriods(options.series);
  if (!periods.length) return '<p class="chart-empty">Aucune série publiée pour cet indicateur.</p>';
  const values = options.series.flatMap(s => Object.values(s.values).filter(Number.isFinite));
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;
  const domainMin = min < 0 ? min - range * .08 : 0;
  const domainMax = max + range * .1;
  // Annual periods use actual year spacing. Missing years break a line, never fabricate a trajectory.
  const annual = periods.every(p => /^\d{4}$/.test(p));
  const fraction = (i: number) => periods.length < 2 ? .5 : annual
    ? (Number(periods[i]) - Number(periods[0])) / (Number(periods.at(-1)) - Number(periods[0]))
    : i / (periods.length - 1);
  const draw = (width: number) => {
    const height = width < 500 ? 240 : 280;
    const left = 44, right = 12, top = 15, bottom = 30;
    const x = (i: number) => left + fraction(i) * (width - left - right);
    const y = (v: number) => top + (domainMax - v) / (domainMax - domainMin) * (height - top - bottom);
    const grid = [0, 1, 2, 3].map(i => {
      const v = domainMin + (domainMax - domainMin) * i / 3;
      return `<g><line x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-7}" y="${y(v)+4}" text-anchor="end">${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0,notation:'compact'}).format(v)}</text></g>`;
    }).join('');
    const labels = [...new Set([0, Math.floor((periods.length-1)/2), periods.length-1])].map(i => `<text x="${x(i)}" y="${height-5}" text-anchor="${i===0?'start':i===periods.length-1?'end':'middle'}">${escapeChart(periods[i])}</text>`).join('');
    const gap = options.gap && options.series.length === 2 ? periods.slice(1).map((p,i) => {
      const previous = periods[i];
      if (annual && Number(p)-Number(previous)!==1) return '';
      const [a,b] = options.series;
      if (![a.values[p],b.values[p],a.values[previous],b.values[previous]].every(Number.isFinite)) return '';
      return `<path class="dataviz__zone" d="M${x(i)},${y(a.values[previous])} L${x(i+1)},${y(a.values[p])} L${x(i+1)},${y(b.values[p])} L${x(i)},${y(b.values[previous])}Z"/>`;
    }).join('') : '';
    const curves = options.series.map((s,index) => {
      let previous = -2;
      const path = periods.map((p,i) => {
        if (!Number.isFinite(s.values[p])) return '';
        const continuous = previous===i-1 && (!annual || Number(p)-Number(periods[previous])===1);
        previous=i;
        return `${continuous?'L':'M'}${x(i)},${y(s.values[p])}`;
      }).join(' ');
      const dots=periods.map((p,i) => Number.isFinite(s.values[p]) ? `<circle cx="${x(i)}" cy="${y(s.values[p])}" r="${s.pointsOnly?4:2.5}"/>` : '').join('');
      return `<g class="chart-series chart-series--${index}">${s.pointsOnly?'':`<path d="${path}" ${s.dashed?'stroke-dasharray="6 5"':''}/>`}${dots}</g>`;
    }).join('');
    return `<svg class="chart-svg chart-svg--${width<500?'phone':'wide'}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeChart(options.title+'. '+options.description)}"><title>${escapeChart(options.title)}</title><desc>${escapeChart(options.description)}</desc><g class="chart-grid">${grid}${labels}</g>${gap}${curves}<line class="chart-cursor" x1="${x(periods.length-1)}" x2="${x(periods.length-1)}" y1="${top}" y2="${height-bottom}" data-chart-left="${left}" data-chart-right="${width-right}"/></svg>`;
  };
  const readouts = periods.map(p=>chartReadout(options,p));
  return `<figure class="chart-time" data-chart-periods="${escapeChart(JSON.stringify(periods))}" data-chart-fractions="${escapeChart(JSON.stringify(periods.map((_,i)=>fraction(i))))}" data-chart-readouts="${escapeChart(JSON.stringify(readouts))}">
    <figcaption><strong>${escapeChart(options.title)}</strong><span>${escapeChart(options.unit)}</span></figcaption>
    <output class="chart-readout" aria-live="polite" aria-atomic="true">${readouts.at(-1)}</output>
    <div class="chart-plot">${draw(360)}${draw(720)}</div>
    ${periods.length>1?`<label class="chart-scrub"><span>Année</span><input type="range" min="0" max="${periods.length-1}" value="${periods.length-1}" step="1" aria-label="Année du graphique : ${escapeChart(options.title)}" aria-valuetext="${escapeChart(periods.at(-1)!)}"/><span class="chart-scrub__year">${escapeChart(periods.at(-1)!)}</span></label>`:''}
  </figure>`;
}
