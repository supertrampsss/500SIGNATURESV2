import assert from "node:assert/strict";
import { test } from "node:test";

import { equationFrance } from "./bilan-guide.ts";

test("ramène les dépenses et le déficit à 100 € de recettes", () => {
  assert.deepEqual(equationFrance(1000, 1097.7), {
    recettesPour100: 100,
    depensesPour100: 109.77,
    deficitPour100: 9.77,
    phrase: "Pour 100 € encaissés, la France en dépense 109,77.",
  });
});

test("refuse des recettes nulles ou négatives", () => {
  for (const recettes of [0, -1]) {
    assert.throws(
      () => equationFrance(recettes, 100),
      new RangeError("Les recettes doivent être strictement positives"),
    );
  }
});
