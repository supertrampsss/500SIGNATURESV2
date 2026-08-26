# Cent arbitrages en défilement continu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publier 100 analyses France vérifiables, regroupées par thème et toutes visibles en défilement continu.

**Architecture:** Les douze analyses composées restent dans le moteur France. Un catalogue déclaratif fournit 64 trajectoires et 24 écarts voté/exécuté à un générateur pur ; le rendu partagé regroupe ensuite les 100 cartes par famille et crée des ancres thématiques.

**Tech Stack:** TypeScript 5.9, HTML pré-rendu et SPA Vite, CSS natif, `node:test`.

## Global Constraints

- Exactement 100 cartes avec la publication du 22 août 2026.
- Aucun nombre écrit en dur dans le rendu final.
- Deux preuves et une réserve par carte.
- Toutes les cartes visibles ; aucun « voir plus ».
- Huit thèmes et navigation par ancres.
- Mobile 390 px sans débordement.

---

### Task 1: Catalogue et générateurs génériques

**Files:**
- Create: `site/src/insights-france-catalogue.ts`
- Create: `site/src/insights-france-generiques.ts`
- Create: `site/src/insights-france-generiques.test.ts`
- Modify: `site/src/insights-france.ts`

**Interfaces:**
- Produces: `RECETTES_TENDANCES`, `RECETTES_MISSIONS`, `insightsFranceGeneriques(series, catalogue): Insight[]`.
- Consumes: `Territoire.series`, `Indicateur[]`, `Insight`.

- [ ] Écrire un test exigeant 64 recettes de tendance, 24 recettes de mission et 88 identifiants uniques.
- [ ] Exécuter le test ciblé et constater l'échec d'import.
- [ ] Déclarer les 88 recettes avec famille, angle et réserve.
- [ ] Écrire un test de calcul sur variation relative, variation en points, signe traversé et période commune.
- [ ] Implémenter les deux générateurs purs et rejouer le test.
- [ ] Brancher les 88 résultats après les 12 analyses composées et exiger 100 identifiants uniques sur la fixture complète.

### Task 2: Rendu thématique en doom scrolling

**Files:**
- Modify: `site/src/insights-rendu.ts`
- Modify: `site/src/insights-rendu.test.ts`
- Modify: `site/src/style.css`

**Interfaces:**
- Consumes: `Insight[]`.
- Produces: huit sections `insights__theme` et un `nav.insights__sommaire`.

- [ ] Écrire un test qui exige le sommaire, les ancres, les compteurs et toutes les cartes.
- [ ] Exécuter le test et constater l'absence du regroupement.
- [ ] Implémenter le regroupement stable sans masquer de carte.
- [ ] Ajouter les styles desktop et mobile ; conserver une colonne à 390 px.
- [ ] Rejouer les tests ciblés.

### Task 3: Vérification et publication

**Files:**
- Verify only: `site/dist/`, GitHub Actions, Cloudflare Pages.

**Interfaces:**
- Consumes: build final.
- Produces: production vérifiée.

- [ ] Exécuter `npm test` et vérifier zéro échec.
- [ ] Exécuter `npm run build` et vérifier zéro échec.
- [ ] Contrôler localement 100 cartes, huit thèmes et aucune largeur excédentaire à 1280 et 390 px.
- [ ] Committer et pousser `main` sans toucher `.superpowers/brainstorm/`.
- [ ] Attendre la CI et le déploiement, puis recompter les cartes sur `/bilan/` en production.

