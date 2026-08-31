# V3 Compact Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Implement one task at a time with TDD, independent review and visual verification.

**Goal:** Make the 60-decision campaign fast to scan on mobile while making selection, confirmation and causal impact unmistakable.

**Architecture:** Apply the locked visual direction from `2026-08-30-v3-direction-design-addendum.md`, then put a pure presentation model between campaign state and HTML. Keep one compact dossier on screen, make selection reversible, store an exact before/after result snapshot at confirmation, retain that result until explicit continuation, use native accessible disclosure for evidence, and restore focus/scroll only when the campaign actually changes scene.

**Tech stack:** existing TypeScript and CSS, semantic HTML, Node test runner, existing V3 campaign/controller/renderer. No framework migration.

## Global constraints

- Execute the complete engine plan first. This interface consumes the 60-decision scenario, explicit mechanisms, unit metadata, option horizons, exact crisis causes, five checkpoints and multidimensional verdict.
- Target 390 x 844 first, then 1440 x 900 and 200 percent text zoom.
- No horizontal overflow at 390, 640 or 1440 px.
- Campaign command bar has at most two visual rows and measures at most 84 px mobile or 64 px desktop.
- Mobile decision title is 26 to 32 px. Body copy remains readable and unclipped at zoom.
- A closed option shows label, budget when present, one principal effect and one risk. It never throws when optional presentation data is absent.
- Options are neutral until selected. DOM position never determines colour.
- No decision illustration and no crisis SVG at any viewport.
- Selection applies no effect. Confirmation applies once. Result remains until explicit continuation.
- A result shows at most three changed indicator metrics, each with before, after, signed delta, cause, horizon and uncertainty. Group-only changes may appear in details, not in the indicator table.
- Evidence and sources remain keyboard reachable without a custom modal lifecycle.
- Every positive/negative/crisis signal has text or a sign in addition to colour.
- No em dash in user-facing copy.

## File structure

- Create `site/src/simulateur-v3/presentation.ts` and tests.
- Create `site/src/simulateur-v3/design-contract.test.ts`.
- Modify campaign `types.ts`, `effects.ts`, `validation.ts`, `storage.ts` and tests to persist decision impact snapshots.
- Modify `render.ts`, `controller.ts`, `main.ts`, interface/e2e/flow/verdict tests and their DOM host types.
- Modify canonical tokens in `style.css`, aliases in `fondations.css`/`navigation.css`, and V3 layout in `styles/simulateur-v3.css`.

### Task 0: Lock tokens, chrome and static state contracts

**Files:**
- Create: `site/src/simulateur-v3/design-contract.test.ts`
- Modify: `site/src/style.css`
- Modify: `site/src/styles/fondations.css`
- Modify: `site/src/styles/navigation.css`
- Modify: `site/src/styles/simulateur-v3.css`
- Modify: `site/src/main.ts`
- Modify: `site/src/interface.test.ts`

- [ ] RED tests fail for an undefined custom property, `--espace-9`, a positional option selector such as `:first-child`/`:nth-child`, an option/crisis illustration, theme controls below 44 px, divergent active-navigation motifs or a command bar without explicit two-row/height bounds.
- [ ] Define one canonical primitive layer for navy, paper, ink, red, semantic green/warning, spacing 4/8/12/16/24/32, radii and focus. `--ui-*` and `--v3-*` may remain only as aliases.
- [ ] Keep France/Territoires/editorial pages on the selected global theme. The mission intro keeps the global header; after campaign start, controller/main set an explicit root/session attribute and the two-row V3 command bar replaces it. Exit remains visible.
- [ ] Add static contracts for loading, empty journal, factual-baseline unavailable, source-link unavailable and local-save failure. The first two may be rendered by later tasks, but their semantic classes and copy budget are locked now.
- [ ] Remove decorative gradients, nested shadows, positional colours, decision illustrations and crisis SVGs.
- [ ] Run `cd site && node --experimental-strip-types --test src/simulateur-v3/design-contract.test.ts src/interface.test.ts && npm run build`.
- [ ] Commit with `style: lock compact v3 visual contract`.

### Task 1: Persist an exact decision-result snapshot

**Files:**
- Modify: `site/src/simulateur-v3/types.ts`
- Modify: `site/src/simulateur-v3/effects.ts`
- Modify: `site/src/simulateur-v3/effects.test.ts`
- Modify: `site/src/simulateur-v3/validation.ts`
- Modify: `site/src/simulateur-v3/validation.test.ts`
- Modify: `site/src/simulateur-v3/storage.test.ts`
- Modify: `site/src/simulateur-v3/test-fixtures.ts`

```ts
export type IndicatorImpactSnapshot = {
  key: IndicatorKey;
  before: number;
  after: number;
  delta: number;
  causalEntryIds: string[];
};

export type DecisionImpactSnapshot = {
  decisionId: string;
  optionId: string;
  confirmedAtIndex: number;
  indicators: IndicatorImpactSnapshot[];
};
```

