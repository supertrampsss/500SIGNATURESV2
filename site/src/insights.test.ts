import assert from "node:assert/strict";
import test from "node:test";

import { derniere, ecartRelatif, periodeCommune, variation } from "./insights.ts";

test("derniere ignore les valeurs non finies et garde la période la plus récente", () => {
  assert.deepEqual(derniere({ "2022": 3, "2024": Number.NaN, "2023": 7 }), {
    periode: "2023",
    valeur: 7,
  });
  assert.equal(derniere({ "2024": Number.NaN }), null);
});

test("periodeCommune rend la dernière période publiée par toutes les séries", () => {
  assert.equal(
    periodeCommune([
      { "2022": 1, "2023": 2, "2024": 3 },
      { "2021": 4, "2023": 5, "2024": Number.NaN },
    ]),
    "2023",
  );
  assert.equal(periodeCommune([{ "2024": 1 }, { "2023": 1 }]), null);
});

test("variation décrit deux bornes positives sans inventer une période", () => {
  assert.deepEqual(variation({ "2020": 80, "2022": 100, "2024": 120 }), {
    de: "2020",
    a: "2024",
    depart: 80,
    arrivee: 120,
    delta: 40,
    pourcentage: 50,
  });
});

test("variation refuse une seule valeur, un départ nul et un changement de signe", () => {
  assert.equal(variation({ "2024": 10 }), null);
  assert.equal(variation({ "2023": 0, "2024": 10 }), null);
  assert.equal(variation({ "2023": -5, "2024": 10 }), null);
});

test("ecartRelatif mesure l'exécuté contre le voté et refuse un vote nul", () => {
  assert.equal(ecartRelatif(100, 115), 15);
  assert.equal(ecartRelatif(0, 115), null);
  assert.equal(ecartRelatif(Number.NaN, 115), null);
});
