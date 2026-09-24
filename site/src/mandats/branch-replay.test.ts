import test from "node:test";
import assert from "node:assert/strict";
import { choicesFor, decide, preview, start } from "./engine.ts";
import { BRANCH_REFERENCE_KEY, comparisonMarkup, createBranch, readBranchReference, renderReplaySelection, renderTrajectoryComparison, saveBranchReference } from "./branch-replay.ts";
import { STORAGE_KEY, encode } from "./storage.ts";
import type { Game } from "./types.ts";

function memory() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, data };
}

function complete(seed = 62): Game {
  let game = start("national", seed, "services", 9);
  while (game.turn < 30) {
    const choice = choicesFor(game).find(candidate => preview(game, candidate.id).game);
    assert.ok(choice);
    game = decide(game, choice.id);
  }
  return game;
}

test("branch starts immediately before the selected decision and keeps the original result", () => {
  const storage = memory();
  const original = complete();
  const originalEncoded = encode(original);
  storage.setItem(STORAGE_KEY, originalEncoded);
  const branchPoint = 12;
  const branch = createBranch(original, branchPoint, storage);

  assert.equal(branch.turn, branchPoint);
  assert.deepEqual(branch.choices, original.choices.slice(0, branchPoint));
  assert.equal(branch.version, original.version);
  assert.equal(branch.seed, original.seed);
  assert.equal(branch.ambition, original.ambition);
  assert.deepEqual(branch.city, original.city);
  assert.equal(storage.data.get(STORAGE_KEY), originalEncoded);
  assert.deepEqual(readBranchReference(storage), original);

  const alternative = choicesFor(branch).find(choice => choice.id !== original.choices[branchPoint] && preview(branch, choice.id).game);
  assert.ok(alternative, "the branch decision has an available alternative");
  const changed = decide(branch, alternative.id);
  assert.equal(changed.choices.at(-1), alternative.id);
  assert.deepEqual(original, complete());
});

test("branch selection rejects unplayed decisions, fractional turns, and corrupt histories", () => {
  const original = complete();
  assert.throws(() => createBranch(original, 30), /ne peut pas être rejoué/);
  assert.throws(() => createBranch(original, -1), /ne peut pas être rejoué/);
  assert.throws(() => createBranch(original, 3.5), /ne peut pas être rejoué/);
  assert.throws(() => createBranch({ ...original, turn: 29 }, 12), /ne peut pas être rejoué/);
  assert.throws(() => createBranch({ ...original, choices: [...original.choices, "forged"] }, 12), /ne peut pas être rejoué/);
});

test("reference reads tolerate invalid JSON, unsupported envelopes, oversize, and unavailable storage", () => {
  const storage = memory();
  assert.equal(readBranchReference(storage), null);
  storage.setItem(BRANCH_REFERENCE_KEY, "{");
  assert.equal(readBranchReference(storage), null);
  storage.setItem(BRANCH_REFERENCE_KEY, JSON.stringify({ schema: 2, game: encode(complete()) }));
  assert.equal(readBranchReference(storage), null);
  storage.setItem(BRANCH_REFERENCE_KEY, "x".repeat(70_001));
  assert.equal(readBranchReference(storage), null);
  assert.equal(saveBranchReference({ setItem: () => { throw new Error("quota"); } }, complete()), false);
});

test("comparison reports factual indicator deltas at matching progress", () => {
  const original = complete(25);
  let branch = createBranch(original, 10);
  const alternate = choicesFor(branch).find(choice => choice.id !== original.choices[10] && preview(branch, choice.id).game);
  assert.ok(alternate);
  branch = decide(branch, alternate.id);
  const markup = comparisonMarkup(branch, original);
  assert.match(markup, /même point du mandat \(11 décisions\)/);
  assert.match(markup, /Services/);
  assert.match(markup, /Cohésion/);
  assert.match(markup, /Déficit annuel/);
  assert.match(markup, /points/);
  assert.match(markup, /Md€/);
  assert.equal(comparisonMarkup(branch, complete(26)), "");
});

test("comparison at turn zero uses the original starting state, not its final indicators", () => {
  const original = complete(89);
  const opening = createBranch(original, 0);
  const markup = comparisonMarkup(opening, original);
  assert.match(markup, /même point du mandat \(0 décisions\)/);
  assert.equal((markup.match(/\+0 points/g) ?? []).length, 4);
  assert.match(markup, /\+0 Md€/);
});

test("replay selection shows real historical dossiers, choices, and a zero-based branch turn", () => {
  const original = complete(143);
  const markup = renderReplaySelection(original);
  assert.match(markup, /Où tout aurait pu changer \?/);
  assert.match(markup, /data-action="branch-replay" data-turn="0"/);
  assert.match(markup, /Choix d’origine/);
  assert.match(markup, /school\.webp|hospital\.webp|energy\.webp|nation\.webp|chapter\.webp|legacy\.webp/);
  assert.equal((markup.match(/class="replay-card" data-action="branch-replay"/g) ?? []).length, 3);
  assert.match(markup, /<details class="replay-selection__all"><summary>Toutes mes décisions/);
  assert.doesNotMatch(markup, /Rejouer depuis ce choix/);
  assert.match(markup, /data-action="show-result"/);
  assert.equal(renderReplaySelection(start("national", 143, "services", 9)), "");
});

test("full comparison uses equal progress and offers continuation or original restoration", () => {
  const original = complete(381);
  let branch = createBranch(original, 10);
  const alternative = choicesFor(branch).find(choice => choice.id !== original.choices[10] && preview(branch, choice.id).game);
  assert.ok(alternative);
  branch = decide(branch, alternative.id);
  const markup = renderTrajectoryComparison(branch, original);
  assert.match(markup, /Décision 11 \/ 30/);
  assert.match(markup, /Mandat d’origine/);
  assert.match(markup, /Nouvelle trajectoire/);
  assert.match(markup, /Déficit annuel/);
  assert.match(markup, /data-action="continue-branch"/);
  assert.match(markup, /data-action="restore-origin"/);
  assert.equal(renderTrajectoryComparison(branch, complete(382)), "");
});
