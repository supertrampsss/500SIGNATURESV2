# Simulateur V10, 72 décisions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publier le scénario 10, auditable et restaurable, avec 96 dossiers, une campagne figée de 72 décisions, 144 options et trois parcours budgétairement tenables.

**Architecture:** Le catalogue V10 porte un `BudgetProfile` relié à un registre nominatif de chiffrage. Une topologie de build immuable compose les 60 décisions de noyau et les 12 promotions qualifiées, puis dérive longueur, chapitres et checkpoints. Le moteur traduit le profil en flux annuels et ponctuels causaux, ce qui permet la migration V9, les renversements de crise et le calcul de trois parcours complets.

**Tech Stack:** TypeScript 5.9, Node test runner, Vite 7, Playwright pour le contrôle navigateur 390 x 844.

## Global Constraints

- `SCENARIO_V10.version` vaut `10` et `SCHEMA_VERSION` vaut `5`; `SCENARIO_V9` reste disponible en lecture.
- La bibliothèque contient exactement 96 `Decision` uniques et 192 options; V10 contient exactement 72 décisions et 144 options, longueur figée au build.
- La topologie a huit chapitres, un noyau ordonné de 60 identifiants et exactement 12 promotions `promoted`; les décisions verrouillées restent journalisées mais ne rendent pas de carte, d'où environ 62 à 68 cartes affichées selon le parcours.
- Toute `PolicyOptionDefinition.id` locale vaut `adopt` ou `keep`; le compilateur produit les `DecisionOption.id` entièrement qualifiés `${decisionId}:adopt` et `${decisionId}:keep`. Pour EPR2, ces options portent les libellés visibles `Engager six EPR2` et `Ne pas engager de nouvel EPR2`.
- Aucun texte rendu ne contient `—`; aucune carte ne montre opinion, confiance, marchés ou groupes avant le choix.
- Aucun flux non nul n'est accepté sans entrée de registre, source primaire, assiette, millésime, nature, calcul brut, décote comportementale, coût récurrent et clé de périmètre exclusive.
- `unifier-ir-csg-bareme-continu` est neutre; la prime d'activité est recyclée à plus ou moins 1 M€; aucune flat tax fictive à 150 000 M€ n'existe.
- Les 18 substitutions doctrinales et les deux emplacements fiscaux de promotion maintiennent le total 96. Les deux variantes de flat tax sont remplacées par `perenniser-surtaxe-grandes-entreprises` et `relever-tva-restauration-commerciale`.
- Les 18 substitutions structurelles totalisent exactement 21 689 M€ nets, dont trois dossiers neutres ou bloqués à 0. `perenniser-surtaxe-grandes-entreprises` utilise `corporate-profit-surtax-2026`: 7 300 M€ bruts moins 730 M€ de décote comportementale, soit 6 570 M€ nets. `relever-tva-restauration-commerciale` utilise `commercial-restaurant-vat-10`, distincte de la TVA normale: 2 275 M€ bruts moins 228 M€ de décote, soit 2 047 M€ nets. Les deux promotions fiscales totalisent 8 617 M€ et le total structurel plus les deux promotions fiscales est 30 306 M€; elles ne relèvent pas du plafond des 18. Les dix autres promotions gardent leurs effets propres hors de ce total.
- Les trois parcours `doctrine-21689`, `redressement-prudent` et `reformes-structurelles` ont une option par décision publiée, passent les `locks`, intègrent crises, échéances et coûts ponctuels. Ils visent un solde annuel final nul ou positif uniquement à partir des options sourcées; à défaut, le build publie l'écart honnête. Le maximum compatible est calculé et rapporté depuis les écritures sourcées, sans seuil imposé.

---

## File map

