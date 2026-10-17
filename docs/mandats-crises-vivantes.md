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
