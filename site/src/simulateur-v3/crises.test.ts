import assert from "node:assert/strict";
import { test } from "node:test";

import { availableConcessions, detectCrisis, resolveCrisis } from "./crises.ts";
import { currentDecision, selectOption } from "./campaign.ts";
import { applyEffect, confirmSelection } from "./effects.ts";
import { advanceCampaign, advanceToVisiblePhase } from "./flow.ts";
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
import { SCENARIO_V10_CRISIS_RULES } from "./scenario-crises.ts";
import { SCENARIO_V10 } from "./scenario-v10.ts";
import { restoreCampaign, V3_STORAGE_KEY } from "./storage.ts";

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

function playThroughRuleCauses(rule: CrisisRule): CampaignState {
  let state: CampaignState = { ...createCampaign(SCENARIO_V10), phase: "decision" };
  while (!rule.requiredDecisionIds.every((decisionId) => state.decisions.some((decision) => decision.decisionId === decisionId))) {
    if (state.phase === "chapter_intro") {
      state = advanceToVisiblePhase(advanceCampaign(state, SCENARIO_V10, []), SCENARIO_V10, []);
    }
    assert.equal(state.phase, "decision");
    const decision = currentDecision(state, SCENARIO_V10)!;
    const optionId = rule.requiredDecisionIds.includes(decision.id)
      ? `${decision.id}:adopt`
      : decision.options.find((option) => option.id.endsWith(":keep"))!.id;
    state = advanceToVisiblePhase(
      confirmSelection(selectOption(state, SCENARIO_V10, decision.id, optionId), SCENARIO_V10),
      SCENARIO_V10,
      [],
    );
  }
  return state;
}

test("la concession IR-CSG V10 appelle la révocation causale et son coût ponctuel sourcé", () => {
  const rule = SCENARIO_V10_CRISIS_RULES.find((candidate) => candidate.id === "v10-tax-legitimacy")!;
  const count = Math.max(...rule.requiredDecisionIds.map((id) => SCENARIO_V10.decisions.findIndex((decision) => decision.id === id))) + 1;
  const choices = Object.fromEntries(SCENARIO_V10.decisions.slice(0, count).map((decision) => [decision.id,
    rule.requiredDecisionIds.includes(decision.id) ? `${decision.id}:adopt` : `${decision.id}:keep`]));
  const state = stateAfterChoices(SCENARIO_V10, count, choices);
  state.indicators[rule.indicator] = rule.threshold;
  const crisis = detectCrisis(state, SCENARIO_V10, [rule]);
  assert.deepEqual(availableConcessions(crisis, [rule]).map((concession) => concession.id), ["reverse-ir-csg-unification"]);
  const resolved = resolveCrisis(crisis, [rule], "reverse-ir-csg-unification");
  assert.equal(resolved.decisions.find((record) => record.decisionId === "unifier-ir-csg-bareme-continu")?.status, "reversed");
  assert.equal(resolved.indicators.annualBalance, crisis.indicators.annualBalance - 179);
  assert.equal(resolved.causalLedger.filter((entry) => entry.id.includes("reverse-ir-csg-unification:pas-reconfiguration")).length, 1);

  const storage = {
    getItem: (key: string) => key === V3_STORAGE_KEY ? JSON.stringify(resolved) : null,
    setItem() {},
    removeItem() {},
  };
  const restored = restoreCampaign(storage, SCENARIO_V10);
  assert.equal(restored.kind, "restored");
  if (restored.kind === "restored") {
    assert.equal(restored.state.indicators.annualBalance, resolved.indicators.annualBalance);
    assert.equal(restored.state.causalLedger.filter((entry) => entry.id.includes("reverse-ir-csg-unification:pas-reconfiguration")).length, 1);
  }
});

test("chaque concession V10 nomme précisément le compromis proposé", () => {
  const labelsByRule = new Map<string, readonly string[]>([
    ["v10-tax-legitimacy", ["Revenir à des prélèvements distincts"]],
    ["v10-labour-blockade", ["Renoncer au relèvement de l'âge légal à 65 ans", "Abandonner la dégressivité de l'assurance chômage"]],
    ["v10-care-access", ["Renoncer au doublement des franchises médicales", "Renoncer aux économies sur les achats de santé"]],
    ["v10-rule-of-law", ["Renoncer au doublement des éloignements OQTF", "Renoncer à la préférence nationale pour les prestations"]],
    ["v10-currency-shock", ["Renoncer à la sortie de l'euro", "Renoncer au référendum de sortie de l'Union européenne"]],
    ["v10-energy-bottleneck", ["Renoncer au doublement de MaPrimeRénov'", "Renoncer au plan ferroviaire renforcé"]],
    ["v10-education-housing", ["Renoncer à la revalorisation des enseignants", "Renoncer au doublement des bourses étudiantes"]],
    ["v10-state-capacity", ["Renoncer à la clarification des compétences territoriales"]],
  ]);

  assert.deepEqual(
    SCENARIO_V10_CRISIS_RULES.map((rule) => [rule.id, rule.concessions.map((concession) => concession.label)]),
    [...labelsByRule],
  );
  for (const rule of SCENARIO_V10_CRISIS_RULES) {
    for (const concession of rule.concessions) {
      assert.doesNotMatch(concession.label, /^Amender |[a-z]+-[a-z]+/);
    }
  }
});

