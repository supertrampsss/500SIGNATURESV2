import assert from "node:assert/strict";
import test from "node:test";

import { BUDGET_ESTIMATES, STRUCTURAL_ADOPT_DECISION_IDS } from "./budget-registry.ts";
import {
  BALANCED_PATHS,
  maximumCompatibleProvenance,
  maximumCompatibleRunRate,
  simulatePath,
  structuralRunRate,
} from "./balanced-paths.ts";
import { CAMPAIGN_DECISION_IDS } from "./campaign-topology.ts";
import { SCENARIO_V10 } from "./scenario-v10.ts";

test("les trois parcours V10 sont complets, ordonnés et rejouables jusqu'au verdict", () => {
  assert.deepEqual(BALANCED_PATHS.map((path) => path.id), [
    "doctrine-21689",
    "redressement-prudent",
    "reformes-structurelles",
  ]);

  for (const path of BALANCED_PATHS) {
    assert.equal(path.optionIds.length, CAMPAIGN_DECISION_IDS.length);
    assert.deepEqual(path.optionIds.map((optionId) => optionId.slice(0, optionId.lastIndexOf(":"))), CAMPAIGN_DECISION_IDS);
    const result = simulatePath(path, SCENARIO_V10);
    assert.equal(result.phase, "verdict");
    assert.equal(result.decisions.length, 72);
    assert.equal(result.annualCheckpoints.length, 5);
    assert.deepEqual(result.crisisHistory.map((crisis) => `${crisis.ruleId}:${crisis.resolvedBy}`), path.crisisChoiceIds);
    assert.equal(result.status === "balanced" ? result.indicators.annualBalance >= 0 : result.honestGapMillions > 0, true);
  }
});

test("doctrine-21689 conserve exactement les 18 adoptions structurelles et les totaux audités", () => {
  const doctrine = BALANCED_PATHS.find((path) => path.id === "doctrine-21689")!;
  const adoptedStructuralIds = doctrine.optionIds
    .filter((optionId) => optionId.endsWith(":adopt"))
    .map((optionId) => optionId.slice(0, -":adopt".length))
    .filter((decisionId) => STRUCTURAL_ADOPT_DECISION_IDS.includes(decisionId as typeof STRUCTURAL_ADOPT_DECISION_IDS[number]));
  assert.deepEqual(adoptedStructuralIds, STRUCTURAL_ADOPT_DECISION_IDS);
  assert.equal(structuralRunRate(doctrine, SCENARIO_V10), 21_689);
  const structuralAndFiscal = structuralRunRate(doctrine, SCENARIO_V10, { includeFiscalPromotions: true });
  assert.equal(structuralAndFiscal - structuralRunRate(doctrine, SCENARIO_V10), 8_617);
  assert.equal(structuralAndFiscal, 30_306);
});

test("le maximum compatible ne retient que des estimations enregistrées avec provenance déterministe", () => {
  const first = maximumCompatibleProvenance(SCENARIO_V10);
  const second = maximumCompatibleProvenance(SCENARIO_V10);
  assert.deepEqual(first, second);
  assert.equal(maximumCompatibleRunRate(SCENARIO_V10), first.reduce((sum, estimate) => sum + estimate.runRateMillions, 0));
  assert.equal(first.every((estimate) => Object.values(BUDGET_ESTIMATES).includes(estimate)), true);
});

test("le runner journalise le keep automatique et refuse une option verrouillée à sa place", () => {
  const doctrine = BALANCED_PATHS.find((path) => path.id === "doctrine-21689")!;
  const withAutomaticFallback = {
    ...doctrine,
    optionIds: doctrine.optionIds.map((optionId) => optionId === "exonerer-de-droits-de-succession-jusqu-a:keep"
      ? "exonerer-de-droits-de-succession-jusqu-a:adopt"
      : optionId),
  } as typeof doctrine;
  const result = simulatePath(withAutomaticFallback, SCENARIO_V10);
  assert.deepEqual(result.decisions.find((record) => record.decisionId === "abolir-les-droits-de-succession"), {
    decisionId: "abolir-les-droits-de-succession",
    optionId: "abolir-les-droits-de-succession:keep",
    status: "superseded",
    confirmedAtIndex: 10,
  });

  const lockedAdoption = {
    ...withAutomaticFallback,
    optionIds: withAutomaticFallback.optionIds.map((optionId) => optionId === "abolir-les-droits-de-succession:keep"
      ? "abolir-les-droits-de-succession:adopt"
      : optionId),
  } as typeof doctrine;
  assert.throws(() => simulatePath(lockedAdoption, SCENARIO_V10), /locked decision/);
});

test("le runner rejette les fixtures incomplètes, les crises non résolues et les collisions de périmètre", () => {
  const doctrine = BALANCED_PATHS.find((path) => path.id === "doctrine-21689")!;
  assert.throws(() => simulatePath({ ...doctrine, optionIds: doctrine.optionIds.slice(1) }, SCENARIO_V10), /options/);
  assert.throws(() => simulatePath({ ...doctrine, optionIds: ["unknown:adopt", ...doctrine.optionIds.slice(1)] }, SCENARIO_V10), /missing, unknown, or out of order/);
  assert.throws(() => simulatePath({ ...doctrine, optionIds: [doctrine.optionIds[1]!, doctrine.optionIds[1]!, ...doctrine.optionIds.slice(2)] }, SCENARIO_V10), /duplicate/);
  assert.throws(() => simulatePath({ ...doctrine, crisisChoiceIds: [] }, SCENARIO_V10), /unresolved/);
  const collisionScenario = structuredClone(SCENARIO_V10);
  const source = collisionScenario.decisions.find((decision) => decision.id === "supprimer-niches-fiscales-menages-capital")!.options[0]!;
  const target = collisionScenario.decisions.find((decision) => decision.id === "facturation-electronique-controle-tva")!.options[0]!;
  target.budgetProfile.exclusiveScopeKeys = [...source.budgetProfile.exclusiveScopeKeys];
  assert.throws(() => simulatePath(doctrine, collisionScenario), /exclusive scope collision/);
});

test("le runner vérifie explicitement les dépendances de la fixture, hors du reducer", () => {
  const doctrine = BALANCED_PATHS.find((path) => path.id === "doctrine-21689")!;
  const scenario = structuredClone(SCENARIO_V10);
  scenario.decisions.find((decision) => decision.id === "facturation-electronique-controle-tva")!.dependencies = ["abolir-les-droits-de-succession"];
  assert.throws(() => simulatePath(doctrine, scenario), /dependency/);
});
