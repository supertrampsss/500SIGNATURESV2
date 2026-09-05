import assert from "node:assert/strict";
import test from "node:test";
import { start, decide, DOMAINS } from "./engine.ts";
import { selection, mandateSetup, gameShell } from "./render.ts";
test("both mandates have direct accessible choices and optional context", () => {
  const html = selection(null);
  assert.match(html, /data-mode="municipal"/); assert.match(html, /data-mode="national"/);
  assert.match(html, /Gouverner une ville/); assert.match(html, /Gouverner la France/);
  for (const mode of ["municipal", "national"] as const) {
    assert.match(gameShell(start(mode), "play", "decision"), /Le contexte en détail/);
    const g = start(mode);
    const setup = mandateSetup(g);
    assert.equal((setup.match(/data-action="choose-cap"/g) ?? []).length, 3);
    assert.match(setup,/Un choix pour tout le mandat/);
    assert.doesNotMatch(gameShell(g,"play","decision"),/data-action="choose-cap"|data-action="ambition"|Cap :/);
    for (const view of ["decision", "territory", "finance", "journal"] as const) {
      const rendered = gameShell(g, "play", view);
      assert.match(rendered, /tabindex="-1"/);
      assert.doesNotMatch(rendered, /undefined|NaN/);
    }
  }
});
test("each choice leads to the next dossier with an optional report, then the final debrief", () => {
  for (const mode of ["municipal", "national"] as const) {
    let g = start(mode);
    for (const dossier of DOMAINS[mode].dossiers) {
      g = decide(g, dossier.choices[1].id);
      const rendered = gameShell(g, g.turn === DOMAINS[mode].turns ? "result" : "play", "decision");
      assert.doesNotMatch(rendered, /data-action="next"/);
      if (g.turn < DOMAINS[mode].turns) {
        assert.match(rendered, /<div class="turn-feedback">/);
        assert.doesNotMatch(rendered, /<details/);
        assert.ok(rendered.indexOf('class="choices"') < rendered.indexOf('class="page-notes"'));
        assert.match(rendered, /data-action="choose"/);
        assert.equal((rendered.match(/<h1 /g) ?? []).length, 1);
      }
    }
    const result = gameShell(g, "result", "decision");
    assert.match(result, /data-action="share"/); assert.match(result, /data-action="replay"/);
    assert.doesNotMatch(result, /undefined|NaN/);
  }
});

test("territory detail exposes every score input with current values in both modes", () => {
  for (const mode of ["municipal", "national"] as const) {
    const g = decide(start(mode), DOMAINS[mode].dossiers[0].choices[0].id);
    const html = gameShell(g, "play", "territory");
    assert.match(html, new RegExp(`<dt>Confiance</dt><dd>${Math.round(g.metrics.trust)}<small>/100`));
    assert.match(html, new RegExp(`<dt>Patrimoine</dt><dd>${Math.round(g.metrics.assets)}<small>/100`));
    assert.match(html, /Le pouls du mandat/);
    assert.match(html, /pas une intention de vote/);
  }
});
