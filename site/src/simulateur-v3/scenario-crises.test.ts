import assert from "node:assert/strict";
import { test } from "node:test";

import { currentDecision, selectOption } from "./campaign.ts";
import { availableConcessions, detectCrisis, resolveCrisis } from "./crises.ts";
import { confirmSelection } from "./effects.ts";
import { advanceCampaign } from "./flow.ts";
import { SCENARIO_V10_CRISIS_RULES, SCENARIO_V3_CRISIS_RULES } from "./scenario-crises.ts";
import { CAMPAIGN_DECISION_IDS } from "./campaign-topology.ts";
import { SCENARIO_V10_CATALOGUE } from "./scenario-v10-catalogue.ts";
import { SCENARIO_V3 } from "./scenario.ts";
import { createTestCampaign as createCampaign } from "./test-fixtures.ts";
import type { CampaignState, CrisisRule, DecisionOption } from "./types.ts";
import { positionAfterCompleted } from "./validation.ts";

type Strategy = (options: readonly DecisionOption[], decisionIndex: number) => DecisionOption;

function xorshift(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return value >>> 0;
  };
}

function playReferenceTrajectory(strategy: Strategy, seed = 1): CampaignState {
  let state: CampaignState = { ...createCampaign(SCENARIO_V3, seed), phase: "chapter_intro" };
  for (let step = 0; step < 1_000 && state.phase !== "verdict"; step += 1) {
    if (state.phase === "decision") {
      const decision = currentDecision(state, SCENARIO_V3);
      assert.ok(decision);
      const option = strategy(decision.options, state.decisions.length);
      state = confirmSelection(selectOption(state, SCENARIO_V3, decision.id, option.id), SCENARIO_V3);
    } else if (state.phase === "crisis") {
      const crisis = state.activeCrisis;
      assert.ok(crisis);
      assert.ok(crisis.aggravatingChoices.length > 0);
      for (const choice of crisis.aggravatingChoices) {
        const record = state.decisions.find((decision) => decision.decisionId === choice.decisionId);
        assert.equal(record?.optionId, choice.optionId);
        const rule = SCENARIO_V3_CRISIS_RULES.find((candidate) => candidate.id === crisis.ruleId)!;
        assert.ok(rule.aggravatingChoices.some((reference) =>
          reference.decisionId === choice.decisionId && reference.optionIds.includes(choice.optionId)));
      }
      const concession = availableConcessions(state, SCENARIO_V3_CRISIS_RULES)[0];
      state = resolveCrisis(state, SCENARIO_V3_CRISIS_RULES, concession?.id ?? "hold-course");
    } else {
      state = advanceCampaign(state, SCENARIO_V3, SCENARIO_V3_CRISIS_RULES);
    }
  }
  return state;
}

function directStateForRule(rule: CrisisRule): CampaignState {
  const count = SCENARIO_V3.chapters
    .slice(0, rule.eligibleFromChapterIndex + 1)
    .reduce((total, chapter) => total + chapter.decisionIds.length, 0);
  const concessionTarget = rule.concessions[0]?.targetDecisionId;
  const aggravating = rule.aggravatingChoices.find((choice) => choice.decisionId === concessionTarget)
    ?? rule.aggravatingChoices[0]!;
  const decisions = SCENARIO_V3.chapters.flatMap((chapter) => chapter.decisionIds).slice(0, count).map((decisionId, index) => {
    const decision = SCENARIO_V3.decisions.find((candidate) => candidate.id === decisionId)!;
    return {
      decisionId,
      optionId: decisionId === aggravating.decisionId ? aggravating.optionIds[0]! : decision.options[0]!.id,
      status: "confirmed" as const,
      confirmedAtIndex: index + 1,
    };
  });
  const state: CampaignState = {
    ...createCampaign(SCENARIO_V3),
    phase: "decision_result",
    ...positionAfterCompleted(SCENARIO_V3, count)!,
    decisions,
  };
  state.indicators[rule.indicator] = rule.threshold;
  return state;
}

