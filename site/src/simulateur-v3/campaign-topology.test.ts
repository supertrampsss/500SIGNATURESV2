import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMPAIGN_CHAPTER_SIZES,
  CAMPAIGN_DECISION_IDS,
  campaignLength,
  campaignPosition,
} from "./campaign-topology.ts";

test("la topologie déclare 60 sujets uniques", () => {
  assert.equal(CAMPAIGN_DECISION_IDS.length, 60);
  assert.equal(new Set(CAMPAIGN_DECISION_IDS).size, 60);
  assert.deepEqual(CAMPAIGN_CHAPTER_SIZES, [8, 8, 8, 8, 7, 7, 7, 7]);
  assert.equal(campaignLength, 60);
  assert.deepEqual(campaignPosition(59), { chapterIndex: 7, decisionIndex: 6 });
});
