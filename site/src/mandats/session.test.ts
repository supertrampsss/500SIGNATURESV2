import assert from "node:assert/strict";
import test from "node:test";
import { decide, DOMAINS, start } from "./engine.ts";
import { challengeFromURL, challengeURL, resultURL, sharedResult } from "./sharing.ts";
import { decode, encode } from "./storage.ts";
import { clearEntryLink, entrySession, localSession } from "./session.ts";

function address(initial: string) {
  let url = new URL(initial);
  return {
    get url() { return url; },
    replaceState(_state: unknown, _unused: string, next?: string | URL | null) {
      if (next != null) url = new URL(next, url);
    },
  };
}

test("adopting a challenge consumes its entry URL and preserves progress after reload", () => {
  for (const mode of ["municipal", "national"] as const) {
    for (const version of [1, 2] as const) {
      const browser = address(challengeURL(start(mode, 42, "services", version), "https://example.org"));
      const entry = challengeFromURL(browser.url)!;
      const session = localSession(entry, browser);
      const played = decide(session.g, DOMAINS[mode].dossiers[0].choices[1].id);
      const stored = encode(played);
      assert.equal(challengeFromURL(browser.url), null);
      assert.equal(sharedResult(browser.url.hash), null);
      const resumed = localSession(decode(stored), browser);
      assert.equal(resumed.g.turn, 1);
      assert.deepEqual(resumed.g, played);
      assert.equal(resumed.screen, "play");
      assert.equal(resumed.shared, false);
      assert.equal(resumed.inherited, false);
    }
  }
});

test("replaying or importing from a shared result cannot reopen the old result", () => {
  let original = start("municipal");
  for (const dossier of DOMAINS.municipal.dossiers) original = decide(original, dossier.choices[1].id);
  const link = resultURL(original, "https://example.org");
  const replayAddress = address(link);
  assert.deepEqual(sharedResult(replayAddress.url.hash), original);
  clearEntryLink(replayAddress);
  assert.equal(sharedResult(replayAddress.url.hash), null);
  const importedAddress = address(link);
  const imported = localSession(decode(encode(original)), importedAddress);
  assert.equal(imported.screen, "result");
  assert.equal(imported.shared, false);
  assert.equal(imported.inherited, false);
  assert.equal(imported.view, "decision");
  assert.equal(importedAddress.url.href, "https://example.org/mandats/");
});

test("same-page result navigation is read-only and removing the fragment returns to selection", () => {
  let complete = start("national");
  for (const dossier of DOMAINS.national.dossiers) complete = decide(complete, dossier.choices[1].id);
  const before = encode(complete);
  const state = entrySession(new URL(resultURL(complete, "https://example.org")));
  assert.equal(state.screen, "result");
  assert.equal(state.shared, true);
  assert.equal(encode(state.g!), before);
  const home = entrySession(new URL("https://example.org/mandats/"));
  assert.equal(home.screen, "select");
  assert.equal(home.g, null);
  assert.equal(home.shared, false);
  assert.equal(encode(complete), before);
});
