import assert from "node:assert/strict";
import test from "node:test";

import { optionDistanceDimensions, policyDecision, type PolicyDecisionDefinition } from "./policy-catalogue.ts";
import { policyById, SCENARIO_V3_CATALOGUE } from "./scenario.ts";

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
      id: "yes", label: "Décider", summary: "Le choix produit un effet.", mechanism: "Voter un crédit.",
      horizon: { kind: "immediate" }, legalConstraints: ["Voter la loi."], budgetDelta: 1, budgetDuration: "annual",
      beneficiaries: ["A"], contributors: ["B"], indicatorEffects: { investment: 2 }, groupEffects: { businesses: 1 },
    },
    {
      id: "no", label: "Refuser", summary: "Le choix conserve le dispositif.", mechanism: "Maintenir le crédit actuel.",
      horizon: { kind: "after_decisions", count: 1 }, legalConstraints: [], budgetDelta: 0, budgetDuration: "annual",
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
  assert.deepEqual(keep.beneficiaries, ["classes moyennes"]);
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
      assert.ok(option.effects.some((effect) => !(effect.target === "indicator" && effect.key === "annualBalance")), `${option.id}:non-budget-effect`);
      assert.ok(option.effects.every((effect) => !effect.id.includes(HISTORICAL_EFFECT_MARKER)), `${option.id}:historical-marker`);
    }
  }
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

test("les flux ponctuels déclarés compilent avec duration once", () => {
  const expected = new Map([
    ["sortir-de-l-euro:adopt", -35_000],
    ["referendum-sur-la-sortie-de-l-ue:adopt", -500],
    ["nationaliser-les-entreprises-strategiques:adopt", -25_000],
    ["nationaliser-les-autoroutes:adopt", -18_000],
    ["ceder-des-participations-non-strategiques-de-l:adopt", 2_000],
  ]);
  for (const [optionId, delta] of expected) {
    const option = SCENARIO_V3_CATALOGUE.decisions.flatMap((decision) => decision.options).find((candidate) => candidate.id === optionId)!;
    const budget = option.effects.find((effect) => effect.target === "indicator" && effect.key === "annualBalance")!;
    assert.equal(budget.delta, delta, optionId);
    assert.equal(budget.duration, "once", optionId);
  }
});

test("la sortie de l'euro conserve le coût d'intérêt annuel séparé", () => {
  const option = policyById("sortir-de-l-euro")!.options.find((candidate) => candidate.id.endsWith(":adopt"))!;
  const interest = option.effects.find((effect) => effect.target === "indicator" && effect.key === "interestCost")!;
  assert.equal(interest.delta, 12_000);
  assert.equal(interest.duration, "annual");
});
