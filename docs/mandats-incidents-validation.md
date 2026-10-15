# Mandats v14 : crises actives ignorées

## Défaut reproduit avant correction

Sur la version 13 publiée, seed 1, priorité équilibre, neuf décisions de maintien des démarches font apparaître « Le port bloque les approvisionnements ». En continuant le maintien aux décisions 10 à 14, le dossier expire avec un événement de poids nul. Aucune perturbation portuaire n'est enregistrée dans le secteur transports. Seed 0 : la cyberattaque hospitalière apparaît au tour 15 puis disparaît après le tour 19, sans incident persistant ni cause cyber dans les soins.

Les parcours réels et observations sont conservés dans `site/pressure-artifacts/global-qa/ignored-crises.json`. La liste de choix du premier parcours est `n11-{tour}-pressure-administration-maintain` pour chaque tour de 0 à 29. Cela contredit le contrat de pression : une crise active peut durer et atteindre un nouveau stade ; son dossier ne devient pas une occasion facultative par simple attente.

## Hypothèses de défaut à couvrir avant le code

1. Une crise annoncée disparaît après cinq décisions sans réponse ; le stock ne conserve aucune perturbation associée.
2. Ouvrir le dossier, lire ou recharger l'onglet déclenche une perturbation sans décision.
3. Une réponse rejetée supprime la crise, ou une restauration seulement financée rétablit déjà le service.
4. Les réserves temporaires résolvent définitivement un port bloqué, ou leur expiration exige de payer une seconde fois une dépense déjà acquise.
5. Une réponse permanente déjà financée peut être revendue pendant sa préparation ; une réponse adoptée mais bloquée supprime quand même la crise.
6. La sauvegarde ou le replay perd les incidents et leurs causes ; modifier les règles publiées invalide les entrées historiques v13.

## Règles de correction

La nouvelle règle est réservée à v14. Les entrées v13 conservent leur agenda et leurs résultats. Les incidents cyber/hôpital et port/approvisionnements commencent au passage d'une décision où le dossier est présent. L'inspection seule ne modifie aucun état.

L'incident actif diminue la capacité effective du secteur associé. Une réponse de secours opérationnelle peut contenir la perte sans restaurer les installations. Une restauration vérifiée des systèmes ou un accord portuaire réellement mis en œuvre clôt la perturbation. Les réserves contiennent deux périodes ; à leur terme la perturbation revient si aucun accord durable n'est opérationnel. Un rejet ne crée aucun programme et ne contient rien.

Ces pertes de capacité, délais et unités sont des hypothèses de jeu, jamais des statistiques françaises. Les retards acquis restent dans le stock après la résolution. Aucun malus générique de confiance n'est ajouté pour l'expiration d'un dossier.

## Vérifications à conserver

`tests/mandats-incidents.test.mjs` parcourt l'import d'entrées légales, la lecture sans temps, l'attente prolongée, un renfort temporaire, son expiration, une réponse durable, sa livraison, puis le rechargement. Les rapports et captures sont produits sous `site/incidents-artifacts/`. Les parcours moteur complémentaires retiennent les choix, votes, incidents, projets et capacités. Leur couverture reste bornée.

## Parcours moteur complémentaires

Les pertes sont bornées à 1,8 unité/période pour la cyberattaque active et 1,6 pour le blocage portuaire actif. Le fonctionnement de secours conserve respectivement 0,6 et 0,4 unité de perte. Il s'agit de coefficients de scénario explicites ; leur effet sur la difficulté complète reste à calibrer avec des parties humaines.

Les branches légales retenues sous `site/pressure-artifacts/global-qa/` ont vérifié :

- `incidents-model.json` : seed 1, trois réponses portuaires. Réserves opérationnelles aux décisions 10–11, retour de la perturbation active à 12 ; accord financé à 10, opérationnel à 11 ; flux alternatifs opérationnels à 11, perturbation contenue avec perte résiduelle. Les trois replays sont égaux aux trajectoires jouées.
- `incidents-cyber.json` : seed 0, trois réponses cyber. Mode de secours et transferts contiennent à la décision 17 ; une restauration financée à 16 mais bloquée à 18 conserve la perturbation active. Les trois replays sont égaux.
- `incidents-project-remediation.json` : sur cette restauration bloquée, une reprise rejetée à 19 ne change ni le projet ni la perturbation. Dans la branche alternative, un abandon adopté à 19 annule le programme sectoriel et conserve la cyberattaque. Aucun supplément de capacité ne provient du chantier abandonné. Les replays sont égaux.
- `incidents-restoration-success.json` : seed 0, renforts de soins aux tours 2, 5, 8, 11 et 14, puis restauration cyber au tour 15. Le projet reste financé aux décisions 16–17 et devient livré à 18 ; l'incident se résout à la même transition. Le replay est égal.

Une vérification supplémentaire a superposé des flux alternatifs permanents et des réserves temporaires. Lorsque les réserves expirent, les flux restent opérationnels et l'incident reste contenu ; il ne repasse pas à tort au statut actif. La résolution durable conserve les retards accumulés.

## Première boucle navigateur

La suite dédiée a validé neuf cas actifs et ignoré trois variantes volontairement réservées au bureau : les deux parcours portuaires sur Chromium bureau, Android 390 px, compact 320 px et WebKit iPhone ; les branches de reprise rejetée et d'abandon du projet cyber sur bureau. Rapport initial `site/incidents-artifacts/report.json`, journal `/workspace/mandats-incidents-after.log` : neuf réussites, aucun échec, 4 min 30.

Les captures des quatre compositions ont été ouvertes et inspectées : choix et coûts lisibles, aucune largeur dépassant l'écran. Cette inspection a aussi montré que le résumé d'incident était repoussé dans « Voir les détails ». Un résumé visible avant les cartes a ensuite été ajouté par la revue globale ; la suite vérifie désormais explicitement le statut actif ou contenu et sa perte de capacité. La dernière reprise sur le build complet doit confirmer ces assertions et le libellé corrigé « Reporter sans nouveau crédit ».
