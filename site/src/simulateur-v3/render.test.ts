import assert from "node:assert/strict";
import test from "node:test";

import { selectOption } from "./campaign.ts";
import { detectCrisis } from "./crises.ts";
import { confirmSelection } from "./effects.ts";
import { formatV3Amount, renderSimulatorV3 } from "./render.ts";
import { SCENARIO_V3_CRISIS_RULES } from "./scenario-crises.ts";
import { SCENARIO_V3_PREVIEW } from "./scenario.ts";
import { SCENARIO_V9 } from "./scenario-v9.ts";
import { SCENARIO_V10 } from "./scenario-v10.ts";
import { createTestCampaign as createCampaign } from "./test-fixtures.ts";
import type { CampaignState, EffectRule } from "./types.ts";
import { positionAfterCompleted, positionBeforeNext } from "./validation.ts";

function occurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

function closedOptionButtons(html: string): string[] {
  return html
    .split('class="simulateur-v3__option-select"')
    .slice(1)
    .map((part) => part.slice(0, part.indexOf("</button>")));
}

function escapedHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

test("les montants utilisent le singulier quand il le faut", () => {
  assert.equal(formatV3Amount(1_200), "+1 milliard d'euros");
  assert.equal(formatV3Amount(-1), "-1 million d'euros");
  assert.equal(formatV3Amount(12_000), "+12 milliards d'euros");
});

function stateAfter(count: number, phase: CampaignState["phase"]): CampaignState {
  const base = createCampaign(SCENARIO_V3_PREVIEW);
  const position = positionAfterCompleted(SCENARIO_V3_PREVIEW, count)
    ?? positionBeforeNext(SCENARIO_V3_PREVIEW, count)!;
  return {
    ...base,
    phase,
    ...position,
    decisions: SCENARIO_V3_PREVIEW.decisions.slice(0, count).map((decision, index) => ({
      decisionId: decision.id,
      optionId: decision.options[0]!.id,
      status: "confirmed",
      confirmedAtIndex: index + 1,
    })),
  };
}

test("le verdict V9 historique reste rendu après le chargement du scénario V10", () => {
  assert.equal(SCENARIO_V10.version, 10);
  const decisions = SCENARIO_V9.decisions.map((decision, index) => ({
    decisionId: decision.id,
    optionId: decision.options[0]!.id,
    status: "confirmed" as const,
    confirmedAtIndex: index + 1,
  }));
  const state = {
    ...createCampaign(SCENARIO_V9),
    phase: "verdict" as const,
    chapterIndex: SCENARIO_V9.chapters.length - 1,
    decisionIndex: SCENARIO_V9.chapters.at(-1)!.decisionIds.length - 1,
    decisions,
  };
  assert.match(renderSimulatorV3(state, SCENARIO_V9), /verdict/i);
});

test("l'entrée en fonction annonce la mission et un seul départ", () => {
  const html = renderSimulatorV3(createCampaign(SCENARIO_V3_PREVIEW), SCENARIO_V3_PREVIEW);
  assert.match(html, /153 milliards d&#39;euros/);
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
    ...positionBeforeNext(SCENARIO_V3_PREVIEW, index)!,
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

  assert.match(html, /simulateur-v3__option-label"[^>]*>Geler le barème<\/span>/);
  assert.doesNotMatch(html, /simulateur-v3__option-label"[^>]*>Geler le barème de l'impôt sur le revenu \(non-indexation\)/);
});

test("aucun intitulé de choix ne redevient un paragraphe sur téléphone", () => {
  for (let index = 0; index < SCENARIO_V3_PREVIEW.decisions.length; index += 1) {
    const state = {
      ...createCampaign(SCENARIO_V3_PREVIEW),
      phase: "decision" as const,
      ...positionBeforeNext(SCENARIO_V3_PREVIEW, index)!,
    };
    const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);
    const labels = html
      .split('class="simulateur-v3__option-label">')
      .slice(1)
      .map((part) => part.split("</span>")[0]!.replaceAll("&#39;", "'"));
    assert.ok(labels.every((label) => label.length <= 86), `dossier ${index + 1}: ${labels.join(" | ")}`);
  }
});

test("un dossier garde une scène centrale sans répéter le tableau complet du mandat", () => {
  const state = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "decision" as const };
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);
  assert.match(html, /class="simulateur-v3__decision-layout"/);
  assert.doesNotMatch(html, /simulateur-v3__rail/);
  assert.doesNotMatch(html, /class="simulateur-v3__mandate-dashboard"/);
});

