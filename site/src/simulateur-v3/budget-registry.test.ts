import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  BUDGET_ESTIMATES,
  CRISIS_TRANSITION_ESTIMATES,
  budgetEstimateFor,
  findExclusiveScopeCollisions,
  hasBudgetEstimate,
  primeActivityRecycleDifferenceMillions,
  validateBudgetEstimate,
  validateBudgetProfile,
} from "./budget-registry.ts";
import type { BudgetEstimate, BudgetProfile } from "./types.ts";
import { SCENARIO_V10_CATALOGUE } from "./scenario-v10-catalogue.ts";

const profile = (scope: string): BudgetProfile => ({
  estimateKey: "test-estimate",
  runRateMillions: 1,
  runRateTiming: { kind: "immediate" },
  transitionFlows: [],
  exclusiveScopeKeys: [scope],
});

test("un profil keep nul est un contrat budgétaire valide", () => {
  assert.deepEqual(validateBudgetProfile({
    estimateKey: null,
    runRateMillions: 0,
    runRateTiming: null,
    transitionFlows: [],
    exclusiveScopeKeys: [],
  }, "d", "keep"), []);
});

test("le reverse IR-CSG porte un coût ponctuel sourcé et causal", () => {
  const estimate = CRISIS_TRANSITION_ESTIMATES["reverse-ir-csg-unification-transition"]!;
  assert.deepEqual(estimate, {
    key: "reverse-ir-csg-unification-transition",
    baseYear: 2020,
    baseAmountMillions: 178.8,
    baseNature: "realise",
    scope: "Proxy de reconfiguration du prélèvement à la source DGFiP, sans chiffrer un coût propre à l'unification IR-CSG.",
    grossActionMillions: 0,
    behavioralOffsetMillions: 0,
    recurringOperatingCostMillions: 0,
    runRateMillions: 0,
    transitionFlows: [{
      id: "crisis:reverse-ir-csg-unification:pas-reconfiguration",
      amountMillions: -179,
      timing: { kind: "immediate" },
      sourceKey: "plr-2020-programme-156-pas",
    }],
    sourceKeys: ["plr-2020-programme-156-pas"],
    estimateStatus: "scenario",
    uncertainty: "forte",
    exclusiveScopeKeys: ["crisis-pas-reconfiguration-proxy"],
  });
});

test("un profil keep malformé retourne des erreurs au lieu de lever une exception", () => {
  assert.doesNotThrow(() => validateBudgetProfile({
    estimateKey: null,
    runRateMillions: 0,
    runRateTiming: null,
    transitionFlows: null,
    exclusiveScopeKeys: null,
  } as unknown as BudgetProfile, "d", "keep"));
  assert.ok(validateBudgetProfile({
    estimateKey: null,
    runRateMillions: 0,
    runRateTiming: null,
    transitionFlows: null,
    exclusiveScopeKeys: null,
  } as unknown as BudgetProfile, "d", "keep").length > 0);
});

test("un keep qualifié reste soumis au profil strictement nul", () => {
  assert.ok(validateBudgetProfile({
    estimateKey: "audit-only", runRateMillions: 0, runRateTiming: null, transitionFlows: [], exclusiveScopeKeys: [],
  }, "d", "d:keep").includes("budget-profile:d:d:keep:keep-must-be-null-profile"));
});

test("une estimation absente est refusée explicitement", () => {
  assert.throws(() => budgetEstimateFor("d", "adopt", "missing"), /Unknown budget estimate/);
});

test("une clé de périmètre exclusive revendiquée deux fois est détectée", () => {
  assert.deepEqual(findExclusiveScopeCollisions([profile("scope-a"), profile("scope-a")]), ["scope-a"]);
});

