# Simulateur V3 Core Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic, versioned and testable V3 campaign engine that powers 96 decisions, delayed effects, causal explanations, real policy concessions and automatic recovery without exposing the unfinished V3 interface.

**Architecture:** Add a focused `site/src/simulateur-v3/` domain beside the V2 tunnel. Pure functions own rules and state transitions. Browser storage and analytics stay in adapters. The existing UI keeps using V2 until the later interface plan explicitly switches it.

**Tech Stack:** TypeScript 5.9, Node test runner, Vite 7, browser `localStorage`, existing zero-framework rendering architecture.

## Global Constraints

- Keep the V2 simulator live until the V3 interface and all 96 decisions pass acceptance.
- The V3 campaign always contains exactly 96 decisions in 8 chapters of 12.
- A confirmed decision cannot be deleted for free.
- A concession must suspend, amend or reverse a real prior decision.
- Every state variation records its cause.
- `duration: "annual"` changes an annual run rate once; it is not re-applied on a hidden yearly tick.
- No scheduled effect, event or promise may fall due after decision 96.
- The engine is deterministic for identical scenario version, seed and decisions.
- No dependency is added.
- No portrait, face, bust, coin, seal or avatar is introduced.
- No content served by the site may contain the Unicode character U+2014.
- `npm test` and `npm run build` must pass after every task.
- Do not add user-identifying analytics or store political choices outside the browser.

---

## File map

### New domain files

- `site/src/simulateur-v3/types.ts`: shared domain types and state schema.
- `site/src/simulateur-v3/validation.ts`: catalogue and state invariants.
- `site/src/simulateur-v3/campaign.ts`: campaign creation, selection, confirmation and progression.
- `site/src/simulateur-v3/effects.ts`: immediate and scheduled effect application with causal ledger.
- `site/src/simulateur-v3/crises.ts`: crisis detection and real policy concessions.
- `site/src/simulateur-v3/storage.ts`: V3 save, restore, restart and V2 detection.
- `site/src/simulateur-v3/events.ts`: anonymous V3 analytics events.
- `site/src/simulateur-v3/test-fixtures.ts`: reusable test catalogue only.

### New tests

- `site/src/simulateur-v3/validation.test.ts`
- `site/src/simulateur-v3/campaign.test.ts`
- `site/src/simulateur-v3/effects.test.ts`
- `site/src/simulateur-v3/crises.test.ts`
- `site/src/simulateur-v3/storage.test.ts`
- `site/src/simulateur-v3/events.test.ts`

### Existing files changed

- `site/package.json`: include nested V3 tests in the test command.

The V2 files `tunnel-modele.ts`, `tunnel-rendu.ts`, `tunnel.ts`, `campagne.ts`, `mesures.ts` and `dilemmes.ts` are not modified in this plan.

---

### Task 1: Domain schema and nested test discovery

**Files:**
- Create: `site/src/simulateur-v3/types.ts`
- Create: `site/src/simulateur-v3/types.test.ts`
- Modify: `site/package.json:6-9`

**Interfaces:**
- Produces: all exported types used by Tasks 2 to 7.
- Consumes: no V2 type.

- [ ] **Step 1: Extend the test script and write the schema contract test**

Change the test script to:

```json
"test": "node --experimental-strip-types --test src/*.test.ts src/simulateur-v3/*.test.ts scripts/*.test.ts"
```

Create `site/src/simulateur-v3/types.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { SCHEMA_VERSION, type CampaignState, type Decision, type DecisionOption } from "./types.ts";

test("le schéma V3 représente une décision confirmable et une campagne versionnée", () => {
  const option: DecisionOption = {
    id: "maintenir",
    label: "Maintenir le cap",
    summary: "La politique reste en vigueur.",
    beneficiaries: ["entreprises"],
    contributors: ["budget_public"],
    uncertainty: "moyenne",
    effects: [],
    scheduledEvents: [],
    promises: [],
    fulfillsPromises: [],
    locks: [],
    unlocks: [],
  };
  const decision: Decision = {
    id: "decision-test",
    version: 1,
    chapterId: "chapitre-test",
    title: "Que décider ?",
    context: "Un contexte testable.",
    options: [option],
    evidence: [],
    dependencies: [],
    conflicts: [],
  };
  const state = { schemaVersion: 3, scenarioVersion: 1 } as CampaignState;
  assert.equal(SCHEMA_VERSION, 3);
  assert.equal(decision.options[0]?.id, "maintenir");
  assert.equal(state.schemaVersion, 3);
});
```

- [ ] **Step 2: Run the contract test and verify failure**

Run:

```powershell
Set-Location site
npm test -- --test-name-pattern="schéma V3"
```

Expected: FAIL because `./types.ts` does not exist.

- [ ] **Step 3: Create the complete domain schema**

Create `site/src/simulateur-v3/types.ts` with these exact exported names:

