# Pression du mandat : scénarios de validation

Cette liste précède l'implémentation de la campagne de pression v13. Elle décrit
des risques de jeu à observer dans de vraies trajectoires, pas des valeurs à
recopier depuis le moteur. Les hypothèses de simulation ne sont pas des données
observées sur la France.

## Échecs réalistes à rechercher

1. **Un pays qui attend le joueur.** Trente décisions sans réponse aux besoins
   existants ne produisent ni retard accumulé, ni échéance plus proche, ni
   complication perceptible.
2. **Une difficulté arbitraire.** Les mêmes crises surgissent aux mêmes moments
   quelle que soit l'anticipation ; une bonne intervention ne change jamais la
   trajectoire.
3. **Un financement pris pour une livraison.** Une mesure structurelle résout le
   besoin dès son vote, alors que le chantier ou les recrutements attendent encore.
4. **Un rejet qui finance quand même.** Le vote rejette une intervention, mais sa
   capacité, son projet ou son soulagement sont pourtant appliqués.
5. **Des promesses sans capacité d'exécution.** Lancer de nombreux programmes
   n'allonge aucun délai, ne crée aucun coût et ne présente aucun risque visible.
6. **Une spirale sans retour.** Une situation dégradée ne peut jamais être
   stabilisée par une réponse adéquate et livrée dans des conditions favorables.
7. **Une solution gratuite universelle.** Le secours temporaire remplace toujours
   un investissement durable, sans durée ni financement récurrent ; ou une seule
   idéologie constitue la seule stratégie viable dans tous les contextes.
8. **Une causalité perdue.** Une crise ou un projet livré n'indique plus la décision
   initiale ; une intervention nouvelle efface l'historique du besoin.
9. **Une pression rejouée deux fois.** Ouvrir un front, zoomer, exporter, recharger,
   importer ou préparer le mode hors ligne avance le calendrier, applique un coût
   ou fait varier le pays sans nouvelle décision.
10. **Un bilan annuel faux.** Des coûts transitoires sont annualisés plusieurs fois,
    une dépense d'investissement réapparaît tous les ans, ou la dette annuelle ne
    correspond plus au solde de financement.
11. **Des crises simultanées illisibles.** Le front le plus urgent est caché par un
    agenda tronqué ; une échéance devient invisible sur un écran de 320 px.
12. **Une fin sans conséquence.** Une rupture institutionnelle n'interrompt pas la
    campagne, ou la dernière décision livre des projets qui devraient attendre.

La frontière financière fait l'objet de cas séparés : un renfort qui expire
avant la clôture laisse une dépense acquise ; un renfort lancé pendant la
sixième période est réparti entre les deux années ; un rejet ne crée aucun
coût de ce renfort. Son taux annuel ne devient pas une charge structurelle.

## Échantillonnage reproductible

Le script `site/scripts/mandats-pressure-audit.ts` joue le vrai moteur depuis ses
entrées publiques (`start`, agenda, sélection, choix, `decide`). Il conserve seed,
version, stratégie, IDs de choix, votes, projets, finances et fronts par période.
Les stratégies utilisent les informations des choix disponibles ; elles ne
regardent pas les issues futures pour choisir rétrospectivement un gagnant.

La matrice couvre les trois contextes d'ouverture avec plusieurs seeds, les trois
priorités de mandat, la négligence, l'anticipation, les secours, la réponse
structurelle tardive, les engagements simultanés et des arbitrages budgétaires
opposés. Des branches locales explorent les alternatives réellement disponibles.
Chaque trajectoire est rejouée et réimportée depuis ses seuls choix. Les branches
illégales ou les états fabriqués ne constituent pas une couverture.

Les parcours Playwright complètent ces observations en passant uniquement par
l'interface : ordinateur, 390 px, 320 px, WebKit, clavier et animations réduites.
Ils retiennent captures, export, inputs et rapport. Une simulation en série ne
prouve pas à elle seule la lisibilité, la qualité visuelle ou la difficulté ressentie.

## Limite de la preuve

Cette exploration est bornée et recherche des classes de situations. Elle ne
prétend pas énumérer toutes les suites de trente décisions ni démontrer un
équilibrage parfait. Les écarts entre stratégies et les trajectoires difficiles
doivent servir à la boucle de revue, puis à des parties humaines.

## Résultats du moteur gelé, 15 octobre 2026

La matrice finale contient **72 parties**, soit **24 trajectoires physiques
distinctes** : trois seeds couvrant les trois ouvertures, huit stratégies, puis
les trois priorités de mandat. Les priorités modifient l'évaluation du mandat ;
elles ne constituent pas trois seeds indépendantes. Les stratégies secours et
délégation conservent strictement leur type de réponse sur les fronts persistants.
Les décisions institutionnelles restent traitées lorsqu'elles sont proposées.

Les 178 121 contrôles de cette matrice n'ont révélé aucune violation. Les SHA-256
des 17 modules du moteur sont identiques au début et à la fin. Les trajectoires
rencontrent 255 rejets parlementaires, 267 périodes d'exécution occupée avec des
programmes en attente et 264 périodes temporaires traversant une frontière
annuelle. La relecture indépendante des traces ne trouve aucune livraison avant
son échéance ou avant la fin du travail requis. Les 45 récupérations et les 27
trajectoires comportant plusieurs crises sont des observations de cet échantillon,
pas des fréquences estimées pour tous les joueurs.

