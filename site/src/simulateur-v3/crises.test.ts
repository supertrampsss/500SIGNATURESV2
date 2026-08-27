import assert from "node:assert/strict";
import { test } from "node:test";

import { createCampaign } from "./campaign.ts";
import { availableConcessions, detectCrisis, resolveCrisis } from "./crises.ts";
import { validScenario } from "./test-fixtures.ts";
import type { CampaignState, CrisisRule, DecisionRecord, EffectRule } from "./types.ts";

const majorityCost: EffectRule = {
  id: "majority-cost",
  target: "indicator",
  key: "majority",
  delta: -12,
  timing: { kind: "immediate" },
  duration: "once",
  explanation: "La majorité se fracture.",
};

function socialCrisisRule(): CrisisRule {
  return {
    id: "social-crisis",
    title: "La rue bloque le pays",
    body: "Plusieurs décisions ont cristallisé la mobilisation.",
    indicator: "opinion",
    threshold: 20,
    comparator: "lte",
    aggravatingDecisionIds: ["pensions", "fuel-tax"],
    concessions: [{
      id: "suspend-pensions",
      label: "Suspendre la réforme des retraites",
      targetDecisionId: "pensions",
      policyChange: "suspend",
      effects: [{
        id: "concession-opinion",
        target: "indicator",
        key: "opinion",
        delta: 10,
        timing: { kind: "immediate" },
        duration: "once",
        explanation: "La suspension apaise une partie du conflit.",
      }],
    }],
    holdCourseEffects: [majorityCost],
  };
}

function stateWithConfirmedDecisions(ids: string[]): CampaignState {
  const state = createCampaign(validScenario(), 42);
  const decisions: DecisionRecord[] = ids.map((decisionId, index) => ({
    decisionId,
    optionId: "adopt",
    status: "confirmed",
    confirmedAtIndex: index + 1,
  }));
  return { ...state, phase: "decision_result", decisions };
}

function stateInSocialCrisis(): CampaignState {
  const state = stateWithConfirmedDecisions(["pensions", "fuel-tax"]);
  return {
    ...state,
    phase: "crisis",
    activeCrisis: {
      ruleId: "social-crisis",
      triggeredByDecisionId: "fuel-tax",
      aggravatingDecisionIds: ["pensions", "fuel-tax"],
    },
    crisisHistory: [],
  };
}

function stateInSocialCrisisWithoutDecision(decisionId: string): CampaignState {
  const state = stateInSocialCrisis();
  return { ...state, decisions: state.decisions.filter((entry) => entry.decisionId !== decisionId) };
}

test("une crise cite la décision déclencheuse et les décisions aggravantes", () => {
  const state = stateWithConfirmedDecisions(["pensions", "fuel-tax"]);
  state.indicators.opinion = 19;
  const triggered = detectCrisis(state, [socialCrisisRule()]);
  assert.deepEqual(triggered.activeCrisis, {
    ruleId: "social-crisis",
    triggeredByDecisionId: "fuel-tax",
    aggravatingDecisionIds: ["pensions", "fuel-tax"],
  });
  assert.equal(triggered.phase, "crisis");
});

test("une concession suspend réellement une décision confirmée", () => {
  const state = stateInSocialCrisis();
  const resolved = resolveCrisis(state, [socialCrisisRule()], "suspend-pensions");
  assert.equal(resolved.decisions.find((entry) => entry.decisionId === "pensions")?.status, "suspended");
  assert.equal(resolved.decisions.find((entry) => entry.decisionId === "pensions")?.changedByCrisisId, "social-crisis");
  assert.equal(resolved.activeCrisis, undefined);
});

test("une concession indisponible n'est jamais proposée", () => {
  const state = stateInSocialCrisisWithoutDecision("pensions");
  assert.deepEqual(availableConcessions(state, [socialCrisisRule()]).map((item) => item.id), []);
});

test("maintenir le cap applique son coût politique et garde la réforme", () => {
  const state = stateInSocialCrisis();
  const resolved = resolveCrisis(state, [socialCrisisRule()], "hold-course");
  assert.equal(resolved.decisions.find((entry) => entry.decisionId === "pensions")?.status, "confirmed");
  assert.ok(resolved.indicators.majority < state.indicators.majority);
});

test("une crise attend le seuil, une décision confirmée, et respecte l'ordre des règles", () => {
  const first = { ...socialCrisisRule(), id: "first-crisis", threshold: 60, aggravatingDecisionIds: ["pensions"] };
  const second = { ...socialCrisisRule(), id: "second-crisis", threshold: 60, aggravatingDecisionIds: ["fuel-tax"] };
  const state = stateWithConfirmedDecisions(["pensions", "fuel-tax"]);
  state.indicators.opinion = 60;
  assert.equal(detectCrisis({ ...state, decisions: [{ ...state.decisions[0]!, status: "suspended" }] }, [first]).activeCrisis, undefined);
  assert.equal(detectCrisis({ ...state, resolvedCrisisIds: ["first-crisis"] }, [first]).activeCrisis, undefined);
  assert.equal(detectCrisis(state, [first, second]).activeCrisis?.ruleId, "first-crisis");
  assert.equal(detectCrisis({ ...state, activeCrisis: { ruleId: "open", triggeredByDecisionId: "pensions", aggravatingDecisionIds: ["pensions"] } }, [first]).activeCrisis?.ruleId, "open");
});

test("les concessions visent aussi une décision amendée", () => {
  const state = stateInSocialCrisis();
  state.decisions[0]!.status = "amended";
  assert.deepEqual(availableConcessions(state, [socialCrisisRule()]).map((item) => item.id), ["suspend-pensions"]);
});

test("une concession consigne l'amendement, ses effets et la résolution de crise", () => {
  const rule: CrisisRule = {
    ...socialCrisisRule(),
    concessions: [{
      id: "amend-pensions",
      label: "Amender", targetDecisionId: "pensions", policyChange: "amend",
      effects: [{ ...majorityCost, id: "amend-cost", delta: -3 }],
    }],
  };
  const resolved = resolveCrisis(stateInSocialCrisis(), [rule], "amend-pensions");
  assert.equal(resolved.decisions[0]?.status, "amended");
  assert.deepEqual(resolved.crisisHistory, [{
    ruleId: "social-crisis", triggeredByDecisionId: "fuel-tax", aggravatingDecisionIds: ["pensions", "fuel-tax"], resolvedBy: "amend-pensions",
  }]);
  assert.deepEqual(resolved.resolvedCrisisIds, ["social-crisis"]);
  assert.equal(resolved.phase, "decision_result");
  assert.deepEqual(resolved.causalLedger.at(-1), {
    id: "crisis:social-crisis:amend-cost:1", sourceType: "crisis", sourceId: "social-crisis",
    target: "indicator", key: "majority", delta: -3, explanation: "La majorité se fracture.", appliedAtDecision: 2,
  });
});

test("une concession peut renverser une décision et une résolution indisponible est refusée", () => {
  const rule: CrisisRule = {
    ...socialCrisisRule(),
    concessions: [{ id: "reverse-pensions", label: "Renverser", targetDecisionId: "pensions", policyChange: "reverse", effects: [] }],
  };
  const state = stateInSocialCrisis();
  assert.throws(() => resolveCrisis(stateInSocialCrisisWithoutDecision("pensions"), [rule], "reverse-pensions"), /not offered/);
  assert.throws(() => resolveCrisis(state, [rule], "unknown"), /not offered/);
  assert.equal(resolveCrisis(state, [rule], "reverse-pensions").decisions[0]?.status, "reversed");
});