```ts
export type CampaignPhase =
  | "intro"
  | "chapter_intro"
  | "decision"
  | "decision_result"
  | "council"
  | "crisis"
  | "delayed_event"
  | "chapter_verdict"
  | "pause"
  | "verdict";

export const SCHEMA_VERSION = 3 as const;

export type Uncertainty = "faible" | "moyenne" | "forte";
export type DecisionStatus = "confirmed" | "suspended" | "amended" | "reversed";
export type EffectTarget = "indicator" | "group";

export type IndicatorKey =
  | "annualBalance"
  | "debtToGdp"
  | "interestCost"
  | "growth"
  | "employment"
  | "investment"
  | "publicServices"
  | "majority"
  | "reformCapacity"
  | "opinion"
  | "institutionalTrust"
  | "financialCredibility";

export type GroupKey =
  | "lowIncomeHouseholds"
  | "middleClasses"
  | "retirees"
  | "publicEmployees"
  | "privateEmployees"
  | "unions"
  | "businesses"
  | "farmers"
  | "localAuthorities"
  | "creditors"
  | "europeanPartners"
  | "parliamentaryMajority";

export type EvidenceBlock = {
  label: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  note?: string;
};

type EffectRuleBase = {
  id: string;
  delta: number;
  timing: { kind: "immediate" } | { kind: "after_decisions"; count: number };
  duration: "once" | "annual" | "permanent";
  explanation: string;
};

export type EffectRule = EffectRuleBase & (
  | { target: "indicator"; key: IndicatorKey }
  | { target: "group"; key: GroupKey }
);

export type ScheduledEventRule = {
  id: string;
  title: string;
  body: string;
  afterDecisions: number;
  effects: EffectRule[];
};

export type PromiseRule = {
  id: string;
  label: string;
  dueAfterDecisions: number;
  failureEffects: EffectRule[];
};

export type DecisionOption = {
  id: string;
  label: string;
  summary: string;
  beneficiaries: string[];
  contributors: string[];
  uncertainty: Uncertainty;
  effects: EffectRule[];
  scheduledEvents: ScheduledEventRule[];
  promises: PromiseRule[];
  fulfillsPromises: string[];
  locks: string[];
  unlocks: string[];
};

export type Decision = {
  id: string;
  version: number;
  chapterId: string;
  title: string;
  context: string;
  options: DecisionOption[];
  evidence: EvidenceBlock[];
  historicalPrecedent?: { title: string; body: string; sourceUrl: string };
  dependencies: string[];
  conflicts: string[];
};

export type Chapter = {
  id: string;
  title: string;
  domains: [string, string, string, string];
  opening: string;
  tension: string;
  decisionIds: string[];
};

export type Scenario = {
  version: number;
  title: string;
  chapters: Chapter[];
  decisions: Decision[];
};

export type DecisionRecord = {
  decisionId: string;
  optionId: string;
  status: DecisionStatus;
  confirmedAtIndex: number;
  changedByCrisisId?: string;
};

export type ScheduledEvent = {
  id: string;
  sourceDecisionId: string;
  sourceOptionId: string;
  dueAtDecision: number;
  title: string;
  body: string;
  effects: EffectRule[];
};

export type CausalEntry = {
  id: string;
  sourceType: "decision" | "event" | "crisis" | "promise";
  sourceId: string;
  target: EffectTarget;
  key: IndicatorKey | GroupKey;
  delta: number;
  duration: EffectRule["duration"];
  explanation: string;
  appliedAtDecision: number;
};

export type CrisisConcession = {
  id: string;
  label: string;
  targetDecisionId: string;
  policyChange: "suspend" | "amend" | "reverse";
  effects: EffectRule[];
};

export type CrisisRule = {
  id: string;
  title: string;
  body: string;
  indicator: IndicatorKey;
  threshold: number;
  comparator: "lte" | "gte";
  aggravatingDecisionIds: string[];
  concessions: CrisisConcession[];
  holdCourseEffects: EffectRule[];
};

export type CrisisState = {
  ruleId: string;
  triggeredByDecisionId: string;
  aggravatingDecisionIds: string[];
  resolvedBy?: string;
};

export type PoliticalPromise = {
  id: string;
  sourceDecisionId: string;
  label: string;
  dueAtDecision: number;
  fulfilled: boolean;
  failureEffects: EffectRule[];
};

export type IndicatorState = Record<IndicatorKey, number>;
export type GroupState = Record<GroupKey, number>;

export type CampaignState = {
  schemaVersion: typeof SCHEMA_VERSION;
  scenarioVersion: number;
  seed: number;
  phase: CampaignPhase;
  chapterIndex: number;
  decisionIndex: number;
  pendingSelection?: { decisionId: string; optionId: string };
  decisions: DecisionRecord[];
  indicators: IndicatorState;
  groups: GroupState;
  scheduledEvents: ScheduledEvent[];
  eventHistory: ScheduledEvent[];
  activePromises: PoliticalPromise[];
  promiseHistory: PoliticalPromise[];
  activeCrisis?: CrisisState;
  crisisHistory: CrisisState[];
  resolvedCrisisIds: string[];
  causalLedger: CausalEntry[];
  unlockedDecisionIds: string[];
  lockedDecisionIds: string[];
  savedAt: string;
};
```

- [ ] **Step 4: Run type contract, full tests and build**

