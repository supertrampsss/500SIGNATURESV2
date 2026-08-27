import type { Decision, Scenario } from "./types.ts";

function decisionFor(chapterNumber: number, decisionNumber: number): Decision {
  const id = `decision-${(chapterNumber - 1) * 12 + decisionNumber}`;
  return {
    id,
    version: 1,
    chapterId: `chapter-${chapterNumber}`,
    title: `Decision ${id}`,
    context: "A test context.",
    options: ["a", "b"].map((suffix) => ({
      id: `${id}-option-${suffix}`,
      label: `Option ${suffix}`,
      summary: "A test option.",
      beneficiaries: ["beneficiary"],
      contributors: ["contributor"],
      uncertainty: "moyenne",
      effects: [{
        id: `${id}-effect-${suffix}`,
        target: "indicator",
        key: "growth",
        delta: 1,
        timing: { kind: "immediate" },
        duration: "once",
        explanation: "A test effect.",
      }],
      scheduledEvents: [],
      promises: [],
      fulfillsPromises: [],
      locks: [],
      unlocks: [],
    })),
    evidence: [{
      label: "A source",
      sourceName: "Test source",
      sourceUrl: "https://example.com/source",
      publishedAt: "2026-01-01",
    }],
    dependencies: [],
    conflicts: [],
  };
}

export function validScenario(): Scenario {
  const decisions = Array.from({ length: 8 }, (_, chapterOffset) =>
    Array.from({ length: 12 }, (_, decisionOffset) =>
      decisionFor(chapterOffset + 1, decisionOffset + 1),
    ),
  ).flat();

  return {
    version: 1,
    title: "A valid test scenario",
    chapters: Array.from({ length: 8 }, (_, chapterOffset) => {
      const chapterNumber = chapterOffset + 1;
      return {
        id: `chapter-${chapterNumber}`,
        title: `Chapter ${chapterNumber}`,
        domains: ["one", "two", "three", "four"],
        opening: "A test opening.",
        tension: "A test tension.",
        decisionIds: decisions
          .filter((decision) => decision.chapterId === `chapter-${chapterNumber}`)
          .map((decision) => decision.id),
      };
    }),
    decisions,
  };
}
