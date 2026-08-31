# Simulateur V10, 72 décisions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publier le scénario 10, auditable et restaurable, avec 96 dossiers, une campagne figée de 72 décisions, 144 options et trois parcours budgétairement tenables.

**Architecture:** Le catalogue V10 porte un `BudgetProfile` relié à un registre nominatif de chiffrage. Une topologie de build immuable compose les 60 décisions de noyau et les 12 promotions qualifiées, puis dérive longueur, chapitres et checkpoints. Le moteur traduit le profil en flux annuels et ponctuels causaux, ce qui permet la migration V9, les renversements de crise et le calcul de trois parcours complets.

**Tech Stack:** TypeScript 5.9, Node test runner, Vite 7, Playwright pour le contrôle navigateur 390 x 844.

## Global Constraints

- `SCENARIO_V10.version` vaut `10` et `SCHEMA_VERSION` vaut `5`; `SCENARIO_V9` reste disponible en lecture.
- La bibliothèque contient exactement 96 `Decision` uniques et 192 options; V10 contient exactement 72 décisions et 144 options, longueur figée au build.
- La topologie a huit chapitres, un noyau ordonné de 60 identifiants et exactement 12 promotions `promoted`; les décisions verrouillées restent journalisées mais ne rendent pas de carte, d'où environ 62 à 68 cartes affichées selon le parcours.
- Toute option a exactement deux alternatives réelles. `engager-six-epr2-part-annuelle-de-l` expose seulement `engager-six` et `ne-pas-engager`.
- Aucun texte rendu ne contient `—`; aucune carte ne montre opinion, confiance, marchés ou groupes avant le choix.
- Aucun flux non nul n'est accepté sans entrée de registre, source primaire, assiette, millésime, nature, calcul brut, décote comportementale, coût récurrent et clé de périmètre exclusive.
- `unifier-ir-csg-bareme-continu` est neutre; la prime d'activité est recyclée à plus ou moins 1 M€; aucune flat tax fictive à 150 000 M€ n'existe.
- Les 18 substitutions doctrinales et les deux emplacements fiscaux de promotion maintiennent le total 96. Les deux variantes de flat tax sont remplacées par `perenniser-surtaxe-grandes-entreprises` et `relever-tva-restauration-commerciale`.
- `perenniser-surtaxe-grandes-entreprises` utilise `corporate-profit-surtax-2026`, la borne brute Sénat PLF 2026 de 7 300 M€ et un rendement net documenté. `relever-tva-restauration-commerciale` utilise `commercial-restaurant-vat-10`, distincte de la TVA normale, avec rendement net strictement inférieur à 2 275 M€.
- Les trois parcours `doctrine-38500`, `redressement-prudent` et `reformes-structurelles` ont une option par décision publiée, passent les `locks`, intègrent crises, échéances et coûts ponctuels, et finissent avec un solde annuel nul ou positif. Le maximum compatible vise environ 180 000 M€ seulement à partir des écritures sourcées.

---

## File map

| Fichier | Responsabilité V10 |
|---|---|
| `site/src/simulateur-v3/types.ts` | Contrats de profil, état, schéma 5 et écritures causales de flux. |
| `site/src/simulateur-v3/budget-registry.ts` | Registre typé, jointure `decisionId:optionId:estimateKey` et contrôle des périmètres exclusifs. |
| `site/src/simulateur-v3/policy-catalogue.ts` et `policies/*.ts` | Compilation des options réelles à deux choix à partir du profil V10. |
| `site/src/simulateur-v3/campaign-topology.ts` et `promotion-report.ts` | Noyau, promotions, rapport figé, longueur 72 et checkpoints dérivés. |
| `site/src/simulateur-v3/effects.ts`, `timeline.ts`, `flow.ts`, `validation.ts` | Planification, matérialisation et annulation sûre des flux. |
| `site/src/simulateur-v3/scenario-v9.ts`, `scenario-v10.ts`, `scenario-resolver.ts`, `storage.ts` | Résolution par version et migration v4 vers v5 sans rejouer le passé. |
| `site/src/simulateur-v3/scenario-crises.ts`, `crises.ts` | Crises compatibles V10 et renversement causal complet. |
| `site/src/simulateur-v3/balanced-paths.ts` | Trois parcours publiés et calcul du maximum compatible. |
| `site/src/simulateur-v3/render.ts`, `presentation.ts`, `style.css` | Compteur dérivé, cartes sobres et rendu mobile sans débordement. |

