import test from 'node:test';
import assert from 'node:assert/strict';
import { insightChart } from './insight-chart.ts';
import type { Insight } from './insights.ts';
const insight = (id:string):Insight => ({id,famille:'travail',surtitre:'Travail',titre:'Chômage',texte:'',reserve:'',preuves:['actifs','chomeurs'].map(indicateur=>({indicateur,periode:'2024',valeur:0,libelle:indicateur}))});
test('le chômage trace la proportion des actifs et exclut les années sans dénominateur',()=>{
 const html=insightChart(insight('chomage'),[],{actifs:{'2020':100,'2024':200},chomeurs:{'2020':10,'2022':15,'2024':30}});
 assert.match(html,/15 % des actifs/);
 assert.doesNotMatch(html,/2022|count/);
});
test('un dénominateur nul ne produit pas un ratio infini',()=>{
 assert.equal(insightChart(insight('chomage'),[],{actifs:{'2020':0,'2024':0},chomeurs:{'2020':10,'2024':30}}),'');
});
test('un effectif a une valeur lisible sans unité technique',()=>{
 const i=insight('effectif');i.preuves=i.preuves.slice(0,1);
 const html=insightChart(i,[{id:'actifs',libelle:'Actifs',unite:'count',theme:'emploi'}],{actifs:{'2020':100,'2024':200}});
 assert.doesNotMatch(html,/count/);
 assert.match(html,/Actifs/);
});
test('birth cohorts are labelled as generations and drawn as points',()=>{
 const i=insight('retraite-rendement');i.preuves=[{indicateur:'insee_retraite_rendement_interne',periode:'1985',valeur:2,libelle:'Rendement'}];
 const html=insightChart(i,[{id:i.preuves[0].indicateur,libelle:'Rendement',unite:'percent',theme:'retraites'}],{insee_retraite_rendement_interne:{'1950':3,'1985':2}});
 assert.match(html,/Génération de naissance/);
 assert.doesNotMatch(html,/<path/);
});
