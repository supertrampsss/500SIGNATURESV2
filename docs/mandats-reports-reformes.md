# Mandats : reports visibles et accès aux grandes réformes

Demande du 16 octobre 2026 : les reports semblent sans conséquence et les grandes réformes sont enfouies derrière les urgences. Le diagnostic légal v14, graine 0, montre que douze reports des soins augmentent le retard de 7,3 à 31,711 et la pression de 26,483 à 100. La présentation du verdict reste générique. Après seize reports, les réformes existent toujours dans le moteur, mais disparaissent des trois repères prioritaires et restent dans « Autres dossiers », sous le défilement de la console mobile.

## Cible et limites

- Accès national permanent, hors du contenu replié et du défilement des urgences ; ouverture de la réforme réellement disponible, avec les prochaines réformes authored identifiées comme à venir. Aucun faux dossier de loi immigration : le contenu existant concerne les conditions de résidence pour certaines aides.
- Après chaque report : évolution chiffrée du retard, total, fatigue et stade ; trace persistante. Le temps de lecture ne coûte aucune période. Attendre un programme déjà financé doit être présenté comme une mise en œuvre en cours.
- Les nouvelles parties v15 peuvent proposer un rattrapage dimensionné au retard réel en perturbation ou crise. Son financement, sa charge d’exécution et sa livraison sont réels. Il doit rattraper davantage de travail après davantage d’attente, sans pénalité forfaitaire par clic ni effacement magique de tous les retards. Les règles explicites v13/v14 restent celles publiées.
- Les six fronts et les quatre commandes de navigation restent accessibles ; carte illustrée approuvée et composition Plague Inc conservées.

## Hypothèses de défaillance écrites avant les correctifs

1. Après seize reports légaux, la réforme pensions n’est pas directement accessible à 320/390 px ou sur ordinateur ; l’ouverture et la fermeture consomment du temps.
2. Une vraie réforme ne fait pas progresser la chaîne nationale ou les réformes retraites/résidence sont inventées, perdues ou faussement annoncées comme toutes disponibles.
3. Trois reports réaffichent un verdict générique sans retard ajouté/total ; le niveau 100 masque un retard qui continue d’augmenter.
4. Attendre une mesure financée est assimilé à de la négligence ; un secteur stabilisé reçoit une punition artificielle.
5. Un rattrapage apparaît au calme, coûte la même chose quelle que soit la file, améliore un stock avant livraison ou double les crédits d’un programme déjà préparé.
6. Une loi rejetée livre malgré tout le rattrapage ; les dépenses temporaires persistent après expiration ou sont facturées deux fois.
7. Import/rechargement/rejeu/hors connexion donnent d’autres reports, programmes, coûts ou réformes ; les règles publiées v13/v14 changent.
8. La nouvelle entrée nationale masque les repères, les coûts, les six fronts ou la navigation sur petit écran/WebKit.

Les preuves seront des parcours E2E réels et des audits de trajectoires bornés, avec entrées, captures et rapports conservés. Cette liste ne revendique pas toutes les séquences possibles du mandat.

## Régressions observées pendant la revue

La première inspection de la bande nationale révèle deux points avant leur correction : le nettoyage des flèches colle les valeurs (« pression 100100/100 »), et à 320 × 740, après seize reports légaux des soins, le zoom intercepte le repère transports et ce repère recouvre celui de l’enseignement. Deux parcours ciblés exigent des transitions écrites lisibles et un véritable clic sur chacun des trois points. Leurs captures et traces rouges sont conservées séparément avant reconstruction.

## Hypothèses explicites du rattrapage v15

Le renfort temporaire vise au plus six périodes de la capacité courante en retard. Sa capacité supplémentaire couvre le déficit de capacité de la dernière période plus un quart du retard ciblé, avec un minimum égal au renfort simple du secteur et un maximum de douze unités. Il fonctionne quatre périodes après livraison. La préparation prend deux périodes, ou trois quand la cible dépasse trois périodes de capacité. La charge d’exécution vaut l’arrondi supérieur de la cible divisée par deux périodes de capacité, borné entre un et trois ; les équipes sont partagées avec les autres programmes.

L’investissement de mobilisation utilise 35 % du coût par unité de capacité du programme structurel du secteur. Le fonctionnement temporaire utilise 150 % du coût par unité du renfort simple, facturé pendant les périodes réellement actives. Tous ces coefficients sont des hypothèses de jeu ; ils ne sont ni des rendements officiels, ni une garantie de résorption. La fatigue, les incidents et les nouvelles demandes restent effectifs. Le programme n’efface aucune file à son financement.

## Entrées et premières reproductions

Préfixe reproductible : version nationale explicite, graine 0, priorité équilibre, puis `n11-{tour}-pressure-health-maintain` pour les tours 0 à 9 ou 15. La v14 n’offre pas de rattrapage. En v15, `n11-10-pressure-health-recovery` est adopté : investissement 2,293 Md€, taux temporaire 1,895 Md€/an, capacité supplémentaire 8,424, préparation deux périodes et charge deux unités par période. Le financement est la décision 11 ; la livraison intervient à la décision 13 dans cette trajectoire. Le renfort fonctionne pendant les décisions 13 à 16 puis expire à 17 ; la capacité retrouve exactement 10,1. Le retard passe de 31,711 avant livraison à 11,916 à la dernière période active.

Après seize reports du même secteur, le rattrapage proposé au seed 0 demande 3,267 Md€ d’investissement, 2,7 Md€/an temporaire, trois périodes de préparation et une charge de trois unités. Avec le même préfixe, graine 7, le texte est rejeté (251 pour, 292 contre) et ne crée aucun programme. Ces entrées sont conservées sous `site/pressure-artifacts/deferral-diagnosis/`.

La suite `playwright.reports.config.ts` configure sept parcours sur quatre formats : 22 cas actifs et six variantes ignorées, réservant la branche de rejet à l’ordinateur et la régression des repères au format compact. Les rapports sous `site/reports-artifacts/` distinguent la baseline sans correctif, la première passe, les régressions révélées par la revue et la validation après correction. Le workflow CI conserve les rapports et réexécute la suite sur la version proposée. L’audit de modèle cible maintenant v15 et ajoute une stratégie de rattrapage après négligence ; une exécution explicite v14 garde ses huit stratégies historiques.

## Validation locale avant proposition

`npm run check` réussit : 1 082 tests existants, types et build complet. Les deux défauts initiaux sont rouges sur le bundle publié avant correction. La première passe du nouveau parcours valide 19 cas et relève deux échecs de lisibilité des transitions, avec trois variantes ignorées ; l’inspection indépendante ajoute le cas des points compact. La suite du plateau existant donne 32 réussites et un échec de placement au tour 26, avec trois variantes ignorées. Les captures et traces de ces phases restent conservées.

Le build `52b55657197bdd7d` corrige le nettoyage des transitions et retire une réserve vide sous les points compacts, sans réduire les cibles de 48 pixels ni masquer de repères. Les deux parcours ciblés report/pins tour 16 passent ; la régression existante du tour 26 passe également. Les suites complètes seront rejouées par CI sur le commit proposé avant fusion. L’audit v15 et la revue finale des captures sont encore en cours à ce stade ; ce document local ne constitue pas une preuve de déploiement.
