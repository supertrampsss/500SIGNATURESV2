import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMPAIGN_CHAPTER_SIZES,
  CAMPAIGN_DECISION_IDS,
  campaignLength,
  campaignPosition,
} from "./campaign-topology.ts";
import { SCENARIO_V3_CATALOGUE } from "./scenario.ts";

test("la topologie déclare 60 sujets uniques", () => {
  assert.equal(CAMPAIGN_DECISION_IDS.length, 60);
  assert.equal(new Set(CAMPAIGN_DECISION_IDS).size, 60);
  assert.deepEqual(CAMPAIGN_CHAPTER_SIZES, [8, 8, 8, 8, 7, 7, 7, 7]);
  assert.equal(campaignLength, 60);
  assert.deepEqual(campaignPosition(59), { chapterIndex: 7, decisionIndex: 6 });
});

test("chaque conséquence différée sélectionnée arrive pendant la campagne", () => {
  for (const [index, id] of CAMPAIGN_DECISION_IDS.entries()) {
    const decision = SCENARIO_V3_CATALOGUE.decisions.find((candidate) => candidate.id === id)!;
    const createdAt = index + 1;
    for (const option of decision.options) {
      const delays = [
        ...option.effects.flatMap((effect) => effect.timing.kind === "after_decisions" ? [effect.timing.count] : []),
        ...option.scheduledEvents.map((event) => event.afterDecisions),
        ...option.promises.map((promise) => promise.dueAfterDecisions),
      ];
      for (const delay of delays) {
        assert.ok(createdAt + delay <= campaignLength, `${id}:${option.id}:${createdAt}+${delay}`);
      }
    }
  }
});
