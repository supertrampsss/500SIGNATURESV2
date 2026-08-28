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
  assert.match(html, /https:\/\/www\.budget\.gouv\.fr\/documentation\/file-download\/30583/);
});

test("un dossier garde l'analyse complète dans le tiroir et présente une tension courte", () => {
  const state = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "decision" as const };
  const decision = SCENARIO_V3_PREVIEW.decisions[0]!;
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);
  const beforeEvidence = html.slice(0, html.indexOf('<details class="simulateur-v3__evidence'));
  const evidence = html.slice(html.indexOf('<details class="simulateur-v3__evidence'));
  const escapedContext = decision.context.replaceAll("'", "&#39;");

  assert.doesNotMatch(beforeEvidence, new RegExp(decision.context.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(evidence, new RegExp(escapedContext.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(beforeEvidence, /class="simulateur-v3__context"[^>]*>[^<]{20,190}<\/p>/);
});

test("le niveau de rupture structure la scène et la date de publication reste dans le tiroir", () => {
  const index = SCENARIO_V3_PREVIEW.decisions.findIndex((decision) => decision.kind === "rupture");
  const state = {
    ...createCampaign(SCENARIO_V3_PREVIEW),
    phase: "decision" as const,
    chapterIndex: Math.floor(index / 12),
    decisionIndex: index % 12,
  };
  const decision = SCENARIO_V3_PREVIEW.decisions[index]!;
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);
  const evidenceIndex = html.indexOf('<details class="simulateur-v3__evidence');
  assert.match(html, /simulateur-v3__decision--rupture/);
  assert.doesNotMatch(html.slice(0, evidenceIndex), new RegExp(decision.evidence[0]!.publishedAt));
  assert.match(html.slice(evidenceIndex), new RegExp(`datetime="${decision.evidence[0]!.publishedAt}"`));
});

test("les choix retirent la démonstration répétée après les deux-points", () => {
  const state = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "decision" as const };
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);

  assert.match(html, /simulateur-v3__option-label">Geler le barème<\/span>/);
  assert.doesNotMatch(html, /simulateur-v3__option-label">Geler le barème de l'impôt sur le revenu \(non-indexation\)/);
});

test("aucun intitulé de choix ne redevient un paragraphe sur téléphone", () => {
  for (let index = 0; index < SCENARIO_V3_PREVIEW.decisions.length; index += 1) {
    const state = {
      ...createCampaign(SCENARIO_V3_PREVIEW),
      phase: "decision" as const,
      chapterIndex: Math.floor(index / 12),
      decisionIndex: index % 12,
    };
    const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);
    const labels = html
      .split('class="simulateur-v3__option-label">')
      .slice(1)
      .map((part) => part.split("</span>")[0]!.replaceAll("&#39;", "'"));
    assert.ok(labels.every((label) => label.length <= 86), `dossier ${index + 1}: ${labels.join(" | ")}`);
  }
});

test("un dossier desktop suit la planche EPR avec une scène centrale et un tableau compact", () => {
  const state = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "decision" as const };
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);
  assert.match(html, /class="simulateur-v3__decision-layout"/);
  assert.doesNotMatch(html, /simulateur-v3__rail/);
  assert.match(html, /class="simulateur-v3__mandate-dashboard"/);
  assert.match(html, />Finances</);
  assert.match(html, />Pays</);
  assert.match(html, />Pouvoir</);
  assert.match(html, />Confiance</);
  const dossier = html.slice(html.indexOf('class="simulateur-v3__dossier simulateur-v3__decision '));
  assert.ok(dossier.indexOf('class="simulateur-v3__mandate-dashboard"') < dossier.lastIndexOf("</article>"));
});

test("chaque choix reçoit une illustration éditoriale dans la carte cliquable", () => {
  const state = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "decision" as const };
  const decision = SCENARIO_V3_PREVIEW.decisions[0]!;
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);
  assert.equal(occurrences(html, 'class="simulateur-v3__decision-illustration'), decision.options.length);
  assert.equal(occurrences(html, 'aria-hidden="true" viewBox="0 0 180 104"'), decision.options.length);
});

test("la trajectoire des finances du tableau réagit au registre causal", () => {
  const base = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "decision" as const };
  const moved: CampaignState = {
    ...base,
    indicators: { ...base.indicators, annualBalance: base.indicators.annualBalance + 10_000 },
    causalLedger: [{
      id: "visual-budget-move",
      sourceType: "decision",
      sourceId: "flat-tax-a-20-des-le-premier:flat-tax-a-20-des-le-premier:apply",
      target: "indicator",
      key: "annualBalance",
      delta: 10_000,
      duration: "annual",
      explanation: "Mouvement de test.",
      appliedAtDecision: 1,
    }],
  };
  const points = (html: string) => html.match(/simulateur-v3__sparkline[\s\S]*?<polyline points="([^"]+)"/)?.[1];
  assert.notEqual(points(renderSimulatorV3(base, SCENARIO_V3_PREVIEW)), points(renderSimulatorV3(moved, SCENARIO_V3_PREVIEW)));
});

test("les cartes montrent les conséquences politiques essentielles avant le clic", () => {
  const state = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "decision" as const };
  const decision = SCENARIO_V3_PREVIEW.decisions[0]!;
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);
  assert.equal(occurrences(html, 'class="simulateur-v3__option-effects"'), decision.options.length);
  assert.match(html, /Opinion [+-]\d+ points?/);
});

test("une option ne répète pas mot pour mot le contexte déjà lu", () => {
  const state = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "decision" as const };
  const decision = SCENARIO_V3_PREVIEW.decisions[0]!;
  assert.notEqual(decision.options[0]!.summary, decision.context);
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);
  assert.equal(occurrences(html, 'class="simulateur-v3__option-summary"'), 2);
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

