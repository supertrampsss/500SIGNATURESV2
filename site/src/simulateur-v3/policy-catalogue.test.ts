import assert from "node:assert/strict";
import test from "node:test";

import { optionDistanceDimensions, policyDecision, type PolicyDecisionDefinition } from "./policy-catalogue.ts";
import { POLICY_CONSEQUENCES } from "./policy-consequences.ts";
import { policyById, SCENARIO_V3_CATALOGUE } from "./scenario.ts";
import { SCENARIO_V9_SNAPSHOT } from "./scenario-v9.snapshot.ts";
import type { DecisionOption } from "./types.ts";

const HISTORICAL_EFFECT_MARKER = [":", "model", ":"].join("");

const VALID: PolicyDecisionDefinition = {
  id: "test-policy",
  chapterId: "test-chapter",
  kind: "gestion",
  title: "Tester cette décision ?",
  context: "Un contexte explicite.",
  sourceKeys: ["cour-finances-2025"],
  evidenceLabel: "Une publication identifiable.",
  options: [
    {
      id: "adopt", label: "Décider", summary: "Le choix produit un effet.", mechanism: "Voter un crédit.",
      horizon: { kind: "immediate" }, legalConstraints: ["Voter la loi."], budgetProfile: { estimateKey: "test-estimate", runRateMillions: 1, runRateTiming: { kind: "immediate" }, transitionFlows: [], exclusiveScopeKeys: [] },
      beneficiaries: ["A"], contributors: ["B"], indicatorEffects: { investment: 2 }, groupEffects: { businesses: 1 },
    },
    {
      id: "keep", label: "Refuser", summary: "Le choix conserve le dispositif.", mechanism: "Maintenir le crédit actuel.",
      horizon: { kind: "after_decisions", count: 1 }, legalConstraints: [], budgetProfile: { estimateKey: null, runRateMillions: 0, runRateTiming: null, transitionFlows: [], exclusiveScopeKeys: [] },
      beneficiaries: ["B"], contributors: ["A"], indicatorEffects: { investment: -1 }, groupEffects: { businesses: -1 },
    },
  ],
};

