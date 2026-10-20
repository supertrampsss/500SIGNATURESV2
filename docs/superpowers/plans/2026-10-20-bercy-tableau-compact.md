# Tableau graphique Bercy compact — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Remplacer le flux et son tableau redondant par la maquette 3 approuvée : un tableau graphique des 19 ministères, sans signes ≈, avec l’intitulé « Ponctionné pour financer les retraites ».

**Architecture:** Le composant partagé `budget-comparison.ts` produit une seule table sémantique avec trois montants et trois petites barres par ligne. Les barres partagent le même maximum et la même largeur de piste. France et Salaires rendent directement ce composant ; le dossier utilise le type existant `budget_comparison`. Les sources monétaires et la compatibilité du type historique `budget_flow` sont conservées.

**Tech Stack:** TypeScript, CSS, Vite, tests Node, Playwright Chromium/WebKit.

## Global Constraints

- Charte : Spectral / Source Sans 3, marine #092d58, rouge #c52438, papier #fffefa.
- Libellés validés : Budget affiché / Ponctionné pour financer les retraites / Budget restant ; Md€ visibles.
- Une table, 19 ministères, aucune deuxième figure ni légende explicative de flux.
- Montants exacts conservés, reste calculé avant arrondi ; une donnée inconnue reste inconnue ; zéro ne reçoit aucun remplissage rouge.
- Les estimations restent identifiées dans les données, l’accessibilité et les sources, sans signe ≈ dans la table.
- Mobile : aucune carte par ministère ni répétition des trois intitulés à chaque ligne ; table lisible sans défilement horizontal. Sous 400 px de conteneur, nom complet au-dessus des trois montants pour conserver l’intitulé complet sans le casser en milieu de mot.
- Aucun changement du jeu, des données nationales ni du suivi publicitaire.

## Task 1 — Composant partagé

- [x] Adapter `site/src/budget-comparison.test.ts` : trois colonnes graphiques, libellés validés, absence de signes/legend, inconnues et vrais zéros.
- [x] Faire échouer les tests sur l’ancien rendu, puis modifier `budget-comparison.ts`.
- [x] Refaire `styles/budget-comparison.css` : colonne rouge, barres intégrées, lignes compactes ; factoriser les polices fixes dans `styles/budget-fonts.css` sans modifier les glyphes.

## Task 2 — Intégration et contrôles

- [x] Retirer le flux et le titre « Les 19 ministères » dans `reclassement-bercy.ts` ; raccourcir l’introduction et renvoyer aux sources.
- [x] Passer `site/analyses/financement-retraites-publiques.json` à `budget_comparison` ; conserver les preuves et compléter sa mise à jour.
- [x] Adapter `reclassement-bercy.test.ts`, `retraites-editorial.test.ts`, `tests/retraites-public.test.mjs` : une table seule, 19 montants réconciliés, zéro flux/≈, sources présentes, hauteurs et débordement sur cinq configurations.
- [x] Exécuter `npm run check`, contrôle des 14 dossiers, 15 parcours navigateur ; inspecter les captures réelles à 320, 390 et 1 280 px, dont WebKit.

## Task 3 — Livraison

- [x] Ajouter la référence approuvée, les captures avant/après et une note de validation.
- [ ] Revoir le diff, créer/pousser une PR, attendre les contrôles existants et fusionner sans nouvelle confirmation conformément à AGENTS.md.
- [ ] Vérifier le déploiement de son SHA puis les trois routes publiques, les valeurs et le rendu réel avant d’annoncer la publication.
