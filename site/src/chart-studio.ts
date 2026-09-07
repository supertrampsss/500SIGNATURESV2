/** Original SVG/HTML charts. Rendering is pure; interaction lives in chart-controls.ts. */
export type ChartSeries = { name: string; color?: string; emphasized?: boolean; secondary?: boolean; values: Record<string, number>; labels?: Record<string, string>; dashed?: boolean; pointsOnly?: boolean };
export type ChartOptions = { title: string; description: string; series: ChartSeries[]; unit: string; format: (value: number) => string; gap?: boolean; zeroBaseline?: boolean; hideMissing?: boolean; periodLabel?: string };
export const escapeChart = (text: string): string => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

export function chartPeriods(series: ChartSeries[]): string[] {
  return [...new Set(series.flatMap(s => Object.keys(s.values).filter(p => Number.isFinite(s.values[p]))))].sort();
}
export function chartReadout(options: ChartOptions, period: string): string {
  return `<b>${escapeChart(period)}</b><span class="chart-readout__values">${options.series.map((s, i) => options.hideMissing && !Number.isFinite(s.values[period]) ? '' : `<span class="chart-key chart-key--${i}"${s.secondary ? ' data-country-secondary' : ''}${s.color ? ` style="color:${escapeChart(s.color)}"` : ''}><span>${escapeChart(s.name)}</span><strong>${Number.isFinite(s.values[period]) ? escapeChart(s.labels?.[period] ?? options.format(s.values[period])) : 'Non publié'}</strong></span>`).join('')}</span>`;
}