test("la barre de commandement garde le solde et une progression lisibles sur mobile", () => {
  const state = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "decision" as const };
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);

  assert.match(html, /class="simulateur-v3__command-balance"/);
  assert.match(html, /-153 milliards d&#39;euros/);
  assert.match(html, /class="simulateur-v3__command-progress"/);
  assert.match(html, /--v3-command-progress:\s*0%/);
});

test("un gain budgétaire et un coût budgétaire ne portent pas le même signal", () => {
  const state = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "decision" as const };
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);

  assert.match(html, /simulateur-v3__option-budget--positive/);
  assert.match(html, /simulateur-v3__option-budget--neutral/);
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
  assert.match(html, new RegExp(source.title.replaceAll("'", "&#39;").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, /Marchés -1 point/);
  assert.match(html, /simulateur-v3__scene-header/);
  assert.match(html, /simulateur-v3__scene-body/);
});

test("la crise expose sa cause et une concession qui modifie la réforme", () => {
  const decisionIndex = SCENARIO_V3_PREVIEW.decisions.findIndex((candidate) => candidate.id === "flat-tax-a-20-des-le-premier");
  const fresh = createCampaign(SCENARIO_V3_PREVIEW);
  const base = {
    ...fresh,
    phase: "decision" as const,
    decisionIndex,
    decisions: SCENARIO_V3_PREVIEW.decisions.slice(0, decisionIndex).map((previous, index) => ({
      decisionId: previous.id, optionId: previous.options.at(-1)!.id, status: "confirmed" as const, confirmedAtIndex: index + 1,
    })),
  };
  const decision = SCENARIO_V3_PREVIEW.decisions[decisionIndex]!;
  const confirmed = confirmSelection(selectOption(base, SCENARIO_V3_PREVIEW, decision.id, decision.options[0]!.id), SCENARIO_V3_PREVIEW);
  const crisis = detectCrisis(confirmed, SCENARIO_V3_CRISIS_RULES);
  const html = renderSimulatorV3(crisis, SCENARIO_V3_PREVIEW, { crisisRules: SCENARIO_V3_CRISIS_RULES });
  assert.match(html, /Le pays se fracture sur/);
  assert.match(html, new RegExp(decision.title.replaceAll("'", "&#39;").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, /Suspendre la flat tax/);
  assert.equal(occurrences(html, 'data-v3-action="resolve-crisis"'), 2);
  assert.match(html, /class="simulateur-v3__crisis-visual"/);
  assert.match(html, /simulateur-v3__scene-header/);
  assert.match(html, /simulateur-v3__scene-body/);
});

test("la fin de chapitre raconte les choix et la contradiction laissée ouverte", () => {
  const html = renderSimulatorV3(stateAfter(12, "chapter_verdict"), SCENARIO_V3_PREVIEW);
  assert.match(html, /Le pays vous présente l'addition/);
  assert.match(html, /Impôts, patrimoine et transmission/);
  assert.match(html, /12 décisions/);
  assert.match(html, /Contradiction ouverte/);
  assert.equal(occurrences(html, 'data-v3-action="continue"'), 1);
  assert.match(html, /simulateur-v3__scene-header/);
  assert.match(html, /simulateur-v3__scene-body/);
});

test("le verdict final devient une scène éditoriale sans grille générique", () => {
  const state = stateAfter(96, "verdict");
  state.crisisHistory = [{
    ruleId: "flat-tax-revolt", triggeredByDecisionId: state.decisions[0]!.decisionId,
    aggravatingDecisionIds: [state.decisions[0]!.decisionId], resolvedBy: "suspend-flat-tax",
  }];
  state.decisions[0] = { ...state.decisions[0]!, status: "suspended" };
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW, { crisisRules: SCENARIO_V3_CRISIS_RULES });
  assert.match(html, /simulateur-v3__verdict-hero/);
  assert.match(html, /simulateur-v3__verdict-signals/);
  assert.match(html, /simulateur-v3__verdict-trajectory/);
  assert.match(html, /simulateur-v3__verdict-choices/);
  assert.match(html, /simulateur-v3__verdict-aftermath/);
  assert.match(html, /96 arbitrages/);
  assert.match(html, /1 crise traversée/);
  assert.match(html, /1 réforme modifiée sous pression/);
  assert.doesNotMatch(html, /simulateur-v3__situation-grid/);
  assert.doesNotMatch(html, /[\u2013\u2014]/u);
  assert.equal(occurrences(html, 'data-v3-action="share-verdict"'), 1);
  assert.equal(occurrences(html, 'data-v3-action="restart"'), 1);
  assert.match(html, /href="\/bilan"/);
  assert.doesNotMatch(html, /data-v3-action="pause"/);
});

test("le verdict ne répète pas les questions dans les trois choix décisifs", () => {
  const state = stateAfter(96, "verdict");
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);
  const firstDecision = SCENARIO_V3_PREVIEW.decisions[0]!;
  const firstOption = firstDecision.options[0]!;

  if (html.includes(firstOption.label)) {
    assert.equal(occurrences(html, firstOption.label), 1);
  }
  assert.doesNotMatch(html, /Les trois gestes qui ont le plus pesé/);
});

test("le journal de Pause liste les arbitrages et leur statut", () => {
  const state = stateAfter(2, "pause");
  state.decisions[0] = { ...state.decisions[0]!, status: "suspended", changedByCrisisId: "flat-tax-revolt" };
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW, { pauseView: "journal" });
  assert.match(html, /Journal du mandat/);
  assert.match(html, /Suspendue après une crise/);
  assert.equal(occurrences(html, 'data-v3-action="back-pause"'), 1);
  assert.match(html, /simulateur-v3__scene-header/);
  assert.match(html, /simulateur-v3__scene-body/);
});
