import assert from "node:assert/strict";
import test from "node:test";

import {
  mountSimulatorV3 as mountProductionSimulatorV3,
  type SimulatorV3Dependencies,
  type SimulatorV3Host,
} from "./controller.ts";
import { completedV9StateFromStorage, V3_STORAGE_KEY, type StorageLike } from "./storage.ts";
import { SCENARIO_V3_CRISIS_RULES } from "./scenario-crises.ts";
import { SCENARIO_V3_PREVIEW } from "./scenario.ts";
import { SCENARIO_V9 } from "./scenario-v9.ts";
import { SCENARIO_V10 } from "./scenario-v10.ts";
import { createTestCampaign as createCampaign, testAnnualCheckpoints, testBaseline } from "./test-fixtures.ts";
import type { CampaignPhase, Scenario } from "./types.ts";
import { positionAfterCompleted, positionBeforeNext } from "./validation.ts";

const IMMEDIATE_FLAT_TAX_CRISIS_RULES = SCENARIO_V3_CRISIS_RULES.map((rule) => ({
  ...rule,
  threshold: 100,
}));

function mountSimulatorV3(
  host: SimulatorV3Host,
  scenario: Scenario,
  dependencies: Omit<SimulatorV3Dependencies, "baseline"> = {},
): () => void {
  return mountProductionSimulatorV3(host, scenario, { baseline: testBaseline(), ...dependencies });
}

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
  focusCalls = 0;
  lastFocusedSelector = "";
  private clickListener?: EventListener;
  private keydownListener?: EventListener;

  addEventListener(type: "click" | "keydown", listener: EventListener): void {
    if (type === "click") this.clickListener = listener;
    else this.keydownListener = listener;
  }

  removeEventListener(type: "click" | "keydown", listener: EventListener): void {
    if (type === "click" && this.clickListener === listener) this.clickListener = undefined;
    if (type === "keydown" && this.keydownListener === listener) this.keydownListener = undefined;
  }

  scrollIntoView(): void {
    this.scrollCalls += 1;
  }

  click(action: string, data: Record<string, string> = {}): void {
    const node = { dataset: { v3Action: action, ...data } };
    const target = { closest: () => node };
    this.clickListener?.({ target } as unknown as Event);
  }

  keydown(key: string): void {
    this.keydownListener?.({ key, preventDefault() {} } as unknown as KeyboardEvent);
  }

  querySelector(selector: string): { textContent: string | null; focus(options?: FocusOptions): void } | null {
    if (!this.innerHTML.includes("<h1") && selector.includes("h1")) return null;
    return {
      textContent: "",
      focus: () => {
        this.focusCalls += 1;
        this.lastFocusedSelector = selector;
      },
    };
  }

  hasListener(): boolean {
    return Boolean(this.clickListener);
  }
}

function beginDecision(host: FakeHost): void {
  host.click("start");
}

function stateBefore(decisionId: string) {
  const index = SCENARIO_V3_PREVIEW.decisions.findIndex((decision) => decision.id === decisionId);
  assert.ok(index >= 0);
  const base = createCampaign(SCENARIO_V3_PREVIEW);
  return {
    ...base,
    phase: "decision" as const,
    ...positionBeforeNext(SCENARIO_V3_PREVIEW, index)!,
    decisions: SCENARIO_V3_PREVIEW.decisions.slice(0, index).map((decision, decisionIndex) => ({
      decisionId: decision.id,
      optionId: decision.options.at(-1)!.id,
      status: "confirmed" as const,
      confirmedAtIndex: decisionIndex + 1,
    })),
  };
}

test("le chrome global reste sur l'introduction puis cède la place au mandat", () => {
  const host = new FakeHost();
  const phases: Array<CampaignPhase | null> = [];
  const unmount = mountSimulatorV3(host, SCENARIO_V3_PREVIEW, {
    storage: memoryStorage(),
    onPhaseChange: (phase) => phases.push(phase),
  });

  assert.deepEqual(phases, ["intro"]);
  host.click("start");
  assert.equal(phases.at(-1), "decision");
  unmount();
  assert.equal(phases.at(-1), null);
});

