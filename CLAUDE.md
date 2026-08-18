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

- **Un montant se lit sans conversion de tête, et son unité s'écrit en toutes
  lettres.** « 3 536 100 M€ » n'est pas un chiffre lisible : sept rangs et un
  sigle de deux lettres, et il faut être du métier pour savoir qu'on lit trois
  mille cinq cents milliards de dette. La règle « tout en M€ » était juste pour
  une commune et fausse pour l'État — elle demandait au lecteur de diviser.

  `montantLisible` (echelle.ts) choisit donc l'échelle sur le montant —
  millions en dessous du millier de millions, milliards au-delà —, garde
  **deux décimales** et écrit **« millions d'euros » / « milliards d'euros »**,
  jamais un sigle. Un tableau, où l'unité ne peut pas se répéter dans chaque
  cellule, prend **une seule échelle pour tout le tableau**, choisie sur son
  plus gros montant et nommée dans la légende.

  Le **par-habitant ne s'affiche que dans les tableaux dépliés**, jamais dans
  un résumé, une ouverture ou une carte.
- **Dire l'unité là où le nombre est gros.** « Santé 1 643 M€ » se lit
  « 1 643 milliards » par qui n'a pas le nez sur le sigle ; toute page qui
  aligne des montants d'État écrit « montants en millions d'euros » dans son
  cadrage.
- **Un taux varie en points**, jamais en pourcentage — y compris les taux que
  la source publie pour mille et que l'écran montre en pourcentage.
- **Une colonne comparée garde sa décimale.** `Intl` la laisse tomber sur un
  compte rond, et une colonne qu'on lit de haut en bas cesse alors de
  s'aligner : « +224 % » entre « +239,7 % » et « +221,1 % », « 21 % » à côté de
  « 20,9 % », « 1 % » sous « 23,7 % », un taux de foncier bâti qui se lit
  « 40,8 % | 42 % | 43 % » d'un exercice à l'autre. **Cinq formateurs** en
  souffraient — `echelle.ts/pourcentage`, `exercices.ts/POURCENT`,
  `reperes.ts/signe`, `evolution-carte.ts/formaterVariation`,
  `analyses.ts/valeurLisible` — et aucun test ne les voyait.

  La règle ne vaut que pour ce qui **se compare ligne à ligne** : une colonne,
  une série lue d'un exercice à l'autre, les repères d'ouverture qu'on lit
  ensemble. Hors de là, le compact reste juste et voulu — une étiquette de
  carte s'écrit « +12 % », une variation arrondie à zéro « 0 % » sans signe, un
  entier n'a pas de décimale (34 875 écoles), et « Votre plan » ne pad pas le
  réglage choisi par le lecteur. D'où l'option `decimaleFixe`, jamais un
  minimum global.
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
- **Une mesure se montre avant de s'écrire.** Un tableau de chiffres demande au
  lecteur de diviser ; une figure le lui épargne. « 24,09 » posé au-dessus de
  « 2,70 » ne dit pas *neuf fois*. La direction, arrêtée le 18 août 2026 après
  dix maquettes puis cinq, vaut pour **tout le site** :

  - **La forme se choisit sur le métier de la donnée, avant la couleur.**
    Comparer des magnitudes → barres horizontales alignées à gauche. Une part
    d'un tout qui **dépasse** son tout → barres empilées et un repère, parce
    qu'un disque est fermé à cent par construction et ne peut pas montrer un
    déficit. Plusieurs mesures d'unités différentes dans le temps → indice base
    100 sur le premier exercice. Un avant/après par tranche → haltères. Jamais
    un camembert pour comparer des tailles : l'œil compare des longueurs, pas
    des angles.
  - **La figure ne remplace pas le tableau, elle le précède.** La figure montre
    des proportions ; le tableau donne les chiffres exacts, la légende et la
    source. Les deux, dans cet ordre.
  - **Une magnitude ne prend qu'une teinte.** La longueur porte déjà la mesure,
    et plusieurs couleurs feraient croire à une seconde dimension. La couleur
    catégorielle est réservée à ce qui est vraiment une **identité** — un poste,
    un sous-secteur, une famille de recettes — jamais à un rang ni à une valeur.
  - **Une teinte de série se mesure**, elle ne se choisit pas à l'œil. Les rangs
    viennent d'une gamme passée au validateur de palette catégorielle sur les
    **deux** fonds : bande de luminosité, chroma, ΔE en protanopie, ΔE en vision
    normale, contraste. Un ton inventé au coup par coup casse la séparation des
    autres — la validation est une propriété de la gamme entière.
  - **La règle éditoriale ne bouge pas.** « Aucune couleur de jugement »
    interdit le rouge qui juge un chiffre, pas la teinte qui distingue une
    catégorie.
  - **En HTML, pas en SVG étiré.** Un repère dont la hauteur est une fraction de
    la LARGEUR n'a pas de taille propre : à 1 000 px de large, une rangée de 34
    unités fait 340 px de haut. En HTML la longueur reste un pourcentage exact
    et le texte garde les jetons de la charte.
  - **Une échelle part de zéro.** Tronquée au minimum, elle ferait lire « deux
    fois » là où le rapport est de un à neuf.
  - **Une direction visuelle se montre, elle ne se décrit pas.** Les maquettes
    passent avant le code : deux fois de suite, c'est de les montrer qui a évité
    de livrer la mauvaise.

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
   L'obstacle arithmétique que cette entrée invoquait n'existe pas — et
   l'obstacle de source qu'elle a invoqué ensuite non plus. Ce qui reste tient
   en trois jeux à charger et une question de méthode, tous deux mesurés
   ci-dessous.

   **Les dépenses sont là, et les recettes aussi.** Le simulateur ne lit
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

   Ce jeu-là, donc, ne les porte pas. Le tour précédent en a conclu qu'élargir
   le filtre des dépenses donnerait « **229 Md€ de dépenses sans rien en
   face** », et qu'il fallait « une source pour les recettes des comptes
   spéciaux, compte par compte — l'évaluation des voies et moyens et les états
   annexés au PLF », c'est-à-dire **un nouveau connecteur**.

   **C'est faux, et le portail publie ces recettes.** Le catalogue de
   data.economie.gouv.fr porte, pour chacun des deux exercices que le connecteur
   charge déjà, le pendant exact du jeu des dépenses :

   | Exercice | Recettes CAS et CCF | Recettes des budgets annexes |
   |---|---|---|
   | 2024 | `plf-2024-recettes-des-cas-et-ccf` (89 lignes) | `plf-2024-recettes-des-budgets-annexes` (18) |
   | 2025 | `plf25-recettes-des-cas-et-des-ccf` (86 lignes) | `plf25-recettes-des-budgets-annexes` (18) |

   Même producteur, même API Explore, même granularité que les dépenses : les
   lignes déclarent `libelle_mission`, `code_section`, `libelle_section` et
   `code_ligne_de_recette` — c'est-à-dire le « compte par compte » que l'entrée
   allait chercher dans des annexes non structurées.

   **Et les deux côtés se rejoignent.** Recettes du PLF face aux crédits de
   paiement, mesuré sur l'API le 17 août 2026 :

   | Exercice | Périmètre | Dépenses | Recettes | Solde |
   |---|---|---|---|---|
   | 2024 | CAS | 79,95 | 77,48 | −2,47 |
   | 2024 | CCF | 148,65 | 146,04 | −2,61 |
   | 2024 | BA | 2,41 | 2,57 | +0,16 |
   | 2024 | **ensemble** | **231,01** | **226,09** | **−4,91** |
   | 2025 | CAS | 80,76 | 79,72 | −1,05 |
   | 2025 | CCF | 145,73 | 145,50 | −0,23 |
   | 2025 | BA | 2,51 | 2,84 | +0,32 |
   | 2025 | **ensemble** | **229,01** | **228,05** | **−0,95** |

   (Md€. Un compte d'affectation spéciale est équilibré par construction — ses
   dépenses sont gagées sur ses recettes affectées —, ce que ces soldes
   montrent.)

   **Les intitulés joignent sans travail de rapprochement** : 12 missions côté
   dépenses, 12 côté recettes, **12 intitulés identiques**, aucune ligne d'un
   côté sans son pendant de l'autre. L'arbre du volet se sème donc avec la clé
   que les deux jeux emploient déjà.

   Ce qui restait vraiment à trouver était donc à trois appels d'API du jeu qui
   était déjà lu. C'est la **cinquième** fois de suite que l'instrument est
   faux — et cette fois-ci l'instrument était le raisonnement, pas une mesure :
   aucun chiffre n'était erroné, on avait conclu de l'absence d'une colonne dans
   un jeu à l'absence d'une source dans le portail, sans jamais interroger le
   catalogue.

   **Ce qui reste à décider — et c'est bien une décision, pas une tuyauterie.**
   Publier ces volets ajoute trois jeux au connecteur : **D7**, la validation
   humaine préalable vaut pour les connecteurs. Les **ODAC** restent, eux, sans
   source repérée. Et une question de méthode se pose avant le code : un volet
   « comptes spéciaux » à 229 Md€ posé à côté d'un budget général à 594 Md€
   invite à les additionner, alors que 134 des 145 Md€ des comptes de concours
   financiers sont des **avances aux collectivités territoriales** — de la
   trésorerie qui revient, pas de la dépense publique de plus.

   Note pour qui reprend : `budget_lignes.py` calcule un `solde` (`nettes −
   total_credits_paiement`) qu'**aucun contrôle ni aucun test ne confronte au
   solde publié du PLF**. Le chiffre de tête du simulateur n'est donc vérifié
   que par ses sommes internes, jamais contre la source. Et il ne peut pas
   l'être depuis ce portail : le seul jeu qui porte le tableau d'équilibre,
   `plf25-ressources-et-charges-selon-distinction-fonctionnement-et-investissement`,
   est **exporté cassé** — une unique colonne de texte, 30 rangs d'intitulés
   (« Solde général », « Charges », « Emplois »…) et **pas un seul montant**.
   Même famille de panne que les colonnes `*_lfi_2023` que le module refuse
   déjà.
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