export function timeChart(options: ChartOptions): string {
  const periods = chartPeriods(options.series);
  if (!periods.length) return '<p class="chart-empty">Aucune série publiée pour cet indicateur.</p>';
  const values = options.series.flatMap(s => Object.values(s.values).filter(Number.isFinite));
  const min = options.zeroBaseline === false ? Math.min(...values) : Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;
  const magnitude = 10 ** Math.floor(Math.log10(range / 4));
  const step = [1, 2, 5, 10].find(n => n * magnitude >= range / 4)! * magnitude;
  const domainMin = Math.floor(min / step) * step;
  const domainMax = Math.max(domainMin + step, Math.ceil(max / step) * step);
  const ticks = Array.from({length: Math.round((domainMax - domainMin) / step) + 1}, (_, i) => domainMin + i * step);
  // Annual periods use actual year spacing. Missing years break a line, never fabricate a trajectory.
  const annual = periods.every(p => /^\d{4}$/.test(p));
  const quarterly = periods.every(p => /^\d{4}-Q[1-4]$/.test(p));
  const monthly = periods.every(p => /^\d{4}-(0[1-9]|1[0-2])$/.test(p));
  const coordinate = (p:string) => annual ? Number(p) : quarterly ? Number(p.slice(0,4))*4+Number(p.at(-1))-1 : monthly ? Number(p.slice(0,4))*12+Number(p.slice(5))-1 : periods.indexOf(p);
  const dated = annual || quarterly || monthly;
  const periodLabel = options.periodLabel ?? (annual ? 'Année' : 'Période');
  const fraction = (i: number) => periods.length < 2 ? .5 : dated
    ? (coordinate(periods[i]) - coordinate(periods[0])) / (coordinate(periods.at(-1)!) - coordinate(periods[0]))
    : i / (periods.length - 1);
  const draw = (width: number) => {
    const height = width < 500 ? 240 : 280;
    const left = 44, right = 12, top = 15, bottom = 30;
    const x = (i: number) => left + fraction(i) * (width - left - right);
    const y = (v: number) => top + (domainMax - v) / (domainMax - domainMin) * (height - top - bottom);
    const grid = ticks.map(v => {
      return `<g><line x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-7}" y="${y(v)+4}" text-anchor="end">${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:Math.min(6,Math.max(0,-Math.floor(Math.log10(step))))}).format(v)}</text></g>`;
    }).join('');
    const labels = [...new Set([0, Math.floor((periods.length-1)/2), periods.length-1])].map(i => `<text x="${x(i)}" y="${height-5}" text-anchor="${i===0?'start':i===periods.length-1?'end':'middle'}">${escapeChart(periods[i])}</text>`).join('');
    const gap = options.gap && options.series.length === 2 ? periods.slice(1).map((p,i) => {
      const previous = periods[i];
      if (annual && Number(p)-Number(previous)!==1) return '';
      const [a,b] = options.series;
      if (![a.values[p],b.values[p],a.values[previous],b.values[previous]].every(Number.isFinite)) return '';
      return `<path class="dataviz__zone" d="M${x(i)},${y(a.values[previous])} L${x(i+1)},${y(a.values[p])} L${x(i+1)},${y(b.values[p])} L${x(i)},${y(b.values[previous])}Z"/>`;
    }).join('') : '';
    const curves = options.series.map((s,index) => ({s,index})).sort((a,b) => Number(!!a.s.emphasized)-Number(!!b.s.emphasized)).map(({s,index}) => {
      let previous = -2;
      const path = periods.map((p,i) => {
        if (!Number.isFinite(s.values[p])) return '';
        const continuous = previous===i-1 && (!dated || coordinate(p)-coordinate(periods[previous])===1);
        previous=i;
        return `${continuous?'L':'M'}${x(i)},${y(s.values[p])}`;
      }).join(' ');
      const dots=periods.map((p,i) => Number.isFinite(s.values[p]) ? `<circle cx="${x(i)}" cy="${y(s.values[p])}" r="${s.pointsOnly?4:2.5}"/>` : '').join('');
      return `<g class="chart-series chart-series--${index}"${s.secondary ? ' data-country-secondary' : ''}${s.color ? ` style="color:${escapeChart(s.color)}"` : ''}${s.emphasized ? ' data-emphasized="true"' : ''}>${s.pointsOnly?'':`<path d="${path}" ${s.dashed?'stroke-dasharray="6 5"':''}/>`}${dots}</g>`;
    }).join('');
    return `<svg class="chart-svg chart-svg--${width<500?'phone':'wide'}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeChart(options.title+'. '+options.description)}"><title>${escapeChart(options.title)}</title><desc>${escapeChart(options.description)}</desc><g class="chart-grid">${grid}${labels}</g>${gap}${curves}<line class="chart-cursor" x1="${x(periods.length-1)}" x2="${x(periods.length-1)}" y1="${top}" y2="${height-bottom}" data-chart-left="${left}" data-chart-right="${width-right}"/></svg>`;
  };
  const readouts = periods.map(p=>chartReadout(options,p));
  return `<figure class="chart-time${options.series.length > 6 ? ' chart-time--many' : ''}" ${options.series.some(s=>s.secondary)?'data-country-scope data-countries="limited" ':''}data-chart-periods="${escapeChart(JSON.stringify(periods))}" data-chart-fractions="${escapeChart(JSON.stringify(periods.map((_,i)=>fraction(i))))}" data-chart-readouts="${escapeChart(JSON.stringify(readouts))}">
    <figcaption><strong>${escapeChart(options.title)}</strong><span>${escapeChart(options.unit)}</span></figcaption>
    <output class="chart-readout" aria-live="polite" aria-atomic="true">${readouts.at(-1)}</output>
    <div class="chart-plot">${draw(360)}${draw(720)}</div>
    ${periods.length>1?`<label class="chart-scrub"><span>${escapeChart(periodLabel)}</span><input type="range" min="0" max="${periods.length-1}" value="${periods.length-1}" step="1" aria-label="${escapeChart(periodLabel)} du graphique : ${escapeChart(options.title)}" aria-valuetext="${escapeChart(periods.at(-1)!)}"/><span class="chart-scrub__year">${escapeChart(periods.at(-1)!)}</span></label>`:''}
    ${options.series.some(s=>s.secondary)?'<button type="button" class="country-toggle" data-country-toggle aria-expanded="false">Voir tous les pays</button>':''}
  </figure>`;
}
