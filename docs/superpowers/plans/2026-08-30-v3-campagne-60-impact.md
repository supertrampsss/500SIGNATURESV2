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
  "reduire-de-5-les-dotations-aux-collectivites",
  "regle-d-or-constitutionnelle",
  "geler-le-point-d-indice-en-2026",
  "ne-pas-remplacer-un-depart-administratif-sur",
  "fermer-un-tiers-des-agences-et-operateurs",
  "diviser-par-deux-le-nombre-de-parlementaires",
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

- [ ] **Step 1: Replace the stale scenario shape tests**

```ts
test("le catalogue garde 96 sujets et la campagne en joue 60", () => {
  assert.equal(SCENARIO_V3_CATALOGUE.decisions.length, 96);
  assert.equal(SCENARIO_V3.decisions.length, 60);
  assert.deepEqual(SCENARIO_V3.chapters.map((chapter) => chapter.decisionIds.length), [8, 8, 8, 8, 7, 7, 7, 7]);
  assert.ok(SCENARIO_V3.decisions.every(({ id }) =>
    SCENARIO_V3_CATALOGUE.decisions.some((candidate) => candidate.id === id),
  ));
});

test("chaque chapitre joué conserve les trois niveaux de choix", () => {
  for (const chapter of SCENARIO_V3.chapters) {
    const kinds = new Set(chapter.decisionIds.map((id) =>
      SCENARIO_V3.decisions.find((decision) => decision.id === id)!.kind,
    ));
    assert.deepEqual(kinds, new Set(["gestion", "transformation", "rupture"]), chapter.title);
  }
});
```

Delete the obsolete assertion requiring four decisions of every kind in every chapter. That 12-item invariant is incompatible with the production topology. The replacement keeps the useful editorial gate: every played chapter contains all three levels of political choice.

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
- Modify: `site/src/simulateur-v3/campaign-topology.ts`
- Modify: `site/src/simulateur-v3/campaign-topology.test.ts`
- Modify: `site/src/simulateur-v3/scenario.ts`
- Modify: `site/src/simulateur-v3/scenario.test.ts`
- Modify: `site/src/simulateur-v3/validation.ts`
- Modify: `site/src/simulateur-v3/validation.test.ts`
- Modify: `site/src/simulateur-v3/campaign.ts`
- Modify: `site/src/simulateur-v3/campaign.test.ts`
- Modify: `site/src/simulateur-v3/effects.ts`
- Modify: `site/src/simulateur-v3/effects.test.ts`
- Modify: `site/src/simulateur-v3/render.ts`
- Modify: `site/src/simulateur-v3/render.test.ts`
- Modify: `site/src/simulateur-v3/controller.ts`
- Modify: `site/src/simulateur-v3/controller.test.ts`
- Modify: `site/src/simulateur-v3/storage.ts`
- Modify: `site/src/simulateur-v3/storage.test.ts`
- Modify: `site/src/simulateur-v3/verdict.ts`
- Modify: `site/src/simulateur-v3/verdict.test.ts`

**Interfaces:**
- Consumes: `scenario.chapters[*].decisionIds` and topology helpers.
- Produces: scenario-derived state positioning and due-date validation.

