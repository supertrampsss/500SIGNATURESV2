import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  budgetEstimateFor,
  findExclusiveScopeCollisions,
  primeActivityRecycleDifferenceMillions,
  validateBudgetProfile,
} from "./budget-registry.ts";
import type { BudgetProfile } from "./types.ts";

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

test("une estimation absente est refusée explicitement", () => {
  assert.throws(() => budgetEstimateFor("d", "adopt", "missing"), /Unknown budget estimate/);
});

test("une clé de périmètre exclusive revendiquée deux fois est détectée", () => {
  assert.deepEqual(findExclusiveScopeCollisions([profile("scope-a"), profile("scope-a")]), ["scope-a"]);
});

test("le recyclage de la prime d'activité reste neutre à un million près", () => {
  assert.equal(Math.abs(primeActivityRecycleDifferenceMillions()) <= 1, true);
});

test("les conséquences non budgétaires ne transportent aucun champ budgétaire historique", () => {
  const source = readFileSync(new URL("./policy-consequences.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /budgetDuration|budgetTiming|annualBalance/);
});
