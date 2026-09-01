import assert from "node:assert/strict";
import test from "node:test";

import { BALANCED_PATHS, simulatePath } from "./balanced-paths.ts";
import { SCENARIO_V10_CRISIS_RULES, SCENARIO_V3_CRISIS_RULES } from "./scenario-crises.ts";
import { SCENARIO_V3_PREVIEW } from "./scenario.ts";
import { SCENARIO_V10 } from "./scenario-v10.ts";
import { createTestCampaign as createCampaign, testAnnualCheckpoints, validScenario } from "./test-fixtures.ts";
import type { CampaignState, CausalEntry } from "./types.ts";
import { totalDecisions } from "./validation.ts";
import { buildMandateVerdictViewModel } from "./verdict.ts";

const INITIAL_INDICATORS = createCampaign(validScenario()).indicators;

test("le verdict V10 reste unique après chaque parcours budgétaire publié", () => {
  for (const path of BALANCED_PATHS) {
    const finalState = simulatePath(path, SCENARIO_V10);
    const verdict = buildMandateVerdictViewModel(finalState, SCENARIO_V10, SCENARIO_V10_CRISIS_RULES);
    assert.equal(finalState.phase, "verdict");
    assert.equal(verdict.trajectory.at(-1)?.label, "Verdict final");
    assert.equal(verdict.annualBalance, finalState.indicators.annualBalance);
  }
});

test("le verdict V10 classe le parcours réel par les rythmes annuels des profils publiés", () => {
  const finalState = simulatePath(BALANCED_PATHS[0]!, SCENARIO_V10);
  const view = buildMandateVerdictViewModel(finalState, SCENARIO_V10, SCENARIO_V10_CRISIS_RULES);

  assert.deepEqual(view.decisiveChoices.map(({ decisionId, budgetDelta, budgetDuration }) => [decisionId, budgetDelta, budgetDuration]), [
    ["supprimer-subventions-directes-entreprises", 24_600, "annual"],
    ["unifier-ir-csg-bareme-continu", 17_900, "annual"],
    ["clarifier-competences-doublons-territoriaux", 7_500, "annual"],
  ]);
});

test("le verdict V10 affiche le rythme EPR2 du profil lorsque la décision est retenue", () => {
  const finalState = simulatePath(BALANCED_PATHS[0]!, SCENARIO_V10);
  const epr2 = SCENARIO_V10.decisions.find((decision) => decision.id === "engager-six-epr2-part-annuelle-de-l")!;
  const state = {
    ...finalState,
    decisions: finalState.decisions.map((record) => {
      const decision = SCENARIO_V10.decisions.find((candidate) => candidate.id === record.decisionId)!;
      return {
        ...record,
        optionId: decision.id === epr2.id ? epr2.options.find((option) => option.id.endsWith(":adopt"))!.id : decision.options.find((option) => option.id.endsWith(":keep"))!.id,
      };
    }),
  };
  const view = buildMandateVerdictViewModel(state, SCENARIO_V10, SCENARIO_V10_CRISIS_RULES);

  assert.deepEqual(view.decisiveChoices[0] && [view.decisiveChoices[0].decisionId, view.decisiveChoices[0].budgetDelta, view.decisiveChoices[0].budgetDuration], [
    "engager-six-epr2-part-annuelle-de-l", -2_000, "annual",
  ]);
});

test("le verdict V10 affiche un flux de transition comme impact ponctuel", () => {
  const finalState = simulatePath(BALANCED_PATHS[0]!, SCENARIO_V10);
  const euroExit = SCENARIO_V10.decisions.find((decision) => decision.id === "sortir-de-l-euro")!;
  const state = {
    ...finalState,
    decisions: finalState.decisions.map((record) => {
      const decision = SCENARIO_V10.decisions.find((candidate) => candidate.id === record.decisionId)!;
      return {
        ...record,
        optionId: decision.id === euroExit.id ? euroExit.options.find((option) => option.id.endsWith(":adopt"))!.id : decision.options.find((option) => option.id.endsWith(":keep"))!.id,
      };
    }),
  };
  const view = buildMandateVerdictViewModel(state, SCENARIO_V10, SCENARIO_V10_CRISIS_RULES);

  assert.deepEqual(view.decisiveChoices[0] && [view.decisiveChoices[0].decisionId, view.decisiveChoices[0].budgetDelta, view.decisiveChoices[0].budgetDuration], [
    "sortir-de-l-euro", -35_000, "once",
  ]);
});

function completedCampaign(): CampaignState {
  const base = createCampaign(SCENARIO_V3_PREVIEW);
  const finalAnnualBalance = base.indicators.annualBalance + 20_000;
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
    annualCheckpoints: testAnnualCheckpoints(SCENARIO_V3_PREVIEW, 5, finalAnnualBalance),
    causalLedger,
    indicators: {
      ...base.indicators,
      annualBalance: finalAnnualBalance,
      growth: base.indicators.growth + 0.4,
      majority: base.indicators.majority - 7,
      opinion: base.indicators.opinion - 7,
    },
  };
}

