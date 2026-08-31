import assert from "node:assert/strict";
import test from "node:test";

import { CAMPAIGN_CHAPTERS, CAMPAIGN_DECISION_IDS, campaignLength, publishCampaignFromCatalogue, validatePublishedCampaign } from "./campaign-topology.ts";
import { SCENARIO_V3, SCENARIO_V3_CATALOGUE, SCENARIO_V3_PREVIEW } from "./scenario.ts";
import { SCENARIO_V9_SNAPSHOT } from "./scenario-v9.snapshot.ts";
import { scenarioForVersion } from "./scenario-resolver.ts";
import { SCENARIO_V9 } from "./scenario-v9.ts";
import { SCENARIO_V10 } from "./scenario-v10.ts";
import { SCENARIO_V10_CATALOGUE } from "./scenario-v10-catalogue.ts";
import { SCENARIO_V10_CRISIS_RULES } from "./scenario-crises.ts";
import { assertNoEmDash, validateCrisisRules, validatePolicyCatalogue, validateScenario } from "./validation.ts";

const HISTORICAL_EFFECT_MARKER = [":", "model", ":"].join("");

test("le resolver fermé restitue les scénarios autonomes V9 et V10", () => {
  assert.equal(scenarioForVersion(9), SCENARIO_V9);
  assert.equal(scenarioForVersion(10), SCENARIO_V10);
  assert.equal(scenarioForVersion(8), null);
  assert.deepEqual(SCENARIO_V9, SCENARIO_V9_SNAPSHOT);
  assert.equal(SCENARIO_V10.decisions.length, 72);
  assert.equal(SCENARIO_V10.decisions.flatMap((decision) => decision.options).length, 144);
});

test("le scénario V10 publié passe la validation stricte et clôt la règle d'or à 72", () => {
  assert.deepEqual(validateScenario(SCENARIO_V10), []);
  assert.deepEqual(validateCrisisRules(SCENARIO_V10, SCENARIO_V10_CRISIS_RULES), []);

  const goldenRule = SCENARIO_V10.decisions.find((decision) => decision.id === "regle-d-or-constitutionnelle")!;
  const adopt = goldenRule.options.find((option) => option.id.endsWith(":adopt"))!;
  assert.deepEqual(adopt.horizon, { kind: "after_decisions", count: 1 });
  assert.ok(adopt.effects.every((effect) => effect.timing.kind === "after_decisions" && effect.timing.count === 1));
  assert.deepEqual(adopt.scheduledEvents.map((event) => event.afterDecisions), [1]);
  assert.equal(SCENARIO_V10.decisions.findIndex((decision) => decision.id === goldenRule.id) + 2, 72);
});

test("une crise V10 ne peut pas déclarer un effet budgétaire non sourcé", () => {
  const rules = structuredClone(SCENARIO_V10_CRISIS_RULES);
  rules[0]!.concessions[0]!.effects.push({
    id: "unsourced-crisis-budget",
    target: "indicator",
    key: "annualBalance",
    delta: -1,
    timing: { kind: "immediate" },
    duration: "once",
    explanation: "Effet non sourcé de test.",
  });
  delete rules[0]!.concessions[0]!.transitionEstimateKey;
  assert.ok(validateCrisisRules(SCENARIO_V10, rules).includes("crisis:v10-tax-legitimacy:concession:reverse-ir-csg-unification:budget-effect-estimate-required"));
});

test("le scénario V9 reste historique tandis que le catalogue V10 est publié sur 72 dossiers", () => {
  assert.equal(SCENARIO_V3_CATALOGUE.version, 9);
  assert.equal(SCENARIO_V3.version, 9);
  assert.equal(SCENARIO_V3_CATALOGUE.decisions.length, 96);
  assert.equal(SCENARIO_V3.decisions.length, 60);
  assert.equal(SCENARIO_V3_CATALOGUE.decisions.flatMap((decision) => decision.options).length, 193);
  assert.equal(SCENARIO_V3.decisions.flatMap((decision) => decision.options).length, 121);
  assert.deepEqual(SCENARIO_V3.chapters.map((chapter) => chapter.decisionIds.length), [8, 8, 8, 8, 7, 7, 7, 7]);
  assert.ok(SCENARIO_V3.decisions.every(({ id }) =>
    SCENARIO_V3_CATALOGUE.decisions.some((candidate) => candidate.id === id),
  ));
});

