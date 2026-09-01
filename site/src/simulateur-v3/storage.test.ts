import assert from "node:assert/strict";
import { test } from "node:test";

import type { StorageLike } from "./storage.ts";

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

import { clearCampaign, completedV9StateFromStorage, hasReplacedReference, migrateV4ToV5, restoreCampaign, saveCampaign, V10_SEMANTIC_COMPATIBILITY, V3_STORAGE_KEY } from "./storage.ts";
import { selectOption } from "./campaign.ts";
import { applyEffect, confirmSelection } from "./effects.ts";
import { advanceCampaign } from "./flow.ts";
import { SCENARIO_V3_PREVIEW } from "./scenario.ts";
import { SCENARIO_V10 } from "./scenario-v10.ts";
import { SCENARIO_V11 } from "./scenario-v11.ts";
import { SCENARIO_V9 } from "./scenario-v9.ts";
import { createTestCampaign as createCampaign, testAnnualCheckpoints, testBaseline, validScenario } from "./test-fixtures.ts";
import { advanceMandateYear } from "./timeline.ts";
import type { Scenario } from "./types.ts";
import { isCampaignState, positionAfterCompleted, positionBeforeNext, validateScenario } from "./validation.ts";

test("une sauvegarde V4 sans référence remplacée migre vers le schéma 5 et V10", () => {
  const v4 = { ...createCampaign(SCENARIO_V3_PREVIEW), schemaVersion: 4 as const, scenarioVersion: 9 };
  const migrated = migrateV4ToV5(v4);
  assert.ok(migrated);
  assert.equal(migrated.schemaVersion, 5);
  assert.equal(migrated.scenarioVersion, 10);
  assert.equal(isCampaignState(migrated, SCENARIO_V10), true);

  const storage = memoryStorage({ [V3_STORAGE_KEY]: JSON.stringify(v4) });
  assert.equal(restoreCampaign(storage, SCENARIO_V10).kind, "restored");
});

test("le registre sémantique documente les options V9 identiques sans inventer un préfixe V10", () => {
  const entry = V10_SEMANTIC_COMPATIBILITY["porter-le-taux-normal-de-tva-a:adopt"]!;
  assert.deepEqual(entry, {
    decisionId: "porter-le-taux-normal-de-tva-a",
    optionId: "porter-le-taux-normal-de-tva-a:adopt",
    label: SCENARIO_V10.decisions.find((decision) => decision.id === entry.decisionId)!.options.find((option) => option.id === entry.optionId)!.label,
    summary: SCENARIO_V10.decisions.find((decision) => decision.id === entry.decisionId)!.options.find((option) => option.id === entry.optionId)!.summary,
    mechanism: SCENARIO_V10.decisions.find((decision) => decision.id === entry.decisionId)!.options.find((option) => option.id === entry.optionId)!.mechanism,
    beneficiaries: SCENARIO_V10.decisions.find((decision) => decision.id === entry.decisionId)!.options.find((option) => option.id === entry.optionId)!.beneficiaries,
    contributors: SCENARIO_V10.decisions.find((decision) => decision.id === entry.decisionId)!.options.find((option) => option.id === entry.optionId)!.contributors,
    runRateMillions: 9_800,
    runRateTiming: { kind: "immediate" },
    scope: "Profil V9 conservé pour porter-le-taux-normal-de-tva-a; assiette distincte des réformes auditées V10.",
  });
});

test("une référence V9 remplacée impose un redémarrage sans réécrire l'octet sauvegardé", () => {
  const v4 = { ...createCampaign(SCENARIO_V3_PREVIEW), schemaVersion: 4 as const, scenarioVersion: 9 };
  v4.lockedDecisionIds = ["flat-tax-a-20-des-le-premier"];
  const serialized = JSON.stringify(v4);
  const storage = memoryStorage({ [V3_STORAGE_KEY]: serialized });

  assert.equal(hasReplacedReference(v4), true);
  assert.deepEqual(restoreCampaign(storage, SCENARIO_V10), { kind: "restart_required" });
  assert.equal(storage.getItem(V3_STORAGE_KEY), serialized);
});

