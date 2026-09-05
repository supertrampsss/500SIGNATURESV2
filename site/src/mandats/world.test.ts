import test from "node:test";
import assert from "node:assert/strict";
import { AMBITIONS } from "./ambitions.ts";
import { choicesFor, decide, DOMAINS, preview, replay, score, start } from "./engine.ts";
import { decode, encode } from "./storage.ts";
import { challengeFromURL, challengeURL, resultURL, sharedResult, socialSVG } from "./sharing.ts";
import { deliveredLayers, projects, world } from "./world.ts";
import type { Game, Mode } from "./types.ts";

const municipalPath = ["ecoles", "stabilite", "ombre", "entretien", "subvention", "renover"];
const nationalPath = ["assiette", "moderniser", "energie", "consolider", "equilibre"];

test("v1 saves, result links, fiscal copy and exact scores stay frozen", () => {
  for (const [mode, ids, expected, debt] of [
    ["municipal", municipalPath, 78, 36],
    ["national", nationalPath, 56, 3720.270329971205],
  ] as const) {
    const raw = JSON.stringify({ version: 1, mode, seed: 42, choices: ids });
    const g = decode(raw);
    assert.equal(g.version, 1); assert.equal(score(g).total, expected); assert.equal(g.finance.debt, debt);
    assert.deepEqual(sharedResult(new URL(resultURL(g, "https://example.org")).hash), g);
    assert.equal(challengeFromURL(new URL(`https://example.org/mandats/?mode=${mode}&seed=42`))?.version, 1);
  }
  assert.match(choicesFor(start("national", 42, "equilibre", 1))[0].cost, /30/);
  assert.match(choicesFor(start("national"))[0].cost, /20/);
});

test("v2 priorities round-trip through saves, results, challenges and cards", () => {
  for (const ambition of Object.keys(AMBITIONS) as (keyof typeof AMBITIONS)[]) {
    const g = replay("municipal", 43, municipalPath, 2, ambition);
    assert.deepEqual(decode(encode(g)), g);
    assert.deepEqual(sharedResult(new URL(resultURL(g, "https://example.org")).hash), g);
    assert.equal(challengeFromURL(new URL(challengeURL(g, "https://example.org")))?.ambition, ambition);
    assert.match(socialSVG(g), new RegExp(`PRIORITÉ ${AMBITIONS[ambition].short.toLocaleUpperCase("fr")}`));
    assert.throws(() => decode(encode(g).replace(ambition, "arbitrary")), /Priorité/);
  }
});

test("art upgrades reflect delivered projects only, inherited and light views stay truthful", () => {
  const a = decide(start("municipal"), "ecoles");
  assert.deepEqual(deliveredLayers(a), []);
  assert.equal(projects(a)[0].state, "planned"); assert.equal(projects(a)[0].due, 3);
  const c = replay("municipal", 42, municipalPath.slice(0, 3));
  assert.deepEqual(deliveredLayers(c), ["schools"]);
  assert.match(world(c), /upgrade-schools/); assert.doesNotMatch(world(c), /upgrade-river/);
  assert.doesNotMatch(world(c, { inherited: true }), /city-renewed|world-shock/);
  assert.match(world(c, { inherited: true }), /services 42 sur 100/);
  assert.doesNotMatch(world(c, { light: true }), /<img|<picture/);
  assert.match(world(c, { light: true }), /data-action="area"/);
  const final = replay("municipal", 42, municipalPath);
  assert.deepEqual(deliveredLayers(final), ["schools", "river", "civic"]);
  const aid = replay("national", 42, ["neutre", "moderniser", "bouclier", "soutenir"]);
  assert.equal(projects(aid).some(p => p.id === "bouclier"), false);
});

test("territorial adaptation mitigates the later national shock", () => {
  const resilient = replay("national", 42, ["assiette", "moderniser", "energie", "soutenir"]);
  const unchanged = replay("national", 42, ["assiette", "moderniser", "adapter", "soutenir"]);
  const a = DOMAINS.national.event(resilient).effect;
  const b = DOMAINS.national.event(unchanged).effect;
  assert.ok(a.services! > b.services!); assert.ok(a.cohesion! > b.cohesion!);
  assert.equal(a.area, "industrie");
});

test("cash and public trust count, unfunded future charges reduce the score", () => {
  const g = replay("municipal", 42, municipalPath);
  const moreCash = structuredClone(g); moreCash.finance.cash += 10;
  assert.ok(score(moreCash).dimensions.finances > score(g).dimensions.finances);
  const trust = structuredClone(g); trust.metrics.trust -= 20;
  assert.ok(score(trust).dimensions.cohesion < score(g).dimensions.cohesion);
  const liability = structuredClone(g); liability.pending.push({ due: 8, label: "Future charge", effect: { operating: 3 } });
  assert.equal(score(liability).total, score(g).total - 3);
});

test("every effective event seed can finish, and each priority changes the best strategy", () => {
  for (const mode of ["municipal", "national"] as Mode[]) {
    const seeds = mode === "municipal" ? [42, 43, 44] : [40, 41, 42, 43];
    for (const seed of seeds) {
      let games: Game[] = [start(mode, seed)];
      for (let turn = 0; turn < DOMAINS[mode].turns; turn++) {
        games = games.flatMap(g => {
          const next = choicesFor(g).map(c => preview(g, c.id).game).filter((x): x is Game => !!x);
          assert.ok(next.length, `${mode}/${seed}/${g.choices} must have a recovery path`);
          for (const n of next) assert.ok(n.finance.cash >= -1e-8 && n.finance.debt >= 0);
          return next;
        });
      }
      const best = Object.entries(AMBITIONS).map(([ambition, goal]) => {
        const ranked = games.map(g => {
          const s = score({ ...g, ambition: ambition as Game["ambition"] });
          return { choices: g.choices.join("/"), value: Object.entries(s.dimensions).reduce((sum, [key, v]) => sum + v * goal.weights[key as keyof typeof goal.weights], 0) - s.terminalPenalty };
        }).sort((a, b) => b.value - a.value);
        return ranked[0].choices;
      });
      assert.equal(new Set(best).size, 3, `${mode}/${seed}: no universal best strategy`);
    }
  }
});
