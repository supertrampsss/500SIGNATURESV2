import assert from "node:assert/strict";
import test from "node:test";

import { createCampaign, selectOption } from "./campaign.ts";
import { detectCrisis } from "./crises.ts";
import { confirmSelection } from "./effects.ts";
import { formatV3Amount, renderSimulatorV3 } from "./render.ts";
import { SCENARIO_V3_CRISIS_RULES } from "./scenario-crises.ts";
import { SCENARIO_V3_PREVIEW } from "./scenario.ts";
import type { CampaignState } from "./types.ts";

function occurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

test("les montants utilisent le singulier quand il le faut", () => {
  assert.equal(formatV3Amount(1_200), "+1 milliard d'euros");
  assert.equal(formatV3Amount(-1), "-1 million d'euros");
  assert.equal(formatV3Amount(12_000), "+12 milliards d'euros");
});

function stateAfter(count: number, phase: CampaignState["phase"]): CampaignState {
  const base = createCampaign(SCENARIO_V3_PREVIEW);
  return {
    ...base,
    phase,
    chapterIndex: Math.min(7, Math.floor(Math.max(0, count - 1) / 12)),
    decisionIndex: Math.min(11, Math.max(0, count - 1) % 12),
    decisions: SCENARIO_V3_PREVIEW.decisions.slice(0, count).map((decision, index) => ({
      decisionId: decision.id,
      optionId: decision.options[0]!.id,
      status: "confirmed",
      confirmedAtIndex: index + 1,
    })),
  };
}

test("l'entrée en fonction annonce la mission et un seul départ", () => {
  const html = renderSimulatorV3(createCampaign(SCENARIO_V3_PREVIEW), SCENARIO_V3_PREVIEW);
  assert.match(html, /153 milliards d'euros/);
  assert.equal(occurrences(html, 'data-v3-action="start"'), 1);
  assert.match(html, /Prendre mes fonctions/);
  assert.match(html, /href="\/bilan"/);
  assert.doesNotMatch(html, /data-v3-action="pause"/);
});

test("l'introduction de chapitre montre les quatre domaines", () => {
  const state = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "chapter_intro" as const };
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);
  const chapter = SCENARIO_V3_PREVIEW.chapters[0]!;
  for (const domain of chapter.domains) assert.match(html, new RegExp(domain));
  assert.equal(occurrences(html, 'data-v3-action="open-chapter"'), 1);
});

test("un dossier rend une carte cliquable par option sans rangée d'actions dupliquée", () => {
  const state = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "decision" as const };
  const decision = SCENARIO_V3_PREVIEW.decisions[0]!;
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);
  assert.equal(occurrences(html, 'data-v3-action="select"'), decision.options.length);
  assert.doesNotMatch(html, /actions-fixes|Adopter\s*[|/]\s*Rejeter/i);
  assert.match(html, /<details class="simulateur-v3__evidence"/);
  assert.match(html, /https:\/\/plateforme-9sz\.pages\.dev\/sources\//);
});

test("une option ne répète pas mot pour mot le contexte déjà lu", () => {
  const state = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "decision" as const };
  const decision = SCENARIO_V3_PREVIEW.decisions[0]!;
  assert.equal(decision.options[0]!.summary, decision.context);
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);
  assert.equal(occurrences(html, 'class="simulateur-v3__option-summary"'), 1);
});

test("les cartes tranchent directement sans confirmation intermédiaire", () => {
  const state = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "decision" as const };
  const decision = SCENARIO_V3_PREVIEW.decisions[0]!;
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);
  assert.equal(occurrences(html, 'data-v3-action="select"'), decision.options.length);
  assert.equal(occurrences(html, 'aria-label="Choisir :'), decision.options.length);
  assert.doesNotMatch(html, /data-v3-action="confirm"|data-v3-action="cancel"|aria-pressed/);
});

test("l'état technique de résultat ne produit aucun écran de validation", () => {
  const base = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "decision" as const };
  const decision = SCENARIO_V3_PREVIEW.decisions[0]!;
  const confirmed = confirmSelection(selectOption(base, SCENARIO_V3_PREVIEW, decision.id, decision.options[0]!.id), SCENARIO_V3_PREVIEW);
  const html = renderSimulatorV3(confirmed, SCENARIO_V3_PREVIEW);
  assert.doesNotMatch(html, /Décision actée|Continuer le mandat|data-v3-action="continue"/);
});