Run:

```powershell
Set-Location site
npm test -- --test-name-pattern="schéma V3"
npm test
npm run build
```

Expected: all commands PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- site/package.json site/src/simulateur-v3/types.ts site/src/simulateur-v3/types.test.ts
git commit -m "feat: define simulator v3 domain schema"
```

---

### Task 2: Catalogue and state validation

**Files:**
- Create: `site/src/simulateur-v3/validation.ts`
- Create: `site/src/simulateur-v3/validation.test.ts`
- Create: `site/src/simulateur-v3/test-fixtures.ts`

**Interfaces:**
- Consumes: `Scenario`, `CampaignState`, `Decision`, `EffectRule` from `types.ts`.
- Produces: `validateScenario(scenario: Scenario): string[]`, `isCampaignState(value: unknown, scenario: Scenario): value is CampaignState`, `assertNoEmDash(value: unknown): string[]`.

- [ ] **Step 1: Write failing validation tests**

Create tests covering these exact cases:

```ts
test("un scénario valide contient huit chapitres de douze décisions uniques", () => {
  assert.deepEqual(validateScenario(validScenario()), []);
});

test("la validation refuse un scénario incomplet et un choix sans preuve", () => {
  const scenario = validScenario();
  scenario.chapters[0]!.decisionIds.pop();
  scenario.decisions[0]!.evidence = [];
  assert.deepEqual(validateScenario(scenario), [
    "chapter:chapter-1:expected-12-decisions",
    "decision:decision-1:evidence-required",
  ]);
});

test("le contrôle éditorial trouve tout cadratin dans un objet imbriqué", () => {
  assert.deepEqual(assertNoEmDash({ title: "Avant\u2014après", nested: ["ok"] }), ["$.title"]);
});

test("un état V2 n'est jamais accepté comme état V3", () => {
  assert.equal(isCampaignState({ version: 2, phase: "conseil" }, validScenario()), false);
});
```

`validScenario()` in `test-fixtures.ts` must return 8 chapters and 96 generated test decisions. Each decision has 2 complete options and 1 evidence item. Test fixture copy must use only ASCII hyphens.

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
Set-Location site
npm test -- --test-name-pattern="validation|scénario valide|cadratin|état V2"
```

Expected: FAIL because validation exports do not exist.

- [ ] **Step 3: Implement recursive editorial validation**

Implement `assertNoEmDash` as a recursive walk over strings, arrays and plain objects. Return JSON-like paths such as `$.chapters[0].title`. Do not mutate the input.

Implement `validateScenario` with deterministic error order:

1. scenario version is a positive integer;
2. exactly 8 chapters;
3. each chapter has exactly 12 IDs;
4. exactly 96 decisions;
5. all decision IDs and option IDs are unique within their scopes;
6. every chapter ID resolves to a decision in that chapter;
7. every decision has 2 to 4 options;
8. every decision has evidence;
9. every option has beneficiaries, contributors and at least one effect or scheduled event;
10. every delayed count is a positive integer;
11. every scheduled event ID and promise ID is globally unique;
12. effects inside a scheduled event or promise failure use `timing.kind === "immediate"`, because the parent rule already owns the due date;
13. every direct delay, scheduled event and promise is due no later than decision 96 from its decision position;
14. every `locks` and `unlocks` ID resolves to a scenario decision, with unique and disjoint lists;
15. every `fulfillsPromises` ID resolves to a promise declared in the scenario;
16. every effect ID is unique within its option and every derived delayed-event ID is unique against explicit scheduled-event IDs;
17. every source URL begins with `https://`;
18. no U+2014 occurs anywhere.

Implement `isCampaignState` by checking schema version 3, matching scenario version, chapter index 0 through 7, decision index 0 through 11, unique sequential decision records, arrays, sources tied to an actually confirmed decision and option, pending selection tied to the current unlocked decision, disjoint lock lists, finite indicator values, reachable due dates through decision 96 and a parseable `savedAt` date.

- [ ] **Step 4: Run focused and full verification**

Run:

```powershell
Set-Location site
npm test -- --test-name-pattern="validation|scénario valide|cadratin|état V2"
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- site/src/simulateur-v3/validation.ts site/src/simulateur-v3/validation.test.ts site/src/simulateur-v3/test-fixtures.ts
git commit -m "feat: validate simulator v3 scenarios"
```

---

### Task 3: Deterministic campaign initialization and progression

**Files:**
- Create: `site/src/simulateur-v3/campaign.ts`
- Create: `site/src/simulateur-v3/campaign.test.ts`

**Interfaces:**
- Consumes: `Scenario`, `CampaignState`, `Decision`, `DecisionOption` from `types.ts` and `validateScenario` from `validation.ts`.
- Produces: `createCampaign(scenario: Scenario, seed?: number): CampaignState`, `currentDecision(state: CampaignState, scenario: Scenario): Decision | null`, `selectOption(state: CampaignState, scenario: Scenario, decisionId: string, optionId: string): CampaignState`, `clearSelection(state: CampaignState): CampaignState`, `advanceAfterResult(state: CampaignState, scenario: Scenario): CampaignState`.