test("le recyclage de la prime d'activité reste neutre à un million près", () => {
  assert.equal(hasBudgetEstimate("remplacer-prime-activite-prelevements-travail", "adopt", "prime-activity-recycle-2024"), true);
  assert.equal(Math.abs(primeActivityRecycleDifferenceMillions()) <= 1, true);
  const estimate = budgetEstimateFor("remplacer-prime-activite-prelevements-travail", "adopt", "prime-activity-recycle-2024");
  assert.deepEqual([
    estimate.grossActionMillions,
    estimate.behavioralOffsetMillions,
    estimate.recurringOperatingCostMillions,
    estimate.runRateMillions,
  ], [0, 0, 0, 0]);
  assert.deepEqual(estimate.reconciliation, {
    outgoingAmountMillions: 10_300,
    counterpartAmountMillions: 10_300,
  });
});

test("une estimation budgétaire invalide expose chaque erreur de contrat", () => {
  const invalid = {
    ...budgetEstimateFor("remplacer-prime-activite-prelevements-travail", "adopt", "prime-activity-recycle-2024"),
    key: " ",
    scope: "",
    baseAmountMillions: -1,
    baseNature: "inconnue",
    estimateStatus: "inconnu",
    uncertainty: "inconnue",
    sourceKeys: [],
    reconciliation: { outgoingAmountMillions: -1, counterpartAmountMillions: Number.NaN },
  } as unknown as BudgetEstimate;

  assert.deepEqual(validateBudgetEstimate(invalid).sort(), [
    "budget-estimate:unknown:base-amount-must-be-non-negative",
    "budget-estimate:unknown:base-nature-invalid",
    "budget-estimate:unknown:estimate-status-invalid",
    "budget-estimate:unknown:key-required",
    "budget-estimate:unknown:reconciliation-invalid",
    "budget-estimate:unknown:scope-required",
    "budget-estimate:unknown:source-keys-required",
    "budget-estimate:unknown:uncertainty-invalid",
  ]);
  const nonFinite = { ...invalid, key: "finite-check", baseAmountMillions: Number.NaN } as BudgetEstimate;
  assert.ok(validateBudgetEstimate(nonFinite).includes("budget-estimate:finite-check:baseAmountMillions-must-be-finite"));
});

test("le registre et ses données imbriquées sont profondément gelés", () => {
  const estimate = budgetEstimateFor("remplacer-prime-activite-prelevements-travail", "adopt", "prime-activity-recycle-2024");
  assert.equal(Object.isFrozen(BUDGET_ESTIMATES), true);
  assert.equal(Object.isFrozen(estimate), true);
  assert.equal(Object.isFrozen(estimate.sourceKeys), true);
  assert.equal(Object.isFrozen(estimate.transitionFlows), true);
  assert.equal(Object.isFrozen(estimate.exclusiveScopeKeys), true);
  assert.equal(Object.isFrozen(estimate.reconciliation!), true);
  assert.throws(() => { (estimate.sourceKeys as string[]).push("mutation"); }, TypeError);
  assert.throws(() => { (estimate.reconciliation as { outgoingAmountMillions: number }).outgoingAmountMillions = 1; }, TypeError);
});

test("les conséquences non budgétaires ne transportent aucun champ budgétaire historique", () => {
  const source = readFileSync(new URL("./policy-consequences.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /budgetDuration|budgetTiming|annualBalance/);
});

test("le registre V10 ne conserve ni reliquat legacy ni estimation orpheline", () => {
  const referenced = new Set(SCENARIO_V10_CATALOGUE.decisions.flatMap((decision) => decision.options.flatMap((option) => {
    const localOptionId = option.id.split(":").at(-1)!;
    return option.budgetProfile.estimateKey === null ? [] : [`${decision.id}:${localOptionId}:${option.budgetProfile.estimateKey}`];
  })));
  assert.deepEqual(Object.keys(BUDGET_ESTIMATES).sort(), [...referenced].sort());
  assert.equal(Object.values(BUDGET_ESTIMATES).some((estimate) => estimate.key.startsWith("legacy:")), false);
});
