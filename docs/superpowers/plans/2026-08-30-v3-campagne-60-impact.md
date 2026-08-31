# V3 Campaign 60 Impact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hard-coded 96-decision playthrough with a 60-decision, eight-chapter campaign while retaining all 96 policies in a browsable catalogue and adding traceable five-year dynamics.

**Architecture:** Keep the existing policy modules as the canonical 96-item catalogue. Add an explicit campaign topology that selects 60 IDs, derive chapter positions from chapter lengths instead of arithmetic constants, then introduce annual checkpoints and a typed causal projection. Saved games move to schema version 4 and are never silently reinterpreted.

**Tech Stack:** TypeScript 5.9, Node test runner, Vite 7, existing static TypeScript modules

## Global Constraints

- Work only in the existing `500SIGNATURESV2` repository.
- A new campaign contains exactly 60 principal decisions.
- Chapter sizes are `[8, 8, 8, 8, 7, 7, 7, 7]`.
- The complete catalogue still contains exactly 96 unique policy subjects.
- Effects shown to the user must have a traceable cause.
- No production model call, no X integration and no em dash in user-facing copy.
- Do not invent factual baselines. Read GDP, debt and source metadata from the published France data already loaded by the application.

---

## File Structure

- Create `site/src/simulateur-v3/campaign-topology.ts`: selected IDs, chapter lengths and position helpers.
- Create `site/src/simulateur-v3/campaign-topology.test.ts`: topology and catalogue invariants.
- Create `site/src/simulateur-v3/timeline.ts`: annual checkpoint and stock-flow calculations.
- Create `site/src/simulateur-v3/timeline.test.ts`: deterministic five-year mechanics.
- Modify `site/src/simulateur-v3/types.ts`: schema 4, baseline, annual profile and checkpoint types.
- Modify `site/src/simulateur-v3/scenario.ts`: export the 96-item catalogue and 60-item campaign separately.
- Modify `site/src/simulateur-v3/validation.ts`: validate variable chapter sizes and scenario-derived positions.
- Modify `site/src/simulateur-v3/campaign.ts`: advance by chapter topology and annual checkpoints.
- Modify `site/src/simulateur-v3/effects.ts`: use campaign length instead of 96 and apply annual profiles once per checkpoint.
- Modify `site/src/simulateur-v3/storage.ts`: reject schema 3 saves with an explicit restart result.
- Modify `site/src/simulateur-v3/verdict.ts`: consume annual checkpoints and expose six independent dimensions.
- Modify tests under `site/src/simulateur-v3/`: replace 96-playthrough assumptions with 60-playthrough assertions.

### Task 1: Make campaign topology explicit

**Files:**
- Create: `site/src/simulateur-v3/campaign-topology.ts`
- Create: `site/src/simulateur-v3/campaign-topology.test.ts`

**Interfaces:**
- Consumes: stable decision IDs exported by the existing policy modules.
- Produces: `CAMPAIGN_DECISION_IDS`, `CAMPAIGN_CHAPTER_SIZES`, `campaignPosition()` and `campaignLength`.

- [ ] **Step 1: Write the failing topology test**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMPAIGN_CHAPTER_SIZES,
  CAMPAIGN_DECISION_IDS,
  campaignLength,
  campaignPosition,
} from "./campaign-topology.ts";

test("la topologie déclare 60 sujets uniques", () => {
  assert.equal(CAMPAIGN_DECISION_IDS.length, 60);
  assert.equal(new Set(CAMPAIGN_DECISION_IDS).size, 60);
  assert.deepEqual(CAMPAIGN_CHAPTER_SIZES, [8, 8, 8, 8, 7, 7, 7, 7]);
  assert.equal(campaignLength, 60);
  assert.deepEqual(campaignPosition(59), { chapterIndex: 7, decisionIndex: 6 });
});
```

- [ ] **Step 2: Run the test and verify the module is missing**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/campaign-topology.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `campaign-topology.ts`.

- [ ] **Step 3: Create the topology module with the approved 60 IDs**

```ts
export const CAMPAIGN_CHAPTER_SIZES = [8, 8, 8, 8, 7, 7, 7, 7] as const;