test("aucun choix ne reçoit une illustration ou un SVG décoratif", () => {
  const state = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "decision" as const };
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);
  assert.doesNotMatch(html, /simulateur-v3__decision-illustration|<svg/);
});

test("la trajectoire des finances reste disponible au Conseil, pas dans chaque décision", () => {
  const base = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "council" as const };
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

test("chaque carte expose le résumé complet, le budget et un impact principal en pilule", () => {
  const state = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "decision" as const };
  const decision = SCENARIO_V3_PREVIEW.decisions[0]!;
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);
  const buttons = closedOptionButtons(html);
  assert.equal(buttons.length, decision.options.length);
  for (const button of buttons) {
    assert.equal(occurrences(button, "data-v3-fact="), 4);
    assert.equal(occurrences(button, 'data-v3-fact="name"'), 1);
    assert.equal(occurrences(button, 'data-v3-fact="summary"'), 1);
    assert.equal(occurrences(button, 'data-v3-fact="budget"'), 1);
    assert.equal(occurrences(button, 'data-v3-fact="impact"'), 1);
    assert.equal(occurrences(button, 'data-v3-fact="risk"'), 0);
    assert.equal(occurrences(button, "aria-labelledby="), 1);
    const labelledBy = button.match(/aria-labelledby="([^"]+)"/)?.[1];
    const describedBy = button.match(/aria-describedby="([^"]+)"/)?.[1]?.split(" ") ?? [];
    assert.ok(labelledBy);
    assert.equal(describedBy.length, 3);
    for (const id of [labelledBy, ...describedBy]) {
      assert.equal(occurrences(button, `id="${id}"`), 1, `référence accessible absente : ${id}`);
    }
    assert.match(button, /simulateur-v3__option-summary/);
    assert.match(button, /simulateur-v3__option-impact-pill/);
    assert.doesNotMatch(button, /Incertitude|simulateur-v3__option-confidence/);
    assert.doesNotMatch(button, /Mécanisme|Bénéficiaires|Contributeurs/);
  }
});

test("l'impact principal est unique, priorisé par INDICATOR_META et garde son échéance", () => {
  const scenario = structuredClone(SCENARIO_V3_PREVIEW);
  const option = scenario.decisions[0]!.options[0]!;
  option.horizon = { kind: "immediate" };
  option.effects = [{
    id: "delayed-opinion",
    target: "indicator",
    key: "opinion",
    delta: -2,
    timing: { kind: "after_decisions", count: 2 },
    duration: "once",
    explanation: "La réforme divise.",
  }, {
    id: "delayed-investment",
    target: "indicator",
    key: "investment",
    delta: 4,
    timing: { kind: "mandate_year", year: 3 } as EffectRule["timing"],
    duration: "once",
    explanation: "Les commandes deviennent visibles.",
  }] as typeof option.effects;
  const state = { ...createCampaign(scenario), phase: "decision" as const };
  const html = renderSimulatorV3(state, scenario);
  const firstButton = closedOptionButtons(html)[0]!;

  assert.match(firstButton, />Investissement \+4 · an 3</);
  assert.match(firstButton, /aria-label="Investissement \+4 points d&#39;indice · année 3"/);
  assert.doesNotMatch(firstButton, /Opinion -2 points d&#39;indice/);
  assert.equal(occurrences(firstButton, 'data-v3-fact="impact"'), 1);
});

test("le résumé complet de chaque option est visible sans troncature ni détail", () => {
  const state = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "decision" as const };
  const decision = SCENARIO_V3_PREVIEW.decisions[0]!;
  assert.notEqual(decision.options[0]!.summary, decision.context);
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);
  assert.equal(occurrences(html, 'class="simulateur-v3__option-summary"'), decision.options.length);
  for (const option of decision.options) {
    assert.ok(html.includes(escapedHtml(option.summary)));
  }
  assert.doesNotMatch(html, /…/);
  assert.doesNotMatch(html, /simulateur-v3__option-detail|data-v3-action="confirm"|data-v3-action="modify"/);
});

