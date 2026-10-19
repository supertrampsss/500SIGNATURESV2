import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { MINISTERES_BERCY } from "./bercy-ministeres-2027.ts";
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


test("le dossier reprend 19 ministères avec leur provenance",()=>{
 const a=lire("financement-retraites-publiques");
 const chart=a.dossier!.visualisations![0]!;
 assert.equal(chart.type,"stacked_percent");assert.equal(chart.preuveIds!.length,19);
 const proofs=chart.preuveIds!.map(id=>a.dossier!.preuves!.find(p=>p.id===id)!);
 assert.equal(proofs[0]!.libelle,"Éducation nationale");assert.ok(proofs.some(p=>p.libelle.startsWith("Défense")));
 for(const p of proofs){assert.equal(p.unit,"percent");assert.equal(p.sourceId,"budget-pensions-2027");assert.deepEqual(p.qualityFlags,["lecture-graphique"]);}
 assert.deepEqual(proofs.map(p=>({nom:p.libelle,partRetraites:p.value})),MINISTERES_BERCY);
 assert.equal((rendu(a,[]).match(/class="stacked-percent__row"/g)??[]).length,19);
});