test("un vrai premier choix V9 actif demande un redémarrage V10 sans toucher aux octets", () => {
  const firstDecision = SCENARIO_V9.decisions[0]!;
  const opened = { ...createCampaign(SCENARIO_V9), phase: "decision" as const, ...positionBeforeNext(SCENARIO_V9, 0)! };
  const selected = selectOption(opened, SCENARIO_V9, firstDecision.id, firstDecision.options[0]!.id);
  const activeV9 = {
    ...confirmSelection(selected, SCENARIO_V9),
    schemaVersion: 4 as const,
    scenarioVersion: 9,
  };
  const serialized = JSON.stringify(activeV9);
  const storage = memoryStorage({ [V3_STORAGE_KEY]: serialized });

  assert.equal(activeV9.decisions[0]!.decisionId, "geler-le-bareme-de-l-impot-sur");
  assert.deepEqual(restoreCampaign(storage, SCENARIO_V10), { kind: "restart_required" });
  assert.equal(storage.getItem(V3_STORAGE_KEY), serialized);
});

test("une V4 V9 vierge à l'écran du premier dossier migre et réécrit la sauvegarde V10", () => {
  const pristineV9 = {
    ...createCampaign(SCENARIO_V9),
    phase: "decision" as const,
    ...positionBeforeNext(SCENARIO_V9, 0)!,
    schemaVersion: 4 as const,
    scenarioVersion: 9,
  };
  const serialized = JSON.stringify(pristineV9);
  const storage = memoryStorage({ [V3_STORAGE_KEY]: serialized });

  assert.equal(pristineV9.decisions.length, 0);
  const restored = restoreCampaign(storage, SCENARIO_V10);
  assert.equal(restored.kind, "restored");
  assert.equal(restored.kind === "restored" && restored.state.scenarioVersion, 10);
  assert.notEqual(storage.getItem(V3_STORAGE_KEY), serialized);
  assert.equal(JSON.parse(storage.getItem(V3_STORAGE_KEY)!).scenarioVersion, 10);
});

test("la détection V4 couvre les surfaces persistées avec une frontière d'identifiant stricte", () => {
  const target = "flat-tax-a-20-des-le-premier";
  const base = () => ({ ...createCampaign(SCENARIO_V3_PREVIEW), schemaVersion: 4 as const, scenarioVersion: 9 }) as unknown as Record<string, unknown>;
  const mutations: readonly [(state: Record<string, unknown>) => void, string][] = [
    [(state) => { state.decisions = [{ decisionId: target, optionId: `${target}:adopt` }]; }, "decisions"],
    [(state) => { state.pendingSelection = { decisionId: target, optionId: `${target}:adopt` }; }, "pending"],
    [(state) => { state.lockedDecisionIds = [target]; }, "locks"],
    [(state) => { state.unlockedDecisionIds = [target]; }, "unlocks"],
    [(state) => { state.scheduledEvents = [{ id: `${target}:event`, sourceDecisionId: target, sourceOptionId: `${target}:adopt` }]; }, "events"],
    [(state) => { state.eventHistory = [{ id: `${target}:event`, sourceDecisionId: target, sourceOptionId: `${target}:adopt` }]; }, "event-history"],
    [(state) => { state.activePromises = [{ id: `${target}:promise`, sourceDecisionId: target, sourceOptionId: `${target}:adopt` }]; }, "promises"],
    [(state) => { state.promiseHistory = [{ id: `${target}:promise`, sourceDecisionId: target, sourceOptionId: `${target}:adopt` }]; }, "promise-history"],
    [(state) => { state.activeCrisis = { ruleId: "r", triggeredByDecisionId: target, aggravatingDecisionIds: [target], aggravatingChoices: [{ decisionId: target, optionId: `${target}:adopt` }] }; }, "active-crisis"],
    [(state) => { state.crisisHistory = [{ ruleId: "r", triggeredByDecisionId: target, aggravatingDecisionIds: [target], aggravatingChoices: [{ decisionId: target, optionId: `${target}:adopt` }] }]; }, "crisis-history"],
    [(state) => { state.causalLedger = [{ id: `${target}:ledger`, sourceId: `${target}:adopt` }]; }, "ledger"],
  ];
  for (const [mutate, label] of mutations) {
    const state = base();
    mutate(state);
    assert.equal(hasReplacedReference(state), true, label);
  }
  const boundary = base();
  boundary.lockedDecisionIds = [`unrelated-${target}-suffix`];
  assert.equal(hasReplacedReference(boundary), false);
});

