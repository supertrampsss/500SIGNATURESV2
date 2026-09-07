# Corrections des premiers tests utilisateurs

| Demande | Réalisation |
| --- | --- |
| Même identité sur les pages | France, Territoires, Salaires, Mandats et guides utilisent le thème partagé. Petit bouton SVG clair/sombre, préférence conservée. |
| Mobile prioritaire | Trois entrées dans le mandat : Décider, Bilan, Ma partie. En-tête de navigation conservé, première mesure remontée sur écran compact. |
| Contexte répété | Cartouche répétitif retiré ; la source des comptes municipaux reste sous le choix. Le bilan rassemble comptes, société et journal. |
| Règles au début | Explication du vote, des conséquences et du mandat sur la sélection initiale. Sources détaillées toujours accessibles. |
| Vue légère incompréhensible | Commande « Réduire les animations » dans Ma partie, avec état conservé et respect du système. |
| Ancien simulateur | Interface, moteur V3 et tests propres à ce produit retirés. Redirection des anciennes adresses vers Mandats. Aucun effacement du stockage historique. Les utilitaires de budgets encore utilisés par les analyses restent en place. |
| Territoires simple | Recherche modernisée, suggestions sans code ni type, deux suggestions de villes. Ancien texte d'accueil et palmarès global retirés. |
| Carte | Fond, contours, sélection et commandes accordés aux deux thèmes, sans rechargement des données au changement de thème. Repli de recherche lorsque WebGL est absent. |
| Diagnostic visible | Affiché directement sous les indicateurs, correction d'une ancienne règle CSS qui continuait à masquer son contenu. |
| Évolutions lisibles | Graphiques annuels des lignes financières et tableau directement visible. Plus de classement des seuls écarts ni de bouton « montants exacts ». |
| Analyses complètes | Toutes les cartes restent visibles ; au plus deux séries distinctes par thème pour limiter le coût de rendu mobile. Aucun point inventé. |
| Associations | Liste nominative intégrale, montants et objets publiés. Il s'agit des subventions de l'État localisées, pas des subventions de la mairie. |
| Salaire détaillé | Saisie explicitement en net après impôt. Répartition indicative recalculée avec le montant et le statut. Retraites, chômage, famille, soins, intérêts, etc. sont séparés lorsque les séries partagent un exercice ; sinon repli par fonction COFOG. Le total n'additionne jamais une prestation et ses sous-postes. |
| France et chapitre 04 | Détail conservé, graphiques ajoutés, invitation « À vous de décider » à la fin. Les comparaisons par fonction et la comparaison d'ensemble répondent à des questions différentes ; une seule section « La France et ses voisins ». |
| Mandat rejouable et déficit | Moteur v8 conservé : stock de 70 dossiers, 30 réformes dans une partie, 0 à 5 crises espacées, votes uniques, effets persistants. Les tests de trajectoires vers l'équilibre et de sauvegarde restent actifs. |

Les valeurs publiées, les coefficients du simulateur de salaire et les conséquences
financières du mandat restent trois objets distincts. La répartition des prélèvements
applique une structure moyenne de dépenses publiques, sans prétendre tracer les
euros d'une fiche de paie. La règle des cinq ans ne reçoit pas arbitrairement 9 Md€ :
la vérification et le périmètre du chiffrage sont documentés dans
`docs/mandats/2026-09-parcours-conditionnels.md`.

Validation : tests unitaires et compilation, captures du site compilé en clair et
sombre, formats 390/320 px, puis suite Chromium/WebKit et gates CI avant fusion.
Les tests propres au simulateur retiré disparaissent avec son code ; les contrôles
de Mandats, des données et des parcours actuels sont conservés et complétés.

Captures finales : [France et mandat mobile](mobile-corrections-sombre.png),
[répartition sur ordinateur](salaires-repartition.png).

Contrôle local final : 1 006 tests réussis, compilation/prérendu et bundle hors
connexion réussis. Le test des contrastes du thème et les captures par blocs
complètent les parcours mobiles de vote, reprise et sauvegarde.