| Fichier | Responsabilité V10 |
|---|---|
| `site/src/simulateur-v3/types.ts` | Contrats de profil, état, schéma 5 et écritures causales de flux. |
| `site/src/simulateur-v3/budget-registry.ts` | Registre typé, jointure `decisionId:optionId:estimateKey` et contrôle des périmètres exclusifs. |
| `docs/superpowers/specs/2026-08-31-v10-budget-estimates-audit.md` | Annexe primaire des bases, formules, sources et réserves du registre V10. |
| `site/src/simulateur-v3/policy-catalogue.ts`, `policy-consequences.ts` et `policies/*.ts` | Compilation des options réelles à deux choix à partir du profil V10, sans ancien contrat budgétaire. |
| `site/src/simulateur-v3/campaign-topology.ts` et `promotion-report.ts` | Noyau, promotions, rapport figé, longueur 72 et checkpoints dérivés. |
| `site/src/simulateur-v3/effects.ts`, `timeline.ts`, `flow.ts`, `validation.ts` | Planification, matérialisation et annulation sûre des flux. |
| `site/src/simulateur-v3/scenario-v9.snapshot.ts`, `scenario-v9.ts`, `scenario-v10.ts`, `scenario-resolver.ts`, `storage.ts` | Snapshot V9 autonome, résolution par version et migration v4 vers v5 sans rejouer le passé. |
| `site/src/simulateur-v3/scenario-crises.ts`, `crises.ts` | Crises compatibles V10 et renversement causal complet. |
| `site/src/simulateur-v3/balanced-paths.ts` | Trois parcours publiés et calcul du maximum compatible. |
| `site/src/simulateur-v3/render.ts`, `presentation.ts`, `style.css` | Compteur dérivé, cartes sobres et rendu mobile sans débordement. |

### Task 0: Capturer le scénario V9 avant toute modification V10

**Files:**
- Create: `site/scripts/snapshot-scenario-v9.ts`
- Create: `site/src/simulateur-v3/scenario-v9.snapshot.ts`
- Create: `site/src/simulateur-v3/scenario-v9.snapshot.test.ts`

**Interfaces:**
- Produces `SCENARIO_V9_SNAPSHOT: Scenario`, un littéral statique qui n'importe ni policies, ni consequences, ni registre, ni topologie V10.
- Consumes exclusivement le scénario courant pré-refonte pendant l'exécution unique du script de capture.

- [ ] **Step 1: Write the red parity test before editing policies or consequences.**

```ts
import { SCENARIO_V3 as SCENARIO_V3_PRE_REFACTOR } from "./scenario.ts";
import { SCENARIO_V9_SNAPSHOT } from "./scenario-v9.snapshot.ts";
assert.deepEqual(JSON.parse(JSON.stringify(SCENARIO_V9_SNAPSHOT)), JSON.parse(JSON.stringify(SCENARIO_V3_PRE_REFACTOR)));
```

- [ ] **Step 2: Run the red test.**

Run: `node --experimental-strip-types --test src/simulateur-v3/scenario-v9.snapshot.test.ts`

Expected: FAIL because the static V9 snapshot has not yet been generated.

- [ ] **Step 3: Generate and freeze the V9 literal.**

In `site/scripts/snapshot-scenario-v9.ts`, import the pre-refactor source with `import { SCENARIO_V3 as SCENARIO_V3_PRE_REFACTOR } from "../src/simulateur-v3/scenario.ts";`. Run `node --experimental-strip-types scripts/snapshot-scenario-v9.ts` while that alias still resolves to the unmodified scenario. The script serializes that value into `scenario-v9.snapshot.ts` as `export const SCENARIO_V9_SNAPSHOT: Scenario = Object.freeze(...)`; it must not leave an import of the pre-refactor scenario in the generated file.

- [ ] **Step 4: Run the green parity test.**

Run: `node --experimental-strip-types --test src/simulateur-v3/scenario-v9.snapshot.test.ts`

Expected: PASS; the snapshot equals the pre-refactor scenario and is self-contained.

- [ ] **Step 5: Commit the immutable historical input.**

```bash
git add site/scripts/snapshot-scenario-v9.ts site/src/simulateur-v3/scenario-v9.snapshot.ts site/src/simulateur-v3/scenario-v9.snapshot.test.ts
git commit -m "test: freeze simulator scenario v9"
```

### Task 1: Contrat budgétaire et registre de chiffrage