test("un verdict V9 schema 4 est relu sans réécriture puis monté comme verdict V9", () => {
  const verdict = {
    ...createCampaign(SCENARIO_V9),
    schemaVersion: 4 as const,
    scenarioVersion: 9,
    phase: "verdict" as const,
    ...positionAfterCompleted(SCENARIO_V9, SCENARIO_V9.decisions.length)!,
    decisions: SCENARIO_V9.decisions.map((decision, index) => ({
      decisionId: decision.id,
      optionId: decision.options.at(-1)!.id,
      status: "confirmed" as const,
      confirmedAtIndex: index + 1,
    })),
    annualCheckpoints: testAnnualCheckpoints(SCENARIO_V9),
  };
  const serialized = JSON.stringify(verdict);
  const storage = memoryStorage({ [V3_STORAGE_KEY]: serialized });
  const restored = completedV9StateFromStorage(storage);

  assert.ok(restored);
  assert.equal(restored!.schemaVersion, 5);
  assert.equal(storage.values.get(V3_STORAGE_KEY), serialized);

  const host = new FakeHost();
  mountSimulatorV3(host, SCENARIO_V9, { storage, initialState: restored! });
  assert.match(host.innerHTML, /simulateur-v3__verdict-hero/);
  assert.equal(storage.values.get(V3_STORAGE_KEY), serialized);
});

test("un état initial injecté doit correspondre au scénario monté", () => {
  const host = new FakeHost();
  const incompatible = {
    ...createCampaign(SCENARIO_V3_PREVIEW),
    scenarioVersion: 10,
  };

  assert.throws(
    () => mountSimulatorV3(host, SCENARIO_V3_PREVIEW, { storage: memoryStorage(), initialState: incompatible }),
    /Initial simulator state is invalid/,
  );
});

test("le contrôleur ouvre directement le premier dossier sans écran de chapitre", () => {
  const host = new FakeHost();
  mountSimulatorV3(host, SCENARIO_V3_PREVIEW, { storage: memoryStorage() });
  assert.match(host.innerHTML, /Prendre mes fonctions/);
  assert.equal(host.scrollCalls, 1);
  assert.equal(host.focusCalls, 1);
  host.click("start");
  assert.match(host.innerHTML, new RegExp(SCENARIO_V3_PREVIEW.decisions[0]!.title.replaceAll("'", "&#39;")));
  assert.doesNotMatch(host.innerHTML, /La ligne de fracture|Ouvrir le premier dossier/);
  assert.equal(host.scrollCalls, 2);
  assert.equal(host.focusCalls, 2);
});

test("un clic sur une carte confirme le choix et ouvre directement le dossier suivant", () => {
  const host = new FakeHost();
  const storage = memoryStorage();
  mountSimulatorV3(host, SCENARIO_V3_PREVIEW, { storage });
  beginDecision(host);
  const decision = SCENARIO_V3_PREVIEW.decisions[0]!;
  const avantChoix = host.scrollCalls;
  const avantFocus = host.focusCalls;
  host.click("select", { decisionId: decision.id, optionId: decision.options[1]!.id });
  const confirmed = JSON.parse(storage.values.get(V3_STORAGE_KEY)!);
  assert.equal(confirmed.decisions.length, 1);
  assert.equal(confirmed.decisions[0].optionId, decision.options[1]!.id);
  assert.equal(confirmed.phase, "decision");
  assert.equal(confirmed.pendingSelection, undefined);
  assert.equal(host.scrollCalls, avantChoix + 1);
  assert.equal(host.focusCalls, avantFocus + 1);
  assert.match(host.innerHTML, /Dossier 2 sur 60/);
  assert.match(host.innerHTML, new RegExp(SCENARIO_V3_PREVIEW.decisions[1]!.options[0]!.label));
});

test("ouvrir puis fermer le détail ne choisit pas l'option et rend le focus à son bouton", () => {
  const host = new FakeHost();
  const storage = memoryStorage();
  mountSimulatorV3(host, SCENARIO_V10, { storage });
  beginDecision(host);
  const optionId = "unifier-ir-csg-bareme-continu:adopt";
  const savedBeforeOpening = storage.values.get(V3_STORAGE_KEY);

  host.click("open-details", { optionId });
  assert.match(host.innerHTML, new RegExp(`data-v3-detail-panel="${optionId}"`));
  assert.equal(storage.values.get(V3_STORAGE_KEY), savedBeforeOpening);
  assert.equal(host.lastFocusedSelector, ".simulateur-v3__detail-panel");

  host.click("close-details");
  assert.doesNotMatch(host.innerHTML, /simulateur-v3__detail-panel/);
  assert.equal(host.lastFocusedSelector, `[data-v3-detail-trigger="${optionId}"]`);
});

test("Échap ferme le détail ouvert sans sélectionner une option", () => {
  const host = new FakeHost();
  const storage = memoryStorage();
  mountSimulatorV3(host, SCENARIO_V10, { storage });
  beginDecision(host);
  const savedBeforeOpening = storage.values.get(V3_STORAGE_KEY);

  host.click("open-details", { optionId: "unifier-ir-csg-bareme-continu:adopt" });
  host.keydown("Escape");

  assert.doesNotMatch(host.innerHTML, /simulateur-v3__detail-panel/);
  assert.equal(storage.values.get(V3_STORAGE_KEY), savedBeforeOpening);
});

