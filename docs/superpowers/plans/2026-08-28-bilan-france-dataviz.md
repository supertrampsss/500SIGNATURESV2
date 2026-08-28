# Refonte des visualisations BILAN France

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les tableaux qui masquent les tendances de BILAN France par des visualisations éditoriales lisibles sur ordinateur et mobile, sans perdre les données exactes ni leur accessibilité.

**Architecture:** Chaque module métier continue de calculer ses propres données, mais délègue les primitives SVG et HTML accessibles à `site/src/dataviz.ts`. Les tableaux exacts restent dans le DOM sous forme de détails repliables. Une feuille `site/src/styles/bilan-dataviz.css` porte les échelles, les marqueurs et les adaptations mobiles.

**Tech Stack:** TypeScript, SVG natif, HTML sémantique, CSS, Node Test, Vite.

## Global Constraints

- Aucun camembert, aucune 3D et aucun double axe.
- La France et les séries réalisées utilisent le bleu nuit ; le déficit utilise le rouge ; les références utilisent des gris et bleus secondaires.
- Chaque SVG porte `role="img"`, un nom accessible et une description du constat principal.
- Chaque graphique conserve ses valeurs exactes dans un tableau accessible et repliable.
- Aucun graphique ne provoque de débordement horizontal à 390 px.
- Les titres donnent le constat avant de nommer la série.

---

### Task 1: Primitives accessibles de visualisation

**Files:**
- Create: `site/src/dataviz.ts`
- Create: `site/src/dataviz.test.ts`
- Create: `site/src/styles/bilan-dataviz.css`
- Modify: `site/src/style.css`

**Interfaces:**
- Produces: `graphiqueEcart`, `barreEmpilee`, `haltères`, `barresSolde`, `nuageComparatif`, `tableauAccessible`.

- [ ] **Step 1: Write the failing test**

```ts
test("les graphiques portent un nom, une description et les valeurs exactes", () => {
  const html = graphiqueEcart({ titre: "Le déficit se creuse", description: "Écart entre recettes et dépenses", points: [{ periode: "2024", haut: 12, bas: 10 }] });
  assert.match(html, /role="img"/);
  assert.match(html, /<title>Le déficit se creuse<\/title>/);
  assert.match(html, /<desc>Écart entre recettes et dépenses<\/desc>/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test src/dataviz.test.ts`
Expected: FAIL because `dataviz.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Implement pure renderers returning responsive SVG or semantic HTML, using only escaped labels and finite numbers. Add the stylesheet import to `style.css`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test src/dataviz.test.ts`
Expected: PASS.

### Task 2: Tendances budgétaires et fiscales

**Files:**
- Modify: `site/src/ouverture.ts`
- Modify: `site/src/ouverture.test.ts`
- Modify: `site/src/recettes-etat.ts`
- Modify: `site/src/recettes-etat.test.ts`

**Interfaces:**
- Consumes: `graphiqueEcart`, `haltères`, `tableauAccessible` from `dataviz.ts`.
- Produces: une zone de déficit 2000-2025 et des haltères 2017-2025 pour les recettes de l'État.

- [ ] **Step 1: Write failing tests** asserting `.dataviz--ecart`, `.dataviz--halteres`, direct end labels, and exact accessible tables.
- [ ] **Step 2: Run both test files** and confirm the new assertions fail.
- [ ] **Step 3: Replace the two visible tables** with the new renderers, keeping exact tables inside `tableauAccessible`.
- [ ] **Step 4: Run both test files** and confirm PASS.

### Task 3: Composition des 100 euros publics

**Files:**
- Modify: `site/src/cent-euros-apu.ts`
- Modify: `site/src/cent-euros-apu.test.ts`

**Interfaces:**
- Consumes: `barreEmpilee`, `tableauAccessible`.
- Produces: barre empilée des recettes, barres classées des dépenses et aire empilée à 100 % de leur composition historique.

- [ ] **Step 1: Write failing tests** for `.dataviz--composition`, a segment « autres », and the absence of the visible receipts table.
- [ ] **Step 2: Run the test file** and confirm FAIL.
- [ ] **Step 3: Implement the stacked current-year bar and historical 100 % area**, retaining the existing ranked expenditure bars.
- [ ] **Step 4: Run the test file** and confirm PASS.

### Task 4: Comparaisons par fonction et redistribution

**Files:**
- Modify: `site/src/fonctions.ts`
- Modify: `site/src/fonctions.test.ts`
- Modify: `site/src/redistribution.ts`
- Modify: `site/src/redistribution.test.ts`

**Interfaces:**
- Consumes: `haltères`, `tableauAccessible`.
- Produces: dot plot France-Allemagne-zone euro et slopegraph avant-après par décile.

- [ ] **Step 1: Write failing tests** for three labelled markers per public function and two endpoints per income threshold.
- [ ] **Step 2: Run both test files** and confirm FAIL.
- [ ] **Step 3: Replace visible tables** with the comparative renderers and preserve exact tables in details.
- [ ] **Step 4: Run both test files** and confirm PASS.

### Task 5: Sécurité sociale, dette et scénarios

**Files:**
- Modify: `site/src/secu.ts`
- Modify: `site/src/secu.test.ts`
- Modify: `site/src/tenable.ts`
- Modify: `site/src/tenable.test.ts`

**Interfaces:**
- Consumes: `barresSolde`, `tableauAccessible` and the existing line renderer.
- Produces: solde social autour de zéro, debt scenario chart without duplicated visible table, ranked neighbour lollipops.

- [ ] **Step 1: Write failing tests** for zero-baseline surplus/deficit bars, COVID annotation, scenario labels, and France-highlighted ranking.
- [ ] **Step 2: Run both test files** and confirm FAIL.
- [ ] **Step 3: Implement the charts**, remove the visible duplicate scenario table and retain it in accessible details.
- [ ] **Step 4: Run both test files** and confirm PASS.

### Task 6: Graphique européen signature

**Files:**
- Modify: `site/src/europe-comparaison.ts`
- Modify: `site/src/europe-comparaison.test.ts`

**Interfaces:**
- Consumes: `nuageComparatif`, `tableauAccessible`.
- Produces: scatter plot taxes on x, expenditure on y, equilibrium diagonal and direct country labels.

- [ ] **Step 1: Write failing tests** for both axes, the equilibrium line, direct France label and accessible data table.
- [ ] **Step 2: Run the test file** and confirm FAIL.
- [ ] **Step 3: Replace the visible European table** with the scatter plot and compact ranked debt row.
- [ ] **Step 4: Run the test file** and confirm PASS.

### Task 7: Verification and production

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run `npm test`** and require zero failures.
- [ ] **Step 2: Run `npm run build`** and require exit code 0.
- [ ] **Step 3: Inspect `/bilan/`** at desktop width and 390 px, checking labels, exact values, focus and horizontal overflow.
- [ ] **Step 4: Commit and push** only the implementation and plan, preserving user-owned untracked files.
- [ ] **Step 5: Wait for deployment** and repeat the browser checks on `https://500signatures.fr/bilan/`.