Store the snapshot on the confirmed `DecisionRecord` or another explicitly persisted per-decision field. Capture it atomically inside `confirmSelection()` from the pre-confirmation state and the causal entries created by that one confirmation. Do not infer `before` later by subtracting from a mutated campaign. Store only changed indicator keys, ordered by the central indicator metadata. Scheduled events, promises and later crises receive their own ledger entries and never rewrite this immediate snapshot.

- [ ] RED: confirmation creates exactly one snapshot; unchanged indicators are absent; repeated confirmation is rejected; JSON round-trip preserves values and causal IDs; malformed/foreign causal IDs are rejected.
- [ ] GREEN: snapshots are immutable, schema-4-valid and backwards-safe only within the current scenario version.
- [ ] Update affected campaign/e2e/flow/verdict tests that construct decision records manually.
- [ ] Run `cd site && node --experimental-strip-types --test src/simulateur-v3/effects.test.ts src/simulateur-v3/validation.test.ts src/simulateur-v3/storage.test.ts src/simulateur-v3/campaign-e2e.test.ts`.
- [ ] Commit with `feat: persist simulator decision impacts`.

### Task 2: Build a defensive compact presentation model

**Files:**
- Create: `site/src/simulateur-v3/presentation.ts`
- Create: `site/src/simulateur-v3/presentation.test.ts`

**Produces:** `CompactOptionView`, `ChangedMetricView[]` and `JournalGroup[]`.

`compactOption()` separates annual-balance budget from other indicator effects, orders effects by `INDICATOR_META` priority and returns an optional `primaryImpact`. Production content validation should guarantee it, but the renderer must degrade to a concise `Impact détaillé dans le mécanisme` rather than throw if a fixture or future catalogue entry is incomplete.

`changedMetrics(snapshot)` consumes only `IndicatorImpactSnapshot[]`; it never compares groups or scans the whole mutable state. It returns at most three display items with unit-aware formatting, signed deltas, option mechanism, horizon and uncertainty.

`groupJournal()` derives chapter from `scenario.chapters[].decisionIds` and mandate year from persisted annual checkpoints/topology helpers. It never divides a global index by 12 or assumes equal chapter lengths.

- [ ] RED: budget + one principal effect + secondary count; optional-impact fallback; indicator-only changed metrics; unit formatting; 60-entry journal grouping with variable chapter sizes and exact years.
- [ ] GREEN: pure deterministic functions, no DOM and no positional assumptions.
- [ ] Run `cd site && node --experimental-strip-types --test src/simulateur-v3/presentation.test.ts`.
- [ ] Commit with `feat: add compact simulator presentation model`.

### Task 3: Render a five-second decision layer with native details

**Files:**
- Modify: `site/src/simulateur-v3/render.ts`
- Modify: `site/src/simulateur-v3/render.test.ts`

Render options in a `fieldset`. A choice is an `aria-pressed` button or a radio-labelled card. Its closed surface contains only label, budget when present, principal impact and risk. A sibling native `<details>` with a descriptive `<summary>` exposes mechanism, full effects, beneficiaries/contributors, legal constraints, reservations and evidence. Do not create a shared custom dialog, hidden fake chat or JS-only source access.

Use a two-line compact context in the main scene, with the full context inside one dossier-level disclosure. Render an inline confirmation bar only after selection, with `Modifier` and `Confirmer et voir l'impact`.

- [ ] RED: semantic fieldset, neutral cards, no image/SVG, four closed-card facts maximum, source content inside native details, correct `aria-pressed`, confirmation absent before selection and present after selection.
- [ ] GREEN: all options and confirmation fit the desktop 900 px target; mobile shows the question, first complete option and start of the next within 844 px.
- [ ] Run `cd site && node --experimental-strip-types --test src/simulateur-v3/render.test.ts`.
- [ ] Commit with `feat: compact simulator decision cards`.

### Task 4: Separate selection, confirmation and persistent causal result

**Files:**
- Modify: `site/src/simulateur-v3/controller.ts`
- Modify: `site/src/simulateur-v3/controller.test.ts`
- Modify: `site/src/simulateur-v3/render.ts`
- Modify: `site/src/simulateur-v3/render.test.ts`
- Modify: `site/src/simulateur-v3/campaign-e2e.test.ts`

`select` only creates/replaces `pendingSelection`. `modify` clears it. `confirm` calls `confirmSelection()` exactly once, persists, and remains in `decision_result`. Only `continue` calls `advanceCampaign()`.

Replace the empty result branch with the same dossier shell. Render the confirmed choice, up to three snapshot metrics, before/after values, signed delta, one causal sentence, horizon, uncertainty and `Dossier suivant`. Add `aria-live="polite"`. Do not auto-advance and do not show unchanged metrics.