export const CAMPAIGN_DECISION_IDS = [
  "geler-le-bareme-de-l-impot-sur",
  "porter-le-taux-normal-de-tva-a",
  "tranche-a-50-au-dela-de-250",
  "retablir-un-impot-sur-la-fortune-financiere",
  "soumettre-les-revenus-du-capital-au-bareme",
  "exonerer-de-droits-de-succession-jusqu-a",
  "flat-tax-a-20-des-le-premier",
  "abolir-les-droits-de-succession",
  "supprimer-les-allegements-de-cotisations-entre-2",
  "repousser-l-age-legal-a-65-ans",
  "revenir-a-62-ans",
  "desindexer-les-pensions-d-un-point",
  "durcir-l-assurance-chomage-degressivite-duree",
  "retablir-la-semaine-de-39-heures",
  "augmenter-le-smic-de-10",
  "allocation-sociale-unique",
  "doubler-les-franchises-medicales",
  "renforcer-le-controle-des-arrets-de-travail",
  "creer-5-000-postes-de-soignants",
  "loi-grand-age-50-000-recrutements",
  "supprimer-l-aide-medicale-d-etat",
  "verser-le-rsa-automatiquement-fin-du-non",
  "porter-le-rsa-au-seuil-de",
  "assurance-maladie-publique-unique",
  "recruter-10-000-policiers-et-gendarmes",
  "construire-15-000-places-de-prison-supplementaires",
  "recruter-3-000-magistrats-et-greffiers",
  "doubler-l-execution-des-eloignements-oqtf",
  "supprimer-l-allocation-pour-demandeurs-d",
  "reserver-les-prestations-non-contributives-aux-nationaux",
  "quotas-annuels-d-immigration",
  "legaliser-et-taxer-le-cannabis",
  "porter-l-effort-de-defense-vers-3",
  "doubler-la-reserve-operationnelle",
  "service-militaire-volontaire-de-50-000",
  "doubler-les-moyens-du-renseignement-interieur",
  "sortir-de-l-euro",
  "referendum-sur-la-sortie-de-l-ue",
  "creer-une-armee-europeenne",
  "doubler-maprimerenov",
  "plan-ferroviaire-3-000-m-de-plus",
  "engager-six-epr2-part-annuelle-de-l",
  "retablir-une-trajectoire-carbone-recettes-redistribuees",
  "sortie-du-nucleaire-en-2040",
  "moratoire-sur-les-renouvelables",
  "interdire-les-voitures-thermiques-en-2030",
  "revaloriser-les-enseignants-de-5",
  "doubler-les-bourses-etudiantes-sur-criteres",
  "financer-100-000-logements-sociaux-de-plus",
  "revaloriser-les-apl-de-5",
  "cheque-education-par-eleve",
  "supprimer-le-financement-public-du-prive",
  "autonomie-complete-des-etablissements",
  "geler-le-point-d-indice-en-2026",
  "ne-pas-remplacer-un-depart-administratif-sur",
  "fermer-un-tiers-des-agences-et-operateurs",
  "diviser-par-deux-le-nombre-de-parlementaires",
  "reduire-de-5-les-dotations-aux-collectivites",
  "regle-d-or-constitutionnelle",
  "proportionnelle-integrale",
] as const;

export const campaignLength = CAMPAIGN_DECISION_IDS.length;

export function campaignPosition(completed: number): { chapterIndex: number; decisionIndex: number } {
  if (!Number.isInteger(completed) || completed < 0 || completed >= campaignLength) {
    throw new RangeError(`Invalid campaign position: ${completed}`);
  }
  let offset = completed;
  for (let chapterIndex = 0; chapterIndex < CAMPAIGN_CHAPTER_SIZES.length; chapterIndex += 1) {
    const size = CAMPAIGN_CHAPTER_SIZES[chapterIndex]!;
    if (offset < size) return { chapterIndex, decisionIndex: offset };
    offset -= size;
  }
  throw new RangeError(`Invalid campaign position: ${completed}`);
}
```

- [ ] **Step 4: Run the topology test**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/campaign-topology.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the topology contract**

```bash
git add site/src/simulateur-v3/campaign-topology.ts site/src/simulateur-v3/campaign-topology.test.ts
git commit -m "test: define 60 decision campaign topology"
```

### Task 2: Separate the 96-item catalogue from the 60-item scenario

**Files:**
- Modify: `site/src/simulateur-v3/scenario.ts`
- Modify: `site/src/simulateur-v3/scenario.test.ts`
- Modify: `site/src/simulateur-v3/policy-catalogue.ts`
- Modify: `site/src/simulateur-v3/policy-catalogue.test.ts`

**Interfaces:**
- Consumes: `CAMPAIGN_DECISION_IDS` from Task 1.
- Produces: `SCENARIO_V3_CATALOGUE` with 96 decisions and `SCENARIO_V3` with 60 decisions.

- [ ] **Step 1: Replace the scenario count test**

```ts
test("le catalogue garde 96 sujets et la campagne en joue 60", () => {
  assert.equal(SCENARIO_V3_CATALOGUE.decisions.length, 96);
  assert.equal(SCENARIO_V3.decisions.length, 60);
  assert.deepEqual(SCENARIO_V3.chapters.map((chapter) => chapter.decisionIds.length), [8, 8, 8, 8, 7, 7, 7, 7]);
  assert.ok(SCENARIO_V3.decisions.every(({ id }) =>
    SCENARIO_V3_CATALOGUE.decisions.some((candidate) => candidate.id === id),
  ));
});
```

- [ ] **Step 2: Run the scenario test**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/scenario.test.ts`