### Task 1: Contrat budgétaire et registre de chiffrage

**Files:**
- Create: `site/src/simulateur-v3/budget-registry.ts`
- Create: `site/src/simulateur-v3/budget-registry.test.ts`
- Modify: `site/src/simulateur-v3/types.ts`
- Modify: `site/src/simulateur-v3/policy-catalogue.ts`
- Modify: `site/src/simulateur-v3/validation.ts`
- Test: `site/src/simulateur-v3/types.test.ts`

**Interfaces:**
- Produces `BudgetProfile`, `BudgetEstimate`, `validateBudgetProfile(profile, decisionId, optionId): string[]`, `budgetEstimateFor(decisionId, optionId, estimateKey): BudgetEstimate` and `findExclusiveScopeCollisions(profiles): string[]`.
- Consumes `EffectTiming`, `DecisionOption` and `PolicyOptionDefinition` from the current simulator contract.

- [ ] **Step 1: Write failing tests for a valid typed estimate, an absent estimate, a duplicate scope and a null keep profile.**

```ts
assert.deepEqual(validateBudgetProfile({ estimateKey: null, runRateMillions: 0, runRateTiming: null, transitionFlows: [], exclusiveScopeKeys: [] }, "d", "keep"), []);
assert.throws(() => budgetEstimateFor("d", "adopt", "missing"), /Unknown budget estimate/);
assert.deepEqual(findExclusiveScopeCollisions([profile("scope-a"), profile("scope-a")]), ["scope-a"]);
```

- [ ] **Step 2: Run the red test.**

Run: `node --experimental-strip-types --test src/simulateur-v3/budget-registry.test.ts`

Expected: FAIL because `budget-registry.ts` and `BudgetProfile` do not exist.

- [ ] **Step 3: Add the complete value contract and runtime guards.**

```ts
export type BudgetTransitionFlow = { id: string; amountMillions: number; timing: EffectTiming; sourceKey: string };
export type RunRateTiming = { kind: "immediate" } | { kind: "mandate_year"; year: 1 | 2 | 3 | 4 | 5 };
export type BudgetProfile = { estimateKey: string | null; runRateMillions: number; runRateTiming: RunRateTiming | null; transitionFlows: BudgetTransitionFlow[]; exclusiveScopeKeys: string[] };
export type BudgetEstimate = { key: string; baseYear: number; baseAmountMillions: number; baseNature: "realise" | "prevision" | "objectif" | "notifie" | "recouvre"; scope: string; grossActionMillions: number; behavioralOffsetMillions: number; recurringOperatingCostMillions: number; runRateMillions: number; transitionFlows: BudgetTransitionFlow[]; sourceKeys: readonly string[]; estimateStatus: "observe" | "ex_ante" | "scenario"; uncertainty: Uncertainty; exclusiveScopeKeys: readonly string[] };
```

`validateBudgetProfile` impose une clé et un calendrier pour tout flux non nul, un identifiant ponctuel unique, une échéance dans la campagne, l'égalité `grossActionMillions - behavioralOffsetMillions - recurringOperatingCostMillions === runRateMillions`, et aucune clé pour `keep`. Remplacer dans `PolicyOptionDefinition` les trois champs `budgetDelta`, `budgetDuration`, `budgetTiming` par `budgetProfile`, puis compiler uniquement les effets budgétaires dérivés de ce profil.

- [ ] **Step 4: Run the focused tests and type check.**

Run: `node --experimental-strip-types --test src/simulateur-v3/budget-registry.test.ts src/simulateur-v3/types.test.ts && npx tsc -p tsconfig.type-tests.json --noEmit`

