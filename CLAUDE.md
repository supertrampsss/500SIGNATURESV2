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
   simulateur aux comptes spéciaux, aux budgets annexes et aux ODAC.**
   L'obstacle arithmétique que cette entrée invoquait n'existe pas. Le vrai est
   ailleurs, et il est mesuré.

   **Les dépenses sont là, les recettes ne le sont pas.** Le simulateur ne lit
   pas la situation mensuelle mais le PLF (`normalize/budget_lignes.py`,
   `fin.state_budget_detail`). Deux filtres y écartent tout ce qui n'est pas
   `BG` — donc les comptes spéciaux sont **téléchargés puis jetés**, pas
   absents. Mesuré sur le jeu des dépenses 2025 (`plf25-depenses-2025-selon-destination`,
   crédits de paiement) :

   | `typebudget` | Montant | Lignes |
   |---|---|---|
   | BG — budget général | 594,04 Md€ | 2 289 |
   | CCF — comptes de concours financiers | 145,73 Md€ | 16 |
   | CAS — comptes d'affectation spéciale | 80,76 Md€ | 65 |
   | BA — budgets annexes | 2,51 Md€ | 34 |

   Total 823,04 Md€ : exactement le « 594,0 à 823,0 » que le docstring du module
   annonce. Élargir le filtre est donc une ligne, pas un connecteur.

   **Mais le jeu des recettes n'a pas de colonne de type de budget du tout.** Il
   s'appelle `plf25-recettes-du-budget-general`, porte 156 lignes et quatre
   familles — fiscales 500,35, non fiscales 20,55, PSR collectivités −44,19,
   PSR UE −23,32, soit 453,39 Md€ nets — toutes du budget général.
   `grouper_recettes` **lève** sur une famille inconnue : si des recettes de
   comptes spéciaux y étaient, le connecteur échouerait déjà.

   Élargir le seul filtre des dépenses donnerait donc un volet de **229 Md€ de
   dépenses sans rien en face**, dont le « solde » vaudrait leur opposé. C'est
   mot pour mot ce que le module refuse déjà pour l'exercice 2023 — « un budget
   amputé de sa moitié n'est pas un budget ».

   **Ce qu'il faut vraiment** : une source pour les *recettes* des comptes
   spéciaux, compte par compte — l'évaluation des voies et moyens et les états
   annexés au PLF. C'est un **nouveau connecteur**, et les ODAC en demandent un
   second, aucun ne les couvrant aujourd'hui. La décision relève de **D7** : la
   validation humaine préalable reste en vigueur pour les connecteurs et la
   méthodologie.

   Note pour qui reprend : `budget_lignes.py` calcule un `solde` (`nettes −
   total_credits_paiement`) qu'**aucun contrôle ni aucun test ne confronte au
   solde publié du PLF**. Le chiffre de tête du simulateur n'est donc vérifié
   que par ses sommes internes, jamais contre la source.
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

3. **Trois vues sans document à elles — la spec et le code ne disent pas la
   même chose.** Audit des critères d'acceptation (§23) contre le site déployé,
   le 16 août 2026. Ce qui est **tenu** : le plan du site porte exactement les
   huit adresses publiques et `robots.txt` le désigne (§20) ; aucune balise
   `noindex` (§21) ; un lien de scénario partagé produit bien son titre, son
   effort et ses gestes les plus lourds — vérifié en production sur
   `?budget=etat/TB:-10,etat/RD:-5&nom=Essai`, la fonction d'edge répond
   « Somme des écarts : +9 520 M€… Source : PLF 2025 » (§18).

   Ce qui ne l'est pas : `/territoire`, `/detail` et `/simulateur` sont servis
   par le repli SPA avec le gabarit, **qui porte l'accueil écrit**. Ils n'ont
   donc ni titre, ni description, ni canonique à eux — le §3 demande qu'on y
   accède « sans passer par la page d'accueil », le §19 que « chaque page
   publique » porte les siens.

   | Adresse | Document | Canonique |
   |---|---|---|
   | `/reperes`, `/methode`, `/analyses/`, `/analyses/<slug>` | le leur | oui |
   | `/`, `/territoire`, `/detail`, `/simulateur` | le gabarit, accueil compris | aucune |

   **Ce n'est pas un oubli**, et c'est pour ça que l'entrée existe : les trois
   refus sont argumentés au registre — contenu commandé par l'adresse pour
   `/territoire` et `/detail`, état d'atelier pour `/simulateur`, dont la
   fonction d'edge réécrit déjà titre, description et image (un document figé y
   mentirait deux fois). Il reste donc à **trancher, pas à coder** : ou ces
   trois adresses reçoivent leur document, ou les §3 et §19 disent l'exception
   qu'elles portent. Aujourd'hui la spec se lit comme tenue alors qu'elle ne
   l'est pas, ce qui est le pire des deux états.

