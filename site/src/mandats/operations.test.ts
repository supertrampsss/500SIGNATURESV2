import test from "node:test";
import assert from "node:assert/strict";
import { adAllowed, DEFAULT_CONSENT, triage, validateProvenance } from "./operations.ts";
test("game and essential methodology remain ad-free even with full consent", () => {
  for (const path of ["/mandats/", "/mandats/methode/", "/simulateur", "/resultats/abc/"]) assert.equal(adAllowed(path, { analytics: true, advertising: true }, true), false);
  assert.equal(adAllowed("/comprendre/dette/", DEFAULT_CONSENT, true), false);
  assert.equal(adAllowed("/comprendre/dette/", { analytics: false, advertising: true }, true), true);
});
test("listening is paused by default, sensitive cases rejected, safe cases reviewed", () => {
  const c = { id: "1", accountId: "a", threadId: "t", sourceIds: ["approved-1"], relevance: 3, question: 2, answerability: 3, usefulness: 2, sensitive: false, crisis: false, partisan: false, optedOut: false };
  assert.equal(triage(c).state, "discard");
  assert.equal(triage(c, false).state, "human-review");
  for (const key of ["sensitive", "crisis", "partisan", "optedOut"]) assert.equal(triage({ ...c, [key]: true }, false).state, "discard");
  assert.equal(triage({ ...c, answerability: Infinity }, false).state, "discard");
});
test("observed facts require source and licence; assumptions cannot impersonate them", () => {
  assert.equal(validateProvenance({ kind: "observed", unit: "EUR", perimeter: "communal", version: "v1" }), false);
  assert.equal(validateProvenance({ kind: "scenario", unit: "EUR", perimeter: "communal", version: "v1" }), true);
});
