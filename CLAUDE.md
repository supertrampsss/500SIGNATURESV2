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

1. **Simulateur — la Sécurité sociale.** Le budget général de l'État ne pèse que
   594 Md€ sur ~1 670 Md€ de dépense publique. Chargé aujourd'hui : les
   prestations DREES (932 548 M€, six risques) et les soldes Eurostat en % du
   PIB. Manque le PLFSS ligne à ligne (ONDAM et sous-objectifs, recettes par
   nature) — connecteur à écrire.
2. **Simulateur — collectivités locales** (données OFGL déjà chargées), puis
   comptes spéciaux, budgets annexes et ODAC.
3. **Simulateur — récapitulatif en comptabilité nationale.** État, Sécu et
   collectivités **ne s'additionnent pas** : cadres comptables différents et
   transferts croisés massifs (TVA affectée, compensations d'exonérations). Le
   seul endroit qui a le droit de sommer les trois est un récapitulatif en
   comptabilité nationale, où `insee_apu_solde` (−169,1 Md€) fait foi.