Expected: FAIL because `SCENARIO_V3` and `SCENARIO_V3_CATALOGUE` do not exist.

- [ ] **Step 3: Export both scenario views**

```ts
const catalogueDecisions = rawDecisions.map(normalizeDecisionReferences);
const selected = new Set<string>(CAMPAIGN_DECISION_IDS);
const campaignDecisions = catalogueDecisions.filter(({ id }) => selected.has(id));

function buildScenario(title: string, version: number, selectedDecisions: Decision[]): Scenario {
  return {
    version,
    title,
    chapters: CHAPTERS.map((chapter) => ({
      ...chapter,
      decisionIds: selectedDecisions
        .filter((decision) => decision.chapterId === chapter.id)
        .map((decision) => decision.id),
    })),
    decisions: selectedDecisions,
  };
}

export const SCENARIO_V3_CATALOGUE = buildScenario("Bibliothèque des politiques", 7, catalogueDecisions);
export const SCENARIO_V3 = buildScenario("La France à l'épreuve des comptes", 7, campaignDecisions);
export const SCENARIO_V3_PREVIEW = SCENARIO_V3;
```

Keep the current reference-cleaning logic inside a named `normalizeDecisionReferences()` function. For the campaign scenario, keep dependencies pointing to catalogue-only subjects for display, but only executable locks and unlocks may target an ID in `SCENARIO_V3`.

- [ ] **Step 4: Add a catalogue accessor**

```ts
export function policyById(id: string): Decision | undefined {
  return SCENARIO_V3_CATALOGUE.decisions.find((decision) => decision.id === id);
}
```

- [ ] **Step 5: Run focused tests**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/campaign-topology.test.ts src/simulateur-v3/scenario.test.ts src/simulateur-v3/policy-catalogue.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add site/src/simulateur-v3/scenario.ts site/src/simulateur-v3/scenario.test.ts site/src/simulateur-v3/policy-catalogue.ts site/src/simulateur-v3/policy-catalogue.test.ts
git commit -m "feat: split policy catalogue from 60 decision campaign"
```

### Task 3: Remove 96 and 12 arithmetic from validation and navigation

**Files:**
- Modify: `site/src/simulateur-v3/validation.ts`
- Modify: `site/src/simulateur-v3/validation.test.ts`
- Modify: `site/src/simulateur-v3/campaign.ts`
- Modify: `site/src/simulateur-v3/campaign.test.ts`
- Modify: `site/src/simulateur-v3/effects.ts`
- Modify: `site/src/simulateur-v3/effects.test.ts`
- Modify: `site/src/simulateur-v3/render.ts`
- Modify: `site/src/simulateur-v3/render.test.ts`

**Interfaces:**
- Consumes: `scenario.chapters[*].decisionIds` and topology helpers.
- Produces: scenario-derived state positioning and due-date validation.

- [ ] **Step 1: Add failing variable-chapter tests**

```ts
test("le passage de chapitre suit les longueurs 8 puis 7", () => {
  const scenario = SCENARIO_V3;
  assert.deepEqual(positionAfterCompleted(scenario, 8), { chapterIndex: 0, decisionIndex: 7 });
  assert.deepEqual(positionBeforeNext(scenario, 8), { chapterIndex: 1, decisionIndex: 0 });
  assert.deepEqual(positionBeforeNext(scenario, 53), { chapterIndex: 7, decisionIndex: 0 });
  assert.equal(totalDecisions(scenario), 60);
});
```

- [ ] **Step 2: Run validation and campaign tests**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/validation.test.ts src/simulateur-v3/campaign.test.ts`

