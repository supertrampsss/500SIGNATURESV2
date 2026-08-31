import assert from "node:assert/strict";
import test from "node:test";

import { optionDistanceDimensions, policyDecision, type PolicyDecisionDefinition } from "./policy-catalogue.ts";
import { POLICY_CONSEQUENCES } from "./policy-consequences.ts";
import { policyById, SCENARIO_V3_CATALOGUE } from "./scenario.ts";
import { SCENARIO_V9_SNAPSHOT } from "./scenario-v9.snapshot.ts";
import { SCENARIO_V10_CATALOGUE, STRUCTURAL_ADOPT_DECISION_IDS, v10PolicyById } from "./scenario-v10-catalogue.ts";
import { hasBudgetEstimate, primeActivityRecycleDifferenceMillions } from "./budget-registry.ts";
import type { DecisionOption } from "./types.ts";

const HISTORICAL_EFFECT_MARKER = [":", "model", ":"].join("");

test("le catalogue V10 isole 96 dossiers atomiques et les substitutions doctrinales", () => {
  assert.equal(SCENARIO_V10_CATALOGUE.version, 10);
  assert.equal(SCENARIO_V10_CATALOGUE.decisions.length, 96);
  assert.equal(SCENARIO_V10_CATALOGUE.decisions.flatMap((decision) => decision.options).length, 192);
  assert.equal(v10PolicyById("flat-tax-a-20-des-le-premier"), undefined);
  assert.equal(v10PolicyById("flat-tax-a-20-avec-abattement-protegeant"), undefined);
  const epr2 = v10PolicyById("engager-six-epr2-part-annuelle-de-l")!;
  assert.deepEqual(epr2.options.map((option) => option.id), [
    "engager-six-epr2-part-annuelle-de-l:adopt",
    "engager-six-epr2-part-annuelle-de-l:keep",
  ]);
  assert.deepEqual(epr2.options.map((option) => option.label), ["Engager six EPR2", "Ne pas engager de nouvel EPR2"]);
  assert.equal(v10PolicyById("relever-tva-restauration-commerciale")!.chapterId, "taxes-assets-transmission");
});

test("le catalogue V10 relie tous ses profils non nuls ou audités au registre", () => {
  const strictNull = { estimateKey: null, runRateMillions: 0, runRateTiming: null, transitionFlows: [], exclusiveScopeKeys: [] };
  for (const decision of SCENARIO_V10_CATALOGUE.decisions) {
    for (const option of decision.options) {
      const localOptionId = option.id.split(":").at(-1)!;
      if (option.budgetProfile.estimateKey !== null) {
        assert.equal(hasBudgetEstimate(decision.id, localOptionId, option.budgetProfile.estimateKey), true, option.id);
        assert.equal(option.budgetProfile.estimateKey.startsWith("legacy:"), false, option.id);
      }
      if (localOptionId === "keep") assert.deepEqual(option.budgetProfile, strictNull, option.id);
    }
  }
  assert.deepEqual(v10PolicyById("unifier-ir-csg-bareme-continu")!.options[0]!.budgetProfile, strictNull);
  assert.deepEqual(v10PolicyById("supprimer-subventions-directes-entreprises")!.options[0]!.budgetProfile, strictNull);
  const prime = v10PolicyById("remplacer-prime-activite-prelevements-travail")!.options[0]!.budgetProfile;
  assert.equal(prime.estimateKey, "prime-activity-recycle-2024");
  assert.equal(prime.runRateMillions, 0);
  assert.equal(Math.abs(primeActivityRecycleDifferenceMillions()) <= 1, true);
  const structuralTotal = STRUCTURAL_ADOPT_DECISION_IDS.reduce((total, decisionId) =>
    total + v10PolicyById(decisionId)!.options[0]!.budgetProfile.runRateMillions, 0);
  assert.equal(structuralTotal, 21_689);
});

