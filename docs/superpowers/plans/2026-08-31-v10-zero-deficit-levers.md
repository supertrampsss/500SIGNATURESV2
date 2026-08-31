# V10 Zero Deficit Levers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chiffrer trois décisions V10 existantes afin que le meilleur parcours compatible atteigne réellement zéro.

**Architecture:** Le registre budgétaire reste l'unique source des montants. Le catalogue relie chaque décision au registre et aux sources publiques. Les tests vérifient les profils, l'absence de double compte, le maximum compatible et le rendu utilisateur.

**Tech Stack:** TypeScript, Node test runner, Vite.

## Global Constraints

- Conserver exactement 72 décisions jouées.
- IR-CSG : +17 900 M€ par an à partir de l'année 2.
- Subventions directes résiduelles : +24 600 M€ par an à partir de l'année 5.
- Doublons territoriaux : +7 500 M€ par an à partir de l'année 5.
- Maximum compatible attendu : 157 281 M€.
- Solde maximal attendu avec la base -152 532 M€ : +4 749 M€.
- Aucun double compte avec apprentissage, bonus automobile, renouvelables, achats, immobilier, absences ou opérateurs.
- Aucun cadratin dans les nouvelles copies.

---

### Task 1: Verrouiller les profils et les totaux par les tests

**Files:**
- Modify: `site/src/simulateur-v3/policy-catalogue.test.ts`
- Modify: `site/src/simulateur-v3/balanced-paths.test.ts`

**Interfaces:**
- Consumes: `v10PolicyById`, `maximumCompatibleRunRate`, `testBaseline`.
- Produces: attentes exécutables sur les trois profils et le solde maximal.

- [ ] **Step 1: Remplacer les attentes nulles par les montants exacts**

Vérifier `17_900`, `24_600` et `7_500`, leurs clés d'estimation et leurs années d'activation.

- [ ] **Step 2: Ajouter l'attente du maximum compatible**

```ts
assert.equal(maximumCompatibleRunRate(SCENARIO_V10), 157_281);
assert.equal(testBaseline().annualBalanceMillions + maximumCompatibleRunRate(SCENARIO_V10), 4_749);
```

- [ ] **Step 3: Exécuter les tests et constater l'échec**

Run: `npm test -- --runInBand`
Expected: FAIL sur les anciens profils nuls ou les anciens totaux.

### Task 2: Ajouter les sources et les estimations auditées

**Files:**
- Modify: `site/src/simulateur-v3/policy-sources.ts`
- Modify: `site/src/simulateur-v3/budget-registry.ts`

**Interfaces:**
- Consumes: `audited`, `registryId`, `PolicySourceKey`.
- Produces: `personal-levy-progressive-gross`, `business-direct-subsidies-residual`, `territorial-competencies-net`.

- [ ] **Step 1: Ajouter les sources Sénat**

Ajouter le rapport MECSS sur les rendements CSG, le rapport sur les aides aux entreprises et le rapport de simplification territoriale.

- [ ] **Step 2: Enregistrer les trois profils**

Utiliser les montants et clés de périmètre exacts des contraintes globales. Les périmètres textuels doivent énumérer toutes les exclusions anti-double-compte.

- [ ] **Step 3: Exécuter les tests de registre et de catalogue**

Run: `npm test -- site/src/simulateur-v3/policy-catalogue.test.ts site/src/simulateur-v3/balanced-paths.test.ts`
Expected: les profils sont trouvés dans le registre, les sources sont connues et les totaux sont exacts.

### Task 3: Relier les décisions et rendre le montant visible

**Files:**
- Modify: `site/src/simulateur-v3/scenario-v10-catalogue.ts`
- Test: `site/src/simulateur-v3/render.test.ts`

**Interfaces:**
- Consumes: les trois clés d'estimation du registre.
- Produces: cartes adopt/keep dont le budget est rendu par `formatV3Amount`.

- [ ] **Step 1: Relier les profils au catalogue**

Définir les années 2, 5 et 5. Reformuler les titres, contextes et contraintes légales sans attribuer le rendement à une simple fusion technique.

- [ ] **Step 2: Vérifier le rendu des montants**

Les cartes doivent contenir les montants arrondis selon la règle existante : `+18 milliards d'euros par an`, `+25 milliards d'euros par an` et `+8 milliards d'euros par an` selon le dossier actif. Le registre et les calculs conservent les valeurs exactes en millions.

- [ ] **Step 3: Exécuter les tests ciblés**

Run: `npm test -- site/src/simulateur-v3/render.test.ts site/src/simulateur-v3/policy-catalogue.test.ts site/src/simulateur-v3/balanced-paths.test.ts`
Expected: PASS.

### Task 4: Vérifier, relire et publier

**Files:**
- Verify: `site/src/simulateur-v3/*`
- Verify: production `https://500signatures.fr/simulateur?version=3`

**Interfaces:**
- Consumes: catalogue V10 compilé.
- Produces: version testée et déployée.

- [ ] **Step 1: Exécuter la suite complète**

Run: `npm test`
Expected: PASS.

- [ ] **Step 2: Construire le site**

Run: `npm run build`
Expected: PASS sans erreur TypeScript ou Vite.

- [ ] **Step 3: Revue indépendante**

Contrôler le diff, les exclusions, les nombres et l'absence de cadratin dans les nouvelles copies.

- [ ] **Step 4: Publier et vérifier la production**

Pousser `main`, attendre le déploiement, puis vérifier sur 500signatures.fr les trois montants et le solde maximal.
