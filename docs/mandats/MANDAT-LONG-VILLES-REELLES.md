# Mandat long, villes réelles et monde territorial

Décision produit du 5 septembre 2026, issue du retour utilisateur après essai. Statut : cadrage de la prochaine version, fonctionnalités non livrées. La production reste celle des PR 79 et 80.

## Direction retenue

Faire de Mandats un jeu où l'on gouverne un territoire reconnaissable pendant un mandat complet. Interprétation de « 45 points » : 45 décisions effectivement prises par partie, réparties sur les années, avec plusieurs options à chaque décision. Le nombre de cartes proposées n'est pas le nombre de décisions jouées.

Municipal : 45 décisions sur six années, réparties 8 / 8 / 8 / 7 / 7 / 7. National : 45 décisions sur cinq années, neuf par année. Une courte session permet de traiter quelques dossiers et de reprendre exactement au suivant. La durée totale sera mesurée sur un prototype jouable ; aucune durée promise avant cet essai.

Le cap demeure un choix initial. Une carte choisie valide le choix et ouvre le dossier suivant. Le passage d'année s'insère dans le même écran ; bilan développé facultatif. La frise montre les années et un indicateur local « Dossier 3/8 », jamais 45 pastilles simultanées.

## Constats vérifiés dans le dépôt

- `site/src/mandats/engine.ts` : chaque décision appelle actuellement préparation, événement et clôture annuelle. Allonger simplement `turns` à 45 produirait 45 exercices et fausserait le mandat.
- `municipal.ts` et `national.ts` : respectivement six et cinq dossiers, trois options chacun. Les délais sont aujourd'hui exprimés en tours annuels.
- `storage.ts`, `sharing.ts`, `planner.ts`, `cards.ts`, `world.ts` : reprise, défis, comparaison, cartes sociales et livraisons dépendent tous de cette horloge. Ils doivent évoluer ensemble.
- `world.ts` : les scènes actuelles sont des illustrations WebP avec couches de transformation, pas des modèles 3D navigables.
- `pipeline/plateforme/normalize/geometries.py` : les PMTiles actuels contiennent les contours communes, départements et régions. Aucun bâtiment ni hauteur n'est livré par cette chaîne.
- L'application de données dispose déjà d'une recherche territoriale et de publications financières versionnées. La disponibilité de chaque variable nécessaire au moteur doit être contrôlée pour la commune choisie ; une commune présente dans l'annuaire n'est pas automatiquement un scénario calibré.

## Trois options challengées

| Option | Intérêt | Limite | Décision |
|---|---|---|---|
| Répéter les dossiers actuels jusqu'à 45 | Peu de développement | Répétition, calendrier faux, effets cumulés excessifs | Rejetée |
| 45 décisions, engagements pluriannuels, ville réelle et carte réactive | Appropriation locale, profondeur et conséquences | Nouvelle horloge, calibration et géographie à construire | Direction principale |
| Réplique photoréaliste de toutes les communes dès le départ | Spectacle | Poids, couverture et coût incompatibles avec un premier lot mobile abouti | Différée |

Arbitrage profondeur / simplicité : multiplier les situations et les conséquences, conserver une seule décision prioritaire à l'écran. Arbitrage réalisme / jeu : comptes observés pour le départ, hypothèses séparées pour les effets, jamais de satisfaction ou d'état d'école inventé présenté comme une observation. Arbitrage ambition / livraison : un pilote Bordeaux sert à valider le système générique, la recherche reste conçue pour toutes les communes suffisamment renseignées.

## Horloge et moteur v3

Créer un contrat de campagne distinct des moteurs v1/v2. Ne pas modifier rétroactivement les règles d'une sauvegarde ou d'un lien existant.

- `decisionIndex` : de 0 à 45, progression du joueur.
- `yearIndex` : de 0 à 5 en municipal et de 0 à 4 en national.
- `slotInYear` : rang de la décision dans l'exercice.
- `annualPlan` : recettes prévues, charges récurrentes, dépenses temporaires, crédits d'investissement, subventions affectées, remboursements et engagements.
- `annualAccounts` : une clôture par exercice seulement, distincte des prévisions intermédiaires.
- `projects` : lancement, financement, étapes de chantier, livraison, maintenance et coûts futurs. Délais exprimés dans une unité explicite, pas déduits du nombre de clics.
- `eventSchedule` : événements reproductibles par graine, contexte et engagements ; une crise n'est pas redéclenchée à chaque carte de la même année.

Une décision modifie le plan et éventuellement les indicateurs immédiats. Le moteur affiche l'effet marginal et le budget prévisionnel. À la dernière décision de l'exercice, il clôt les comptes une seule fois, applique les conventions annuelles documentées et ouvre l'exercice suivant. Une recette annuelle ajoutée ne crédite pas neuf fois la trésorerie parce que neuf décisions sont jouées.

Les rendements, coûts, délais et coefficients de la campagne longue nécessitent un équilibrage propre. Les coefficients de la tranche courte ne doivent pas être appliqués 45 fois. Les situations financières impossibles ouvrent un redressement jouable sans réinitialiser le mandat. Les dépenses engagées au-delà de la fin restent visibles dans l'héritage.

