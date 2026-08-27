# Simulateur V3 Interface Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publier une première tranche V3 reconnaissable et jouable via `/simulateur?version=3`, sans remplacer la V2 par défaut, depuis l'entrée en fonction jusqu'au retour persistant de la première décision.

**Architecture:** Un adaptateur transforme temporairement les 96 mesures existantes en un `Scenario` V3 valide, sans importer les fixtures de test. Un rendu HTML pur consomme le scénario et l'état du moteur. Un contrôleur DOM orchestre sélection, confirmation, progression et sauvegarde. La V3 utilise un hôte et des classes dédiés, tandis que `main.ts` conserve la V2 comme chemin par défaut.

**Tech Stack:** TypeScript sans framework, Vite, Node test runner, CSS natif, localStorage injecté.

## Global Constraints

- Une seule campagne de 96 décisions, organisée en 8 chapitres de 12 décisions.
- Aucun mode express et aucun engagement préalable.
- La carte entière constitue le contrôle de sélection. Aucun bouton inférieur ne répète les options.
- Aucun texte « Impact : à préciser ».
- Aucun caractère U+2014 dans les données ou rendus V3.
- La palette V3 reste bleu nuit et ivoire, quel que soit le thème général.
- Référence mobile : 390 px. Le produit reste utilisable à 320 px.
- Cibles tactiles : 44 px minimum.
- Navigation clavier complète, focus visible, information jamais portée uniquement par la couleur.
- Aucun portrait, médaillon, avatar, visage ou buste.
- La recherche territoriale est masquée dans le simulateur.
- Quitter renvoie vers `/bilan`.
- La V2 reste le simulateur par défaut tant que l'ensemble du corpus V3 n'a pas été revu.

---

### Task 1: Adaptateur provisoire des 96 mesures

**Files:**
- Create: `site/src/simulateur-v3/scenario.ts`
- Create: `site/src/simulateur-v3/scenario.test.ts`

**Interfaces:**
- Consumes: `MESURES`, `DILEMMES`, `Scenario`, `Decision`, `EffectRule`, `validateScenario`.
- Produces: `SCENARIO_V3_PREVIEW: Scenario`.

- [ ] **Step 1: Write failing scenario tests**

