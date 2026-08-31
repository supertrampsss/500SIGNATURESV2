# V3 Compact Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 60-decision campaign fast to scan on mobile, while making selection, confirmation and causal impact unmistakable.

**Architecture:** Apply the visual contract from `2026-08-30-v3-direction-design-addendum.md`, then introduce a small presentation model between campaign state and HTML. Render one compact layer by default, keep selection reversible, retain the result on the same screen, move evidence into an accessible drawer, show only changed metrics, and explicitly restore scroll and focus after navigation.

**Tech Stack:** TypeScript, semantic HTML, CSS, Node test runner, existing V3 controller and renderer

## Global Constraints

- Execute `2026-08-30-v3-campagne-60-impact.md` first. This plan consumes its 60-decision scenario, mechanism fields and timeline checkpoints.
- Treat `../specs/2026-08-30-v3-direction-design-addendum.md` as a required acceptance contract.
- Target viewport is 390 px with no horizontal overflow.
- Campaign header uses at most two visual rows and measures at most 84 px on mobile or 64 px on desktop.
- Public decision title size is 26 to 32 px on mobile.
- Closed option cards show label, budget, one principal impact and one risk only.
- Options are neutral until selected. Their order never determines a colour.
- No decision illustration is rendered at any viewport.
- Selection applies no effect. Confirmation applies the effect once. Result remains visible until an explicit continuation.
- A result shows at most three changed metrics, each with cause, horizon and uncertainty.
- Details and sources remain reachable by keyboard.
- No em dash in user-facing copy.

---

## File Structure

- Create `site/src/simulateur-v3/presentation.ts`: compact option and changed-metric view models.
- Create `site/src/simulateur-v3/presentation.test.ts`: prioritisation and no-duplication tests.
- Create `site/src/simulateur-v3/design-contract.test.ts`: token, theme and neutral-option contracts.
- Modify `site/src/style.css`: canonical visual primitives and missing token removal.
- Modify `site/src/styles/fondations.css`: semantic aliases over canonical primitives.
- Modify `site/src/styles/navigation.css`: one active-navigation language and 44 px controls.
- Modify `site/src/simulateur-v3/render.ts`: semantic compact markup, detail drawer and grouped journal.
- Modify `site/src/simulateur-v3/render.test.ts`: mobile-oriented content contracts.
- Modify `site/src/simulateur-v3/controller.ts`: focus and scroll restoration.
- Modify `site/src/simulateur-v3/controller.test.ts`: DOM navigation assertions.
- Modify `site/src/styles/simulateur-v3.css`: two-row header, compact cards and responsive drawer.

### Task 0: Lock the visual contract before changing layouts

**Files:**
- Create: `site/src/simulateur-v3/design-contract.test.ts`
- Modify: `site/src/style.css`
- Modify: `site/src/styles/fondations.css`
- Modify: `site/src/styles/navigation.css`
- Modify: `site/src/styles/simulateur-v3.css`

- [ ] **Step 1: Write failing token and neutrality tests**

The tests must fail when a used custom property is undefined, when an option colour depends on `:first-child` or `:nth-child`, when the theme control is below 44 px, or when desktop and mobile use different active-navigation motifs.

- [ ] **Step 2: Consolidate primitives and aliases**

Keep the existing navy, paper, ink and red identity. Define values once in the root primitive layer. Convert `--ui-*` and `--v3-*` to semantic aliases where they are still useful. Remove the unresolved `--espace-9`. Keep data-series colours separate from interactive colours.

- [ ] **Step 3: Lock theme and navigation behaviour**

France, Territoires and analyses follow the chosen theme. The active V3 mandate remains a navy room with an ivory dossier. The global header is visible on the mission intro, then the command bar replaces it after campaign start and exposes an explicit exit. Navigation active state is text plus underline on desktop and mobile.

- [ ] **Step 4: Remove positional styling**

Delete option colours based on DOM order, decorative gradients and nested shadows. Closed options are neutral. Selection uses the red interactive accent plus a check or text label.

