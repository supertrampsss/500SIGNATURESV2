import assert from "node:assert/strict";
import test from "node:test";

import { createCampaign, selectOption } from "./campaign.ts";
import { confirmSelection } from "./effects.ts";
import { renderSimulatorV3 } from "./render.ts";
import { SCENARIO_V3_PREVIEW } from "./scenario.ts";

function occurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

test("l'entrée en fonction annonce la mission et un seul départ", () => {
  const html = renderSimulatorV3(createCampaign(SCENARIO_V3_PREVIEW), SCENARIO_V3_PREVIEW);
  assert.match(html, /153 milliards d'euros/);
  assert.equal(occurrences(html, 'data-v3-action="start"'), 1);
  assert.match(html, /Prendre mes fonctions/);
  assert.match(html, /href="\/bilan"/);
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

test("la confirmation vit dans la carte sélectionnée", () => {
  const base = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "decision" as const };
  const decision = SCENARIO_V3_PREVIEW.decisions[0]!;
  const option = decision.options[0]!;
  const selected = selectOption(base, SCENARIO_V3_PREVIEW, decision.id, option.id);
  const html = renderSimulatorV3(selected, SCENARIO_V3_PREVIEW);
  assert.match(html, /aria-pressed="true"/);
  assert.equal(occurrences(html, 'data-v3-action="confirm"'), 1);
  assert.equal(occurrences(html, 'data-v3-action="cancel"'), 1);
  const cardStart = html.indexOf(`data-option-id="${option.id}"`);
  const cardEnd = html.indexOf("</article>", cardStart);
  const confirmation = html.indexOf('data-v3-action="confirm"');
  assert.ok(cardStart >= 0 && confirmation > cardStart && confirmation < cardEnd);
});

test("le retour de décision reste à l'écran jusqu'à Continuer", () => {
  const base = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "decision" as const };
  const decision = SCENARIO_V3_PREVIEW.decisions[0]!;
  const option = decision.options[0]!;
  const selected = selectOption(base, SCENARIO_V3_PREVIEW, decision.id, option.id);
  const confirmed = confirmSelection(selected, SCENARIO_V3_PREVIEW);
  const html = renderSimulatorV3(confirmed, SCENARIO_V3_PREVIEW);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, new RegExp(option.label));
  assert.equal(occurrences(html, 'data-v3-action="continue"'), 1);
  assert.match(html, /Opinion -20 points/);
  assert.match(html, /Entreprises \+4 points/);
  assert.doesNotMatch(html, /Réaction simulée|Aucune conséquence différée/);
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