**Files:**
- Modify: `docs/superpowers/specs/2026-08-31-v10-budget-estimates-audit.md`
- Create: `site/src/simulateur-v3/budget-registry.ts`
- Create: `site/src/simulateur-v3/budget-registry.test.ts`
- Modify: `site/src/simulateur-v3/types.ts`
- Modify: `site/src/simulateur-v3/policy-catalogue.ts`
- Modify: `site/src/simulateur-v3/policy-consequences.ts`
- Modify: `site/src/simulateur-v3/validation.ts`
- Test: `site/src/simulateur-v3/types.test.ts`
- Test: `site/src/simulateur-v3/policy-consequences.test.ts`

**Interfaces:**
- Produces `BudgetProfile`, `BudgetEstimate`, `validateBudgetProfile(profile, decisionId, optionId): string[]`, `budgetEstimateFor(decisionId, optionId, estimateKey): BudgetEstimate`, `primeActivityRecycleDifferenceMillions(): number` and `findExclusiveScopeCollisions(profiles): string[]`.
- Consumes `EffectTiming`, `DecisionOption` and `PolicyOptionDefinition` from the current simulator contract.

- [ ] **Step 1: Write failing tests for a valid typed estimate, an absent estimate, a duplicate scope and a null keep profile.**

```ts
assert.deepEqual(validateBudgetProfile({ estimateKey: null, runRateMillions: 0, runRateTiming: null, transitionFlows: [], exclusiveScopeKeys: [] }, "d", "keep"), []);
assert.throws(() => budgetEstimateFor("d", "adopt", "missing"), /Unknown budget estimate/);
assert.deepEqual(findExclusiveScopeCollisions([profile("scope-a"), profile("scope-a")]), ["scope-a"]);
assert.equal(Math.abs(primeActivityRecycleDifferenceMillions()) <= 1, true);
assert.doesNotMatch(readFileSync(new URL("./policy-consequences.ts", import.meta.url), "utf8"), /budgetDuration|budgetTiming|annualBalance/);
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

`validateBudgetProfile` impose une clé et un calendrier pour tout flux non nul, un identifiant ponctuel unique, une échéance dans la campagne, l'égalité `grossActionMillions - behavioralOffsetMillions - recurringOperatingCostMillions === runRateMillions`, et aucune clé pour `keep`. Remplacer dans `PolicyOptionDefinition` les trois champs `budgetDelta`, `budgetDuration`, `budgetTiming` par `budgetProfile`; valider ses IDs locaux `adopt`/`keep`; puis compiler uniquement les effets budgétaires dérivés de ce profil avec `DecisionOption.id` égal à `decisionId + ":" + localOptionId`. Dans `policy-consequences.ts`, retirer les métadonnées budgétaires héritées, conserver seulement les conséquences non budgétaires et faire vérifier par `policy-consequences.test.ts` que ni `budgetDuration` ni `budgetTiming` ni un delta `annualBalance` ne peut y être déclaré.

- [ ] **Step 4: Run the focused tests and type check.**

Run: `node --experimental-strip-types --test src/simulateur-v3/budget-registry.test.ts src/simulateur-v3/types.test.ts src/simulateur-v3/policy-consequences.test.ts && npx tsc -p tsconfig.type-tests.json --noEmit`

Expected: PASS; une clé exclusive réutilisée par deux décisions est refusée.

- [ ] **Step 5: Commit.**

```bash
git add docs/superpowers/specs/2026-08-31-v10-budget-estimates-audit.md site/src/simulateur-v3/types.ts site/src/simulateur-v3/budget-registry.ts site/src/simulateur-v3/budget-registry.test.ts site/src/simulateur-v3/policy-catalogue.ts site/src/simulateur-v3/policy-consequences.ts site/src/simulateur-v3/policy-consequences.test.ts site/src/simulateur-v3/validation.ts site/src/simulateur-v3/types.test.ts
git commit -m "feat: add typed simulator budget registry"
```

### Task 2: Catalogue V10, 18 substitutions et options atomiques

**Files:**
- Modify: `site/src/simulateur-v3/policies/taxes.ts`
- Modify: `site/src/simulateur-v3/policies/work.ts`
- Modify: `site/src/simulateur-v3/policies/health.ts`
- Modify: `site/src/simulateur-v3/policies/energy.ts`
- Modify: `site/src/simulateur-v3/policies/state.ts`
- Modify: `site/src/simulateur-v3/budget-registry.ts`
- Modify: `site/src/simulateur-v3/budget-registry.test.ts`
- Modify: `site/src/simulateur-v3/policy-sources.ts`
- Modify: `site/src/simulateur-v3/policy-catalogue.test.ts`
- Modify: `site/src/simulateur-v3/scenario.test.ts`
- Modify: `site/src/simulateur-v3/campaign.test.ts`
- Test: `site/src/simulateur-v3/causal-contract-source.test.ts`

**Interfaces:**
- Produces a 96-decision V10 catalogue whose every option has `budgetProfile`; every non-null, nonzero `adopt` estimate resolves in `BUDGET_ESTIMATES`, while neutral `adopt` options use the strict null profile.
- Consumes the Task 1 registry and returns only two options per decision.

- [ ] **Step 1: Write red inventory tests.**

```ts
assert.equal(SCENARIO_V10_CATALOGUE.decisions.length, 96);
assert.equal(SCENARIO_V10_CATALOGUE.decisions.flatMap((d) => d.options).length, 192);
assert.equal(policyById("flat-tax-a-20-des-le-premier"), undefined);
assert.deepEqual(policyById("engager-six-epr2-part-annuelle-de-l")!.options.map((option) => option.id), ["engager-six-epr2-part-annuelle-de-l:adopt", "engager-six-epr2-part-annuelle-de-l:keep"]);
assert.deepEqual(policyById("engager-six-epr2-part-annuelle-de-l")!.options.map((option) => option.label), ["Engager six EPR2", "Ne pas engager de nouvel EPR2"]);
assert.equal(policyById("relever-tva-restauration-commerciale")!.chapterId, "taxes-assets-transmission");
assert.equal(policyById("unifier-ir-csg-bareme-continu")!.options.find((option) => option.id === "unifier-ir-csg-bareme-continu:adopt")!.budgetProfile.runRateMillions, 0);
assert.equal(Math.abs(primeActivityRecycleDifferenceMillions()) <= 1, true);
assert.equal(STRUCTURAL_ADOPT_DECISION_IDS.reduce((sum, decisionId) => sum + policyById(decisionId)!.options.find((option) => option.id === `${decisionId}:adopt`)!.budgetProfile.runRateMillions, 0), 21_689);
assert.deepEqual(findExclusiveScopeCollisions([
  policyById("perenniser-surtaxe-grandes-entreprises")!.options[0]!.budgetProfile,
  policyById("relever-tva-restauration-commerciale")!.options[0]!.budgetProfile,
]), []);
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

