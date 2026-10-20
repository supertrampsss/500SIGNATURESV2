import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { MINISTERES_BERCY_MONTANTS } from "./bercy-ministeres-montants.ts";
import { rendu, type Analyse } from "./analyse-rendu.ts";
const lire = (slug: string): Analyse => JSON.parse(readFileSync(new URL(`../analyses/${slug}.json`, import.meta.url), "utf8"));
test("le dossier distingue vieillesse, réversion, rémunération et financement", () => {
  const a = lire("retraites-premier-poste-2024");
  const html = rendu(a, []);
  assert.match(html, /minima/);
  assert.match(html, /réversion/);
  assert.match(html, /cotisations sociales imputées/);
  assert.match(html, /26,76 %/);
  assert.match(html, /ligne Retraites réunit/);
  assert.match(html, /même exercice/);
  assert.match(html, /recettes publiques/);
  assert.match(html, /financement/);
  assert.doesNotMatch(JSON.stringify(a), /prix d'un service produit|première place change de main/);
  assert.equal(a.chiffres[0]!.valeur, 402433200000);
  assert.equal(a.chiffres[0]!.registre, 'interpretation');
  assert.ok(a.chiffres.some(c=>c.observe?.valeur===362178400000));
  assert.ok(a.chiffres.some(c=>c.observe?.valeur===40254800000));
  const proofs=a.dossier!.preuves!;
  assert.equal(proofs.find(p=>p.id==='chiffre-1')!.value,402.4332);
  assert.ok(Math.abs(proofs.find(p=>p.id==='vieillesse-composante')!.value!+proofs.find(p=>p.id==='survie-composante')!.value!-402.4332)<1e-10);
});
test("les crédits Défense incluent les contributions CAS, sans addition aux pensions", () => {
  const a = lire("defense-credits-votes-consommes-2025");
  const html = rendu(a, []);
  assert.match(html, /contributions au CAS « Pensions » comprises/);
  assert.match(html, /50,5/);
  assert.match(html, /double comptage/);
  assert.equal(a.chiffres[1]!.observe?.valeur, 62123736749.91);
});


test("le dossier reprend les mêmes montants que France et signale la donnée ESR absente",()=>{
 const a=lire("financement-retraites-publiques");const chart=a.dossier!.visualisations![0]!;
 assert.equal(chart.type,"budget_flow");assert.equal(chart.budgetRows!.length,19);
 assert.equal(chart.titre,"Budgets des ministères : suivez les milliards.");
 assert.equal(chart.preuveIds!.length,37);
 assert.deepEqual(chart.focusBudgetIds,["ministere-budget-1","ministere-budget-2","ministere-budget-6"]);
 const focus=chart.focusBudgetIds!.map(id=>chart.budgetRows!.find(row=>row.budgetId===id)!);
 assert.deepEqual(focus.map(row=>row.label),["Éducation nationale","Intérieur","Défense · Armées et anciens combattants"]);
 assert.equal(focus.reduce((sum,row)=>sum+a.dossier!.preuves!.find(p=>p.id===row.retirementId)!.value,0),47898117462);
 assert.deepEqual(chart.budgetRows!.map(row=>({nom:row.label,budget:a.dossier!.preuves!.find(p=>p.id===row.budgetId)!.value,retraites:row.retirementId?a.dossier!.preuves!.find(p=>p.id===row.retirementId)!.value:null,estimation:row.estimated})),MINISTERES_BERCY_MONTANTS);
 const html=rendu(a,[]);
 assert.equal((html.match(/class="budget-comparison__row"/g)??[]).length,19);
 assert.ok(html.indexOf("Tous les budgets")<html.indexOf('class="budget-comparison__row"'));
});