Expected: PASS; une clé exclusive réutilisée par deux décisions est refusée.

- [ ] **Step 5: Commit.**

```bash
git add site/src/simulateur-v3/types.ts site/src/simulateur-v3/budget-registry.ts site/src/simulateur-v3/budget-registry.test.ts site/src/simulateur-v3/policy-catalogue.ts site/src/simulateur-v3/validation.ts site/src/simulateur-v3/types.test.ts
git commit -m "feat: add typed simulator budget registry"
```

### Task 2: Catalogue V10, 18 substitutions et options atomiques

**Files:**
- Modify: `site/src/simulateur-v3/policies/taxes.ts`
- Modify: `site/src/simulateur-v3/policies/work.ts`
- Modify: `site/src/simulateur-v3/policies/health.ts`
- Modify: `site/src/simulateur-v3/policies/energy.ts`
- Modify: `site/src/simulateur-v3/policies/state.ts`
- Modify: `site/src/simulateur-v3/policy-sources.ts`
- Modify: `site/src/simulateur-v3/policy-catalogue.test.ts`
- Test: `site/src/simulateur-v3/causal-contract-source.test.ts`

**Interfaces:**
- Produces a 96-decision V10 catalogue whose every option has `budgetProfile` and whose `adopt` estimates resolve in `BUDGET_ESTIMATES`.
- Consumes the Task 1 registry and returns only two options per decision.

- [ ] **Step 1: Write red inventory tests.**

```ts
assert.equal(SCENARIO_V10_CATALOGUE.decisions.length, 96);
assert.equal(SCENARIO_V10_CATALOGUE.decisions.flatMap((d) => d.options).length, 192);
assert.equal(policyById("flat-tax-a-20-des-le-premier"), undefined);
assert.equal(policyById("engager-six-epr2-part-annuelle-de-l")!.options.length, 2);
assert.equal(policyById("relever-tva-restauration-commerciale")!.chapterId, "taxes-assets-transmission");
```

- [ ] **Step 2: Run the red tests.**

Run: `node --experimental-strip-types --test src/simulateur-v3/policy-catalogue.test.ts src/simulateur-v3/causal-contract-source.test.ts`

Expected: FAIL because the V10 decisions, sources and two-option EPR2 contract are absent.

- [ ] **Step 3: Apply the 18 replacements, source records and exact policy constraints.**

Apply the 20 catalogue substitutions in spec section 6.2 exactly once: its 18 doctrinal replacements plus `flat-tax-a-20-des-le-premier` to `perenniser-surtaxe-grandes-entreprises` and `flat-tax-a-20-avec-abattement-protegeant` to `relever-tva-restauration-commerciale`. In particular, map `geler-le-bareme-de-l-impot-sur` to `facturation-electronique-controle-tva`, `tranche-a-50-au-dela-de-250` to `unifier-ir-csg-bareme-continu`, and `soumettre-les-revenus-du-capital-au-bareme` to `supprimer-niches-fiscales-menages-capital`; do not retain a flat-tax alias.

Define the two added promotions with IDs, source keys and scopes exactly as follows:

```ts
"perenniser-surtaxe-grandes-entreprises": { estimateKey: "corporate-profit-surtax-net", exclusiveScopeKeys: ["corporate-profit-surtax-2026"], sourceKeys: ["senat-plf-2026-surtaxe-is"] },
"relever-tva-restauration-commerciale": { estimateKey: "commercial-restaurant-vat-net", exclusiveScopeKeys: ["commercial-restaurant-vat-10"], sourceKeys: ["bofip-tva-restauration-2024", "evm-2026-tva-restauration"] },
```

The former estimate has `grossActionMillions: 7_300`; the latter has `grossActionMillions: 2_275` and a strictly lower net run rate. Register the 18 structural adopt estimates, including their source keys, scope, base year, gross, behavior, operating cost, timing and transition flows. Give every `keep` option the null profile. Delete the `fourteen` EPR2 alternative; rename the remaining IDs `engager-six` and `ne-pas-engager`. Confirm source URLs point to the Senate PLF 2026 report, BOFiP restaurant VAT and the 2026 Voies et moyens table.