L'exploration des contenus existants suit d'abord six seeds : **39 branches
légales**, 65 081 contrôles, aucune violation. Un second guide choisit les dossiers
écrits pour débloquer leurs suites, sur les seeds 0, 1, 2, 3, 4 et 5367. Il joue les
**13 branches complémentaires**, avec 24 996 contrôles et aucune violation. Le
complément vérifie les empreintes du premier rapport avant de commencer ; les
sources restent identiques après son exécution. Les **52 correspondances
explicites** entre contenus existants et besoins persistants ont ainsi toutes été
jouées. Ces deux explorations et la matrice représentent 124 parties ou branches
complètes et 268 198 contrôles, sans prétention d'indépendance statistique.

Les projets bloqués ou retirés et les fins institutionnelles anticipées ne sont
pas couverts par ces seuls échantillons. Une preuve séparée est nécessaire pour
les revendiquer. Les interactions candidates du catalogue de conception ne sont
pas transformées en fonctionnalités livrées par le seul nombre de contrôles.

Une recherche ciblée supplémentaire, conservée dans
`site/pressure-artifacts/targeted-project-failure.json`, a rencontré un vrai
blocage : seed 2, protection des établissements contre la chaleur financée à
la décision 14, puis bloquée à la décision 17 faute de capacité de service
(37/100 pour un minimum de 40). La crise institutionnelle a ensuite conduit à
une transition négociée à la décision 21. Le replay est identique et toute
décision après cette fin est refusée. Les entrées complètes figurent dans la
matrice versionnée. Cette preuve ne couvre ni la reprise ou l'abandon du projet,
ni les autres types de fin ; elle est distincte des 268 198 contrôles ci-dessus.

Les secours seuls restent une stratégie efficace sur cinq ans dans cet échantillon.
Ils consomment 86,7 à 100 % des décisions, ne créent aucune capacité durable et
laissent deux renforts actifs qui expirent aux périodes 31 et 32. Ces renforts
représentent encore 8,1 à 8,8 % de la capacité finale. Un faible niveau de pression
au dernier tour ne constitue donc pas le même héritage qu'une capacité permanente.
Cette rentabilité des secours reste une limite d'équilibrage à suivre.

Les preuves détaillées sont conservées sous `site/pressure-artifacts/` :

- `model-final/summary.json` : contrôles, empreintes, résultats et lacunes ;
- `model-final/trajectories.json` : entrées et états par période ;
- `model-final/review.json` : finances, pression, capacités durables et temporaires,
  coût en décisions et états aux périodes 12, 24 et 30 ;
- `authored-final/` : exploration séparée des contenus préexistants ;
- `authored-complement/` : les treize correspondances supplémentaires ; le champ
  `priorAuthoredMappings` permet de lire leur couverture avec le premier rapport ;
- `report.json`, `report/`, `results/` : véritables parcours navigateur, captures,
  exports et traces. Leur résultat doit être vérifié séparément du moteur.
- `replay-final/` : mandat complet et rejeu causal, relancés séparément avec le
  pilote optimisé, sans effacer les autres captures.

Les parcours navigateur valident les **11 cas actifs** : dix passent dans le lot
initial de vingt, avec neuf variantes délibérément ignorées. Le mandat complet
atteint trente choix et cinq clôtures, puis dépasse son ancien budget global de
trois minutes à l'entrée du rejeu. Une relecture inutile avant chaque choix a été
retirée du pilote ; le même parcours, avec toutes ses assertions et un budget
global de six minutes, passe ensuite en 1,9 minute. Les deux rapports restent
conservés. Les tests de contrôles et de persistance passent sur les quatre projets,
le vrai cycle hors connexion passe sur Android et le rétablissement scolaire après
accord social effectivement livré passe sur ordinateur.

Une première calibration a été interrompue après identification de secours trop
efficaces. Une seconde exploration mixte a révélé que le pilote « secours »
achetait parfois un programme par défaut ; le pilote a été corrigé et la matrice
finale rejouée entièrement. Ces essais exploratoires ne prouvent pas la version
finale. Les premières erreurs navigateur provenaient de l'hypothèse erronée qu'un
lien partagé crée déjà une sauvegarde avant son premier choix ; le contrat de
préservation de la sauvegarde locale a été conservé.

## Reproduire

Depuis `site/`, pour la matrice finale :

```sh
MANDATS_PRESSURE_SEEDS=3 MANDATS_PRESSURE_BRANCH_SEEDS=0 MANDATS_PRESSURE_AUTHORED=0 MANDATS_PRESSURE_OUTPUT=pressure-artifacts/model-final node --experimental-strip-types scripts/mandats-pressure-audit.ts
node --experimental-strip-types scripts/mandats-pressure-review.ts pressure-artifacts/model-final
```

Pour les contenus existants seulement :

```sh
MANDATS_PRESSURE_SEEDS=6 MANDATS_PRESSURE_BRANCH_SEEDS=0 MANDATS_PRESSURE_MATRIX=0 MANDATS_PRESSURE_OUTPUT=pressure-artifacts/authored-final node --experimental-strip-types scripts/mandats-pressure-audit.ts
MANDATS_PRESSURE_SEED_LIST=0,1,2,3,4,5367 MANDATS_PRESSURE_BRANCH_SEEDS=0 MANDATS_PRESSURE_MATRIX=0 MANDATS_PRESSURE_AUTHORED_GUIDE=authored-first MANDATS_PRESSURE_AUTHORED_PRIOR=pressure-artifacts/authored-final/summary.json MANDATS_PRESSURE_OUTPUT=pressure-artifacts/authored-complement node --experimental-strip-types scripts/mandats-pressure-audit.ts
```

Après le build, `npx playwright test --config playwright.pressure.config.ts`
exerce les vrais contrôles et les vrais choix sur ordinateur, 390 px, 320 px et
WebKit. Le mandat complet et le rétablissement de la capacité scolaire après
accord social sont joués une fois sur ordinateur ; le cycle hors connexion est
joué sur Android. Le rapport distingue ces cas des variantes délibérément ignorées.