test("les cartes sont des actions directes sans état de présélection", () => {
  const state = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "decision" as const };
  const decision = SCENARIO_V3_PREVIEW.decisions[0]!;
  const initial = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);
  assert.equal(occurrences(initial, 'data-v3-action="select"'), decision.options.length);
  assert.equal(occurrences(initial, 'aria-pressed='), 0);
  assert.doesNotMatch(initial, /data-v3-action="confirm"|data-v3-action="modify"/);
});

test("le résultat confirmé reste lisible et causal jusqu'à une continuation explicite", () => {
  const base = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "decision" as const };
  const decision = SCENARIO_V3_PREVIEW.decisions[0]!;
  const confirmed = confirmSelection(selectOption(base, SCENARIO_V3_PREVIEW, decision.id, decision.options[0]!.id), SCENARIO_V3_PREVIEW);
  const html = renderSimulatorV3(confirmed, SCENARIO_V3_PREVIEW);
  assert.match(html, /Décision enregistrée/);
  assert.ok(html.includes(escapedHtml(decision.options[0]!.mechanism)));
  assert.match(html, /class="[^"]*simulateur-v3__result[^"]*" aria-live="polite"/);
  assert.match(html, /Avant[\s\S]*-153 milliards d&#39;euros[\s\S]*Après[\s\S]*-151 milliards d&#39;euros/);
  assert.equal(occurrences(html, 'data-v3-action="continue"'), 1);
  assert.match(html, /Dossier suivant/);
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
    assert.match(html, /Dossier 1 sur 60/);
    assert.doesNotMatch(html, /\u2014/);
  }
});

test("la barre de commandement garde le solde et une progression lisibles sur mobile", () => {
  const state = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "decision" as const };
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);

  assert.match(html, /class="simulateur-v3__command-balance"/);
  assert.match(html, /-153 milliards d&#39;euros/);
  assert.match(html, /class="simulateur-v3__command-progress"/);
  assert.match(html, /role="progressbar"[^>]*aria-valuenow="0"/);
  assert.match(html, /--v3-command-progress:\s*0%/);
});

test("la barre de commandement calcule sa progression sur les 60 dossiers", () => {
  const html = renderSimulatorV3(stateAfter(30, "pause"), SCENARIO_V3_PREVIEW);

  assert.match(html, /Dossier 30 sur 60/);
  assert.match(html, /--v3-command-progress:\s*50%/);
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
  assert.match(html, /Crédibilité financière -1 point/);
  assert.match(html, /simulateur-v3__scene-header/);
  assert.match(html, /simulateur-v3__scene-body/);
});