test("un clic sur le fond ferme le détail mais un clic dans le panneau le garde ouvert", () => {
  const host = new FakeHost();
  const storage = memoryStorage();
  mountSimulatorV3(host, SCENARIO_V10, { storage });
  beginDecision(host);
  const optionId = "unifier-ir-csg-bareme-continu:adopt";

  host.click("open-details", { optionId });
  host.click("keep-details-open");
  assert.match(host.innerHTML, /simulateur-v3__detail-panel/);

  host.click("close-details");
  assert.doesNotMatch(host.innerHTML, /simulateur-v3__detail-panel/);
  assert.equal(host.lastFocusedSelector, `[data-v3-detail-trigger="${optionId}"]`);
});

test("un choix en frontière annuelle rejoint directement le dossier suivant", () => {
  const decisionId = SCENARIO_V3_PREVIEW.chapters[1]!.decisionIds.at(-1)!;
  const initialState = stateBefore(decisionId);
  const storage = memoryStorage();
  const host = new FakeHost();
  mountSimulatorV3(host, SCENARIO_V3_PREVIEW, { storage, initialState });
  const beforeScroll = host.scrollCalls;
  const beforeFocus = host.focusCalls;
  const decision = SCENARIO_V3_PREVIEW.decisions.find((candidate) => candidate.id === decisionId)!;

  host.click("select", { decisionId, optionId: decision.options[0]!.id });

  const saved = JSON.parse(storage.values.get(V3_STORAGE_KEY)!);
  assert.equal(saved.phase, "decision");
  assert.equal(saved.annualCheckpoints.at(-1)?.afterDecisionCount, initialState.decisions.length + 1);
  assert.doesNotMatch(host.innerHTML, /La ligne de fracture|Ouvrir le premier dossier/);
  assert.doesNotMatch(host.innerHTML, /Le pays réagit à vos arbitrages/);
  assert.equal(host.scrollCalls, beforeScroll + 1);
  assert.equal(host.focusCalls, beforeFocus + 1);
});