4. **Réservé.** L'entrée qui vivait ici — « le site ne publie ni classement »
   contre un `/detail` qui en affichait un — est tranchée et passée au fait,
   le 17 août 2026. La numérotation est gardée pour que les renvois des
   entrées voisines restent justes.

6. **Réservé.** L'entrée qui vivait ici — « un volet retraites demande une
   donnée qu'aucun connecteur ne charge » — est tranchée et passée au fait, le
   17 août 2026 : la DREES publie ces séries en pièces jointes de son jeu 1393,
   et le connecteur les charge. La numérotation est gardée pour que les renvois
   des entrées voisines restent justes.

5. **Le cinquième objet partageable — et pourquoi il attend une plume, pas un
   branchement.** La spec §13 liste cinq objets partageables ; le site en offre
   quatre depuis que la fiche de territoire a le sien. Le manquant est le
   **repère**, et `carteReperes` reste donc écrite, testée, sans appelant. Deux
   des cinq natures, elles, sont mortes par décision : `carteScenario` et
   `carteComparaison` ne peuvent pas avoir d'image, l'espace des budgets
   encodés étant infini (**D-L3-b**, documentée dans `partage.ts`).

   **Les huit cadres de `/reperes` posent des questions, pas des
   affirmations** : « La Sécu est-elle en déficit ? », « Les niches fiscales,
   c'est combien ? », « Que finance la dépense publique ? ». Or `carteReperes`
   n'a pas de corps — « un graphique ne se redessine pas à cette taille sans
   devenir un trait décoratif » — et son titre porte l'image à lui seul. Une
   carte qui circule en posant la question sans peindre la réponse est le
   contraire de ce que cette nature existe pour faire.

   Écrire les huit affirmations est un travail **éditorial** : ce sont des
   énoncés au sens du §14, et c'est le contrôle déterministe et le veto de
   fusion (**D11**) qui en répondent, pas une tuyauterie de rendu.

   **Et trois des huit n'ont pas de source unique**, mesuré sur le catalogue
   publié : conjoncture (2 jeux), Europe (2), Sécu (2) — dette, fonctions,
   État, niches et « 100 € » en ont une. `SourceCarte` ne nomme qu'un intitulé
   et qu'un millésime ; en choisir un pour deux serait la faute que
   `jeu_par_niveau` vient de corriger dans le catalogue. Ces trois-là
   demanderaient donc aussi une carte qui sache dire deux sources, ou un
   découpage plus fin que le cadre.

   La fiche, elle, a été branchée parce que la mesure disait qu'elle le
   pouvait : ses trois repères partagent une source aux quatre mailles.

### Fait

- **Les défaillances, et le chiffre que la moyenne cache** (18 août 2026).
  Eurostat ne publie qu'un **indice**, toutes entreprises confondues. C'est
  insuffisant d'une façon qui trompe : l'essentiel des créations sont des
  micro-entreprises, si bien que l'agrégat mélange des fermetures d'unités sans
  salarié et des fermetures d'entreprises qui employaient.

  | Cumul 12 mois à juin 2026 | | contre la moyenne 2010-2019 |
  |---|---|---|
  | Microentreprises et taille indéterminée | 65 182 | +16,3 % |
  | Très petites entreprises | 3 494 | **+73,7 %** |
  | Petites entreprises | 1 529 | **+68,0 %** |
  | Moyennes entreprises | 532 | **+61,7 %** |
  | ETI et grandes entreprises | 66 | **+100,0 %** |
  | **Ensemble** | **70 803** | +19,3 % |

  L'agrégat affiche **+19,3 %** ; **hors micro-entreprises, la hausse est de
  71,2 %** — 5 621 défaillances contre 3 283 en moyenne sur la décennie. Le
  chiffre d'ensemble est dominé par les micro-entreprises et cache le fait.

  **Une graine, et pas un connecteur, faute d'accès.** L'API Webstat porte 81
  séries mensuelles depuis 1991 mais demande une clé enregistrée : les quatre
  schémas d'authentification essayés rendent un 401. Le portail Explore ouvert
  expose les métadonnées de ces mêmes séries avec `has_records: false`, et son
  export CSV est **vide**. Le module lit donc le Stat Info mensuel, publication
  figée : trois points — la moyenne 2010-2019, juin 2025, juin 2026 — et aucune
  série. Le jour où la clé existe, il est remplacé et la profondeur arrive.

  **Deux identités, deux contrôles.** Les tailles somment **exactement** à
  l'ensemble (65 182 + 3 494 + 1 529 + 532 + 66 = 70 803) ; les secteurs somment
  **plus bas**, et c'est la source qui le dit — « l'Ensemble comprend des unités
  dont le secteur n'est pas connu », 173 unités à juin 2026. Le contrôle refuse
  donc une somme de tailles inexacte, et une somme de secteurs qui s'écarte de
  plus d'un pour cent. Trois sabotages, trois refus.

  **Et le tiret cadratin a fait rougir la CI pour la quatrième fois**, dans un
  libellé cette fois. La leçon écrite la fois précédente — « un champ publié se
  vérifie sur la suite entière » — était juste et n'a pas suffi : je l'ai
  appliquée aux définitions et pas aux libellés. **Tout champ qui part au
  catalogue passe par la suite entière, libellé compris.**

