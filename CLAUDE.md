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
- **Aucune réserve qui s'excuse — et la règle vaut pour les blocs entiers.**
  « Ce que ces chiffres ne disent pas », « Pourquoi ce n'est pas suivre son
  impôt », « leur fiabilité est inégale » : six blocs de ce genre s'étaient
  installés sous les tableaux du site. Ils disent au lecteur de se méfier d'un
  chiffre sans lui donner de quoi le lire autrement. Ce qui manque à un fichier
  se dit dans la légende du tableau, avec les chiffres, jamais après eux.
  Aucune exception : « décomposition non publiée pour X » est partie comme les
  autres.
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

   **Avant d'étendre le simulateur, une identité doit se refermer, et elle ne
   se referme pas.** Mesuré sur les séries publiées (2026-08-11T0807, pays/FR,
   exercice 2025), toutes du même cadre `budgetaire` et du même jeu
   `execution-budget-etat` :

   | Identité essayée | écart 2024 | écart 2025 |
   |---|---|---|
   | recettes − dépenses | +61,4 | +63,4 |
   | recettes − dépenses + comptes spéciaux | +59,1 | +61,2 |
   | **recettes − dépenses − PSR** | **−6,3** | **−5,6** |
   | recettes − dépenses − PSR + comptes spéciaux | −8,7 | −7,9 |

   Deux enseignements. Les prélèvements sur recettes doivent bien être
   retranchés — la définition de `etat_depenses_nettes_bg` le dit, « ils sont
   comptés à part » — et sans eux l'écart est de 61 Md€. Mais **ajouter le solde
   des comptes spéciaux aggrave l'écart au lieu de le réduire**, sur les deux
   exercices : le solde budgétaire publié porte donc vraisemblablement sur le
   budget général seul, et le résidu n'est pas les comptes spéciaux.

   Les prélèvements sur recettes doivent bien être retranchés : la définition
   de `etat_depenses_nettes_bg` le dit — « les prélèvements reversés aux
   collectivités et à l'Union européenne n'y figurent pas : ils sont comptés à
   part ». Sans eux l'écart serait de 61 Md€.

   Reste environ 6 Md€, soit 4 % du déficit, sur les deux exercices. Les budgets
   annexes sont un candidat mais ne pèsent pas cet ordre.

   **Refaire cette mesure avec le soin du périmètre avant d'y croire.** L'entrée
   suivante a porté pendant un tour un écart de 1 % qui n'existait pas, parce
   qu'un terme de retranchement était pris pour un autre — la mission entière au
   lieu des seuls impôts d'État. Le résidu ci-dessus est plausible, il n'est pas
   expliqué. **Tant que cet écart n'est pas nommé, étendre
   le simulateur aux comptes spéciaux lui ferait afficher un solde que les
   comptes publiés ne confirment pas** — et l'exactitude arithmétique est toute
   la promesse de l'outil. Comme pour la provenance nationale, la décision
   relève de **D7** : la validation humaine préalable reste en vigueur pour les
   connecteurs et la méthodologie.
2. **Provenance au niveau France — déclarée, sauf les missions, et la raison
   du refus vaut d'être lue.** `provenance.ts` attribue la variation d'un
   agrégat à ses composantes partout où la source déclare une hiérarchie. Le
   catalogue national n'en déclarait aucune ; il en porte désormais cinq, et
   **24 indicateurs gagnent un parent** :

   | Agrégat | Composantes | Exercices vérifiés | Écart maximal |
   |---|---|---|---|
   | `etat_recettes_nettes_bg` | 2 | 13 (2013-2025) | 0,0001 € |
   | `insee_apu_solde` | 3 sous-secteurs | 67 (1959-2025) | 0,050 % en 1974, nul depuis 1977 |
   | `insee_dette_apu_montant` | 4 sous-secteurs | 122 trimestres | 0,014 % (arrondi source) |
   | `depense_fiscale_totale` | 9 impôts d'assiette | 3 | 0,0000 € |
   | `drees_protection_sociale_total` | 6 risques | 66 (1959-2024) | 0,0008 € |

   **Les 33 missions du budget général restent refusées**, et pas pour la raison
   que cette entrée a d'abord donnée. Deux erreurs successives ont été écrites
   ici, elles méritent d'être gardées :

   - D'abord « la somme ne redonne pas le total, 1 % d'écart ». **Faux** : on
     retranchait la *mission* « Remboursements et dégrèvements » entière, qui
     porte aussi les dégrèvements d'impôts **locaux**, au lieu des seuls
     remboursements d'impôts **d'État**. Avec le bon terme,
     `578,04 − 136,84 = 441,19` contre 441,19 publié — **0,000 %** aux deux
     exercices.
   - Puis « donc c'est déclarable ». **Faux aussi, et plus subtilement** :
     l'identité qui se referme est une **soustraction**, or un `parent` dit
     « ceci s'additionne dans cela ». **Aucune composition de missions publiées
     ne redonne le total** — les 33 le dépassent de 31 %, et la mission des
     remboursements écartée il manque encore 1 %, qui sont les dégrèvements
     locaux que « net » ne retranche pas.

   Le refus est reproductible : l'entrée reste dans la table candidate du
   pipeline avec sa mesure, et le contrôle d'identité — `TOLERANCE_ECHELON`,
   celui-là même que les collectivités subissent — la rejette à chaque
   publication.

   **Ce que le site n'en montre pas encore.** `blocs.ts` ne nomme un poste que
   s'il figure dans sa table `POSTES`, purement OFGL, et `provenanceDite` n'a
   d'autre appelant que ses tests. La déclaration est une vérité de pipeline qui
   attend son emploi côté site.

3. **Condenser les longues listes.** Le pli « L'essentiel / Tout voir » les
   range, il ne les condense pas. Visé : une question, une phrase, trois
   chiffres, le tableau complet derrière.

   Mesuré sur la France (version 2026-08-11T0807) : **188 séries publiées**, et
   la charge n'est pas répartie — un thème en porte 43 % à lui seul.

   | Thème | Lignes |
   |---|---|
   | `budget_etat` | **81** |
   | `securite` | 16 |
   | `fonctions` | 11 |
   | `depenses_fiscales`, `dette`, `europe`, `securite_sociale` | 10 chacun |
   | `equipements` | 8 |
   | les huit autres | 2 à 5 chacun |

   Conséquence pour qui reprend : condenser uniformément ne sert à rien. Onze
   thèmes sur dix-sept tiennent déjà en moins de dix lignes et n'ont pas besoin
   d'être pliés. Le travail est **`budget_etat`**, et lui seul vaut une
   structure — les autres se lisent tels quels.

### Fait

- **Les quarante-trois séries invisibles** (16 août 2026). Le site filtre son
  catalogue par `niveaux`, et 43 séries avaient une valeur publiée pour la
  France sans déclarer `pays` : le filtre les écartait de toute fiche. Ce
  n'était pas un trou de données mais **un trou de déclaration** —
  `agregats_nationaux()` somme les régions à la publication, mais ces sommes ne
  repassent jamais par `core.observations`, que `synchroniser_niveaux()` relit
  pour recaler `geo_levels`. Le catalogue déclare désormais ce que la
  publication contient, **période par période** : les périodes réellement
  sommées, jamais celles des régions. Les trois conditions d'`agregats_nationaux`
  sont intactes — l'indicateur doit être additif, **toutes** les régions doivent
  paver la France, le jeu doit être déclaré. 145 → 188 indicateurs à la maille
  pays ; sept thèmes gagnent leur première ligne nationale.

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
