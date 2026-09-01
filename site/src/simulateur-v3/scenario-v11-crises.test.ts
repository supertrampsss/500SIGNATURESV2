import assert from "node:assert/strict";
import test from "node:test";

import { createCampaign } from "./campaign.ts";
import { availableConcessions, detectCrisis, resolveCrisis } from "./crises.ts";
import { SCENARIO_V11_CRISIS_RULES } from "./scenario-v11-crises.ts";
import { SCENARIO_V11 } from "./scenario-v11.ts";
import { testBaseline } from "./test-fixtures.ts";

test("la crise fiscale V11 propose deux choix qui changent vraiment les décisions prises", () => {
  const base = createCampaign(SCENARIO_V11, testBaseline(), 417);
  const pending = {
    ...base,
    phase: "decision_result" as const,
    chapterIndex: 0,
    decisionIndex: 1,
    indicators: { ...base.indicators, opinion: 40 },
    decisions: [
      { decisionId: "v11-01-prelevement-personnel", optionId: "v11-01-prelevement-personnel:option-1", status: "confirmed" as const, confirmedAtIndex: 1 },
      { decisionId: "v11-02-tva", optionId: "v11-02-tva:option-2", status: "confirmed" as const, confirmedAtIndex: 2 },
    ],
  };

  const inCrisis = detectCrisis(pending, SCENARIO_V11, SCENARIO_V11_CRISIS_RULES);
  assert.equal(inCrisis.activeCrisis?.ruleId, "v11-fiscal-tension");
  assert.deepEqual(availableConcessions(inCrisis, SCENARIO_V11_CRISIS_RULES).map((item) => item.id), [
    "v11-fiscal-tension:separate-tax",
    "v11-fiscal-tension:keep-tva",
  ]);

  const resolved = resolveCrisis(inCrisis, SCENARIO_V11_CRISIS_RULES, "v11-fiscal-tension:keep-tva");
  assert.equal(resolved.decisions.find((record) => record.decisionId === "v11-02-tva")?.status, "reversed");
  assert.equal(resolved.decisions.find((record) => record.decisionId === "v11-01-prelevement-personnel")?.status, "confirmed");
});
