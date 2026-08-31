import assert from "node:assert/strict";
import { test } from "node:test";

import { availableConcessions, detectCrisis, resolveCrisis } from "./crises.ts";
import { createTestCampaign as createCampaign, validScenario } from "./test-fixtures.ts";
import type {
  CampaignState,
  CrisisRule,
  CrisisState,
  DecisionStatus,
  EffectRule,
  Scenario,
} from "./types.ts";
import { positionAfterCompleted } from "./validation.ts";

const majorityCost: EffectRule = {
  id: "majority-cost",
  target: "indicator",
  key: "majority",
  delta: -12,
  timing: { kind: "immediate" },
  duration: "once",
  explanation: "La majorité se fracture.",
};

function socialCrisisRule(overrides: Partial<CrisisRule> = {}): CrisisRule {
  return {
    id: "social-crisis",
    title: "La rue bloque le pays",
    body: "Plusieurs choix précis ont cristallisé la mobilisation.",
    indicator: "opinion",
    threshold: 60,
    comparator: "lte",
    eligibleFromChapterIndex: 0,
    maxOccurrences: 1,
    requiredDecisionIds: ["decision-1", "decision-2"],
    aggravatingChoices: [
      { decisionId: "decision-1", optionIds: ["decision-1-option-a"] },
      { decisionId: "decision-2", optionIds: ["decision-2-option-a"] },
    ],
    concessions: [{
      id: "suspend-first-policy",
      label: "Suspendre la première réforme",
      targetDecisionId: "decision-1",
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
    ...overrides,
  };
}

function stateAfterChoices(
  scenario: Scenario,
  count: number,
  choices: Readonly<Record<string, string>> = {},
): CampaignState {
  const decisions = scenario.chapters
    .flatMap((chapter) => chapter.decisionIds)
    .slice(0, count)
    .map((decisionId, index) => {
      const decision = scenario.decisions.find((candidate) => candidate.id === decisionId)!;
      return {
        decisionId,
        optionId: choices[decisionId] ?? decision.options[0]!.id,
        status: "confirmed" as DecisionStatus,
        confirmedAtIndex: index + 1,
      };
    });
  return {
    ...createCampaign(scenario, 42),
    phase: "decision_result",
    ...positionAfterCompleted(scenario, count)!,
    decisions,
  };
}

function triggeredSocialCrisis(scenario = validScenario()): CampaignState {
  return detectCrisis(stateAfterChoices(scenario, 2), scenario, [socialCrisisRule()]);
}

function resolvedCrisis(
  ruleId: string,
  chapterIndex: number,
  triggeredAtDecisionCount: number,
): CrisisState {
  return {
    ruleId,
    triggeredAtDecisionCount,
    triggeredChapterIndex: chapterIndex,
    triggeredByDecisionId: "decision-1",
    aggravatingDecisionIds: ["decision-1"],
    aggravatingChoices: [{ decisionId: "decision-1", optionId: "decision-1-option-a" }],
    resolvedBy: "hold-course",
  };
}

test("une crise persiste le chapitre, le compteur et chaque choix aggravant exact", () => {
  const scenario = validScenario();
  const triggered = detectCrisis(stateAfterChoices(scenario, 2), scenario, [socialCrisisRule()]);

  assert.deepEqual(triggered.activeCrisis, {
    ruleId: "social-crisis",
    triggeredAtDecisionCount: 2,
    triggeredChapterIndex: 0,
    triggeredByDecisionId: "decision-2",
    aggravatingDecisionIds: ["decision-1", "decision-2"],
    aggravatingChoices: [
      { decisionId: "decision-1", optionId: "decision-1-option-a" },
      { decisionId: "decision-2", optionId: "decision-2-option-a" },
    ],
  });
  assert.equal(triggered.phase, "crisis");
});

test("le bon dossier avec la mauvaise option ne déclenche jamais la crise", () => {
  const scenario = validScenario();
  const state = stateAfterChoices(scenario, 2, {
    "decision-1": "decision-1-option-b",
    "decision-2": "decision-2-option-b",
  });

  assert.equal(detectCrisis(state, scenario, [socialCrisisRule()]).activeCrisis, undefined);
});

test("tous les dossiers requis doivent avoir un enregistrement confirmé", () => {
  const scenario = validScenario();
  const state = stateAfterChoices(scenario, 1);

  assert.equal(detectCrisis(state, scenario, [socialCrisisRule()]).activeCrisis, undefined);
});

test("un dossier requis suspendu ou renversé ne satisfait plus le prérequis", () => {
  const scenario = validScenario();
  for (const status of ["suspended", "reversed"] as const) {
    const state = stateAfterChoices(scenario, 2);
    state.decisions[1]!.status = status;
    assert.equal(detectCrisis(state, scenario, [socialCrisisRule()]).activeCrisis, undefined, status);
  }
});

test("une règle attend son chapitre éligible et le chapitre vient de la topologie courante", () => {
  const scenario = validScenario();
  const rule = socialCrisisRule({ eligibleFromChapterIndex: 1 });

  assert.equal(detectCrisis(stateAfterChoices(scenario, 12), scenario, [rule]).activeCrisis, undefined);
  const later = detectCrisis(stateAfterChoices(scenario, 13), scenario, [rule]);
  assert.equal(later.activeCrisis?.triggeredChapterIndex, 1);
  assert.equal(later.activeCrisis?.triggeredByDecisionId, "decision-2");
  assert.equal(later.activeCrisis?.triggeredAtDecisionCount, 13);
});

test("une même règle ne se répète pas et une seconde crise du chapitre est refusée", () => {
  const scenario = validScenario();
  const state = stateAfterChoices(scenario, 2);
  const prior = resolvedCrisis("prior-crisis", 0, 1);
  const afterPrior = {
    ...state,
    crisisHistory: [prior],
    resolvedCrisisIds: [prior.ruleId],
  };

  assert.equal(detectCrisis(afterPrior, scenario, [socialCrisisRule()]).activeCrisis, undefined);

  const sameRuleInLaterChapter = {
    ...stateAfterChoices(scenario, 13),
    crisisHistory: [resolvedCrisis("social-crisis", 0, 2)],
    resolvedCrisisIds: ["social-crisis"],
  };
  assert.equal(detectCrisis(sameRuleInLaterChapter, scenario, [socialCrisisRule()]).activeCrisis, undefined);
});

test("une autre crise peut survenir dans un chapitre ultérieur", () => {
  const scenario = validScenario();
  const state = {
    ...stateAfterChoices(scenario, 13),
    crisisHistory: [resolvedCrisis("chapter-zero-crisis", 0, 2)],
    resolvedCrisisIds: ["chapter-zero-crisis"],
  };
  const rule = socialCrisisRule({ id: "chapter-one-crisis", eligibleFromChapterIndex: 1 });

  assert.equal(detectCrisis(state, scenario, [rule]).activeCrisis?.ruleId, "chapter-one-crisis");
});

test("un mandat est plafonné à huit crises", () => {
  const scenario = validScenario();
  const history = Array.from({ length: 8 }, (_, chapterIndex) =>
    resolvedCrisis(`crisis-${chapterIndex}`, chapterIndex, chapterIndex * 12 + 1));
  const state = {
    ...stateAfterChoices(scenario, 85),
    crisisHistory: history,
    resolvedCrisisIds: history.map((crisis) => crisis.ruleId),
  };

  assert.equal(detectCrisis(state, scenario, [socialCrisisRule({ eligibleFromChapterIndex: 7 })]).activeCrisis, undefined);
});

test("une crise déjà active reste inchangée", () => {
  const scenario = validScenario();
  const state = triggeredSocialCrisis(scenario);

  assert.equal(detectCrisis(state, scenario, [socialCrisisRule()]), state);
});

test("une concession suspend réellement une politique active", () => {
  const state = triggeredSocialCrisis();
  const resolved = resolveCrisis(state, [socialCrisisRule()], "suspend-first-policy");

  assert.equal(resolved.decisions.find((entry) => entry.decisionId === "decision-1")?.status, "suspended");
  assert.equal(resolved.decisions.find((entry) => entry.decisionId === "decision-1")?.changedByCrisisId, "social-crisis");
  assert.equal(resolved.activeCrisis, undefined);
});

test("une concession indisponible n'est jamais proposée", () => {
  const state = triggeredSocialCrisis();
  state.decisions[0]!.status = "reversed";

  assert.deepEqual(availableConcessions(state, [socialCrisisRule()]), []);
});

test("maintenir le cap applique son coût politique et garde la réforme", () => {
  const state = triggeredSocialCrisis();
  const resolved = resolveCrisis(state, [socialCrisisRule()], "hold-course");

  assert.equal(resolved.decisions[0]?.status, "confirmed");
  assert.ok(resolved.indicators.majority < state.indicators.majority);
});

test("les règles éligibles gardent leur ordre éditorial", () => {
  const scenario = validScenario();
  const first = socialCrisisRule({ id: "first-crisis" });
  const second = socialCrisisRule({ id: "second-crisis" });

  assert.equal(detectCrisis(stateAfterChoices(scenario, 2), scenario, [first, second]).activeCrisis?.ruleId, "first-crisis");
});

test("les concessions visent aussi une décision amendée", () => {
  const state = triggeredSocialCrisis();
  state.decisions[0]!.status = "amended";

  assert.deepEqual(availableConcessions(state, [socialCrisisRule()]).map((item) => item.id), ["suspend-first-policy"]);
});

test("une résolution conserve toute la trace exacte de la crise", () => {
  const state = triggeredSocialCrisis();
  const resolved = resolveCrisis(state, [socialCrisisRule()], "suspend-first-policy");

  assert.deepEqual(resolved.crisisHistory, [{
    ...state.activeCrisis!,
    resolvedBy: "suspend-first-policy",
  }]);
  assert.deepEqual(resolved.resolvedCrisisIds, ["social-crisis"]);
  assert.equal(resolved.phase, "decision_result");
  assert.equal(resolved.causalLedger.at(-1)?.sourceId, "social-crisis");
});

test("une concession peut renverser une décision et une résolution indisponible est refusée", () => {
  const rule: CrisisRule = {
    ...socialCrisisRule(),
    concessions: [{
      id: "reverse-first-policy",
      label: "Renverser",
      targetDecisionId: "decision-1",
      policyChange: "reverse",
      effects: [],
    }],
  };
  const state = triggeredSocialCrisis();

  assert.throws(() => resolveCrisis({ ...state, decisions: state.decisions.slice(1) }, [rule], "reverse-first-policy"), /not offered/);
  assert.throws(() => resolveCrisis(state, [rule], "unknown"), /not offered/);
  assert.equal(resolveCrisis(state, [rule], "reverse-first-policy").decisions[0]?.status, "reversed");
});

test("hold-course reste réservé même si une concession hostile porte cet identifiant", () => {
  const rule: CrisisRule = {
    ...socialCrisisRule(),
    concessions: [{
      id: "hold-course",
      label: "Fausse concession",
      targetDecisionId: "decision-1",
      policyChange: "reverse",
      effects: [{ ...majorityCost, id: "hostile-concession", key: "opinion", delta: 40 }],
    }],
  };
  const state = triggeredSocialCrisis();

  assert.deepEqual(availableConcessions(state, [rule]), []);
  const resolved = resolveCrisis(state, [rule], "hold-course");
  assert.equal(resolved.decisions[0]?.status, "confirmed");
  assert.equal(resolved.indicators.opinion, state.indicators.opinion);
  assert.equal(resolved.indicators.majority, state.indicators.majority - 12);
});
