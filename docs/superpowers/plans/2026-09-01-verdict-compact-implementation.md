# Verdict compact du simulateur Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le verdict éditorial actuel par la page de score mobile validée dans `verdict-score-v13.html`.

**Architecture:** Le calcul du score et du reste à financer appartient au view model de verdict. Le rendu ne conserve que le score, trois indicateurs, les conséquences réellement produites, les trois choix les plus importants et les actions finales. Le record personnel est persisté séparément de la sauvegarde de campagne afin qu'un redémarrage ne l'efface pas.

**Tech Stack:** TypeScript, HTML généré côté client, CSS responsive, tests Node `node:test`.

## Global Constraints

- Le verdict est l'unique bilan obligatoire.
- Le score est plafonné au déficit initial.
- Les milliards sont affichés sans décimales.
- La référence mobile est 390 px, sans débordement horizontal.
- Les libellés visibles n'emploient ni cadratin, ni `Composition du résultat`, ni `mission accomplie`, ni conseil pour la partie suivante.

---

### Task 1: Score de mandat et record personnel

**Files:**
- Modify: `site/src/simulateur-v3/verdict.ts`
- Modify: `site/src/simulateur-v3/verdict.test.ts`
- Modify: `site/src/simulateur-v3/controller.ts`
- Modify: `site/src/simulateur-v3/controller.test.ts`

**Interfaces:**
- Consumes: `CampaignState.baseline.annualBalanceMillions`, `CampaignState.indicators.annualBalance`.
- Produces: `MandateVerdictViewModel.score`, `target`, `remaining`, `surplus`, et la clé `simulateur-v3-best-score`.

- [ ] **Step 1: Write the failing tests**

Ajouter des assertions qui exigent un score plafonné à la cible, un reste jamais négatif, un excédent séparé et la conservation du meilleur score entre deux redémarrages.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm.cmd test -- verdict.test.ts controller.test.ts`
Expected: FAIL car les champs de score et le stockage du record n'existent pas.

- [ ] **Step 3: Write minimal implementation**

Calculer `target = abs(baseline)`, `score = min(target, max(0, annualBalance - baseline))`, `remaining = max(0, target - score)` et `surplus = max(0, annualBalance)`. Lire puis mettre à jour le meilleur score au verdict sans modifier la sauvegarde de campagne.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm.cmd test -- verdict.test.ts controller.test.ts`
Expected: PASS.

### Task 2: Rendu compact conforme à la maquette validée

**Files:**
- Modify: `site/src/simulateur-v3/render.ts`
- Modify: `site/src/simulateur-v3/render.test.ts`
- Modify: `site/src/styles/simulateur-v3.css`

**Interfaces:**
- Consumes: les champs de score de `MandateVerdictViewModel`, `signals`, `decisiveChoices`, `aftermath`.
- Produces: un écran final composé de `Résultat du mandat`, du score, de la barre, du reste, de trois indicateurs, de `Conséquences`, de `Choix décisifs`, puis des actions.

- [ ] **Step 1: Write the failing render tests**

Exiger la présence de `Résultat du mandat`, `score / cible`, `Conséquences`, `Choix décisifs`, `Recommencer` et l'absence de la trajectoire, du résumé automatique, de `Le verdict du pays`, de `État du mandat`, de `Cinq ans de décisions` et de `Composition du résultat`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- render.test.ts`
Expected: FAIL sur l'ancien verdict éditorial.

- [ ] **Step 3: Implement the validated markup and CSS**

Remplacer les sections de trajectoire et de récit par la grille compacte de la maquette v13. Conserver au plus trois indicateurs, trois conséquences et trois choix. Afficher les boutons `Recommencer`, `Défier un proche` et le lien vers France sans texte d'aide.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- render.test.ts`
Expected: PASS.

### Task 3: Recette complète et publication

**Files:**
- Verify: `site/src/simulateur-v3/*.test.ts`
- Verify: `site/src/styles/simulateur-v3.css`

**Interfaces:**
- Consumes: verdict compact terminé.
- Produces: build de production et rendu vérifié à 390, 768 et 1280 px.

- [ ] **Step 1: Run all tests**

Run: `npm.cmd test`
Expected: 0 échec.

- [ ] **Step 2: Run production build**

Run: `npm.cmd run build`
Expected: exit code 0.

- [ ] **Step 3: Inspect the actual verdict visually**

Contrôler le rendu, les retours à la ligne, les boutons et l'absence de débordement à 390, 768 et 1280 px.

- [ ] **Step 4: Publish and verify production**

Committer, pousser `main`, attendre le workflow Cloudflare, puis contrôler `https://500signatures.fr/simulateur?version=3`.