- [ ] **Step 4: Run catalogue and source tests.**

Run: `node --experimental-strip-types --test src/simulateur-v3/policy-catalogue.test.ts src/simulateur-v3/causal-contract-source.test.ts`

Expected: PASS; 96 decisions, 192 options, no flat-tax decision, no 150 000 M€ fiscal effect and exactly two EPR2 options.

- [ ] **Step 5: Commit.**

```bash
git add site/src/simulateur-v3/policies site/src/simulateur-v3/policy-sources.ts site/src/simulateur-v3/policy-catalogue.test.ts site/src/simulateur-v3/causal-contract-source.test.ts
git commit -m "feat: rebuild v10 policy catalogue"
```

### Task 3: Topologie fixe 72, 12 promotions et rapport de build

**Files:**
- Modify: `site/src/simulateur-v3/campaign-topology.ts`
- Create: `site/src/simulateur-v3/promotion-report.ts`
- Create: `site/src/simulateur-v3/promotion-report.test.ts`
- Modify: `site/src/simulateur-v3/campaign-topology.test.ts`
- Modify: `site/src/simulateur-v3/scenario.ts`

**Interfaces:**
- Produces `CAMPAIGN_CHAPTERS`, `CAMPAIGN_DECISION_IDS`, `campaignLength`, `PROMOTION_REPORT`, `validatePublishedCampaign()` and `decisionCountAtMandateYearEnd()` inputs derived from the sole topology.
- Consumes V10 catalogue IDs and the 12 ordered promotion declarations.

- [ ] **Step 1: Write red topology tests.**

```ts
assert.equal(campaignLength, 72);
assert.equal(CAMPAIGN_DECISION_IDS.length * 2, 144);
assert.equal(PROMOTION_REPORT.candidates.length, 12);
assert.deepEqual(PROMOTION_REPORT.candidates.map((x) => x.status), Array(12).fill("promoted"));
assert.match(validatePublishedCampaign(withLength(71)).join("|"), /campaign-length/);
assert.match(validatePublishedCampaign(withLength(73)).join("|"), /campaign-length/);
```

- [ ] **Step 2: Run the red test.**

Run: `node --experimental-strip-types --test src/simulateur-v3/campaign-topology.test.ts src/simulateur-v3/promotion-report.test.ts`

Expected: FAIL because the topology is still a flat 60-ID array.

- [ ] **Step 3: Build the immutable topology and report.**

Declare eight chapter arrays with the exact 60 core IDs from spec section 6.3. Insert the following 12 candidates after their specified anchors in stable declaration order: `relever-tva-restauration-commerciale`, `perenniser-surtaxe-grandes-entreprises`, `revenir-a-62-ans`, `doubler-les-franchises-medicales`, `fiscalite-nutritionnelle-au-niveau-recommande`, `reduire-les-delais-de-traitement-de-l`, `etaler-la-marche-2026-de-la-programmation`, `reduire-l-aide-publique-au-developpement-de`, `supprimer-le-bonus-automobile-electrique`, `renforcer-la-taxe-sur-les-billets-d`, `supprimer-les-departements`, `ne-pas-remplacer-un-depart-administratif-sur`.

```ts
export type PromotionEvidence = { proof: string; score: 8 | 9 | 10; status: "promoted" | "rejected"; rejectionReason: null | string };
export const CAMPAIGN_CHAPTERS: readonly { chapterId: string; decisionIds: readonly string[] }[] = /* eight frozen lists */;
export const CAMPAIGN_DECISION_IDS = CAMPAIGN_CHAPTERS.flatMap((chapter) => chapter.decisionIds);
export const campaignLength = CAMPAIGN_DECISION_IDS.length;
```

`validatePublishedCampaign` requires eight nonempty unique chapters, 60 ordered core IDs, 12 promoted candidates, 72 known unique IDs, chapter membership, five derived checkpoints and no unpublished references in locks or crises. It must not offer a variable-length fallback.

