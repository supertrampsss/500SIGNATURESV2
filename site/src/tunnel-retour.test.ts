import assert from "node:assert/strict";
import { test } from "node:test";

import { commencer, etatInitial, tamponner } from "./tunnel-modele.ts";
import { chronologieRetour, impactDecision, jouerRetour, renduImpact } from "./tunnel-retour.ts";

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

test("le retour garde le cadre qui maintient le tunnel plein écran", () => {
  const attributs = new Map<string, string>();
  const action = {
    setAttribute: (nom: string, valeur: string) => void attributs.set(nom, valeur),
    removeAttribute: (nom: string) => void attributs.delete(nom),
  };
  const cadre = {
    innerHTML: '<div class="tunnel__cadre"><button data-geste="adopter">Adopter</button></div>',
    setAttribute: (nom: string, valeur: string) => void attributs.set(nom, valeur),
    removeAttribute: (nom: string) => void attributs.delete(nom),
    querySelector: () => null,
    querySelectorAll: (selecteur: string) => (selecteur.startsWith("[data-geste]") ? [action] : []),
  } as unknown as HTMLElement;
  const avant = { ...commencer(etatInitial()), ordre: ["flat-tax-a-20-des-le-premier"] };

  jouerRetour(cadre, impactDecision(avant, tamponner(avant, "adopte"), MISSION), () => undefined);

  assert.match(cadre.innerHTML, /^<div class="tunnel__cadre">/);
  assert.match(cadre.innerHTML, /<article class="tunnel__retour"/);
});

test("annuler le retour nettoie l'état et empêche son callback final", () => {
  const taches: { fn: () => void; annulee: boolean }[] = [];
  const attributs = new Map<string, string>();
  const action = {
    setAttribute: (nom: string, valeur: string) => void attributs.set(nom, valeur),
    removeAttribute: (nom: string) => void attributs.delete(nom),
  };
  const cadre = {
    innerHTML: "",
    setAttribute: (nom: string, valeur: string) => void attributs.set(nom, valeur),
    removeAttribute: (nom: string) => void attributs.delete(nom),
    querySelector: () => null,
    querySelectorAll: (selecteur: string) => (selecteur.startsWith("[data-geste]") ? [action] : []),
  } as unknown as HTMLElement;
  const horloge = {
    programmer: (fn: () => void) => {
      const tache = { fn, annulee: false };
      taches.push(tache);
      return tache;
    },
    annuler: (tache: { annulee: boolean }) => void (tache.annulee = true),
  };
  const avant = { ...commencer(etatInitial()), ordre: ["flat-tax-a-20-des-le-premier"] };
  let terminees = 0;

  const annuler = jouerRetour(cadre, impactDecision(avant, tamponner(avant, "adopte"), MISSION), () => terminees++, horloge);
  annuler();
  annuler();
  for (const tache of taches) if (!tache.annulee) tache.fn();

  assert.equal(terminees, 0);
  assert.equal(attributs.get("aria-busy"), undefined);
  assert.equal(attributs.get("inert"), undefined);
});
