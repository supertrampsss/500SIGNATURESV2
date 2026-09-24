import test from 'node:test';
import assert from 'node:assert/strict';
import { start, choicesFor, decide } from './engine.ts';
import { livingResult, livingYearBriefing, livingYearRecap } from './living-recaps.ts';
import { gameShell, result, yearRecap } from './render.ts';

function through(turns:number) { let g=start('national',42,'services',9);for(let i=0;i<turns;i++)g=decide(g,choicesFor(g)[0].id);return g; }
test('annual recap celebrates completion, shows history deltas and keeps one next action',()=>{
 const g=through(6),html=livingYearRecap(g);
 assert.match(html,/ANNÉE 1 ACHEVÉE/);assert.match(html,/6 décisions inscrites/);assert.match(html,/Dette publique/);assert.match(html,/data-action="next-year"/);assert.doesNotMatch(html,/data-action="show-result"/);
});
test('annual recap remains unavailable before a year is closed',()=>assert.equal(livingYearRecap(through(5)),''));
test('annual briefing preserves next dossier context and enters the year in one action',()=>{const html=livingYearBriefing(through(6));assert.match(html,/LE CHAPITRE QUI S’OUVRE/);assert.match(html,/data-action="start-year"/);assert.match(html,/Déficit annuel/);});
test('final recap compares start with finish and links replay from preserved decision counts',()=>{
 const g=through(30),html=livingResult(g);
 assert.match(html,/DU POINT DE DÉPART À L’HÉRITAGE/);assert.match(html,/Excédent|Déficit/);assert.match(html,/décisions prises|→/);assert.match(html,/TROIS DÉCISIONS À REJOUER/);assert.match(html,/data-action="branch-replay" data-turn="\d+"/);assert.match(html,/data-action="new-run"/);assert.doesNotMatch(html,/score-number|\/100<\/p>/);
 assert.match(html,/data-action="open-replay-selection"/);
 const indices=[...html.matchAll(/data-action="branch-replay" data-turn="(\d+)"/g)].map(m=>Number(m[1]));assert.equal(indices.length,3);assert.equal(new Set(indices).size,3);assert.ok(indices.every(i=>i>=0&&i<30));
});
test('annual balance uses the signed deficit direction',()=>{const g=through(6);g.history.at(-1)!.ledger.deficit=-12.3;assert.match(livingYearRecap(g),/Excédent 12,3 Md€/);g.history.at(-1)!.ledger.deficit=12.3;assert.match(livingYearRecap(g),/Déficit 12,3 Md€/);});
test('rendered history and decisions are escaped',()=>{const g=through(30);g.history[0].title='<script>';assert.doesNotMatch(livingResult(g),/<script>/);});

test('render routes v9 year and final screens to the standalone living panels while preserving plan access',()=>{
 const year=through(6),final=through(30);
 assert.match(yearRecap(year),/living-recap/);
 const markup=result(final);assert.match(markup,/living-result/);
 const shell=gameShell(final,'result','decision');assert.match(shell,/living-result/);assert.doesNotMatch(shell,/strategic-panel|game-grid/);
 const plan=gameShell(final,'play','plan');assert.match(plan,/plan/);assert.doesNotMatch(plan,/living-result/);
});
