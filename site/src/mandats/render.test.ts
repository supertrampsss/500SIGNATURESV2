import assert from "node:assert/strict";
import test from "node:test";
import { start, decide, DOMAINS } from "./engine.ts";
import { selection, mandateSetup, gameShell, yearBriefing } from "./render.ts";
test("the public mandate entry offers the national campaign with direct choices", () => {
  const html = selection(null);
  assert.doesNotMatch(html, /data-mode="municipal"/); assert.match(html, /data-mode="national"/);
  assert.doesNotMatch(html, /Gouverner une ville|Choisir ma ville|Gouverner,<br>c’est choisir|→/); assert.match(html, /Gouverner la France/);
  for (const mode of ["national"] as const) {
    assert.doesNotMatch(gameShell(start(mode), "play", "decision"), /Le contexte en détail/);
    const g = start(mode);
    const setup = mandateSetup(start("national",42,"equilibre",9));
    assert.doesNotMatch(setup,/city-query|fictional-city|Quelle ville/);
    assert.match(setup,/France · jusqu’à 5 années · 30 décisions maximum/);
    assert.equal((setup.match(/data-action="choose-mission"/g) ?? []).length,3);
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

test('trois entrées donnent accès au vote, au bilan complet et à la partie',()=>{
 const g=start('national',42,'equilibre',8);
 const html=gameShell(g,'play','finance');
 const tabs=html.match(/<nav class="game-tabs"[\s\S]*?<\/nav>/)![0];
 assert.equal((tabs.match(/<button/g)??[]).length,3);
 for(const label of ['Décider','Bilan','Ma partie'])assert.ok(tabs.includes(label));
 for(const cls of ['finance-panel','territory-panel','journal'])assert.ok(html.includes(cls));
 assert.doesNotMatch(gameShell(g,'play','decision'),/Le contexte en détail/);
});

test("cinematic national entry and decision board expose stable, accessible browser hooks",()=>{
 const home=selection(null);
 assert.match(home,/class="cinema-entry__image"[^>]+src="\/mandats\/art\/office\.webp"/);
 assert.match(home,/data-action="tools"[^>]*>Ma partie<\/button>/);
 const g=start('national',42,'equilibre',9);
 const board=gameShell(g,'play','decision');
 for(const hook of ['data-mandate-board','data-board-hud','data-board-scene','data-board-decision','data-board-feedback'])assert.ok(board.includes(hook),`missing ${hook}`);
 assert.equal((board.match(/class="cinema-choice__art"/g)??[]).length,3);
 assert.doesNotMatch(board,/class="choice-key"|>\s*[ABC]\s*</);
 assert.match(yearBriefing(g),/class="living-briefing v9-chapter-1"/);
 assert.match(yearBriefing(g),/class="living-briefing__state"/);
 assert.match(yearBriefing(g),/data-action="start-year"/);
});
