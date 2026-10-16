# Mandats v16 : présidence vivante

Décision du propriétaire du 16 octobre 2026 : remplacer la succession de questions par une simulation qui avance avec le temps et un gouvernement autonome. Les maquettes **2 + 4** sont validées : carte de propagation, six secteurs visibles, fil des initiatives gouvernementales et commandes directes depuis un lieu. Cette décision remplace, pour v16, les anciennes consignes interdisant l'horloge et les vitesses. Le propriétaire a validé la réalisation ; aucune nouvelle confirmation de direction n'est nécessaire.

## Boucle à réaliser

- Le temps simulé avance par périodes déterministes, indépendamment des clics. Un mandat dure cinq ans. Pause et vitesse sont immédiatement accessibles ; quitter l'onglet suspend l'horloge, sans rattrapage à la reprise.
- Les six stocks de besoins, capacité, retards et fatigue évoluent sur l'horloge. Les liens entre secteurs ont des causes écrites ; la carte les représente seulement lorsqu'ils agissent réellement.
- Le Président donne des ordres et des priorités persistantes. Le gouvernement prend des initiatives opérationnelles dans une enveloppe limitée et utilise la même capacité d'exécution que les commandes du joueur.
- Aucun ministre ne crée de crédits ou d'équipes, ne paie deux fois un programme, n'applique un texte rejeté ou ne réforme automatiquement la fiscalité. Les grandes réformes restent disponibles à l'initiative du joueur, avec leur vote et leurs effets réels.
- Les coûts, délais, enveloppes et critères d'autonomie sont des hypothèses de simulation documentées. L'enveloppe de commandes est une autorisation limitée de dépense, pas la trésorerie des administrations publiques. Les dépenses engagées alimentent les comptes nationaux du jeu.
- Une sélection sur la carte, puis une commande : aucun formulaire ni confirmation intermédiaire. Les informations n'exigent aucun acquittement. Les grands menus suspendent la simulation pendant leur lecture.
- Le pays reste visible avec ses initiatives, difficultés, livraisons et récupérations. Pas de file obligatoire « À traiter » ni de bouton répétitif « Reporter ».
- Une partie est reconstruite depuis sa version, sa graine et son journal d'ordres et de périodes. Les états importés et les soldes ne sont jamais pris comme autorité. Les journaux restent bornés.
- Sauvegarder avant de publier chaque transition. Un échec de stockage suspend le temps, conserve la dernière partie durable et affiche une erreur récupérable. Un lien partagé ne remplace pas la sauvegarde locale avant adoption explicite.
- Préserver les versions explicites 1 à 15, les anciennes scènes et les parcours communaux. La v16 constitue le nouveau lancement national lorsque les contrôles passent.

## Modes d'échec écrits avant implémentation

1. Un clic, une ouverture ou une fermeture avance le pays ; les ministres avancent chacun une période ; un minuteur déclenche artificiellement un choix « reporter ».
2. Plusieurs ordres dans la même période créent des équipes, appliquent une livraison ou clôturent l'année plusieurs fois.
3. L'onglet masqué, la lecture d'un grand menu ou une erreur de stockage laisse l'horloge tourner ; reprendre rattrape silencieusement le temps écoulé.
4. Les commandes dépassent les crédits, un ministre dépense hors mandat, une commande répétée finance deux fois le même renfort ou un texte rejeté engage ses effets.
5. La livraison, les dépenses temporaires et leur expiration se décalent avec le nombre de clics, ou divergent entre le journal, la carte et les comptes.
6. Le pays ne fait rien sans clic, ou l'autonomie joue toute la partie sans arbitrage utile. Une priorité différente doit pouvoir changer une trajectoire réelle.
7. Une propagation est dessinée sans perte de capacité correspondante ; un ministre annonce une action qu'il n'a pas financée ; un chantier visuel livre avant son état moteur.
8. Des crises en cascade deviennent irrécupérables pour toutes les stratégies ; la récupération n'accorde aucun répit réel.
9. Rechargement, export, import, replay ou hors connexion changent le journal, les coûts, les votes, le mandat des équipes ou les stocks.
10. Une ancienne sauvegarde est migrée silencieusement, une ancienne règle change ou un défi partagé écrase la partie locale par son horloge.
11. Le repère ou ses commandes sont masqués à 320 px, le menu bloque la navigation, une cible dépend du survol ou les six secteurs disparaissent.
12. Le rendu est déclaré conforme sans inspection réelle des formats ordinateur approuvé, 390 px, 320 px et WebKit, ni comparaison avec les maquettes 2 + 4.