- [ ] **Step 4: Run topology tests.**

Run: `node --experimental-strip-types --test src/simulateur-v3/campaign-topology.test.ts src/simulateur-v3/promotion-report.test.ts src/simulateur-v3/timeline.test.ts`

Expected: PASS; the fifth checkpoint is 72 and final-decision event, promise and transition flow are due at 72.

- [ ] **Step 5: Commit.**

```bash
git add site/src/simulateur-v3/campaign-topology.ts site/src/simulateur-v3/campaign-topology.test.ts site/src/simulateur-v3/promotion-report.ts site/src/simulateur-v3/promotion-report.test.ts site/src/simulateur-v3/scenario.ts
git commit -m "feat: publish fixed 72-decision topology"
```

### Task 4: Flux, checkpoints et renversement sans double application

**Files:**
- Modify: `site/src/simulateur-v3/effects.ts`
- Modify: `site/src/simulateur-v3/timeline.ts`
- Modify: `site/src/simulateur-v3/flow.ts`
- Modify: `site/src/simulateur-v3/campaign.ts`
- Modify: `site/src/simulateur-v3/validation.ts`
- Modify: `site/src/simulateur-v3/effects.test.ts`
- Modify: `site/src/simulateur-v3/timeline.test.ts`
- Modify: `site/src/simulateur-v3/flow.test.ts`

**Interfaces:**
- Produces `scheduleBudgetProfile`, `reverseDecisionConsequences` and causal entries carrying the unique transition-flow ID.
- Consumes `BudgetProfile`, V10 topology and decision records.

- [ ] **Step 1: Write red lifecycle tests.**

```ts
assert.equal(checkpointAfterYear2.indicators.annualBalance, baseline + 2_700);
assert.equal(checkpointAfterYear3.annualBalance, baseline + 2_700 - 450);
assert.equal(reverseDecisionConsequences(state, "unifier-ir-csg-bareme-continu").scheduledEvents.length, 0);
assert.equal(reverseDecisionConsequences(state, "unifier-ir-csg-bareme-continu").activePromises.length, 0);
```

- [ ] **Step 2: Run the red tests.**

Run: `node --experimental-strip-types --test src/simulateur-v3/effects.test.ts src/simulateur-v3/timeline.test.ts src/simulateur-v3/flow.test.ts`

Expected: FAIL because transition flows are currently encoded as ordinary budget effects and reversal leaves queued consequences.

- [ ] **Step 3: Implement profile scheduling and reversal.**

Convert `runRateTiming.immediate` to the selecting decision and `mandate_year` to `decisionCountAtMandateYearEnd`; leave `after_decisions` for events, promises and transition flows only. Materialize each transition flow once under its declared causal ID; annual checkpoints include only flows first due since the preceding checkpoint while the recurring run rate persists. `reverseDecisionConsequences(state, decisionId)` removes queued events, active promises and unmaterialized transition flows sourced by that decision, retains ledger entries already materialized, and changes its record to `reversed`.

- [ ] **Step 4: Run targeted tests.**

Run: `node --experimental-strip-types --test src/simulateur-v3/effects.test.ts src/simulateur-v3/timeline.test.ts src/simulateur-v3/flow.test.ts src/simulateur-v3/validation.test.ts`

Expected: PASS; a one-off receipt affects one checkpoint only, recurring flow persists and reverse never replays or removes realized history.

- [ ] **Step 5: Commit.**

```bash
git add site/src/simulateur-v3/effects.ts site/src/simulateur-v3/timeline.ts site/src/simulateur-v3/flow.ts site/src/simulateur-v3/campaign.ts site/src/simulateur-v3/validation.ts site/src/simulateur-v3/effects.test.ts site/src/simulateur-v3/timeline.test.ts site/src/simulateur-v3/flow.test.ts
git commit -m "feat: schedule and reverse budget profiles"
```

### Task 5: Résolution V9/V10, migration v4-v5 et crises