Expected: FAIL on the old 12-item arithmetic.

- [ ] **Step 3: Introduce scenario-derived helpers in `validation.ts`**

```ts
export const totalDecisions = (scenario: Scenario): number =>
  scenario.chapters.reduce((sum, chapter) => sum + chapter.decisionIds.length, 0);

export function positionBeforeNext(scenario: Scenario, completed: number) {
  let remaining = completed;
  for (let chapterIndex = 0; chapterIndex < scenario.chapters.length; chapterIndex += 1) {
    const size = scenario.chapters[chapterIndex]!.decisionIds.length;
    if (remaining < size) return { chapterIndex, decisionIndex: remaining };
    remaining -= size;
  }
  return null;
}

export function positionAfterCompleted(scenario: Scenario, completed: number) {
  return completed === 0 ? null : positionBeforeNext(scenario, completed - 1);
}
```

Replace `CAMPAIGN_DECISION_COUNT`, `DECISIONS_PER_CHAPTER`, `% 12`, `<= 96` and the error `expected-96-decisions` with these helpers and `totalDecisions(scenario)`. Generic validation accepts non-empty variable chapter sizes and verifies that the flattened chapter IDs equal the scenario decisions exactly once. `scenario.test.ts` enforces `[8, 8, 8, 8, 7, 7, 7, 7]` on the production scenario, while fixtures may declare smaller valid topologies.

- [ ] **Step 4: Change advancement to chapter boundaries**

```ts
function chapterIsComplete(state: CampaignState, scenario: Scenario): boolean {
  const chapter = scenario.chapters[state.chapterIndex];
  return chapter !== undefined && state.decisionIndex + 1 >= chapter.decisionIds.length;
}

if (completedDecisions >= totalDecisions(scenario)) return { ...state, phase: "verdict" };
if (chapterIsComplete(state, scenario)) return { ...state, phase: "chapter_verdict" };
return { ...state, decisionIndex: state.decisionIndex + 1, phase: "decision" };
```

- [ ] **Step 5: Bound delayed consequences by scenario length**

Change `assertDueAtDecision(dueAtDecision)` to `assertDueAtDecision(dueAtDecision, scenario)` and reject a date greater than `totalDecisions(scenario)`. Thread `scenario` through `scheduleOptionConsequences()` and its callers.

- [ ] **Step 6: Derive progress labels and percentages from the scenario**

```ts
function globalPosition(state: CampaignState, scenario: Scenario): number {
  const before = scenario.chapters
    .slice(0, state.chapterIndex)
    .reduce((sum, chapter) => sum + chapter.decisionIds.length, 0);
  return Math.min(totalDecisions(scenario), before + state.decisionIndex + 1);
}

const total = totalDecisions(scenario);
const progressLevel = Math.round((state.decisions.length / total) * 100);
```

Replace every public `sur 96`, final checkpoint comparison and fixed 96 percentage denominator in `render.ts` and `render.test.ts`.

- [ ] **Step 7: Run focused tests**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/validation.test.ts src/simulateur-v3/campaign.test.ts src/simulateur-v3/effects.test.ts src/simulateur-v3/render.test.ts src/simulateur-v3/campaign-e2e.test.ts`

Expected: PASS with both 60-option paths reaching `phase === "verdict"`.

- [ ] **Step 8: Commit**

```bash
git add site/src/simulateur-v3/validation.ts site/src/simulateur-v3/validation.test.ts site/src/simulateur-v3/campaign.ts site/src/simulateur-v3/campaign.test.ts site/src/simulateur-v3/effects.ts site/src/simulateur-v3/effects.test.ts site/src/simulateur-v3/render.ts site/src/simulateur-v3/render.test.ts site/src/simulateur-v3/campaign-e2e.test.ts
git commit -m "refactor: derive campaign progression from scenario"
```

### Task 4: Add a five-year timeline with sourced baseline input

**Files:**
- Modify: `site/src/simulateur-v3/types.ts`
- Create: `site/src/simulateur-v3/timeline.ts`
- Create: `site/src/simulateur-v3/timeline.test.ts`
- Modify: `site/src/simulateur-v3/campaign.ts`

**Interfaces:**
- Consumes: published France GDP and debt series passed by the controller.
- Produces: `MandateBaseline`, `AnnualCheckpoint[]` and `advanceMandateYear()`.

- [ ] **Step 1: Write stock-flow tests using explicit fixture values**

```ts
test("un déficit annuel augmente le stock de dette une seule fois", () => {
  const baseline = { nominalGdpMillions: 2_000_000, debtMillions: 2_000_000, interestCostMillions: 40_000 };
  const next = projectYear(baseline, { annualBalance: -100_000, nominalGrowthPercent: 0, interestRatePercent: 2 });
  assert.equal(next.debtMillions, 2_100_000);
  assert.equal(next.debtToGdp, 105);
  assert.equal(next.interestCostMillions, 42_000);
});