The two chapter-eight policies with three-decision consequences are deliberately placed at positions 54 and 55 so their causal events remain observable before the 60-decision verdict. `SCENARIO_V3` must preserve this explicit topology order rather than filtering in catalogue order. Historical modeled-effect migration remains limited to scenario 5 to 6; a version 6 save is not silently migrated into the topologically different version 7 campaign.

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
if (chapterIsComplete(state, scenario)) return nextChapter(state);
return { ...state, decisionIndex: state.decisionIndex + 1, phase: "decision" };
```

Do not emit a new `chapter_verdict` screen. The renderer intentionally has no such scene. Task 4 inserts councils only at the five annual checkpoints; other chapter boundaries go directly to the next chapter introduction. Keep legacy `chapter_verdict` normalization only as long as stored-state migration requires it.

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
- Modify: `site/src/simulateur-v3/campaign.test.ts`
- Modify: `site/src/simulateur-v3/flow.ts`
- Modify: `site/src/simulateur-v3/flow.test.ts`
- Modify: `site/src/simulateur-v3/controller.ts`
- Modify: `site/src/simulateur-v3/controller.test.ts`
- Modify: `site/src/simulateur-v3/storage.ts`
- Modify: `site/src/simulateur-v3/storage.test.ts`
- Modify: `site/src/simulateur-v3/render.ts`
- Modify: `site/src/simulateur-v3/render.test.ts`
- Modify: `site/src/simulateur-v3/verdict.ts`
- Modify: `site/src/simulateur-v3/verdict.test.ts`
- Modify: `site/src/main.ts`
- Modify: `site/src/interface.test.ts`

**Interfaces:**
- Consumes: `pays.FR.series` and `donnees.version()` after the published data loader is ready.
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
  assert.throws(() => validateBaseline({
    period: "2025",
    debtPeriod: "2025-Q4",
    nominalGdpMillions: 0,
    debtMillions: 1,
    annualBalanceMillions: -1,
    interestCostMillions: 1,
    nominalGrowthPercent: 1,
    sourceIds: [],
    dataVersion: "test",
  }), /baseline/i);
});

test("la baseline aligne les flux annuels sur la dette du quatrième trimestre", () => {
  const baseline = buildMandateBaseline({
    gdp: { "2024": 2_935_251_000_000, "2025": 2_991_055_900_000 },
    debtToGdp: { "2025-Q4": 115.7, "2026-Q1": 116.3 },
    balance: { "2025": -152_532_000_000 },
    interest: { "2025": 66_635_900_000 },
    dataVersion: "2026-08-22T1939",
  });
  assert.equal(baseline?.period, "2025");
  assert.equal(baseline?.debtPeriod, "2025-Q4");
  assert.equal(baseline?.nominalGdpMillions, 2_991_055.9);
  assert.equal(baseline?.annualBalanceMillions, -152_532);
  assert.equal(baseline?.interestCostMillions, 66_635.9);
  assert.ok(Math.abs((baseline?.nominalGrowthPercent ?? 0) - 1.9017) < 0.0001);
});
```

- [ ] **Step 2: Run the timeline test**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/timeline.test.ts`

Expected: FAIL because `timeline.ts` is missing.

- [ ] **Step 3: Add timeline types**

```ts
export type MandateYear = 0 | 1 | 2 | 3 | 4 | 5;

