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

   **L'identité du solde se referme, à zéro euro.** Deux tours de cette entrée
   ont soutenu le contraire, et c'était une faute de mesure, pas une faute des
   comptes. Vérifié sur la source elle-même (API Explore de la situation
   mensuelle budgétaire, colonne du 31 décembre), avec les six termes que
   `smb.IDENTITE` déclare :

   `recettes nettes BG − dépenses nettes BG − PSR + comptes spéciaux + budgets
   annexes + fonds de concours = solde budgétaire`

   | Exercice | recalculé | publié | écart |
   |---|---|---|---|
   | 2024 | −155 929 972 365,41 | −155 929 972 365,41 | **0,00 €** |
   | 2025 | −124 205 673 501,55 | −124 205 673 501,55 | **0,00 €** |

   **Ce que la mesure précédente avait raté.** Elle était faite sur les *séries
   publiées*, qui ne portent que 15 des 26 lignes de la source : les deux termes
   manquants ne sont déclarés par aucun indicateur (`indicateur=None` dans
   `_LIGNES`).

   | Terme absent des séries | 2024 | 2025 |
   |---|---|---|
   | Fonds de concours et attribution de produits | +8,31 Md€ | +7,35 Md€ |
   | Solde des budgets annexes | +0,37 Md€ | +0,54 Md€ |

   Ils expliquent le résidu à eux deux : −2,35 + 0,37 + 8,31 = +6,33 en 2024,
   et +5,64 en 2025 — exactement ce qui manquait. Le solde des comptes spéciaux
   était juste, et correctement signé ; l'ajouter « aggravait l'écart » pour la
   seule raison que les deux termes plus gros n'étaient pas là. Les fonds de
   concours ne sont pas une trouvaille : le docstring de `smb.py` les nomme
   depuis toujours — « l'identité du solde ajoute les fonds de concours dans
   l'exécution, mais pas dans les textes votés […] près de 7 Md€ ».

   **Et rien n'obligeait à mesurer quoi que ce soit** : `normalize/etat.py`
   contrôle cette identité à l'ingestion et `raise ValueError` au-delà de
   `TOLERANCE_EUR`. Un exercice dont le solde ne se déduit pas de ses
   composantes n'est pas publié. La question « l'identité se referme-t-elle »
   avait sa réponse dans le code qui refuse le contraire.

   C'est la quatrième fois de suite dans ce fichier que **l'instrument est faux
   et le code est juste** — après `unicode_escape` sur de l'UTF-8 déjà décodé,
   un 200 lu comme une preuve alors que le repli SPA servait le gabarit, et la
   mission entière prise pour les seuls impôts d'État. Avant d'écrire ici qu'un
   chiffre du dépôt ne tient pas, chercher le contrôle qui l'aurait déjà refusé.

   **Les deux termes manquants sont publiés** (16 août 2026) :
   `etat_fonds_de_concours` et `etat_solde_budgets_annexes`. Les lignes étaient
   déjà lues, seul l'identifiant manquait. Un test refait l'identité **sur les
   seules séries publiées** et la referme à l'euro — sept indicateurs et non
   six, le total des prélèvements sur recettes n'étant porté par aucune série :
   ce sont ses deux composantes qui le remplacent.

   Ce qui reste est donc le sujet d'origine, et lui seul : **étendre le
   simulateur aux comptes spéciaux, aux budgets annexes et aux ODAC.** Le solde
   se referme maintenant sur des séries publiées, donc l'obstacle arithmétique
   est levé. Comme pour la provenance nationale, la décision relève de **D7** :
   la validation humaine préalable reste en vigueur pour les connecteurs et la
   méthodologie.
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

   **Ce que le site en montre, et ce qu'il n'en montre pas.** `blocs.ts` nomme
   désormais les deux familles de recettes du budget général — « les impôts que
   l'État perçoit », « ce que l'État encaisse sans lever l'impôt » — et la
   provenance se dit à la maille France comme elle se dit pour une commune.

   **Vingt-deux des vingt-quatre composantes restent muettes**, et c'est voulu :
   `COMPTES.pays` ne lit que les dépenses et les recettes nettes du budget
   général. Le solde public, la dette par sous-secteur, les neuf impôts
   d'assiette et les six risques appartiennent à des agrégats qu'aucun bloc ne
   demande — les nommer aurait produit vingt-deux phrases qu'aucune page ne peut
   montrer. Les faire parler demande de nouveaux blocs à la maille pays, et pose
   la question de croiser comptabilité budgétaire et comptabilité nationale sur
   une même fiche : c'est une décision de produit, pas une tuyauterie.

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
