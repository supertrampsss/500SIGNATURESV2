import type { Territoire } from './donnees.ts';
import { timeChart, escapeChart } from './chart-studio.ts';

/** Published OFGL series only. Stocks never share a chart with annual flows. */
export function territoireFinances(territoire: Territoire): string {
  const series=territoire.series ?? {};
  const options=[
    {id:'budget',label:'Budget',title:'Ce qui entre et ce qui sort',description:'Recettes et dépenses de fonctionnement annuelles.',series:[
      {name:'Recettes',values:series.ofgl_recettes_fonctionnement ?? {}},
      {name:'Dépenses',values:series.ofgl_depenses_fonctionnement ?? {}},
    ]},
    {id:'dette',label:'Dette',title:'La dette au fil des ans',description:'Encours de dette à la fin de chaque exercice.',series:[{name:'Dette',values:series.ofgl_encours_dette ?? {}}]},
    {id:'investissement',label:'Investissement',title:'Les investissements réalisés',description:'Dépenses d’investissement hors remboursement du capital de la dette.',series:[{name:'Investissement',values:series.ofgl_depenses_d_investissement_hors_remb ?? {}}]},
  ].filter(o=>o.series.some(s=>Object.values(s.values).some(Number.isFinite)));
  if(!options.length) return '';
  const chart = (option: typeof options[number]): string => {
    const values = option.series.flatMap(s => Object.values(s.values)).filter(Number.isFinite);
    const maximum = Math.max(...values.map(Math.abs));
    const scale = maximum >= 1e6 ? 1e6 : maximum >= 1e3 ? 1e3 : 1;
    const unit = scale === 1e6 ? 'Millions d’euros' : scale === 1e3 ? 'Milliers d’euros' : 'Euros';
    const suffix = scale === 1e6 ? 'M€' : scale === 1e3 ? 'k€' : '€';
    return timeChart({
      title: option.title, description: option.description, unit,
      series: option.series.map(s => ({...s, values: Object.fromEntries(Object.entries(s.values).map(([year, value]) => [year, value / scale]))})),
      // Significant digits retain small values even beside a much larger observation.
      format: value => `${new Intl.NumberFormat('fr-FR', {maximumSignificantDigits: 4}).format(value)} ${suffix}`,
    });
  };
  return `<section class="territory-charts" aria-label="Évolution des finances de ${escapeChart(territoire.nom)}">
    <div class="territory-charts__tabs" role="group" aria-label="Indicateur financier">${options.map((o,i)=>`<button type="button" data-chart-tab="${o.id}" aria-pressed="${i===0}">${o.label}</button>`).join('')}</div>
    ${options.map((o,i)=>`<div data-chart-panel="${o.id}" ${i?'hidden':''}>${chart(o)}</div>`).join('')}
    <p class="territory-charts__source">Comptes exécutés · OFGL · <a href="/sources/">Sources</a></p>
  </section>`;
}