## Trame municipale, 45 rendez-vous

Chaque entrée est un emplacement narratif avec variantes contextuelles, pas une prédiction sur une commune réelle. Les choix antérieurs changent le dossier, ses possibilités et son coût. Les interventions relevant de l'intercommunalité ou d'un autre acteur sont des négociations ou cofinancements, pas des pouvoirs municipaux supposés.

| Année | Dossiers successifs | Nombre |
|---|---|---:|
| 1, prendre la mesure | Entretien urgent des écoles ; horaires des services ; recettes locales ; entretien de voirie ; bâtiments énergivores ; subventions et calendrier ; réserve de précaution ; arbitrage du premier budget | 8 |
| 2, mettre en chantier | Avancement des écoles ; risque de dépassement ; offre de garde ; logement et compétences ; accès piétons ; achats et personnel ; équipement culturel ou sportif ; révision du programme d'investissement | 8 |
| 3, encaisser une crise | Préparation à la chaleur ; réponse immédiate ; facture d'énergie ; protection des habitants ; patrimoine exposé ; commerces et espace public ; livraison ou report ; correction du budget | 8 |
| 4, faire fonctionner | Coûts des équipements livrés ; entretien préventif ; accès aux services ; partenariat mobilité ; renaturation ; recrutement ou réorganisation ; point de financement | 7 |
| 5, choisir ce qui reste possible | Bilan d'usage des projets ; patrimoine en retard ; tarif d'un service ; cofinancement limité ; accessibilité ; dette et réserve ; programmation de fin de mandat | 7 |
| 6, transmettre | Dernières livraisons ; urgences résiduelles ; charges pérennes ; contrat d'entretien ; investissements après mandat ; dette ou marge disponible ; arbitrage final d'héritage | 7 |

Exemple de fil persistant : une rénovation choisie en année 1 revient pendant le chantier, lors d'un aléa de financement, à la livraison puis au budget d'exploitation. La renoncer produit d'autres rendez-vous, pas un chantier livré malgré le choix du joueur. Le joueur peut reconnaître les conséquences de sa stratégie sans relire un journal entier.

## Trame nationale, 45 rendez-vous

| Année | Dossiers successifs | Nombre |
|---|---|---:|
| 1, orienter | Assiette fiscale ; dépenses héritées ; accès aux services ; capacités de santé ; éducation ; énergie ; investissement ; financement ; clôture budgétaire | 9 |
| 2, déployer | Mise en œuvre fiscale ; capacités administratives ; rénovation ; réseau énergétique ; industrie ; formation ; logement ; disparités territoriales ; recalage budgétaire | 9 |
| 3, absorber | Choc économique ; soutien temporaire ; énergie ; services sous tension ; recettes dégradées ; approvisionnements ; adaptation climatique ; financement ; sortie de crise | 9 |
| 4, corriger | Livraisons ; productivité des investissements ; taux de financement ; correction graduelle ; accès territorial ; entretien ; recherche ; engagements sociaux ; programmation finale | 9 |
| 5, transmettre | Extinction des aides temporaires ; engagements restant à livrer ; services essentiels ; infrastructures ; résilience ; trajectoire de recettes ; charge de dette ; capacité future d'investissement ; bilan d'héritage | 9 |

Le périmètre APU consolidé doit rester explicite. Les leviers concernant plusieurs administrations modélisent une coordination, pas un pouvoir direct du gouvernement sur toute dépense publique.

## Sélection et calibration des villes réelles

Parcours : « Gouverner une ville » ouvre la recherche de commune dans la carte de sélection existante. La commune retenue affiche nom, population, année des comptes et trois repères de départ. Le cap se choisit dans ce même briefing. Depuis une fiche Territoires, « Gouverner cette ville » préremplit ce choix.

L'adaptateur de commune doit figer un instantané avec code INSEE, millésime géographique, publication, exercice, périmètre, unités, valeurs sources, formules de rapprochement et hypothèses nécessaires. Une mise à jour de la base ne modifie jamais silencieusement une partie commencée.

Contrôles avant disponibilité du scénario :

1. Même exercice et même périmètre pour les agrégats rapprochés ; euros convertis explicitement dans l'unité du moteur.
2. Fonctionnement, investissement, intérêts, remboursement du capital et encours distincts. Vérifier si les intérêts sont déjà inclus dans les dépenses publiées pour éviter leur double déduction.
3. Un champ absent n'est jamais remplacé silencieusement par zéro. Les hypothèses indispensables, notamment trésorerie disponible, dette amortissable ou état des équipements, sont nommées dans le briefing et versionnées.
4. Coûts des projets proportionnés au profil démographique et financier. Une règle uniforme « projet de 12 M€ » ne convient pas à toutes les communes.
5. Communes nouvelles, Paris et autres cas particuliers traités explicitement. Compétences communales, intercommunales et autres financeurs séparés.
6. Aucun quartier fictif ne prend le nom d'un quartier réel sans données adaptées. Des zones de jeu hypothétiques restent identifiées comme telles.