export type MandateBaseline = {
  period: string;
  debtPeriod: string;
  nominalGdpMillions: number;
  debtMillions: number;
  annualBalanceMillions: number;
  interestCostMillions: number;
  nominalGrowthPercent: number;
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
  if (value.nominalGdpMillions <= 0 || value.debtMillions < 0 || value.interestCostMillions < 0
      || !Number.isFinite(value.annualBalanceMillions) || !Number.isFinite(value.nominalGrowthPercent)) {
    throw new Error("Invalid campaign baseline values");
  }
  if (!/^\d{4}$/.test(value.period) || value.debtPeriod !== `${value.period}-Q4`
      || !sameIds(value.sourceIds, REQUIRED_BASELINE_INDICATORS) || !value.dataVersion.trim()) {
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

`buildMandateBaseline()` selects the latest annual period `Y` for which GDP, balance, interest and debt ratio at `Y-Q4` are all finite, and requires GDP at one preceding annual period. Published stock and flow series are in euros; convert to millions exactly once. Compute debt stock from GDP times the published debt ratio. Derive nominal growth from the last two valid GDP amount observations rather than substituting the real-growth series. For the current publication this aligns annual 2025 data with debt `2025-Q4`; never mix `2026-Q1` with 2025 flows.

The controller must construct the real baseline from `eurostat_pib_montant`, `insee_dette_apu_part_pib`, `insee_apu_solde` and `eurostat_apu_interets`, with `dataVersion` supplied by `donnees.version()`. Initialise `annualBalance`, `debtToGdp`, `interestCost` and `growth` from this baseline; delete their numeric production defaults. `sourceIds` contains exactly those four indicator IDs; source-registry record IDs may be stored separately and must not replace them. If no common valid baseline and preceding GDP value exist, the campaign entry screen is unavailable with a factual data error and no start button. Do not add a numeric fallback. The explicitly ludic political and service indices may retain documented neutral starting values.

`annualBalance`, GDP stock, debt stock and `interestCost` all use millions of euros in the engine. Correct any policy delta still expressed as billions, including the euro-exit interest effect (`12_000`, not `12`). Derive the projection rate from `interestCostMillions / debtMillions * 100`; do not mix a cost in millions with a percentage.

- [ ] **Step 5: Create exactly five annual checkpoints at the final chapter of each year**

Map the eight chapter completions to mandate years `[1, 1, 2, 2, 3, 4, 4, 5]`. A year is projected only after its final chapter is completed, at cumulative decision counts `[16, 32, 39, 53, 60]`, and only if no checkpoint for that year exists. Resolve due events, promises and crises before projection. Store the causal ledger IDs that contributed to the annual balance, growth or rate used by that checkpoint. At the four non-final annual checkpoints, `continue` leaves the Council for the next chapter introduction. At the year-five Council, `continue` enters the verdict. No new state enters `chapter_verdict`.

- [ ] **Step 6: Integrate published-data availability and storage migration**

Require a baseline when creating or mounting a new campaign. In `main.ts`, initialise published data, read `pays.FR.series`, build the baseline, then mount V3. Never mount V3 first and patch the values later. When construction fails, keep the V3 section visible with a factual error, disable the primary simulation entry and offer retry/back navigation.

Increment `SCHEMA_VERSION` from 3 to 4. A schema 3 save produces an explicit `restart_required` result; it is not interpreted as schema 4 and is never silently combined with the current publication. A restored schema 4 campaign keeps its persisted baseline and data version for reproducibility.

- [ ] **Step 7: Run timeline and campaign tests**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/timeline.test.ts src/simulateur-v3/campaign.test.ts src/simulateur-v3/flow.test.ts src/simulateur-v3/controller.test.ts src/simulateur-v3/storage.test.ts src/simulateur-v3/validation.test.ts src/simulateur-v3/render.test.ts src/simulateur-v3/verdict.test.ts src/interface.test.ts`

Expected: PASS, Councils occur only at `[16, 32, 39, 53, 60]`, missing baselines block entry, and schema 3 saves require restart.

- [ ] **Step 8: Commit**

```bash
git add site/src/simulateur-v3 site/src/main.ts site/src/interface.test.ts
git commit -m "feat: add sourced five year campaign timeline"
```

### Task 5A: Version the causal rewrite before changing effects

**Files:**
- Modify: `site/src/simulateur-v3/scenario.ts`
- Modify: `site/src/simulateur-v3/storage.ts`
- Modify: `site/src/simulateur-v3/storage.test.ts`
- Modify: `site/src/simulateur-v3/types.test.ts`
- Modify: `site/src/simulateur-v3/test-fixtures.ts`

**Interfaces:**
- Consumes: persisted schema 4 campaigns created with scenario version 7.
- Produces: scenario version 8 and an explicit `restart_required` result for any incompatible scenario version.

- [ ] **Step 1: Write the migration regression first**

Add a failing test proving that a valid schema 4 save made with scenario version 7 is never restored, replayed or combined with version 8 effects. It returns `restart_required`, preserves the stored payload and never falls back to V2. Keep the schema at 4: the JSON shape is still valid, but its causal semantics changed.

- [ ] **Step 2: Increment the scenario version**

Set `SCENARIO_V3.version` to 8. Do not recalculate past decisions and do not reuse the historical 5-to-6 modeled-effect migration. A scenario-version mismatch always requests a new mandate.

- [ ] **Step 3: Run and commit**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/storage.test.ts src/simulateur-v3/types.test.ts`

Expected: PASS, with version 7 reported as `restart_required`.

```bash
git add site/src/simulateur-v3/scenario.ts site/src/simulateur-v3/storage.ts site/src/simulateur-v3/storage.test.ts site/src/simulateur-v3/types.test.ts site/src/simulateur-v3/test-fixtures.ts
git commit -m "chore: version explicit campaign effects"
```

### Task 5B: Replace mirrored reactions with explicit option mechanisms

**Files:**
- Create: `site/src/simulateur-v3/indicator-meta.ts`
- Create: `site/src/simulateur-v3/indicator-meta.test.ts`
- Modify: `site/src/simulateur-v3/types.ts`
- Modify: `site/src/simulateur-v3/policy-catalogue.ts`
- Modify: `site/src/simulateur-v3/policy-catalogue.test.ts`
- Modify: `site/src/simulateur-v3/policies/*.ts`
- Modify: `site/src/simulateur-v3/scenario.test.ts`
- Modify: `site/src/simulateur-v3/validation.ts`
- Modify: `site/src/simulateur-v3/validation.test.ts`
- Modify: `site/src/simulateur-v3/test-fixtures.ts`

**Interfaces:**
- Consumes: the complete 96-policy catalogue and the selected 60-decision campaign.
- Produces: 193 explicit option definitions, including 121 playable options, with no generated political mirror or capacity fallback.

- [ ] **Step 1: Add failing editorial integrity tests**

```ts
test("chaque option publiée porte un mécanisme, un horizon et un impact visible", () => {
  for (const decision of SCENARIO_V3_CATALOGUE.decisions) {
    for (const option of decision.options) {
      assert.ok(option.mechanism.trim(), `${decision.id}:${option.id}`);
      assert.ok(option.horizon.kind === "immediate"
        || option.horizon.kind === "after_decisions"
        || option.horizon.kind === "mandate_year");
      assert.ok(Array.isArray(option.legalConstraints));
      assert.ok(option.effects.some((effect) =>
        effect.target === "indicator" && effect.key !== "annualBalance"));
    }
  }
});

test("aucun effet n'est dérivé des anciennes réactions", async () => {
  const source = await readFile(new URL("./policy-catalogue.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /supportEffects|MESURES\.(?:reactions|rejet)|measure\.(?:reactions|rejet)/);
  assert.doesNotMatch(source, /V3_MODELED_EFFECT_MARKER.*capacity/);
});
```

Test both all 193 catalogue options and the 121 playable options. In the final code, `V3_MODELED_EFFECT_MARKER` may remain only in the isolated historical 5-to-6 storage migration; it must not mark new editorial effects.

- [ ] **Step 2: Extend the explicit option contract**

```ts
export type PolicyHorizon =
  | { kind: "immediate" }
  | { kind: "after_decisions"; count: number }
  | { kind: "mandate_year"; year: 1 | 2 | 3 | 4 | 5 };

export type DecisionOption = {
  // existing fields
  mechanism: string;
  horizon: PolicyHorizon;
  legalConstraints: string[];
};
```

An empty `legalConstraints` array explicitly means that no specific legal constraint was identified; it is not a missing value. Validate non-empty unique strings when entries exist. `after_decisions` is relative to confirmation and must remain inside the 60-decision campaign. `mandate_year` is absolute and cannot precede the year in which the option is played.

Add the same required fields to `PolicyOptionDefinition` and to both branches of `ExistingPolicyCopy`. Increment each rewritten `Decision.version` from 2 to 3. The type and compiler must make an omitted mechanism impossible.

- [ ] **Step 3: Declare units and meaningful distance thresholds**

Create `INDICATOR_META`, with label, unit, bounds where applicable, display precision and comparison epsilon for every indicator. At minimum:

- `annualBalance`, `interestCost`: millions of euros;
- `debtToGdp`: percent of GDP;
- `growth`: annual nominal GDP growth in percent, matching the sourced Task 4 baseline;
- remaining economic, service and political indicators: documented game indices or percentage-point scales.

Never compare one million euros with one point as if they shared a unit. Preserve `interestCost: 12_000` for euro exit.

Implement a canonical `optionDistanceDimensions(a, b)` that counts materially distinct dimensions across budget, non-budget indicators, groups, horizon, beneficiaries/contributors, legal constraints, locks/unlocks, uncertainty and scheduled consequences. Use indicator-specific epsilons. Every option pair in a published decision must differ on at least two dimensions; a difference below epsilon does not count.

- [ ] **Step 4: Rewrite the catalogue explicitly, then delete generators**

Use the existing 71 `existingPolicy()` dossiers only as an inventory. Write the adopted and maintained effects explicitly in the eight policy modules, including their mechanism, horizon and legal constraints. Complete the 25 standalone policies the same way. Do not mechanically preserve the old opinion-to-majority, business-to-growth, markets-to-growth or local-authority-to-services hypotheses unless the policy definition explicitly justifies that exact effect.

Only after all definitions compile and the tests are green, delete:

- the `Soutien` import;
- `supportEffects()`;
- reads of `measure.reactions` and `measure.rejet`;
- the automatic keep-side inversion;
- the `reformCapacity +/-1` empty-effect fallback.

Every playable option requires at least one non-budget indicator effect because the compact interface must never throw when selecting its primary impact. Budget effects remain optional.

- [ ] **Step 5: Run and commit**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/indicator-meta.test.ts src/simulateur-v3/policy-catalogue.test.ts src/simulateur-v3/scenario.test.ts src/simulateur-v3/validation.test.ts && npx tsc --noEmit`

Expected: PASS with 96 decisions, 193 explicit options, 60 playable decisions and 121 playable options.

```bash
git add site/src/simulateur-v3/indicator-meta.ts site/src/simulateur-v3/indicator-meta.test.ts site/src/simulateur-v3/types.ts site/src/simulateur-v3/policy-catalogue.ts site/src/simulateur-v3/policy-catalogue.test.ts site/src/simulateur-v3/policies site/src/simulateur-v3/scenario.test.ts site/src/simulateur-v3/validation.ts site/src/simulateur-v3/validation.test.ts site/src/simulateur-v3/test-fixtures.ts
git commit -m "feat: declare explicit campaign consequences"
```

### Task 5C: Tie crises to exact aggravating choices

**Files:**
- Modify: `site/src/simulateur-v3/types.ts`
- Modify: `site/src/simulateur-v3/validation.ts`
- Modify: `site/src/simulateur-v3/scenario-crises.ts`
- Modify: `site/src/simulateur-v3/crises.ts`
- Modify: `site/src/simulateur-v3/crises.test.ts`
- Modify: `site/src/simulateur-v3/scenario-crises.test.ts`
- Modify: `site/src/simulateur-v3/flow.ts`
- Modify: `site/src/simulateur-v3/flow.test.ts`
- Modify: `site/src/simulateur-v3/campaign-e2e.test.ts`
- Modify: `site/src/simulateur-v3/storage.test.ts`
- Modify: `site/src/simulateur-v3/test-fixtures.ts`

**Interfaces:**
- Consumes: confirmed decision-option pairs, scenario topology, groups, dependencies and annual checkpoints.
- Produces: eight traceable crisis families, one per chapter, with at most one crisis in a chapter and at most eight in a mandate.

- [ ] **Step 1: Replace decision-only aggravation with exact choices**

```ts
export type CrisisChoiceRef = {
  decisionId: string;
  optionIds: string[];
};

export type CrisisRule = {
  // existing descriptive and threshold fields
  eligibleFromChapterIndex: number;
  maxOccurrences: 1;
  requiredDecisionIds: string[];
  aggravatingChoices: CrisisChoiceRef[];
};
```

`requiredDecisionIds` means that every listed dossier must already have a confirmed record. `aggravatingChoices` means that at least one exact listed option must have been confirmed. Seeing a dossier or selecting its non-aggravating option never counts.

Persist `triggeredAtDecisionCount`, `triggeredChapterIndex` and the exact aggravating decision-option references in `CrisisState`. Derive the chapter from the supplied scenario, not from a stale `triggeredByDecisionId` alone.

- [ ] **Step 2: Make detection scenario-aware and bounded**

Change the signature to `detectCrisis(state, scenario, rules)`. Reject a rule before its zero-based `eligibleFromChapterIndex`, after `maxOccurrences`, when its required decisions are absent, or when no exact aggravating choice matches. Refuse a second major crisis in the same chapter and cap a mandate at eight crises.

Validate that every rule references only known decisions and options from the 60-decision scenario. Each concession must amend a confirmed active policy or apply at least one non-zero, correctly unit-tagged effect.

- [ ] **Step 3: Build eight editorial families and reference trajectories**

Create one family per chapter. A crisis must expose the threshold, the exact aggravating choices and its causal contributions. Do not force a crisis without an aggravating choice merely to satisfy a count.

The runtime invariant is zero to eight conditional crises, at most one per chapter. The editorial target is four to eight on representative full campaigns. Add at least all-prudence, all-rupture and several seeded reference trajectories and require each of those curated paths to encounter four to eight crises. This is an evaluation gate, not a false proof over every possible combination.

- [ ] **Step 4: Add boundary and persistence tests**

Cover all of the following:

- before the eligible chapter: no crisis;
- threshold reached with the wrong option from the right dossier: no crisis;
- all required decisions must be confirmed;
- the same rule cannot repeat;
- a second crisis in the same chapter is refused;
- a crisis may occur in a later chapter;
- every triggered crisis cites at least one exact confirmed aggravating choice;
- crisis occurrence fields survive schema 4 persistence;
- due events and promises still resolve before crisis detection and before the five Councils;
- concessions actually suspend, amend or reverse an active policy, or apply a non-zero effect.

- [ ] **Step 5: Run and commit**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/scenario.test.ts src/simulateur-v3/validation.test.ts src/simulateur-v3/crises.test.ts src/simulateur-v3/scenario-crises.test.ts src/simulateur-v3/flow.test.ts src/simulateur-v3/campaign-e2e.test.ts src/simulateur-v3/storage.test.ts && npx tsc --noEmit`

Expected: PASS with exact option-level causal traces and no more than one crisis per chapter.

```bash
git add site/src/simulateur-v3/types.ts site/src/simulateur-v3/validation.ts site/src/simulateur-v3/scenario-crises.ts site/src/simulateur-v3/crises.ts site/src/simulateur-v3/crises.test.ts site/src/simulateur-v3/scenario-crises.test.ts site/src/simulateur-v3/flow.ts site/src/simulateur-v3/flow.test.ts site/src/simulateur-v3/campaign-e2e.test.ts site/src/simulateur-v3/storage.test.ts site/src/simulateur-v3/test-fixtures.ts
git commit -m "feat: tie crises to aggravating choices"
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
- Modify only if a test reveals a defect: files changed in Tasks 1 to 7.

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
