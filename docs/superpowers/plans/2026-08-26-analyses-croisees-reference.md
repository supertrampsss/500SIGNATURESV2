# Analyses croisées France et Territoires Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer les séries déjà publiées en constats vérifiables intégrés au bilan France et aux fiches Territoires.

**Architecture:** Un noyau pur porte le contrat et les calculs défensifs. Deux générateurs, France et Territoires, choisissent des constats propres à leur maille. Un rendu partagé peint les cartes et conserve les identifiants de preuve pour les sources et le pré-rendu.

**Tech Stack:** TypeScript 5.9, HTML pré-rendu et SPA Vite, CSS natif, tests `node:test`.

## Global Constraints

- Aucun nombre inventé ni copié hors des séries publiées.
- Aucun nouveau `fetch` dans les générateurs ou le rendu.
- Une donnée incompatible ou absente supprime l'insight, jamais la page.
- Une corrélation ne devient jamais une causalité dans la copie.
- Mobile 390 px sans débordement horizontal.
- Le rendu pré-rendu et le rendu navigateur utilisent les mêmes fonctions pures.

---

### Task 1: Contrat et calculs défensifs

**Files:**
- Create: `site/src/insights.ts`
- Create: `site/src/insights.test.ts`

**Interfaces:**
- Produces: `Insight`, `PreuveInsight`, `derniere`, `commune`, `variation`, `ecartRelatif`.

- [ ] Écrire les tests qui exigent une période commune et refusent zéro, absence et changement de signe.
- [ ] Exécuter `node --experimental-strip-types --test src/insights.test.ts` et constater l'échec d'import.
- [ ] Implémenter le contrat et le minimum de calculs nécessaires.
- [ ] Rejouer le test ciblé jusqu'à zéro échec.

### Task 2: Insights France

**Files:**
- Create: `site/src/insights-france.ts`
- Create: `site/src/insights-france.test.ts`

**Interfaces:**
- Consumes: `Insight` et les calculs de `insights.ts`.
- Produces: `insightsFrance(france, catalogue): Insight[]`.

- [ ] Écrire des fixtures réelles minimales pour dépenses fiscales, voté/exécuté, retraites, entreprises et redistribution.
- [ ] Écrire un test positif par famille et un test qui refuse une période incompatible.
- [ ] Exécuter le test ciblé et vérifier que l'import absent le fait échouer.
- [ ] Implémenter les générateurs sans règle de repli inventée.
- [ ] Vérifier l'ordre, l'unicité des familles et la limite de six cartes.

### Task 3: Insights Territoires

**Files:**
- Create: `site/src/insights-territoire.ts`
- Create: `site/src/insights-territoire.test.ts`

**Interfaces:**
- Consumes: `Territoire`, `Indicateur`, `Insight`.
- Produces: `insightsTerritoire(territoire, catalogue): Insight[]`.

- [ ] Écrire des fixtures couvrant fiscalité/revenu, emploi, logement, sécurité, énergie et équipements.
- [ ] Tester la diversité des familles, l'historique minimal et l'absence de causalité.
- [ ] Exécuter le test ciblé et constater l'échec attendu.
- [ ] Implémenter les candidats puis le sélecteur récence/profondeur/diversité.
- [ ] Vérifier la limite de cinq cartes et les absences silencieuses.

### Task 4: Rendu partagé et accessibilité

**Files:**
- Create: `site/src/insights-rendu.ts`
- Create: `site/src/insights-rendu.test.ts`
- Modify: `site/src/style.css`

**Interfaces:**
- Consumes: `Insight[]`.
- Produces: `rendreInsights(titre, introduction, insights): string`.

- [ ] Écrire les tests d'échappement, de preuves visibles et de section vide.
- [ ] Exécuter le test ciblé et constater l'échec attendu.
- [ ] Implémenter le HTML sémantique.
- [ ] Ajouter les styles desktop et mobile sans dépendre du survol.
- [ ] Vérifier que les tests du rendu passent.

### Task 5: Intégration France et pré-rendu

**Files:**
- Modify: `site/index.html`
- Modify: `site/src/main.ts`
- Modify: `site/scripts/prerendre.ts`
- Modify: `site/src/national.test.ts`
- Modify: `site/scripts/prerendre.test.ts`

**Interfaces:**
- Consumes: `insightsFrance`, `rendreInsights`.

- [ ] Écrire les tests qui exigent le nouveau conteneur et son HTML sans JavaScript.
- [ ] Exécuter les tests ciblés et constater les échecs attendus.
- [ ] Brancher le navigateur et le pré-rendu sur la même fonction.
- [ ] Vérifier que le bilan sans insight ne contient aucun cadre vide.
- [ ] Rejouer les tests ciblés.

### Task 6: Intégration Territoires

**Files:**
- Modify: `site/src/fiche.ts`
- Modify: `site/src/fiche.test.ts`

**Interfaces:**
- Consumes: `insightsTerritoire`, `rendreInsights`.

- [ ] Écrire les tests de position après l'évolution et avant les classements.
- [ ] Exécuter les tests ciblés et constater l'absence du bloc.
- [ ] Brancher les insights dans `afficherFiche`.
- [ ] Vérifier qu'une fiche pauvre en données ne rend aucun cadre vide.
- [ ] Rejouer les tests ciblés.

### Task 7: Vérification fonctionnelle et visuelle

**Files:**
- Modify: `docs/verification/2026-08-26-analyses-croisees/verification-report.md`
- Create: captures desktop et mobile dans le même répertoire.

**Interfaces:**
- Consumes: application construite.
- Produces: preuve reproductible de conformité.

- [ ] Exécuter `npm test` et relever le total exact.
- [ ] Exécuter `npm run build` et vérifier le code de sortie zéro.
- [ ] Servir `site/dist` et capturer `/bilan` à 1440×900 et 390×844.
- [ ] Capturer une fiche Paris à 1440×900 et 390×844.
- [ ] Inspecter largeur, densité, ordre de lecture et débordements ; corriger tout défaut via un nouveau cycle TDD.
- [ ] Documenter commandes, résultats et captures.
