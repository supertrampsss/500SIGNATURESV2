/**
 * Risques définis avant l'implémentation du récit des comptes :
 * - une ventilation publiée plus tard ne doit pas retarder les deux totaux ;
 * - périodes différentes, données absentes ou invalides ne sont pas un ratio ;
 * - les montants arrondis ne doivent pas servir à recalculer le déficit ;
 * - un excédent, l'équilibre et un petit déficit racontent des choses différentes.
 *
 * Ces états de publication ne sont pas reproductibles avec le seul jeu de
 * données courant des parcours navigateur. Les nombres restent indépendants
 * des étapes, du défilement et de leur présentation.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Territoire } from "./donnees.ts";
import { comptesRecit, formaterRecit } from "./recit-comptes.ts";

const france = (
  recettes: Record<string, number>,
  depenses: Record<string, number>,
  autres: Record<string, Record<string, number>> = {},
): Territoire => ({
  nom: "France", parent: null, population: null, drapeaux: {},
  series: { eurostat_apu_recettes: recettes, eurostat_apu_depenses: depenses, ...autres },
});

test("le récit utilise les totaux de 2025 même si la ventilation s'arrête en 2024", () => {
  const comptes = comptesRecit(france(
    { "2024": 1_499_000_000_000, "2025": 1_561_626_100_000 },
    { "2024": 1_667_637_500_000, "2025": 1_714_137_200_000 },
    { eurostat_apu_prestations_vieillesse: { "2024": 401_132_400_000 } },
  ));
  assert.ok(comptes);
  assert.equal(comptes.annee, "2025");
  assert.equal(comptes.recettes, 1_561_626_100_000);
  assert.equal(comptes.depenses, 1_714_137_200_000);
  assert.ok(Math.abs(comptes.depensesPour100 - 109.76617258126001) < 1e-12);
  assert.ok(Math.abs(comptes.ecartPour100 - 9.766172581260008) < 1e-12);
  assert.equal(comptes.nature, "deficit");
  assert.equal(formaterRecit(comptes.depensesPour100), "109,77");
  assert.equal(formaterRecit(comptes.ecartPour100), "9,77");
});

test("une seule année de comptes suffit sans PIB et sans historique", () => {
  assert.deepEqual(comptesRecit(france({ "2032": 200 }, { "2032": 250 })), {
    annee: "2032", recettes: 200, depenses: 250,
    depensesPour100: 125, ecartPour100: 25, nature: "deficit",
  });
});

test("les deux montants doivent partager un exercice annuel valide", () => {
  const comptes = comptesRecit(france(
    { "2024": 100, "2025": 200, "2026-T1": 300, "2027-01": 400, "99": 500 },
    { "2024": 120, "2026": 250, "2026-T1": 350, "2027-01": 450, "99": 550 },
  ));
  assert.equal(comptes?.annee, "2024");
  assert.equal(comptes?.depensesPour100, 120);
  assert.equal(comptesRecit(france({ "2025": 100 }, { "2024": 120 })), null);
});

test("une publication invalide ne fabrique pas de chiffres et garde l'année valide précédente", () => {
  assert.equal(comptesRecit(), null);
  assert.equal(comptesRecit(france({}, {})), null);
  for (const [recettes, depenses] of [
    [0, 1], [-1, 1], [1, -1], [NaN, 1], [1, NaN],
    [Infinity, 1], [1, Infinity], [Number.MIN_VALUE, Number.MAX_VALUE],
  ]) {
    assert.equal(comptesRecit(france({ "2026": recettes }, { "2026": depenses })), null);
    const secours = comptesRecit(france(
      { "2025": 100, "2026": recettes }, { "2025": 110, "2026": depenses },
    ));
    assert.equal(secours?.annee, "2025");
  }
});

test("le signe de l'écart distingue déficit, excédent et équilibre sans arrondir", () => {
  for (const [depenses, ecartPour100, nature] of [
    [90, -10, "excedent"], [100, 0, "equilibre"], [110, 10, "deficit"],
    [0, -100, "excedent"],
  ] as const) {
    const comptes = comptesRecit(france({ "2025": 100 }, { "2025": depenses }));
    assert.equal(comptes?.ecartPour100, ecartPour100);
    assert.equal(comptes?.nature, nature);
  }
  for (const [depenses, nature] of [[100.000001, "deficit"], [99.999999, "excedent"]] as const) {
    const comptes = comptesRecit(france({ "2025": 100 }, { "2025": depenses }));
    assert.ok(comptes);
    assert.equal(comptes.nature, nature);
    assert.notEqual(comptes.ecartPour100, 0);
    assert.notEqual(formaterRecit(comptes.ecartPour100), "0");
  }
});

test("l'affichage ne transforme pas un petit montant non nul en zéro", () => {
  assert.equal(formaterRecit(100), "100");
  assert.equal(formaterRecit(0), "0");
  assert.equal(formaterRecit(-0), "0");
  assert.equal(formaterRecit(0.001), "< 0,01");
  assert.equal(formaterRecit(-0.001), "> -0,01");
});