- **« Tu mets jamais de couleur » — le validateur donne raison au lecteur**
  (18 août 2026). Reproche reçu sur les blocs « 100 € » ; vérifié avant d'être
  concédé, et la mesure est pire que le reproche.

  **Ce qui était vrai à moitié.** Le site A des graphiques — `graphique.ts`
  trace des séries temporelles multi-pays, et le bloc frère des 100 € porte un
  camembert. C'est le bloc que je venais d'écrire qui était le seul des trois
  « 100 € » à n'avoir que des lignes de tableau. Pas une consigne : un oubli.

  **Ce qui était vrai entièrement.** La gamme catégorielle du dépôt —
  `#0f1b2e, #c56a4d, #6e7d73, #b69b53, #41547a, #8b6a52, #8b93a0, #5d6d66`,
  écrite en dur dans `cent-euros.ts` — n'avait jamais été mesurée. Passée au
  validateur de palette catégorielle, elle échoue **quatre contrôles sur
  cinq** :

  | Contrôle | Résultat |
  |---|---|
  | Plancher de chroma | **sept des huit teintes lisent comme du gris** |
  | Séparation daltonisme | ΔE **5,3** (protanopie), seuil 8 |
  | Plancher vision normale | ΔE **13,3**, seuil 15 — indistinguables même avec une vue complète |
  | Contraste sur le fond | 2,58:1 et 2,97:1, seuil 3:1 |

  Ce n'était donc pas de la sobriété : c'était un camembert dont sept parts sur
  huit sont grises. La règle éditoriale « aucune couleur de jugement » n'est pas
  en cause et ne bouge pas — elle interdit le rouge qui juge un chiffre, pas la
  teinte qui distingue une catégorie.

  `--serie-1` (#2a68c4) est le premier rang d'une gamme de huit qui passe les
  cinq contrôles **sur les deux fonds avec les mêmes valeurs** : c'est pour ça
  qu'elle n'a pas de contrepartie sombre. La parité de la charte demande qu'un
  jeton soit JUSTE dans les deux thèmes, pas qu'il ait deux valeurs.

  **Et la première figure était fausse d'une façon que seul le navigateur
  montre.** Un SVG en `viewBox="0 0 100 H"` étiré à la largeur disponible : à
  1 000 px de large, une rangée de 34 unités devient **340 px de haut**, et huit
  fonctions occupaient trois écrans. Un repère où la hauteur d'une rangée est
  une fraction de la LARGEUR n'a pas de taille propre — il prend celle de son
  conteneur. Refaite en HTML : la longueur reste un pourcentage exact, la
  hauteur et le texte gardent les jetons de la charte.

  **La forme se choisit sur le métier de la donnée, avant la couleur.**
  Comparer des magnitudes se lit en barres horizontales alignées, jamais en
  parts d'un disque : l'œil compare des longueurs, pas des angles. Une seule
  teinte — la longueur porte déjà la mesure, et huit couleurs feraient croire à
  une seconde dimension. Un test refuse l'échelle tronquée, celle qui ferait
  lire « deux fois » là où le rapport est de un à neuf.

  Dix maquettes ont été montrées avant de coder, et c'est ce qui a évité de
  livrer la mauvaise. **Une direction visuelle se montre, elle ne se décrit
  pas.**

- **« Retraites, chômage, allocations » : un seul nombre pour neuf fois un
  autre** (17 août 2026). Le poste le plus lourd de la dépense publique était
  aussi le plus muet. Séparé, il dit tout autre chose que son libellé :

  | Pour 100 € encaissés en 2024 | |
  |---|---|
  | Retraites | **24,09 €** |
  | Arrêts maladie et invalidité | 3,34 € |
  | Chômage | **2,70 €** |
  | Pensions de réversion | 2,68 € |
  | Famille et enfants | 2,29 € |
  | RSA et autres minima sociaux | 1,79 € |
  | Aides au logement versées en espèces | 0,07 € |
  | Hors protection sociale (bourses, culture, santé) | 0,41 € |
  | **Ensemble du poste** | **37,37 €** |

  La retraite pèse **neuf fois** le chômage, et l'ordre des mots du libellé
  suggérait le contraire. Deux fonctions manquaient d'ailleurs au trio, et
  chacune vaut plus que le chômage : la réversion et les arrêts maladie.

  **`gov_10a_main` ne décompose pas ce poste**, il n'en porte que la transaction
  entière. La ventilation vit dans `gov_10a_exp`, qui croise transaction et
  fonction (COFOG) — même producteur, même secteur S13, même unité. Elle se
  referme : sept fonctions plus trois postes hors protection sociale font
  561 878,3 M€ contre 561 878,4 déclarés, soit 0,1 M€ d'arrondi.

  **Mais elle ne dit pas la même année, et l'écart n'est pas nul.** `D62PAY`
  (jeu principal) contre `D62` total (jeu par fonction) : identiques à l'euro
  jusqu'en 2022, puis +1 248,8 M€ en 2023 et +1 806,9 M€ en 2024 — 0,24 % et
  0,32 %. Et la ventilation s'arrête à 2024 quand le reste du bloc donne 2025.
  Le tableau porte donc **son propre exercice, son propre dénominateur et son
  propre total** : redistribuer les 37,11 € de 2025 sur des clés de 2024 aurait
  donné un tableau qui tombe juste et qui ment, dont aucune ligne n'aurait été
  un chiffre publié. Un test refuse la valeur qu'aurait produite ce raccourci.

  **Deux pièges du jeu, un test chacun.** La transaction s'y nomme **`D62` et
  non `D62PAY`** — la demander sous l'autre nom rend **zéro valeur sans lever**,
  ni erreur ni 404, juste une série vide. Et sans filtre `cofog99`, les
  quatre-vingts fonctions se rangent sous la même clé (pays, année), la dernière
  lue écrasant les autres en silence. C'est la même famille de panne muette que
  l'onglet transposé des retraites.

  **Et mon fixture arrondissait.** Il affichait « 37,10 € » là où la production
  affiche « 37,11 € » : un test vert sur un chiffre que personne ne verra. Les
  valeurs sont désormais celles réellement publiées, au dixième de million —
  c'est la faute exacte qu'un fixture de la redistribution avait déjà coûtée.

  **Un sabotage est resté en place, et c'est la deuxième leçon du jour.** Le
  script de sabotage employait `cd` dans une fonction, si bien que le shell
  changeait de répertoire et que les `cp` de restauration visaient un chemin
  disparu — le fichier est resté saboté, en silence. Les copies étaient bonnes,
  c'est leur destination qui ne l'était plus. **Un script de sabotage n'emploie
  que des chemins absolus, et ses commandes tournent en sous-shell.**

  **Et le tiret cadratin a fait rougir la CI, pour la deuxième fois.** Les sept
  libellés s'écrivaient « Prestations en espèces — vieillesse » ;
  `test_aucun_cadratin_dans_les_definitions_publiees` refuse ce signe dans un
  champ publié. Ce n'est pas le test qui manquait, c'est ma vérification :
  après avoir écrit ces libellés je n'ai relancé que `tests/test_europe.py`,
  et cette règle-là vit dans un autre fichier. **Un champ publié se vérifie sur
  la suite entière, jamais sur le fichier de test du module qu'on écrit** — un
  connecteur neuf est lu par au moins trois contrôles transverses (typographie,
  vocabulaire, déclarations) qu'aucun nom de fichier ne désigne.

- **Pour 100 € encaissés par toutes les administrations, ce qui ressort**
  (17 août 2026). Le site répondait deux fois à « où va l'argent public » — les
  100 € du budget de l'État, les 100 € de prestations sociales — et aucune des
  deux ne portait le déficit, parce qu'aucune ne met l'État, les collectivités
  et la Sécurité sociale dans le même cadre. Le troisième « 100 € » le fait,
  et le cadrage dit **avant les nombres** ce qui le sépare des deux autres :
  comptabilité nationale contre comptabilité budgétaire, un encaissement
  réparti contre une dépense répartie.

  **Les parts ne sont pas ramenées à cent, et c'est le sujet.** Elles sont
  rapportées aux **recettes**, si bien que leur somme vaut ce qui est dépensé
  pour 100 € reçus — **109,77 €** en 2025, dont **9,77 €** de déficit, à sa
  place et dans l'unité du lecteur. Les ramener à cent aurait fait disparaître
  la seule chose que ce tableau existe pour montrer.

  | Pour 100 € encaissés, 2025 | |
  |---|---|
  | Cotisations sociales | 31,94 € |
  | Impôts sur la production et la consommation | 30,12 € |
  | Impôts sur le revenu et le patrimoine | 24,97 € |
  | Retraites, chômage, allocations | 37,11 € |
  | Rémunération des agents publics | 23,69 € |
  | Soins et services remboursés | 12,26 € |
  | **Total dépensé** | **109,77 €** |

  Neuf postes nommés couvrent 98,85 % des dépenses et trois familles de
  recettes 87,03 % des recettes : les deux restes sont **écrits en ligne**,
  jamais laissés au lecteur.

  **Le cube de l'INSEE ne pouvait pas porter cette décomposition, et c'est un
  refus mesuré.** `DD_CNA_APU` publie ses deux agrégats totaux dans un état
  inutilisable — mesuré le 17 août 2026, secteur S13 consolidé :

  | Ligne | 2023 | 2024 |
  |---|---|---|
  | `OTR` (total des ressources) | 1 986 263,5 | **2 034 210,1** |
  | `OTE` (total des emplois) | 0,0 | **0,0** |

  Un total de ressources à 2 034 Md€ quand les comptes publient 1 504, et un
  total d'emplois à zéro : c'est la même famille de panne que les colonnes
  `*_lfi_2023` et que le tableau d'équilibre exporté sans montants, et le
  connecteur du solde refusait déjà ces agrégats pour cette raison.

  **Eurostat referme l'identité, lui, et à l'euro.** `gov_10a_main` donne
  `TR − TE` égal au solde que le site publie déjà depuis l'INSEE :

  | Exercice | TR − TE | `insee_apu_solde` | écart |
  |---|---|---|---|
  | 2023 | −151 920 300 000 | −151 920 300 000 | **0,00 €** |
  | 2024 | −169 118 100 000 | −169 118 100 000 | **0,00 €** |
  | 2025 | −152 511 100 000 | −152 532 000 000 | 20,9 M€, soit 0,0013 % |

  L'exercice courant est le seul à ne pas se refermer, de deux dizaines de
  millions sur mille cinq cents milliards : deux producteurs qui publient une
  première estimation à deux dates. Les quatorze séries sont publiées **en
  euros** et non en millions — la source compte en `MIO_EUR`, et sans facteur
  « 1 503 590 » se serait affiché « 1 503 590 € », une faute d'un facteur
  million sur un chiffre qui reste plausible.

- **Un bloc écrit, peint, et caché** (17 août 2026). Le pré-rendu **replie**
  tout cadre dont il ne peut pas écrire le corps, et **rien ne le rouvrait**.
  Aucun des dix peintres de bloc ne déplie le cadre qu'il remplit : un bloc
  dont les séries sont publiées **après** le dernier déploiement restait donc
  invisible à tout lecteur — écrit, testé, peint dans le DOM, et `hidden`.

  Ce n'est pas une hypothèse : c'est la séquence exacte que ces 100 € allaient
  suivre. `deploy.yml` se déclenche sur `site/**`, l'ingestion ne déclenche
  aucun déploiement, et les séries des APU arrivent par l'ingestion que la
  fusion déclenche — donc **après** le build qui replie le cadre. Le bloc
  serait parti en production invisible, jusqu'au prochain commit sur le site.

  Vérifié dans le navigateur en refaisant la séquence : build sur un miroir
  privé des 476 séries des APU (cadre `REPLIÉ` dans le document statique),
  séries rétablies, page chargée — `hidden:false`, `offsetHeight>0`, titre
  peint. Les dix peintres déplient désormais, et un test **déduit la liste des
  peintres de main.ts** plutôt que de la recopier : troisième garde de ce dépôt
  à devoir apprendre qu'une liste écrite à la main ne pousse pas.

- **Trois cadres servis dépliés et vides en production, et la liste qui ne
  pouvait pas les voir** (17 août 2026). Le document pré-rendu de `/bilan/`
  portait `bloc-redistribution` et `bloc-retraites` **bordés, ombrés et vides**
  — ce que `.bloc` dessine comme une panne — jusqu'à l'arrivée du paquet. La
  docstring d'`injecterReperes` posait pourtant déjà la règle : « un bloc dont
  la source n'est pas publiée est **replié**, jamais laissé vide ».

  **La cause est celle du mois dernier, au mot près.** Deux tests parcouraient
  les cadres du gabarit — mais depuis une liste de huit identifiants **écrite à
  la main**, et une liste écrite à la main ne pousse pas : les trois cadres
  arrivés après elle ne lui ont jamais été ajoutés, et elle est restée verte.
  C'est exactement le défaut que la garde des cadres défilants avait dû
  corriger quelques heures plus tôt, dans un autre fichier, pour la même
  raison. La liste se **déduit** désormais du gabarit — tout `<article
  id="bloc-…">` de la section nationale — et un test refuse tout cadre servi
  déplié et vide. Sabotage : un cadre neuf posé au gabarit et oublié du
  pré-rendu fait rougir la garde.

  **Et j'ai failli lire un 200 pour une preuve, une fois de plus.** J'ai
  d'abord mesuré `/reperes` — 21 017 octets, titre « Où va l'argent public »,
  aucune canonique : le repli SPA servant le gabarit, exactement le piège que
  ce fichier consigne déjà. Le document pré-rendu est à `/bilan/`, et
  `/reperes` sans barre oblique est un alias que rien ne redirige. Le
  diagnostic juste a demandé de comparer quatre adresses, pas d'en lire une.

- **« Pour 100 € cotisés, combien de pension ? » — le chiffre existait, et je
  m'étais arrêté trop tôt** (17 août 2026). L'entrée précédente concluait qu'un
  volet retraites demandait « une donnée qu'aucun connecteur ne charge », et
  j'avais répondu à l'utilisateur que je ne trouvais pas le rendement sur cycle
  de vie. **Il l'avait, et il l'a apporté** : INSEE, document de travail
  **G2015/06**, Dubois et Marino, annexe 1.

  | Génération | 1950 | 1960 | 1970 | 1985 |
  |---|---|---|---|---|
  | Récupéré pour 100 € cotisés | **158,57 €** | 132,60 | 119,24 | 117,28 |
  | Part du salaire cotisée | 23,8 % | 26,7 % | 27,4 % | 27,9 % |

  **Ce que ma recherche avait raté.** J'avais balayé les 264 jeux du portail
  DREES, les 145 de l'INSEE et les classeurs du COR déposés sur data.gouv — et
  conclu à l'absence. La donnée n'était dans aucun portail de données : elle est
  dans un **document de travail en PDF**, qu'aucun catalogue d'API ne référence.
  Septième fois que l'instrument est faux dans ce fichier, et la première où
  l'instrument était le **périmètre de la recherche** : chercher des jeux de
  données ne trouve pas une étude.

  **Ce que ma prudence avait de juste, et qu'il faut garder.** Le chiffre est une
  **projection de microsimulation** (Destinie 2), sur les seuls **salariés du
  privé**, sous la **législation de 2014** — la réforme de 2023 n'y est pas. Et
  l'étude publie elle-même son étendue : pour la génération 1950, le taux de
  récupération vaut 158,57 % tous financements, 155,45 % en bouclant sur actifs
  et retraités, 146,75 % sur les seuls retraités, 175,17 % en ne comptant que
  les cotisations hors allègements. Les indicateurs sont donc déclarés
  `estimated`, jamais `observed`, et le tableau dit « Projection, et non
  relevé » **avant** les nombres.

  **Le contrôle d'identité a fait tomber ma première graine.** L'annexe 1 porte
  un quatrième indicateur sous l'intitulé « TPR = TR × TP ». La ligne imprimée
  ne vérifie pas cette identité : pour 1950, TR × TP vaut 37,71 quand la ligne
  affiche 42,87 — et 37,71 s'y trouve **deux colonnes plus loin**, sur six
  générations d'affilée. Défaut d'alignement de la source, pas autre définition.
  Le taux de prestation n'est donc pas publié : ce dépôt ne corrige pas une
  source, il la cite ou il s'abstient. Sans ce test écrit avant la lecture, une
  ligne décalée entrait au catalogue.

  **Une graine, pas un connecteur** : une publication figée de 2015 ne se
  recharge pas, et la période est une **génération de naissance**, pas un
  exercice — `time_granularity = 'generation'`, chaque intitulé porte le mot, et
  un test refuse un libellé qui l'oublierait.

- **Les retraités enfin nommés : combien, combien, à quel âge** (17 août 2026).
  D7 accordé. Le site publiait ce que la vieillesse **coûte** — 426,7 Md€, la
  première dépense publique française — et rien de ce qu'elle est. Connecteur
  `retraites.py`, **199 observations sur 11 séries**, chargées depuis les
  classeurs de la DREES :

  | Mesure | Valeur | Exercice |
  |---|---|---|
  | Nombre de retraités | 17 889 187 | 2022 |
  | Pension mensuelle brute moyenne | 1 565 € | 2022 |
  | Pension mensuelle nette moyenne | 1 457 € | 2022 |
  | Âge conjoncturel moyen de départ | 62,7 ans | 2022 |
  | Cotisants par retraité | 1,72 | **2016** |

  Femmes 1 241 €, hommes 1 933 € : **35,8 % de moins**, et le bloc calcule
  l'écart plutôt que de le laisser au lecteur.

  **L'entrée n°6 du reste-à-faire disait « une donnée qu'aucun connecteur ne
  charge », et c'était vrai — mais pas « introuvable ».** Le portail de la DREES
  diffuse par API des jeux d'un seul millésime (les neuf « Caractéristiques des
  retraités » sont tous de 2016) ; les séries longues, elles, sont **attachées**
  au jeu 1393 sous forme de classeurs, un par édition. Lister les jeux ne
  suffisait pas : il fallait lister leurs **pièces jointes**.

  **Quatre pièges de classeur, un test chacun.** Les effectifs sont **en
  milliers** — publier 17 889 retraités au lieu de 17,9 millions donne un
  nombre plausible. Les millésimes portent des appels de note (« 2020 2 »), et
  lus tels quels ils font des périodes fantômes. L'onglet des âges est
  **transposé**, et le lire comme les autres rend zéro ligne **sans erreur**.
  Et deux blocs de colonnes disent « pension brute moyenne » dans le même
  onglet : hors majoration pour trois enfants (1 522 €) et y compris (1 565 €).

  D'où la règle du module : **aucune colonne n'est prise sur sa position
  seule**. Chaque onglet est contrôlé par une identité que ses colonnes doivent
  vérifier — femmes + hommes = ensemble, femmes < ensemble < hommes, un âge
  entre 55 et 70 ans, un rapport entre 1 et 3 — et le chargement lève plutôt
  que de publier une colonne prise pour une autre. Une édition suivante qui
  déplace ses colonnes tombe ici, pas en ligne.

  **Le rapport cotisants/retraité s'arrête en 2016** chez ce producteur. Il est
  publié avec son millésime, à côté de mesures de 2022 : une date n'est pas une
  réserve, c'est la moitié d'un chiffre.

