import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { reclassementBercy } from "./reclassement-bercy.ts";
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


test("le dossier reclasse les deux ministères avec les mêmes montants que le module", () => {
 const a = lire("financement-retraites-publiques");
 const r = reclassementBercy();
 const proofs = a.dossier!.preuves!;
 const value = (id:string) => proofs.find(p=>p.id===id)!.value! * 1e9;
 assert.equal(value('education-hors-retraites'),r.ministeres[0].horsRetraites);
 assert.equal(value('interieur-hors-retraites'),r.ministeres[1].horsRetraites);
 assert.equal(value('retraites-deux-ministeres'),r.retraites);
 assert.equal(value('total-deux-ministeres'),r.total);
 const chart=a.dossier!.visualisations!.find(v=>v.id==='ministeres-reclasses')!;
 assert.deepEqual(chart.preuveIds,['education-hors-retraites','interieur-hors-retraites','retraites-deux-ministeres']);
 assert.equal(chart.preuveIds!.reduce((sum,id)=>sum+value(id),0),r.total);
 for(const id of chart.preuveIds!) {
  const proof=proofs.find(p=>p.id===id)!;
  assert.equal(proof.period,'2027');assert.equal(proof.unit,'billion_EUR');assert.equal(proof.sourceId,'budget-pensions-2027');
 }
 assert.equal(a.dossier!.sections![0].id,'budgets-ministeriels');
 assert.match(rendu(a,[]),/deux ministères seulement|deux ministères et/);
 assert.ok(!a.dossier!.visualisations!.some(v=>v.id==='ministeres-cas'));
});
