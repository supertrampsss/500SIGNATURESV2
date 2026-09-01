# Simulator Interaction Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every policy option selectable, add a real undo button, remove chapter labels, and separate cumulative security measures.

**Architecture:** Keep the existing event-delegated controller and immutable campaign state. Add a replay-based undo operation so derived state is rebuilt from the baseline, then reshape only the V11 catalogue definitions whose options are cumulative.

**Tech Stack:** TypeScript, Node test runner, Vite, Playwright.

## Global Constraints

- One click records a policy choice.
- No confirmation screen.
- No chapter label in the command bar or decision eyebrow.
- Return must remove the previous decision and all derived effects.
- All 55 catalogue cards and every option must be covered by interaction tests.

---

### Task 1: Lock the visible navigation contract

**Files:**
- Modify: `site/src/simulateur-v3/render.test.ts`
- Modify: `site/src/simulateur-v3/controller.test.ts`

**Interfaces:**
- Consumes: `renderSimulatorV3(state, scenario)` and `mountSimulatorV3(host, scenario, dependencies)`.
- Produces: failing assertions for global progress, Return, and the absence of chapter labels.

- [ ] Add render assertions for `Dossier 1 sur 45`, `data-v3-action="undo"`, and no `/Chapitre \d/`.
- [ ] Add a controller test that makes two decisions, invokes `undo`, and expects one decision plus the first decision's reconstructed indicators.
- [ ] Run `npm test -- --test-name-pattern="retour|progression"` from `site`; expect failure before implementation.

### Task 2: Implement replay-based undo and the simplified header

**Files:**
- Modify: `site/src/simulateur-v3/campaign.ts`
- Modify: `site/src/simulateur-v3/controller.ts`
- Modify: `site/src/simulateur-v3/render.ts`
- Modify: `site/src/style.css`

**Interfaces:**
- Produces: `undoLastDecision(state: CampaignState, scenario: Scenario, crisisRules: readonly CrisisRule[]): CampaignState`.
- The controller action is `data-v3-action="undo"`.

- [ ] Implement `undoLastDecision` by creating the same seeded campaign and replaying all confirmed records except the last through `selectOption`, `confirmSelection`, and visible-phase advancement.
- [ ] Render Return before the global dossier counter and remove both chapter progress elements.
- [ ] Remove the chapter name and number from the decision eyebrow.
- [ ] Handle `undo` in the controller, persist, render, focus the returned dossier and emit no confirmation event.
- [ ] Run the focused tests; expect pass.

### Task 3: Prove every option is selectable

**Files:**
- Modify: `site/src/simulateur-v3/controller.test.ts`
- Modify: `site/src/simulateur-v3/render.test.ts`

**Interfaces:**
- Consumes: all options from `SCENARIO_V11_CATALOGUE`.
- Produces: a table-driven clickability test with a fresh state per decision.

- [ ] Add a test that constructs a decision state for each V11 card and clicks every `data-v3-action="select"` option.
- [ ] Assert the saved record contains the exact option id for every iteration.
- [ ] Add a named regression assertion for `v11-09-age-retraite:option-3`.
- [ ] Run `npm test`; expect pass.

### Task 4: Separate cumulative security measures

**Files:**
- Modify: `site/src/simulateur-v3/scenario-v11-copy.ts`
- Modify: `site/src/simulateur-v3/scenario-v11-catalogue.ts`
- Modify: `site/src/simulateur-v3/scenario-v11-catalogue.test.ts`
- Modify: `site/src/simulateur-v3/adaptive-plan.ts`

**Interfaces:**
- Produces: independent yes/no decisions for police-gendarmerie, justice, and prison capacity while preserving a 55-card library and 45-card session.

- [ ] Replace three less useful or duplicate adaptive cards only where necessary to keep the catalogue at 55.
- [ ] Give each security decision a neutral option and a funded option using the existing V10 budget profile.
- [ ] Update expected catalogue copy and session-role ids.
- [ ] Test that one seeded campaign can include and select all three measures.
- [ ] Run the catalogue and adaptive-plan tests; expect pass.

### Task 5: Verify interaction rendering

**Files:**
- Modify: `site/tests/simulateur-v3.spec.ts` if the existing Playwright test file uses a different exact name, modify that existing simulator spec instead.

**Interfaces:**
- Consumes: built V11 simulator.
- Produces: desktop and 390 px interaction evidence.

- [ ] Start the test server with `npm run test:mobile390:server`.
- [ ] Run `npm run test:mobile390`; expect no horizontal overflow and usable Return, details and retirement option.
- [ ] Capture screenshots for the first decision, retirement decision, security decision and open detail sheet.
- [ ] Commit interaction changes with `fix: make simulator choices reversible and clickable`.