test("les conséquences dues à la décision 60 sont groupées par source sans fausse attribution", () => {
  const state = stateAfter(60, "delayed_event");
  const sources = SCENARIO_V3_PREVIEW.decisions.slice(-6);
  const effectCounts = [6, 5, 5, 5, 5, 5];
  state.scheduledEvents = sources.flatMap((source, sourceIndex) => Array.from({ length: effectCounts[sourceIndex]! }, (_, effectIndex) => ({
    id: `event-${sourceIndex}-${effectIndex}`,
    sourceDecisionId: source.id,
    sourceOptionId: source.options[0]!.id,
    dueAtDecision: 60,
    title: `Échéance ${sourceIndex + 1}`,
    body: `Conséquence ${effectIndex + 1} de ${source.title}`,
    effects: [{
      id: `effect-${sourceIndex}-${effectIndex}`,
      target: "indicator" as const,
      key: "opinion" as const,
      delta: -(effectIndex + 1),
      timing: { kind: "immediate" as const },
      duration: "once" as const,
      explanation: `Effet ${effectIndex + 1}`,
    }],
  })));

  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);
  assert.equal(occurrences(html, 'data-v3-event-group="'), sources.length);
  assert.equal(occurrences(html, 'data-v3-event-group-visible="true"'), 4);
  assert.match(html, /Voir 2 autres conséquences/);
  for (const source of sources) {
    assert.equal(occurrences(html, `data-v3-event-group="${source.id}:${source.options[0]!.id}:60"`), 1);
    assert.match(html, new RegExp(source.title.replaceAll("'", "&#39;").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.equal(occurrences(html, "<span>Conséquence "), 31);
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
  const crisis = detectCrisis(
    { ...confirmed, indicators: { ...confirmed.indicators, opinion: 39 } },
    SCENARIO_V3_PREVIEW,
    SCENARIO_V3_CRISIS_RULES,
  );
  const html = renderSimulatorV3(crisis, SCENARIO_V3_PREVIEW, { crisisRules: SCENARIO_V3_CRISIS_RULES });
  assert.match(html, /Le pays se fracture sur/);
  assert.match(html, new RegExp(decision.title.replaceAll("'", "&#39;").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, /Suspendre la flat tax/);
  assert.equal(occurrences(html, 'data-v3-action="resolve-crisis"'), 2);
  assert.doesNotMatch(html, /simulateur-v3__crisis-visual|<svg/);
  assert.match(html, /simulateur-v3__scene-header/);
  assert.match(html, /simulateur-v3__scene-body/);
});

test("aucune scène ne présente une addition de fin de chapitre", () => {
  const html = renderSimulatorV3(stateAfter(8, "chapter_verdict"), SCENARIO_V3_PREVIEW);
  assert.doesNotMatch(html, /Le pays vous présente l'addition|Contradiction ouverte|Ouvrir le chapitre suivant/);
  assert.doesNotMatch(html, /simulateur-v3__chapter-verdict/);
});

test("le verdict final devient une scène éditoriale sans grille générique", () => {
  const state = stateAfter(60, "verdict");
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
  assert.match(html, /60 arbitrages/);
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
  const state = stateAfter(60, "verdict");
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW);
  const firstDecision = SCENARIO_V3_PREVIEW.decisions[0]!;
  const firstOption = firstDecision.options[0]!;

  if (html.includes(firstOption.label)) {
    assert.equal(occurrences(html, firstOption.label), 1);
  }
  assert.doesNotMatch(html, /Les trois gestes qui ont le plus pesé/);
});

test("le journal de Pause groupe les arbitrages par chapitre et année sans les perdre", () => {
  const state = stateAfter(2, "pause");
  state.decisions[0] = { ...state.decisions[0]!, status: "suspended", changedByCrisisId: "flat-tax-revolt" };
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW, { pauseView: "journal" });
  assert.match(html, /Journal du mandat/);
  assert.match(html, /Suspendue après une crise/);
  assert.equal(occurrences(html, 'class="simulateur-v3__journal-group"'), 1);
  assert.equal(occurrences(html, 'class="simulateur-v3__journal-decision"'), 2);
  assert.match(html, /année 1/);
  assert.equal(occurrences(html, 'data-v3-action="back-pause"'), 1);
  assert.match(html, /simulateur-v3__scene-header/);
  assert.match(html, /simulateur-v3__scene-body/);
});

test("le journal complet contient 60 lignes dans huit groupes repliables", () => {
  const html = renderSimulatorV3(stateAfter(60, "pause"), SCENARIO_V3_PREVIEW, { pauseView: "journal" });
  assert.equal(occurrences(html, 'class="simulateur-v3__journal-group"'), 8);
  assert.equal(occurrences(html, 'class="simulateur-v3__journal-decision"'), 60);
  assert.doesNotMatch(html, /simulateur-v3__journal-list/);
});

test("le journal vide explique son état et offre une sortie", () => {
  const state = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "pause" as const };
  const html = renderSimulatorV3(state, SCENARIO_V3_PREVIEW, { pauseView: "journal" });
  assert.match(html, /Aucune décision enregistrée/);
  assert.match(html, /class="simulateur-v3__empty-state"/);
  assert.equal(occurrences(html, 'data-v3-action="back-pause"'), 1);
});