**Files:**
- Create: `site/src/simulateur-v3/scenario-v9.ts`
- Create: `site/src/simulateur-v3/scenario-v10.ts`
- Create: `site/src/simulateur-v3/scenario-resolver.ts`
- Modify: `site/src/simulateur-v3/scenario.ts`
- Modify: `site/src/simulateur-v3/storage.ts`
- Modify: `site/src/simulateur-v3/scenario-crises.ts`
- Modify: `site/src/simulateur-v3/crises.ts`
- Modify: `site/src/simulateur-v3/storage.test.ts`
- Modify: `site/src/simulateur-v3/scenario-crises.test.ts`

**Interfaces:**
- Produces `scenarioForVersion(version): Scenario | null`, `migrateV4ToV5(value): CampaignState | null` and `hasReplacedReference(state): boolean`.
- Consumes V9, V10, 18 substitution IDs and the Task 4 reversal operation.

- [ ] **Step 1: Write red restore and crisis tests.**

```ts
assert.equal(scenarioForVersion(9), SCENARIO_V9);
assert.equal(scenarioForVersion(10), SCENARIO_V10);
assert.equal(restoreCampaign(storageWithV4Unchanged, SCENARIO_V10).kind, "restored");
assert.equal(restoreCampaign(storageWithReplacedFlatTax, SCENARIO_V10).kind, "restart_required");
assert.equal(SCENARIO_V10_CRISIS_RULES.flatMap((rule) => rule.concessions).filter((x) => x.targetDecisionId === "unifier-ir-csg-bareme-continu").length, 1);
```

- [ ] **Step 2: Run the red tests.**

Run: `node --experimental-strip-types --test src/simulateur-v3/storage.test.ts src/simulateur-v3/scenario-crises.test.ts`

Expected: FAIL because current storage accepts only schema 4 and crises reference flat tax.

- [ ] **Step 3: Implement versioned resolution and explicit migration.**

Move the existing scenario 9 objects unchanged to `scenario-v9.ts`; construct V10 in `scenario-v10.ts`; make all current callers resolve instead of silently importing a mutable current scenario. `migrateV4ToV5` creates simple profiles only when `decisionId`, `optionId`, meaning and scope are unchanged. For any replaced ID found in decisions, locks, queued events, promises, crisis state or causal ledger, return `restart_required` while preserving the serialized save. Replace the flat-tax crisis with two executable answers: keep `unifier-ir-csg-bareme-continu`, or reverse it through Task 4 and retain separate levies with sourced transition costs. Audit the state-reform crisis so each rule has two applicable causes and two applicable answers, all published in V10.

- [ ] **Step 4: Run restore and crisis tests.**

Run: `node --experimental-strip-types --test src/simulateur-v3/storage.test.ts src/simulateur-v3/scenario.test.ts src/simulateur-v3/scenario-crises.test.ts src/simulateur-v3/crises.test.ts`

Expected: PASS; V9 remains renderable, V10 never reinterprets a replaced decision and reverse clears only future consequences.

- [ ] **Step 5: Commit.**

```bash
git add site/src/simulateur-v3/scenario-v9.ts site/src/simulateur-v3/scenario-v10.ts site/src/simulateur-v3/scenario-resolver.ts site/src/simulateur-v3/scenario.ts site/src/simulateur-v3/storage.ts site/src/simulateur-v3/scenario-crises.ts site/src/simulateur-v3/crises.ts site/src/simulateur-v3/storage.test.ts site/src/simulateur-v3/scenario-crises.test.ts
git commit -m "feat: migrate simulator saves to scenario v10"
```

### Task 6: Trois parcours équilibrés et maximum compatible sourcé

**Files:**
- Create: `site/src/simulateur-v3/balanced-paths.ts`
- Create: `site/src/simulateur-v3/balanced-paths.test.ts`
- Modify: `site/src/simulateur-v3/campaign-e2e.test.ts`
- Modify: `site/src/simulateur-v3/verdict.test.ts`

**Interfaces:**
- Produces `BALANCED_PATHS`, `simulatePath(path, scenario)` and `maximumCompatibleRunRate(scenario): number`.
- Consumes fixed `CAMPAIGN_DECISION_IDS`, Task 1 registry and Task 4 engine.