test("reconstruit cinq jalons et termine sur les indicateurs réels", () => {
  const state = completedCampaign();
  const view = buildMandateVerdictViewModel(state, SCENARIO_V3_PREVIEW, SCENARIO_V3_CRISIS_RULES);
  const total = totalDecisions(SCENARIO_V3_PREVIEW);

  assert.deepEqual(view.trajectory.map((point) => point.decisionCount), [16, 32, 39, 53, 60]);
  assert.ok(view.trajectory.every((point) => point.decisionCount <= total));
  assert.deepEqual(view.trajectory.at(-1), {
    decisionCount: total,
    label: "Verdict final",
    annualBalance: state.indicators.annualBalance,
    majority: state.indicators.majority,
  });
  assert.equal(view.trajectory[0]!.annualBalance, state.indicators.annualBalance);
  assert.equal(view.trajectory[2]!.majority, INITIAL_INDICATORS.majority);
});

test("le verdict distingue le flux ponctuel du dernier exercice et le rythme annuel final", () => {
  const state = completedCampaign();
  const finalRunRate = state.indicators.annualBalance;
  const finalRecord = state.decisions.at(-1)!;
  const oneOffCause: CausalEntry = {
    id: "decision:final:one-off:4",
    sourceType: "decision",
    sourceId: `${finalRecord.decisionId}:${finalRecord.optionId}`,
    target: "indicator",
    key: "annualBalance",
    delta: -5_000,
    duration: "once",
    explanation: "Le dernier exercice absorbe un coût ponctuel.",
    appliedAtDecision: finalRecord.confirmedAtIndex,
  };
  state.causalLedger.push(oneOffCause);
  state.annualCheckpoints.at(-1)!.annualBalance = finalRunRate - 5_000;
  state.annualCheckpoints.at(-1)!.causes.push(oneOffCause.id);

  const view = buildMandateVerdictViewModel(state, SCENARIO_V3_PREVIEW, SCENARIO_V3_CRISIS_RULES);

  assert.equal(view.trajectory.at(-1)?.annualBalance, finalRunRate - 5_000);
  assert.equal(view.annualBalance, finalRunRate);
  assert.equal(view.annualBalanceDelta, finalRunRate - state.baseline.annualBalanceMillions);
});

test("la trajectoire relit les jalons persistés sans les recalculer depuis le scénario", () => {
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

  assert.deepEqual(view.trajectory.map((point) => point.decisionCount), [16, 32, 39, 53, 60]);
  assert.equal(view.trajectory.at(-1)?.label, "Verdict final");
});

test("calcule les écarts des signaux depuis le début du mandat", () => {
  const view = buildMandateVerdictViewModel(completedCampaign(), SCENARIO_V3_PREVIEW, SCENARIO_V3_CRISIS_RULES);

  assert.ok(Math.abs(view.signals[0]!.delta - 0.4) < 1e-12);
  assert.deepEqual(view.signals.slice(1).map((signal) => [signal.key, signal.value, signal.delta]), [
    ["majority", INITIAL_INDICATORS.majority - 7, -7],
    ["opinion", INITIAL_INDICATORS.opinion - 7, -7],
  ]);
  assert.equal(view.annualBalanceDelta, 20_000);
  assert.equal(view.signals[0]!.descriptor, "Croissance nominale soutenue");
});

test("le score mesure le déficit résorbé, sans dépasser la cible", () => {
  const state = completedCampaign();
  const view = buildMandateVerdictViewModel(state, SCENARIO_V3_PREVIEW, SCENARIO_V3_CRISIS_RULES);
  const target = Math.abs(state.baseline.annualBalanceMillions);

  assert.equal(view.target, target);
  assert.equal(view.score, 20_000);
  assert.equal(view.remaining, target - 20_000);
  assert.equal(view.surplus, 0);

  state.indicators.annualBalance = 8_000;
  const surplus = buildMandateVerdictViewModel(state, SCENARIO_V3_PREVIEW, SCENARIO_V3_CRISIS_RULES);
  assert.equal(surplus.score, target);
  assert.equal(surplus.remaining, 0);
  assert.equal(surplus.surplus, 8_000);
});

test("un déficit aggravé produit un score négatif et affiche le déficit réellement restant", () => {
  const state = completedCampaign();
  const target = Math.abs(state.baseline.annualBalanceMillions);
  state.indicators.annualBalance = state.baseline.annualBalanceMillions - 31_000;

  const view = buildMandateVerdictViewModel(state, SCENARIO_V3_PREVIEW, SCENARIO_V3_CRISIS_RULES);

  assert.equal(view.target, target);
  assert.equal(view.score, -31_000);
  assert.equal(view.remaining, target + 31_000);
  assert.equal(view.surplus, 0);
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