test("les vingt substitutions V10 ne réemploient aucun contrat éditorial ou causal V9", () => {
  const replacements: Record<string, string> = {
    "geler-le-bareme-de-l-impot-sur": "facturation-electronique-controle-tva",
    "flat-tax-a-20-des-le-premier": "perenniser-surtaxe-grandes-entreprises",
    "flat-tax-a-20-avec-abattement-protegeant": "relever-tva-restauration-commerciale",
    "tranche-a-50-au-dela-de-250": "unifier-ir-csg-bareme-continu",
    "soumettre-les-revenus-du-capital-au-bareme": "supprimer-niches-fiscales-menages-capital",
    "supprimer-les-allegements-de-cotisations-entre-2": "recentrer-allegements-exonerations-sociales",
    "fiscaliser-les-heures-supplementaires-comme-le": "cibler-aides-apprentissage",
    "raboter-de-5-les-subventions-directes-aux": "supprimer-subventions-directes-entreprises",
    "raboter-le-credit-d-impot-recherche-de": "recentrer-cir-niches-fiscales-entreprises",
    "allocation-sociale-unique": "remplacer-prime-activite-prelevements-travail",
    "imposer-generiques-et-biosimilaires-en-premiere-intention": "medicaments-comparables-achats-sante",
    "renforcer-le-controle-des-arrets-de-travail": "reduire-arrets-evitables-prescription",
    "derembourser-les-cures-thermales": "recouvrer-fraude-sociale-additionnelle",
    "verser-le-rsa-automatiquement-fin-du-non": "unifier-instruction-prestations-solidarite",
    "interdire-les-voitures-thermiques-en-2030": "supprimer-niches-fiscales-brunes",
    "reduire-de-5-les-dotations-aux-collectivites": "clarifier-competences-doublons-territoriaux",
    "geler-le-point-d-indice-en-2026": "mutualiser-achats-publics",
    "fermer-un-tiers-des-agences-et-operateurs": "rationaliser-operateurs-ingenierie-territoriale",
    "diviser-par-deux-le-nombre-de-parlementaires": "reduire-surfaces-loyers-publics",
    "deux-jours-de-carence-dans-la-fonction": "reduire-cout-absences-fonctions-publiques",
  };
  for (const [oldId, newId] of Object.entries(replacements)) {
    const oldDecision = SCENARIO_V3_CATALOGUE.decisions.find((decision) => decision.id === oldId)!;
    const newDecision = v10PolicyById(newId)!;
    const oldContract = JSON.stringify({ title: oldDecision.title, context: oldDecision.context, options: oldDecision.options.map((option) => ({ label: option.label, summary: option.summary, mechanism: option.mechanism, legalConstraints: option.legalConstraints, beneficiaries: option.beneficiaries, contributors: option.contributors, effects: option.effects.filter((effect) => effect.key !== "annualBalance"), scheduledEvents: option.scheduledEvents, promises: option.promises, locks: option.locks, unlocks: option.unlocks })) });
    const newContract = JSON.stringify({ title: newDecision.title, context: newDecision.context, options: newDecision.options.map((option) => ({ label: option.label, summary: option.summary, mechanism: option.mechanism, legalConstraints: option.legalConstraints, beneficiaries: option.beneficiaries, contributors: option.contributors, effects: option.effects.filter((effect) => effect.key !== "annualBalance"), scheduledEvents: option.scheduledEvents, promises: option.promises, locks: option.locks, unlocks: option.unlocks })) });
    assert.notEqual(newContract, oldContract, `${oldId} -> ${newId}`);
    assert.doesNotMatch(JSON.stringify(newDecision), new RegExp(oldId), `${oldId} leaked into ${newId}`);
    assert.equal(newDecision.options.every((option) => option.scheduledEvents.length === 0 && option.promises.length === 0 && option.locks.length === 0 && option.unlocks.length === 0), true, newId);
  }
  assert.match(v10PolicyById("facturation-electronique-controle-tva")!.options[0]!.mechanism, /facturation électronique/i);
  assert.match(v10PolicyById("remplacer-prime-activite-prelevements-travail")!.options[0]!.mechanism, /prime d'activité/i);
  const newDossiers = Object.values(replacements).map((id) => v10PolicyById(id)!);
  for (const forbidden of ["tax-base-reaction", "single-benefit-losers", "local-investment-cut", "agency-mission-transfer", "porter-le-rsa-au-seuil-de"]) {
    assert.equal(newDossiers.some((decision) => JSON.stringify(decision).includes(forbidden)), false, forbidden);
  }
});

test("les dossiers conservés portent exactement leurs flux V9 dans le profil planifié", () => {
  const retired = new Set(["geler-le-bareme-de-l-impot-sur", "flat-tax-a-20-des-le-premier", "flat-tax-a-20-avec-abattement-protegeant", "tranche-a-50-au-dela-de-250", "soumettre-les-revenus-du-capital-au-bareme", "supprimer-les-allegements-de-cotisations-entre-2", "fiscaliser-les-heures-supplementaires-comme-le", "raboter-de-5-les-subventions-directes-aux", "raboter-le-credit-d-impot-recherche-de", "allocation-sociale-unique", "imposer-generiques-et-biosimilaires-en-premiere-intention", "renforcer-le-controle-des-arrets-de-travail", "derembourser-les-cures-thermales", "verser-le-rsa-automatiquement-fin-du-non", "interdire-les-voitures-thermiques-en-2030", "reduire-de-5-les-dotations-aux-collectivites", "geler-le-point-d-indice-en-2026", "fermer-un-tiers-des-agences-et-operateurs", "diviser-par-deux-le-nombre-de-parlementaires", "deux-jours-de-carence-dans-la-fonction"]);
  for (const historical of SCENARIO_V9_SNAPSHOT.decisions) {
    if (retired.has(historical.id)) continue;
    const current = v10PolicyById(historical.id)!;
    const historicalOptions = historical.id === "engager-six-epr2-part-annuelle-de-l"
      ? [historical.options.find((option) => option.id.endsWith(":six"))!]
      : historical.options;
    for (const oldOption of historicalOptions) {
      const local = oldOption.id.endsWith(":six") ? "adopt" : oldOption.id.split(":").at(-1)!;
      const actual = current.options.find((option) => option.id.endsWith(`:${local}`))!;
      const oldFlows = oldOption.effects.filter((effect) => effect.target === "indicator" && effect.key === "annualBalance").map(({ delta, timing, duration }) => ({ delta, timing, duration }));
      const newFlows = [
        ...(actual.budgetProfile.runRateMillions === 0 ? [] : [{
          delta: actual.budgetProfile.runRateMillions,
          timing: actual.budgetProfile.runRateTiming!,
          duration: "annual",
        }]),
        ...actual.budgetProfile.transitionFlows.map((flow) => ({
          delta: flow.amountMillions,
          timing: flow.timing,
          duration: "once" as const,
        })),
      ];
      assert.deepEqual(newFlows, oldFlows, `${historical.id}:${local}`);
    }
  }
});

test("le catalogue V10 est isolé et profondément gelé du snapshot V9", () => {
  const v10 = v10PolicyById("porter-le-taux-normal-de-tva-a")!;
  const v9 = SCENARIO_V3_CATALOGUE.decisions.find((decision) => decision.id === v10.id)!;
  assert.notEqual(v10, v9);
  assert.notEqual(v10.options[0], v9.options[0]);
  assert.equal(Object.isFrozen(SCENARIO_V10_CATALOGUE), true);
  assert.equal(Object.isFrozen(v10.options[0]!.effects), true);
  assert.throws(() => { (v10.options[0]!.effects as unknown as { push(value: unknown): void }).push({}); }, TypeError);
  assert.equal(v9.options[0]!.effects.length > 0, true);
});

test("EPR2 ne conserve aucun identifiant d'option retirée dans ses effets", () => {
  const epr2 = v10PolicyById("engager-six-epr2-part-annuelle-de-l")!;
  for (const option of epr2.options) {
    assert.doesNotMatch(JSON.stringify(option), /:six:|:fourteen:|:none:/);
  }
});

test("le catalogue V10 laisse ses flux budgétaires au scheduler, sans effet annualBalance dupliqué", () => {
  for (const option of SCENARIO_V10_CATALOGUE.decisions.flatMap((decision) => decision.options)) {
    assert.equal(option.effects.some((effect) => effect.target === "indicator" && effect.key === "annualBalance"), false, option.id);
  }
});

const VALID: PolicyDecisionDefinition = {
  id: "test-policy",
  chapterId: "test-chapter",
  kind: "gestion",
  title: "Tester cette décision ?",
  context: "Un contexte explicite.",
  sourceKeys: ["cour-finances-2025"],
  evidenceLabel: "Une publication identifiable.",
  options: [
    {
      id: "adopt", label: "Décider", summary: "Le choix produit un effet.", mechanism: "Voter un crédit.",
      horizon: { kind: "immediate" }, legalConstraints: ["Voter la loi."], budgetProfile: { estimateKey: "test-estimate", runRateMillions: 1, runRateTiming: { kind: "immediate" }, transitionFlows: [], exclusiveScopeKeys: [] },
      beneficiaries: ["A"], contributors: ["B"], indicatorEffects: { investment: 2 }, groupEffects: { businesses: 1 },
    },
    {
      id: "keep", label: "Refuser", summary: "Le choix conserve le dispositif.", mechanism: "Maintenir le crédit actuel.",
      horizon: { kind: "after_decisions", count: 1 }, legalConstraints: [], budgetProfile: { estimateKey: null, runRateMillions: 0, runRateTiming: null, transitionFlows: [], exclusiveScopeKeys: [] },
      beneficiaries: ["B"], contributors: ["A"], indicatorEffects: { investment: -1 }, groupEffects: { businesses: -1 },
    },
  ],
};

test("le compilateur résout une source directe sans fabriquer le texte visible", () => {
  const decision = policyDecision(VALID);
  assert.equal(decision.kind, "gestion");
  assert.match(decision.evidence[0]!.sourceUrl, /^https:\/\//);
  assert.equal(decision.options[0]!.summary, "Le choix produit un effet.");
});

test("un horizon relatif diffère les conséquences de capacité, pas l'ouverture budgétaire", () => {
  const decision = policyDecision(VALID);
  const option = decision.options[1]!;
  assert.ok(option.effects.every((effect) =>
    effect.target === "indicator" && effect.key === "annualBalance"
      ? effect.timing.kind === "immediate"
      : effect.timing.kind === "after_decisions" && effect.timing.count === 1));
});

test("le profil budgétaire porte le rythme annuel indépendamment de l'horizon principal", () => {
  const definition = structuredClone(VALID);
  definition.options[0]!.horizon = { kind: "immediate" };
  definition.options[0]!.budgetProfile.runRateTiming = { kind: "mandate_year", year: 2 };
  const option = policyDecision(definition).options[0]!;
  const budget = option.effects.find((effect) => effect.target === "indicator" && effect.key === "annualBalance")!;

  assert.deepEqual(option.budgetProfile.runRateTiming, { kind: "mandate_year", year: 2 });
  assert.deepEqual(budget.timing, { kind: "mandate_year", year: 2 });
  assert.equal(budget.duration, "annual");
});

test("chaque option publique expose un profil budgétaire", () => {
  for (const option of SCENARIO_V3_CATALOGUE.decisions.flatMap((decision) => decision.options)) {
    assert.ok(option.budgetProfile, option.id);
    assert.equal("budgetDuration" in option, false, option.id);
    assert.equal("budgetTiming" in option, false, option.id);
  }
});

test("le compilateur exige un indicateur non budgétaire, pas seulement un effet de groupe", () => {
  const definition = structuredClone(VALID);
  definition.options[0]!.indicatorEffects = {};
  assert.throws(() => policyDecision(definition), /indicateur non budgétaire absent/i);
});

test("le compilateur refuse une copie ou une source manquante", () => {
  assert.throws(() => policyDecision({ ...VALID, context: "" }));
  assert.throws(() => policyDecision({ ...VALID, sourceKeys: [] }));
});

test("l'accessor retrouve une politique dans le catalogue complet", () => {
  assert.equal(policyById(SCENARIO_V3_CATALOGUE.decisions[0]!.id)?.id, SCENARIO_V3_CATALOGUE.decisions[0]!.id);
  assert.equal(policyById("missing-policy"), undefined);
});

test("le maintien ne permute pas automatiquement les gagnants et les contributeurs", () => {
  const decision = policyById("geler-le-bareme-de-l-impot-sur")!;
  const adopt = decision.options.find((option) => option.id.endsWith(":adopt"))!;
  const keep = decision.options.find((option) => option.id.endsWith(":keep"))!;
  assert.notDeepEqual(
    [keep.beneficiaries, keep.contributors],
    [adopt.contributors, adopt.beneficiaries],
  );
  assert.deepEqual(keep.beneficiaries, ["foyers imposables", "classes moyennes"]);
  assert.deepEqual(keep.contributors, ["finances publiques"]);
});

test("le catalogue expose 193 options au contrat causal explicite", () => {
  const options = SCENARIO_V3_CATALOGUE.decisions.flatMap((decision) => decision.options);
  assert.equal(options.length, 193);
  for (const decision of SCENARIO_V3_CATALOGUE.decisions) {
    assert.equal(decision.version, 3, decision.id);
    for (const option of decision.options) {
      assert.ok(option.mechanism.trim(), `${option.id}:mechanism`);
      assert.ok(option.horizon.kind === "immediate"
        || (option.horizon.kind === "after_decisions" && option.horizon.count > 0)
        || (option.horizon.kind === "mandate_year" && option.horizon.year >= 1 && option.horizon.year <= 5), `${option.id}:horizon`);
      assert.ok(Array.isArray(option.legalConstraints), `${option.id}:legalConstraints`);
      assert.ok(option.effects.some((effect) => effect.target === "indicator" && effect.key !== "annualBalance"), `${option.id}:non-budget-indicator`);
      assert.ok(option.budgetProfile, `${option.id}:budgetProfile`);
      assert.ok(option.beneficiaries.length > 0 && option.beneficiaries.every((item) => item.trim()), `${option.id}:beneficiaries`);
      assert.ok(option.contributors.length > 0 && option.contributors.every((item) => item.trim()), `${option.id}:contributors`);
      assert.ok(!option.beneficiaries.includes("continuité du dispositif"), `${option.id}:generic-beneficiary`);
      assert.ok(!option.contributors.includes("marges de réforme non mobilisées"), `${option.id}:generic-contributor`);
      const budget = option.effects.find((effect) => effect.target === "indicator" && effect.key === "annualBalance");
      if (option.budgetProfile.runRateMillions !== 0) {
        assert.equal(budget?.delta, option.budgetProfile.runRateMillions, `${option.id}:run-rate`);
        assert.equal(budget?.duration, "annual", `${option.id}:run-rate-duration`);
      }
      assert.ok(option.effects.every((effect) => !effect.id.includes(HISTORICAL_EFFECT_MARKER)), `${option.id}:historical-marker`);
    }
  }
});

test("le registre explicite couvre exactement les 193 options du catalogue", () => {
  const catalogueKeys = SCENARIO_V3_CATALOGUE.decisions.flatMap((decision) =>
    decision.options.map((option) => option.id),
  ).sort();
  const registryKeys = Object.entries(POLICY_CONSEQUENCES).flatMap(([decisionId, options]) =>
    Object.keys(options).map((optionId) => `${decisionId}:${optionId}`),
  ).sort();
  assert.deepEqual(registryKeys, catalogueKeys);
});

test("chaque paire d'options diffère sur au moins deux dimensions matérielles", () => {
  for (const decision of SCENARIO_V3_CATALOGUE.decisions) {
    for (let left = 0; left < decision.options.length; left += 1) {
      for (let right = left + 1; right < decision.options.length; right += 1) {
        assert.ok(
          optionDistanceDimensions(decision.options[left]!, decision.options[right]!).length >= 2,
          `${decision.id}:${decision.options[left]!.id}:${decision.options[right]!.id}`,
        );
      }
    }
  }
});

test("la distance normalise l'ordre et les doublons des listes de contrats", () => {
  const base = structuredClone(policyDecision(VALID).options[0]!);
  const eventEffect = {
    id: "event-effect", target: "indicator" as const, key: "opinion" as const, delta: -1,
    timing: { kind: "immediate" as const }, duration: "once" as const, explanation: "Réaction test.",
  };
  base.scheduledEvents = [
    { id: "event-a", title: "A", body: "A", afterDecisions: 1, effects: [eventEffect] },
    { id: "event-b", title: "B", body: "B", afterDecisions: 2, effects: [] },
  ];
  base.promises = [
    { id: "promise-a", label: "A", dueAfterDecisions: 1, failureEffects: [eventEffect] },
    { id: "promise-b", label: "B", dueAfterDecisions: 2, failureEffects: [] },
  ];
  base.fulfillsPromises = ["promise-b", "promise-a"];
  const reordered = structuredClone(base);
  reordered.scheduledEvents.reverse();
  reordered.promises.reverse();
  reordered.fulfillsPromises = [" promise-a ", "promise-b", "promise-a"];

  assert.deepEqual(optionDistanceDimensions(base, reordered), []);
});

test("la sortie de l'euro conserve le coût d'intérêt annuel séparé", () => {
  const option = policyById("sortir-de-l-euro")!.options.find((candidate) => candidate.id.endsWith(":adopt"))!;
  const interest = option.effects.find((effect) => effect.target === "indicator" && effect.key === "interestCost")!;
  assert.equal(interest.delta, 12_000);
  assert.equal(interest.duration, "annual");
});

const annualBalanceEffects = (decision: { options: DecisionOption[] }) =>
  decision.options.map((option) => [
    option.id,
    option.effects
      .filter((effect) => effect.target === "indicator" && effect.key === "annualBalance")
      .map((effect) => ({
        id: effect.id,
        target: effect.target,
        key: effect.key,
        delta: effect.delta,
        timing: effect.timing,
        duration: effect.duration,
        explanation: effect.explanation,
      })),
  ] as const).sort(([left], [right]) => left.localeCompare(right));

test("le pont V9 préserve exactement les effets de solde du snapshot historique", () => {
  const currentById = new Map(SCENARIO_V3_CATALOGUE.decisions.map((decision) => [decision.id, decision]));
  for (const historicalDecision of SCENARIO_V9_SNAPSHOT.decisions) {
    const current = currentById.get(historicalDecision.id);
    assert.ok(current, historicalDecision.id);
    assert.deepEqual(annualBalanceEffects(current), annualBalanceEffects(historicalDecision), historicalDecision.id);
  }
});

test("le pont V9 conserve les cinq flux ponctuels sous leurs causes historiques exactes", () => {
  const once = SCENARIO_V3_CATALOGUE.decisions
    .flatMap((decision) => decision.options)
    .flatMap((option) => option.effects
      .filter((effect) => effect.target === "indicator" && effect.key === "annualBalance" && effect.duration === "once")
      .map((effect) => ({ optionId: option.id, id: effect.id, explanation: effect.explanation })));
  assert.deepEqual(once.map((effect) => effect.optionId), [
    "sortir-de-l-euro:adopt",
    "referendum-sur-la-sortie-de-l-ue:adopt",
    "nationaliser-les-entreprises-strategiques:adopt",
    "nationaliser-les-autoroutes:adopt",
    "ceder-des-participations-non-strategiques-de-l:adopt",
  ]);
  for (const effect of once) {
    assert.equal(effect.id, `${effect.optionId}:indicator:annualBalance`);
    assert.match(effect.explanation, /Impact budgétaire retenu par le jeu/);
    assert.doesNotMatch(effect.id, /:transition:/);
    assert.doesNotMatch(effect.explanation, /Flux ponctuel sourcé/);
  }
});
