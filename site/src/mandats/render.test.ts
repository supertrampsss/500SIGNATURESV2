import assert from "node:assert/strict";
import test from "node:test";
import { start, decide, DOMAINS } from "./engine.ts";
import { selection, briefing, gameShell } from "./render.ts";
test("both mandates have direct accessible choices and transparent briefings", () => {
  const html = selection(null);
  assert.match(html, /data-mode="municipal"/); assert.match(html, /data-mode="national"/);
  assert.match(html, /Gouverner une ville/); assert.match(html, /Gouverner la France/);
  for (const mode of ["municipal", "national"] as const) {
    assert.match(briefing(start(mode)), /fictif|fictive/);
    const g = start(mode);
    for (const view of ["decision", "territory", "finance", "journal"] as const) {
      const rendered = gameShell(g, "play", view);
      assert.match(rendered, /tabindex="-1"/);
      assert.doesNotMatch(rendered, /undefined|NaN/);
    }
  }
});
test("each resolution and debrief has a real next action, all visible values finite", () => {
  for (const mode of ["municipal", "national"] as const) {
    let g = start(mode);
    for (const dossier of DOMAINS[mode].dossiers) {
      g = decide(g, dossier.choices[1].id);
      assert.match(gameShell(g, "resolution", "decision"), /data-action="next"/);
    }
    const result = gameShell(g, "result", "decision");
    assert.match(result, /data-action="share"/); assert.match(result, /data-action="replay"/);
    assert.doesNotMatch(result, /undefined|NaN/);
  }
});
