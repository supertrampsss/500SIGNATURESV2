# Mandat national v7 : 70 dossiers, 45 décisions conditionnelles

## Demande et périmètre

Remplacer les petits arbitrages répétitifs par des décisions structurantes et clivantes,
rendre l'équilibre atteignable et faire dépendre les suites des choix précédents.
Le clic unique et l'interface existante sont conservés.

Le catalogue comprend 20 réformes, 40 suites conditionnelles (deux possibles par réforme)
et 10 dossiers sociaux de fin de mandat (deux possibles pour cinq groupes). Une partie
visite 45 dossiers : 20 réformes, leurs 20 suites, puis cinq bilans sociaux. Les 70
dossiers sont accessibles par les stratégies testées. Ce n'est pas un tirage aléatoire :
les vingt grandes réformes structurent le mandat, les vingt-cinq autres dossiers varient.

Les principaux leviers concernent les pensions, les effectifs et rémunérations publics,
la TVA, les aides aux entreprises, la santé, les prestations, la résidence, les
associations, l'âge de départ, l'hôpital, le chômage, l'énergie, le logement, les
collectivités, la recherche, la famille, la culture, la coopération et les projets.
Les intitulés et montants complets figurent dans national-reforms.ts et
national-branches.ts. Tous les rendements v7 sont des paramètres fictifs, pas des
évaluations économiques officielles. La première mesure réduit les pensions : elle
ne simule pas un gel progressif de leur indexation avec une économie immédiatement pleine.

## Origine du chiffre migratoire

La recherche n'a pas identifié un chiffrage démontrant 9 Md€ d'économie pour la seule
condition de cinq ans. Le chiffrage proche publié par l'Observatoire de l'immigration
et de la démographie le 7 février 2025 annonce 9,8 Md€ bruts **par an à la cinquième
année**, 2,9 Md€ de dépenses supplémentaires, soit 6,9 Md€ nets annuels à cet horizon.
Il annonce 20,8 Md€ nets cumulés sur le quinquennat. Il porte sur un ensemble de mesures,
pas seulement sur le délai de résidence. Il s'agit du chiffrage de cet organisme.

Source : https://observatoire-immigration.fr/cout-immigration-economies/

Le jeu n'attribue donc pas 9 Md€ à la seule règle des cinq ans. Son chemin est :
préparation des systèmes (0,2 Md€ ponctuels, sans chantier physique), puis choix entre
poursuite sous un cadre juridique explicitement modifié, contrôle des conditions
existantes ou abandon. La première option coûte 0,5 Md€/an puis applique une réduction
de charges fictive de 2 Md€/an l'année suivante. Le bénéfice de 1,5 Md€/an est une
hypothèse de jeu, sans attribution à une étude ni garantie de faisabilité juridique.
Les autres options ne déclenchent pas cette économie.

Contexte juridique :
https://www.senat.fr/rap/l24-426/l24-4265.html
https://www.service-public.gouv.fr/particuliers/vosdroits/F19778

## Moteur et effets sociaux

Les identifiants de choix déterminent le parcours historique. Les choix des branches
fermées sont refusés au jeu et à l'import. Le calcul n'utilise aucun cache partagé par
simple numéro de tour pour le parcours v7. Les sauvegardes v1 à v6 conservent leurs règles.

Sept indices de conditions matérielles (sur 100) suivent les actifs, retraités,
ménages modestes, entreprises, nouveaux résidents, agents publics et ménages aisés. Ils ne sont
ni des sondages, ni des estimations démographiques. Ils représentent une simplification
des revenus, de l'accès aux services et des moyens d'activité. Les catégories peuvent
se recouper : leurs indices ne sont pas additionnés comme des populations.

Les choix les modifient directement ou après délai. Chaque prélèvement possède sa propre répartition entre contribuables, indépendante du groupe bénéficiaire de la réforme. La précarité, les perturbations
du travail et l'activité fragilisée ont des effets annuels supplémentaires sur les
charges, les recettes ou la confiance lorsqu'un seuil est franchi. Les cinq derniers
dossiers dépendent des indices. Les conséquences budgétaires existent même si le
joueur ne choisit pas de compensation. Ils sont recalculés dans le budget annuel, sans s’incorporer aux charges ou recettes structurelles : ils ne se cumulent pas d’année en année et disparaissent lors du retour au-dessus des seuils.

La dette et ses intérêts continuent d'être comptabilisés une fois par an. Au début de
chaque nouvelle année, les recettes suivent (1 + croissance réelle) × (1 + déflateur)
et les charges courantes suivent (1 + déflateur), selon les paramètres du scénario.
Cette évolution n'est appliquée ni au premier choix ni à chaque carte. Elle ne promet
aucun rendement macroéconomique réel. Les seuils sociaux peuvent dégrader cette trajectoire.

Les suites ne recompensent pas une coupe déjà votée. La compensation ajoute sa dépense.
Le retrait restaure le montant annuel de la coupe, y compris son indexation si la suite
se trouve après une clôture. Les prélèvements et dépenses des autres suites portent
sur des enveloppes distinctes dans le budget fictif.

## Validation et limites

Tests : 70 dossiers et 210 identifiants uniques, accessibilité effective des 70 dossiers,
45 décisions sans répétition, branches fermées rejetées à l'import, clôtures, effets
différés, absence de faux chantier administratif, retrait d'une réforme, partage et
rejeu, sauvegardes, atelier alternatif et conséquences sociales récurrentes.

Trois stratégies testées jusqu'au bout pour les douze graines couvrant les combinaisons
des crises annuelles (modulos 3 et 4) atteignent un déficit inférieur ou égal à zéro.
Pour la graine 42 : coupes -12,42 Md€, recettes -67,60 Md€, combinaison -36,22 Md€.
Les résultats sociaux diffèrent fortement. La stratégie de soutien sans recettes
supplémentaires termine à +244,49 Md€. Le score financier ne résume pas le bilan social.

L'interface est inspectée sur ordinateur et dans des cadres de 390 et 320 px.
Les tests navigateurs couvrent les nouveaux intitulés, le changement de branche dans
l'atelier et la préservation de la sauvegarde. Les exécutables locaux étant absents,
la suite complète Chromium/WebKit reste un contrôle obligatoire de CI avant fusion.

Le modèle conserve des limites : vingt réformes communes, suites en partie structurées
par paires, indices sociaux agrégés et rendements fictifs. Il ne prétend pas simuler
toutes les réactions économiques, juridiques ou politiques d'une réforme réelle.
