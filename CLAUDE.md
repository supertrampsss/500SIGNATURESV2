# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Règles spécifiques au projet

- Documentation et livrables en **français** ; code, identifiants SQL et commits en anglais.
- Aucune donnée chiffrée publiée sans source, millésime, unité et dénominateur.
- Ne jamais confondre : budget voté / crédits ouverts / engagements (AE) / paiements (CP) /
  exécution ; comptabilité budgétaire / générale / nationale ; impôt / taxe / cotisation /
  contribution / redevance / dépense fiscale.
- Aucune comparaison territoriale ou internationale sans contrôle de définition,
  périmètre, période et unité.
- Pipelines déterministes et testés ; pas de scraping quand une API ou un
  téléchargement officiel existe.
- Design du site : installer le skill `npx skills add https://github.com/Leonxlnx/taste-skill`
  avant tout travail d'interface.

## Règles d'affichage, tenues sans qu'on ait à les redemander

Ces règles ont dû être répétées d'une session à l'autre. Elles sont écrites ici
pour ne plus l'être.

- **Tous les montants en millions d'euros (M€)**, deux décimales sous le
  million. Jamais de k€ ni de Md€ : une colonne qui change d'unité d'une ligne
  à l'autre ne se compare pas. Le **par-habitant ne s'affiche que dans les
  tableaux dépliés**, jamais dans un résumé, une ouverture ou une carte.
- **Dire l'unité là où le nombre est gros.** « Santé 1 643 M€ » se lit
  « 1 643 milliards » par qui n'a pas le nez sur le sigle ; toute page qui
  aligne des montants d'État écrit « montants en millions d'euros » dans son
  cadrage.
- **Un taux varie en points**, jamais en pourcentage — y compris les taux que
  la source publie pour mille et que l'écran montre en pourcentage.
- **La fenêtre est 2019 et 2025, à toutes les mailles.** Elle se lit sur les
  exercices publiés, **jamais sur un calendrier électoral**. Le brancher sur
  l'élection de la maille — municipales 2020, départementales et régionales
  2021 — faisait partir la Gironde de 2020 quand Bordeaux partait de 2019 :
  deux territoires qu'on vient précisément comparer, sur deux périodes
  différentes. Une élection ne borne pas un exercice comptable. Deux tests de
  `fiche.test.ts` verrouillent la règle.
- **Aucune ligne de fenêtre de mandat.** « mandat 2020-2026, mesuré depuis
  l'exercice 2019 » posait deux dates qu'aucune phrase ne porte : la fenêtre est
  dans les millésimes des phrases, 2019 et 2025.
- **Aucune réserve qui s'excuse.** Ce qui change la lecture d'un chiffre reste ;
  ce qui dit ce que le site ne sait pas faire part. Et une prudence qui
  n'apprend rien — « une année d'investissement ne résume pas le mandat » —
  n'est pas une réserve, c'est du remplissage.
- **La même fiche à toutes les mailles.** Ce que porte la vue commune, la vue
  département, région et pays le portent aussi.
- **Toute page qui montre un territoire doit permettre d'en changer**, avec le
  champ de recherche du site, pas un autre.
- **Un tableau d'analyse montre tous les exercices publiés, un par colonne.**
  Une valeur unique ne s'analyse pas.
- **Les recherches sont permissives** : mot à mot, sans exiger la contiguïté, et
  la liste ne tronque pas au point de cacher la moitié des réponses.

## Reste à faire, par ordre de gravité

1. **Simulateur — comptes spéciaux, budgets annexes et ODAC.** Ce qui reste
   hors du budget général de l'État et hors des trois échelons publiés.
2. **Provenance au niveau France.** `provenance.ts` attribue la variation d'un
   agrégat à ses composantes partout où la source déclare une hiérarchie. Aucun
   des 147 indicateurs nationaux n'en déclare : il n'y a rien à décomposer, et
   le module se tait. Déclarer la hiérarchie des agrégats nationaux dans le
   pipeline — les missions du budget général sous les dépenses nettes, à
   condition de vérifier que la somme redonne le total — l'ouvrirait à la
   France.
3. **Condenser les longues listes.** Le pli « L'essentiel / Tout voir » les
   range, il ne les condense pas : 187 lignes restent 187 lignes derrière le
   second onglet. Visé : une question, une phrase, trois chiffres, le tableau
   complet derrière.

### Fait

- **Simulateur — collectivités locales** (10 août 2026). Un budget par échelon,
  jamais leur somme : communes, départements, régions, et aucune entrée qui les
  résume. L'arbre n'est pas celui que l'OFGL déclare mais celui que les montants
  vérifient — un nœud n'ouvre ses composantes que si elles lui redonnent son
  total, ce qui referme « Dépenses d'intervention » (composantes partielles) et
  écarte « hors remb » sur preuve d'identité, pas sur son nom. Couverture écrite
  dans le fichier : 97 départements sur 103, 17 régions sur 18.
- **La France dit quelque chose** (10 août 2026). La fenêtre des comptes finissait
  sur 2026, que dix séries sur cent quatre-vingt-dix atteignent : chaque règle
  lisait `null` à l'arrivée. Fenêtre corrigée, plus six règles nationales et un
  mode « en points » — un taux publié en pourcentage varie en points.
- **D'où vient la hausse** (10 août 2026). `provenance.ts` attribue la variation
  d'un agrégat à ses composantes, à condition qu'elles somment au total **aux
  deux exercices**. 13 lignes à Bordeaux, 14 en Gironde, 14 en Nouvelle-Aquitaine.
- **Simulateur — la Sécurité sociale** (9 août 2026). Connecteur `plfss.py` :
  annexes 3 et 5 du PLFSS 2026, charges et produits nets des régimes de base
  consolidés poste par poste (676 925 / 659 465 M€, résultat −17 461 M€) et
  l'ONDAM avec ses six sous-objectifs (270,4 Md€). L'ONDAM a son propre panneau
  et son propre écart : le régler ne déplace pas le solde. Vérifié sur le
  fichier R2.
- **Simulateur — récapitulatif en comptabilité nationale** (9 août 2026). Une
  entrée du sélecteur qui ne se règle pas : elle dit d'abord que les budgets ne
  s'additionnent pas, puis montre le seul cadre qui les somme —
  `insee_apu_solde` et ses trois sous-secteurs, écart nul, publié.
- **Simulateur — le barème de l'impôt sur le revenu** (9 août 2026). La
  distribution IRCOM des 41,6 millions de foyers fiscaux en vingt-cinq tranches,
  et un barème refaisable dont le rendement est **exact** — les seuils sont les
  bornes publiées, jamais un seuil interpolé.
