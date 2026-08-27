import assert from "node:assert/strict";
import test from "node:test";

import { SCENARIO_V3_PREVIEW } from "./scenario.ts";
import { assertNoEmDash, validateScenario } from "./validation.ts";

test("le scénario provisoire porte huit chapitres de douze décisions uniques", () => {
  assert.equal(SCENARIO_V3_PREVIEW.chapters.length, 8);
  assert.deepEqual(SCENARIO_V3_PREVIEW.chapters.map((chapter) => chapter.decisionIds.length), Array(8).fill(12));
  assert.equal(SCENARIO_V3_PREVIEW.decisions.length, 96);
  assert.equal(new Set(SCENARIO_V3_PREVIEW.decisions.map((decision) => decision.id)).size, 96);
});

test("le scénario provisoire satisfait toutes les portes du moteur V3", () => {
  assert.deepEqual(validateScenario(SCENARIO_V3_PREVIEW), []);
  assert.deepEqual(assertNoEmDash(SCENARIO_V3_PREVIEW), []);
});

test("chaque option dit directement ce qu'elle fait et qui paie", () => {
  for (const decision of SCENARIO_V3_PREVIEW.decisions) {
    assert.equal(decision.options.length, 2);
    for (const option of decision.options) {
      assert.ok(option.label.trim());
      assert.ok(option.summary.trim());
      assert.ok(option.beneficiaries.length > 0);
      assert.ok(option.contributors.length > 0);
      assert.doesNotMatch(`${option.label} ${option.summary}`, /impact\s*:\s*à préciser/i);
    }
  }
});

test("les incompatibilités n'empêchent jamais de jouer les 96 dossiers", () => {
  for (const decision of SCENARIO_V3_PREVIEW.decisions) {
    for (const option of decision.options) assert.deepEqual(option.locks, []);
  }
});

test("aucune carte d'action ne porte le libellé générique Appliquer la mesure", () => {
  for (const decision of SCENARIO_V3_PREVIEW.decisions) {
    for (const option of decision.options) assert.notEqual(option.label, "Appliquer la mesure");
  }
});

test("le scénario provisoire ne dépend jamais des fixtures de test", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("./scenario.ts", import.meta.url), "utf8"));
  assert.doesNotMatch(source, /test-fixtures/);
});