- [ ] **Step 1: Write red path tests.**

```ts
assert.deepEqual(BALANCED_PATHS.map((path) => path.id), ["doctrine-38500", "redressement-prudent", "reformes-structurelles"]);
for (const path of BALANCED_PATHS) assert.equal(path.optionIds.length, 72);
assert.equal(simulatePath(BALANCED_PATHS[0]!, SCENARIO_V10).indicators.annualBalance >= 0, true);
assert.equal(structuralRunRate(BALANCED_PATHS[0]!), 38_500);
assert.equal(maximumCompatibleRunRate(SCENARIO_V10) <= 185_000, true);
```

- [ ] **Step 2: Run the red tests.**

Run: `node --experimental-strip-types --test src/simulateur-v3/balanced-paths.test.ts src/simulateur-v3/campaign-e2e.test.ts`

Expected: FAIL because no full compatible paths or registry-based optimizer exists.

- [ ] **Step 3: Define and validate the three paths.**

Store every path as 72 fully qualified `decisionId:optionId` strings in topology order. `simulatePath` must drive `selectOption`, `confirmSelection` and `advanceCampaign` rather than sum cards. Reject a path with an unknown ID, duplicate decision, missing decision, locked option or collision. `maximumCompatibleRunRate` searches only registered `runRateMillions`, checks exclusive keys and locks, and returns a documented value in the interval 175 000 to 185 000; do not insert any synthetic offset to make that interval pass.

- [ ] **Step 4: Run full path tests.**

Run: `node --experimental-strip-types --test src/simulateur-v3/balanced-paths.test.ts src/simulateur-v3/campaign-e2e.test.ts src/simulateur-v3/verdict.test.ts`

Expected: PASS; each path has 72 journal records, five councils, one verdict and a nonnegative final annual balance.

- [ ] **Step 5: Commit.**

```bash
git add site/src/simulateur-v3/balanced-paths.ts site/src/simulateur-v3/balanced-paths.test.ts site/src/simulateur-v3/campaign-e2e.test.ts site/src/simulateur-v3/verdict.test.ts
git commit -m "test: prove balanced v10 decision paths"
```

### Task 7: Rendu V10, dossiers superseded et mobile 390

**Files:**
- Modify: `site/src/simulateur-v3/render.ts`
- Modify: `site/src/simulateur-v3/presentation.ts`
- Modify: `site/src/simulateur-v3/render.test.ts`
- Modify: `site/src/simulateur-v3/presentation.test.ts`
- Modify: `site/src/style.css`
- Create: `site/tests/simulateur-v10-mobile.test.mjs`
- Modify: `site/package.json`

**Interfaces:**
- Produces `renderSimulatorV3(state, scenario)` with `Dossier X sur 72`, a hidden `superseded` card and annual wording from `BudgetProfile`.
- Consumes scenario length and the Task 4 state without a hard-coded checkpoint or card total.

- [ ] **Step 1: Write red rendering and browser tests.**

```ts
assert.match(renderSimulatorV3(active, SCENARIO_V10), /Dossier 1 sur 72/);
assert.doesNotMatch(renderSimulatorV3(stateWithSuperseded, SCENARIO_V10), /revenir à 62 ans/i);
assert.doesNotMatch(renderSimulatorV3(active, SCENARIO_V10), /—/);
```