- [ ] **Step 5: Run and commit**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/design-contract.test.ts && npm run build`

Expected: PASS.

```bash
git add site/src/style.css site/src/styles/fondations.css site/src/styles/navigation.css site/src/styles/simulateur-v3.css site/src/simulateur-v3/design-contract.test.ts
git commit -m "style: lock v3 visual contract"
```

### Task 1: Build the compact presentation model

**Files:**
- Create: `site/src/simulateur-v3/presentation.ts`
- Create: `site/src/simulateur-v3/presentation.test.ts`

**Interfaces:**
- Consumes: `DecisionOption`, current `CampaignState` and previous indicator snapshot.
- Produces: `CompactOptionView` and `ChangedMetricView[]`.

- [ ] **Step 1: Write failing prioritisation tests**

```ts
test("une carte fermée ne retient qu'un impact principal", () => {
  const view = compactOption(optionWithEffects([
    indicatorEffect("annualBalance", -4_000),
    indicatorEffect("growth", 0.2),
    indicatorEffect("opinion", -3),
  ]));
  assert.equal(view.budget?.key, "annualBalance");
  assert.equal(view.primaryImpact.key, "growth");
  assert.equal(view.secondaryImpactCount, 1);
  assert.equal(view.risk, option.uncertainty);
});

test("le tableau ne montre que les métriques modifiées", () => {
  assert.deepEqual(changedMetrics(before, { ...before, growth: 1.2 }).map(({ key }) => key), ["growth"]);
});
```

- [ ] **Step 2: Run the test**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/presentation.test.ts`

Expected: FAIL because `presentation.ts` does not exist.

- [ ] **Step 3: Implement deterministic prioritisation**

```ts
const PRIORITY: IndicatorKey[] = [
  "annualBalance", "debtToGdp", "interestCost", "growth", "employment",
  "publicServices", "financialCredibility", "reformCapacity", "majority",
  "institutionalTrust", "opinion", "investment",
];

export type CompactOptionView = {
  id: string;
  label: string;
  budget?: EffectRule;
  primaryImpact: EffectRule;
  secondaryImpactCount: number;
  risk: string;
};

export function compactOption(option: DecisionOption): CompactOptionView {
  const indicatorEffects = option.effects
    .filter((effect): effect is EffectRule & { target: "indicator" } => effect.target === "indicator")
    .sort((a, b) => PRIORITY.indexOf(a.key) - PRIORITY.indexOf(b.key));
  const budget = indicatorEffects.find(({ key }) => key === "annualBalance");
  const nonBudgetEffects = indicatorEffects.filter(({ key }) => key !== "annualBalance");
  const primaryImpact = nonBudgetEffects[0];
  if (!primaryImpact) throw new Error(`Option without visible indicator effect: ${option.id}`);
  return {
    id: option.id,
    label: option.label,
    budget,
    primaryImpact,
    secondaryImpactCount: Math.max(0, nonBudgetEffects.length - 1),
    risk: option.uncertainty,
  };
}
```

`changedMetrics()` compares keys using `Object.is()` and returns them in `PRIORITY` order.