The former estimate is exactly `grossActionMillions: 7_300`, `behavioralOffsetMillions: 730`, `recurringOperatingCostMillions: 0`, `runRateMillions: 6_570`; the latter is exactly `2_275`, `228`, `0`, `2_047`. Export the ordered `STRUCTURAL_ADOPT_DECISION_IDS` list of the 18 audited IDs and register each with its exact base, gross, behavior, operating-cost, timing and transition values from `2026-08-31-v10-budget-estimates-audit.md`; its `adopt` sum is exactly 21 689 M€. Keep `supprimer-subventions-directes-entreprises:adopt` selectable and published with the strict null profile (`estimateKey: null`, `exclusiveScopeKeys: []`); it claims no scope while the gain is null. Give every `keep` option the null profile. Delete the `fourteen` EPR2 alternative; retain its two internal IDs as `adopt` and `keep`, with visible labels `Engager six EPR2` and `Ne pas engager de nouvel EPR2`. Confirm source URLs point to the Senate PLF 2026 report, BOFiP restaurant VAT and the 2026 Voies et moyens table.

- [ ] **Step 4: Run catalogue and source tests.**

Run: `node --experimental-strip-types --test src/simulateur-v3/policy-catalogue.test.ts src/simulateur-v3/causal-contract-source.test.ts src/simulateur-v3/scenario.test.ts src/simulateur-v3/campaign.test.ts`

Expected: PASS; 96 decisions, 192 options, no flat-tax decision, no 150 000 M€ fiscal effect, EPR2 compiled IDs fully qualified from local `adopt`/`keep`, neutral IR-CSG, prime d'activité recycled within 1 M€ and no surtax/TVA scope collision.