- **Les communes semblables, promises et jamais montrées** (17 août 2026). Les
  quartiles par groupe de pairs sont publiés depuis le 5 août, la page de
  méthode décrit le groupe qu'ils définissent, l'accueil pose la question
  « Ma commune dépense-t-elle plus que les communes comparables ? » — et
  **aucun écran ne le montrait**. `comparaisons.json` était chargé par le
  navigateur pour n'alimenter qu'une poignée de diagnostic.

  Il manquait **un seul champ**. La clé du groupe se construit des drapeaux
  d'un territoire, et l'index de la maille — le seul fichier qu'une page
  d'ensemble charge — ne les portait pas. Il les porte, sous forme de
  dictionnaire et non de cinq colonnes : mesuré, cinq colonnes de 34 875
  valeurs coûtent **976 611 octets** quand les 93 combinaisons distinctes en
  coûtent **85 084**, soit +3,8 % sur l'index au lieu de +44 %.

  `/bilan` ouvre donc sur le groupe de la commune affichée, au-dessus du
  palmarès de l'échelon : même barème, même tri, mêmes colonnes, seule change
  la population comparée. Bordeaux : « 25 communes de 100 000 habitants et
  plus, urbaines, de métropole, hors montagne, touristiques […] 22e sur 25, à
  8,4 sur 20 ».

  **Balayé sur les 34 875 communes** : 34 628 obtiennent leur groupe sur les
  cinq critères, 147 retombent sur trois, 29 sur deux, **64 n'en ont aucun** et
  7 n'ont aucun critère publié. Les 64 sont **toutes d'outre-mer**, et c'est un
  refus, pas un trou : leurs strates comptent chacune moins de vingt communes,
  et retirer le critère d'outre-mer les comparerait à des communes
  métropolitaines.

  **Deux défauts trouvés en peignant, aucun par les 978 tests.** Le groupe
  montrait cinq communes à 20/20 sans dire combien partageaient la note — 47
  des 635 semblables à Sare : c'est la faute exacte que le palmarès de
  l'échelon avait déjà coûté un correctif, refaite dans un module neuf le jour
  de sa naissance, et la phrase des ex æquo est désormais partagée par les
  deux. Et la ligne mise en avant composait `--encre-douce` sur un fond
  d'accent à 6 % : **4,49:1** pour un seuil de 4,5, relevée à l'`axe-core`,
  même famille que l'estompe des paliers du simulateur.

  Les titres de colonnes lisaient encore « Les mieux notées » sous un titre
  corrigé en « les départements […] gérés » : **troisième fois** que ce
  participe tombe ici.

