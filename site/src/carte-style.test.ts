import assert from "node:assert/strict";
import { test } from "node:test";

import { styleCarte } from "./carte-style.ts";

test("la carte analytique ne dépend d'aucun fond tiers et ne duplique pas les noms", () => {
  const style = styleCarte("/donnees/territoires.pmtiles");
  assert.deepEqual(Object.keys(style.sources), ["territoires"]);
  assert.ok(style.layers.every((layer) => layer.type !== "raster"));
  assert.ok(style.layers.every((layer) => !/terrain|noms/i.test(layer.id)));
});

test("chaque maille porte un remplissage, un contour et un détourage de sélection", () => {
  const style = styleCarte("/donnees/territoires.pmtiles");
  for (const couche of ["communes", "departements", "regions"]) {
    assert.ok(style.layers.some((layer) => layer.id === `remplissage-${couche}`));
    assert.ok(style.layers.some((layer) => layer.id === `contour-${couche}`));
    const selection = style.layers.find((layer) => layer.id === `selection-${couche}`);
    assert.ok(selection && selection.type === "line");
  }
});