test("une campagne V3 sauvegardée est restaurée sans perte", () => {
  const storage = memoryStorage();
  const scenario = validScenario();
  const state = createCampaign(scenario, 42);
  saveCampaign(storage, state, new Date("2026-08-27T12:00:00.000Z"));
  assert.deepEqual(restoreCampaign(storage, scenario), {
    kind: "restored",
    state: { ...state, savedAt: "2026-08-27T12:00:00.000Z" },
  });
});

test("une sauvegarde V10 demande un nouveau départ au lieu de devenir une partie V11", () => {
  const state = createCampaign(SCENARIO_V10, 42);
  const serialized = JSON.stringify(state);
  const storage = memoryStorage({ [V3_STORAGE_KEY]: serialized });

  assert.deepEqual(restoreCampaign(storage, SCENARIO_V11), { kind: "restart_required" });
  assert.equal(storage.getItem(V3_STORAGE_KEY), serialized);
});

test("une sauvegarde V11 garde exactement son parcours de 45 cartes", () => {
  const state = createCampaign(SCENARIO_V11, 417);
  const plan = [...state.sessionDecisionIds!];
  const storage = memoryStorage();
  const saved = saveCampaign(storage, state, new Date("2026-09-01T12:00:00.000Z"));
  const restored = restoreCampaign(storage, SCENARIO_V11);

  assert.equal(plan.length, 45);
  assert.equal(restored.kind, "restored");
  if (restored.kind === "restored") {
    assert.deepEqual(restored.state.sessionDecisionIds, plan);
    assert.deepEqual(restored.state, saved);
  }
});

test("une sauvegarde schema 3 exige explicitement un nouveau départ", () => {
  const scenario = validScenario();
  const schema3 = { ...createCampaign(scenario), schemaVersion: 3 };
  const storage = memoryStorage({ [V3_STORAGE_KEY]: JSON.stringify(schema3) });

  assert.deepEqual(restoreCampaign(storage, scenario), { kind: "restart_required" });
  assert.equal(JSON.parse(storage.getItem(V3_STORAGE_KEY)!).schemaVersion, 3);
});

test("une sauvegarde schema 4 conserve sa baseline et sa version de publication", () => {
  const scenario = validScenario();
  const baseline = { ...testBaseline(), dataVersion: "publication-figée" };
  const state = { ...createCampaign(scenario), baseline };
  const storage = memoryStorage({ [V3_STORAGE_KEY]: JSON.stringify(state) });

  const restored = restoreCampaign(storage, scenario);
  assert.equal(restored.kind, "restored");
  if (restored.kind === "restored") assert.deepEqual(restored.state.baseline, baseline);
});

test("une sauvegarde du scénario 8 exige un nouveau mandat face au scénario 9", () => {
  const scenarioV8: Scenario = { ...SCENARIO_V3_PREVIEW, version: 8 };
  const serialized = JSON.stringify(createCampaign(scenarioV8));
  const storage = memoryStorage({
    [V3_STORAGE_KEY]: serialized,
    "tunnel-partie": JSON.stringify({ version: 2, phase: "conseil" }),
  });

  assert.deepEqual(restoreCampaign(storage, SCENARIO_V3_PREVIEW), { kind: "restart_required" });
  assert.equal(storage.getItem(V3_STORAGE_KEY), serialized);
});

