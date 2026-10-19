import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { rendu, type Analyse } from "./analyse-rendu.ts";
const lire = (slug: string): Analyse => JSON.parse(readFileSync(new URL(`../analyses/${slug}.json`, import.meta.url), "utf8"));
test("le dossier distingue vieillesse, réversion, rémunération et financement", () => {
  const a = lire("retraites-premier-poste-2024");
  const html = rendu(a, []);
  assert.match(html, /minima/);
  assert.match(html, /réversion/);
  assert.match(html, /cotisations sociales imputées/);
  assert.match(html, /24,1 %/);
  assert.match(html, /recettes publiques/);
  assert.match(html, /financement/);
  assert.doesNotMatch(JSON.stringify(a), /prix d'un service produit|première place change de main/);
  assert.equal(a.chiffres[0]!.observe?.valeur, 362178400000);
});
test("les crédits Défense incluent les contributions CAS, sans addition aux pensions", () => {
  const a = lire("defense-credits-votes-consommes-2025");
  const html = rendu(a, []);
  assert.match(html, /contributions au CAS « Pensions » comprises/);
  assert.match(html, /50,5/);
  assert.match(html, /double comptage/);
  assert.equal(a.chiffres[1]!.observe?.valeur, 62123736749.91);
});