4. **« Le site ne publie ni classement » — et `/detail` en affiche un.**
   Trouvé en lisant `/methode` déployée. La page de méthode écrit, sous les
   règles d'affichage : « Deux territoires se comparent à la même année, à la
   même unité et au même périmètre. **Le site ne publie ni score composite, ni
   classement.** » Un test la verrouille (`methode-rendu.test.ts`).

   Or `/detail` trie les territoires par valeur décroissante et n'en montre que
   les cent premiers, sous une légende qui le dit : « **100 premiers
   territoires sur 34 875** ». Et `main.ts` appelle cette table par son nom —
   « un classement tronqué se lit, un fichier tronqué se réutilise de travers ».

   **Les deux lectures se défendent, et c'est pour ça que l'entrée existe.**
   Le vocabulaire du dépôt distingue ailleurs les deux : `credits-missions.ts`
   range les missions par écart en précisant « aucun classement, aucune note ».
   Trier des valeurs publiées, en les affichant, n'est pas noter. Mais « les
   cent premiers » est la langue d'un palmarès, le lecteur qui vient de voir ce
   tableau lit ensuite qu'il n'existe pas, et aucune des deux pages ne renvoie
   à l'autre.

   Trancher relève de **D7** — c'est une affirmation de méthodologie, pas une
   tuyauterie : ou la phrase se précise (« aucun score composite, aucun
   palmarès entre territoires » et le tri assumé), ou `/detail` cesse de
   présenter ses lignes comme un rang. Ne pas réécrire l'une des deux seul.

### Fait

- **Le dénominateur des budgets locaux** (16 août 2026). Les trois volets
  s'intitulent « le budget de **tous** les départements », « de **toutes** les
  communes », « de **toutes** les régions », et agrègent 97 départements sur
  103, 34 778 communes sur 34 875, 17 régions sur 18. Le cadrage nommait la
  source, le millésime et l'unité — jamais combien de territoires il laissait
  dehors, si bien que « 97 départements » ne pouvait pas se lire comme
  incomplet. Il porte désormais le total de la maille, lu dans
  `geo.geography_reference` au même millésime que le reste de la publication.

  Le titre garde « tous » : il nomme l'échelon par opposition à la fiche d'un
  territoire, et le dénominateur est juste dessous.

  **La fonction n'était couverte par aucun test.** La semer demande les
  composantes en plus des totaux — un nœud n'ouvre ses enfants que s'ils lui
  redonnent son montant, et sans eux `simulateur_collectivites` ne publie rien
  du tout, ce qui se voit comme un `KeyError` et non comme un cadrage fautif.

- **Condenser les longues listes** (16 août 2026). Mesuré, puis traité là où la
  mesure désignait le travail. Sur les **188 séries** de la France, la charge
  n'était pas répartie : `budget_etat` en portait **81**, soit 43 % à lui seul,
  quand onze thèmes sur dix-sept tenaient déjà en moins de dix lignes. Condenser
  uniformément n'aurait donc rien donné.

  Les 81 se décomposent en **66 lignes de mission** — trente-trois missions
  fois deux colonnes, votés et consommés — et **15 autres**. C'est cette paire
  répétée qui faisait la liste : `credits-missions.ts` la rend en un tableau de
  33 rangées (Votés / Consommés / Écart), et il ne reste que 15 lignes
  ordinaires. Les autres thèmes se lisent tels quels, sans pli.

- **`/reperes` pré-rendue** (16 août 2026). Elle répondait 200 en servant le
  repli SPA : **identique au gabarit, octet pour octet**. Le refus tenait à un
  motif technique noté au registre — « les huit `afficher*` mutent un
  `HTMLElement` » — qui était **faux pour sept d'entre eux** : `rendu()` y
  existait déjà. Seul `national.ts` restait à extraire, et il n'avait aucun
  test. La page sert désormais son propre document, avec sa canonique et sa
  carte de section ; les neuf cadres sont identiques, octet pour octet, à ce que
  le client peignait.

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
