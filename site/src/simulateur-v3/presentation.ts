import { mandateYearForChapter } from "./timeline.ts";
import type { DecisionRecord, Scenario } from "./types.ts";

export type JournalGroup = {
  id: string;
  chapterIndex: number;
  chapterId: string;
  chapterTitle: string;
  mandateYear: number | null;
  records: DecisionRecord[];
};

/** Groups persisted records from scenario topology, never from an assumed chapter size. */
export function groupJournal(records: readonly DecisionRecord[], scenario: Scenario): JournalGroup[] {
  const topology = new Map<string, { chapterIndex: number; chapterId: string; chapterTitle: string; mandateYear: number }>();
  scenario.chapters.forEach((chapter, chapterIndex) => {
    const mandateYear = mandateYearForChapter(chapterIndex);
    if (mandateYear === null) return;
    chapter.decisionIds.forEach((decisionId) => topology.set(decisionId, {
      chapterIndex,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      mandateYear,
    }));
  });

  const groups = new Map<string, JournalGroup>();
  for (const record of records) {
    const location = topology.get(record.decisionId) ?? {
      chapterIndex: Number.MAX_SAFE_INTEGER,
      chapterId: "historique-non-rattache",
      chapterTitle: "Historique non rattaché au scénario",
      mandateYear: null,
    };
    const id = location.mandateYear === null
      ? `${location.chapterId}:annee-inconnue`
      : `${location.chapterId}:annee-${location.mandateYear}`;
    const group = groups.get(id) ?? { id, ...location, records: [] };
    group.records.push(record);
    groups.set(id, group);
  }
  return [...groups.values()].sort((left, right) => left.chapterIndex - right.chapterIndex);
}
