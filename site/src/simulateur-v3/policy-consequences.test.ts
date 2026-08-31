import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("le registre de conséquences ne porte aucune métadonnée budgétaire", () => {
  const source = readFileSync(new URL("./policy-consequences.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /budgetDuration|budgetTiming|annualBalance/);
});
