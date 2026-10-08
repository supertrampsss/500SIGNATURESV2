# MANDATS : refonte 3D

La carte nationale est le terrain principal. Le joueur ouvre un sujet localisé, choisit une réponse et retrouve le pays transformé. L'objectif est de terminer les cinq années ; le bilan reste distinct de cet objectif.

La version 12 porte la nouvelle interface et les mobilisations. Les liens des versions précédentes gardent leurs règles. Les sauvegardes sont reconstruites depuis les entrées de partie. Les animations ne modifient aucun calcul.

## Présentation

Carte 3D Babylon.js, interface charbon et vert profond, commandes menthe, urgence corail. Les textes et boutons sont des éléments HTML. Un sujet ouvert montre une phrase, des choix spécifiques et leurs compromis. Les détails, indicateurs et historiques se consultent à la demande. Aucun cadratin, aucune flèche ni aucun chevron dans la nouvelle interface.

Les lieux simulés utilisent des villes françaises comme repères. Les événements, collectifs et effets restent fictifs. Les contours géographiques proviennent de Natural Earth via world-atlas 2.0.2 ; la géographie ne constitue pas une carte administrative détaillée.

Le premier rendu de cette carte a été rejeté par le propriétaire pour son écart avec les maquettes. La [correction du diorama](mandats-diorama.md) conserve les références artistiques, les défauts reproduits et les captures comparatives du jeu. Elle devient la référence graphique actuelle ; les captures ci-dessous documentent la première livraison.

## Animations

La scène représente les chantiers financés, leur livraison et les mobilisations réellement présentes dans la partie. Les foules se déplacent à des rythmes variés. La caméra reste sous le contrôle du joueur. Le mouvement réduit et la vue légère conservent les commandes. Un navigateur sans WebGL garde une carte et les choix accessibles.

## Défaillances à vérifier dans les parcours réels

- Ouvrir, fermer ou déplacer la carte pourrait consommer une décision.
- Une sélection pourrait perdre sa position ou créer plusieurs moteurs WebGL.
- Une réponse rejetée pourrait financer un projet ou apaiser un mouvement.
- Les capacités pourraient apparaître avant la livraison des moyens.
- Une mobilisation pourrait cesser d'évoluer pendant un autre dossier.
- Recharger ou importer pourrait perdre les conséquences ou accepter des états falsifiés.
- Les sujets pourraient présenter systématiquement les mêmes réponses.
- Une crise ouverte à la dernière décision pourrait empêcher de terminer cinq ans sans fondement institutionnel.
- Les marqueurs, le panneau ou les commandes pourraient déborder à 320 pixels ou devenir inutilisables au clavier.
- La réduction des mouvements, une perte de contexte graphique ou une reprise hors connexion pourrait bloquer les décisions.

Les contrôles portent sur une partie complète, des suites scolaires, plusieurs départs, les reprises, l'import et les trois largeurs de référence. Les captures et entrées de rejeu sont conservées. Les performances réelles sur appareils physiques restent distinctes des mesures sur navigateur de test.

## Situations et rejouabilité

Les cas ajoutés portent sur l'automatisation d'une usine, l'IA dans les services publics, une cyberattaque hospitalière, les équipes du réseau d'eau, un port bloqué, le stockage énergétique, la chaleur dans les écoles et les logements vacants. Chaque cas dispose de réponses propres et de compromis. Ils complètent les situations de soins, énergie, logement, industrie, recrutement, intégration et intégrité du moteur précédent.

L'agenda limite les sujets à trois et privilégie des familles différentes de celles récemment traitées, sauf échéance prioritaire. Les projets et mouvements conservent leur origine et leur échéance. Le retour à un tournant reconstruit la partie depuis les décisions précédentes ; changer une réponse crée une trajectoire réellement recalculée.