- [ ] **Step 5: Commit.**

```bash
git add site/src/simulateur-v3/policies site/src/simulateur-v3/budget-registry.ts site/src/simulateur-v3/budget-registry.test.ts site/src/simulateur-v3/policy-sources.ts site/src/simulateur-v3/policy-catalogue.test.ts site/src/simulateur-v3/causal-contract-source.test.ts site/src/simulateur-v3/scenario.test.ts site/src/simulateur-v3/campaign.test.ts
git commit -m "feat: rebuild v10 policy catalogue"
```

### Task 3: Topologie fixe 72, 12 promotions et rapport de build

**Files:**
- Modify: `site/src/simulateur-v3/campaign-topology.ts`
- Create: `site/src/simulateur-v3/promotion-report.ts`
- Create: `site/src/simulateur-v3/promotion-report.test.ts`
- Modify: `site/src/simulateur-v3/campaign-topology.test.ts`
- Modify: `site/src/simulateur-v3/scenario.ts`
- Modify: `site/src/simulateur-v3/scenario.test.ts`
- Modify: `site/src/simulateur-v3/campaign.test.ts`

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
export const CAMPAIGN_DECISION_IDS = CAMPAIGN_CHAPTERS.flatMap((chapter) => chapter.decisionIds);
export const campaignLength = CAMPAIGN_DECISION_IDS.length;
```

Write `CAMPAIGN_CHAPTERS` literally as the eight ordered chapter lists in spec section 6.3, then insert the 12 candidates listed above after their anchors. Freeze each `decisionIds` list and the enclosing array. `validatePublishedCampaign` requires eight nonempty unique chapters, 60 ordered core IDs, 12 promoted candidates, 72 known unique IDs, chapter membership, five derived checkpoints and no unpublished references in locks or crises. It must not offer a variable-length fallback. Add scenario and campaign assertions that the resolved V10 catalogue has 96 decisions and 192 options, while its published scenario has 72 decisions and 144 options.

- [ ] **Step 4: Run topology tests.**

Run: `node --experimental-strip-types --test src/simulateur-v3/campaign-topology.test.ts src/simulateur-v3/promotion-report.test.ts src/simulateur-v3/timeline.test.ts`

Expected: PASS; the fifth checkpoint is 72 and final-decision event, promise and transition flow are due at 72.

- [ ] **Step 5: Commit.**

```bash
git add site/src/simulateur-v3/campaign-topology.ts site/src/simulateur-v3/campaign-topology.test.ts site/src/simulateur-v3/promotion-report.ts site/src/simulateur-v3/promotion-report.test.ts site/src/simulateur-v3/scenario.ts site/src/simulateur-v3/scenario.test.ts site/src/simulateur-v3/campaign.test.ts
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
- Modify: `site/src/simulateur-v3/validation.test.ts`

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
git add site/src/simulateur-v3/effects.ts site/src/simulateur-v3/timeline.ts site/src/simulateur-v3/flow.ts site/src/simulateur-v3/campaign.ts site/src/simulateur-v3/validation.ts site/src/simulateur-v3/effects.test.ts site/src/simulateur-v3/timeline.test.ts site/src/simulateur-v3/flow.test.ts site/src/simulateur-v3/validation.test.ts
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
- Modify: `site/src/main.ts`
- Modify: `site/src/simulateur-v3/storage.test.ts`
- Modify: `site/src/simulateur-v3/scenario-crises.test.ts`
- Modify: `site/src/simulateur-v3/render.test.ts`
- Modify: `site/src/interface.test.ts`

**Interfaces:**
- Produces `scenarioForVersion(version): Scenario | null`, `migrateV4ToV5(value): CampaignState | null` and `hasReplacedReference(state): boolean`.
- Consumes V9, V10, 18 substitution IDs and the Task 4 reversal operation.

- [ ] **Step 1: Write red restore and crisis tests.**