Les communes insuffisamment documentées restent consultables dans Territoires. Le jeu indique précisément pourquoi leur scénario réel n'est pas encore disponible et propose séparément le scénario fictif. Il ne remplace jamais silencieusement la commune choisie par Val-sur-Rive.

## 3D territoriale et direction AAA

La cible visuelle est une maquette stratégique reconnaissable : fleuve, emprise bâtie, rues principales, végétation et équipements identifiés, éclairage sobre, caméra stable. Un chantier apparaît comme un projet simulé distinct du bâti observé. Les phases construction, livraison et vieillissement doivent être visibles et expliquées par le jeu.

La [BD TOPO de l'IGN](https://www.data.gouv.fr/datasets/bd-topo-r) décrit le bâti et comporte des informations de hauteur ; sa fiche publie une Licence Ouverte 2.0. La couverture et la qualité de chaque champ restent à examiner sur l'extrait utilisé. [MapLibre documente l'extrusion des bâtiments](https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/). Ces sources établissent une voie technique, pas une intégration déjà réalisée.

Chaîne retenue à prototyper : extrait géographique autorisé, filtrage sur la commune, validation des géométries et hauteurs, niveaux de détail, paquet versionné, rendu à la demande. Pas de dépendance implicite au serveur de démonstration d'une bibliothèque. Les bâtiments sans hauteur fiable sont marqués comme géométrie estimée ou conservés en 2D.

Trois niveaux de rendu partageant les mêmes données et décisions :

- Essentiel : carte 2D ou vue illustrée clairement nommée, liste de lieux accessible, tous les choix jouables.
- Enrichi : bâtiments extrudés, eau et végétation stylisées, projets visibles, caméra orientable avec commandes accessibles. Chargement différé après accès au jeu.
- Premium : ombres, relief et repères architecturaux sélectionnés sur appareils capables. Leur identité doit provenir de données ou d'actifs documentés.

La finition AAA inclut surtout la continuité : aucun écran de chargement entre dossiers, retours tactiles facultatifs, sons facultatifs désactivés initialement, transitions sobres, affichage immédiat d'une décision prise, détails disponibles sans masquer l'action suivante. Pas de rotation automatique permanente ni de mouvement essentiel à la compréhension.

Budgets de conception, à mesurer : jeu essentiel utilisable sans GPU ; aucun téléchargement 3D bloquant la première décision ; paquet géographique d'un pilote plafonné et taille affichée avant téléchargement ; objectif 30 images/s stable pour la vue enrichie mobile, repli automatique si insuffisant. Le plafond en octets sera fixé à partir de l'extrait Bordeaux et d'essais mémoire réels, pas inventé avant extraction.

## Sauvegarde, hors connexion et partage

Les v1/v2 restent rejouables avec leurs règles historiques. Une partie v3 porte la version du moteur, le calendrier, le journal, l'instantané de commune et le manifeste géographique utilisé. Les limites de taille doivent être recalculées : le plafond actuel de sauvegarde est de 2 048 caractères.

« Préparer cette ville hors connexion » annonce le volume du jeu, des comptes et de la carte séparément. L'échec d'une couche 3D ne bloque pas la préparation du jeu essentiel. Reprise après fermeture, quota insuffisant, mise à jour et suppression de cache doivent être testés. Les données d'une ville ne dépendent pas d'une requête réseau après confirmation du téléchargement.

Les cartes de partage indiquent ville réelle, exercice de départ, mandat simulé, version et progression. Un résultat ne transforme pas les indicateurs de jeu en faits sur les habitants. Le planificateur compare le même instantané au même point du calendrier, même si les journaux comportent des choix différents.

## Lots de construction et critères de sortie

| Lot | Livrable | Vérification nécessaire |
|---|---|---|
| A | Horloge v3 et 45 dossiers municipaux et nationaux, moteur indépendant des scènes | Exactement 45 décisions, six/cinq clôtures, événements et intérêts appliqués une fois, projets et redressement cohérents |
| B | Recherche de ville et instantané financier versionné ; pilote Bordeaux | Réconciliation des comptes, unités, données manquantes, budget initial, compétences et coûts adaptés |
| C | Boucle longue intégrée au mobile, carte de projets et comparaison | Pas de 45 onglets ; un clic par choix ; sauvegarde à chaque décision ; reprise au milieu d'année ; pas de bilans imposés |
| D | Première géographie réelle 3D, pipeline réutilisable | Reconnaissabilité, provenance, géométrie valide, repli GPU, mémoire, tactile, lecteur d'écran et mouvement réduit |
| E | Carte offline de la ville, campagnes et partage v3 | Redémarrage réellement hors ligne, versions figées, liens compatibles, export/import et v1/v2 préservés |
| F | Extension aux communes compatibles et finition nationale | Couverture publiée honnêtement, absence d'estimations déguisées, essais de joueurs, charge et performance mesurées |

Ne pas mettre en production une extension qui affiche seulement « 45 » ou le nom d'une vraie ville au-dessus de la scène fictive actuelle. Les critères de livraison portent sur une campagne jouable, des comptes rapprochés et une géographie identifiée.