test("chaque phase rend la barre de commandement sans cadratin", () => {
  const base = createCampaign(SCENARIO_V3_PREVIEW);
  const phases = [
    base,
    { ...base, phase: "chapter_intro" as const },
    { ...base, phase: "decision" as const },
    { ...base, phase: "pause" as const },
  ];
  for (const state of phases) {
    const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);
    assert.match(html, /simulateur-v3__command-bar/);
    assert.match(html, /Chapitre 1 sur 8/);
    assert.match(html, /Dossier 1 sur 96/);
    assert.doesNotMatch(html, /\u2014/);
  }
});

test("une conséquence différée rappelle la décision d'origine et ses effets", () => {
  const state = stateAfter(4, "delayed_event");
  const source = SCENARIO_V3_PREVIEW.decisions[2]!;
  state.scheduledEvents = [{
    id: "event-visible", sourceDecisionId: source.id, sourceOptionId: source.options[0]!.id,
    dueAtDecision: 4, title: "Les recettes résistent", body: "Le rendement devient plus incertain.",
    effects: [{
      id: "effect-visible", target: "indicator", key: "financialCredibility", delta: -1,
      timing: { kind: "immediate" }, duration: "once", explanation: "Les marchés réévaluent le rendement.",
    }],
  }];
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);
  assert.match(html, /Les recettes résistent/);
  assert.match(html, new RegExp(source.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, /Marchés -1 point/);
});

test("la crise expose sa cause et une concession qui modifie la réforme", () => {
  const base = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "decision" as const };
  const decision = SCENARIO_V3_PREVIEW.decisions[0]!;
  const confirmed = confirmSelection(selectOption(base, SCENARIO_V3_PREVIEW, decision.id, decision.options[0]!.id), SCENARIO_V3_PREVIEW);
  const crisis = detectCrisis(confirmed, SCENARIO_V3_CRISIS_RULES);
  const html = renderSimulatorV3(crisis, SCENARIO_V3_PREVIEW, { crisisRules: SCENARIO_V3_CRISIS_RULES });
  assert.match(html, /Le pays se fracture sur/);
  assert.match(html, new RegExp(decision.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, /Suspendre la flat tax/);
  assert.equal(occurrences(html, 'data-v3-action="resolve-crisis"'), 2);
});

test("la fin de chapitre raconte les choix et la contradiction laissée ouverte", () => {
  const html = renderSimulatorV3(stateAfter(12, "chapter_verdict"), SCENARIO_V3_PREVIEW);
  assert.match(html, /Le pays vous présente l'addition/);
  assert.match(html, /Impôts, patrimoine et transmission/);
  assert.match(html, /12 décisions/);
  assert.match(html, /Contradiction ouverte/);
  assert.equal(occurrences(html, 'data-v3-action="continue"'), 1);
});

test("le verdict final raconte le mandat et permet une revanche", () => {
  const state = stateAfter(96, "verdict");
  state.crisisHistory = [{
    ruleId: "flat-tax-revolt", triggeredByDecisionId: state.decisions[0]!.decisionId,
    aggravatingDecisionIds: [state.decisions[0]!.decisionId], resolvedBy: "suspend-flat-tax",
  }];
  state.decisions[0] = { ...state.decisions[0]!, status: "suspended" };
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);
  assert.match(html, /Votre mandat/);
  assert.match(html, /96 arbitrages/);
  assert.match(html, /1 crise/);
  assert.match(html, /1 réforme abandonnée sous pression/);
  assert.equal(occurrences(html, 'data-v3-action="restart"'), 1);
  assert.doesNotMatch(html, /data-v3-action="pause"/);
});

test("le journal de Pause liste les arbitrages et leur statut", () => {
  const state = stateAfter(2, "pause");
  state.decisions[0] = { ...state.decisions[0]!, status: "suspended", changedByCrisisId: "flat-tax-revolt" };
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW, { pauseView: "journal" });
  assert.match(html, /Journal du mandat/);
  assert.match(html, /Suspendue après une crise/);
  assert.equal(occurrences(html, 'data-v3-action="back-pause"'), 1);
});