- [ ] **Step 1: Write failing campaign tests**

Add these contracts:

```ts
test("une campagne neuve commence avant le premier chapitre", () => {
  const state = createCampaign(validScenario(), 42);
  assert.equal(state.schemaVersion, 3);
  assert.equal(state.seed, 42);
  assert.equal(state.phase, "intro");
  assert.equal(state.decisions.length, 0);
});

test("la décision courante suit les huit chapitres dans leur ordre éditorial", () => {
  const scenario = validScenario();
  const state = { ...createCampaign(scenario, 42), phase: "decision" as const };
  assert.equal(currentDecision(state, scenario)?.id, scenario.chapters[0]!.decisionIds[0]);
});

test("sélectionner ne confirme pas et peut être annulé", () => {
  const scenario = validScenario();
  const started = { ...createCampaign(scenario), phase: "decision" as const };
  const selected = selectOption(started, scenario, "decision-1", "decision-1-option-a");
  assert.deepEqual(selected.pendingSelection, { decisionId: "decision-1", optionId: "decision-1-option-a" });
  assert.equal(selected.decisions.length, 0);
  assert.equal(clearSelection(selected).pendingSelection, undefined);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
Set-Location site
npm test -- --test-name-pattern="campagne neuve|décision courante|sélectionner"
```

Expected: FAIL because `campaign.ts` does not exist.

- [ ] **Step 3: Implement initialization and phase progression**

Export and freeze these exact baselines, clone them into each new state and never mutate a passed state:

```ts
export const INITIAL_INDICATORS = Object.freeze({
  annualBalance: -153_000,
  debtToGdp: 115.7,
  interestCost: 55_000,
  growth: 0.9,
  employment: 100,
  investment: 100,
  publicServices: 55,
  majority: 62,
  reformCapacity: 68,
  opinion: 58,
  institutionalTrust: 44,
  financialCredibility: 50,
});

export const INITIAL_GROUPS = Object.freeze({
  lowIncomeHouseholds: 50,
  middleClasses: 50,
  retirees: 50,
  publicEmployees: 50,
  privateEmployees: 50,
  unions: 50,
  businesses: 50,
  farmers: 50,
  localAuthorities: 50,
  creditors: 50,
  europeanPartners: 50,
  parliamentaryMajority: 50,
});
```

Initialize `savedAt` to `1970-01-01T00:00:00.000Z`, `eventHistory`, `promiseHistory` and `crisisHistory` to empty arrays and every other collection to a fresh empty array. This keeps campaign creation deterministic. Storage replaces the timestamp on the first save.

`createCampaign` must call `validateScenario` and throw `Invalid scenario: <errors joined by comma>` when errors exist.

`advanceAfterResult` must implement:

- after decision 4 and 8 in a chapter: `council`;
- after decision 12 in chapters 1 to 7: `chapter_verdict`;
- after decision 12 in chapter 8: `verdict`;
- otherwise: increment `decisionIndex` and return `decision`;
- advancing from `council`: increment `decisionIndex` and return `decision`;
- advancing from `chapter_verdict`: increment chapter, reset decision index and return `chapter_intro`;
- advancing from `chapter_intro`: return `decision`.

Throw on unknown decision IDs, option IDs, locked decisions or selecting outside phase `decision`.

- [ ] **Step 4: Verify all campaign transitions**

Add table tests for decision counts 4, 8, 12, 16, 92 and 96. Run:

```powershell
Set-Location site
npm test -- --test-name-pattern="campagne|chapitre|Conseil|verdict"
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- site/src/simulateur-v3/campaign.ts site/src/simulateur-v3/campaign.test.ts
git commit -m "feat: add simulator v3 campaign progression"
```

---

### Task 4: Confirmed decisions, effects and causal ledger

**Files:**
- Create: `site/src/simulateur-v3/effects.ts`
- Create: `site/src/simulateur-v3/effects.test.ts`
- Modify: `site/src/simulateur-v3/campaign.ts`
- Modify: `site/src/simulateur-v3/campaign.test.ts`

**Interfaces:**
- Consumes: all state and rule types from `types.ts`.
- Produces: `applyEffect(state: CampaignState, effect: EffectRule, cause: EffectCause): CampaignState`, `scheduleOptionConsequences(state: CampaignState, decision: Decision, option: DecisionOption): CampaignState`, `resolveDueEvents(state: CampaignState): { state: CampaignState; events: ScheduledEvent[] }`, `resolveDuePromises(state: CampaignState): { state: CampaignState; failedPromiseIds: string[] }`, `confirmSelection(state: CampaignState, scenario: Scenario): CampaignState`.
- `EffectCause` is exported as `{ sourceType: CausalEntry["sourceType"]; sourceId: string }`.

- [ ] **Step 1: Write failing effect tests**

Add these exact helpers above the tests in `effects.test.ts`:

```ts
import type { EffectRule, IndicatorKey, Scenario } from "./types.ts";
import { createCampaign, selectOption } from "./campaign.ts";
import { validScenario } from "./test-fixtures.ts";

function scenarioWithEffect(key: IndicatorKey, delta: number, timing: EffectRule["timing"]): Scenario {
  const scenario = validScenario();
  const option = scenario.decisions[0]!.options[0]!;
  option.effects = [{
    id: "effect-1",
    target: "indicator",
    key,
    delta,
    timing,
    duration: "once",
    explanation: "Effet test",
  }];
  return scenario;
}

function startAtFirstDecision(scenario: Scenario) {
  return { ...createCampaign(scenario, 42), phase: "decision" as const };
}

function confirmFirstDecision(scenario: Scenario) {
  const started = startAtFirstDecision(scenario);
  return confirmSelection(selectOption(started, scenario, "decision-1", "decision-1-option-a"), scenario);
}
```

Then add these exact behavioral tests:

```ts
test("confirmer applique les effets immédiats une seule fois", () => {
  const scenario = scenarioWithEffect("annualBalance", 1_000, { kind: "immediate" });
  const started = startAtFirstDecision(scenario);
  const selected = selectOption(started, scenario, "decision-1", "decision-1-option-a");
  const confirmed = confirmSelection(selected, scenario);
  assert.equal(confirmed.indicators.annualBalance, started.indicators.annualBalance + 1_000);
  assert.equal(confirmed.decisions[0]?.status, "confirmed");
  assert.equal(confirmed.phase, "decision_result");
  assert.throws(() => confirmSelection(confirmed, scenario), /selection required/);
});

test("un effet différé attend le bon nombre de décisions", () => {
  const scenario = scenarioWithEffect("growth", -0.4, { kind: "after_decisions", count: 2 });
  const confirmed = confirmFirstDecision(scenario);
  assert.equal(confirmed.indicators.growth, INITIAL_INDICATORS.growth);
  assert.equal(confirmed.scheduledEvents[0]?.dueAtDecision, 3);
});

test("chaque variation conserve sa cause lisible", () => {
  const scenario = scenarioWithEffect("opinion", -4, { kind: "immediate" });
  const confirmed = confirmFirstDecision(scenario);
  assert.deepEqual(confirmed.causalLedger.at(-1), {
    id: "decision:decision-1:decision-1-option-a:effect-1:1",
    sourceType: "decision",
    sourceId: "decision-1:decision-1-option-a",
    target: "indicator",
    key: "opinion",
    delta: -4,
    explanation: "Effet test",
    appliedAtDecision: 1,
  });
});

test("une promesse échue applique son coût et quitte les promesses actives", () => {
  const scenario = validScenario();
  const option = scenario.decisions[0]!.options[0]!;
  option.promises = [{
    id: "promise-1",
    label: "Compenser les ménages",
    dueAfterDecisions: 1,
    failureEffects: [{
      id: "promise-opinion",
      target: "indicator",
      key: "opinion",
      delta: -6,
      timing: { kind: "immediate" },
      duration: "once",
      explanation: "La compensation promise n'est pas arrivée.",
    }],
  }];
  const confirmed = confirmFirstDecision(scenario);
  const due = { ...confirmed, decisions: [
    ...confirmed.decisions,
    { decisionId: "decision-2", optionId: "decision-2-option-a", status: "confirmed" as const, confirmedAtIndex: 2 },
  ] };
  const resolved = resolveDuePromises(due);
  assert.deepEqual(resolved.failedPromiseIds, ["promise-1"]);
  assert.equal(resolved.state.activePromises.length, 0);
  assert.equal(resolved.state.indicators.opinion, confirmed.indicators.opinion - 6);
  assert.equal(resolved.state.causalLedger.at(-1)?.sourceType, "promise");
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
Set-Location site
npm test -- --test-name-pattern="effets immédiats|effet différé|conserve sa cause"
```

Expected: FAIL because effect functions do not exist.

- [ ] **Step 3: Implement immutable effect application**

`applyEffect` must:

- clone only the modified state branches;
- add `delta` to the correct indicator or group;
- reject non-finite deltas;
- clamp every group and only these indicators to 0 through 100: `publicServices`, `majority`, `reformCapacity`, `opinion`, `institutionalTrust`, `financialCredibility`;
- append one `CausalEntry` with a stable deterministic ID;
- copy `duration` into the causal entry so the journal distinguishes one-off, annual-rate and permanent effects;
- never apply delayed effects directly.

`confirmSelection` must:

1. require phase `decision` and a pending selection matching the current decision;
2. reject a duplicate decision record;
3. append a `confirmed` record;
4. apply immediate effects;
5. schedule delayed effects and explicit events;
6. add political promises;
7. mark active promises named by `fulfillsPromises` as fulfilled;
8. apply locks and unlocks;
9. clear the pending selection;
10. set phase `decision_result`.

`scheduleOptionConsequences` copies every effect and nested timing object before storing it. It rejects a due date above decision 96. `resolveDueEvents` returns the due events, removes them from the queue and appends them to `eventHistory` after applying their immediate effects with source type `event`. `scheduledEvents` and `eventHistory` have unique, disjoint IDs. Decision causal source IDs use the exact format `<decisionId>:<optionId>`. Event causal source IDs use the event `id` and remain verifiable through `eventHistory`.

