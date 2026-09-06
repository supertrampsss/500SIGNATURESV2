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
    {id:'investissement',label:'Investissement',title:'Les investissements réalisés',description:'Dépenses d’investissement de chaque exercice.',series:[{name:'Investissement',values:series.ofgl_depenses_investissement ?? {}}]},
  ].filter(o=>o.series.some(s=>Object.values(s.values).some(Number.isFinite)));
  if(!options.length) return '';
  const convert=(values:Record<string,number>)=>Object.fromEntries(Object.entries(values).map(([p,v])=>[p,v/1e6]));
  return `<section class="territory-charts" aria-label="Évolution des finances de ${escapeChart(territoire.nom)}">
    <div class="territory-charts__tabs" role="group" aria-label="Indicateur financier">${options.map((o,i)=>`<button type="button" data-chart-tab="${o.id}" aria-pressed="${i===0}">${o.label}</button>`).join('')}</div>
    ${options.map((o,i)=>`<div data-chart-panel="${o.id}" ${i?'hidden':''}>${timeChart({title:o.title,description:o.description,unit:'Millions d’euros',series:o.series.map(s=>({...s,values:convert(s.values)})),format:v=>`${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(v)} M€`})}</div>`).join('')}
    <p class="territory-charts__source">Comptes exécutés · OFGL · <a href="/sources/">Sources</a></p>
  </section>`;
}