```ts
assert.equal(scenarioForVersion(9), SCENARIO_V9);
assert.equal(scenarioForVersion(10), SCENARIO_V10);
assert.deepEqual(SCENARIO_V9, SCENARIO_V9_SNAPSHOT);
assert.match(renderSimulatorV3(completedStateFor(SCENARIO_V9), SCENARIO_V9), /verdict/i);
assert.equal(restoreCampaign(storageWithV4Unchanged, SCENARIO_V10).kind, "restored");
assert.equal(restoreCampaign(storageWithReplacedFlatTax, SCENARIO_V10).kind, "restart_required");
assert.equal(SCENARIO_V10_CRISIS_RULES.flatMap((rule) => rule.concessions).filter((x) => x.targetDecisionId === "unifier-ir-csg-bareme-continu").length, 1);
assert.match(readFileSync(new URL("./main.ts", import.meta.url), "utf8"), /scenarioForVersion\(10\)[\s\S]*mountSimulatorV3\(/);
```

- [ ] **Step 2: Run the red tests.**

Run: `node --experimental-strip-types --test src/simulateur-v3/storage.test.ts src/simulateur-v3/scenario-crises.test.ts`

Expected: FAIL because current storage accepts only schema 4 and crises reference flat tax.

- [ ] **Step 3: Implement versioned resolution and explicit migration.**

Consume the immutable `SCENARIO_V9_SNAPSHOT` created by mandatory Task 0. Make `scenario-v9.ts` export `SCENARIO_V9` from that literal without importing any V10 policy, consequence, registry or topology module. Add a separate `render.test.ts` case that restores a completed V9 state, resolves version 9, and renders its final verdict after V10 has replaced the live catalogue. Construct V10 in `scenario-v10.ts`; make all current callers resolve instead of silently importing a mutable current scenario. In `main.ts`, replace the V3 preview import at the simulator mount with `const scenario = scenarioForVersion(10); if (!scenario) throw new Error("Scenario V10 unavailable"); mountSimulatorV3(hoteV3, scenario, ...)`. `interface.test.ts` must read the mounted branch and prove that this resolver call precedes `mountSimulatorV3`, so an application build cannot accidentally mount V9. `migrateV4ToV5` creates simple profiles only when `decisionId`, `optionId`, meaning and scope are unchanged. For any replaced ID found in decisions, locks, queued events, promises, crisis state or causal ledger, return `restart_required` while preserving the serialized save. Replace the flat-tax crisis with two executable answers: keep `unifier-ir-csg-bareme-continu`, or reverse it through Task 4 and retain separate levies with sourced transition costs. Audit the state-reform crisis so each rule has two applicable causes and two applicable answers, all published in V10.

- [ ] **Step 4: Run restore and crisis tests.**

Run: `node --experimental-strip-types --test src/simulateur-v3/storage.test.ts src/simulateur-v3/scenario.test.ts src/simulateur-v3/scenario-v9.snapshot.test.ts src/simulateur-v3/scenario-crises.test.ts src/simulateur-v3/crises.test.ts src/simulateur-v3/render.test.ts src/interface.test.ts`

Expected: PASS; the static V9 snapshot has pre-refactor parity and renders a completed verdict, V10 never reinterprets a replaced decision and reverse clears only future consequences.

- [ ] **Step 5: Commit.**

```bash
git add site/src/simulateur-v3/scenario-v9.ts site/src/simulateur-v3/scenario-v10.ts site/src/simulateur-v3/scenario-resolver.ts site/src/simulateur-v3/scenario.ts site/src/simulateur-v3/storage.ts site/src/simulateur-v3/scenario-crises.ts site/src/simulateur-v3/crises.ts site/src/main.ts site/src/simulateur-v3/storage.test.ts site/src/simulateur-v3/scenario-crises.test.ts site/src/simulateur-v3/render.test.ts site/src/interface.test.ts
git commit -m "feat: migrate simulator saves to scenario v10"
```

### Task 6: Trois parcours équilibrés et maximum compatible sourcé

**Files:**
- Create: `site/src/simulateur-v3/balanced-paths.ts`
- Create: `site/src/simulateur-v3/balanced-paths.test.ts`
- Modify: `site/src/simulateur-v3/campaign-e2e.test.ts`
- Modify: `site/src/simulateur-v3/verdict.test.ts`

