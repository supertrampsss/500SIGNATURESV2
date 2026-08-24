import assert from "node:assert/strict";
import { test } from "node:test";

import { commencer, etatInitial, tamponner } from "./tunnel-modele.ts";
import { chronologieRetour, impactDecision, renduImpact } from "./tunnel-retour.ts";

const MISSION = 159_297e6;

test("l'impact d'une adoption écrit le budget et les quatre soutiens", () => {
  const avant = { ...commencer(etatInitial()), ordre: ["flat-tax-a-20-des-le-premier"] };
  const apres = tamponner(avant, "adopte");

  const impact = impactDecision(avant, apres, MISSION);

  assert.equal(impact.verdict, "adopte");
  assert.notEqual(impact.resteAvant, impact.resteApres);
  assert.equal(impact.soutiens.length, 4);
  assert.equal(impact.budget.delta, impact.resteApres - impact.resteAvant);
  assert.ok(impact.soutiens.some((s) => s.delta < 0));
  assert.ok(impact.soutiens.some((s) => s.delta > 0));
});

test("l'impact d'un rejet conserve un delta budgétaire signé et les soutiens concernés", () => {
  const avant = { ...commencer(etatInitial()), ordre: ["porter-le-taux-normal-de-tva-a"] };
  const apres = tamponner(avant, "rejete");

  const impact = impactDecision(avant, apres, MISSION);

  assert.equal(impact.verdict, "rejete");
  assert.equal(impact.budget.delta, 0);
  assert.equal(impact.soutiens.length, 4);
  assert.ok(impact.soutiens.some((s) => s.delta > 0));
  assert.ok(impact.soutiens.some((s) => s.delta < 0));
});

test("le rendu énonce chaque étape et chaque delta avec son signe", () => {
  const avant = { ...commencer(etatInitial()), ordre: ["flat-tax-a-20-des-le-premier"] };
  const impact = impactDecision(avant, tamponner(avant, "adopte"), MISSION);
  const html = renduImpact(impact);

  assert.match(html, /Engagement/);
  assert.match(html, /Tampon/);
  assert.match(html, /Impact/);
  assert.match(html, /Conséquence/);
  assert.match(html, /Opinion/);
  assert.match(html, /Entreprises/);
  assert.match(html, /Territoires/);
  assert.match(html, /Marchés/);
  assert.match(html, /[+−]/);
});

test("la chronologie montre les quatre états puis rend la main à 1,8 seconde", () => {
  assert.deepEqual(chronologieRetour(), [
    { etape: "engagement", a: 0 },
    { etape: "tampon", a: 180 },
    { etape: "impact", a: 650 },
    { etape: "consequence", a: 1400 },
    { etape: "terminer", a: 1800 },
  ]);
  assert.deepEqual(chronologieRetour(true), [{ etape: "terminer", a: 400 }]);
});