test("une concession V10 retire l'événement budgétaire futur de la politique abandonnée", () => {
  const rule = SCENARIO_V10_CRISIS_RULES.find((candidate) => candidate.id === "v10-labour-blockade")!;
  const prepared = playThroughRuleCauses(rule);
  prepared.indicators[rule.indicator] = rule.threshold;
  const targetDecisionId = rule.concessions[0]!.targetDecisionId;
  assert.ok(prepared.scheduledEvents.some((event) => event.sourceDecisionId === targetDecisionId
    && event.effects.some((effect) => effect.key === "annualBalance" && effect.duration === "annual")));
  const crisis = detectCrisis(prepared, SCENARIO_V10, [rule]);
  const resolved = resolveCrisis(crisis, [rule], rule.concessions[0]!.id);

  assert.equal(resolved.decisions.find((decision) => decision.decisionId === targetDecisionId)?.status, "reversed");
  assert.equal(resolved.indicators.annualBalance, prepared.indicators.annualBalance);
  assert.equal(resolved.scheduledEvents.some((event) => event.sourceDecisionId === targetDecisionId), false);
  assert.equal(resolved.causalLedger.some((entry) => entry.sourceId === `reverse:${targetDecisionId}`), false);
});

test("une concession V10 neutralise une recette annuelle déjà matérialisée", () => {
  const rule = SCENARIO_V10_CRISIS_RULES.find((candidate) => candidate.id === "v10-care-access")!;
  const prepared = playThroughRuleCauses(rule);
  prepared.indicators[rule.indicator] = rule.threshold;
  const targetDecisionId = rule.concessions[0]!.targetDecisionId;
  const target = prepared.decisions.find((decision) => decision.decisionId === targetDecisionId)!;
  const adoptedRunRate = prepared.causalLedger
    .filter((entry) => entry.sourceType === "decision" && entry.sourceId === `${targetDecisionId}:${target.optionId}`
      && entry.key === "annualBalance" && entry.duration === "annual")
    .reduce((sum, entry) => sum + entry.delta, 0);
  assert.equal(adoptedRunRate, 800);
  const crisis = detectCrisis(prepared, SCENARIO_V10, [rule]);
  const resolved = resolveCrisis(crisis, [rule], rule.concessions[0]!.id);

  assert.equal(resolved.decisions.find((decision) => decision.decisionId === targetDecisionId)?.status, "reversed");
  assert.equal(resolved.indicators.annualBalance, prepared.indicators.annualBalance - adoptedRunRate);
  const compensations = resolved.causalLedger.filter((entry) => entry.sourceType === "crisis"
    && entry.sourceId === `reverse:${targetDecisionId}`
    && entry.key === "annualBalance");
  assert.equal(compensations.length, 1);
  assert.equal(compensations[0]?.delta, -adoptedRunRate);
});

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

test("une révocation de crise retire le futur avant les effets de concession", () => {
  const state = triggeredSocialCrisis();
  const withRunRate = applyEffect(state, {
    id: "decision-1:decision-1-option-a:run-rate",
    target: "indicator",
    key: "annualBalance",
    delta: 100,
    timing: { kind: "immediate" },
    duration: "annual",
    explanation: "Flux annuel à neutraliser.",
  }, { sourceType: "decision", sourceId: "decision-1:decision-1-option-a" });
  const pending = {
    ...withRunRate,
    scheduledEvents: [{
      id: "decision-1:decision-1-option-a:transition:future",
      sourceDecisionId: "decision-1",
      sourceOptionId: "decision-1-option-a",
      dueAtDecision: 3,
      title: "Flux futur",
      body: "À annuler.",
      effects: [],
    }],
    activePromises: [{
      id: "decision-1-promise",
      sourceDecisionId: "decision-1",
      sourceOptionId: "decision-1-option-a",
      label: "Promesse future",
      dueAtDecision: 3,
      fulfilled: false,
      failureEffects: [],
    }],
  };
  const rule = socialCrisisRule({
    concessions: [{
      id: "reverse-first-policy",
      label: "Retirer la première réforme",
      targetDecisionId: "decision-1",
      policyChange: "reverse",
      effects: [{
        id: "concession-annual-balance",
        target: "indicator",
        key: "annualBalance",
        delta: 7,
        timing: { kind: "immediate" },
        duration: "once",
        explanation: "Coût de la concession.",
      }],
    }],
  });

  const resolved = resolveCrisis(pending, [rule], "reverse-first-policy");
  assert.equal(resolved.decisions[0]?.status, "reversed");
  assert.equal(resolved.scheduledEvents.length, 0);
  assert.equal(resolved.activePromises.length, 0);
  assert.equal(resolved.indicators.annualBalance, state.indicators.annualBalance + 7);
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