`resolveDuePromises` compares each promise's `dueAtDecision` with `state.decisions.length`. Every due promise leaves `activePromises` and enters `promiseHistory`. `activePromises` and `promiseHistory` have unique, disjoint IDs. Fulfilled promises have no penalty. Unfulfilled due promises apply their immediate failure effects with source type `promise` and return their IDs. Non-due promises remain unchanged.

- [ ] **Step 4: Run focused, full and build verification**

Run:

```powershell
Set-Location site
npm test -- --test-name-pattern="effets immédiats|effet différé|conserve sa cause|promesse|verrou"
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- site/src/simulateur-v3/effects.ts site/src/simulateur-v3/effects.test.ts site/src/simulateur-v3/campaign.ts site/src/simulateur-v3/campaign.test.ts
git commit -m "feat: apply simulator v3 decisions and effects"
```

---

### Task 5: Traceable crises and real policy concessions

**Files:**
- Create: `site/src/simulateur-v3/crises.ts`
- Create: `site/src/simulateur-v3/crises.test.ts`

**Interfaces:**
- Consumes: `CampaignState`, `Scenario`, `CrisisRule`, `CrisisConcession` and `applyEffect`.
- Produces: `detectCrisis(state: CampaignState, rules: readonly CrisisRule[]): CampaignState`, `availableConcessions(state: CampaignState, rules: readonly CrisisRule[]): CrisisConcession[]`, `resolveCrisis(state: CampaignState, rules: readonly CrisisRule[], resolutionId: string): CampaignState`.
- The reserved resolution ID `hold-course` applies `holdCourseEffects` and changes no decision record.

- [ ] **Step 1: Write failing crisis tests**

Add these exact fixtures above the tests in `crises.test.ts`:

```ts
import type { CampaignState, CrisisRule, DecisionRecord, EffectRule } from "./types.ts";
import { createCampaign } from "./campaign.ts";
import { validScenario } from "./test-fixtures.ts";

const majorityCost: EffectRule = {
  id: "majority-cost",
  target: "indicator",
  key: "majority",
  delta: -12,
  timing: { kind: "immediate" },
  duration: "once",
  explanation: "La majorité se fracture.",
};

function socialCrisisRule(): CrisisRule {
  return {
    id: "social-crisis",
    title: "La rue bloque le pays",
    body: "Plusieurs décisions ont cristallisé la mobilisation.",
    indicator: "opinion",
    threshold: 20,
    comparator: "lte",
    aggravatingDecisionIds: ["pensions", "fuel-tax"],
    concessions: [{
      id: "suspend-pensions",
      label: "Suspendre la réforme des retraites",
      targetDecisionId: "pensions",
      policyChange: "suspend",
      effects: [{
        id: "concession-opinion",
        target: "indicator",
        key: "opinion",
        delta: 10,
        timing: { kind: "immediate" },
        duration: "once",
        explanation: "La suspension apaise une partie du conflit.",
      }],
    }],
    holdCourseEffects: [majorityCost],
  };
}

function stateWithConfirmedDecisions(ids: string[]): CampaignState {
  const state = createCampaign(validScenario(), 42);
  const decisions: DecisionRecord[] = ids.map((decisionId, index) => ({
    decisionId,
    optionId: "adopt",
    status: "confirmed",
    confirmedAtIndex: index + 1,
  }));
  return { ...state, phase: "decision_result", decisions };
}

function stateInSocialCrisis(): CampaignState {
  const state = stateWithConfirmedDecisions(["pensions", "fuel-tax"]);
  return {
    ...state,
    phase: "crisis",
    activeCrisis: {
      ruleId: "social-crisis",
      triggeredByDecisionId: "fuel-tax",
      aggravatingDecisionIds: ["pensions", "fuel-tax"],
    },
    crisisHistory: [],
  };
}

function stateInSocialCrisisWithoutDecision(decisionId: string): CampaignState {
  const state = stateInSocialCrisis();
  return { ...state, decisions: state.decisions.filter((entry) => entry.decisionId !== decisionId) };
}
```

Cover these exact contracts:

```ts
test("une crise cite la décision déclencheuse et les décisions aggravantes", () => {
  const state = stateWithConfirmedDecisions(["pensions", "fuel-tax"]);
  state.indicators.opinion = 19;
  const triggered = detectCrisis(state, [socialCrisisRule()]);
  assert.deepEqual(triggered.activeCrisis, {
    ruleId: "social-crisis",
    triggeredByDecisionId: "fuel-tax",
    aggravatingDecisionIds: ["pensions", "fuel-tax"],
  });
  assert.equal(triggered.phase, "crisis");
});

test("une concession suspend réellement une décision confirmée", () => {
  const state = stateInSocialCrisis();
  const resolved = resolveCrisis(state, [socialCrisisRule()], "suspend-pensions");
  assert.equal(resolved.decisions.find((entry) => entry.decisionId === "pensions")?.status, "suspended");
  assert.equal(resolved.decisions.find((entry) => entry.decisionId === "pensions")?.changedByCrisisId, "social-crisis");
  assert.equal(resolved.activeCrisis, undefined);
});

test("une concession indisponible n'est jamais proposée", () => {
  const state = stateInSocialCrisisWithoutDecision("pensions");
  assert.deepEqual(availableConcessions(state, [socialCrisisRule()]).map((item) => item.id), []);
});

test("maintenir le cap applique son coût politique et garde la réforme", () => {
  const state = stateInSocialCrisis();
  const resolved = resolveCrisis(state, [socialCrisisRule()], "hold-course");
  assert.equal(resolved.decisions.find((entry) => entry.decisionId === "pensions")?.status, "confirmed");
  assert.ok(resolved.indicators.majority < state.indicators.majority);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
Set-Location site
npm test -- --test-name-pattern="crise cite|concession suspend|indisponible|maintenir le cap"
```