Une exploration de 40 parties v12, avec des choix variés et le traitement des crises institutionnelles, produit 38 mandats terminés et deux ruptures. Elle rencontre les huit nouveaux cas et 27 sujets rédigés distincts, hors marqueurs de politiques, institutions et mouvements. Toutes les sauvegardes rejouent exactement leur état final. Les entrées et fins sont conservées dans [la matrice des 40 parties](mandats-rework/scenario-matrix.json) et `site/rework-artifacts/scenario-matrix.json`. Cette exploration ne mesure pas l'attrait du jeu : rythme, difficulté et plaisir demandent encore des parties avec des joueurs.

## Vérifier et revoir

Après `npm run check` depuis `site/`, exécuter successivement :

```sh
npm exec -- playwright test --config playwright.rework.config.ts
npm exec -- playwright test --config playwright.social.config.ts --project desktop-chromium --project android-chromium --project compact-chromium --project iphone-webkit
npm run test:mandats -- --workers 2
npm run test:board -- --workers 2
```

Les trois premières suites utilisent le même serveur de prévisualisation ; ne pas les démarrer simultanément ni reconstruire `dist` pendant un parcours. La CI conserve les captures, rapports et entrées de rejeu pendant 14 jours. Les ressources Babylon.js, y compris les shaders chargés à la demande, rejoignent le cache hors connexion lorsque le joueur le prépare.

La géographie, les bâtiments et les animations sont procéduraux. Le premier bundle Mandats atteignait environ 473 Ko gzip avec le moteur et les règles historiques ; la correction du diorama atteint environ 515 Ko gzip. Le build signale sa taille. La résolution s'adapte et la scène vise 30 images par seconde, mais aucune cadence sur téléphone physique n'est garantie par les tests automatisés.

## Captures du jeu exécuté

Les images montrent les interfaces réellement rendues, avec le seed 0. Les captures v11 représentent l'interface précédente sur un sujet institutionnel ; les captures v12 ouvrent le nouveau dossier scolaire.

| Format | Interface précédente | Carte 3D et choix |
|---|---|---|
| Desktop | [v11](mandats-rework/screens/avant-desktop.png) | [v12](mandats-rework/screens/carte-desktop.png) |
| 390 px | [v11](mandats-rework/screens/avant-mobile.png) | [v12](mandats-rework/screens/carte-mobile.png) |
| 320 px | | [v12](mandats-rework/screens/carte-compact.png) |
| WebKit, 390 px | | [v12](mandats-rework/screens/carte-webkit.png) |

[Fin du mandat](mandats-rework/screens/fin-du-mandat.png) et [autre trajectoire](mandats-rework/screens/autre-trajectoire.png) montrent le parcours complet puis le retour à une décision d'origine. Les fichiers JSON de même nom contiennent les entrées importables. Les rapports complets restent dans les dossiers d'artefacts des suites ; les captures ci-dessus font partie de la branche pour sa revue.

La [mobilisation lycéenne](mandats-rework/screens/mobilisation-lyceenne.png) montre le rassemblement 3D après le regroupement adopté, avec une inspection du lieu dans WebKit. Importer son JSON retrouve la même mobilisation ; « Voir le lieu » rétablit le cadrage rapproché.

Validation du 8 octobre 2026 : 1 082 tests existants, contrôles TypeScript et build complet réussis ; 56 parcours plateau réussis ; 235 parcours de compatibilité réussis et 65 skips propres aux formats. Les deux assertions municipales ont été précisées après leur premier échec, puis les dix cas correspondants ont repassé. La refonte complète compte 18 réussites et six skips ; après la dernière correction de placement, ses dix contrôles graphiques ciblés repassent. Les parcours sociaux comptent 13 réussites et trois skips, dont les quatre imports causaux avec financement propre à chaque acteur. Les rapports de compatibilité et du mandat complet sont également conservés dans `/workspace/mandats-verification/` pour garder les preuves des runs avant les relances ciblées.

Le contrôle de navigation partagé vérifie également le nouveau parcours Ma partie, Retour au site, Escape et des cibles tactiles de 44 pixels. Ses trois formats passent, avec maintien de la navigation statique sur les liens v11 et de tous les parcours publics. Les captures et entrées sont dans `site/header-artifacts/`.