- **Ce que la redistribution change, décile par décile** (17 août 2026). Le site
  disait ce que l'État encaisse et ce qu'il dépense, jamais ce que cet argent
  **fait** aux revenus. L'INSEE publie les neuf déciles du niveau de vie avant
  et après impôts et prestations, de 1996 à 2024 : chargé pour de vrai depuis
  Melodi, **580 observations sur 29 exercices**.

  | 2024 | avant | après | écart |
  |---|---|---|---|
  | 10 % les plus modestes | 9 970 € | 13 970 € | **+4 000 €** |
  | 30 % les plus modestes | 21 120 € | 20 980 € | −140 € |
  | 10 % les plus aisés | 58 710 € | 48 580 € | **−10 130 €** |

  La bascule est au **troisième décile**, et le rapport interdécile passe de
  5,89 à 3,48.

  **Trois pièges dans le jeu, un test chacun.** Le cinquième décile n'a pas de
  code `D5_SL` : l'INSEE le publie sous `MED_SL`, et le chercher sous son nom
  attendu ferait un trou au milieu du tableau, à l'endroit où le lecteur se
  place lui-même. Le même jeu porte d'autres zonages et des croisements par âge
  — la médiane y arrive **soixante-dix-sept fois** — si bien qu'un filtre
  manquant garde la série de la bonne longueur et la remplit d'ailleurs. Et le
  jeu **non** rétropolé porte deux valeurs pour 1996, 2010, 2012 et 2020, de
  part et d'autre d'une rupture de méthode : ce module emploie le rétropolé et
  **lève** plutôt que de garder la dernière lue.

  **Mon propre fixture de test portait ce piège** : 33 890 € comme médiane après
  redistribution, lue dans le jeu sans filtrer les croisements. La vraie est
  26 740 €. C'est de peindre le bloc avec les séries chargées qui l'a montré —
  les sept tests unitaires passaient sur la valeur fausse.

  **Pas d'indice de Gini ici, et c'est un refus** : le site porte déjà celui
  d'EU-SILC, sur l'échelle 0-100 et sur un autre champ. Deux indices du même
  nom sur une même page se liraient comme un seul.

- **Les retraites, les inégalités et la délinquance de la France, posées à côté
  de celles des voisins** (17 août 2026). D7 accordé, `europe.py` étendu plutôt
  qu'un connecteur neuf — le geste qui avait marché pour les maires. Six séries
  chargées pour de vrai contre Eurostat, dans un entrepôt local : 4 079
  observations, **aucun doublon (pays, période)**.

  | Jeu | Séries | Pays |
  |---|---|---|
  | `spr_exp_pens` | pensions totales et vieillesse seule, % du PIB | 42 |
  | `ilc_di12` | indice de Gini du niveau de vie | 40 |
  | `ilc_di11` | rapport interquintile S80/S20 | 46 |
  | `crim_off_cat` | homicides et cambriolages de logement pour 100 000 | 41 |

  France 2023 : pensions **14,61 %** du PIB, vieillesse seule 12,07 %. France
  2025 : Gini 30,4, S80/S20 4,74. France 2024 : 1,28 homicide et 295,47
  cambriolages de logement pour 100 000 habitants.

  **Une donnée publiée qu'aucun écran ne montre n'est pas livrée** — ce fichier
  porte déjà l'entrée « les quarante-trois séries invisibles ». Le tableau des
  voisins gagne donc une colonne « Pensions / PIB » et un second tableau
  « Niveau de vie et faits enregistrés ». Chaque colonne porte **son propre
  millésime** : l'enquête EU-SILC publie l'année même, la statistique de police
  deux ans après, et une année en tête de tableau en daterait trois.

  **Deux unités neuves, pour deux raisons de fond.** Un indice et un rapport
  publiés en `count` s'arrondissent à « 30 » et « 5 », c'est-à-dire perdent
  exactement les dixièmes où se joue l'écart entre pays. Et les taux
  d'Eurostat comptent **pour cent mille habitants** quand les séries du SSMSI
  que le site publie comptent **pour mille** : deux unités distinctes, aucune
  conversion silencieuse de l'une vers l'autre.

  En peignant le tableau, **le sixième formateur** à laisser tomber la décimale
  d'une colonne comparée : « Allemagne 94 » entre « 295,5 » et « 166,8 ».

- **Quatre cadres défilants inatteignables au clavier, et la garde qui ne
  pouvait pas les voir** (17 août 2026). `axe-core` sur `/bilan` : quatre
  violations WCAG 2.1.1, exactement le défaut pour lequel huit autres cadres
  avaient été corrigés il y a quelques heures.

  **La garde écrite alors énumérait huit gabarits à la main.** Une liste écrite
  à la main ne pousse pas : les cadres des analyses, du rendu d'analyse, des
  crédits par mission et des scénarios sont arrivés après elle, et elle est
  restée verte. Elle **déduit** désormais sa liste de la feuille de style —
  toute classe dont une règle déclare `overflow-x: auto` doit porter
  `tabindex="0"` partout où un gabarit l'écrit — moins les cadres dont le
  contenu propre est focalisable, qui défilent déjà au clavier.

  La fenêtre d'exemption s'arrête à la fermeture du cadre : sans cette coupe,
  un bouton écrit **après** le tableau des scénarios exemptait un cadre qui
  n'en contient aucun. La première version de la garde avait ce trou.

- **Une table de plus, pas une contrainte élargie — et l'entrepôt n'a pas
  bougé** (17 août 2026). Les exécutifs locaux — 94 présidents de département,
  14 de région, 34 889 maires sortants — avaient été écrits dans
  `geo.commune_officials` en élargissant son `check (role in ('maire'))`. DuckDB
  n'applique pas une contrainte modifiée à une table déjà créée : `SchemaDivergent`
  a donc exigé un entrepôt neuf, et j'ai incrémenté `entrepot.CLE` en v3.

  **C'était le choix coûteux, et le fichier le disait deux fonctions plus
  haut.** L'entrepôt v3 n'existant pas dans le bucket, le prochain `ingest`
  aurait ouvert un entrepôt **vide** — et publier depuis là **effaçait les
  données du site**. `ANCETRES_ADDITIFS` existe précisément pour l'éviter : un
  schéma qui ne fait qu'**ajouter** est appliqué à l'ouverture par les
  `create table if not exists`, sans rien reconstruire. Son commentaire est
  explicite — « refuser l'addition n'est pas le choix prudent : c'est le choix
  coûteux » — et quatre changements l'empruntaient déjà.

  Les trois rôles vivent donc dans **`geo.local_executives`**, une table
  ajoutée. Diff du schéma contre `origin/main` : **0 ligne retirée, 32
  ajoutées**. `geo_level` entre dans la clé, ce qui règle explicitement la
  collision du code « 75 » entre le département de Paris et l'Île-de-France.

  **Vérifié sur un entrepôt fabriqué comme celui du bucket** — schéma
  d'`origin/main`, empreinte enregistrée : il s'ouvre sans lever, la table
  apparaît, les deux « 75 » cohabitent, et l'entrepôt porte désormais deux
  empreintes. Aucun rechargement, aucun risque pour les données en ligne.

  **La leçon** : avant d'incrémenter la clé du schéma, se demander si le
  changement peut se dire en **ajout**. Ici il le pouvait — une table au lieu
  d'un rôle — et je ne me suis posé la question qu'après avoir poussé la clé.
  Le compte de tables de `test_entrepot.py` est la garde qui rend l'ajout
  visible : il passe de 22 à 23, et rien n'entre en silence.