test("une sauvegarde V9 avant ou après le Conseil consomme un flux ponctuel exactement une fois", () => {
  const scenario = SCENARIO_V3_PREVIEW;
  const atDecisionCount = (state: ReturnType<typeof createCampaign>, count: number) => ({
    ...state,
    phase: "decision_result" as const,
    ...positionAfterCompleted(scenario, count)!,
    decisions: scenario.decisions.slice(0, count).map((decision, index) => ({
      decisionId: decision.id,
      optionId: decision.options[0]!.id,
      status: "confirmed" as const,
      confirmedAtIndex: index + 1,
    })),
  });

  let state = advanceMandateYear(atDecisionCount(createCampaign(scenario), 16), 1);
  state = advanceMandateYear(atDecisionCount(state, 32), 2);
  state = atDecisionCount(state, 39);
  const euroExit = scenario.decisions.find((decision) => decision.id === "sortir-de-l-euro")!;
  const option = euroExit.options[0]!;
  const budget = option.effects.find((effect) =>
    effect.target === "indicator" && effect.key === "annualBalance" && effect.duration === "once")!;
  state = applyEffect(state, budget, {
    sourceType: "decision",
    sourceId: `${euroExit.id}:${option.id}`,
    appliedAtDecision: 37,
  });
  assert.equal(isCampaignState(state, scenario), true);

  const beforeStorage = memoryStorage();
  const savedBefore = saveCampaign(beforeStorage, state, new Date("2026-08-30T14:00:00.000Z"));
  const restoredBefore = restoreCampaign(beforeStorage, scenario);
  assert.equal(restoredBefore.kind, "restored");
  if (restoredBefore.kind !== "restored") return;

  const directCouncil = advanceCampaign(savedBefore, scenario, []);
  const restoredCouncil = advanceCampaign(restoredBefore.state, scenario, []);
  assert.deepEqual(restoredCouncil, directCouncil);
  assert.equal(restoredCouncil.annualCheckpoints[2]?.annualBalance, state.baseline.annualBalanceMillions - 35_000);
  assert.equal(restoredCouncil.indicators.annualBalance, state.baseline.annualBalanceMillions);
  assert.equal(restoredCouncil.causalLedger.length, 1);

  const afterStorage = memoryStorage();
  const savedAfter = saveCampaign(afterStorage, restoredCouncil, new Date("2026-08-30T15:00:00.000Z"));
  const restoredAfter = restoreCampaign(afterStorage, scenario);
  assert.deepEqual(restoredAfter, { kind: "restored", state: savedAfter });
  if (restoredAfter.kind !== "restored") return;
  assert.deepEqual(advanceMandateYear(restoredAfter.state, 3), restoredAfter.state);

  const yearFour = advanceMandateYear(atDecisionCount(restoredAfter.state, 53), 4);
  assert.equal(yearFour.annualCheckpoints[3]?.annualBalance, state.baseline.annualBalanceMillions);
  assert.equal(yearFour.causalLedger.length, 1);
  assert.ok(!yearFour.annualCheckpoints[3]?.causes.includes(yearFour.causalLedger[0]!.id));
});

test("les anciens verrous rétroactifs V8 imposent un redémarrage sans altérer la sauvegarde", () => {
  const scenarioV8: Scenario = { ...SCENARIO_V3_PREVIEW, version: 8 };
  const decision = scenarioV8.decisions[0]!;
  const confirmed = confirmSelection(
    selectOption({ ...createCampaign(scenarioV8), phase: "decision" }, scenarioV8, decision.id, decision.options[0]!.id),
    scenarioV8,
  );

  for (const field of ["lockedDecisionIds", "unlockedDecisionIds"] as const) {
    const serialized = JSON.stringify({ ...confirmed, [field]: [decision.id] });
    const storage = memoryStorage({ [V3_STORAGE_KEY]: serialized });
    assert.deepEqual(restoreCampaign(storage, SCENARIO_V3_PREVIEW), { kind: "restart_required" }, field);
    assert.equal(storage.getItem(V3_STORAGE_KEY), serialized, field);
  }
});