## Preuves attendues

Une minute de partie sans clic doit produire des transitions et initiatives effectives. Des ordres du Président doivent engager leurs coûts sans avancer le calendrier ; la livraison attend l'horloge et les équipes. Les essais doivent comparer autonomie, priorités, interventions, budgets épuisés, refus parlementaires, pause/reprise, double clic, import/export, stockage refusé et ancienne partie. Conserver entrées, rapports, captures et traces. L'audit reste borné à ses scénarios ; il ne prouve pas toutes les suites d'ordres possibles.

## Réalisation et preuves locales

La nouvelle présidence utilise `presidency-engine.ts` pour les règles et `presidency-runtime.ts` pour l'horloge du navigateur. `Game.turn` compte seulement les trente passages du temps ; `choices` et `history` conservent chaque ordre et chaque période. Le replay sélectionne un index du journal et compare des états au même point du calendrier. Les données importées sont recalculées depuis ces entrées.

Le fond livré est une illustration native de **1672 × 941 pixels**, convertie en WebP ; ce n'est pas un master Full HD ou 4K. Les villes sont des repères illustratifs des six secteurs nationaux, sans prétendre simuler leurs propres stocks territoriaux. Les liens de propagation proviennent des pertes de capacité effectivement calculées. Sur téléphone, un cadrage rapproché conserve les six repères, et « Vue France » montre le pays entier.

- `npm run check` : 1 082 tests existants, vérification des types et construction complète réussis.
- `presidency-artifacts/model/report.json` : 60 trajectoires complètes, 963 branches locales et 144 087 vérifications d'invariants ; aucune anomalie et aucun changement de source pendant l'audit. Six trajectoires v15, totalisant 120 périodes, conservent exactement leurs valeurs de référence.
- La trajectoire de récupération `seed=0`, autonomie suspendue, finance un renfort lorsque les soins atteignent 94,979 de pression et 28,729 unités de retard. La livraison ramène la pression à 48,072 puis à 20,325 ; le retard repart à la hausse après expiration. Ce répit vient de la capacité livrée, sans remise à zéro des stocks.
- `presidency-artifacts/defaults-final/` : les quatre parcours modifiés de lancement, guide et sauvegarde v15 passent sur les quatre formats (16 essais).
- `presidency-artifacts/replay-browser/` : branche avant l'ordre d'index 3, restauration exacte de l'origine, lien de dilemme protégé pendant une minute puis adoption du bon préfixe. Les captures, la trace et les entrées sont conservées. `replay-review/` conserve aussi les huit cartes de partage inspectées.

Les premiers rapports sont conservés : trois assertions navigateur ont été ajustées à la commande retirée après engagement et à l'échantillonnage de l'horloge de 100 ms. Le parcours d'import historique attend maintenant la fin réelle de l'import avant de lire le stockage. La revue visuelle a aussi relevé des flèches Unicode manquantes, une étiquette sous le fil et l'absence des comptes annuels dans Gouvernement ; ces défauts sont corrigés sans changer les règles. La nouvelle illustration manquait à la liste de précache : elle rejoint explicitement les 36 ressources hors connexion.

La suite `playwright.presidency.config.ts` conserve les entrées, captures et traces sous `presidency-artifacts/after/`. Elle couvre 44 parcours actifs sur quatre formats ; les 12 exclusions configurées évitent de répéter sur chaque navigateur les trajectoires politiques et de fin complètes ainsi que le cycle de service worker. Le workflow « Mandats living presidency » rejoue cette suite et l'audit du modèle à chaque PR, en parallèle des contrôles historiques. Le résultat exact et les liens des exécutions sont consignés dans la PR.
