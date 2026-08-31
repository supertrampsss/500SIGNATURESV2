import assert from "node:assert/strict";
import { test } from "node:test";

import {
  advanceAfterResult,
  clearSelection,
  currentDecision,
  normalizeChapterTransition,
  selectOption,
} from "./campaign.ts";
import { createCampaign as createProductionCampaign } from "./campaign.ts";
import { confirmSelection } from "./effects.ts";
import { SCENARIO_V3 } from "./scenario.ts";
import { createTestCampaign as createCampaign, testBaseline, validScenario } from "./test-fixtures.ts";
import { positionAfterCompleted, positionBeforeNext, totalDecisions } from "./validation.ts";

test("une campagne neuve commence avant le premier chapitre", () => {
  const state = createCampaign(validScenario(), 42);
  assert.equal(state.schemaVersion, 5);
  assert.deepEqual(state.baseline, testBaseline());
  assert.deepEqual(state.annualCheckpoints, []);
  assert.equal(state.seed, 42);
  assert.equal(state.phase, "intro");
  assert.equal(state.decisions.length, 0);
  assert.equal(state.savedAt, "1970-01-01T00:00:00.000Z");
  assert.notEqual(state.indicators, createCampaign(validScenario()).indicators);
  assert.notEqual(state.groups, createCampaign(validScenario()).groups);
});

test("une campagne neuve exige une baseline explicite", () => {
  const withoutBaseline = createProductionCampaign as unknown as (scenario: ReturnType<typeof validScenario>) => unknown;
  assert.throws(() => withoutBaseline(validScenario()), /baseline/i);
});

test("la décision courante suit les huit chapitres dans leur ordre éditorial", () => {
  const scenario = validScenario();
  const state = { ...createCampaign(scenario, 42), phase: "decision" as const };
  assert.equal(currentDecision(state, scenario)?.id, scenario.chapters[0]!.decisionIds[0]);
});

test("le passage de chapitre suit les longueurs 8 puis 7", () => {
  assert.deepEqual(positionAfterCompleted(SCENARIO_V3, 8), { chapterIndex: 0, decisionIndex: 7 });
  assert.deepEqual(positionBeforeNext(SCENARIO_V3, 8), { chapterIndex: 1, decisionIndex: 0 });
  assert.deepEqual(positionBeforeNext(SCENARIO_V3, 53), { chapterIndex: 7, decisionIndex: 0 });
  assert.equal(totalDecisions(SCENARIO_V3), 60);
});

test("sélectionner ne confirme pas et peut être annulé", () => {
  const scenario = validScenario();
  const started = { ...createCampaign(scenario), phase: "decision" as const };
  const selected = selectOption(started, scenario, "decision-1", "decision-1-option-a");
  assert.deepEqual(selected.pendingSelection, { decisionId: "decision-1", optionId: "decision-1-option-a" });
  assert.equal(selected.decisions.length, 0);
  assert.equal(clearSelection(selected).pendingSelection, undefined);
  assert.equal(started.pendingSelection, undefined);
});

test("les passages après résultat respectent les jalons du chapitre et de la campagne", () => {
  const scenario = SCENARIO_V3;
  const cases = [
    [4, "decision", 0, 4],
    [8, "chapter_intro", 1, 0],
    [16, "chapter_intro", 2, 0],
    [39, "chapter_intro", 5, 0],
    [53, "chapter_intro", 7, 0],
    [60, "verdict", 7, 6],
  ] as const;
  const editorialOrder = scenario.chapters.flatMap((chapter) => chapter.decisionIds)
    .map((id) => scenario.decisions.find((decision) => decision.id === id)!);
  for (const [count, phase, expectedChapterIndex, expectedDecisionIndex] of cases) {
    const position = positionAfterCompleted(scenario, count)!;
    const state = {
      ...createCampaign(scenario),
      phase: "decision_result" as const,
      ...position,
      decisions: Array.from({ length: count }, (_, index) => ({
        decisionId: editorialOrder[index]!.id,
        optionId: editorialOrder[index]!.options[0]!.id,
        status: "confirmed" as const,
        confirmedAtIndex: index + 1,
      })),
    };
    const advanced = advanceAfterResult(state, scenario);
    assert.deepEqual(
      { phase: advanced.phase, chapterIndex: advanced.chapterIndex, decisionIndex: advanced.decisionIndex },
      { phase, chapterIndex: expectedChapterIndex, decisionIndex: expectedDecisionIndex },
    );
  }
});