```js
for (const phase of ["decision", "decision_result", "council", "crisis", "verdict"]) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${serverUrl}/simulateur?phase=${phase}`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
}
```

- [ ] **Step 2: Run the red tests.**

Run: `node --experimental-strip-types --test src/simulateur-v3/render.test.ts src/simulateur-v3/presentation.test.ts && npm run test:mobile390`

Expected: FAIL because the mobile script and dynamic V10 presentation do not exist.

- [ ] **Step 3: Implement output that derives solely from scenario state.**

Add `test:mobile390` using `@playwright/test`. Render annual run-rate labels as `+N milliards d'euros par an`, `-N millions d'euros par an` or `Solde public inchangé`; put transition costs only in analysis and trajectory. Filter `superseded` decisions before card rendering while preserving automatic journal records and progress at 72. Remove EPR2 third-choice layout and any pre-choice non-budget pill. Add wrapping, minimum-width and overflow rules needed for the five phases at 390 x 844; do not hide body overflow to mask a layout fault.

- [ ] **Step 4: Run visual and content tests.**

Run: `node --experimental-strip-types --test src/simulateur-v3/render.test.ts src/simulateur-v3/presentation.test.ts && npm run test:mobile390`

Expected: PASS; all five phases satisfy `scrollWidth <= clientWidth` and the visible simulator contains no cadratin.

- [ ] **Step 5: Commit.**

```bash
git add site/src/simulateur-v3/render.ts site/src/simulateur-v3/presentation.ts site/src/simulateur-v3/render.test.ts site/src/simulateur-v3/presentation.test.ts site/src/style.css site/tests/simulateur-v10-mobile.test.mjs site/package.json site/package-lock.json
git commit -m "feat: render fixed v10 campaign on mobile"
```

### Task 8: Intégration, contrôles de non-régression et livraison

**Files:**
- Modify only files changed by Tasks 1 through 7.
- Test: `site/src/simulateur-v3/*.test.ts`, `site/tests/simulateur-v10-mobile.test.mjs`

**Interfaces:**
- Consumes the complete V10 scenario and produces a releasable build with no legacy V10 references.

- [ ] **Step 1: Add one red integration assertion before final fixes.**

```ts
assert.equal(validateScenario(SCENARIO_V10), []);
assert.equal(SCENARIO_V10.decisions.length, 72);
assert.equal(SCENARIO_V10.decisions.flatMap((decision) => decision.options).length, 144);
```

- [ ] **Step 2: Run it and record the failing invariant, if any.**

Run: `node --experimental-strip-types --test src/simulateur-v3/scenario.test.ts`

Expected: PASS only after all Task 1 through Task 7 invariants are integrated; otherwise fix the named invariant before proceeding.

- [ ] **Step 3: Run the complete test suite, build and mobile check.**

Run: `npm test && npm run build && npm run test:mobile390`

Expected: PASS; TypeScript emits no error, the Vite build and pre-render complete, and 390 x 844 has no horizontal overflow.

- [ ] **Step 4: Inspect the final diff and legacy coherence.**

Run: `rg -n "60 à 70|60-70|70 dossiers|140 options|flat-tax-a-20|fourteen|150_000|150 000" src/simulateur-v3 docs/superpowers/specs && git diff --check`

Expected: no active V10 match; historical V9 matches are confined to `scenario-v9.ts`; `git diff --check` has no output.

- [ ] **Step 5: Commit the integration result.**

```bash
git add site
git commit -m "feat: complete simulator v10 72-decision release"
```

## Self-review

- Spec coverage: Tasks 1 and 2 cover `BudgetProfile`, register, 18 substitutions, fiscal doctrine, two-option EPR2 and source boundaries. Task 3 covers fixed 72, 12 promotions, 96/192 inventory, report and dynamic checkpoints. Task 4 covers run rates, transition flows, causal ledger, locks and reversals. Task 5 covers V9/V10 resolution, v4-v5 migration, active-save restart and both crisis families. Task 6 covers the three balanced paths, 38 500 M€ structural ceiling and sourced maximum. Task 7 covers card wording, superseded visibility, no cadratin and mobile 390. Task 8 runs full verification.
- Placeholder scan: this document contains no unfinished marker, deferred implementation marker or unspecified interface.
- Type consistency: `BudgetProfile`, `BudgetEstimate`, `CAMPAIGN_CHAPTERS`, `PROMOTION_REPORT`, `scenarioForVersion`, `migrateV4ToV5`, `BALANCED_PATHS`, `simulatePath` and `maximumCompatibleRunRate` are introduced once and consumed under the same names in later tasks.

Plan complete and saved to `docs/superpowers/plans/2026-08-31-simulateur-v10-72-decisions.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration.

2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints.
