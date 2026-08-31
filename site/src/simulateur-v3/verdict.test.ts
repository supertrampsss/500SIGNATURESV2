import assert from "node:assert/strict";
import test from "node:test";

import { createCampaign, INITIAL_INDICATORS } from "./campaign.ts";
import { SCENARIO_V3_CRISIS_RULES } from "./scenario-crises.ts";
import { SCENARIO_V3_PREVIEW } from "./scenario.ts";
import type { CampaignState, CausalEntry } from "./types.ts";
import { totalDecisions } from "./validation.ts";
import { buildMandateVerdictViewModel } from "./verdict.ts";

function completedCampaign(): CampaignState {
  const base = createCampaign(SCENARIO_V3_PREVIEW);
  const decisions = SCENARIO_V3_PREVIEW.decisions.map((decision, index) => ({
    decisionId: decision.id,
    optionId: decision.options[0]!.id,
    status: "confirmed" as const,
    confirmedAtIndex: index + 1,
  }));
  const causalLedger: CausalEntry[] = [
    {
      id: "decision:first:balance:1",
      sourceType: "decision",
      sourceId: `${decisions[0]!.decisionId}:${decisions[0]!.optionId}`,
      target: "indicator",
      key: "annualBalance",
      delta: 20_000,
      duration: "annual",
      explanation: "Le solde progresse.",
      appliedAtDecision: 1,
    },
    {
      id: "decision:first:growth:2",
      sourceType: "decision",
      sourceId: `${decisions[0]!.decisionId}:${decisions[0]!.optionId}`,
      target: "indicator",
      key: "growth",
      delta: 0.4,
      duration: "annual",
      explanation: "La croissance réagit.",
      appliedAtDecision: 1,
    },
    {
      id: "event:later:majority:3",
      sourceType: "event",
      sourceId: "later",
      target: "indicator",
      key: "majority",
      delta: -7,
      duration: "once",
      explanation: "La majorité se resserre.",
      appliedAtDecision: 48,
    },
  ];
  return {
    ...base,
    phase: "verdict",
    chapterIndex: 7,
    decisionIndex: 6,
    decisions,
    causalLedger,
    indicators: {
      ...base.indicators,
      annualBalance: -133_000,
      growth: 1.3,
      majority: 55,
      opinion: 51,
    },
  };
}

test("reconstruit cinq jalons et termine sur les indicateurs réels", () => {
  const state = completedCampaign();
  const view = buildMandateVerdictViewModel(state, SCENARIO_V3_PREVIEW, SCENARIO_V3_CRISIS_RULES);
  const total = totalDecisions(SCENARIO_V3_PREVIEW);

  assert.deepEqual(view.trajectory.map((point) => point.decisionCount), [0, 15, 30, 45, 60]);
  assert.ok(view.trajectory.every((point) => point.decisionCount <= total));
  assert.deepEqual(view.trajectory.at(-1), {
    decisionCount: total,
    label: "Verdict final",
    annualBalance: state.indicators.annualBalance,
    majority: state.indicators.majority,
  });
  assert.equal(view.trajectory[0]!.annualBalance, INITIAL_INDICATORS.annualBalance);
  assert.equal(view.trajectory[1]!.annualBalance, -133_000);
  assert.equal(view.trajectory[3]!.majority, INITIAL_INDICATORS.majority);
});

test("dédoublonne les jalons arrondis d'une petite topologie", () => {
  const state = completedCampaign();
  const scenario = {
    ...SCENARIO_V3_PREVIEW,
    chapters: [{
      ...SCENARIO_V3_PREVIEW.chapters[0]!,
      decisionIds: SCENARIO_V3_PREVIEW.chapters[0]!.decisionIds.slice(0, 2),
    }],
    decisions: SCENARIO_V3_PREVIEW.decisions.slice(0, 2),
  };

  const view = buildMandateVerdictViewModel(state, scenario, []);

  assert.deepEqual(view.trajectory.map((point) => point.decisionCount), [0, 1, 2]);
  assert.equal(view.trajectory.at(-1)?.label, "Verdict final");
});

test("calcule les écarts des signaux depuis le début du mandat", () => {
  const view = buildMandateVerdictViewModel(completedCampaign(), SCENARIO_V3_PREVIEW, SCENARIO_V3_CRISIS_RULES);

  assert.deepEqual(view.signals.map((signal) => [signal.key, signal.value, signal.delta]), [
    ["growth", 1.3, 0.4],
    ["majority", 55, -7],
    ["opinion", 51, -7],
  ]);
  assert.equal(view.annualBalanceDelta, 20_000);
});

test("classe trois choix distincts et ne transporte pas la question à répéter", () => {
  const view = buildMandateVerdictViewModel(completedCampaign(), SCENARIO_V3_PREVIEW, SCENARIO_V3_CRISIS_RULES);

  assert.equal(view.decisiveChoices.length, 3);
  assert.equal(new Set(view.decisiveChoices.map((choice) => choice.decisionId)).size, 3);
  assert.ok(view.decisiveChoices.every((choice) => !("question" in choice)));
  assert.ok(view.decisiveChoices.every((choice) => choice.chapter.length > 0));
});

test("rend autonomes les libellés courts des décisions décisives", () => {
  const state = completedCampaign();
  const scenario = structuredClone(SCENARIO_V3_PREVIEW);
  const retirementIndex = state.decisions.findIndex((record) => record.decisionId === "repousser-l-age-legal-a-65-ans");
  const retirement = scenario.decisions.find((decision) => decision.id === "repousser-l-age-legal-a-65-ans");
  assert.notEqual(retirementIndex, -1);
  assert.ok(retirement);
  state.decisions = [{
    ...state.decisions[retirementIndex]!,
    optionId: retirement.options[0]!.id,
  }];

  const view = buildMandateVerdictViewModel(state, scenario, SCENARIO_V3_CRISIS_RULES);

  assert.equal(view.decisiveChoices[0]!.label, "Porter l'âge légal à 65 ans");
});

test("raconte une crise et la réforme réellement suspendue", () => {
  const state = completedCampaign();
  const first = state.decisions[0]!;
  state.decisions[0] = { ...first, status: "suspended", changedByCrisisId: "flat-tax-revolt" };
  state.crisisHistory = [{
    ruleId: "flat-tax-revolt",
    triggeredByDecisionId: first.decisionId,
    aggravatingDecisionIds: [first.decisionId],
    resolvedBy: "suspend-flat-tax",
  }];

  const view = buildMandateVerdictViewModel(state, SCENARIO_V3_PREVIEW, SCENARIO_V3_CRISIS_RULES);

  assert.ok(view.aftermath.some((item) => item.kind === "crisis" && item.title.includes("fracture")));
  assert.ok(view.aftermath.some((item) => item.kind === "policy" && item.status === "Suspendue"));
});

test("ne crée aucune section de suites quand le mandat n'en porte pas", () => {
  const view = buildMandateVerdictViewModel(completedCampaign(), SCENARIO_V3_PREVIEW, SCENARIO_V3_CRISIS_RULES);
  assert.deepEqual(view.aftermath, []);
});