Add tests asserting that `SCENARIO_V3_PREVIEW` contains exactly 8 chapters, 12 decision IDs per chapter and 96 unique decisions; `validateScenario()` returns `[]`; every option has a direct label, summary, beneficiaries, contributors and no text matching `/impact\s*:\s*à préciser/i`; and `assertNoEmDash()` returns `[]`.

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
Set-Location site
node --experimental-strip-types --test src/simulateur-v3/scenario.test.ts
```

Expected: FAIL because `scenario.ts` does not exist.

- [ ] **Step 3: Implement the adapter**

Create eight chapter definitions matching the specification. Assign the existing ordered measures by slices of twelve. Convert the adoption effect to `annualBalance`, map `opinion` and `marches` to V3 indicators, map `entreprises` and `territoires` to V3 groups, preserve exclusions as conflicts, and provide two explicit options: the proposed change and `Conserver la règle actuelle`.

Each evidence block uses the existing site method page:

```ts
{
  label: mesure.detail,
  sourceName: "Sources budgétaires recensées",
  sourceUrl: "/sources/",
  publishedAt: "2026-08-27",
  note: mesure.precision,
}
```

Do not claim that this adapter is the final editorial corpus.

- [ ] **Step 4: Run focused and V3 validation tests**

Run:

```powershell
Set-Location site
node --experimental-strip-types --test src/simulateur-v3/scenario.test.ts src/simulateur-v3/validation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- site/src/simulateur-v3/scenario.ts site/src/simulateur-v3/scenario.test.ts
git commit -m "feat: adapt catalogue for simulator v3 preview"
```

---

### Task 2: Rendu pur de l'entrée, du chapitre et du dossier

**Files:**
- Create: `site/src/simulateur-v3/render.ts`
- Create: `site/src/simulateur-v3/render.test.ts`

**Interfaces:**
- Consumes: `CampaignState`, `Scenario`, `Decision`, `DecisionOption`, `currentDecision`.
- Produces: `renderSimulatorV3(state, scenario, options?): string`, `formatV3Amount(value): string`.

- [ ] **Step 1: Write failing renderer tests**

Cover these contracts:

- intro contains the 153 billion mission and one `data-v3-action="start"` button;
- chapter intro contains four domains and one `data-v3-action="open-chapter"` button;
- decision scene contains one whole-card button per option and no duplicated action row;
- selected card uses `aria-pressed="true"` and contains confirmation controls inside that card;
- decision result remains visible until an explicit `data-v3-action="continue"` action;
- the evidence panel uses `<details>` and links sources;
- every rendered phase contains a compact command bar with `/bilan`, chapter, progress and Pause;
- all outputs contain no U+2014.

- [ ] **Step 2: Verify the renderer tests fail**

Run:

```powershell
Set-Location site
node --experimental-strip-types --test src/simulateur-v3/render.test.ts
```

Expected: FAIL because `render.ts` does not exist.

- [ ] **Step 3: Implement escaped semantic HTML**

Use a local escaping function for all scenario content. Use `<button type="button">` for option cards and actions. Announce the selected state with `aria-pressed`. Put confirmation inside `.simulateur-v3__option-confirmation`. Use `aria-live="polite"` on the result summary. Never calculate effects in the renderer.

- [ ] **Step 4: Run renderer and engine tests**

Run:

```powershell
Set-Location site
node --experimental-strip-types --test src/simulateur-v3/render.test.ts src/simulateur-v3/campaign.test.ts src/simulateur-v3/effects.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- site/src/simulateur-v3/render.ts site/src/simulateur-v3/render.test.ts
git commit -m "feat: render simulator v3 decision slice"
```

---

### Task 3: Contrôleur DOM et sauvegarde

**Files:**
- Create: `site/src/simulateur-v3/controller.ts`
- Create: `site/src/simulateur-v3/controller.test.ts`

**Interfaces:**
- Consumes: `createCampaign`, `selectOption`, `clearSelection`, `confirmSelection`, `advanceAfterResult`, `saveCampaign`, `restoreCampaign`, `renderSimulatorV3`, `emitSimulatorV3Event`.
- Produces: `mountSimulatorV3(host, scenario, dependencies?): () => void`.

- [ ] **Step 1: Write failing controller tests**

Use a minimal fake host implementing `innerHTML`, `addEventListener` and `removeEventListener`. Verify delegated actions for:

- start: `intro` to `chapter_intro`;
- open chapter: `chapter_intro` to `decision`;
- selecting an option calls `selectOption` and repaints confirmation in the card;
- cancel clears the selection;
- confirm persists the confirmed decision and paints `decision_result`;
- continue advances to the next decision;
- Pause opens phase `pause`, Resume restores the previous phase;
- Quit navigates to `/bilan` through an injected callback;
- unmount removes listeners;
- unavailable storage never blocks play;
- V2 storage displays a short migration notice without deleting V2 data.

- [ ] **Step 2: Verify controller tests fail**

Run:

```powershell
Set-Location site
node --experimental-strip-types --test src/simulateur-v3/controller.test.ts
```

Expected: FAIL because `controller.ts` does not exist.

- [ ] **Step 3: Implement one delegated click listener**

The listener reads `data-v3-action`, `data-decision-id` and `data-option-id`. It rejects a second confirmation after the first state change. Every state transition repaints and saves. Analytics include only event type, chapter and position. Keep `phaseBeforePause` inside the controller, not in persisted campaign state.

- [ ] **Step 4: Run controller, storage and event tests**

Run:

```powershell
Set-Location site
node --experimental-strip-types --test src/simulateur-v3/controller.test.ts src/simulateur-v3/storage.test.ts src/simulateur-v3/events.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- site/src/simulateur-v3/controller.ts site/src/simulateur-v3/controller.test.ts
git commit -m "feat: control simulator v3 preview flow"
```

---

### Task 4: Design system V3 mobile first

**Files:**
- Create: `site/src/styles/simulateur-v3.css`
- Modify: `site/src/main.ts`
- Modify: `site/src/interface.test.ts`

**Interfaces:**
- Consumes: `.simulateur-v3*` markup from Task 2 and global spacing, type and focus tokens.
- Produces: stable navy shell, ivory dossier, responsive option grid and accessible interaction states.

- [ ] **Step 1: Add failing CSS source tests**

Assert that the stylesheet:

- defines scoped fixed palette aliases `--v3-shell`, `--v3-dossier`, `--v3-ink`, `--v3-rule`, `--v3-red`, `--v3-gold`;
- gives buttons a minimum height of `var(--cible)`;
- uses a single-column base option grid;
- changes to two columns only at `@media (min-width: 60rem)`;
- contains `:focus-visible` and `[aria-pressed="true"]` states;
- contains `prefers-reduced-motion` handling;
- does not contain `position: fixed`;
- is imported after `tunnel-cabinet.css`.

- [ ] **Step 2: Run focused interface tests and verify failure**

Run:

```powershell
Set-Location site
node --experimental-strip-types --test src/interface.test.ts
```

Expected: FAIL on missing V3 stylesheet.

- [ ] **Step 3: Implement mobile-first layout**

Base layout targets 320 to 390 px. The command bar uses a wrapping grid in normal flow. The dossier has compact fluid padding. Option cards stack. Evidence URLs use `overflow-wrap: anywhere`. At 60rem, the dossier expands and option cards use two columns. Palette aliases never inherit the global dark theme inversion.

- [ ] **Step 4: Run interface and render tests**

Run:

```powershell
Set-Location site
node --experimental-strip-types --test src/interface.test.ts src/simulateur-v3/render.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- site/src/styles/simulateur-v3.css site/src/main.ts site/src/interface.test.ts
git commit -m "feat: style simulator v3 mobile shell"
```

---

### Task 5: Intégration parallèle sur `/simulateur?version=3`

**Files:**
- Modify: `site/index.html`
- Modify: `site/src/main.ts`
- Modify: `site/src/routes.test.ts`
- Modify: `site/src/interface.test.ts`

**Interfaces:**
- Consumes: `SCENARIO_V3_PREVIEW`, `mountSimulatorV3`.
- Produces: an opt-in V3 route branch and an unmodified V2 default branch.

- [ ] **Step 1: Add failing integration source tests**

Assert that:

- `#simulateur-v3` exists beside `#tunnel`;
- `version=3` mounts V3 without waiting for legacy budget volets;
- ordinary `/simulateur` still calls `afficherTunnel`;
- the V3 branch never calls `demarrerSessionImmersive`;
- the V3 branch hides the territory search and leaves the site header visible;
- leaving the simulator unmounts the V3 controller;
- Quit targets `/bilan`.

