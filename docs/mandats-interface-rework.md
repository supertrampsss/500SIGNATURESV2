# Interface Mandats — centre de crises inspiré de Plague Inc.

## Cible actuelle

Mandats v14 adopte un centre de crises : la carte illustrée sert de plateau, les six fronts restent visibles ensemble et les réponses s’ouvrent dans un menu d’initiatives. La composition distingue :

- **Situation** : un fil d’actualité issu de l’état enregistré, avec les échéances réelles du scénario.
- **Six fronts** : santé, logement, transports, énergie, enseignement et démarches publiques, avec pression sur 100, stade et tendance.
- **Moyens** : exécution mobilisée/capacité, chantiers en attente et coalition parlementaire.
- **Initiatives** : problème, choix, sacrifice, coût et délai. Sur téléphone, ce menu occupe l’espace central ; les six fronts et la navigation restent accessibles.
- **Plateau** : vrais repères ouvrables, zoom, inspection et dépliage de la carte. Lire ou revenir au Pays ne consomme aucune décision.

Ces indices proviennent du moteur déterministe existant. Le rework n’ajoute ni score de menace global, ni ressource fictive, ni horloge réelle. Une décision validée fait toujours avancer une période ; les règles de simulation sont inchangées.

## Références et portée de l’étude

L’étude est **documentaire** : lecture des présentations et inspection de captures officielles. Nous n’avons pas joué une session de Plague Inc. dans cet environnement. Les sources principales sont :