test("une promesse seule peut être sauvegardée puis restaurée sur l'écran différé", () => {
  const scenario = validScenario();
  scenario.decisions[0]!.options[0]!.promises = [{
    id: "promise-only",
    label: "Promesse différée seule",
    dueAfterDecisions: 1,
    failureEffects: [],
  }];
  let state = { ...createCampaign(scenario), phase: "decision" as const };
  for (const decision of scenario.decisions.slice(0, 2)) {
    state = confirmSelection(selectOption(state, scenario, decision.id, decision.options[0]!.id), scenario);
    state = advanceCampaign(state, scenario, []);
  }
  assert.equal(state.phase, "delayed_event");
  assert.equal(state.scheduledEvents.length, 0);
  assert.equal(state.activePromises[0]?.id, "promise-only");

  const storage = memoryStorage();
  const saved = saveCampaign(storage, state, new Date("2026-08-30T12:00:00.000Z"));
  assert.deepEqual(restoreCampaign(storage, scenario), { kind: "restored", state: saved });
});

test("un verdict d'une campagne courte conserve son unique checkpoint après restauration", () => {
  const source = validScenario();
  const scenario: Scenario = {
    ...source,
    chapters: source.chapters.slice(0, 2),
    decisions: source.decisions.slice(0, 24),
  };
  const finalAlternative = scenario.decisions.at(-1)!.options[1]!;
  finalAlternative.horizon = { kind: "mandate_year", year: 1 };
  finalAlternative.effects[0]!.timing = { kind: "mandate_year", year: 1 };
  const state = {
    ...createCampaign(scenario),
    phase: "verdict" as const,
    chapterIndex: 1,
    decisionIndex: 11,
    decisions: scenario.decisions.map((decision, index) => ({
      decisionId: decision.id,
      optionId: decision.options[0]!.id,
      status: "confirmed" as const,
      confirmedAtIndex: index + 1,
    })),
    annualCheckpoints: testAnnualCheckpoints(scenario, 1),
  };
  const storage = memoryStorage();
  const saved = saveCampaign(storage, state, new Date("2026-08-30T13:00:00.000Z"));

  assert.equal(saved.annualCheckpoints.length, 1);
  assert.deepEqual(restoreCampaign(storage, scenario), { kind: "restored", state: saved });
});

test("une sauvegarde V2 est détectée mais jamais convertie silencieusement", () => {
  const storage = memoryStorage({ "tunnel-partie": JSON.stringify({ version: 2, phase: "conseil" }) });
  assert.deepEqual(restoreCampaign(storage, validScenario()), { kind: "v2_found" });
});

test("un scénario mis à jour exige explicitement un nouveau mandat", () => {
  const storage = memoryStorage();
  const oldScenario = validScenario();
  saveCampaign(storage, createCampaign(oldScenario));
  const newScenario = { ...oldScenario, version: oldScenario.version + 1 };
  assert.deepEqual(restoreCampaign(storage, newScenario), { kind: "restart_required" });
});

