import assert from "node:assert/strict";
import test from "node:test";

import { groupJournal } from "./presentation.ts";
import { SCENARIO_V3_PREVIEW } from "./scenario.ts";

function completeRecords() {
  return SCENARIO_V3_PREVIEW.decisions.map((decision, index) => ({
    decisionId: decision.id,
    optionId: decision.options[0]!.id,
    status: "confirmed" as const,
    confirmedAtIndex: index + 1,
  }));
}

test("le journal groupe les 60 décisions selon les chapitres variables et les cinq années", () => {
  const records = completeRecords();
  const groups = groupJournal(records, SCENARIO_V3_PREVIEW);

  assert.deepEqual(groups.map((group) => group.records.length), [8, 8, 8, 8, 7, 7, 7, 7]);
  assert.deepEqual(groups.map((group) => group.mandateYear), [1, 1, 2, 2, 3, 4, 4, 5]);
  assert.deepEqual(groups.flatMap((group) => group.records.map((record) => record.decisionId)), records.map((record) => record.decisionId));
  assert.equal(new Set(groups.flatMap((group) => group.records.map((record) => record.decisionId))).size, 60);
});

test("un journal partiel ne perd ni ne duplique les décisions confirmées", () => {
  const records = completeRecords().slice(0, 17);
  const groups = groupJournal(records, SCENARIO_V3_PREVIEW);
  assert.deepEqual(groups.map((group) => group.records.length), [8, 8, 1]);
  assert.deepEqual(groups.flatMap((group) => group.records.map((record) => record.decisionId)), records.map((record) => record.decisionId));
});

test("un ancien enregistrement non rattaché reste visible au lieu d'être perdu", () => {
  const legacy = {
    decisionId: "decision-archivee",
    optionId: "option-archivee",
    status: "confirmed" as const,
    confirmedAtIndex: 61,
  };

  const groups = groupJournal([...completeRecords(), legacy], SCENARIO_V3_PREVIEW);
  const records = groups.flatMap((group) => group.records);

  assert.equal(records.length, 61);
  assert.equal(records.at(-1)?.decisionId, legacy.decisionId);
  assert.equal(groups.at(-1)?.mandateYear, null);
  assert.match(groups.at(-1)?.chapterTitle ?? "", /non rattaché/);
});
