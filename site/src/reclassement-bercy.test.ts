import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reclassementBercy, renduReclassementBercy } from './reclassement-bercy.ts';
test('les budgets et retraites sont monétaires, sourcés et réconciliés',()=>{
 const r=reclassementBercy();assert.equal(r.ministeres.length,19);
 assert.deepEqual(r.selection.map(m=>m.nom),['Éducation nationale','Intérieur','Défense · Armées et anciens combattants']);
 assert.equal(r.selection.reduce((s,m)=>s+(m.retraites??0),0),47898117462);
 const source=JSON.parse(readFileSync(new URL('../../docs/sources/retraites-2026/ministeres-montants-2027.json',import.meta.url),'utf8'));
 assert.equal(r.ministeres.filter(m=>m.retraites===null).length,1);
 for(const m of r.ministeres){
  assert.ok(source.rows.some((s:{budget:number;retraites:number|null})=>s.budget===m.budget && s.retraites===m.retraites));
  assert.ok(m.budget>0);
  if(m.retraites!==null){assert.ok(m.retraites>=0 && m.retraites<=m.budget);assert.equal(m.retraites+(m.budget-m.retraites),m.budget);}
 }
 const html=renduReclassementBercy();assert.match(html,/Md€/);assert.match(html,/Défense/);
 assert.match(html,/89,1/);assert.match(html,/28,5/);assert.match(html,/60,6/);
 assert.equal((html.match(/class="budget-comparison"/g)??[]).length,1);
 assert.equal((html.match(/class="budget-comparison__row"/g)??[]).length,19);
 assert.match(html,/Les budgets des ministères/);assert.match(html,/PLF 2027 · En milliards d’euros/);
 assert.match(html,/Budget affiché/);assert.match(html,/Ponctionné pour financer les retraites/);assert.match(html,/Budget restant/);
 assert.match(html,/Non disponible/);assert.match(html,/Bercy · PLF 2027/);assert.match(html,/Sources et calculs/);
 assert.doesNotMatch(html,/budget-flow|≈|Les 19 ministères|stacked-percent|123,3|hors retraites/);
});