**Interfaces:**
- Produces `type BalancedPathFixture = Readonly<{ id: "doctrine-21689" | "redressement-prudent" | "reformes-structurelles"; optionIds: readonly \`${string}:${"adopt" | "keep"}\`[]; crisisChoiceIds: readonly \`${string}:${string}\`[] }>;`, `BALANCED_PATHS`, `simulatePath(path, scenario)` and `maximumCompatibleRunRate(scenario): number`.
- Consumes fixed `CAMPAIGN_DECISION_IDS`, Task 1 registry and Task 4 engine.

- [ ] **Step 1: Write red path tests.**

```ts
assert.deepEqual(BALANCED_PATHS.map((path) => path.id), ["doctrine-21689", "redressement-prudent", "reformes-structurelles"]);
for (const path of BALANCED_PATHS) assert.equal(path.optionIds.length, 72);
for (const path of BALANCED_PATHS) {
  const result = simulatePath(path, SCENARIO_V10);
  assert.equal(result.phase, "verdict");
  assert.equal(result.status === "balanced" ? result.indicators.annualBalance >= 0 : result.honestGapMillions > 0, true);
  assert.deepEqual(result.crisisHistory.map((crisis) => `${crisis.ruleId}:${crisis.resolvedBy}`), path.crisisChoiceIds);
}
assert.equal(structuralRunRate(BALANCED_PATHS[0]!), 21_689);
assert.equal(Number.isFinite(maximumCompatibleRunRate(SCENARIO_V10)), true);
assert.equal(maximumCompatibleProvenance(SCENARIO_V10).every((estimate) => BUDGET_ESTIMATES[estimate.key] === estimate), true);
```

- [ ] **Step 2: Run the red tests.**

Run: `node --experimental-strip-types --test src/simulateur-v3/balanced-paths.test.ts src/simulateur-v3/campaign-e2e.test.ts`

Expected: FAIL because no full compatible paths or registry-based optimizer exists.

- [ ] **Step 3: Define and validate the three paths.**

Store every path as one `BalancedPathFixture`: 72 fully qualified `decisionId:adopt` or `decisionId:keep` strings in topology order, plus one `crisisRuleId:choiceId` entry for every crise déclenchée. `simulatePath` must drive `selectOption`, `confirmSelection`, `advanceCampaign` and the named crisis concession rather than sum cards; it may reach `verdict` only after consuming all triggered crises in `crisisChoiceIds`. Its result exposes `status: "balanced" | "budget_gap"` and `honestGapMillions`; `balanced` exige un solde annuel final nul ou positif, `budget_gap` conserve le verdict et l'écart calculé sans montant synthétique. Reject a fixture with an unknown ID, duplicate decision, missing decision, locked option, unresolved crisis or collision. `maximumCompatibleRunRate` searches only registered `runRateMillions`, checks exclusive keys and locks, returns the computed documented value, and exposes `maximumCompatibleProvenance` containing exactly the registry estimates used; do not insert any synthetic offset.

- [ ] **Step 4: Run full path tests.**

Run: `node --experimental-strip-types --test src/simulateur-v3/balanced-paths.test.ts src/simulateur-v3/campaign-e2e.test.ts src/simulateur-v3/verdict.test.ts`

