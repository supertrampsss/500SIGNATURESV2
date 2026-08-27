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
import { createCampaign } from "./campaign.ts";
import { validScenario } from "./test-fixtures.ts";

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
