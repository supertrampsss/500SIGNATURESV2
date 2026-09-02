# Benchmark de références — Salaires, France, Territoires

État : cadrage complété ; lot 1 et comparaison européenne du lot 2 sont
implémentés localement. Les références ci-dessous servent à
définir une expérience plus lisible ; elles ne constituent pas une licence de
reproduire les textes, visuels ou marques d'un tiers.

## Références repérées dans les likes X

| Référence | Mécanique utile | Adaptation 500signatures |
| --- | --- | --- |
| [Sarah Knafo — simulateur](https://sarahknafo.fr/simulateur) | Une question chiffrée, un statut, un résultat immédiat puis une ventilation | Onglet Salaires : saisie unique, quatre statuts, résultat visible sans étape intermédiaire, détail à la demande |
| [Post sur le coût du travail](https://x.com/knafo_sarah/status/2094680867624849919) | Une accroche très concrète sur l'écart entre net reçu et coût total | Montrer d'abord « reçu / coût total », puis expliquer chaque prélèvement avec une source et un millésime |
| [Sylvain Catherine — graphiques dépenses/Europe](https://x.com/sc_cath/status/2094428014834483334) | Deux vues complémentaires : évolution longue et position relative entre pays | France : une courbe historique + un dot plot européen, jamais deux graphiques qui répondent à la même question |

## Principes de hiérarchie

1. Une page commence par une réponse lisible en une phrase et un chiffre.
2. Trois preuves maximum sont visibles sans interaction supplémentaire.
3. Les analyses supplémentaires sont regroupées par thème et ouvertes dans le
   même écran ; aucune succession de pages « dossier ».
4. Une analyse n'affiche qu'une source principale. Les sources secondaires et
   les hypothèses vont dans la page Sources.
5. Le texte décrit le résultat observé. Il n'ajoute pas de commentaire
   défensif, d'avertissement générique ou de conclusion politique automatique.

## Matrice France

| Question | Indicateur | Graphique retenu | Décision de lecture |
| --- | --- | --- | --- |
| Le déficit vient-il des recettes ou des dépenses ? | Recettes, dépenses, solde | Barres divergentes autour de zéro | Le solde est lisible même sans légende longue |
| Comment évolue l'écart ? | 2000–dernier exercice | Deux courbes avec zone de différence | Une seule annotation sur le dernier point |
| Où va un euro public ? | Fonctions COFOG | Barre 100 % empilée | Part relative, puis montant en info-bulle |
| La France se distingue-t-elle de ses voisins ? | % PIB, même année | Dot plot trié | France accentuée, moyenne UE en repère |
| La dette est-elle sur une pente unique ? | Scénarios jusqu'en 2032 | Bande basse/centrale/haute | Étiquette « scénario », jamais « prévision » |

## Matrice Territoires

| Question | Indicateur | Graphique retenu | Règle de qualité |
| --- | --- | --- | --- |
| Quelle est la situation de la commune ? | Recettes, dépenses, épargne, dette | Quatre KPI compacts | Valeurs arrondies en M€, millésime visible |
| Qu'est-ce qui a changé ? | Évolution depuis 2019 | Cascade ou barres avant/après | Trois variations maximum en tête |
| La commune est-elle atypique ? | Rang parmi comparables | Bande de position | Comparables explicitement définis |
| Qui emploie qui ? | Emplois / établissements | Point ou barre avec dénominateur | L'indicateur « salariés par établissement » est secondaire et masqué si le champ est incomplet |
| Où investir ? | Dépenses d'équipement et dette | Nuage effort / capacité | Aucun classement sans population et année comparables |

## Lot prioritaire compatible avec un quota de 4 %

### Lot 1 — structure et lisibilité

- ajouter le lien de navigation Salaires et sa route dédiée ;
- appliquer le gabarit verdict → preuves → thèmes à France ;
- limiter Territoires à trois analyses prioritaires avant « Explorer » ;
- supprimer les blocs répétitifs et les pages intermédiaires d'ouverture ;
- vérifier 390 px, clavier et fermeture des détails au clic extérieur.

### Lot 2 — preuves visuelles

- remplacer chaque graphique par la forme de la matrice ci-dessus ;
- la comparaison européenne est désormais rendue en deux dot plots triés
  (dépense et prélèvements), avec la France accentuée ;
- le ratio contesté « salariés par établissement » est renommé « taille
  moyenne des établissements employeurs » et son dénominateur est explicite ;
- ajouter une table accessible sous chaque graphique ;
- afficher l'année, l'unité et le périmètre au même endroit ;
- retirer les ornements qui ressemblent à des marqueurs décoratifs.

### Lot 3 — Salaires

- reprendre le parcours fonctionnel de la référence publique, avec un texte et
  des calculs originaux ;
- brancher les paramètres sur [Urssaf](https://www.urssaf.fr/accueil/outils-documentation/simulateurs/cotisations-employeur.html)
  et les millésimes salariaux de l'[Insee](https://www.insee.fr/fr/statistiques/8376872?sommaire=8376908) ;
- réserver la ventilation détaillée au panneau local « Voir le calcul ».

## Critères de sortie

- aucune page ne montre plus de trois messages principaux avant interaction ;
- chaque graphique répond à une question et dispose d'une alternative textuelle ;
- les données sont arrondies sans perdre l'unité ni l'année ;
- à 390 px, pas de débordement horizontal et aucun contrôle sous 44 px ;
- le parcours Salaires est testable avec les quatre statuts, sans contenu copié
  mot pour mot d'un site tiers.