Expected: PASS; each path has 72 journal records, five councils, every triggered crisis resolved according to its fixture and one verdict; its result is either nonnegative and `balanced`, or `budget_gap` carries the computed deficit without chiffrage ajouté.

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
- Modify: `site/src/main.ts`
- Modify: `site/src/simulateur-v3/controller.ts`
- Create: `site/src/simulateur-v3/mobile-fixtures.ts`
- Create: `site/src/simulateur-v3/mobile-fixtures.test.ts`
- Create: `site/tests/simulateur-v10-mobile.test.mjs`
- Create: `site/playwright.mobile390.config.ts`
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
import { test, expect } from "@playwright/test";
const phases = ["decision", "decision_result", "council", "crisis", "verdict"];
for (const phase of phases) test(`V10 ${phase} at 390`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/simulateur?e2e-phase=${phase}`);
  await expect(page.locator("#simulateur-v3")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
```

- [ ] **Step 2: Run the red tests.**

Run: `node --experimental-strip-types --test src/simulateur-v3/render.test.ts src/simulateur-v3/presentation.test.ts && npm run test:mobile390`

Expected: FAIL because the mobile script and dynamic V10 presentation do not exist.

- [ ] **Step 3: Implement output that derives solely from scenario state.**

Add `@playwright/test` to `devDependencies`, `test:mobile390:server` as `vite --mode test --host 127.0.0.1 --port 4175 --strictPort`, and `test:mobile390` as `playwright test --config playwright.mobile390.config.ts`. Set `site/playwright.mobile390.config.ts` to `testDir: "./tests"`, `testMatch: "simulateur-v10-mobile.test.mjs"`, `use: { baseURL: "http://127.0.0.1:4175" }`, and `webServer: { command: "npm run test:mobile390:server", url: "http://127.0.0.1:4175/simulateur", reuseExistingServer: false, timeout: 120_000 }`.

Create `stateForE2ePhase(phase, scenario): CampaignState` in `mobile-fixtures.ts` for exactly `decision`, `decision_result`, `council`, `crisis` and `verdict`, each obtained through the real campaign reducer and a V10 fixture. In `main.ts`, only when `import.meta.env.MODE === "test"`, read `e2e-phase` and pass that state as `initialState` to `mountSimulatorV3`; extend the controller options to accept that validated state. This makes every browser URL above mount the requested real phase rather than a cosmetic data attribute. Render annual run-rate labels as `+N milliards d'euros par an`, `-N millions d'euros par an` or `Solde public inchangé`; put transition costs only in analysis and trajectory. Filter `superseded` decisions before card rendering while preserving automatic journal records and progress at 72. Remove EPR2 third-choice layout and any pre-choice non-budget pill. Add wrapping, minimum-width and overflow rules needed for the five phases at 390 x 844; do not hide body overflow to mask a layout fault.

- [ ] **Step 4: Run visual and content tests.**

Run: `node --experimental-strip-types --test src/simulateur-v3/render.test.ts src/simulateur-v3/presentation.test.ts && npm run test:mobile390`

Expected: PASS; all five phases satisfy `scrollWidth <= clientWidth` and the visible simulator contains no cadratin.

- [ ] **Step 5: Commit.**

```bash
git add site/src/simulateur-v3/render.ts site/src/simulateur-v3/presentation.ts site/src/simulateur-v3/render.test.ts site/src/simulateur-v3/presentation.test.ts site/src/simulateur-v3/controller.ts site/src/simulateur-v3/mobile-fixtures.ts site/src/simulateur-v3/mobile-fixtures.test.ts site/src/main.ts site/src/style.css site/tests/simulateur-v10-mobile.test.mjs site/playwright.mobile390.config.ts site/package.json site/package-lock.json
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

- Spec coverage: Tasks 1 and 2 cover `BudgetProfile`, register, the complete audit annexe, 18 substitutions, fiscal doctrine, two-option EPR2 and source boundaries. Task 3 covers fixed 72, 12 promotions, 96/192 inventory, report and dynamic checkpoints. Task 4 covers run rates, transition flows, causal ledger, locks and reversals. Task 5 covers V9/V10 resolution, v4-v5 migration, active-save restart and both crisis families. Task 6 covers the three balanced paths, the 21 689 M€ structural ceiling, the separate 8 617 M€ des deux promotions fiscales and registry-derived maximum. Task 7 covers card wording, superseded visibility, no cadratin and mobile 390. Task 8 runs full verification.
- Scan des marqueurs : le plan et l'annexe complète ne contiennent aucun marqueur de travail différé ni interface non spécifiée.
- Type consistency: `BudgetProfile`, `BudgetEstimate`, `CAMPAIGN_CHAPTERS`, `PROMOTION_REPORT`, `scenarioForVersion`, `migrateV4ToV5`, `BALANCED_PATHS`, `simulatePath` and `maximumCompatibleRunRate` are introduced once and consumed under the same names in later tasks.

Plan complete and saved to `docs/superpowers/plans/2026-08-31-simulateur-v10-72-decisions.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration.

2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints.
