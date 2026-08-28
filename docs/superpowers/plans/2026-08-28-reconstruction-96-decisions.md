# Reconstruction des 96 décisions du simulateur V3

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'adaptation automatique de l'ancien catalogue par 96 décisions éditoriales complètes, sourcées, cohérentes et réparties en 8 chapitres de 4 gestions, 4 transformations et 4 ruptures.

**Architecture:** Le scénario sera construit depuis huit catalogues thématiques explicites et un registre de sources primaires. Un compilateur transformera des définitions éditoriales compactes en `Decision`, sans texte générique de secours. La validation empêchera le retour d'une source globale, d'un chapitre mal équilibré ou d'une option sans conséquence.

**Tech Stack:** TypeScript, Node test runner, Vite, sources publiques officielles françaises et européennes.

## Global Constraints

- Une campagne unique de 96 décisions, organisée en 8 chapitres de 12.
- Chaque chapitre contient exactement 4 décisions `gestion`, 4 `transformation` et 4 `rupture`.
- Aucun texte visible ne contient de cadratin.
- Chaque décision cite au moins une publication HTTPS identifiable, avec institution et date.
- Les effets ludiques sont séparés des faits et présentés comme des hypothèses de jeu.
- Une option de rupture peut coûter, rapporter ou déplacer le risque. Elle ne doit jamais être rendue neutre par défaut.
- Les cartes restent directement cliquables et la position de lecture est conservée.

---

### Task 1: Verrouiller le contrat éditorial

**Files:**
- Modify: `site/src/simulateur-v3/types.ts`
- Modify: `site/src/simulateur-v3/validation.ts`
- Modify: `site/src/simulateur-v3/validation.test.ts`
- Modify: `site/src/simulateur-v3/scenario.test.ts`

**Interfaces:**
- Produces: `DecisionKind = "gestion" | "transformation" | "rupture"` et `Decision.kind`.
- Produces: validation de la matrice 4/4/4, des sources directes et de l'absence de copie générique.

- [ ] **Step 1: Write the failing tests**

```ts
test("chaque chapitre contient quatre gestions, quatre transformations et quatre ruptures", () => {
  for (const chapter of SCENARIO_V3_PREVIEW.chapters) {
    const kinds = chapter.decisionIds.map((id) => SCENARIO_V3_PREVIEW.decisions.find((d) => d.id === id)!.kind);
    assert.deepEqual(Object.fromEntries(["gestion", "transformation", "rupture"].map((kind) => [kind, kinds.filter((value) => value === kind).length])), {
      gestion: 4,
      transformation: 4,
      rupture: 4,
    });
  }
});

test("aucune décision ne dépend de la source globale ni d'un texte générique", () => {
  for (const decision of SCENARIO_V3_PREVIEW.decisions) {
    assert.ok(decision.evidence.every((item) => item.sourceUrl !== "https://plateforme-9sz.pages.dev/sources/"));
    assert.ok(decision.options.every((option) => !option.summary.startsWith("La règle actuelle reste en vigueur")));
  }
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/scenario.test.ts src/simulateur-v3/validation.test.ts`

Expected: FAIL because `kind` is absent and sources are global.

- [ ] **Step 3: Add `DecisionKind`, validate it and require 4/4/4**

```ts
export type DecisionKind = "gestion" | "transformation" | "rupture";

export type Decision = {
  id: string;
  version: number;
  kind: DecisionKind;
  chapterId: string;
  // existing fields stay unchanged
};
```

- [ ] **Step 4: Run focused tests**

Expected: type errors move the work to the explicit catalogue in Task 2.

### Task 2: Créer le registre de sources et le compilateur

**Files:**
- Create: `site/src/simulateur-v3/policy-sources.ts`
- Create: `site/src/simulateur-v3/policy-catalogue.ts`
- Create: `site/src/simulateur-v3/policy-catalogue.test.ts`
- Modify: `site/src/simulateur-v3/scenario.ts`

**Interfaces:**
- Produces: `PolicySourceKey`, `POLICY_SOURCES`, `PolicyDecisionDefinition`, `policyDecision()` et `policyOption()`.
- Consumes: `Decision`, `EffectRule`, `DecisionKind`.

- [ ] **Step 1: Test source resolution and explicit visible copy**