test("un dossier verrouillé est classé sans objet et n'est jamais présenté", () => {
  const scenario = validScenario();
  const first = scenario.decisions[0]!;
  const started = { ...createCampaign(scenario), phase: "decision" as const };
  const confirmed = confirmSelection(selectOption(started, scenario, first.id, first.options[0]!.id), scenario);
  const withLockedNext = { ...confirmed, lockedDecisionIds: [scenario.decisions[1]!.id] };

  const next = advanceAfterResult(withLockedNext, scenario);

  assert.equal(next.phase, "decision");
  assert.equal(next.decisionIndex, 2);
  assert.equal(next.decisions[1]?.decisionId, scenario.decisions[1]!.id);
  assert.equal(next.decisions[1]?.status, "superseded");
  assert.deepEqual(next.lockedDecisionIds, []);
  assert.equal(currentDecision(next, scenario)?.id, scenario.decisions[2]!.id);
});

test("la douzième décision ouvre directement le chapitre suivant", () => {
  const scenario = validScenario();
  const state = {
    ...createCampaign(scenario),
    phase: "decision_result" as const,
    chapterIndex: 0,
    decisionIndex: 11,
    decisions: scenario.decisions.slice(0, 12).map((decision, index) => ({
      decisionId: decision.id,
      optionId: decision.options[0]!.id,
      status: "confirmed" as const,
      confirmedAtIndex: index + 1,
    })),
  };
  const intro = advanceAfterResult(state, scenario);
  assert.deepEqual({ phase: intro.phase, chapterIndex: intro.chapterIndex, decisionIndex: intro.decisionIndex }, {
    phase: "chapter_intro", chapterIndex: 1, decisionIndex: 0,
  });
  assert.equal(advanceAfterResult(intro, scenario).phase, "decision");
});

test("une sauvegarde historique au verdict de chapitre avance sans écran intermédiaire", () => {
  const scenario = validScenario();
  const legacy = {
    ...createCampaign(scenario),
    phase: "chapter_verdict" as const,
    chapterIndex: 0,
    decisionIndex: 11,
  };
  const next = normalizeChapterTransition(legacy, scenario);
  assert.deepEqual({ phase: next.phase, chapterIndex: next.chapterIndex, decisionIndex: next.decisionIndex }, {
    phase: "chapter_intro", chapterIndex: 1, decisionIndex: 0,
  });
});

test("les sélections invalides sont refusées", () => {
  const scenario = validScenario();
  const state = createCampaign(scenario);
  assert.throws(() => selectOption(state, scenario, "decision-1", "decision-1-option-a"), /outside phase decision/);
  const deciding = { ...state, phase: "decision" as const };
  assert.throws(() => selectOption({ ...deciding, lockedDecisionIds: ["decision-1"] }, scenario, "decision-1", "decision-1-option-a"), /locked decision/);
});

test("une décision inconnue ou non courante est refusée", () => {
  const scenario = validScenario();
  const state = { ...createCampaign(scenario), phase: "decision" as const };
  assert.throws(() => selectOption(state, scenario, "unknown", "decision-1-option-a"), /Unknown decision ID/);
  assert.throws(() => selectOption(state, scenario, "decision-2", "decision-2-option-a"), /not the current decision/);
});

test("une option inconnue est refusée", () => {
  const scenario = validScenario();
  const state = { ...createCampaign(scenario), phase: "decision" as const };
  assert.throws(() => selectOption(state, scenario, "decision-1", "unknown"), /Unknown option ID/);
});

test("une campagne rejette un scénario invalide", () => {
  const scenario = validScenario();
  scenario.chapters.pop();
  assert.throws(() => createCampaign(scenario), /expected-once-in-chapters/);
});

test("une décision confirmée ne peut plus être sélectionnée", () => {
  const scenario = validScenario();
  const started = { ...createCampaign(scenario), phase: "decision" as const };
  const confirmed = confirmSelection(selectOption(started, scenario, "decision-1", "decision-1-option-a"), scenario);
  const retry = { ...confirmed, phase: "decision" as const, pendingSelection: { decisionId: "decision-1", optionId: "decision-1-option-a" } };
  assert.throws(() => confirmSelection(retry, scenario), /already confirmed/);
});