test("une sauvegarde en phase intermédiaire est normalisée avant le premier rendu", () => {
  const decisionCount = SCENARIO_V3_PREVIEW.chapters.slice(0, 2)
    .reduce((sum, chapter) => sum + chapter.decisionIds.length, 0);
  const restored = {
    ...createCampaign(SCENARIO_V3_PREVIEW),
    phase: "decision_result" as const,
    ...positionAfterCompleted(SCENARIO_V3_PREVIEW, decisionCount)!,
    decisions: SCENARIO_V3_PREVIEW.decisions.slice(0, decisionCount).map((decision, index) => ({
      decisionId: decision.id,
      optionId: decision.options[0]!.id,
      status: "confirmed" as const,
      confirmedAtIndex: index + 1,
    })),
  };
  const host = new FakeHost();
  mountSimulatorV3(host, SCENARIO_V3_PREVIEW, {
    storage: memoryStorage({ [V3_STORAGE_KEY]: JSON.stringify(restored) }),
  });

  assert.doesNotMatch(host.innerHTML, /La ligne de fracture|Ouvrir le premier dossier/);
  assert.match(host.innerHTML, /data-v3-action="select"/);
  assert.doesNotMatch(host.innerHTML, /Décision enregistrée|Le pays réagit à vos arbitrages/);
  assert.equal(host.scrollCalls, 1);
  assert.equal(host.focusCalls, 1);
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

test("une sauvegarde schema 3 demande un nouveau mandat sans conversion", () => {
  const old = { ...createCampaign(SCENARIO_V3_PREVIEW), schemaVersion: 3 };
  const storage = memoryStorage({ [V3_STORAGE_KEY]: JSON.stringify(old) });
  const host = new FakeHost();

  mountSimulatorV3(host, SCENARIO_V3_PREVIEW, { storage });

  assert.match(host.innerHTML, /anciennes règles/);
  assert.equal(JSON.parse(storage.values.get(V3_STORAGE_KEY)!).schemaVersion, 3);
});

test("un stockage indisponible ne bloque pas la partie", () => {
  const host = new FakeHost();
  const unavailable: StorageLike = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
    removeItem: () => { throw new Error("blocked"); },
  };
  mountSimulatorV3(host, SCENARIO_V3_PREVIEW, { storage: unavailable });
  assert.match(host.innerHTML, /sauvegarde locale est indisponible/);
  beginDecision(host);
  assert.match(host.innerHTML, /Dossier 1/);
  assert.match(host.innerHTML, /sauvegarde locale est indisponible/);
});

test("démonter retire l'unique écouteur délégué", () => {
  const host = new FakeHost();
  const unmount = mountSimulatorV3(host, SCENARIO_V3_PREVIEW, { storage: memoryStorage() });
  assert.equal(host.hasListener(), true);
  unmount();
  assert.equal(host.hasListener(), false);
});

test("une crise éventuelle interrompt immédiatement la progression après le clic", () => {
  const host = new FakeHost();
  const initial = stateBefore("flat-tax-a-20-des-le-premier");
  const storage = memoryStorage({ [V3_STORAGE_KEY]: JSON.stringify(initial) });
  mountSimulatorV3(host, SCENARIO_V3_PREVIEW, { storage, crisisRules: IMMEDIATE_FLAT_TAX_CRISIS_RULES });
  const decision = SCENARIO_V3_PREVIEW.decisions.find((candidate) => candidate.id === "flat-tax-a-20-des-le-premier")!;
  const option = decision.options[0]!;

  host.click("select", { decisionId: decision.id, optionId: option.id });
  const saved = JSON.parse(storage.values.get(V3_STORAGE_KEY)!);
  assert.equal(saved.decisions.length, initial.decisions.length + 1);
  assert.equal(saved.decisions.at(-1).optionId, option.id);
  assert.equal(saved.phase, "crisis");
  assert.match(host.innerHTML, /Conseil de crise/);
});

test("une crise interrompt la progression et sa concession suspend réellement la réforme", () => {
  const host = new FakeHost();
  const initial = stateBefore("flat-tax-a-20-des-le-premier");
  const storage = memoryStorage({ [V3_STORAGE_KEY]: JSON.stringify(initial) });
  mountSimulatorV3(host, SCENARIO_V3_PREVIEW, { storage, crisisRules: IMMEDIATE_FLAT_TAX_CRISIS_RULES });
  const decision = SCENARIO_V3_PREVIEW.decisions.find((candidate) => candidate.id === "flat-tax-a-20-des-le-premier")!;
  host.click("select", { decisionId: decision.id, optionId: decision.options[0]!.id });
  assert.match(host.innerHTML, /Conseil de crise/);
  assert.match(host.innerHTML, /Suspendre la flat tax/);

  const avantConcession = host.scrollCalls;
  host.click("resolve-crisis", { resolutionId: "suspend-flat-tax" });
  assert.equal(host.scrollCalls, avantConcession + 1);
  const saved = JSON.parse(storage.values.get(V3_STORAGE_KEY)!);
  assert.equal(saved.decisions.at(-1).status, "suspended");
  assert.equal(saved.decisions.at(-1).changedByCrisisId, "flat-tax-revolt");
  assert.deepEqual(saved.lockedDecisionIds, []);
  assert.match(host.innerHTML, /Dossier 8 sur 60/);
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
  assert.match(host.innerHTML, /Dossier 5 sur 60/);
  assert.doesNotMatch(host.innerHTML, /Le pays vous présente l'addition/);
  host.click("pause");

  const restored = new FakeHost();
  mountSimulatorV3(restored, SCENARIO_V3_PREVIEW, { storage });
  assert.match(restored.innerHTML, /Mandat suspendu/);
  restored.click("resume");
  assert.match(restored.innerHTML, /Dossier 5 sur 60/);
});

test("une ancienne sauvegarde de fin de chapitre reprend au chapitre suivant", () => {
  const base = createCampaign(SCENARIO_V3_PREVIEW);
  const legacy = {
    ...base,
    phase: "chapter_verdict" as const,
    chapterIndex: 0,
    decisionIndex: 7,
    decisions: SCENARIO_V3_PREVIEW.decisions.slice(0, 8).map((decision, index) => ({
      decisionId: decision.id,
      optionId: decision.options.at(-1)!.id,
      status: "confirmed" as const,
      confirmedAtIndex: index + 1,
    })),
  };
  const host = new FakeHost();
  mountSimulatorV3(host, SCENARIO_V3_PREVIEW, {
    storage: memoryStorage({ [V3_STORAGE_KEY]: JSON.stringify(legacy) }),
  });
  assert.match(host.innerHTML, /Chapitre 2 sur 8/);
  assert.doesNotMatch(host.innerHTML, /Le pays vous présente l'addition/);
});

test("partager le verdict copie un résultat dynamique sans quitter la scène finale", async () => {
  const base = createCampaign(SCENARIO_V3_PREVIEW);
  const verdict = {
    ...base,
    phase: "verdict" as const,
    chapterIndex: 7,
    decisionIndex: 6,
    decisions: SCENARIO_V3_PREVIEW.decisions.map((decision, index) => ({
      decisionId: decision.id,
      optionId: decision.options[0]!.id,
      status: "confirmed" as const,
      confirmedAtIndex: index + 1,
    })),
    annualCheckpoints: testAnnualCheckpoints(SCENARIO_V3_PREVIEW, 5, -42_000),
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
