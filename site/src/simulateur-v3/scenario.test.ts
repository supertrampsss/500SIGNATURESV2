import assert from "node:assert/strict";
import test from "node:test";

import { SCENARIO_V3_PREVIEW } from "./scenario.ts";
import { assertNoEmDash, validateScenario } from "./validation.ts";

test("le scénario provisoire porte huit chapitres de douze décisions uniques", () => {
  assert.equal(SCENARIO_V3_PREVIEW.chapters.length, 8);
  assert.deepEqual(SCENARIO_V3_PREVIEW.chapters.map((chapter) => chapter.decisionIds.length), Array(8).fill(12));
  assert.equal(SCENARIO_V3_PREVIEW.decisions.length, 96);
  assert.equal(new Set(SCENARIO_V3_PREVIEW.decisions.map((decision) => decision.id)).size, 96);
});

test("chaque chapitre contient quatre gestions, quatre transformations et quatre ruptures", () => {
  for (const chapter of SCENARIO_V3_PREVIEW.chapters) {
    const kinds = chapter.decisionIds.map((id) => SCENARIO_V3_PREVIEW.decisions.find((decision) => decision.id === id)!.kind);
    assert.deepEqual({
      gestion: kinds.filter((kind) => kind === "gestion").length,
      transformation: kinds.filter((kind) => kind === "transformation").length,
      rupture: kinds.filter((kind) => kind === "rupture").length,
    }, { gestion: 4, transformation: 4, rupture: 4 }, chapter.title);
  }
});

test("chaque dossier cite une publication directe et bannit les textes de secours", () => {
  for (const decision of SCENARIO_V3_PREVIEW.decisions) {
    assert.ok(decision.evidence.length > 0, decision.id);
    assert.ok(decision.evidence.every((item) => item.sourceUrl.startsWith("https://")), decision.id);
    assert.ok(decision.evidence.every((item) => item.sourceUrl !== "https://500signatures.fr/sources/"), decision.id);
    assert.ok(decision.evidence.every((item) => item.sourceName !== "Sources budgétaires recensées"), decision.id);
    assert.ok(decision.options.every((option) => !option.summary.startsWith("La règle actuelle reste en vigueur")), decision.id);
  }
});

test("les conséquences structurantes ne sont pas décoratives", () => {
  const delayed = SCENARIO_V3_PREVIEW.decisions.flatMap((decision) => decision.options.flatMap((option) => option.scheduledEvents));
  const connected = SCENARIO_V3_PREVIEW.decisions.filter((decision) => decision.dependencies.length + decision.conflicts.length > 0);
  assert.ok(delayed.length >= 8);
  assert.ok(connected.length >= 24);
});

test("le scénario provisoire satisfait toutes les portes du moteur V3", () => {
  assert.deepEqual(validateScenario(SCENARIO_V3_PREVIEW), []);
  assert.deepEqual(assertNoEmDash(SCENARIO_V3_PREVIEW), []);
});

test("les réactions des dossiers alimentent les indicateurs visibles du verdict", () => {
  assert.equal(SCENARIO_V3_PREVIEW.version, 6);
  const effects = SCENARIO_V3_PREVIEW.decisions.flatMap((decision) => (
    decision.options.flatMap((option) => option.effects)
  ));

  assert.ok(effects.some((effect) => effect.key === "growth" && effect.id.includes(":model:")));
  assert.ok(effects.some((effect) => effect.key === "majority" && effect.id.includes(":model:")));
});

test("chaque option dit directement ce qu'elle fait et qui paie", () => {
  for (const decision of SCENARIO_V3_PREVIEW.decisions) {
    assert.ok(decision.options.length >= 2 && decision.options.length <= 3);
    for (const option of decision.options) {
      assert.ok(option.label.trim());
      assert.ok(option.summary.trim());
      assert.ok(option.beneficiaries.length > 0);
      assert.ok(option.contributors.length > 0);
      assert.doesNotMatch(`${option.label} ${option.summary}`, /impact\s*:\s*à préciser/i);
    }
  }
});

test("le dossier nucléaire reprend les trois voies de la planche validée", () => {
  const nuclear = SCENARIO_V3_PREVIEW.decisions.find((decision) => decision.id === "engager-six-epr2-part-annuelle-de-l")!;
  assert.equal(nuclear.title, "Quel avenir pour le nucléaire ?");
  assert.deepEqual(nuclear.options.map((option) => option.label), [
    "Engager six EPR2",
    "Engager quatorze EPR2",
    "Ne lancer aucun nouveau réacteur",
  ]);
  const fourteen = nuclear.options[1]!;
  const budget = fourteen.effects.find((effect) => effect.target === "indicator" && effect.key === "annualBalance")!;
  const growth = fourteen.effects.find((effect) => effect.target === "indicator" && effect.key === "growth")!;
  assert.equal(budget.delta, -4_000);
  assert.equal(growth.delta, 0.09);
});

test("seule l'adoption d'une mesure ferme ses dossiers incompatibles", () => {
  for (const decision of SCENARIO_V3_PREVIEW.decisions) {
    assert.deepEqual(new Set(decision.options[0]!.locks), new Set(decision.conflicts));
    assert.deepEqual(decision.options.at(-1)!.locks, []);
  }
});

test("adopter la flat tax rend sans objet les dossiers qui supposent encore le barème", () => {
  const flatTax = SCENARIO_V3_PREVIEW.decisions.find((decision) => decision.id === "flat-tax-a-20-des-le-premier")!;
  assert.deepEqual(new Set(flatTax.options[0]!.locks), new Set([
    "flat-tax-a-20-avec-abattement-protegeant",
    "tranche-a-50-au-dela-de-250",
    "geler-le-bareme-de-l-impot-sur",
    "soumettre-les-revenus-du-capital-au-bareme",
    "fiscaliser-les-heures-supplementaires-comme-le",
  ]));
  assert.deepEqual(flatTax.options[1]!.locks, []);
});

test("aucune carte d'action ne porte le libellé générique Appliquer la mesure", () => {
  for (const decision of SCENARIO_V3_PREVIEW.decisions) {
    for (const option of decision.options) {
      assert.notEqual(option.label, "Appliquer la mesure");
      assert.doesNotMatch(option.label, /^(conserver|maintenir) la règle actuelle$/i);
    }
  }
});

test("le scénario provisoire ne dépend jamais des fixtures de test", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("./scenario.ts", import.meta.url), "utf8"));
  assert.doesNotMatch(source, /test-fixtures/);
});