- **« Aucune source ne publie les maires 2020-2026 » — faux, sixième fois**
  (17 août 2026). Le site nommait le maire en exercice d'une commune et
  personne ailleurs. Il nomme désormais l'exécutif de chaque maille **et son
  prédécesseur**, ce qui est le seul nom qui compte : la note se lit sur
  2019-2025, et le maire en fonction depuis mars 2026 n'a aucun de ces
  exercices derrière lui.

  **L'erreur.** Le jeu « Répertoire national des élus » est une ressource
  écrasée à chaque publication ; mesuré, ses 34 826 maires ont tous un mandat
  de 2026. J'en ai conclu, et écrit à l'utilisateur, qu'« aucune source
  officielle accessible ne republie les maires 2020-2026 », et j'ai proposé
  Wikidata en repli — mesuré ensuite à **1,8 % des communes et 5 des 10 plus
  grandes villes**, donc écarté.

  **La conclusion venait d'un seul jeu.** La liste des jeux du même producteur
  n'avait pas été lue. Le ministère de l'Intérieur publie « Élections
  municipales 2026 — Maires et conseillers municipaux sortants », arrêté au
  27 février 2026, Licence Ouverte v2 : **34 889 maires, 99,8 % des communes
  publiées et 99,8 % de la population.** Pierre HURMIC à Bordeaux, Grégory
  DOUCET à Lyon, Benoît PAYAN à Marseille, Anne HIDALGO à Paris.

  C'est la sixième fois de suite dans ce fichier que l'instrument est faux — et
  la deuxième fois que l'instrument est le **raisonnement** : on a conclu de
  l'absence d'un historique dans un jeu à l'absence d'une source chez le
  producteur, exactement comme on avait conclu de l'absence d'une colonne à
  l'absence des recettes des comptes spéciaux. La règle du dépôt disait déjà
  « avant d'écrire qu'un chiffre ne tient pas, chercher le contrôle qui
  l'aurait refusé ». Elle en gagne une : **avant d'écrire qu'une donnée n'est
  publiée nulle part, lister les jeux du producteur, pas seulement celui qu'on
  connaît.**

  **Trois pièges dans les fichiers, chacun avec son test.** Les dates des
  sortants sont en `JJ/MM/AA` quand le RNE courant les écrit en `AAAA-MM-JJ` —
  deux formats chez un seul producteur, et `18/05/20` lu tel quel serait une
  date de l'an 20. « 4ème Vice-président » contient « Président », donc une
  comparaison lâche gardait neuf vice-présidents par département. Et le
  département de Paris et la région Île-de-France portent tous deux le code
  « 75 » : le rôle est entré dans la clé primaire, sans quoi le second écrasait
  le premier en silence.

  **Ce que la source ne permet toujours pas** : un maire sortant sur trente a
  pris ses fonctions en cours de mandature, et le fichier ne donne que le
  dernier. La fiche écrit donc « Avant lui : X, en fonction depuis juillet
  2020 », jamais « maire de 2020 à 2026 ». Et les départements et régions n'ont
  pas d'équivalent « sortants », leur mandature 2021-2028 courant toujours :
  leurs présidents couvrent les exercices 2021 et suivants, jamais 2019 ni 2020.


- **Le palmarès, et un plafond encombré de deux mille communes** (17 août
  2026). La note vivait sur une fiche et dans le classement d'une fiche — deux
  endroits qui demandent de savoir d'avance quel territoire on cherche.
  `/bilan` ouvre désormais sur les mieux et les moins bien gérées d'un échelon.

  **Trois défauts, tous trouvés en peignant la page avec les fichiers publiés**,
  aucun par les 946 tests.

  Les dix « communes les mieux gérées de France » étaient Abbans-Dessous,
  Ablaincourt-Pressoir, Ablancourt, Accons : **les quatre premières de
  l'alphabet parmi 2 102 communes qui valent exactement 20 sur 20.** La note est
  bornée aux deux bouts par construction — 2 102 à 20, 2 221 à 0 —, donc l'ex
  æquo n'est pas un cas limite, c'est le cas courant. Le tri départage
  maintenant par population et le cadrage dit combien partagent la note : la
  liste se lit « les plus grandes des 2 102 à 20/20 », et non un palmarès
  national inventé.

  Le bas montrait **les moins peuplées sous une phrase promettant les plus
  peuplées** — un tri unique « note décroissante, population décroissante »
  suivi d'un `slice(-N)` prend, parmi les derniers ex æquo, les plus petits. Le
  texte publié démentait le tableau publié, à deux lignes d'écart.

  Et les rangs étaient **fabriqués** : « 1re, 2e, 3e » pour 2 102 communes à
  égalité, « 34 778e, 34 777e » à l'autre bout. Les ex æquo partagent leur rang,
  la convention que `situation.ts` tenait déjà. Dix lignes qui affichent « 1 »
  disent au lecteur, mieux qu'une phrase, que le plafond est encombré.

  **L'accord du participe a cassé une seconde fois, dans un module vieux d'un
  commit** : « les départements les mieux et les moins bien gérées ». La table
  des mailles porte désormais le genre à côté du pluriel. C'est le même défaut
  que le critère de classement une heure plus tôt — ce qui est exactement
  pourquoi la garde écrite là-bas valait la peine, et pourquoi ce module-ci
  avait besoin de la sienne.

- **`git checkout -- <fichier>` a détruit du travail non commité, quatrième
  fois** (17 août 2026). Employé par réflexe pour défaire un sabotage de
  vérification, il a emporté le branchement du palmarès dans `main.ts`, écrit
  quelques minutes plus tôt et jamais commité. Refait à l'identique depuis le
  script qui l'avait posé — mais le script n'existait que par chance.

  **La règle** : un sabotage se défait avec la copie qu'on a prise avant lui
  (`cp fichier /tmp/x.bak` puis `cp /tmp/x.bak fichier`), jamais avec `git
  checkout`, qui ne distingue pas ce que le sabotage a changé de ce que le
  travail a écrit. Les trois sabotages du même quart d'heure employaient
  d'ailleurs la copie ; c'est le quatrième, tapé à la main, qui a employé git.


- **La page de méthode décrivait un autre site** (17 août 2026). Deux de ses
  règles d'affichage étaient devenues fausses, et une page de méthode qui
  décrit un autre site que celui qu'on lit est pire qu'une page absente : elle
  donne au lecteur une garantie qu'il peut démentir d'un coup d'œil, sur la
  page même.

  « **Le site ne publie ni score composite, ni classement** » — alors que la
  fiche ouvre sur une note sur 20 et que le classement range par elle. C'était
  l'entrée n°4 du reste-à-faire, qui pesait déjà avant la note et que la note a
  rendue intenable. Ce que la phrase protégeait vraiment est gardé et dit :
  aucune comparaison d'un échelon à l'autre, aucun indice sans dimension
  agrégeant des mesures d'unités différentes. Les règles disent en plus ce que
  la note mesure, ce qu'elle refuse de juger, et pourquoi son barème est propre
  à chaque échelon.

  « **Tous les montants sont en millions d'euros** » — alors que
  `montantLisible` choisit l'échelle sur le montant et écrit « milliards
  d'euros » en toutes lettres au-delà du millier de millions. Celle-là est plus
  ancienne que cette branche : la règle qu'elle décrit a été remplacée le jour
  où les montants ont cessé de demander une division de tête, et la page de
  méthode ne l'a pas suivie.

  **La leçon.** Aucun test ne compare la page de méthode au comportement
  qu'elle décrit — ils vérifient que la page contient ses phrases, pas que ses
  phrases sont vraies. Un document de méthode se périme en silence, et c'est le
  seul document du site dont le lecteur ne peut pas vérifier l'exactitude
  autrement qu'en lisant tout le reste. Trois sabotages tiennent la correction.

  Et les motifs des nouvelles assertions s'écrivent `\s+` et non avec une
  espace : le gabarit se replie sur plusieurs lignes, donc une espace du source
  devient un retour et son indentation dans le rendu. Le fichier employait déjà
  ce motif pour la phrase des producteurs ; ma première version des assertions
  l'a manqué, et deux d'entre elles ont échoué sur du texte pourtant présent.
  Même famille que l'insécable, dixième fois qu'un blanc invisible fait échouer
  une vérification.


