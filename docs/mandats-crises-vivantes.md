# Mandats : crises vivantes, 17 octobre 2026

Demande du propriétaire : pression rapide, crises qui surgissent sur la carte, réponses spécifiques et animations centrales. La carte approuvée reste le fond. Les exemples ImageGen sont une direction visuelle, pas des données.

## Contrat

Extension de la présidence v16 avant lancement public. Les journaux existants v16 se reconstruisent avec les nouvelles règles ; les versions 1 à 15 ne changent pas. Une période reste deux mois, 15 secondes à vitesse normale ; les alertes existent dès le lancement et d'autres fronts apparaissent dans les trente premières secondes. Seul `live-tick` avance le temps. Une échéance est exprimée en périodes simulées ; le compteur de secondes est sa projection selon la vitesse choisie et se fige en pause.

Les incidents possèdent une identité, une cause, une échéance, une aggravation, des réponses spécifiques et une éventuelle propagation. Les pertes de capacité et hausses de besoins entrent dans le calcul du retard, sans modifier définitivement les capacités structurelles. Une réponse est financée dans la réserve existante et attend les mêmes équipes que les autres programmes. Seule sa livraison contient ou résout l'incident. Une réponse temporaire expire et peut laisser revenir le problème. Résoudre l'incident conserve le retard acquis. Trois incidents simultanés au plus, un catalogue sans répétition par mandat et au moins deux périodes de répit après extinction du dernier foyer. Les ministres peuvent engager une réponse opérationnelle dans leur mandat, sans crédit gratuit ni vote fictif.

Les réponses sont identifiées par incident et option, les origines de propagation par ID d'incident. Les indices de journal et périodes sont distingués. Les animations n'engagent aucune transition. Elles traduisent apparition, aggravation, propagation, préparation, livraison, rétablissement. La carte est montée une seule fois. Les alertes sont accessibles par le clavier et les six secteurs ; une seule commande est ouverte. Sons désactivés par défaut, activables après interaction. Pause/onglet masqué/panne de sauvegarde suspendent aussi les animations ; mouvements réduits conservent les informations sans pulsations. Les montants et coefficients sont des hypothèses de simulation.

## Modes d'échec avant implémentation

1. Un ordre contient instantanément un incident, sans livraison ou avec crédits insuffisants.
2. Des clics répétés financent plusieurs fois la même réponse ; une réponse temporaire est présentée comme définitive.
3. Pertes d'incidents soustraites plusieurs fois, conservées après résolution, ou retirées des stocks hérités.
4. Propagation sans cause persistante, cycle infini, doublon d'incident ou incident déclenché par simple rendu.
5. Ministres dépensant au-delà de la réserve, hors délégation, ou doublant un programme déjà en préparation.
6. Import/replay divergeant à cause d'un tirage non déterministe, d'une horloge murale ou d'une confusion période/index du journal.
7. Les nouveaux événements saturent tous les fronts malgré les interventions, sans répit possible.
8. Animation de livraison avant livraison moteur, alerte disparue avant résolution, faux compte à rebours pendant pause.
9. Alerte masquée à 320 px, commandes inaccessibles, animation interrompue relançant une dépense, ou motion réduite ignorée.
10. Reprise d'onglet accélérant le temps ; échec de sauvegarde affichant un nouvel état non durable.

## Vérification prévue

Scénarios déterministes de financement, livraison, expiration/rechute, propagation, récupération, réserve et replay ; suite présidence et audit borné existants. Parcours navigateur au lancement, aggravation, réponses spécifiques, propagation, pause, motion réduite, clavier, mobile 390/320 px et WebKit. Captures et entrées conservées. Aucune prétention d'exhaustivité de toutes les suites de commandes.

## Résultats et revue

- `npm run check` : 1 086 tests et construction complète, dont pré-rendu, guides et précache, réussis. Une vérification des types et reconstruction du client ont suivi les corrections d'interface.
- Audit borné : 60 trajectoires complètes, 1 006 branches locales, 166 008 contrôles d'invariants, aucune anomalie. Les empreintes moteur sont identiques avant et après l'exécution.
- Les valeurs numériques v15 ont été extraites de `4c21961ac76802df192815a43fe951902eb5fd0f` dans une arborescence séparée, avant comparaison : six trajectoires et 118 périodes inchangées. La fixture compressée est conservée dans `site/tests/fixtures/presidency-v15-before-crises.json.gz` et relue par la CI.
- Nouveaux parcours : financement et livraison, propagation, pause, mouvement réduit, deux incidents concurrents du même secteur, focus clavier après commande. Les formats 1672 × 941, 390 × 844, 320 × 740 et WebKit sont couverts. Les rapports et entrées restent sous `site/crises-artifacts/`; les contrôles historiques sous `site/presidency-artifacts/`.
- Revue indépendante : correction de l'arbitrage ministériel qui ignorait un second incident dans un secteur déjà aidé, affichage immédiat du lien d'origine et retour du focus au secteur réellement commandé.
- Revue des limites : le nombre de trois foyers simultanés et les douze incidents sont des choix de scénario, pas une couverture exhaustive des crises d'un pays. Le rythme et les coûts demandent encore un retour de parties humaines. Les six villes restent des repères illustratifs de stocks nationaux.

Les essais initiaux sont conservés : une couche de carte interceptait les alertes et une entrée animée pouvait rester invisible en pause ; ces défauts ont été corrigés. Les parcours historiques ont été adaptés pour ouvrir puis parcourir les investissements généraux, désormais secondaires aux réponses spécifiques. Le fil ministériel reste visible sur téléphone même avec trois alertes. Une erreur d'archive de trace a entraîné le rejeu du parcours concerné, sans échec de ses assertions de jeu. Les rapports des phases sont séparés pour éviter leur écrasement.

La vidéo de démonstration utilise les entrées légales v16, graine 2, autonomie suspendue, vitesse ×2 puis accord sur les horaires du port. Les effets filmés viennent du moteur et des programmes réellement livrés. Les sons sont désactivés par défaut.

### Livraison vérifiée

Les 24 nouveaux parcours passent sur les quatre formats. Les 44 parcours actifs de la suite présidence passent également ; ses 12 exclusions restent celles prévues par la configuration, sans exclusion nouvelle pour cette refonte. La dernière correction mobile masque le bouton sonore pendant l'ouverture des commandes pour préserver la lecture et les cibles.

Sur trois graines supplémentaires de contrôle (0, 1, 2), une stratégie d'intervention durable termine les trente périodes et résout les huit incidents rencontrés, avec 2,38 à 2,77 Md€ de réserve restante. Ce contrôle borné confirme une sortie possible des crises ; il ne mesure pas la difficulté ressentie par des joueurs humains.

- [Avant, ordinateur](mandats-crises-vivantes/avant-ordinateur.png)
- [Après, propagation sur ordinateur](mandats-crises-vivantes/apres-ordinateur.png)
- [Après, téléphone WebKit](mandats-crises-vivantes/apres-mobile.png)
- [Vidéo de la partie réelle](mandats-crises-vivantes/mandats-crises.webm)
- [Empreintes et résumé de l'audit](mandats-crises-modele.json)

Un dernier parcours reproduit puis corrige la fermeture de « Développer ce secteur » lors du passage du temps. Les quatre formats conservent désormais l’ouverture et la position de lecture, sans suspendre le pays.