- [Plague Inc: Evolved — Steam, application 246620](https://store.steampowered.com/app/246620/Plague_Inc_Evolved/).
- [Plague Inc: The Cure — Steam, application 1472780](https://store.steampowered.com/app/1472780/Plague_Inc_The_Cure/).
- [Plague Inc: Evolved — Ndemic Creations](https://www.ndemiccreations.com/en/25-plague-inc-evolved).
- [Plague Inc: The Cure — Ndemic Creations](https://www.ndemiccreations.com/en/57-plague-inc-cure).

Les captures et leurs URL d’origine sont conservées sous `/workspace/mandats-plague-study/`, notamment `steam-0.jpg`, `cure-0.jpg`, `cure-1.jpg`, `steam-official-media.json`, `cure-official-media.json` et `study-and-design.json`. Les observations retenues concernent le plateau dominant, les actualités compactes, la visibilité simultanée des menaces et ressources, puis un écran stratégique présentant coûts et conséquences. L’interface conserve l’illustration de Mandats ; elle ne reproduit ni les valeurs, ni les hexagones, ni la vitesse de jeu de Plague Inc.

## Hypothèses écrites avant leurs correctifs

| Risque pour le joueur | Vérification E2E |
| --- | --- |
| Les six fronts restent cachés derrière un repli. | Les six sont simultanément visibles sur ordinateur, 390 px, 320 px et WebKit, dès l’entrée et pendant un menu. |
| Un compteur ou un indicateur de moyens devient décoratif. | Pression, stade, tendance et exécution utilisée/capacité/attente correspondent exactement à la partie reconstruite. |
| Consulter un secteur avance le temps ou ouvre un dossier absent. | Chaque front ouvre sa réponse disponible, sinon le Bilan ; choix et pressions restent inchangés. |
| Le HUD ne reflète pas l’accumulation ou la récupération. | Imports publics de deux préfixes légaux d’une trajectoire auditée ; aucune balance calculée n’est injectée. |
| Le menu tactique casse le clavier, la sauvegarde ou les délais. | Une activation clavier enregistre exactement un choix ; reprise identique, vrai chantier et délai consultables. |
| Le poste de commandement ou la caméra intercepte les repères. | Vrais clics sur les trois repères initiaux, puis les repères de la reprise tardive ; zoom, dépliage et inspection sans décision. Aucun `force: true` ni événement DOM artificiel. |
| Le briefing marine rend les actions d’accueil illisibles. | Créer une vraie sauvegarde, revenir à l’accueil, vérifier le contraste des textes/actions et reprendre les mêmes choix. |
| Pays reste au Bilan à cause d’un gestionnaire de navigation anticipé. | Vrais clics du pied de page Bilan → Pays, puis agenda et carte visibles, choix et pressions identiques. |

Ces hypothèses ont été consignées avant les tests et les corrections correspondantes, au fil des défauts reproduits. Elles portent sur les tâches du joueur ; elles n’imposent pas les coordonnées CSS de l’implémentation.

L’inspection peut déplier la carte et masquer volontairement le poste agenda. Le test exige alors un sujet fermé et une carte visible, plutôt qu’un agenda visible pendant le dépliage. Cette correction d’une hypothèse de test est explicite ; elle ne masque aucune interception de clic.

### Dernières hypothèses avant correction des alertes et petits écrans

- Une alerte d’échec de sauvegarde peut rester dans le poste agenda caché quand la carte est dépliée. Le parcours doit partir d’une vraie décision déjà sauvegardée, déplier la carte, ouvrir un repère et refuser uniquement l’écriture de la clé de partie au moment d’un second choix. L’alerte visible doit demander l’export ; le premier choix reste sur disque et l’export public doit contenir les deux choix de la partie encore en mémoire. Seule la panne de l’API de stockage est simulée, jamais un état de jeu.
- Les hauteurs minimales du HUD et du poste peuvent pousser la navigation sous un écran de 320 × 568. Un parcours compact doit atteindre intégralement Pays, Gouvernement, Projets et Bilan par leurs vrais boutons, sans débordement horizontal et sans dépenser de décision.

Le parcours d’alerte utilise Vue France après l’inspection ordinateur : celle-ci zoome réellement sur Rennes et peut laisser les trois repères prioritaires hors champ. Le bouton public remet la vue d’ensemble sans replier la carte ni avancer le temps. Cette préparation est ajoutée explicitement ; aucune assertion de sauvegarde ou de visibilité de l’alerte n’est retirée.

## Entrées et parcours reproductibles

La suite `site/tests/mandats-command.test.mjs` comporte désormais neuf parcours sur quatre formats, soit **36 vérifications configurées** : 33 actives et trois variantes volontairement ignorées pour le parcours 320 × 568 exécuté sur le projet compact uniquement. Elle conserve rapports, captures, traces d’échec, graine, entrées et état reconstruit sous `site/interface-artifacts/`.

Entrée : jeu national v14, graine 0, ambition équilibre. Les états avancés viennent de la trajectoire auditée `0-equilibre-late-rescue`, préfixes de 10 puis 26 décisions, importés par le contrôle public du jeu et reconstruits avec `storage.decode` :

- Au tour 10, trois fronts sont sous tension et la pression santé atteint 100.
- Au tour 26, la pression santé est de 84,393 avec une tendance en amélioration ; deux programmes attendent leur mise en place et l’exécution mobilise deux unités sur quatre.

Un autre parcours prend réellement le choix `n11-0-pressure-health-programme` : recrutement des équipes de soins, échéance minimale à la décision 4, six unités de travail restantes, capacité prévue +1,8 et fatigue −8. Son origine et son financement annoncé de 1,4 Md€ d’investissement et 3,2 Md€/an restent consultables. Ce sont des hypothèses de simulation.

Depuis `site/` :

```sh
MANDATS_CHROMIUM_EXECUTABLE=/usr/bin/chromium \
MANDATS_WEBKIT_EXECUTABLE=/workspace/mandats-browser-libs/run-webkit.sh \
npx playwright test --config playwright.command.config.ts
```

La suite cartographique `mandats-interface.test.mjs` protège désormais **explicitement v13**, via `playwright.interface.config.ts`. Ses assertions sont conservées ; seules la version d’entrée et l’URL ont changé de 14 à 13. La règle « premier choix entier sur le premier écran » a été explicitement révoquée pour v14 après le choix de la direction Plague Inc. Le menu v14 conserve les textes utiles et les coûts, avec son défilement interne et ses six fronts permanents. Il reste soumis au vrai parcours clavier, à la sauvegarde et à la reprise.

## Résultats bornés à ce stade

| Passe | Résultat observé et portée |
| --- | --- |
| Baseline avant le HUD | Quatre échecs sur quatre formats : aucun dock réunissant les six fronts. |
| Première compilation de commande | 16 parcours réussis, quatre échecs : repères interceptés sur téléphone ; attente d’agenda pendant une carte dépliée trop forte sur ordinateur, corrigée explicitement. |
| Premier correctif de composition | **20 parcours réussis**, sans test ignoré ou instable. Ce résultat précède les deux régressions supplémentaires. |
| Régressions supplémentaires sur 320 px | Deux échecs reproduits : Santé sous « Vue France » au tour 26 et textes d’accueil trop sombres. Leur correction est ensuite vérifiée dans la release ci-dessous. |
| Release locale `7cd48f82852e24f1` | **28 parcours v14 réussis** et **16 parcours v13 réussis**. Cela comprend les repères tardifs, le contraste d’accueil et la navigation Bilan → Pays, après leurs corrections. |
| Dernières régressions, build `5c1d42f6343f5b86` | Les deux défauts compacts sont reproduits rouges, puis leurs deux parcours ciblés passent : alerte complète visible et export réel à deux choix ; navigation intégrale sur 320 × 568. Captures inspectées. |
| Exécution complète après ces ajouts | 32 parcours réussis, trois variantes ignorées et un échec de préparation ordinateur : l’inspection de Rennes avait laissé tous les repères prioritaires hors champ. Vue France est ajouté comme vraie préparation ; nouvelle vérification ciblée et CI encore nécessaires avant de conclure sur les 33 cas actifs. |
| Contrôles locaux complémentaires | 1 082 tests unitaires existants, build complet et trois parcours de header réussis. La suite complète de pression reste en cours de vérification. |

Les résultats de la reprise ciblée, des suites requises et de la publication seront consignés après leur exécution dans le suivi de PR et les rapports associés. Les résultats ci-dessus ne constituent pas une preuve de déploiement ni une validation exhaustive de tous les états du mandat.

## Preuves conservées

| Dossier | Contenu |
| --- | --- |
| `site/interface-artifacts/command-before/` | Rapport rouge initial, captures et traces sur les quatre formats. |
| `site/interface-artifacts/command-after/` | Première suite commande, 16 réussites et quatre échecs. |
| `site/interface-artifacts/command-corrected/` | Rapport des 20 parcours réussis après le premier correctif. |
| `site/interface-artifacts/command-review/` | 18 captures indépendantes, états initial/accumulation/reprise et menus, sur 1672 × 941, 390 × 844 et 320 × 740. |
| `site/interface-artifacts/command-corrected-review/` | Nouvelle inspection des mêmes états, carte dépliée et accueil ; entrées, rectangles et vraies cibles de clic. |
| `site/interface-artifacts/command-release-review/` | Inspection de la release `7cd48f82852e24f1` : 27 vrais clics de repères réussis dans neuf états ; captures, version offline, assets et empreintes des sources. |
| `site/interface-artifacts/command-reliability-red/` | Deux régressions compactes : alerte invisible malgré export récupérable à deux choix, navigation coupée sur 320 × 568. Rapport, captures, traces et export conservés. |
| `site/interface-artifacts/command-reliability-green/` | Deux parcours compacts corrigés sur `5c1d42f6343f5b86`, alerte visible, export réel et navigation 320 × 568. Les deux captures sont inspectées. |
| `site/interface-artifacts/command-delivery/` | Exécution complète : 32 réussites, trois variantes ignorées et un échec de préparation ordinateur qualifié ci-dessus. |

Le clic Santé tardif est reproduit dans `command-corrected-review/compact-reprise-health-real-click.json` et sa capture : après chargement des fontes et deux images de stabilisation, le vrai clic est intercepté par `map-camera__overview`. Les couleurs d’accueil sont conservées dans `entry-colors.json`.

Les premières captures ont révélé un poste mobile recouvrant les repères, des annonces sur les commandes caméra et une illustration trop réduite dans son conteneur. Le correctif sépare désormais la carte et le poste sur téléphone, expose Déplier/Replier et tient compte des obstacles pour les repères. La contrelecture a vérifié ces améliorations, puis ajouté les deux régressions tardives ci-dessus. Aucun défaut de clic n’a été effacé par une modification de balance ou un nettoyage du stockage.

La dernière inspection indépendante est datée du **16 octobre 2026 à 09:36:53, heure de Paris**. Sur 1672 × 941, 390 × 844 et 320 × 740, les trois repères des états initial, accumulation et reprise reçoivent chacun leur vrai clic ; aucun point contrôlé n’est recouvert et aucune erreur JavaScript n’est relevée. Les textes d’accueil avec reprise sont désormais lisibles. Les coordonnées, entrées et métadonnées sont conservées avec les captures. Sur 320 px après une annonce, le petit poste nécessite un défilement interne pour atteindre son dossier ; le HUD et la carte restent accessibles.

## Limites et livraison

- L’illustration approuvée reste une source de **1268 × 801 pixels**. Ce rework ne crée pas un fichier maître Full HD.
- Les règles moteur ne changent pas ; les scénarios et sauvegardes restent reconstruits à partir de leurs entrées versionnées.
- La couverture visuelle reste bornée aux formats et trajectoires consignés. Les suites narratives, politiques, sociales, de pression et les contrôles requis du dépôt restent nécessaires.
- **CI, fusion et publication restent à vérifier.** Un build local ou une capture ne prouve pas la disponibilité du correctif sur le site public.

## Historique compact : composition cartographique écartée

La première passe du 16 octobre partait du commit `303f2fd`, avec un panneau ivoire et un parcours de carte inspiré de la référence illustrée et de pistes Mobbin. Huit vérifications initiales étaient rouges : les indicateurs précédaient les sujets, et le pied de page recouvrait le premier choix sur petit écran. La passe corrigée avait 16 parcours réussis et des captures réelles, mais le propriétaire a refusé cette direction et demandé Plague Inc. Elle ne constitue pas la cible du présent rework.

Les preuves restent dans `before/`, `after/`, `independent-review/` et `final-review/` sous `site/interface-artifacts/`. Le nom historique `final-review` précède ce refus et ne signifie pas que cette direction a été validée. La correction du contraste d’exécution, mesurée de 2,91:1 à 13,97:1 sur les caractères affichés, a été conservée dans les panneaux actuels.

## Validation locale de la version candidate

Le build `5c1d42f6343f5b86` conserve 1 082 tests unitaires réussis, le typage et la compilation complète. Les 16 parcours v13 et les trois parcours du menu partagé passent. La suite v14 finale a donné 32 réussites, trois variantes ignorées pour le seul écran court et un échec de préparation desktop : après une inspection zoomée sur Rennes, les trois repères prioritaires étaient hors champ. Le test revient maintenant par le vrai bouton Vue France, conserve l’assertion de carte dépliée et rejoue sans modification les contrôles de sauvegarde. Ce rejeu desktop passe (un parcours en 11 secondes). Les deux régressions ciblées compactes passent aussi. Les rapports `command-delivery`, `command-desktop-reliability` et `command-reliability-green` doivent être lus ensemble ; la CI réexécutera les 33 cas actifs sur le même commit.

L’alerte v14 se trouve dans le bandeau de situation persistant, hors du poste masqué. Sur les écrans portrait courts, le cadre peut défiler et sa navigation reste fixe ; ce repli est limité aux hauteurs inférieures ou égales à 650 pixels. La contrelecture des deux captures corrigées confirme le texte complet de l’alerte et les quatre commandes visibles à 320 × 568. La couverture reste celle de ces parcours et formats.
