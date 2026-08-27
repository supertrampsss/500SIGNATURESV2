# Simulateur V3 : boucle de campagne jouable

Date : 27 août 2026

Objectif : remplacer les interludes génériques de la préversion V3 par une boucle de campagne causale et lisible, sans rendre la V3 route par défaut.

## Contraintes

- conserver les 96 décisions et les huit chapitres ;
- ne jamais altérer une sauvegarde V2 ;
- ne publier aucun cadratin dans les nouveaux rendus ;
- conserver le header du site et la coque V3 validée ;
- rester utilisable à 320 px et prendre 390 px comme référence ;
- toute crise doit citer sa cause et toute concession doit modifier une décision confirmée ;
- les écrans restent persistants jusqu'à une action du joueur.

## Lot 1 : orchestrer la sortie d'une décision

Fichiers :

- `site/src/simulateur-v3/flow.ts`
- `site/src/simulateur-v3/flow.test.ts`

Travail :

1. Résoudre les événements et promesses dus après une décision.
2. Afficher un événement différé avant le Conseil ou la fin de chapitre.
3. Détecter une crise après les conséquences différées.
4. Reprendre ensuite la transition normale : décision, Conseil, fin de chapitre ou verdict.
5. Tester les priorités et l'absence de double application.

## Lot 2 : rendre la crise réelle dans le scénario publié

Fichiers :

- `site/src/simulateur-v3/scenario.ts`
- `site/src/simulateur-v3/scenario-crises.ts`
- `site/src/simulateur-v3/scenario-crises.test.ts`

Travail :

1. Programmer une conséquence différée traçable dans le premier chapitre.
2. Définir une crise de rejet politique liée à la flat tax dès le premier euro.
3. Proposer le maintien du cap et une suspension qui annule réellement l'effet budgétaire principal.
4. Tester les références, les effets et l'absence de cadratin.

## Lot 3 : remplacer les interludes génériques

Fichiers :

- `site/src/simulateur-v3/render.ts`
- `site/src/simulateur-v3/render.test.ts`
- `site/src/styles/simulateur-v3.css`

Travail :

1. Rendre le Conseil avec quatre familles de situation et les causes récentes.
2. Rendre l'événement différé avec la décision d'origine et ses effets.
3. Rendre la crise avec le déclencheur, les facteurs aggravants et les choix.
4. Rendre la fin de chapitre avec bilan, gagnants, perdants et contradiction.
5. Rendre un verdict final narratif sans score idéologique unique.
6. Ajouter les états focus, mobile, impression et réduction des animations nécessaires.

## Lot 4 : journal et pause

Fichiers :

- `site/src/simulateur-v3/render.ts`
- `site/src/simulateur-v3/controller.ts`
- tests associés

Travail :

1. Ouvrir le journal depuis Pause sans modifier la phase persistée.
2. Lister les arbitrages, leur statut et les crises qui les ont modifiés.
3. Revenir au menu Pause puis reprendre exactement l'écran précédent.
4. Ajouter recommencer avec confirmation explicite et stockage V3 uniquement.

## Lot 5 : contrôleur complet

Fichiers :

- `site/src/simulateur-v3/controller.ts`
- `site/src/simulateur-v3/controller.test.ts`
- `site/src/main.ts`

Travail :

1. Brancher la résolution des conséquences, crises et transitions.
2. Brancher les choix de crise et les événements analytics existants.
3. Conserver le scroll, la sauvegarde et la reprise.
4. Vérifier que quitter mène toujours à `/bilan`.

## Lot 6 : vérification et livraison

1. Exécuter les tests V3 ciblés.
2. Exécuter `npm test` puis `npm run build`.
3. Contrôler au navigateur : décision, événement, Conseil, crise, Pause, journal, fin de chapitre et verdict.
4. Contrôler 320 px, 390 px et desktop sans débordement horizontal.
5. Fusionner sur `main`, pousser, attendre CI et déploiement.
6. Contrôler la production sur `/simulateur?version=3`.