- [ ] **Step 4: Run the test and commit**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/presentation.test.ts`

Expected: PASS.

```bash
git add site/src/simulateur-v3/presentation.ts site/src/simulateur-v3/presentation.test.ts
git commit -m "feat: add compact simulator presentation model"
```

### Task 2: Render the five-second decision layer

**Files:**
- Modify: `site/src/simulateur-v3/render.ts`
- Modify: `site/src/simulateur-v3/render.test.ts`

**Interfaces:**
- Consumes: `compactOption()`.
- Produces: compact option cards and one shared detail drawer.

- [ ] **Step 1: Replace the decision-card assertions**

```ts
test("une option fermée montre quatre informations et garde les preuves hors carte", () => {
  const html = renderSimulatorV3(decisionState(), SCENARIO_V3);
  const card = html.match(/<button class="simulateur-v3__option[\s\S]*?<\/button>/)?.[0] ?? "";
  assert.match(card, /simulateur-v3__option-label/);
  assert.match(card, /simulateur-v3__option-budget/);
  assert.match(card, /simulateur-v3__option-impact/);
  assert.match(card, /simulateur-v3__option-risk/);
  assert.doesNotMatch(card, /sourceUrl|Bénéficiaires|Contributeurs|Hypothèse/);
  assert.match(html, /<dialog[^>]+id="simulateur-v3-details"/);
});
```

- [ ] **Step 2: Run the render test**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/render.test.ts`

Expected: FAIL because the existing cards expose multiple effects and illustrations.

- [ ] **Step 3: Replace option markup**

```ts
function renderCompactOption(option: DecisionOption, selected: boolean): string {
  const view = compactOption(option);
  return `<article class="simulateur-v3__option-shell">
    <button class="simulateur-v3__option${selected ? " is-selected" : ""}"
      type="button" data-v3-action="select" data-option-id="${escapeHtml(view.id)}">
      <strong class="simulateur-v3__option-label">${escapeHtml(view.label)}</strong>
      <span class="simulateur-v3__option-budget">${renderBudget(view.budget)}</span>
      <span class="simulateur-v3__option-impact">${renderEffect(view.primaryImpact)}</span>
      <span class="simulateur-v3__option-risk">Risque : ${escapeHtml(view.risk)}</span>
    </button>
    <button type="button" class="simulateur-v3__details-trigger"
      data-v3-action="details" data-option-id="${escapeHtml(view.id)}"
      aria-haspopup="dialog">Voir le mécanisme et les sources</button>
  </article>`;
}
```

Render the options in a `fieldset` with radios or `aria-pressed` buttons. Selection reveals one inline confirmation area with `Modifier` and `Confirmer et voir l'impact`. Render one `<dialog id="simulateur-v3-details">` after the option list for hypotheses, reservations and sources. Populate it from the chosen option rather than duplicating hidden detail content for every option.

- [ ] **Step 4: Limit context and dashboard output**

Render the full context inside the detail dialog and use a CSS-clamped two-line summary in the main dossier. Replace the four permanent dashboard groups with `changedMetrics()` output for the last transition.

- [ ] **Step 5: Run and commit**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/render.test.ts`

Expected: PASS.

```bash
git add site/src/simulateur-v3/render.ts site/src/simulateur-v3/render.test.ts
git commit -m "feat: compact simulator decision cards"
```

### Task 3: Separate selection, confirmation and causal result

**Files:**
- Modify: `site/src/simulateur-v3/controller.ts`
- Modify: `site/src/simulateur-v3/controller.test.ts`
- Modify: `site/src/simulateur-v3/render.ts`
- Modify: `site/src/simulateur-v3/render.test.ts`

- [ ] **Step 1: Write the state-transition tests**

Verify that `select` only creates `pendingSelection`, `modify` clears it, `confirm` calls `confirmSelection()` exactly once and stops in `decision_result`, and `continue` alone advances to the next screen.

- [ ] **Step 2: Render the persistent result**

Replace the empty `decision_result` branch with the same dossier shell. Show the confirmed option, at most three before and after values, signed deltas, one causal sentence, horizon, uncertainty and `Dossier suivant`. Add an `aria-live="polite"` summary. Do not render unchanged metrics.

- [ ] **Step 3: Remove automatic advancement**

The `select` controller action updates only pending selection. Add explicit `modify` and `confirm` actions. The confirmation persists and renders the result, but does not call `advanceCampaign()`.

- [ ] **Step 4: Run and commit**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/controller.test.ts src/simulateur-v3/render.test.ts`

Expected: PASS.

```bash
git add site/src/simulateur-v3/controller.ts site/src/simulateur-v3/controller.test.ts site/src/simulateur-v3/render.ts site/src/simulateur-v3/render.test.ts
git commit -m "feat: show causal result before next dossier"
```

### Task 4: Restore focus and scroll on every new dossier

**Files:**
- Modify: `site/src/simulateur-v3/controller.ts`
- Modify: `site/src/simulateur-v3/controller.test.ts`

**Interfaces:**
- Consumes: phase and current decision ID before and after an action.
- Produces: `restoreDecisionViewport(root)`.

- [ ] **Step 1: Write the failing navigation test**

```ts
test("continuer vers un nouveau dossier remonte et place le focus sur son titre", () => {
  const calls: unknown[] = [];
  const heading = { focus: () => calls.push("focus") };
  const root = { querySelector: () => heading } as unknown as HTMLElement;
  const scroll = () => calls.push("scroll");
  restoreDecisionViewport(root, scroll);
  assert.deepEqual(calls, ["scroll", "focus"]);
});
```

- [ ] **Step 2: Implement the helper**

```ts
export function restoreDecisionViewport(
  root: HTMLElement,
  scroll: (options: ScrollToOptions) => void = window.scrollTo.bind(window),
): void {
  scroll({ top: 0, behavior: "instant" });
  const heading = root.querySelector<HTMLElement>("[data-v3-decision-title]");
  heading?.focus({ preventScroll: true });
}
```

Give the heading `tabindex="-1"`. Call the helper only when the current decision ID changes, not after selection or opening details.

- [ ] **Step 3: Run and commit**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/controller.test.ts`

Expected: PASS.

```bash
git add site/src/simulateur-v3/controller.ts site/src/simulateur-v3/controller.test.ts
git commit -m "fix: restore focus on new simulator dossiers"
```

### Task 5: Implement the mobile density rules

**Files:**
- Modify: `site/src/styles/simulateur-v3.css`
- Modify: `site/src/simulateur-v3/render.test.ts`

**Interfaces:**
- Consumes: compact semantic classes from Task 2.
- Produces: responsive layout at 390 px and desktop comparison layout.

- [ ] **Step 1: Add static CSS contract checks**

```ts
const css = readFileSync(new URL("../styles/simulateur-v3.css", import.meta.url), "utf8");
assert.match(css, /@media\s*\(max-width:\s*600px\)/);
assert.match(css, /\.simulateur-v3__decision-title[\s\S]*font-size:\s*clamp\(1\.625rem,.*2rem\)/);
assert.match(css, /\.simulateur-v3__illustration[\s\S]*display:\s*none/);
```

- [ ] **Step 2: Add the compact mobile rules**

```css
@media (max-width: 600px) {
  .simulateur-v3__command { grid-template-columns: 1fr auto; grid-template-rows: auto auto; }
  .simulateur-v3__decision-title { font-size: clamp(1.625rem, 7vw, 2rem); line-height: 1.08; }
  .simulateur-v3__context { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .simulateur-v3__illustration { display: none; }
  .simulateur-v3__option { min-height: 8rem; max-height: 10rem; padding: 0.9rem; gap: 0.45rem; }
  .simulateur-v3__dashboard { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .simulateur-v3__details { width: calc(100% - 1rem); max-height: calc(100dvh - 1rem); margin: auto 0.5rem 0.5rem; }
}
```

- [ ] **Step 3: Run render tests and build**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/render.test.ts && npm run build`

Expected: PASS and build exit 0.

- [ ] **Step 4: Commit**

```bash
git add site/src/styles/simulateur-v3.css site/src/simulateur-v3/render.test.ts
git commit -m "style: reduce simulator mobile density"
```

### Task 6: Group the journal by chapter and mandate year

**Files:**
- Modify: `site/src/simulateur-v3/presentation.ts`
- Modify: `site/src/simulateur-v3/presentation.test.ts`
- Modify: `site/src/simulateur-v3/render.ts`
- Modify: `site/src/simulateur-v3/render.test.ts`

**Interfaces:**
- Consumes: decision records, scenario chapters and annual checkpoints.
- Produces: `JournalGroup[]` and nested `<details>` markup.

- [ ] **Step 1: Write grouping test**

```ts
test("le journal groupe les décisions sans les perdre", () => {
  const groups = groupJournal(stateWithTwelveDecisions(), SCENARIO_V3);
  assert.equal(groups.flatMap(({ entries }) => entries).length, 12);
  assert.ok(groups.every(({ chapterTitle, year }) => chapterTitle && year >= 1));
});
```

- [ ] **Step 2: Implement and render groups**

```ts
export type JournalGroup = {
  chapterId: string;
  chapterTitle: string;
  year: number;
  summary: string;
  entries: DecisionRecord[];
};
```

Render each group as `<details class="simulateur-v3__journal-group">` with a `<summary>` containing chapter, mandate year and number of decisions. Do not render all entry explanations until the group is opened.

Use sentence case, no decorative chapter number, and allow only one group open at a time on mobile. A closed group contains one result line and one count. An opened decision exposes delta, horizon, status and causal trace.

- [ ] **Step 3: Run and commit**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/presentation.test.ts src/simulateur-v3/render.test.ts`

Expected: PASS.

```bash
git add site/src/simulateur-v3/presentation.ts site/src/simulateur-v3/presentation.test.ts site/src/simulateur-v3/render.ts site/src/simulateur-v3/render.test.ts
git commit -m "feat: group simulator journal by chapter"
```

### Task 7: Verify compact UX

**Files:**
- Modify only on failure: files from Tasks 1 to 5.

**Interfaces:**
- Consumes: complete compact interface.
- Produces: passing accessibility, render and build gates.

- [ ] **Step 1: Run focused suite**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/presentation.test.ts src/simulateur-v3/render.test.ts src/simulateur-v3/controller.test.ts`

Expected: PASS.

- [ ] **Step 2: Run full suite and build**

Run: `cd site && npm test && npm run build`

Expected: both commands exit 0.

- [ ] **Step 3: Verify the preview at 390 x 844 and 1440 x 900**

Start the existing preview command, capture the intro, first dossier, selected option, confirmation, result, crisis, council, journal and verdict at both sizes, and store the report under `docs/verification/2026-08-30-v3-compact/verification-report.md`. Also capture loading, empty, error and reduced-motion states. The report must record viewport, route, state and any deviation. Verify computed sizes, no horizontal overflow, 44 px targets, a single interactive accent and a prose measure of 60 to 66 characters.

- [ ] **Step 4: Commit verification artifacts**

```bash
git add docs/verification/2026-08-30-v3-compact site/src/simulateur-v3 site/src/styles/simulateur-v3.css
git commit -m "test: verify compact v3 campaign interface"
```
