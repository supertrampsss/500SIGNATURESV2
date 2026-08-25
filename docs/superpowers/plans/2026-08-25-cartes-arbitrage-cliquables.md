# Cartes d’arbitrage cliquables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire des deux cartes du dilemme les seules actions adopter/rejeter et supprimer leurs boutons dupliqués.

**Architecture:** Le rendu serveur place `data-geste` directement sur deux boutons-cartes produits par `renduOptionDecision`. Le contrôleur délégué existant continue de traiter les clics sans nouvelle logique. Les styles donnent aux boutons l’apparence des cartes actuelles et des états interactifs accessibles.

**Tech Stack:** TypeScript, HTML rendu par chaînes, CSS, Node test runner, Vite.

## Global Constraints

- Conserver les libellés éditoriaux et l’ordre gauche « adopter », droite « rejeter ».
- Utiliser des boutons natifs pour le clavier et les technologies d’assistance.
- Ne pas modifier les règles de calcul du simulateur.
- Conserver l’empilement mobile existant.

---

### Task 1: Rendre les cartes actionnables

**Files:**
- Modify: `site/src/tunnel-rendu.ts`
- Modify: `site/src/styles/tunnel-cabinet.css`
- Test: `site/src/tunnel.test.ts`

**Interfaces:**
- Consumes: le gestionnaire délégué existant qui lit `[data-geste]`.
- Produces: deux `<button type="button" data-geste>` dans `.tunnel__comparaison`.

- [ ] **Step 1: Write the failing test**

Vérifier que les deux `.tunnel-decision__option` sont des boutons portant respectivement `data-geste="adopter"` et `data-geste="rejeter"`, et que `.tunnel__actions-fixes` est absent.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test --test-name-pattern="cartes du dilemme" src/tunnel.test.ts`

Expected: FAIL, car les actions sont encore dans la rangée inférieure.

- [ ] **Step 3: Write minimal implementation**

Remplacer les sections d’option par des boutons, y placer `data-geste`, retirer `.tunnel__actions-fixes`, puis neutraliser les styles natifs et ajouter `cursor`, `hover` et `focus-visible`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test --test-name-pattern="cartes du dilemme" src/tunnel.test.ts`

Expected: PASS.

- [ ] **Step 5: Verify and publish**

Run: `npm test` puis `npm run build`. Contrôler desktop et mobile sur la page publique après déploiement, puis pousser sur `main`.