- [ ] RED state-transition and DOM tests for select, reselect, modify, confirm once, save failure banner, restored `decision_result` and explicit continue.
- [ ] GREEN e2e proves one effect application and a readable persisted result after reload.
- [ ] Run `cd site && node --experimental-strip-types --test src/simulateur-v3/controller.test.ts src/simulateur-v3/render.test.ts src/simulateur-v3/campaign-e2e.test.ts`.
- [ ] Commit with `feat: show causal result before next dossier`.

### Task 5: Restore focus, scroll and keyboard state only on scene changes

**Files:**
- Modify: `site/src/simulateur-v3/controller.ts`
- Modify: `site/src/simulateur-v3/controller.test.ts`
- Modify: DOM host/test interfaces used by the controller

Pass explicit host functions for `scrollTo`, focus and keyboard events so Node tests do not depend on accidental browser globals. On a new decision ID or major phase, scroll to top and focus the scene H1 with `tabindex="-1"` and `preventScroll`. Do not scroll after selection, confirmation-bar appearance or toggling native details. `Escape` needs no custom disclosure handler because native details remain in document flow.

- [ ] RED: new dossier focuses/scrolls once; selection and details do neither; pause/journal return restores the interrupted scene; keyboard activation works.
- [ ] GREEN: controller adds/removes exactly one delegated click and keydown listener and restores the global header/session attribute on unmount/exit.
- [ ] Run `cd site && node --experimental-strip-types --test src/simulateur-v3/controller.test.ts src/interface.test.ts`.
- [ ] Commit with `fix: restore simulator focus and chrome`.

### Task 6: Apply compact mobile rules to every V3 scene

**Files:**
- Modify: `site/src/styles/simulateur-v3.css`
- Modify: `site/src/simulateur-v3/render.ts`
- Modify: `site/src/simulateur-v3/render.test.ts`
- Modify: `site/src/simulateur-v3/verdict.test.ts`

Use an exact two-row command grid on mobile and a single compact row on desktop, with explicit max block sizes. Use normal-flow or safe-area-compatible sticky confirmation/result actions without fixed-height content. Remove `min-height: 18rem`, large decorative heroes and any positional selector.

Scene budgets:

- intro: CTA before 650 px mobile; four constraints in a native disclosure;
- decision: 128 to 160 px mobile options, 148 to 176 px desktop options;
- result: three compact delta rows maximum;
- crisis: threshold, exact aggravating choices and two resolutions, no city/SVG art;
- Council: 2 x 2 mobile metrics, three causes and one upcoming risk;
- verdict: headline, final balance, summary and six dimensions in the first desktop viewport, 2 x 3 on mobile; no global score.

Static CSS tests enforce 44 px controls, visible focus, one interactive red accent, semantic green/warning plus text, `prefers-reduced-motion`, no unresolved variables and no horizontal fixed widths.

- [ ] Run render/verdict/design-contract tests and `npm run build`.
- [ ] Commit with `style: reduce simulator mobile density`.

### Task 7: Group the journal without hiding causality

**Files:**
- Modify: `site/src/simulateur-v3/presentation.ts`
- Modify: `site/src/simulateur-v3/presentation.test.ts`
- Modify: `site/src/simulateur-v3/render.ts`
- Modify: `site/src/simulateur-v3/render.test.ts`

Render one native `<details>` per chapter/year group. A closed group shows chapter, mandate year, decision count and one result line. An opened group lists compact decision rows; each row can disclose status, immediate snapshot, later causal entries, horizon and source decision. Empty journal state explains what will appear and links back to the current dossier.

Use sentence case, no decorative chapter numbers. Native details may be independently opened; do not claim accordion behaviour unless controller code actually enforces it accessibly.

- [ ] RED: 60 records are neither lost nor duplicated; variable chapter sizes and five checkpoints produce correct groups; superseded/reversed statuses and later events remain traceable.
- [ ] GREEN: journal remains usable with keyboard and without JavaScript-specific disclosure state.
- [ ] Run `cd site && node --experimental-strip-types --test src/simulateur-v3/presentation.test.ts src/simulateur-v3/render.test.ts`.
- [ ] Commit with `feat: group simulator journal by mandate year`.

### Task 8: Verify compact UX in the real preview

- [ ] Run focused presentation/render/controller/e2e/design tests.
- [ ] Run `cd site && npm test && npx tsc --noEmit && npm run build`.
- [ ] Start the existing preview and verify intro, dossier, selected option, confirmation, result, delayed event, crisis, Council, journal and verdict at 390 x 844 and 1440 x 900.
- [ ] Also verify loading, empty, factual-baseline unavailable, source unavailable, save failure, reduced motion and 200 percent text zoom.
- [ ] Record route, state, viewport, computed command-bar height, scroll width, 44 px targets, focus movement and deviations in `docs/verification/2026-08-30-v3-compact/verification-report.md`. Captures are evidence, not substitutes for assertions.
- [ ] Fix every Critical/Important visual or accessibility deviation, rerun full gates and commit with `test: verify compact v3 campaign interface`.
