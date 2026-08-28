import assert from "node:assert/strict";
import test from "node:test";

import { createCampaign } from "./campaign.ts";
import { mountSimulatorV3, type SimulatorV3Host } from "./controller.ts";
import { V3_STORAGE_KEY, type StorageLike } from "./storage.ts";
import { SCENARIO_V3_CRISIS_RULES } from "./scenario-crises.ts";
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

test("choisir une carte enregistre le choix et remonte vers l'écran suivant", () => {
  const host = new FakeHost();
  mountSimulatorV3(host, SCENARIO_V3_PREVIEW, { storage: memoryStorage() });
  beginDecision(host);
  const decision = SCENARIO_V3_PREVIEW.decisions[0]!;
  const avantChoix = host.scrollCalls;
  host.click("select", { decisionId: decision.id, optionId: decision.options[1]!.id });
  assert.equal(host.scrollCalls, avantChoix + 1);
});

test("un choix sans événement ouvre immédiatement le dossier suivant", () => {
  const host = new FakeHost();
  mountSimulatorV3(host, SCENARIO_V3_PREVIEW, { storage: memoryStorage() });
  beginDecision(host);
  const decision = SCENARIO_V3_PREVIEW.decisions[0]!;
  host.click("select", { decisionId: decision.id, optionId: decision.options[1]!.id });
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

test("un clic sur une carte enregistre la décision et ouvre directement sa conséquence", () => {
  const host = new FakeHost();
  const storage = memoryStorage();
  mountSimulatorV3(host, SCENARIO_V3_PREVIEW, { storage, crisisRules: SCENARIO_V3_CRISIS_RULES });
  beginDecision(host);
  const decision = SCENARIO_V3_PREVIEW.decisions[0]!;
  const option = decision.options[0]!;

  host.click("select", { decisionId: decision.id, optionId: option.id });

  const saved = JSON.parse(storage.values.get(V3_STORAGE_KEY)!);
  assert.equal(saved.decisions.length, 1);
  assert.equal(saved.decisions[0].optionId, option.id);
  assert.match(host.innerHTML, /Conseil de crise/);
  assert.doesNotMatch(host.innerHTML, /Confirmer ce choix|Décision actée/);
});

test("une crise interrompt la progression et sa concession suspend réellement la réforme", () => {
  const host = new FakeHost();
  const storage = memoryStorage();
  mountSimulatorV3(host, SCENARIO_V3_PREVIEW, { storage, crisisRules: SCENARIO_V3_CRISIS_RULES });
  beginDecision(host);
  const decision = SCENARIO_V3_PREVIEW.decisions[0]!;
  host.click("select", { decisionId: decision.id, optionId: decision.options[0]!.id });
  assert.match(host.innerHTML, /Conseil de crise/);
  assert.match(host.innerHTML, /Suspendre la flat tax/);

  host.click("resolve-crisis", { resolutionId: "suspend-flat-tax" });
  const saved = JSON.parse(storage.values.get(V3_STORAGE_KEY)!);
  assert.equal(saved.decisions[0].status, "suspended");
  assert.equal(saved.decisions[0].changedByCrisisId, "flat-tax-revolt");
  assert.deepEqual(saved.lockedDecisionIds, []);
  assert.match(host.innerHTML, /Dossier 2 sur 96/);
});

test("le journal s'ouvre dans Pause et revient sans perdre l'écran interrompu", () => {
  const host = new FakeHost();
  mountSimulatorV3(host, SCENARIO_V3_PREVIEW, { storage: memoryStorage() });
  beginDecision(host);
  const before = host.innerHTML;
  host.click("pause");
  host.click("journal");
  assert.match(host.innerHTML, /Journal du mandat/);
  host.click("back-pause");
  assert.match(host.innerHTML, /Mandat suspendu/);
  host.click("resume");
  assert.equal(host.innerHTML, before);
});

test("recommencer demande confirmation et ne supprime pas la sauvegarde V2", () => {
  const legacy = JSON.stringify({ version: 2, phase: "conseil" });
  const storage = memoryStorage({ "tunnel-partie": legacy });
  const host = new FakeHost();
  const events: string[] = [];
  const eventTarget = new EventTarget();
  eventTarget.addEventListener("simulateur-v3:evenement", (event) => events.push((event as CustomEvent).detail.type));
  mountSimulatorV3(host, SCENARIO_V3_PREVIEW, { storage, eventTarget });
  beginDecision(host);
  host.click("pause");
  host.click("ask-restart");
  assert.match(host.innerHTML, /Effacer ce mandat/);
  host.click("restart");
  assert.match(host.innerHTML, /Prendre mes fonctions/);
  assert.equal(storage.values.get("tunnel-partie"), legacy);
  assert.ok(events.includes("campaign_restarted"));
});

test("Pause restaurée reprend le cinquième dossier sans Conseil intermédiaire", () => {
  const storage = memoryStorage();
  const host = new FakeHost();
  mountSimulatorV3(host, SCENARIO_V3_PREVIEW, { storage });
  beginDecision(host);
  for (let index = 0; index < 4; index += 1) {
    const decision = SCENARIO_V3_PREVIEW.decisions[index]!;
    host.click("select", { decisionId: decision.id, optionId: decision.options[1]!.id });
  }
  assert.match(host.innerHTML, /Dossier 5 sur 96/);
  assert.doesNotMatch(host.innerHTML, /Le pays vous présente l'addition/);
  host.click("pause");

  const restored = new FakeHost();
  mountSimulatorV3(restored, SCENARIO_V3_PREVIEW, { storage });
  assert.match(restored.innerHTML, /Mandat suspendu/);
  restored.click("resume");
  assert.match(restored.innerHTML, /Dossier 5 sur 96/);
});

test("partager le verdict copie un résultat dynamique sans quitter la scène finale", async () => {
  const base = createCampaign(SCENARIO_V3_PREVIEW);
  const verdict = {
    ...base,
    phase: "verdict" as const,
    chapterIndex: 7,
    decisionIndex: 11,
    decisions: SCENARIO_V3_PREVIEW.decisions.map((decision, index) => ({
      decisionId: decision.id,
      optionId: decision.options[0]!.id,
      status: "confirmed" as const,
      confirmedAtIndex: index + 1,
    })),
    indicators: { ...base.indicators, annualBalance: -42_000, growth: 1.4, majority: 54, opinion: 49 },
  };
  const storage = memoryStorage({ [V3_STORAGE_KEY]: JSON.stringify(verdict) });
  const copies: string[] = [];
  const events: string[] = [];
  const eventTarget = new EventTarget();
  eventTarget.addEventListener("simulateur-v3:evenement", (event) => events.push((event as CustomEvent).detail.type));
  const host = new FakeHost();

  mountSimulatorV3(host, SCENARIO_V3_PREVIEW, {
    storage,
    eventTarget,
    currentUrl: () => "https://example.test/simulateur?version=3",
    shareChannels: { copier: async (text) => { copies.push(text); } },
  });
  host.click("share-verdict");
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(copies.length, 1);
  assert.match(copies[0]!, /Solde annuel : -42 milliards d'euros/);
  assert.match(copies[0]!, /https:\/\/example\.test\/simulateur\?version=3/);
  assert.match(host.innerHTML, /simulateur-v3__verdict-hero/);
  assert.ok(events.includes("verdict_shared"));
  assert.equal(JSON.parse(storage.values.get(V3_STORAGE_KEY)!).phase, "verdict");
});
