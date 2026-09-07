# Audit des graphiques et proposition de lecture

Référence : [catalogue lieflat-charts](https://github.com/larashero3-dotcom/lieflat-charts/blob/main/catalog.md), consulté le 7 septembre 2026. Réalisations originales dans le projet, sans reprise de code du dépôt de référence.

L'audit couvre les rendus partagés de France, Territoires, Salaires et Mandats, les analyses composées et les recettes d'analyses génériques. Un rendu générique doit respecter le sens de chaque indicateur, pas seulement son unité numérique.

## Corrections livrées

| Surface | Défaut | Correction |
|---|---|---|
| France, dépenses | Historique et tableau supplémentaires redondants | Suppression du bloc « Données et historique des dépenses ». La composition actuelle reste visible. |
| France, redistribution | Enchaînement sans titre, contenu collé aux bords | Section « Ce que la redistribution change », après les dépenses et avant la Sécu, avec introduction courte et marges adaptatives. |
| Analyses, unités | « count », « percent », « annees » affichés tels quels | Nombre sans code technique, %, ans ; unités monétaires adaptées à l'ordre de grandeur. |
| Analyses de ratios | Première preuve tracée, au lieu du ratio décrit | Ratios calculés pour chaque exercice commun, avec dénominateur strictement positif. |
| Impôts locaux / dépenses | Seuls les impôts étaient tracés | Deux séries en base 100 au même exercice pour comparer leur progression. |
| Comparaisons France | Une seule série visible | Les deux séries comparables sont tracées : pensions femmes/hommes, avant/après redistribution, crédits votés/consommés. |
| Pologne / France | La série française seule pouvait illustrer le rattrapage polonais | Série du rapport Pologne / France fournie directement par le calcul de l'analyse. |
| Retraites par génération | Années de naissance présentées comme dates d'observation | Points par génération, commande « Génération de naissance ». |
| Chronologies | Trimestres et mois à espacement ordinal | Espacement selon la durée réellement écoulée ; rupture aux observations absentes. |
| Territoires, secteurs | Moyenne salariés / établissements peu informative | Part des emplois salariés par secteur au même exercice. Les valeurs décrivent les emplois au lieu de travail. |
| Territoires, tourisme | Hôtels et emplacements comparés en longueur | Chiffres séparés, sans classement entre unités différentes. |
| Territoires, logement | Ratio résidences secondaires sur principales + secondaires appelé part de tous les logements | Dénominateur nommé exactement. |
| Raccourcis de villes | Fiche seule, détails non repeints | Bordeaux et les liens de parenté chargent aussi les analyses complémentaires, comme la recherche. |
| Associations | Liste intégrale et formats variables | Dix bénéficiaires les plus financés, puis « Voir plus ». Tous les montants en M€, une décimale. |
| Associations, provenance | Risque de confondre État et ville bénéficiaire | « Subventions nationales à Bordeaux » dans la liste nominative. La commune reste nommée Commune dans sa fiche. |
| Salaires | Calcul détaillé interrompt le parcours | « Voir le calcul » après la répartition et son évolution, en bas de page. Suppression du commentaire sur l'interpolation. |
| Mandats, clair | Bandeaux, progression et choix blancs | Fond commun, bordures discrètes, sélection contrastée. Les commandes territoriales du bilan suivent aussi le thème. |
| Graphiques, sombre | Titres et couleurs hérités du thème clair | Couleurs de texte et de séries raccordées aux variables du thème. |

Ratios contrôlés : impôt par foyer, taux d'épargne, dette / épargne, personnel / fonctionnement, intérêts / impôts, retraités pour 100 jeunes, chômage au recensement, vacance, part du logement social, passoires du parc étiqueté, personnel de l'État / budget général, impôt sur le revenu / recettes fiscales, dette de l'État / dette publique, vieillesse et santé / prestations, vieillesse / famille, charge de dette / impôt sur le revenu. Les histoires de proportions n'affichent plus un effectif ou un montant brut comme substitut.

## Proposition graphique

Les choix ci-dessous sont une proposition de formats par question. Les lignes marquées « prochaine évolution » sont des propositions, pas des écrans déjà remplacés. La diversité doit faciliter une comparaison, sans imposer un nouveau dessin à une donnée qui se lit déjà bien.

| Question | Format proposé | Référence | Décision |
|---|---|---|---|
| Comment une valeur évolue-t-elle ? | Courbe fine ; points seuls quand les observations sont isolées | F2 Hairline Line | Conservé, indicateurs et dates corrigés |
| Qu'est-ce qui change avant/après ? | Deux points reliés, sur une échelle commune | F12 Dumbbell Queue | Conservé pour redistribution, recettes et sécurité |
| Comment se répartit un total ? | Champ de 100 cases, valeurs exactes dans la légende | L14 Hundred Field | Conservé pour recettes, appliqué aux emplois par secteur |
| Quels postes pèsent le plus ? | Barres horizontales classées | G3 Chunky Bars | Conservé pour dépenses ; utile même avec beaucoup de libellés |
| Où la France se situe-t-elle ? | Points alignés sur une échelle commune | Comparaison ponctuelle | Conservé pour voisins et fonctions publiques |
| Comment se partagent actifs et inactifs, puis emploi et chômage ? | Deux compositions reliées, avec le même exercice et les dénominateurs explicites | G7 Tree LR pour la hiérarchie, L14 pour les proportions | Prochaine évolution ; cartes actuelles conservées et ratio de chômage corrigé |
| Où se concentrent les emplois ? | Composition sectorielle ; à terme comparaison ville / référence | L14, puis F12 | Composition livrée ; comparaison à une référence proposée |
| Quels secteurs différencient une ville ? | Écart en points entre part locale et part nationale | F12 Dumbbell Queue | Prochaine évolution, lorsque les deux périmètres Flores sont alignés |
| Quel écart entre vote et exécution ? | Points appariés par exercice, puis historique agrandi | F12 Dumbbell Queue | Prochaine évolution ; deux courbes comparables livrées immédiatement |
| Quels sont les effets du mandat ? | Courbe du solde ou de la dette, valeurs annuelles et barres divergentes pour gains/pertes | F2, G10 Diverging Bar | Moteur inchangé ; surfaces du mode clair corrigées |
| Où va mon salaire ? | Composition du montant actuel puis courbe du poste choisi | L14/F2 comme direction visuelle | Répartition et historique conservés, calcul déplacé à la fin |
| Hôtels, logements, foyers, tarifs : que comparer ? | Chiffres séparés tant que les populations ou unités diffèrent | Pas de graphique de classement commun | Corrigé pour le tourisme ; cartes conservées pour le logement et les revenus |

La taille moyenne des établissements est calculable, mais mélange microstructures et grands employeurs. Une comparaison des parts sectorielles locales à une référence serait plus pertinente pour comprendre la spécialisation économique. Elle exige une année commune, une couverture sectorielle identique et les mêmes définitions d'emploi. Aucun ratio de spécialisation n'est inventé à partir du seul total local.

Les cartes documentaires sans série historique restent textuelles. Les séries de sources différentes ne deviennent pas des parts d'un même total simplement parce qu'elles sont toutes en euros ou en nombre de personnes. La liste associative continue de représenter les aides nationales localisées, et non le budget associatif municipal.

## Vérification

Tests de régression sur les ratios, dénominateurs nuls, unités, générations, dates trimestrielles et mensuelles, composition sectorielle et dépli du top 10. Contrôles navigateur sur redistribution visible et espacée, historique retiré, calcul en bas de Salaires et agrandissement des analyses. Revue visuelle en clair/sombre, sur ordinateur et sur des largeurs mobiles de 390 et 320 pixels. Résultats définitifs des contrôles dans la PR.