Expected: FAIL because `crises.ts` does not exist.

- [ ] **Step 3: Implement crisis rules**

`detectCrisis` must:

- do nothing when a crisis is already active;
- ignore resolved crisis IDs;
- evaluate rules in declaration order;
- require the threshold and at least one confirmed aggravating decision;
- use the most recently confirmed aggravating decision as trigger;
- enter phase `crisis`.

`availableConcessions` must filter concessions whose target decision is currently `confirmed` or `amended`.

The ID `hold-course` is reserved. It is never a valid concession ID. `resolveCrisis` handles it before looking up concessions and applies only `holdCourseEffects`.

`resolveCrisis` must:

- reject a resolution not offered by the active rule;
- update the target decision status for suspend, amend or reverse;
- set `changedByCrisisId`;
- apply concession or hold course effects with source type `crisis`;
- append the rule ID once to `resolvedCrisisIds`;
- append the active crisis with `resolvedBy` to `crisisHistory`;
- clear `activeCrisis`;
- return phase `decision_result` so the player can read the result.

- [ ] **Step 4: Verify crises and regression suite**

Run:

```powershell
Set-Location site
npm test -- --test-name-pattern="crise|concession|maintenir le cap"
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- site/src/simulateur-v3/crises.ts site/src/simulateur-v3/crises.test.ts
git commit -m "feat: add traceable simulator v3 crises"
```

---

### Task 6: Versioned persistence and V2 handoff

**Files:**
- Create: `site/src/simulateur-v3/storage.ts`
- Create: `site/src/simulateur-v3/storage.test.ts`

**Interfaces:**
- Consumes: `CampaignState`, `Scenario`, `isCampaignState`.
- Produces: `V3_STORAGE_KEY`, `saveCampaign(storage: StorageLike, state: CampaignState, now?: Date): CampaignState`, `restoreCampaign(storage: StorageLike, scenario: Scenario): RestoreResult`, `clearCampaign(storage: StorageLike): void`.
- `RestoreResult` is `{ kind: "restored"; state: CampaignState } | { kind: "new" } | { kind: "v2_found" } | { kind: "invalid" } | { kind: "unavailable" }`.
- `StorageLike` is `{ getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }`.

- [ ] **Step 1: Write failing persistence tests**

Add this exact helper above the tests in `storage.test.ts`:

```ts
import type { StorageLike } from "./storage.ts";

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}
```

Add tests for:

```ts
test("une campagne V3 sauvegardée est restaurée sans perte", () => {
  const storage = memoryStorage();
  const scenario = validScenario();
  const state = createCampaign(scenario, 42);
  saveCampaign(storage, state, new Date("2026-08-27T12:00:00.000Z"));
  assert.deepEqual(restoreCampaign(storage, scenario), {
    kind: "restored",
    state: { ...state, savedAt: "2026-08-27T12:00:00.000Z" },
  });
});

test("une sauvegarde V2 est détectée mais jamais convertie silencieusement", () => {
  const storage = memoryStorage({ "tunnel-partie": JSON.stringify({ version: 2, phase: "conseil" }) });
  assert.deepEqual(restoreCampaign(storage, validScenario()), { kind: "v2_found" });
});

test("un scénario mis à jour invalide proprement l'ancienne campagne", () => {
  const storage = memoryStorage();
  const oldScenario = validScenario();
  saveCampaign(storage, createCampaign(oldScenario));
  const newScenario = { ...oldScenario, version: oldScenario.version + 1 };
  assert.deepEqual(restoreCampaign(storage, newScenario), { kind: "invalid" });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
Set-Location site
npm test -- --test-name-pattern="sauvegardée|sauvegarde V2|scénario mis à jour"
```

Expected: FAIL because `storage.ts` does not exist.

- [ ] **Step 3: Implement persistence**

Use `localStorage` through the injected `StorageLike`. The V3 key is exactly `simulateur-v3-campaign`. Save JSON only after replacing `savedAt` with `now.toISOString()`.

Restoration order:

1. inspect V3 key;
2. when absent, inspect legacy key `tunnel-partie` and return `v2_found` when it contains version 2;
3. parse V3 JSON;
4. validate with `isCampaignState`;
5. return `invalid` on parse, version or invariant failure;
6. return `unavailable` when `getItem` throws;
7. never delete data during restore;
8. `saveCampaign` returns the timestamped in-memory state even when `setItem` throws;
9. `clearCampaign` removes only the V3 key and does not throw when storage is unavailable.

