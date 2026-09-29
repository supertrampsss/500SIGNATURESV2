import test from "node:test";
import assert from "node:assert/strict";
import { choicesFor, decide, isFinished, start } from "./engine.ts";
import { encode, decode } from "./storage.ts";
import { resultURL, sharedResult, shareText } from "./sharing.ts";
import { cardModel } from "./cards.ts";
import { politicalEnding } from "./politics-view.ts";
import { localSession } from "./session.ts";
import { createBranch, readBranchReference, BRANCH_REFERENCE_KEY } from "./branch-replay.ts";
import { recordCompletedMandate, PROGRESSION_KEY } from "./progression.ts";
import type { Game } from "./types.ts";

function memory() {
  const data = new Map<string, string>();
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

test("v10 saves contain deterministic inputs, reconstruct politics, and reject forged decisions", () => {
  const opening = start("national", 246, "services", 10);
  const raw = encode(opening);
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  assert.equal(parsed.version, 10);
  assert.deepEqual(parsed.choices, []);
  assert.equal("politics" in parsed, false);
  assert.deepEqual(decode(raw), opening);

  const forged = { ...parsed, politics: { ending: { kind: "resignation", title: "Forgery", turn: 0 } } };
  assert.deepEqual(decode(JSON.stringify(forged)), opening, "derived political state is rebuilt, never imported");
  const first = choicesFor(opening)[0];
  assert.ok(first);
  assert.throws(() => decode(JSON.stringify({ ...parsed, choices: ["pol-forged-choice"] })));
  const played = decide(opening, first.id);
  assert.deepEqual(decode(encode(played)), played);
});

test("v10 branch references restore political state from the actual decision prefix", () => {
  const opening = start("national", 247, "equilibre", 10);
  const first = choicesFor(opening)[0];
  assert.ok(first);
  const played = decide(opening, first.id);
  const storage = memory();
  const branch = createBranch(played, 0, storage);
  assert.deepEqual(readBranchReference(storage), played);
  assert.deepEqual(branch.politics, opening.politics);
  assert.ok(storage.data.has(BRANCH_REFERENCE_KEY));

});

function assertEndedPoliticalCompatibility(ended: Game) {
  assert.equal(isFinished(ended), true);
  assert.ok(ended.politics?.ending);
  assert.deepEqual(choicesFor(ended), []);
  assert.throws(() => decide(ended, "pol-rupture-negotiate"), /terminé/i);
  assert.deepEqual(sharedResult(new URL(resultURL(ended, "https://example.org")).hash), ended);
  const forgedEnded = JSON.parse(encode(ended)) as Record<string, unknown>;
  forgedEnded.politics = { ending: { kind: "term_complete", title: "Fake", turn: 1 }, legitimacy: 100, blocs: [] };
  assert.deepEqual(decode(JSON.stringify(forgedEnded)), ended);
  assert.equal(localSession(ended, { replaceState: () => {} }).screen, "result");
  assert.match(cardModel(ended, "result").label, /MANDAT INTERROMPU/);
  assert.match(shareText(ended), /interrompu après 19 décisions/);
  assert.match(politicalEnding(ended), /décision 19/);
  assert.match(politicalEnding(ended), /Déficit annuel/);
  assert.equal(ended.history.at(-1)?.closed, false, "an early end does not invent an annual close");

  const storage = memory();
  const origin = start("national", ended.seed, ended.ambition, 10);
  let played = origin;
  for (const id of ended.choices.slice(0, -1)) played = decide(played, id);
  assert.deepEqual(played.choices, ended.choices.slice(0, -1));
  assert.deepEqual(decode(encode(played)), played);
  const branch = createBranch(ended, Math.max(0, ended.turn - 1), storage);
  assert.deepEqual(readBranchReference(storage), ended);
  assert.deepEqual(branch.politics, played.politics);
  assert.ok(storage.data.has(BRANCH_REFERENCE_KEY));
  assert.ok(!isFinished(branch));

  const archive = recordCompletedMandate(storage, ended);
  assert.equal(archive.endedRuns, 1);
  assert.equal(archive.completedRuns, 0);
  assert.equal(archive.archives[0]?.outcome, "ended");
  assert.ok(storage.data.has(PROGRESSION_KEY));
}

test("canonical early ending survives a shared result, local restore, and branch archive", () => {
  const game = start("national", 27, "equilibre", 10);
  const ids = [
    "pol-wealth-hospital-package", "pol-coalition-compromise", "r01c", "r02c", "r03c", "r04c",
    "u01c", "r05c", "r06c", "r07c", "r08c", "u00c",
    "pol-scandal-cover-up", "pol-scandal-cover-up", "pol-scandal-cover-up", "pol-scandal-cover-up",
    "pol-scandal-publish", "pol-censure-vote", "pol-destitution-vote",
  ];
  let ended = game;
  for (const id of ids) {
    assert.ok(choicesFor(ended).some(choice => choice.id === id), `choice ${id} is reachable at turn ${ended.turn}`);
    ended = decide(ended, id);
  }
  assert.equal(ended.turn, 19);
  assert.equal(ended.politics?.ending?.kind, "destitution");
  assert.ok(ended.turn < 30);
  assertEndedPoliticalCompatibility(ended);
});