test("la migration historique 5 vers 6 ajoute les effets modélisés sans perdre les choix", () => {
  const explicitFixture = validScenario();
  const firstDecisionId = explicitFixture.decisions[0]!.id;
  const firstOptionId = explicitFixture.decisions[0]!.options[0]!.id;
  const modeledScenarioV6: Scenario = {
    ...explicitFixture,
    version: 6,
    decisions: explicitFixture.decisions.map((decision) => decision.id !== firstDecisionId ? decision : {
      ...decision,
      options: decision.options.map((option) => option.id !== firstOptionId ? option : {
        ...option,
        effects: [
          ...option.effects,
          {
            id: `${option.id}:model:growth`,
            target: "indicator" as const,
            key: "growth" as const,
            delta: 0.2,
            timing: { kind: "immediate" as const },
            duration: "once" as const,
            explanation: "Effet de croissance ajouté par la migration historique.",
          },
          {
            id: `${option.id}:model:majority`,
            target: "indicator" as const,
            key: "majority" as const,
            delta: 2,
            timing: { kind: "immediate" as const },
            duration: "once" as const,
            explanation: "Effet de majorité ajouté par la migration historique.",
          },
        ],
      }),
    }),
  };
  const oldScenario: Scenario = {
    ...modeledScenarioV6,
    version: 5,
    decisions: modeledScenarioV6.decisions.map((decision) => ({
      ...decision,
      options: decision.options.map((option) => ({
        ...option,
        effects: option.effects.filter((effect) => !effect.id.includes(":model:")),
      })),
    })),
  };
  const decision = oldScenario.decisions[0]!;
  const option = decision.options[0]!;
  const oldState = confirmSelection(
    selectOption({ ...createCampaign(oldScenario), phase: "decision" }, oldScenario, decision.id, option.id),
    oldScenario,
  );
  const storage = memoryStorage({ [V3_STORAGE_KEY]: JSON.stringify(oldState) });

  const restored = restoreCampaign(storage, modeledScenarioV6);

  assert.equal(restored.kind, "restored");
  if (restored.kind === "restored") {
    assert.equal(restored.state.scenarioVersion, 6);
    assert.deepEqual(restored.state.decisions, oldState.decisions);
    assert.notEqual(restored.state.indicators.growth, oldState.indicators.growth);
    assert.notEqual(restored.state.indicators.majority, oldState.indicators.majority);
    const modeled = restored.state.causalLedger.filter((entry) => entry.id.includes(":model:"));
    assert.ok(modeled.length >= 2);
    assert.ok(modeled.every((entry) => entry.appliedAtDecision === 1));
    assert.equal(isCampaignState(restored.state, modeledScenarioV6), true);
  }
});

test("la transition topologique 6 vers 7 exige un nouveau mandat sans rejouer les effets modélisés", () => {
  const scenarioV6: Scenario = { ...SCENARIO_V3_PREVIEW, version: 6 };
  const scenarioV7: Scenario = { ...SCENARIO_V3_PREVIEW, version: 7 };
  const decision = scenarioV6.decisions[0]!;
  const option = decision.options[0]!;
  const oldState = confirmSelection(
    selectOption({ ...createCampaign(scenarioV6), phase: "decision" }, scenarioV6, decision.id, option.id),
    scenarioV6,
  );
  const serialized = JSON.stringify(oldState);
  const storage = memoryStorage({ [V3_STORAGE_KEY]: serialized });

  assert.deepEqual(restoreCampaign(storage, scenarioV7), { kind: "restart_required" });
  assert.equal(storage.getItem(V3_STORAGE_KEY), serialized);
});

test("une version de scénario absente, non numérique ou portée par un état corrompu reste invalide", () => {
  const oldScenario = validScenario();
  const currentScenario: Scenario = { ...oldScenario, version: oldScenario.version + 1 };
  const state = createCampaign(oldScenario);
  const { scenarioVersion: _scenarioVersion, ...withoutScenarioVersion } = state;
  const corruptions = [
    withoutScenarioVersion,
    { ...state, scenarioVersion: "1" },
    { ...state, phase: "inconnue" },
  ];

  for (const corrupted of corruptions) {
    const serialized = JSON.stringify(corrupted);
    const storage = memoryStorage({
      [V3_STORAGE_KEY]: serialized,
      "tunnel-partie": JSON.stringify({ version: 2 }),
    });
    assert.deepEqual(restoreCampaign(storage, currentScenario), { kind: "invalid" });
    assert.equal(storage.getItem(V3_STORAGE_KEY), serialized);
  }
});

test("une sauvegarde V3 invalide est refusée sans effacer les données", () => {
  const storage = memoryStorage({ [V3_STORAGE_KEY]: "{not-json" });
  assert.deepEqual(restoreCampaign(storage, validScenario()), { kind: "invalid" });
  assert.equal(storage.getItem(V3_STORAGE_KEY), "{not-json");
});

test("l'absence de sauvegarde renvoie une nouvelle campagne", () => {
  assert.deepEqual(restoreCampaign(memoryStorage(), validScenario()), { kind: "new" });
});

