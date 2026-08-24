import assert from "node:assert/strict";
import { test } from "node:test";

import { CONTRATS } from "./mission.ts";
import { acteDe, ordreExpress } from "./campagne.ts";

test("chaque combinaison d'engagements conserve cinq dossiers par acte", () => {
  const cles = CONTRATS.map((c) => c.cle);
  for (let masque = 0; masque < 2 ** cles.length; masque++) {
    const engagements = cles.filter((_, i) => masque & (1 << i));
    const ordre = ordreExpress(engagements, 20260824);
    assert.equal(ordre.length, 15);
    assert.equal(new Set(ordre).size, 15);
    for (const acte of [1, 2, 3] as const) {
      assert.equal(ordre.filter((id) => acteDe(id) === acte).length, 5);
    }
  }
});

test("la même graine donne la même campagne et une autre change l'ordre", () => {
  assert.deepEqual(ordreExpress([], 12), ordreExpress([], 12));
  assert.notDeepEqual(ordreExpress([], 12), ordreExpress([], 13));
});