- **La note entre au classement, et un accord de participe tombe** (17 août
  2026). La note vivait sur une fiche et nulle part ailleurs : un lecteur
  voyait « 8,4/20 » sans savoir si c'était le haut ou le bas. Elle est
  désormais le premier critère du classement, au-dessus des quatre mesures dont
  elle sort.

  **Le barème n'est pas recalculé.** La fiche lit des séries, le classement lit
  des couches de carte ; `noteDepuisCouches` recompose la forme qu'attend
  `note()` plutôt que de réécrire la grille — deux écrans du même site ne
  doivent pas pouvoir afficher deux notes différentes du même territoire.
  Vérifié au navigateur sur les fichiers publiés : Bordeaux 8,4, Gironde 1,1,
  Nouvelle-Aquitaine 12,0, identiques des deux côtés.

  **Le défaut trouvé en peignant** : le critère s'annonçait « 27 887 communes
  sont mieux **notés** ». Un participe passé s'accorde, et le sujet change avec
  la maille — « communes » et « régions » au féminin, « départements » au
  masculin. Les quatre critères d'origine y échappaient par construction, en
  employant des verbes pleins (« dépensent plus », « doivent moins »), mais la
  règle n'était écrite nulle part : le cinquième critère l'a enfreinte le jour
  où il est arrivé. Un test lit `main.ts` et refuse toute formule portant un
  participe accordé.

  **Et la sonde des 320 px mentait de sept signalements.** Elle comptait comme
  débordant le lien d'évitement, qui vit à `left:-9999px` — un élément
  entièrement hors écran à gauche n'élargit pas le corps, et `scrollWidth`
  faisait déjà foi juste en dessous. Corrigée, elle rend **0 signalement** sur
  les sept adresses. Une sonde qui crie sans raison cesse d'être lue, ce qui
  est pire que pas de sonde.


- **La note de gestion, et pourquoi elle n'a pas un barème mais quatre**
  (17 août 2026). Le site répond enfin à la question qu'on vient lui poser —
  « est-ce que ma commune est bien gérée » — par une note sur 20 en tête de
  fiche, décomposée en trois termes et refaisable de tête.

  **Le premier barème était unique, et il était faux.** Mesuré sur la
  publication `2026-08-11T0807`, avant toute correction :

  | échelon | taux d'épargne médian | trajectoire médiane |
  |---|---|---|
  | commune | 16,9 % | −2,7 pts |
  | région | 18,6 % | −2,3 pts |
  | département | **9,6 %** | **−4,4 pts** |

  Un département n'a pas la marge d'une commune, et **ce n'est pas une faute de
  gestion** : ses recettes de fonctionnement portent le RSA, l'APA et la PCH,
  des prestations qui entrent et ressortent. Rapporter l'épargne à ces
  recettes-là donne mécaniquement la moitié du taux d'une commune. Le barème
  commun retirait donc ~2,3 points sur 8 à l'échelon entier **pour sa
  définition de périmètre** — exactement la comparaison que la charte refuse
  (« aucune comparaison territoriale sans contrôle de définition, périmètre,
  période et unité »). La Gironde sortait à **0,2/20**, la médiane des
  départements à 10,3 contre 12,8 pour les communes.

  **Et la trajectoire médiane est négative aux trois échelons.** Entre 2019 et
  2025, l'inflation et la crise de l'énergie ont comprimé l'épargne de presque
  toutes les collectivités : une borne centrée sur zéro faisait perdre des
  points à la moitié d'entre elles pour un choc que personne n'a décidé. Le
  terme est recentré sur le mouvement médian de son échelon — il mesure ce
  qu'il prétendait mesurer, et plus le cycle.

  Après correction, les médianes se rejoignent — commune 12,8, département
  12,3, région 11,6 — et une mention veut dire la même chose partout. Les cinq
  mentions portent chacune 14 à 25 % des communes ; plafond 4,2 %, plancher
  6,0 %, contre **34 % à 20/20** pour la toute première version à paliers.

  **Ce que la note refuse restera ce qui la défend** : ni le niveau de dépense,
  ni sa répartition, ni les taux d'impôts. Dépenser beaucoup en action sociale
  est un choix d'électeurs, pas une faute de gestion — c'est la ligne que
  l'Argus des communes ne tient pas, lui qui note « les coûts fixes » et « la
  pression fiscale ». Un test lit `note.ts` comme du texte et échoue si l'un de
  ces quatre identifiants y entre.

  Les seuils de dette viennent de la **LPFP 2018-2022** (art. 29), qui sont
  eux-mêmes propres à chaque échelon — 12 ans pour le bloc communal, 10 pour
  les départements, 9 pour les régions. Ceux de marge et de trajectoire sont
  **empiriques et le disent** : aucune doctrine ne publie de seuil d'épargne
  par échelon, et un seuil rond inventé aurait caché ce fait sous une
  apparence officielle.

  **La leçon de méthode.** Rien de tout cela ne se voyait dans les 912 tests :
  le barème unique passait tous ses tests unitaires, parce qu'ils portaient sur
  des communes inventées. C'est de peindre la note avec les fichiers publiés,
  échelon par échelon, qui a montré qu'un échelon entier était puni pour sa
  définition comptable. Quatre sabotages tiennent désormais la correction.

  Et l'espace insécable a encore fait échouer une vérification — **neuvième
  fois**. Elle s'écrit `\u00a0` dans le module comme dans les motifs, jamais au
  clavier. Un piège de plus a été noté au passage : `\s` en JavaScript
  **comprend l'insécable**, donc un texte normalisé par `replace(/\s+/g, " ")`
  ne la porte plus — deux assertions du même fichier ne lisent pas la même
  chaîne, et chacune le dit.


- **Deux défauts d'accessibilité qu'aucun test du dépôt ne pouvait voir**
  (17 août 2026). §17 balayé pour la première fois, à l'`axe-core` dans un vrai
  navigateur, WCAG 2.1 AA, huit adresses × deux largeurs. Quinze nœuds en
  violation, de deux natures.

  **Un contraste à 2,1:1, et l'opacité en était la cause.** Les paliers du
  simulateur déclarent `--encre-douce`, un ton choisi et documenté pour tenir
  4,66:1 sur le carreau clair. `.simu__palier` les estompe à `opacity: 0.55`,
  ce qui compose `#a3aaa2` sur `#f2f1ec` : **2,1:1** pour un seuil de 4,5.

  Les contrôles du dépôt calculent les ratios sur les couleurs **déclarées** —
  et l'opacité n'est pas une couleur. C'est la première fois qu'un défaut de
  cette session demande un moteur de rendu pour être vu : ni la lecture de la
  feuille, ni les tests de couleur ne pouvaient composer la valeur. L'estompe
  est levée là où le fond est clair ; elle reste dans la barre de solde, où les
  marches sont blanches sur un aplat d'encre.

  **Sept cadres défilants inatteignables au clavier** (WCAG 2.1.1). Sous 40 rem,
  cinq tableaux passent en `overflow-x: auto`, et c'est la bonne décision — « un
  tableau large défile dans son propre cadre ; la page, jamais ». Mais un cadre
  qui défile sans contenu focalisable ne défile qu'à la souris : les colonnes
  cachées sont perdues pour qui navigue au clavier. Les huit conteneurs portent
  `tabindex="0"`, avec un anneau de focus sur le bord du cadre.

  **Et c'est un cas que ma propre sonde du §24 excusait** : elle sautait
  délibérément tout conteneur en `overflow-x: auto` comme « autorisé à
  défiler ». Les deux règles disent vrai en même temps — il a le droit de
  défiler, et il doit être atteignable. Une sonde qui connaît une exception
  finit par ne plus regarder ce qu'elle excuse.

