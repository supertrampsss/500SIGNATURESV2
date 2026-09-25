import assert from "node:assert/strict";
import test from "node:test";
import { start, decide, DOMAINS } from "./engine.ts";
import { selection, gameShell } from "./render.ts";
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
        assert.doesNotMatch(rendered, /Le contexte en détail/);
        assert.match(rendered, /data-action="choose"/);
        assert.equal((rendered.match(/<h1 /g) ?? []).length, 1);
      }
    }
    const result = gameShell(g, "result", "decision");
    assert.match(result, /data-action="share"/); assert.match(result, /data-action="replay"/);
    assert.doesNotMatch(result, /undefined|NaN|replay-ambition|Rejouer avec une autre priorité/);
  }
});

test("territory detail exposes every score input with current values in both modes", () => {
  for (const mode of ["municipal", "national"] as const) {
    const g = decide(start(mode), DOMAINS[mode].dossiers[0].choices[0].id);
    const html = gameShell(g, "play", "territory");
    assert.match(html, new RegExp(`<dt>Confiance</dt><dd>${Math.round(g.metrics.trust)}<small>/100`));
    assert.match(html, new RegExp(`<dt>Patrimoine</dt><dd>${Math.round(g.metrics.assets)}<small>/100`));
    assert.match(html, /Les indicateurs du jeu/);
    assert.match(html, /pas une intention de vote/);
  }
});

test("landing archives show and distinguish interrupted-only mandates",()=>{
  const html=selection(null,false,{
    completedRuns:0,endedRuns:1,seeds:[27],missions:['equilibre'],crisesEncountered:3,
    archives:[{seed:27,ambition:'equilibre',completedAt:'2026-09-24T12:00:00.000Z',crises:3,outcome:'ended',endingTitle:'Destitution',services:48,cohesion:43,trust:39,resilience:51}],
  });
  assert.match(html,/VOS ARCHIVES/);
  assert.match(html,/1<\/strong><small>mandats archivés · 0 terminés · 1 interrompus/);
  assert.match(html,/Scénario #27 · Mandat interrompu · Destitution/);
  assert.doesNotMatch(html,/undefined|NaN/);
});
