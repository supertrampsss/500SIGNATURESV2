import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMPAIGN_CHAPTER_SIZES,
  CAMPAIGN_DECISION_IDS,
  campaignLength,
  campaignPosition,
} from "./campaign-topology.ts";
import { SCENARIO_V3 } from "./scenario.ts";
import { decisionCountAtMandateYearEnd } from "./timeline.ts";

test("la topologie déclare 60 sujets uniques", () => {
  assert.equal(CAMPAIGN_DECISION_IDS.length, 60);
  assert.equal(new Set(CAMPAIGN_DECISION_IDS).size, 60);
  assert.deepEqual(CAMPAIGN_CHAPTER_SIZES, [8, 8, 8, 8, 7, 7, 7, 7]);
  assert.equal(campaignLength, 60);
  assert.deepEqual(campaignPosition(59), { chapterIndex: 7, decisionIndex: 6 });
});

test("chaque conséquence différée sélectionnée arrive pendant la campagne", () => {
  for (const [index, id] of CAMPAIGN_DECISION_IDS.entries()) {
    const decision = SCENARIO_V3.decisions.find((candidate) => candidate.id === id)!;
    const createdAt = index + 1;
    for (const option of decision.options) {
      const implementationDue = option.horizon.kind === "immediate"
        ? createdAt
        : option.horizon.kind === "after_decisions"
          ? createdAt + option.horizon.count
          : decisionCountAtMandateYearEnd(SCENARIO_V3, option.horizon.year);
      const dueDates = [
        ...option.effects.flatMap((effect) => effect.timing.kind === "immediate"
          ? []
          : [effect.timing.kind === "after_decisions"
            ? createdAt + effect.timing.count
            : decisionCountAtMandateYearEnd(SCENARIO_V3, effect.timing.year)]),
        ...option.scheduledEvents.map((event) => Math.max(createdAt + event.afterDecisions, implementationDue)),
        ...option.promises.map((promise) => createdAt + promise.dueAfterDecisions),
      ];
      for (const dueAtDecision of dueDates) {
        assert.ok(dueAtDecision <= campaignLength, `${id}:${option.id}:due${dueAtDecision}`);
      }
    }
  }
});