```ts
test("le compilateur refuse une source inconnue et ne fabrique aucun libellé", () => {
  assert.throws(() => policyDecision({ ...VALID_DEFINITION, sourceKeys: ["absente" as PolicySourceKey] }));
  assert.throws(() => policyDecision({ ...VALID_DEFINITION, context: "" }));
});
```

- [ ] **Step 2: Verify RED**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/policy-catalogue.test.ts`

- [ ] **Step 3: Implement the compact definition interface**

```ts
export type PolicyOptionDefinition = {
  id: string;
  label: string;
  summary: string;
  budgetDelta: number;
  uncertainty: Uncertainty;
  beneficiaries: string[];
  contributors: string[];
  indicatorEffects?: Partial<Record<IndicatorKey, number>>;
  groupEffects?: Partial<Record<GroupKey, number>>;
  locks?: string[];
  scheduledEvents?: ScheduledEventRule[];
  promises?: PromiseRule[];
};

export type PolicyDecisionDefinition = {
  id: string;
  chapterId: string;
  kind: DecisionKind;
  title: string;
  context: string;
  options: PolicyOptionDefinition[];
  sourceKeys: PolicySourceKey[];
  evidenceLabel: string;
  evidenceNote: string;
  dependencies?: string[];
  conflicts?: string[];
};
```

- [ ] **Step 4: Populate authoritative source families**

The registry includes direct pages from Budget.gouv.fr, Cour des comptes, COR, DREES, INSEE, DEPP, Justice, DGEF, Défense, RTE, OFGL, France Stratégie and Eurostat. The Institut Thomas More report is retained as an editorial counterpoint, never as the sole basis of a budget amount.

- [ ] **Step 5: Run catalogue tests and commit**

### Task 3: Rebuild chapters 1 and 2

**Files:**
- Create: `site/src/simulateur-v3/policies/taxes.ts`
- Create: `site/src/simulateur-v3/policies/work.ts`
- Create: `site/src/simulateur-v3/policies/chapters-1-2.test.ts`

**Interfaces:**
- Produces: `TAX_DECISIONS` and `WORK_DECISIONS`, each with 12 definitions.

- [ ] **Step 1: Test the exact matrix and conflicts**

The tax chapter contains bracket freeze, VAT 21%, buyback tax, insurance-life succession relief; 50% bracket, wealth tax, end of PFU, succession exemption; first-euro flat tax, flat tax with allowance, 2% centimillionaire floor and abolition of inheritance tax.

The work chapter contains overtime taxation, contribution relief, business subsidies, research tax credit; retirement at 65, retirement at 62, pension de-indexation, unemployment tightening; funded pensions, 39-hour week, 10% minimum-wage rise and a single social allowance.

- [ ] **Step 2: Verify RED with missing arrays**

- [ ] **Step 3: Author all 24 definitions with explicit options, evidence and conflicts**

- [ ] **Step 4: Run tests and commit**

### Task 4: Rebuild chapters 3 and 4

**Files:**
- Create: `site/src/simulateur-v3/policies/health.ts`
- Create: `site/src/simulateur-v3/policies/security.ts`
- Create: `site/src/simulateur-v3/policies/chapters-3-4.test.ts`

**Interfaces:**
- Produces: `HEALTH_DECISIONS` and `SECURITY_DECISIONS`.

- [ ] **Step 1: Test the exact matrix**

Health covers franchises, generic medicines, thermal cures, sick-leave controls; carers, old-age staffing, ARS simplification, nutrition taxation; abolition of AME, automatic RSA, RSA at the poverty line and a single public health-insurance layer.

Security covers police, prison places, justice staff, detention centres; asylum processing, removals, integration, asylum allowance; five-year residence for benefits, immigration quotas, automatic minimum sentences and legal cannabis.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Author all 24 definitions with direct DREES, Cour, Justice and DGEF sources**

- [ ] **Step 4: Run tests and commit**

### Task 5: Rebuild chapters 5 and 6

**Files:**
- Create: `site/src/simulateur-v3/policies/sovereignty.ts`
- Create: `site/src/simulateur-v3/policies/energy.ts`
- Create: `site/src/simulateur-v3/policies/chapters-5-6.test.ts`

**Interfaces:**
- Produces: `SOVEREIGNTY_DECISIONS` and `ENERGY_DECISIONS`.

- [ ] **Step 1: Test the exact matrix**

Sovereignty covers 3% defence, delayed LPM step, reserve and development aid; military service, intelligence, European procurement and an EU defence budget; euro exit, EU exit referendum, a European army and nationalisation of strategic firms.

Energy covers MaPrimeRénov', rail, EV bonus and social leasing; six or fourteen EPR2 or none, carbon pricing, air-ticket tax and organic farming; nuclear exit by 2040, renewables moratorium, thermal-car ban and motorway nationalisation.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Author all 24 definitions using Defence and RTE sources**

- [ ] **Step 4: Run tests and commit**

### Task 6: Rebuild chapters 7 and 8

**Files:**
- Create: `site/src/simulateur-v3/policies/education.ts`
- Create: `site/src/simulateur-v3/policies/state.ts`
- Create: `site/src/simulateur-v3/policies/chapters-7-8.test.ts`

**Interfaces:**
- Produces: `EDUCATION_DECISIONS` and `STATE_DECISIONS`.

- [ ] **Step 1: Test the exact matrix**

Education covers teacher pay, class splitting, pass Culture and grants; social housing, APL, childcare and first-child benefits; school vouchers, withdrawal of private-school funding, universal SNU and full school autonomy.

State covers the civil-service pay point, waiting days, replacement rates and agencies; parliament size, CESE, state shareholdings and local grants; a constitutional debt brake, Senate abolition, department abolition and proportional representation.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Author all 24 definitions using DEPP, DREES, Budget and OFGL sources**

- [ ] **Step 4: Run tests and commit**

### Task 7: Compile the scenario and connect consequences

**Files:**
- Modify: `site/src/simulateur-v3/scenario.ts`
- Modify: `site/src/simulateur-v3/scenario-crises.ts`
- Modify: `site/src/simulateur-v3/scenario-events.ts`
- Modify: `site/src/simulateur-v3/scenario.test.ts`
- Modify: `site/src/simulateur-v3/campaign-e2e.test.ts`

**Interfaces:**
- Consumes all eight decision arrays.
- Produces `SCENARIO_V3_PREVIEW` version 6.

- [ ] **Step 1: Test order, conflicts, eight delayed events and playable end-to-end paths**

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Replace `MESURES.map(toDecision)` with the eight explicit arrays**

```ts
const decisions = [
  ...TAX_DECISIONS,
  ...WORK_DECISIONS,
  ...HEALTH_DECISIONS,
  ...SECURITY_DECISIONS,
  ...SOVEREIGNTY_DECISIONS,
  ...ENERGY_DECISIONS,
  ...EDUCATION_DECISIONS,
  ...STATE_DECISIONS,
].map(policyDecision);
```

- [ ] **Step 4: Update crisis IDs and add one delayed consequence per chapter**

- [ ] **Step 5: Run simulator tests and commit**

### Task 8: Render the richer evidence without polluting the card

**Files:**
- Modify: `site/src/simulateur-v3/render.ts`
- Modify: `site/src/simulateur-v3/render.test.ts`
- Modify: `site/src/styles/simulateur-v3.css`

**Interfaces:**
- Consumes explicit evidence and `Decision.kind`.
- Keeps the decision face compact; details stay in the existing disclosure.

- [ ] **Step 1: Test that source institution, publication and hypothesis note appear only inside evidence details**

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Render sources and uncertainty with no generic explanatory paragraph**

- [ ] **Step 4: Run render tests and commit**

### Task 9: Validate the complete campaign and deploy

**Files:**
- Modify only files required by failures attributable to this work.

- [ ] **Step 1: Run `npm test`**

Expected: 100% pass.

- [ ] **Step 2: Run `npm run build` and `git diff --check`**

- [ ] **Step 3: Run the corpus audit**

Expected: 96 decisions, 8 x 12, 4/4/4 per chapter, 0 generic source, 0 generic keep copy, at least 8 delayed events, no cadratin.

- [ ] **Step 4: Visually inspect desktop and 390 px mobile**

Verify the first, middle and last decision, the three-choice nuclear decision, one crisis and the verdict.

- [ ] **Step 5: Commit, push `main`, wait for deployment and verify production**