test("le moteur refuse une baseline non sourcée", () => {
  assert.throws(() => validateBaseline({ nominalGdpMillions: 0, debtMillions: 1, interestCostMillions: 1, sourceIds: [] }), /baseline/i);
});
```

- [ ] **Step 2: Run the timeline test**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/timeline.test.ts`

Expected: FAIL because `timeline.ts` is missing.

- [ ] **Step 3: Add timeline types**

```ts
export type MandateYear = 0 | 1 | 2 | 3 | 4 | 5;

export type MandateBaseline = {
  nominalGdpMillions: number;
  debtMillions: number;
  interestCostMillions: number;
  sourceIds: string[];
  dataVersion: string;
};

export type AnnualCheckpoint = {
  year: MandateYear;
  afterDecisionCount: number;
  nominalGdpMillions: number;
  debtMillions: number;
  debtToGdp: number;
  annualBalance: number;
  interestCost: number;
  causes: string[];
};
```

Add `baseline: MandateBaseline` and `annualCheckpoints: AnnualCheckpoint[]` to `CampaignState`. Increment `SCHEMA_VERSION` from 3 to 4.

- [ ] **Step 4: Implement pure projection functions**

```ts
export function validateBaseline(value: MandateBaseline): void {
  if (value.nominalGdpMillions <= 0 || value.debtMillions < 0 || value.interestCostMillions < 0) {
    throw new Error("Invalid campaign baseline values");
  }
  if (value.sourceIds.length === 0 || !value.dataVersion.trim()) {
    throw new Error("Campaign baseline must be sourced and versioned");
  }
}

export function projectYear(
  previous: Pick<MandateBaseline, "nominalGdpMillions" | "debtMillions" | "interestCostMillions">,
  input: { annualBalance: number; nominalGrowthPercent: number; interestRatePercent: number },
) {
  const nominalGdpMillions = previous.nominalGdpMillions * (1 + input.nominalGrowthPercent / 100);
  const debtMillions = previous.debtMillions - input.annualBalance;
  const interestCostMillions = debtMillions * (input.interestRatePercent / 100);
  return {
    nominalGdpMillions,
    debtMillions,
    debtToGdp: (debtMillions / nominalGdpMillions) * 100,
    interestCostMillions,
  };
}
```

The controller must construct the real baseline from the latest common published period of `eurostat_pib_montant`, `insee_dette_apu_part_pib` and the registered interest-cost series. If no common valid baseline exists, the campaign entry screen must be unavailable with a factual data error. Do not add a numeric fallback.

- [ ] **Step 5: Create annual checkpoints at chapter boundaries**

Map the eight chapter completions to mandate years `[1, 1, 2, 2, 3, 4, 4, 5]`. A year is projected only the first time its final chapter is completed. Store the causal ledger IDs that contributed to the annual balance, growth or rate used by that checkpoint.

- [ ] **Step 6: Run timeline and campaign tests**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/timeline.test.ts src/simulateur-v3/campaign.test.ts src/simulateur-v3/storage.test.ts`

Expected: PASS and schema 3 saves rejected by storage tests.

- [ ] **Step 7: Commit**

```bash
git add site/src/simulateur-v3/types.ts site/src/simulateur-v3/timeline.ts site/src/simulateur-v3/timeline.test.ts site/src/simulateur-v3/campaign.ts site/src/simulateur-v3/campaign.test.ts site/src/simulateur-v3/storage.ts site/src/simulateur-v3/storage.test.ts
git commit -m "feat: add sourced five year campaign timeline"
```

### Task 5: Make consequences and crises mechanically meaningful

**Files:**
- Modify: `site/src/simulateur-v3/types.ts`
- Modify: `site/src/simulateur-v3/validation.ts`
- Modify: `site/src/simulateur-v3/scenario-crises.ts`
- Modify: `site/src/simulateur-v3/crises.ts`
- Modify: `site/src/simulateur-v3/scenario.test.ts`
- Modify: `site/src/simulateur-v3/scenario-crises.test.ts`

**Interfaces:**
- Consumes: 60 selected decisions, groups, dependencies and annual checkpoints.
- Produces: validated causal mechanisms and four to eight eligible crises.

- [ ] **Step 1: Add failing editorial integrity tests**

```ts
test("chaque option publiée porte un mécanisme et un horizon", () => {
  for (const decision of SCENARIO_V3.decisions) {
    for (const option of decision.options) {
      assert.ok(option.mechanism.trim(), `${decision.id}:${option.id}`);
      assert.ok(option.horizon.kind === "immediate" || option.horizon.year >= 1);
      assert.ok(option.effects.some((effect) => effect.target === "indicator"));
    }
  }
});