test("le scénario déclare huit familles exactes, une par chapitre", () => {
  assert.equal(SCENARIO_V3_CRISIS_RULES.length, 8);
  assert.deepEqual(SCENARIO_V3_CRISIS_RULES.map((rule) => rule.eligibleFromChapterIndex), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(new Set(SCENARIO_V3_CRISIS_RULES.map((rule) => rule.id)).size, 8);

  for (const rule of SCENARIO_V3_CRISIS_RULES) {
    assert.equal(rule.maxOccurrences, 1, rule.id);
    assert.ok(rule.requiredDecisionIds.length > 0, rule.id);
    assert.ok(rule.aggravatingChoices.length > 0, rule.id);
    assert.ok(rule.holdCourseEffects.some((effect) => effect.delta !== 0), rule.id);
    for (const choice of rule.aggravatingChoices) {
      const decision = SCENARIO_V3.decisions.find((candidate) => candidate.id === choice.decisionId);
      assert.ok(decision, `${rule.id}:${choice.decisionId}`);
      assert.ok(choice.optionIds.length > 0, `${rule.id}:${choice.decisionId}`);
      assert.ok(choice.optionIds.every((optionId) => decision.options.some((option) => option.id === optionId)));
    }
    assert.ok(rule.requiredDecisionIds.every((decisionId) => SCENARIO_V3.decisions.some((decision) => decision.id === decisionId)));
    assert.ok(rule.concessions.every((concession) =>
      concession.effects.length > 0 && concession.effects.every((effect) => effect.delta !== 0)));
  }
});

test("chacune des huit familles peut se déclencher et sa concession modifie une politique active", () => {
  for (const rule of SCENARIO_V3_CRISIS_RULES) {
    const crisis = detectCrisis(directStateForRule(rule), SCENARIO_V3, [rule]);
    assert.equal(crisis.activeCrisis?.ruleId, rule.id, rule.id);
    assert.equal(crisis.activeCrisis?.triggeredChapterIndex, rule.eligibleFromChapterIndex, rule.id);
    assert.ok(crisis.activeCrisis?.aggravatingChoices.length, rule.id);

    const concession = availableConcessions(crisis, [rule])[0];
    assert.ok(concession, `${rule.id}:concession disponible`);
    const resolved = resolveCrisis(crisis, [rule], concession.id);
    assert.notEqual(
      resolved.decisions.find((decision) => decision.decisionId === concession.targetDecisionId)?.status,
      "confirmed",
      rule.id,
    );
    assert.ok(resolved.causalLedger.some((entry) => entry.sourceType === "crisis" && entry.sourceId === rule.id), rule.id);
  }
});

test("la trajectoire toute prudence rencontre entre quatre et huit crises", () => {
  const state = playReferenceTrajectory((options) => options.at(-1)!);
  assert.equal(state.phase, "verdict");
  assert.ok(state.crisisHistory.length >= 4 && state.crisisHistory.length <= 8, state.crisisHistory.map((crisis) => crisis.ruleId).join(","));
});

test("la trajectoire toute rupture rencontre entre quatre et huit crises", () => {
  const state = playReferenceTrajectory((options) => options[0]!);
  assert.equal(state.phase, "verdict");
  assert.ok(state.crisisHistory.length >= 4 && state.crisisHistory.length <= 8, state.crisisHistory.map((crisis) => crisis.ruleId).join(","));
});

for (const seed of [7, 19, 43, 97, 1_337]) {
  test(`la trajectoire de référence seed ${seed} rencontre entre quatre et huit crises`, () => {
    const random = xorshift(seed);
    const state = playReferenceTrajectory((options) => options[random() % options.length]!, seed);
    const chapters = state.crisisHistory.map((crisis) => crisis.triggeredChapterIndex);

    assert.equal(state.phase, "verdict");
    assert.ok(state.crisisHistory.length >= 4 && state.crisisHistory.length <= 8, state.crisisHistory.map((crisis) => crisis.ruleId).join(","));
    assert.equal(new Set(chapters).size, chapters.length);
    assert.ok(state.crisisHistory.every((crisis) => crisis.triggeredAtDecisionCount >= 1 && crisis.triggeredAtDecisionCount <= 60));
  });
}

test("la crise de la flat tax cite le choix exact et permet de suspendre la réforme", () => {
  const target = "flat-tax-a-20-des-le-premier";
  const decisionIndex = SCENARIO_V3.decisions.findIndex((decision) => decision.id === target);
  const choices = Object.fromEntries(SCENARIO_V3.decisions.slice(0, decisionIndex).map((decision) => [decision.id, decision.options.at(-1)!.id]));
  choices[target] = `${target}:adopt`;
  const count = decisionIndex + 1;
  const state: CampaignState = {
    ...createCampaign(SCENARIO_V3),
    phase: "decision_result",
    ...positionAfterCompleted(SCENARIO_V3, count)!,
    decisions: SCENARIO_V3.decisions.slice(0, count).map((decision, index) => ({
      decisionId: decision.id,
      optionId: choices[decision.id]!,
      status: "confirmed",
      confirmedAtIndex: index + 1,
    })),
  };
  const rule = SCENARIO_V3_CRISIS_RULES[0]!;
  const crisis = detectCrisis(state, SCENARIO_V3, [rule]);

  assert.ok(crisis.activeCrisis?.aggravatingChoices.some((choice) =>
    choice.decisionId === target && choice.optionId === `${target}:adopt`));
  assert.equal(crisis.activeCrisis?.triggeredByDecisionId, target);
  const suspended = resolveCrisis(crisis, [rule], "suspend-flat-tax");
  assert.equal(suspended.decisions.find((record) => record.decisionId === target)?.status, "suspended");
  assert.equal(suspended.decisions.find((record) => record.decisionId === target)?.changedByCrisisId, "flat-tax-revolt");
});

test("les textes des crises ne contiennent aucun cadratin", () => {
  assert.equal(JSON.stringify(SCENARIO_V3_CRISIS_RULES).includes("\u2014"), false);
});

test("les crises V10 ne citent que des causes et réponses publiées", () => {
  const publishedIds = new Set(CAMPAIGN_DECISION_IDS);
  const optionIds = new Set(SCENARIO_V10_CATALOGUE.decisions
    .filter((decision) => publishedIds.has(decision.id))
    .flatMap((decision) => decision.options.map((option) => option.id)));

  for (const rule of SCENARIO_V10_CRISIS_RULES) {
    assert.ok(rule.requiredDecisionIds.every((id) => publishedIds.has(id)), `${rule.id}:required`);
    assert.ok(rule.aggravatingChoices.length >= 2, `${rule.id}:causes`);
    assert.ok(rule.concessions.length >= 1, `${rule.id}:answers`);
    for (const choice of rule.aggravatingChoices) {
      assert.ok(publishedIds.has(choice.decisionId), `${rule.id}:${choice.decisionId}`);
      assert.ok(choice.optionIds.every((id) => optionIds.has(id)), `${rule.id}:${choice.decisionId}`);
    }
    for (const concession of rule.concessions) {
      assert.ok(publishedIds.has(concession.targetDecisionId), `${rule.id}:${concession.id}`);
    }
  }
});

test("la crise V10 IR-CSG ne propose que le maintien implicite ou la révocation neutre", () => {
  const rule = SCENARIO_V10_CRISIS_RULES.find((candidate) => candidate.id === "v10-tax-legitimacy")!;
  assert.deepEqual(rule.concessions.map((concession) => concession.id), ["reverse-ir-csg-unification"]);
  assert.equal(rule.concessions[0]!.targetDecisionId, "unifier-ir-csg-bareme-continu");
  assert.equal(rule.concessions[0]!.policyChange, "reverse");
  assert.equal(rule.concessions[0]!.effects.some((effect) => effect.target === "indicator" && effect.key === "annualBalance"), false);
});

test("la crise V10 de réforme de l'État offre exactement maintien et une concession applicable", () => {
  const rule = SCENARIO_V10_CRISIS_RULES.find((candidate) => candidate.id === "v10-state-capacity")!;
  assert.equal(rule.aggravatingChoices.length, 2);
  assert.equal(rule.concessions.length, 1);
  assert.equal(rule.concessions[0]!.targetDecisionId, rule.aggravatingChoices[0]!.decisionId);
});
