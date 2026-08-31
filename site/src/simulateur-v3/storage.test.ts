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

import { clearCampaign, restoreCampaign, saveCampaign, V3_STORAGE_KEY } from "./storage.ts";
import { selectOption } from "./campaign.ts";
import { confirmSelection } from "./effects.ts";
import { SCENARIO_V3_PREVIEW } from "./scenario.ts";
import { createTestCampaign as createCampaign, testBaseline, validScenario } from "./test-fixtures.ts";
import type { Scenario } from "./types.ts";
import { isCampaignState, validateScenario } from "./validation.ts";

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

test("une sauvegarde V2 est détectée mais jamais convertie silencieusement", () => {
  const storage = memoryStorage({ "tunnel-partie": JSON.stringify({ version: 2, phase: "conseil" }) });
  assert.deepEqual(restoreCampaign(storage, validScenario()), { kind: "v2_found" });
});

test("un scénario mis à jour invalide proprement l'ancienne campagne", () => {
  const storage = memoryStorage();
  const oldScenario = validScenario();
  saveCampaign(storage, createCampaign(oldScenario));
  const newScenario = { ...oldScenario, version: oldScenario.version + 1 };
  assert.deepEqual(restoreCampaign(storage, newScenario), { kind: "invalid" });
});

test("la migration historique 5 vers 6 ajoute les effets modélisés sans perdre les choix", () => {
  const modeledScenarioV6: Scenario = { ...SCENARIO_V3_PREVIEW, version: 6 };
  const oldScenario: Scenario = {
    ...modeledScenarioV6,
    version: 5,
    decisions: modeledScenarioV6.decisions.map((decision) => ({
      ...decision,
      options: decision.options.map((option) => ({
        ...option,
        effects: option.effects.filter((effect) => !effect.id.includes(":model:")).length > 0
          ? option.effects.filter((effect) => !effect.id.includes(":model:"))
          : [{
              id: `${option.id}:legacy-capacity`,
              target: "indicator" as const,
              key: "reformCapacity" as const,
              delta: option.id.endsWith(":adopt") ? 1 : -1,
              timing: { kind: "immediate" as const },
              duration: "once" as const,
              explanation: "Ancien effet de jeu conservé pour la migration.",
            }],
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

test("la transition topologique 6 vers 7 invalide la sauvegarde sans rejouer les effets modélisés", () => {
  const scenarioV6: Scenario = { ...SCENARIO_V3_PREVIEW, version: 6 };
  const decision = scenarioV6.decisions[0]!;
  const option = decision.options[0]!;
  const oldState = confirmSelection(
    selectOption({ ...createCampaign(scenarioV6), phase: "decision" }, scenarioV6, decision.id, option.id),
    scenarioV6,
  );
  const serialized = JSON.stringify(oldState);
  const storage = memoryStorage({ [V3_STORAGE_KEY]: serialized });

  assert.deepEqual(restoreCampaign(storage, SCENARIO_V3_PREVIEW), { kind: "invalid" });
  assert.equal(storage.getItem(V3_STORAGE_KEY), serialized);
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
