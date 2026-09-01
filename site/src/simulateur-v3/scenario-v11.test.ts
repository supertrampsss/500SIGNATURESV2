import assert from "node:assert/strict";
import test from "node:test";

import { SCENARIO_V10 } from "./scenario-v10.ts";
import { SCENARIO_V11 } from "./scenario-v11.ts";
import { SCENARIO_V11_CRISIS_RULES } from "./scenario-v11-crises.ts";
import { scenarioForVersion } from "./scenario-resolver.ts";
import { validateCrisisRules } from "./validation.ts";

test("le resolver conserve V9 et V10 puis publie V11 pour les nouvelles parties", () => {
  assert.equal(scenarioForVersion(10), SCENARIO_V10);
  assert.equal(scenarioForVersion(11), SCENARIO_V11);
  assert.equal(scenarioForVersion(12), null);
  assert.equal(SCENARIO_V11.version, 11);
  assert.equal(SCENARIO_V11.decisions.length, 55);
});

test("V11 ne propose jamais plus de trois crises et chaque réponse vise une carte V11 active", () => {
  assert.ok(SCENARIO_V11_CRISIS_RULES.length <= 3);
  assert.deepEqual(validateCrisisRules(SCENARIO_V11, SCENARIO_V11_CRISIS_RULES), []);

  const decisions = new Map(SCENARIO_V11.decisions.map((decision) => [decision.id, decision]));
  for (const rule of SCENARIO_V11_CRISIS_RULES) {
    assert.ok(rule.concessions.length >= 2, rule.id);
    for (const concession of rule.concessions) {
      assert.ok(decisions.has(concession.targetDecisionId), `${rule.id}:${concession.id}`);
      assert.ok(rule.aggravatingChoices.some((choice) => choice.decisionId === concession.targetDecisionId));
    }
  }
});
