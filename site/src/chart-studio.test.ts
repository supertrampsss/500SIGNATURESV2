import test from 'node:test';
import assert from 'node:assert/strict';
import { timeChart, chartPeriods, chartReadout } from './chart-studio.ts';
import { territoireFinances } from './territoire-finances.ts';
import type { Territoire } from './donnees.ts';

const format=(v:number)=>`${v} M€`;
test('missing years are gaps, series stay distinct, and hostile labels are escaped',()=>{
 const series=[{name:'<script>alert(1)</script>',values:{2022:20,2024:40}},{name:'Dépenses',values:{2022:10,2023:15,2024:18}}];
 assert.deepEqual(chartPeriods(series),['2022','2023','2024']);
 const html=timeChart({title:'Budget',description:'Comptes publiés',unit:'M€',series,format,gap:true});
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/class="chart-series chart-series--0"><path d="M[^L]+ M/);
 const readout=chartReadout({title:'',description:'',unit:'',series,format},'2023');
 assert.match(readout,/Non publié/);assert.match(readout,/15 M€/);
});
test('annual positions follow elapsed time and both responsive drawings have labelled axes',()=>{
 const html=timeChart({title:'Dette',description:'Observations',unit:'M€',series:[{name:'Dette',values:{2020:100,2021:102,2025:130}}],format});
 assert.match(html,/data-chart-fractions="\[0,0.2,1\]"/);
 assert.match(html,/viewBox="0 0 360 240"/);assert.match(html,/viewBox="0 0 720 280"/);
 assert.match(html,/aria-valuetext="2025"/);assert.match(html,/chart-grid/);
});
test('no data invents no graph and a single observation remains readable',()=>{
 assert.match(timeChart({title:'Vide',description:'',unit:'',series:[],format}),/Aucune série publiée/);
 const html=timeChart({title:'Un point',description:'',unit:'',series:[{name:'Dette',values:{2024:-10}}],format});
 assert.doesNotMatch(html,/NaN|Infinity|type="range"/);assert.match(html,/-10 M€/);
});
test('territory charts use local finances and never fabricate unavailable investment data',()=>{
 const city={nom:'Ville & A',series:{ofgl_recettes_fonctionnement:{2023:1000000,2024:2000000},ofgl_depenses_fonctionnement:{2024:1500000},ofgl_encours_dette:{2024:7000000}}} as unknown as Territoire;
 const html=territoireFinances(city);
 assert.match(html,/Ville &amp; A/);assert.match(html,/data-chart-tab="budget"/);assert.match(html,/data-chart-tab="dette"/);
 assert.doesNotMatch(html,/data-chart-tab="investissement"/);assert.match(html,/7 M€/);assert.match(html,/1,5 M€/);
 assert.equal(territoireFinances({...city,series:{}}),'');
});