- [ ] **Step 2: Run route and interface tests and verify failure**

Run:

```powershell
Set-Location site
node --experimental-strip-types --test src/routes.test.ts src/interface.test.ts
```

Expected: FAIL because the V3 host and branch do not exist.

- [ ] **Step 3: Wire the opt-in branch**

Add a dedicated `<section id="simulateur-v3" hidden></section>`. In `basculerVue`, allow the V3 query to mount independently of `exercicesParVolet`. In `ouvrirSimulateur`, return early after V3 mounting when `new URLSearchParams(location.search).get("version") === "3"`. Keep `#tunnel` and expert mode hidden during V3. Restore their V2 behaviour otherwise.

- [ ] **Step 4: Run focused and complete tests**

Run:

```powershell
Set-Location site
node --experimental-strip-types --test src/routes.test.ts src/interface.test.ts src/simulateur-v3/*.test.ts
npm test
```

Expected: PASS with no V2 regression.

- [ ] **Step 5: Commit**

```powershell
git add -- site/index.html site/src/main.ts site/src/routes.test.ts site/src/interface.test.ts
git commit -m "feat: expose simulator v3 preview route"
```

---

### Task 6: Browser verification and publication gate

**Files:**
- Modify only files whose visual or runtime defect is reproduced during verification.

**Interfaces:**
- Consumes: complete Tasks 1 to 5.
- Produces: a stable preview ready for production review.

- [ ] **Step 1: Run static gates**

Run:

```powershell
Set-Location site
npm test
npm run build
git diff --check
```

Expected: PASS.

- [ ] **Step 2: Scan all V3 source and render output for U+2014**

Run a source scan over `site/src/simulateur-v3` and a renderer test over intro, chapter, decision, selected decision and result. Expected: no U+2014.

- [ ] **Step 3: Verify real browser rendering**

Start Vite and inspect `/simulateur?version=3` at 390x844, 320x568 and 1440x900. Verify no horizontal overflow, no hidden content, 44px controls, visible focus, in-card confirmation, persistent result, header continuity and visual match to the approved first board without medallion.

- [ ] **Step 4: Fix only reproduced defects and rerun their covering tests**

Every fix must name its reproduction and covering test. Recheck all three viewports.

- [ ] **Step 5: Run final build and commit**

```powershell
Set-Location site
npm test
npm run build
git add -- site
git commit -m "fix: polish simulator v3 preview rendering"
```

Do not create an empty commit when no fix was needed.

## Completion Gate

This plan is complete only when:

- `/simulateur?version=3` shows a coherent V3 entry and first decision flow;
- `/simulateur` still shows V2;
- one card is one choice, without duplicated lower buttons;
- confirmation is inside the selected card;
- the result remains until Continue;
- the header remains visible and territory search is absent;
- 96 adapted decisions pass V3 validation;
- mobile 320 and 390 have no horizontal overflow;
- keyboard focus and 44px targets are verified;
- V3 render output contains no U+2014;
- full tests and production build pass.

The next independent plan adds Council, crises, delayed events, journal, chapter verdict and final mandate verdict before making V3 the default.
