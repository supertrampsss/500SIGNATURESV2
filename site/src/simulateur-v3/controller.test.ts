import assert from "node:assert/strict";
import test from "node:test";

import { mountSimulatorV3, type SimulatorV3Host } from "./controller.ts";
import { V3_STORAGE_KEY, type StorageLike } from "./storage.ts";
import { SCENARIO_V3_PREVIEW } from "./scenario.ts";

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { values: Map<string, string> } {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

class FakeHost implements SimulatorV3Host {
  innerHTML = "";
  scrollCalls = 0;
  private listener?: EventListener;

  addEventListener(_type: "click", listener: EventListener): void {
    this.listener = listener;
  }

  removeEventListener(_type: "click", listener: EventListener): void {
    if (this.listener === listener) this.listener = undefined;
  }

  scrollIntoView(): void {
    this.scrollCalls += 1;
  }

  click(action: string, data: Record<string, string> = {}): void {
    const node = { dataset: { v3Action: action, ...data } };
    const target = { closest: () => node };
    this.listener?.({ target } as unknown as Event);
  }

  hasListener(): boolean {
    return Boolean(this.listener);
  }
}

function beginDecision(host: FakeHost): void {
  host.click("start");
  host.click("open-chapter");
}

test("le contrôleur ouvre le chapitre puis le premier dossier", () => {
  const host = new FakeHost();
  mountSimulatorV3(host, SCENARIO_V3_PREVIEW, { storage: memoryStorage() });
  assert.match(host.innerHTML, /Prendre mes fonctions/);
  assert.equal(host.scrollCalls, 1);
  host.click("start");
  assert.match(host.innerHTML, /La ligne de fracture/);
  assert.equal(host.scrollCalls, 2);
  host.click("open-chapter");
  assert.match(host.innerHTML, new RegExp(SCENARIO_V3_PREVIEW.decisions[0]!.title));
  assert.equal(host.scrollCalls, 3);
});

test("choisir une carte ne déplace pas la lecture, changer d'écran la remonte", () => {
  const host = new FakeHost();
  mountSimulatorV3(host, SCENARIO_V3_PREVIEW, { storage: memoryStorage() });
  beginDecision(host);
  const decision = SCENARIO_V3_PREVIEW.decisions[0]!;
  const avantChoix = host.scrollCalls;
  host.click("select", { decisionId: decision.id, optionId: decision.options[0]!.id });
  assert.equal(host.scrollCalls, avantChoix);
  host.click("confirm");
  assert.equal(host.scrollCalls, avantChoix + 1);
});

test("sélectionner, revenir et confirmer restent dans la carte", () => {
  const host = new FakeHost();
  const storage = memoryStorage();
  mountSimulatorV3(host, SCENARIO_V3_PREVIEW, { storage });
  beginDecision(host);
  const decision = SCENARIO_V3_PREVIEW.decisions[0]!;
  const option = decision.options[0]!;
  host.click("select", { decisionId: decision.id, optionId: option.id });
  assert.match(host.innerHTML, /Confirmer ce choix/);
  host.click("cancel");
  assert.doesNotMatch(host.innerHTML, /data-v3-action="confirm"/);
  host.click("select", { decisionId: decision.id, optionId: option.id });
  host.click("confirm");
  assert.match(host.innerHTML, /Décision actée/);
  const saved = JSON.parse(storage.values.get(V3_STORAGE_KEY)!);
  assert.equal(saved.decisions.length, 1);
  assert.equal(saved.decisions[0].optionId, option.id);
});

test("Continuer avance vers le dossier suivant", () => {
  const host = new FakeHost();
  mountSimulatorV3(host, SCENARIO_V3_PREVIEW, { storage: memoryStorage() });
  beginDecision(host);
  const decision = SCENARIO_V3_PREVIEW.decisions[0]!;
  host.click("select", { decisionId: decision.id, optionId: decision.options[0]!.id });
  host.click("confirm");
  host.click("continue");
  assert.match(host.innerHTML, /Dossier 2 sur 96/);
  assert.match(host.innerHTML, new RegExp(SCENARIO_V3_PREVIEW.decisions[1]!.options[0]!.label));
});

test("Pause reprend exactement la phase interrompue et Quitter vise France", () => {
  const host = new FakeHost();
  const navigations: string[] = [];
  mountSimulatorV3(host, SCENARIO_V3_PREVIEW, {
    storage: memoryStorage(),
    navigate: (path) => navigations.push(path),
  });
  beginDecision(host);
  const before = host.innerHTML;
  host.click("pause");
  assert.match(host.innerHTML, /Mandat suspendu/);
  host.click("resume");
  assert.equal(host.innerHTML, before);
  host.click("quit");
  assert.deepEqual(navigations, ["/bilan"]);
});

test("une sauvegarde V2 est signalée sans être supprimée", () => {
  const legacy = JSON.stringify({ version: 2, phase: "conseil" });
  const storage = memoryStorage({ "tunnel-partie": legacy });
  const host = new FakeHost();
  mountSimulatorV3(host, SCENARIO_V3_PREVIEW, { storage });
  assert.match(host.innerHTML, /ancienne partie a été trouvée/);
  assert.equal(storage.values.get("tunnel-partie"), legacy);
});

test("un stockage indisponible ne bloque pas la partie", () => {
  const host = new FakeHost();
  const unavailable: StorageLike = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
    removeItem: () => { throw new Error("blocked"); },
  };
  mountSimulatorV3(host, SCENARIO_V3_PREVIEW, { storage: unavailable });
  beginDecision(host);
  assert.match(host.innerHTML, /Dossier 1/);
});

test("démonter retire l'unique écouteur délégué", () => {
  const host = new FakeHost();
  const unmount = mountSimulatorV3(host, SCENARIO_V3_PREVIEW, { storage: memoryStorage() });
  assert.equal(host.hasListener(), true);
  unmount();
  assert.equal(host.hasListener(), false);
});
