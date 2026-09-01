# Simulator Editorial Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace generic detail copy with exact, useful information for every V11 option.

**Architecture:** Replace parallel fallback arrays with an explicit card-by-card detail catalogue. Render semantic sections only when authored and use the policy evidence already attached to each decision for source links.

**Tech Stack:** TypeScript, Node test runner, existing policy and budget registries.

## Global Constraints

- Remove the `when` field and the « Quand » section everywhere.
- No generic sentence generated from a label or outcome.
- Any announced list, threshold, amount or beneficiary must be named in the detail.
- Acronyms are expanded in ordinary French.
- Neutral options explain the current rule.
- No promotional or disparaging wording.

---

### Task 1: Strengthen the editorial type and tests

**Files:**
- Modify: `site/src/simulateur-v3/types.ts`
- Modify: `site/src/simulateur-v3/scenario-v11-catalogue.test.ts`
- Modify: `site/src/simulateur-v3/render.test.ts`

**Interfaces:**
- Produces: `DecisionOptionDetails` fields `measure`, `currentRule`, `effects`, `calculation`, `sources`.

- [ ] Replace the loose legacy fields with the five player-facing fields and remove `when`.
- [ ] Add forbidden-copy checks for « La règle prend effet », « restent inchangés », « trajectoire actuelle est maintenue » and unnamed « liste publiée ».
- [ ] Require at least two substantive detail sections for every non-neutral option and an explicit current rule for neutral options.
- [ ] Run the catalogue tests; expect failure against current generic copy.

### Task 2: Author fiscal, work and retirement details

**Files:**
- Modify: `site/src/simulateur-v3/scenario-v11-copy.ts`

**Interfaces:**
- Consumes: option profiles and evidence from V11 catalogue entries 1 through 14.
- Produces: exact details for personal taxes, corporate taxes, inheritance, employment aid, retirement, unemployment, hours and wages.

- [ ] Write the current rule and exact measure parameters for each option.
- [ ] Name the savings products and tax reductions removed by the savings card.
- [ ] Explain the retirement cohorts, legal age options and the annual balance estimate without a rollout section.
- [ ] Run the catalogue tests; expect the first 14 decisions to pass their completeness assertions.

### Task 3: Author health, benefits and state-operation details

**Files:**
- Modify: `site/src/simulateur-v3/scenario-v11-copy.ts`

**Interfaces:**
- Consumes: entries 15 through 27 and `budget-registry.ts` estimate notes.
- Produces: exact details for health, social benefits, public staffing, operators, state holdings, local government and voting rules.

- [ ] Explain that the 22 M€ estimate concerns the shared back office for housing assistance and does not merge every benefit into one payment.
- [ ] Name the benefits and organizations affected wherever a card currently says only « prestations » or « organismes ».
- [ ] Name the operators, functions and public holdings used by each scenario.
- [ ] Run the catalogue tests; expect entries 15 through 27 to pass.

### Task 4: Author education, security, immigration and justice details

**Files:**
- Modify: `site/src/simulateur-v3/scenario-v11-copy.ts`

**Interfaces:**
- Consumes: entries 28 through 42, including the independent security measures from the interaction plan.
- Produces: exact staffing volumes, eligibility rules, residence conditions, procedures and justice parameters.

- [ ] Expand all acronyms and name every affected benefit.
- [ ] State the police, gendarmerie, magistrate, clerk and prison-place volumes.
- [ ] Describe the current rule for asylum, removal orders, residence conditions and repeat offending.
- [ ] Run the catalogue tests; expect entries 28 through 42 to pass.

### Task 5: Author climate, transport, energy, defence and Europe details

**Files:**
- Modify: `site/src/simulateur-v3/scenario-v11-copy.ts`

**Interfaces:**
- Consumes: remaining entries and their V10 policy evidence.
- Produces: exact details for housing renovation, rail, electric vehicles, nuclear power, fossil taxation, renewables, defence and European choices.

- [ ] List the fossil-fuel tax advantages removed instead of writing « liste publiée ».
- [ ] Explain the six EPR2 programme, state annual share and existing-fleet option.
- [ ] Name defence targets, personnel volumes and European command implications.
- [ ] Run the complete catalogue tests; expect pass.

### Task 6: Render the new detail model

**Files:**
- Modify: `site/src/simulateur-v3/render.ts`
- Modify: `site/src/style.css`
- Modify: `site/src/simulateur-v3/render.test.ts`

**Interfaces:**
- Consumes: the new `DecisionOptionDetails` model.
- Produces: sections « La mesure », « Aujourd'hui », « Effets », « Calcul » and « Sources ».

- [ ] Render only populated sections and remove every code path for « Quand ».
- [ ] Keep the panel dismissible by background, close button and Escape.
- [ ] Ensure long lists use readable bullets and do not overflow at 390 px.
- [ ] Run render and mobile tests; expect pass.

### Task 7: Full validation and delivery

**Files:**
- Modify only files required by failures caused by this change.

**Interfaces:**
- Produces: tested production build.

- [ ] Run `npm test`; expect zero failures.
- [ ] Run `npm run build`; expect exit code 0.
- [ ] Search production sources for `>Quand<`, `La règle prend effet` and `liste publiée avec transition`; expect zero player-facing matches.
- [ ] Commit with `feat: add substantive details to every simulator choice`.
- [ ] Push `main`, wait for deployment and verify `https://500signatures.fr/simulateur?version=3` visually on desktop and 390 px.