test("la publication V10 dérive 72 dossiers et 144 options de la topologie seule", () => {
  const publishedScenario = publishCampaignFromCatalogue(SCENARIO_V10_CATALOGUE);
  const published = publishedScenario.decisions;
  assert.equal(SCENARIO_V10_CATALOGUE.decisions.length, 96);
  assert.equal(SCENARIO_V10_CATALOGUE.decisions.flatMap((decision) => decision.options).length, 192);
  assert.equal(published.length, campaignLength);
  assert.equal(published.flatMap((decision) => decision.options).length, 144);
  assert.deepEqual(published.map((decision) => decision.id), CAMPAIGN_DECISION_IDS);
  assert.deepEqual(validatePublishedCampaign({
    catalogue: SCENARIO_V10_CATALOGUE,
    crisisRules: SCENARIO_V10_CRISIS_RULES,
    chapters: CAMPAIGN_CHAPTERS,
  }), []);
});

test("la campagne V9 suit exactement son historique, indépendamment de la topologie V10", () => {
  assert.deepEqual(
    SCENARIO_V3.chapters.flatMap((chapter) => chapter.decisionIds),
    SCENARIO_V9_SNAPSHOT.chapters.flatMap((chapter) => chapter.decisionIds),
  );
});

test("chaque chapitre joué conserve les trois niveaux de choix", () => {
  for (const chapter of SCENARIO_V3.chapters) {
    const kinds = new Set(chapter.decisionIds.map((id) =>
      SCENARIO_V3.decisions.find((decision) => decision.id === id)!.kind,
    ));
    assert.deepEqual(kinds, new Set(["gestion", "transformation", "rupture"]), chapter.title);
  }
});

test("la campagne ne verrouille ou déverrouille que ses dossiers joués", () => {
  const campaignIds = new Set(SCENARIO_V3.decisions.map(({ id }) => id));
  for (const decision of SCENARIO_V3.decisions) {
    for (const option of decision.options) {
      assert.ok(option.locks.every((id) => campaignIds.has(id)), `${decision.id}:lock`);
      assert.ok(option.unlocks.every((id) => campaignIds.has(id)), `${decision.id}:unlock`);
    }
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
  assert.ok(delayed.length >= 8);
  assert.ok(SCENARIO_V3_PREVIEW.decisions.every((decision) => decision.dependencies.length === 0));
  assert.deepEqual(
    new Set(SCENARIO_V3_CATALOGUE.decisions.find((decision) => decision.id === "revenir-a-62-ans")!.conflicts),
    new Set(["repousser-l-age-legal-a-65-ans"]),
  );
});

test("le scénario provisoire satisfait toutes les portes du moteur V3", () => {
  assert.deepEqual(validatePolicyCatalogue(SCENARIO_V3_CATALOGUE), []);
  assert.deepEqual(validateScenario(SCENARIO_V3), []);
  assert.deepEqual(assertNoEmDash(SCENARIO_V3_CATALOGUE), []);
});

test("les conséquences publiées sont explicites et sans marqueur de migration", () => {
  const effects = SCENARIO_V3_PREVIEW.decisions.flatMap((decision) => (
    decision.options.flatMap((option) => option.effects)
  ));

  assert.ok(effects.length > 0);
  assert.ok(effects.every((effect) => !effect.id.includes(HISTORICAL_EFFECT_MARKER)));
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
  assert.equal(budget.delta, -4_000);
  assert.equal(fourteen.effects.some((effect) => effect.key === "growth"), false);
});

test("seule l'adoption d'une mesure ferme ses dossiers incompatibles", () => {
  for (const decision of SCENARIO_V3_CATALOGUE.decisions) {
    assert.deepEqual(new Set(decision.options[0]!.locks), new Set(decision.conflicts));
    assert.deepEqual(decision.options.at(-1)!.locks, []);
  }
});

test("adopter la flat tax rend sans objet les dossiers qui supposent encore le barème", () => {
  const flatTax = SCENARIO_V3_CATALOGUE.decisions.find((decision) => decision.id === "flat-tax-a-20-des-le-premier")!;
  assert.deepEqual(new Set(flatTax.options[0]!.locks), new Set([
    "flat-tax-a-20-avec-abattement-protegeant",
    "tranche-a-50-au-dela-de-250",
    "geler-le-bareme-de-l-impot-sur",
    "soumettre-les-revenus-du-capital-au-bareme",
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
