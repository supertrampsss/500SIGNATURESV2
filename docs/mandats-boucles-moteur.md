# Boucles de décision v16 : règles et vérification

17 octobre 2026. Complément moteur au plan mobile. Les chiffres sont des paramètres de jeu, pas des prévisions politiques.

## Défaillances définies avant modification

Le fichier `site/src/mandats/presidency-loops.test.ts` a été écrit avant le moteur. Les quatre cas échouaient alors : répétition d’un accord gouvernemental refusé au même état ; absence de nomination distincte après accord ; deux réformes abandonnées bloquant la file ; absence de report sauvegardé. Ces tests isolés vérifient aussi les commandes dupliquées qu’une protection d’interface pourrait masquer. Les parcours navigateur complètent la preuve sur le résultat perçu.

## Gouvernement

Une proposition de cohabitation est un accord soumis à l’Assemblée, pas une nomination. Le même accord ne peut être proposé deux fois dans la même période. Après un rejet, un compromis différent conserve les moyens de fonctionnement et engage une charge annuelle de 0,2 Md€ ; le résultat du vote peut différer car la proposition change. De nouvelles consultations peuvent reprendre à la période suivante. La dissolution conserve ses contraintes existantes.

Un accord adopté enregistre un candidat de gouvernement. L’acte distinct `live-cabinet-appoint` crée une identité et une période d’entrée en fonction, restaure la capacité gouvernementale, puis disparaît. Un accord devenu caduc lorsque la crise change ne peut plus être utilisé. Aucune règle des versions 1 à 15 n’est modifiée.

Reproduction légale : graine 7, initiatives suspendues, neuf périodes ; accord de cohabitation rejeté (250 contre 293), compromis de services publics adopté (357 contre 192), puis nomination unique. L’ancien parcours acceptait treize répétitions du même rejet à cette période et augmentait la tension à chaque clic.

## Réformes et suivi

Une proposition reste cinq périodes à l’ordre du jour. Un report explicite, possible une fois, la suspend deux périodes et fixe une nouvelle échéance. Une proposition abandonnée expire ; elle ne bloque plus le renouvellement. Un retrait ferme le dossier pour le mandat. Le rejet retire seulement l’orientation tentée ; les autres orientations reviennent après une période de consultation. Aucun effet de texte rejeté n’est engagé.

Les propositions suivantes sont choisies parmi les dossiers encore éligibles selon la pression du secteur et une variation déterministe. La cadence est de deux ou trois périodes, avec deux dossiers ouverts maximum. Les dossiers sans effet sectoriel explicite restent des opportunités parlementaires nationales. Ce n’est pas une simulation régionale.

Les programmes en préparation et ceux livrés depuis au plus une période produisent des événements de suivi, avec travail restant et progression calculée. Un programme livré ne signifie pas que son arriéré est résorbé. Les effets immédiatement applicables d’une réforme sont nommés comme tels, sans fausse étape de chantier.

## Budget et commandes de carte

Une réserve basse ou une crise dont aucune réponse disponible n’est finançable ouvre un événement budgétaire. Les mêmes arbitrages sont accessibles dans le détail du gouvernement pour anticiper, sans ajouter une alerte budgétaire à chaque ouverture de partie. Une autorisation supplémentaire reste soumise au vote, une fois par année ; aucun crédit n’est créé par un ministre. Un redéploiement annuel permet aussi de reporter 0,8 Md€ d’investissement général vers les interventions : le montant est retiré de l’investissement et les actifs publics perdent un point. Il ne crée aucune recette ; un second clic est refusé. Une autre commande diffère les nouveaux engagements ministériels, sans arrêter les chantiers déjà financés. Un cinquième test, écrit puis vu échouer avant ajout de ce redéploiement, vérifie sa conservation budgétaire et son unicité. Le gouvernement et son autonomie ont un événement de carte ; les priorités s’appliquent directement au secteur par la commande existante. Les engagements déjà financés continuent si l’autonomie est suspendue.

`presidencyFeedback` expose un résultat enregistré distinct : adopté, rejeté, engagé, livré ou information. Le retour d’un vote comporte ses voix. Une commande reçue n’est pas une livraison.

## Directeur et branches

Voir `mandats-directeur-failure-modes.md` : saison, pression, mémoire sectorielle et prévention influencent le tirage ; certaines crises proposent une troisième réponse aux coûts et équipes différents. Une mobilisation civile peut reculer si les causes ont été traitées au lieu de monter obligatoirement jusqu’à une révolution. Une crise institutionnelle déjà ouverte n’est pas effacée par une accalmie sociale.

## Audit conservé

`site/scripts/mandats-loops-audit.ts` écrit `mandats-loops-audit.json` : 24 graines et quatre politiques, soit 96 parcours complets, avec commandes rejouables et empreintes des sources. Il vérifie la conservation de l’état après export/replay et l’absence de réserve négative. Sur ce lot : 24 défaites par inaction, 24 mandats achevés par résolution, 24 avec secours temporaires et 24 en traitant aussi les réformes. Les tests ciblés du moteur totalisent 16 cas passants.

Ces résultats ne prouvent pas l’équilibre : le secours temporaire financé reste une stratégie de survie très efficace. Le catalogue local est encore limité à douze types, chacun tiré au maximum une fois par mandat. La variété tient aux causes, au rythme, aux réponses et à leurs conséquences, pas à une génération illimitée de scénarios. La validation visuelle et mobile est rapportée séparément.

Audit borné requis exécuté sur les mêmes sources : 69 trajectoires, 652 branches, 140 420 invariants, zéro problème ; sources inchangées pendant le calcul. Le témoin v15 conserve ses six trajectoires et 118 périodes. Audit d’escalade existant : 16 parcours passent sans adaptation de ses règles ni assertions. Rapports conservés dans `mandats-mobile-boucles/model-report.json` et `mandats-mobile-boucles/escalation-journeys.json`. L’audit 96 parcours a exercé 257 votes rejetés, aucune commande bloquée inattendue, et de 6 à 14 propositions de réforme vues par parcours.