test("aucun effet politique n'est créé par miroir automatique", async () => {
  const source = await readFile(new URL("./policy-catalogue.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Math\.round\([^)]*\/\s*3\)/);
});
```

- [ ] **Step 2: Extend `DecisionOption`**

```ts
export type DecisionOption = {
  // existing fields
  mechanism: string;
  horizon: { kind: "immediate" } | { kind: "year"; year: 1 | 2 | 3 | 4 | 5 };
  legalConstraints: string[];
};
```

Update `definePolicy()` so every policy module must provide these fields. Delete the generic opinion-to-majority, business-to-growth and local-authority-to-public-services mirroring rules. Each retained effect must be declared by the policy definition.

- [ ] **Step 3: Validate option distance**

Add a validation error when two options have identical non-zero effect keys and deltas, identical horizon and identical locks. Add a validation error if an option has neither a budget effect nor another indicator effect.

- [ ] **Step 4: Rebuild crisis gates**

Each `CrisisRule` must add `eligibleFromChapter`, `maxOccurrences: 1` and `requiredDecisionIds`. `detectCrisis()` must require at least one confirmed aggravating decision and must refuse a second major crisis in the same chapter. Create eight rule families, one per chapter, while allowing only four to eight to trigger in a playthrough.

- [ ] **Step 5: Run content and crisis tests**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/scenario.test.ts src/simulateur-v3/validation.test.ts src/simulateur-v3/crises.test.ts src/simulateur-v3/scenario-crises.test.ts`

Expected: PASS with every selected option carrying a declared mechanism.

- [ ] **Step 6: Commit**

```bash
git add site/src/simulateur-v3/types.ts site/src/simulateur-v3/validation.ts site/src/simulateur-v3/policy-catalogue.ts site/src/simulateur-v3/policies site/src/simulateur-v3/scenario-crises.ts site/src/simulateur-v3/crises.ts site/src/simulateur-v3/scenario.test.ts site/src/simulateur-v3/scenario-crises.test.ts
git commit -m "feat: make campaign consequences causal"
```

### Task 6: Produce a multidimensional verdict

**Files:**
- Modify: `site/src/simulateur-v3/verdict.ts`
- Modify: `site/src/simulateur-v3/verdict.test.ts`
- Modify: `site/src/simulateur-v3/verdict-share.ts`
- Modify: `site/src/simulateur-v3/verdict-share.test.ts`

**Interfaces:**
- Consumes: annual checkpoints, final indicators and causal ledger.
- Produces: `VerdictView.dimensions`, unresolved tensions and top causal explanations.

- [ ] **Step 1: Write the failing verdict shape test**

```ts
assert.deepEqual(view.dimensions.map(({ id }) => id), [
  "finances",
  "economy",
  "households",
  "energy",
  "politics",
  "coherence",
]);
assert.ok(view.dimensions.every(({ causes }) => causes.length > 0));
assert.equal("rank" in view, false);
```

- [ ] **Step 2: Run verdict tests**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/verdict.test.ts src/simulateur-v3/verdict-share.test.ts`

Expected: FAIL because `dimensions` is absent.

- [ ] **Step 3: Add the verdict dimension contract**

```ts
export type VerdictDimension = {
  id: "finances" | "economy" | "households" | "energy" | "politics" | "coherence";
  label: string;
  summary: string;
  direction: "improved" | "stable" | "degraded" | "mixed";
  causes: { sourceId: string; explanation: string }[];
};
```

Build each direction from its own indicator set. `coherence` inspects confirmed conflicts, reversals and unfulfilled promises. Do not average the six dimensions into one score.

- [ ] **Step 4: Update sharing copy**

The share text names the headline and at most two dimensions. It must not claim the player has a global rank.

- [ ] **Step 5: Run tests and commit**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/verdict.test.ts src/simulateur-v3/verdict-share.test.ts`

Expected: PASS.

```bash
git add site/src/simulateur-v3/verdict.ts site/src/simulateur-v3/verdict.test.ts site/src/simulateur-v3/verdict-share.ts site/src/simulateur-v3/verdict-share.test.ts
git commit -m "feat: add multidimensional campaign verdict"
```

### Task 7: Expose all 96 policies as a browsable library

**Files:**
- Create: `site/src/simulateur-v3/policy-library.ts`
- Create: `site/src/simulateur-v3/policy-library.test.ts`
- Modify: `site/src/routes.ts`
- Modify: `site/src/routes.test.ts`
- Modify: `site/src/main.ts`
- Modify: `site/scripts/prerendre.ts`
- Modify: `site/scripts/prerendre.test.ts`

**Interfaces:**
- Consumes: `SCENARIO_V3_CATALOGUE` and the selected ID set.
- Produces: searchable library entries and `/simulateur/mesures/`.

- [ ] **Step 1: Write the library invariant test**

```ts
test("la bibliothèque expose les 96 sujets et identifie les 60 joués", () => {
  const entries = policyLibrary(SCENARIO_V3_CATALOGUE, new Set(CAMPAIGN_DECISION_IDS));
  assert.equal(entries.length, 96);
  assert.equal(entries.filter(({ playable }) => playable).length, 60);
  assert.equal(new Set(entries.map(({ id }) => id)).size, 96);
});
```

- [ ] **Step 2: Implement the read model**

```ts
export type PolicyLibraryEntry = {
  id: string;
  title: string;
  chapterId: string;
  kind: DecisionKind;
  playable: boolean;
  summary: string;
  sourceCount: number;
};

export function policyLibrary(scenario: Scenario, playableIds: ReadonlySet<string>): PolicyLibraryEntry[] {
  return scenario.decisions.map((decision) => ({
    id: decision.id,
    title: decision.title,
    chapterId: decision.chapterId,
    kind: decision.kind,
    playable: playableIds.has(decision.id),
    summary: decision.context,
    sourceCount: decision.evidence.length,
  }));
}
```

- [ ] **Step 3: Add the route and static rendering**

Map `/simulateur/mesures/` to a `mesures-v3` view. Render filters for chapter, kind and campaign status. Initially paint twelve entries, then load batches of twelve locally. Each entry links to its full evidence section and labels either `Dans la campagne` or `Bibliothèque`.

- [ ] **Step 4: Add pre-render and sitemap tests**

```ts
assert.ok(ecrites.some(({ chemin }) => chemin === "simulateur/mesures/index.html"));
assert.match(planDuSite(analyses), /\/simulateur\/mesures\//);
```

- [ ] **Step 5: Run and commit**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/policy-library.test.ts src/routes.test.ts scripts/prerendre.test.ts && npm run build`

Expected: PASS.

```bash
git add site/src/simulateur-v3/policy-library.ts site/src/simulateur-v3/policy-library.test.ts site/src/routes.ts site/src/routes.test.ts site/src/main.ts site/scripts/prerendre.ts site/scripts/prerendre.test.ts
git commit -m "feat: expose complete policy library"
```

### Task 8: Run the complete engine gate

**Files:**
- Modify only if a test reveals a defect: files changed in Tasks 1 to 6.

**Interfaces:**
- Consumes: complete engine work.
- Produces: verified 60-decision campaign and retained 96-item catalogue.

- [ ] **Step 1: Scan for obsolete hard-coding**

Run: `rg -n "sur 96|expected-96|% 12|\/ 96|decision 96|Array\(8\)\.fill\(12\)" site/src/simulateur-v3`

Expected: no production matches. Historical migration tests may mention schema 3 explicitly.

- [ ] **Step 2: Run the simulator suite**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/*.test.ts`

Expected: all tests PASS.

- [ ] **Step 3: Run the full project gate**

Run: `cd site && npm test && npm run build`

Expected: both commands exit 0.

- [ ] **Step 4: Commit any gate-only fixes**

```bash
git add site/src/simulateur-v3
git commit -m "test: verify 60 decision campaign engine"
```
