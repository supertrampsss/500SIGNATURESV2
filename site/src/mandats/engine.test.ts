import test from "node:test";
import assert from "node:assert/strict";
import { choicesFor, decide, DOMAINS, preview, replay, score, start } from "./engine.ts";
import { municipalBudget } from "./municipal.ts";
import { nationalBudget } from "./national.ts";
import { decode, encode, save } from "./storage.ts";
import { challengeFromURL, challengeURL, escape, resultURL, sharedResult, socialSVG } from "./sharing.ts";

test("municipal ledger reconciles capital, savings and debt", () => {
  const f = { ...start("municipal").finance, operating: 88, rate: 2 / 60, repayment: 5, investment: 12, grants: 4, cash: 0 };
  const l = municipalBudget(f);
  assert.equal(l.savings, 10); assert.equal(l.borrowing, 3); assert.equal(l.debt, 58); assert.equal(l.cashChange, 0);
  assert.throws(() => municipalBudget({ ...f, operating: 101 }), /Fonctionnement/);
  assert.throws(() => municipalBudget({ ...f, operating: 94 }), /Épargne/);
  assert.throws(() => municipalBudget({ ...f, repayment: 61 }), /dépasse/);
});
test("national stock-flow bridge and nominal GDP are separate", () => {
  const f = { ...start("national").finance, stockFlow: 9 };
  const l = nationalBudget(f);
  assert.equal(l.debt, f.debt + l.deficit + 9);
  assert.equal(l.gdp, 2800 * 1.012 * 1.018);
  assert.notEqual(l.debt / l.gdp, l.debt / f.gdp);
});
test("new rates reach only the disclosed refinancing fraction", () => {
  const g = start("national"); const a = decide(g, "neutre");
  assert.equal(a.finance.rate, .018 + .2 * (.035 - .018));
  assert.notEqual(a.finance.rate, .035);
});
test("renovation arrives exactly once after two years, including after resume", () => {
  const initial = start("municipal"); const a = decide(initial, "ecoles");
  assert.equal(a.finance.operating, 86); assert.equal(initial.turn, 0);
  const b = decide(decode(encode(a)), "stabilite"); assert.equal(b.finance.operating, 86);
  const c = decide(b, "mobilisation"); assert.equal(c.finance.operating, 84.5);
  const d = decide(c, "entretien"); assert.equal(d.finance.operating, 84.5);
  assert.equal(c.history[2].messages.filter(m => m.includes("ouvrent après rénovation")).length, 1);
});
test("determinism, bounded scores, complete campaigns and finance invariants over every legal path", () => {
  for (const mode of ["municipal", "national"] as const) {
    let states = [start(mode)];
    for (let turn = 0; turn < DOMAINS[mode].turns; turn++) {
      const next = [];
      for (const g of states) {
        const legal = choicesFor(g).map(c => preview(g, c.id)).filter(p => p.game).map(p => p.game!);
        assert.ok(legal.length, `No recovery option: ${g.choices}`);
        for (const n of legal) {
          assert.ok(n.finance.cash >= -1e-8);
          assert.ok(n.finance.debt >= 0);
          assert.ok(Object.values(n.metrics).every(v => v >= 0 && v <= 100));
          const l = n.history.at(-1)!.ledger;
          if (mode === "municipal") { assert.ok(l.savings >= l.repayment); assert.ok(l.borrowing <= l.investment); }
          next.push(n);
        }
      }
      states = next;
    }
    assert.ok(states.length > 100);
    for (const g of states) {
      assert.deepEqual(replay(mode, g.seed, g.choices), g);
      assert.ok(score(g).total >= 0 && score(g).total <= 100);
      assert.throws(() => decide(g, "bad"), /terminé/);
    }
  }
});
test("imports reject unknown versions, injected decisions, long data and invalid seeds", () => {
  assert.throws(() => decode('{"version":2}'));
  assert.throws(() => decode(encode(start("municipal")).replace('"choices":[]', '"choices":["<script>"]')));
  assert.throws(() => decode("x".repeat(2049)));
  assert.throws(() => start("municipal", Infinity));
  assert.throws(() => challengeFromURL(new URL("https://example.org/mandats/?mode=__proto__")));
  assert.equal(save(start("municipal"), { setItem() { throw new Error("blocked"); } }), false);
});
test("result replay round-trips, challenge has no decisions, SVG is bounded and labelled", () => {
  let g = start("national", 73);
  for (const d of DOMAINS.national.dossiers) g = decide(g, d.choices[1].id);
  const url = new URL(resultURL(g, "https://example.org"));
  assert.equal(url.search, ""); assert.deepEqual(sharedResult(url.hash), g);
  const challenge = new URL(challengeURL(g, "https://example.org"));
  assert.deepEqual(challengeFromURL(challenge), start("national", 73));
  assert.match(socialSVG(g), /SIMULATION FICTIVE/);
  assert.equal(escape('<script>"&'), "&lt;script&gt;&quot;&amp;");
  assert.match(socialSVG(g), /Résilience \/ patrimoine/);
  assert.match(socialSVG(g, "story"), /height="1920"/);
});
