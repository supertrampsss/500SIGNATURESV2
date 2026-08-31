import assert from "node:assert/strict";
import test from "node:test";

import {
  CAMPAIGN_CHAPTERS,
  CAMPAIGN_CHAPTER_SIZES,
  CAMPAIGN_DECISION_IDS,
  CAMPAIGN_MANDATE_CHECKPOINTS,
  campaignLength,
  campaignPosition,
  publishCampaignFromCatalogue,
  validatePublishedCampaign,
} from "./campaign-topology.ts";
import { PROMOTION_REPORT } from "./promotion-report.ts";
import { SCENARIO_V10_CRISIS_RULES } from "./scenario-crises.ts";
import { SCENARIO_V10_CATALOGUE } from "./scenario-v10-catalogue.ts";

test("la topologie V10 publie 72 dossiers uniques et 144 options", () => {
  assert.equal(campaignLength, 72);
  assert.equal(CAMPAIGN_DECISION_IDS.length * 2, 144);
  assert.equal(new Set(CAMPAIGN_DECISION_IDS).size, 72);
  assert.deepEqual(CAMPAIGN_CHAPTER_SIZES, [10, 9, 10, 9, 9, 9, 7, 9]);
  assert.deepEqual(CAMPAIGN_MANDATE_CHECKPOINTS, [19, 38, 47, 63, 72]);
  assert.deepEqual(campaignPosition(71), { chapterIndex: 7, decisionIndex: 8 });
});

test("la topologie garde le noyau dans son ordre et insère les promotions après leurs ancres", () => {
  assert.deepEqual(CAMPAIGN_CHAPTERS.map((chapter) => chapter.id), [
    "taxes-assets-transmission",
    "work-wages-pensions",
    "health-social-protection",
    "security-immigration-justice",
    "defence-europe-sovereignty",
    "energy-climate-transport-agriculture",
    "education-housing-family",
    "state-institutions-territories",
  ]);
  const previousPromotionForAnchor = new Map<string, string>();
  for (const candidate of PROMOTION_REPORT.candidates) {
    const promotedAt = CAMPAIGN_DECISION_IDS.indexOf(candidate.decisionId);
    const predecessor = previousPromotionForAnchor.get(candidate.replacesDecisionId) ?? candidate.replacesDecisionId;
    assert.equal(promotedAt, CAMPAIGN_DECISION_IDS.indexOf(predecessor) + 1, candidate.decisionId);
    previousPromotionForAnchor.set(candidate.replacesDecisionId, candidate.decisionId);
  }
  assert.deepEqual(validatePublishedCampaign({ catalogue: SCENARIO_V10_CATALOGUE, crisisRules: SCENARIO_V10_CRISIS_RULES }), []);
});

test("la publication refuse toute longueur différente de 72 sans solution de repli", () => {
  const withLength = (length: number) => ({
    catalogue: SCENARIO_V10_CATALOGUE,
    crisisRules: SCENARIO_V10_CRISIS_RULES,
    chapters: [{ id: CAMPAIGN_CHAPTERS[0]!.id, decisionIds: length === 73
      ? [...CAMPAIGN_DECISION_IDS, "decision-inconnue"]
      : CAMPAIGN_DECISION_IDS.slice(0, length) }],
  });
  assert.match(validatePublishedCampaign(withLength(71)).join("|"), /campaign-length/);
  assert.match(validatePublishedCampaign(withLength(73)).join("|"), /campaign-length/);
});

test("la topologie et ses listes sont immuables", () => {
  assert.equal(Object.isFrozen(CAMPAIGN_CHAPTERS), true);
  assert.equal(Object.isFrozen(CAMPAIGN_CHAPTERS[0]!.decisionIds), true);
  assert.throws(() => {
    (CAMPAIGN_CHAPTERS[0]!.decisionIds as unknown as string[]).push("intrus");
  }, TypeError);
});

test("la publication refuse une référence de verrou hors des 72 dossiers", () => {
  const outsidePublishedCampaign = "flat-tax-a-20-des-le-premier";
  assert.equal(CAMPAIGN_DECISION_IDS.includes(outsidePublishedCampaign), false);
  const catalogue = structuredClone(SCENARIO_V10_CATALOGUE);
  assert.deepEqual(validatePublishedCampaign({ catalogue, crisisRules: SCENARIO_V10_CRISIS_RULES }), []);
  const decision = catalogue.decisions.find((candidate) => candidate.id === "unifier-ir-csg-bareme-continu")!;
  decision.options[0]!.locks = [outsidePublishedCampaign];

  assert.throws(
    () => publishCampaignFromCatalogue(catalogue),
    /campaign-unpublished-reference:lock:unifier-ir-csg-bareme-continu:flat-tax-a-20-des-le-premier/,
  );
});