test("effacer retire uniquement la sauvegarde V3", () => {
  const storage = memoryStorage({ [V3_STORAGE_KEY]: "v3", "tunnel-partie": "v2" });
  clearCampaign(storage);
  assert.equal(storage.getItem(V3_STORAGE_KEY), null);
  assert.equal(storage.getItem("tunnel-partie"), "v2");
});

test("un stockage V3 indisponible n'accède à aucune autre clé", () => {
  const accessed: string[] = [];
  const storage: StorageLike = {
    getItem(key) {
      accessed.push(key);
      throw new Error("storage unavailable");
    },
    setItem() {},
    removeItem() {},
  };
  assert.deepEqual(restoreCampaign(storage, validScenario()), { kind: "unavailable" });
  assert.deepEqual(accessed, [V3_STORAGE_KEY]);
});

test("un stockage V2 indisponible après absence de V3 est signalé", () => {
  const accessed: string[] = [];
  const storage: StorageLike = {
    getItem(key) {
      accessed.push(key);
      if (key === V3_STORAGE_KEY) return null;
      throw new Error("storage unavailable");
    },
    setItem() {},
    removeItem() {},
  };
  assert.deepEqual(restoreCampaign(storage, validScenario()), { kind: "unavailable" });
  assert.deepEqual(accessed, [V3_STORAGE_KEY, "tunnel-partie"]);
});

test("une V3 invalide ne se replie pas sur une V2 valide", () => {
  const storage = memoryStorage({
    [V3_STORAGE_KEY]: "{not-json",
    "tunnel-partie": JSON.stringify({ version: 2 }),
  });
  assert.deepEqual(restoreCampaign(storage, validScenario()), { kind: "invalid" });
});

test("une erreur d'écriture ne propage pas et ne mute pas la campagne", () => {
  const state = createCampaign(validScenario());
  const storage: StorageLike = {
    getItem() { return null; },
    setItem() { throw new Error("storage unavailable"); },
    removeItem() {},
  };
  const saved = saveCampaign(storage, state, new Date("2026-08-27T12:00:00.000Z"));
  assert.deepEqual(saved, {
    ...state,
    savedAt: "2026-08-27T12:00:00.000Z",
  });
  assert.equal(state.savedAt, "1970-01-01T00:00:00.000Z");
});

test("une erreur d'effacement ne propage pas", () => {
  const storage: StorageLike = {
    getItem() { return null; },
    setItem() {},
    removeItem() { throw new Error("storage unavailable"); },
  };
  assert.doesNotThrow(() => clearCampaign(storage));
});

test("un état avec verrous, promesse et effet différé reste restaurable", () => {
  const storage = memoryStorage();
  const scenario = validScenario();
  const option = scenario.decisions[0]!.options[0]!;
  option.locks = ["decision-3"];
  option.unlocks = ["decision-4"];
  option.effects = [{
    id: "persistent-delayed-effect",
    target: "indicator",
    key: "growth",
    delta: 2,
    timing: { kind: "after_decisions", count: 1 },
    duration: "once",
    explanation: "Conséquence différée",
  }];
  option.promises = [{
    id: "persistent-promise",
    label: "Promesse persistante",
    dueAfterDecisions: 1,
    failureEffects: [],
  }];
  option.fulfillsPromises = ["persistent-promise"];

  assert.deepEqual(validateScenario(scenario), []);

  const selected = selectOption(
    { ...createCampaign(scenario), phase: "decision" as const },
    scenario,
    "decision-1",
    "decision-1-option-a",
  );
  const confirmed = confirmSelection(selected, scenario);
  assert.equal(isCampaignState(confirmed, scenario), true);

  const saved = saveCampaign(storage, confirmed, new Date("2026-08-27T12:00:00.000Z"));
  const restored = restoreCampaign(storage, scenario);
  assert.equal(restored.kind, "restored");
  if (restored.kind === "restored") {
    assert.deepEqual(restored.state, saved);
    assert.equal(isCampaignState(restored.state, scenario), true);
  }
});