- [ ] **Step 4: Run persistence and full verification**

Run:

```powershell
Set-Location site
npm test -- --test-name-pattern="sauvegard|restaur|scénario mis à jour"
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- site/src/simulateur-v3/storage.ts site/src/simulateur-v3/storage.test.ts
git commit -m "feat: persist simulator v3 campaigns"
```

---

### Task 7: Anonymous domain analytics

**Files:**
- Create: `site/src/simulateur-v3/events.ts`
- Create: `site/src/simulateur-v3/events.test.ts`

**Interfaces:**
- Produces: `SimulatorV3Event`, `emitSimulatorV3Event(detail: SimulatorV3Event, target?: EventTarget): void`.
- Consumes: chapter number, decision position and event type only. It never consumes `CampaignState` directly.

- [ ] **Step 1: Write failing event tests**

Use this union contract:

```ts
export type SimulatorV3Event =
  | { type: "campaign_started" }
  | { type: "decision_viewed"; chapter: number; position: number }
  | { type: "analysis_opened"; chapter: number; position: number }
  | { type: "decision_confirmed"; chapter: number; position: number }
  | { type: "campaign_resumed"; chapter: number; position: number }
  | { type: "crisis_triggered"; crisisId: string }
  | { type: "concession_selected"; crisisId: string; resolutionId: string }
  | { type: "chapter_completed"; chapter: number }
  | { type: "campaign_completed" }
  | { type: "verdict_shared" }
  | { type: "campaign_restarted" };
```

Test that `emitSimulatorV3Event({ type: "decision_confirmed", chapter: 2, position: 7 }, target)` dispatches one `CustomEvent` named `simulateur-v3:evenement` with exactly that detail.

Add a source-level assertion that `events.ts` contains none of these keys: `decisionId`, `optionId`, `userId`, `email`, `territoire`.

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
Set-Location site
npm test -- --test-name-pattern="domain analytics|decision_confirmed"
```

Expected: FAIL because `events.ts` does not exist.

- [ ] **Step 3: Implement the event adapter**

`emitSimulatorV3Event` returns without error when neither a target nor `document` exists. Otherwise it dispatches:

```ts
new CustomEvent<SimulatorV3Event>("simulateur-v3:evenement", { detail })
```

Do not add network transport in this task.

- [ ] **Step 4: Verify events, no forbidden fields and full build**

Run:

```powershell
Set-Location site
npm test -- --test-name-pattern="domain analytics|decision_confirmed"
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- site/src/simulateur-v3/events.ts site/src/simulateur-v3/events.test.ts
git commit -m "feat: add anonymous simulator v3 events"
```

---

### Task 8: Core engine verification gate

**Files:**
- Modify only if a verification failure identifies a defect in `site/src/simulateur-v3/`.

**Interfaces:**
- Consumes: every public interface defined in Tasks 1 to 7.
- Produces: a green, unexposed V3 engine ready for the interface plan.

- [ ] **Step 1: Run formatting and forbidden copy checks**

Run:

```powershell
$v3 = Get-ChildItem -LiteralPath site/src/simulateur-v3 -File
$bad = $v3 | Select-String -SimpleMatch ([char]0x2014)
if ($bad) { $bad; exit 1 }
git diff --check
```

Expected: no output and exit code 0.

- [ ] **Step 2: Run all tests twice to expose shared-state leaks**

Run:

```powershell
Set-Location site
npm test
npm test
```

Expected: both runs PASS with the same test count.

- [ ] **Step 3: Run the production build**

Run:

```powershell
Set-Location site
npm run build
```

Expected: TypeScript checks, Vite build and prerender all PASS.

- [ ] **Step 4: Confirm V2 is still the production entry point**

Run:

```powershell
rg -n 'import \{ afficherTunnel \} from "\./tunnel\.ts"' site/src/main.ts
rg -n 'simulateur-v3' site/src/main.ts
```

Expected: the V2 import is present and `main.ts` contains no V3 import.

- [ ] **Step 5: Commit only if verification required a fix**

```powershell
git add -- site/src/simulateur-v3 site/package.json
git commit -m "fix: harden simulator v3 core engine"
```

If no file changed, do not create an empty commit.

## Completion gate

This plan is complete only when:

- the new nested test suite is discovered by `npm test`;
- all scenario and state invariants pass;
- a decision is selected before it is confirmed;
- confirmed effects are applied once;
- delayed effects resolve at the declared decision count;
- every variation has a causal entry;
- a crisis names its trigger and aggravating decisions;
- a concession changes a prior decision status;
- V2 saves are detected without conversion;
- V3 saves round-trip through storage;
- analytics contain no decision or identity fields;
- U+2014 is absent from the V3 domain;
- V2 remains the production simulator;
- `npm test` and `npm run build` pass.

The next independent plan wires this engine to the approved first-board interface without exposing incomplete editorial content.