- **L'accueil avait l'échelle d'un tableau de bord** (17 août 2026). Première
  passe de design du dépôt, avec le skill que ces règles imposent, installé
  avant d'y toucher.

  **L'audit a d'abord dit le contraire de ce qu'on attendait.** Le site n'est
  pas mal dessiné : jetons nommés, contrastes calculés et écrits (dix-sept
  ratios dans la feuille), sombre à parité complète de jetons avec une bascule,
  polices auto-hébergées, mouvement réduit honoré, cibles à 44 px, aucun script
  tiers. La fiche et `/reperes` tiennent — la courbe d'inflation est bonne. Il
  n'y avait pas de refonte à faire sur six pages sur huit, et en faire une
  aurait cassé un système accessible pour rien.

  **Une page était faible, et c'est celle qu'on ouvre.** Mesuré, pas ressenti :
  l'échelle typographique s'arrête à 28 px, ce qui est juste pour des vues
  denses — mais l'accueil en héritait, et sa phrase d'ouverture s'écrivait à
  20 px, la taille du nom d'un territoire sur sa fiche. Elle se lisait comme un
  sous-titre. Quatre blocs sur cinq portaient le même cadre, le même rayon, le
  même rembourrage ; **six micro-étiquettes en capitales espacées** se
  suivaient sur une seule page, chaque section s'annonçant avant de parler.

  Trois changements, tous dans la feuille de style : un cran d'affiche
  (`--texte-affiche`, borné par `clamp` pour tenir en deux lignes à 1 440 px) ;
  une seule carte au lieu de cinq, celle du verdict, les autres en bandes
  séparées d'un filet ; les sur-titres redevenus des titres dans la serif du
  site. Les références légales, longues de cent caractères et soulignées plein
  cadre, se bornent à la mesure de lecture.

  **Le premier essai était trop gros** : `clamp(2rem, 4.4vw, 3.25rem)` avec un
  cadre à 22ch donnait neuf lignes de titre qui remplissaient l'écran. Une
  phrase de douze mots ne prend pas un corps d'affiche — c'est une faute de
  taille, pas de copie. Corrigé en mesurant le nombre de lignes rendu à trois
  largeurs, jamais à l'œil.

  **Et le système s'est défendu tout seul** : le premier correctif écrivait la
  taille en dur, et un test d'architecture l'a refusée — « toutes les tailles de
  texte passent par l'échelle ». Le palier est donc un cran de l'échelle, pas
  une exception glissée dans une règle.

- **`/reperes` défilait horizontalement à 320 px, et la première correction ne
  suffisait pas** (17 août 2026). Corps de page à 385 px pour une fenêtre de
  320. Mesuré au navigateur sur le site construit, jamais déduit d'une lecture
  de feuille de style.

  **Deux causes, l'une derrière l'autre.** `repeat(auto-fit, minmax(20rem, 1fr))`
  garde sa piste de 20 rem même quand le conteneur est plus étroit : la section
  nationale n'offre que 190 px, et les deux cadres qui n'occupent pas la rangée
  entière — la dette et l'Europe — en prenaient 320. Même chose pour « 100 € »,
  18 rem dans un cadre de 156. `min(Nrem, 100%)` ne change rien au-dessus de
  N rem ; il laisse seulement la piste descendre avec son conteneur.

  Cela a ramené le corps à **330 px, pas à 320**. Le reste venait de
  `.bloc__chiffre` : un flex sans `flex-wrap`, où le chiffre est au corps le
  plus gros du site — « 3 536 100 M€ » suivi de la pilule « 2026-Q1 » demande
  330 px, et la pilule sortait du cadre.

  **La leçon vaut plus que les deux lignes de CSS** : 385 → 330 est une grosse
  amélioration et reste une page qui défile. S'arrêter à la première mesure
  aurait produit une affirmation fausse. Les quatre autres grilles du fichier —
  16, 12, 9,5 et 9 rem — ont été mesurées aux mêmes 320 px et tiennent : elles
  restent telles quelles.

  **Ce n'est pas le §24**, qui ne porte que sur les surfaces *nouvelles* : ces
  cadres sont plus anciens que le cadre de partage dont la vérification a fait
  chercher. Celui-ci passe — ses deux boutons mesurent 139 et 140 px, bords
  droits à 155 et 301.

  Et la première sonde ne certifiait rien : elle annonçait zéro débordement sur
  les huit pages sans jamais attendre que le cadre de partage paraisse — elle
  mesurait donc toutes les surfaces sauf celle qu'on venait d'ajouter. C'est
  l'attente explicite qui a fait apparaître le défilement de `/reperes`.

- **Les deux défis de l'atelier, en Md€ sous un compteur en M€**
  (17 août 2026). « Dégagez 10 Md€ » et « 30 Md€ sans toucher à l'école »,
  avec leur avancement peint à côté : « +9 520 M€ ». Savoir si le défi était
  tenu demandait une conversion de tête.

  Ce n'est pas une trouvaille : `mission.ts` a converti ses paliers pour
  exactement cette raison, son commentaire cite le même écran et le même
  compteur, et il énumère les trois assertions du dépôt qui refusent `Md€`.
  Les défis vivent sur cet écran-là, à quelques pixels des paliers — la
  correction avait été portée dans un module et pas dans son voisin.

  Le test ne vise donc pas une chaîne : il balaie **tout** ce que l'atelier
  rend, un budget réglé, et refuse `Md€` comme `k€`. Trouvé en peignant
  l'atelier avec les fichiers publiés, jamais par les 912 tests.

  Et la sabotage a d'abord échoué en silence : le motif tapé à la main portait
  une espace ordinaire là où la source écrit `\u202f`. Sixième fois que cette
  espace-là fait passer une vérification pour verte.

- **La fiche de territoire se partage, et l'adresse du site cesse d'être
  coupée** (17 août 2026). La spec §13 liste cinq objets partageables ; le site
  en offrait trois. Deux des cinq natures de carte sont mortes par la décision
  D-L3-b, documentée — l'espace des budgets encodés est infini. Pour la fiche,
  aucun refus n'était consigné : `carteFiche` était écrite, testée, sans un
  appelant.

  Ce qui manquait était une seule ligne de données. `reperes()` rendait
  `{role, terme, valeur, exercice, variation}` — de quoi peindre l'écran, où
  l'entête porte déjà l'unité et la source, mais pas de quoi faire sortir un
  chiffre du site. `Repere` porte désormais `id`, et le catalogue donne le
  reste. Rien n'est peint si les trois repères ne partagent pas une source :
  `SourceCarte` n'en nomme qu'une, et en choisir une pour trois serait la faute
  que l'entrée précédente vient de corriger. Vérifié sur les quatre mailles —
  une source chacune.

  Le build n'écrit pas 34 875 PNG : la carte se dessine dans le navigateur, au
  clic, et `telecharger` la remet en SVG. C'est le seul objet du site dont
  l'image existe sans avoir d'adresse, et `partageFiche` rend donc `image: null`
  comme un scénario, pour une raison voisine mais différente.

  **Deux défauts trouvés en peignant les cartes avec les données publiées, et
  les deux étaient là avant.** L'adresse du site était bornée au tiers de la
  largeur utile — 352 unités — quand celle du dépôt en demande 373 : **les six
  cartes que le build écrit** portaient « https://plateforme-9sz.pages.… ».
  C'est la seule chaîne d'une carte qui devient inutile en perdant sa fin, et
  c'est elle qui existe pour ramener le lecteur ici ; c'est donc la mention
  d'unité qui cède désormais. Et les trois variations d'une fiche se lisent de
  haut en bas : la Nouvelle-Aquitaine peignait « +10 % » entre « +9,1 % » et
  « +5,4 % » — la règle de la décimale, dans la seule colonne où personne ne
  l'avait cherchée.

- **La source d'un chiffre, maille par maille** (17 août 2026). L'export CSV
  d'un **département** écrivait en tête de fichier :

      # Source : OFGL, Finances des communes (consolidee)

  et la même phrase pour les **cartes grises**, une recette que seules les
  régions perçoivent. Reproduit sur la publication `2026-08-11T0807`, sur trois
  indicateurs.

  Ce n'est pas une faute du connecteur, qui télécharge bien les trois jeux
  (`normalize/ofgl.py`, `JEUX`) et trace chaque run sous le sien : c'est que
  `core.indicators.dataset_id` ne porte **qu'un jeu par indicateur**, et que
  l'OFGL les déclare tous sous celui des communes, en dur. Le catalogue publié
  répétait cette déclaration. **73 des 93 agrégats** de l'OFGL en dépendaient,
  dont 16 qui n'existent pas du tout à la maille commune.

  Le jeu réel est dans le run qui a écrit l'observation. La publication le lit
  et déclare `jeu_par_niveau` — **les seules mailles dont la source diffère**,
  parce que le site lit `jeu_par_niveau[niveau] ?? jeu` et que republier
  l'identité pour trois cent quinze indicateurs gonflerait le catalogue sans
  rien apprendre. Deux prudences : une maille qu'ont écrite deux jeux se tait,
  et un indicateur non publié reste dehors.

  C'est la règle que le docstring d'`indicateurs()` posait déjà pour les
  niveaux — « le catalogue dit la vérité de ce qui est publié, pas ce qu'un
  connecteur a déclaré » — et que le champ `jeu` était seul à ne pas tenir.

  Le branchement a son propre test : `export.ts` avait la fonction juste, et une
  fonction juste qu'aucun appelant n'emploie laisse le défaut en ligne. Les deux
  gardes ont été éprouvées par sabotage.

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