test("le compilateur résout une source directe sans fabriquer le texte visible", () => {
  const decision = policyDecision(VALID);
  assert.equal(decision.kind, "gestion");
  assert.match(decision.evidence[0]!.sourceUrl, /^https:\/\//);
  assert.equal(decision.options[0]!.summary, "Le choix produit un effet.");
});

test("un horizon relatif diffère les conséquences de capacité, pas l'ouverture budgétaire", () => {
  const decision = policyDecision(VALID);
  const option = decision.options[1]!;
  assert.ok(option.effects.every((effect) =>
    effect.target === "indicator" && effect.key === "annualBalance"
      ? effect.timing.kind === "immediate"
      : effect.timing.kind === "after_decisions" && effect.timing.count === 1));
});

test("le profil budgétaire porte le rythme annuel indépendamment de l'horizon principal", () => {
  const definition = structuredClone(VALID);
  definition.options[0]!.horizon = { kind: "immediate" };
  definition.options[0]!.budgetProfile.runRateTiming = { kind: "mandate_year", year: 2 };
  const option = policyDecision(definition).options[0]!;
  const budget = option.effects.find((effect) => effect.target === "indicator" && effect.key === "annualBalance")!;

  assert.deepEqual(option.budgetProfile.runRateTiming, { kind: "mandate_year", year: 2 });
  assert.deepEqual(budget.timing, { kind: "mandate_year", year: 2 });
  assert.equal(budget.duration, "annual");
});

test("chaque option publique expose un profil budgétaire", () => {
  for (const option of SCENARIO_V3_CATALOGUE.decisions.flatMap((decision) => decision.options)) {
    assert.ok(option.budgetProfile, option.id);
    assert.equal("budgetDuration" in option, false, option.id);
    assert.equal("budgetTiming" in option, false, option.id);
  }
});

test("le compilateur exige un indicateur non budgétaire, pas seulement un effet de groupe", () => {
  const definition = structuredClone(VALID);
  definition.options[0]!.indicatorEffects = {};
  assert.throws(() => policyDecision(definition), /indicateur non budgétaire absent/i);
});

test("le compilateur refuse une copie ou une source manquante", () => {
  assert.throws(() => policyDecision({ ...VALID, context: "" }));
  assert.throws(() => policyDecision({ ...VALID, sourceKeys: [] }));
});

test("l'accessor retrouve une politique dans le catalogue complet", () => {
  assert.equal(policyById(SCENARIO_V3_CATALOGUE.decisions[0]!.id)?.id, SCENARIO_V3_CATALOGUE.decisions[0]!.id);
  assert.equal(policyById("missing-policy"), undefined);
});

test("le maintien ne permute pas automatiquement les gagnants et les contributeurs", () => {
  const decision = policyById("geler-le-bareme-de-l-impot-sur")!;
  const adopt = decision.options.find((option) => option.id.endsWith(":adopt"))!;
  const keep = decision.options.find((option) => option.id.endsWith(":keep"))!;
  assert.notDeepEqual(
    [keep.beneficiaries, keep.contributors],
    [adopt.contributors, adopt.beneficiaries],
  );
  assert.deepEqual(keep.beneficiaries, ["foyers imposables", "classes moyennes"]);
  assert.deepEqual(keep.contributors, ["finances publiques"]);
});

test("le catalogue expose 193 options au contrat causal explicite", () => {
  const options = SCENARIO_V3_CATALOGUE.decisions.flatMap((decision) => decision.options);
  assert.equal(options.length, 193);
  for (const decision of SCENARIO_V3_CATALOGUE.decisions) {
    assert.equal(decision.version, 3, decision.id);
    for (const option of decision.options) {
      assert.ok(option.mechanism.trim(), `${option.id}:mechanism`);
      assert.ok(option.horizon.kind === "immediate"
        || (option.horizon.kind === "after_decisions" && option.horizon.count > 0)
        || (option.horizon.kind === "mandate_year" && option.horizon.year >= 1 && option.horizon.year <= 5), `${option.id}:horizon`);
      assert.ok(Array.isArray(option.legalConstraints), `${option.id}:legalConstraints`);
      assert.ok(option.effects.some((effect) => effect.target === "indicator" && effect.key !== "annualBalance"), `${option.id}:non-budget-indicator`);
      assert.ok(option.budgetProfile, `${option.id}:budgetProfile`);
      assert.ok(option.beneficiaries.length > 0 && option.beneficiaries.every((item) => item.trim()), `${option.id}:beneficiaries`);
      assert.ok(option.contributors.length > 0 && option.contributors.every((item) => item.trim()), `${option.id}:contributors`);
      assert.ok(!option.beneficiaries.includes("continuité du dispositif"), `${option.id}:generic-beneficiary`);
      assert.ok(!option.contributors.includes("marges de réforme non mobilisées"), `${option.id}:generic-contributor`);
      const budget = option.effects.find((effect) => effect.target === "indicator" && effect.key === "annualBalance");
      if (option.budgetProfile.runRateMillions !== 0) {
        assert.equal(budget?.delta, option.budgetProfile.runRateMillions, `${option.id}:run-rate`);
        assert.equal(budget?.duration, "annual", `${option.id}:run-rate-duration`);
      }
      assert.ok(option.effects.every((effect) => !effect.id.includes(HISTORICAL_EFFECT_MARKER)), `${option.id}:historical-marker`);
    }
  }
});

test("le registre explicite couvre exactement les 193 options du catalogue", () => {
  const catalogueKeys = SCENARIO_V3_CATALOGUE.decisions.flatMap((decision) =>
    decision.options.map((option) => option.id),
  ).sort();
  const registryKeys = Object.entries(POLICY_CONSEQUENCES).flatMap(([decisionId, options]) =>
    Object.keys(options).map((optionId) => `${decisionId}:${optionId}`),
  ).sort();
  assert.deepEqual(registryKeys, catalogueKeys);
});

test("chaque paire d'options diffère sur au moins deux dimensions matérielles", () => {
  for (const decision of SCENARIO_V3_CATALOGUE.decisions) {
    for (let left = 0; left < decision.options.length; left += 1) {
      for (let right = left + 1; right < decision.options.length; right += 1) {
        assert.ok(
          optionDistanceDimensions(decision.options[left]!, decision.options[right]!).length >= 2,
          `${decision.id}:${decision.options[left]!.id}:${decision.options[right]!.id}`,
        );
      }
    }
  }
});

test("la distance normalise l'ordre et les doublons des listes de contrats", () => {
  const base = structuredClone(policyDecision(VALID).options[0]!);
  const eventEffect = {
    id: "event-effect", target: "indicator" as const, key: "opinion" as const, delta: -1,
    timing: { kind: "immediate" as const }, duration: "once" as const, explanation: "Réaction test.",
  };
  base.scheduledEvents = [
    { id: "event-a", title: "A", body: "A", afterDecisions: 1, effects: [eventEffect] },
    { id: "event-b", title: "B", body: "B", afterDecisions: 2, effects: [] },
  ];
  base.promises = [
    { id: "promise-a", label: "A", dueAfterDecisions: 1, failureEffects: [eventEffect] },
    { id: "promise-b", label: "B", dueAfterDecisions: 2, failureEffects: [] },
  ];
  base.fulfillsPromises = ["promise-b", "promise-a"];
  const reordered = structuredClone(base);
  reordered.scheduledEvents.reverse();
  reordered.promises.reverse();
  reordered.fulfillsPromises = [" promise-a ", "promise-b", "promise-a"];

  assert.deepEqual(optionDistanceDimensions(base, reordered), []);
});

test("la sortie de l'euro conserve le coût d'intérêt annuel séparé", () => {
  const option = policyById("sortir-de-l-euro")!.options.find((candidate) => candidate.id.endsWith(":adopt"))!;
  const interest = option.effects.find((effect) => effect.target === "indicator" && effect.key === "interestCost")!;
  assert.equal(interest.delta, 12_000);
  assert.equal(interest.duration, "annual");
});

const annualBalanceEffects = (decision: { options: DecisionOption[] }) =>
  decision.options.map((option) => [
    option.id,
    option.effects
      .filter((effect) => effect.target === "indicator" && effect.key === "annualBalance")
      .map((effect) => ({
        id: effect.id,
        target: effect.target,
        key: effect.key,
        delta: effect.delta,
        timing: effect.timing,
        duration: effect.duration,
        explanation: effect.explanation,
      })),
  ] as const).sort(([left], [right]) => left.localeCompare(right));

test("le pont V9 préserve exactement les effets de solde du snapshot historique", () => {
  const currentById = new Map(SCENARIO_V3_CATALOGUE.decisions.map((decision) => [decision.id, decision]));
  for (const historicalDecision of SCENARIO_V9_SNAPSHOT.decisions) {
    const current = currentById.get(historicalDecision.id);
    assert.ok(current, historicalDecision.id);
    assert.deepEqual(annualBalanceEffects(current), annualBalanceEffects(historicalDecision), historicalDecision.id);
  }
});

test("le pont V9 conserve les cinq flux ponctuels sous leurs causes historiques exactes", () => {
  const once = SCENARIO_V3_CATALOGUE.decisions
    .flatMap((decision) => decision.options)
    .flatMap((option) => option.effects
      .filter((effect) => effect.target === "indicator" && effect.key === "annualBalance" && effect.duration === "once")
      .map((effect) => ({ optionId: option.id, id: effect.id, explanation: effect.explanation })));
  assert.deepEqual(once.map((effect) => effect.optionId), [
    "sortir-de-l-euro:adopt",
    "referendum-sur-la-sortie-de-l-ue:adopt",
    "nationaliser-les-entreprises-strategiques:adopt",
    "nationaliser-les-autoroutes:adopt",
    "ceder-des-participations-non-strategiques-de-l:adopt",
  ]);
  for (const effect of once) {
    assert.equal(effect.id, `${effect.optionId}:indicator:annualBalance`);
    assert.match(effect.explanation, /Impact budgétaire retenu par le jeu/);
    assert.doesNotMatch(effect.id, /:transition:/);
    assert.doesNotMatch(effect.explanation, /Flux ponctuel sourcé/);
  }
});
