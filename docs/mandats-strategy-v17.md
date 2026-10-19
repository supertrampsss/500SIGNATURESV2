# Mandats : stratégie présidentielle v17

19 octobre 2026. Le brief du propriétaire valide une refonte complète. La carte
existante reste le support ; les règles des versions 1–16 restent disponibles.

## Contrat avant implémentation

- Trente périodes de deux mois. Initialement 40 secondes, la période est ramenée
  à 30 secondes à x1 après recette, soit quinze minutes actives ; lecture
  détaillée, pause et onglet masqué suspendent
  le temps. Aucun rattrapage au retour. Les ordres ne consomment pas de période.
- Pays et cabinet constitués dès le départ. Trois moyens principaux : autorisation
  de dépense, exécution partagée, soutien politique. Les montants et coefficients
  sont des hypothèses de jeu, distinctes des comptes observés.
- Les ministres assurent les opérations ordinaires sous consignes persistantes.
  Les dépenses et livraisons passent par le même registre et la même file que les
  décisions présidentielles. Une réussite opérationnelle laisse un répit réel.
- Les renouvellements sont délégués et regroupés. Lorsque les secours ne peuvent
  plus rétablir le service, un arbitrage structurel remplace la répétition du petit
  choix. Les compétences et limites ministérielles sont déterministes et visibles.
- Six chaînes sectorielles : alerte, accumulation, organisation, conflit, arbitrage
  national. Les étapes dépendent des besoins, retards, fatigue et engagements,
  jamais d'une obligation de cliquer ni d'une catastrophe imposée après réussite.
- Deux voies durables au moins, capacité et organisation/accord : délais, charges,
  équipes, risques et possibilités différentes. Leur livraison transforme les
  risques, les options et les interactions avec les autres secteurs.
- Objectifs visibles, état des services séparé de leur pression, engagement et
  livraison séparés. Le temps achevé ne vaut pas victoire. Un bilan catastrophique
  ne devient jamais favorable grâce à des indicateurs secondaires.
- Réformes toujours consultables avec leurs conditions ; carte et six secteurs
  toujours accessibles. Action courante : contexte puis commande explicite, sans
  confirmation générale ni fenêtre obligatoire à fermer. Priorités persistantes.
- Sauvegarde canonique avant affichage ; version 17 explicite dans exports, liens,
  replay et archives. Une sauvegarde incompatible est signalée sans remise à zéro.

## Responsabilités de code

- `presidency-strategy-content.ts` : chaînes et transformations des six secteurs.
- `presidency-strategy-types.ts` et `presidency-strategy-engine.ts` : simulation,
  ministères, engagements, progression, objectifs et résultat.
- `presidency-api.ts` : façade des règles v16/v17 pour les vues communes.
- `presidency-view.ts`, `presidency-runtime.ts`, styles propres v17 : présentation,
  commandes, objectifs, comparaison et horloge. Aucune règle dans les animations.
- `engine.ts`, stockage, partage et sessions : sélection de version et reconstruction.

## Défaillances à vérifier avant livraison

1. Inaction : les résultats dépendent des services et du cabinet, pas des clics.
2. Cas ancien graine 47 : quatre pressions 100 et révolution active ne deviennent
   pas une réussite dans le nouveau bilan. La v16 conserve son résultat historique.
3. Secours récurrents : aucune notification identique obligatoire en boucle ; les
   dépenses restent réelles et une limite opérationnelle appelle une transformation.
4. Un ordre ne livre pas des moyens immédiatement ; une équipe n'est jamais utilisée
   simultanément au-delà de la capacité ; les coûts ne sont ni effacés ni doublés.
5. Prévention utile : une bonne décision peut éviter une étape et créer du calme.
6. Deux stratégies gagnent depuis le même départ, avec des compromis observables.
7. Une décision tardive et une correction restent possibles avant les échecs annoncés.
8. Transformation livrée : effet durable, options modifiées et risque réellement réduit.
9. Début et fin proposent des arbitrages différents, au-delà d'un changement de prix.
10. Aucun vote refusé ne finance la proposition ; une négociation ne se rejoue pas
    gratuitement ; une double activation ne duplique pas un engagement.
    Lois et demandes de crédits partagent un passage parlementaire par période,
    accepté ou rejeté. Les économies et charges des transformations physiques
    commencent à la livraison effective, jamais au seul vote du financement.
11. Les vitesses produisent les mêmes états aux mêmes périodes ; pause, reprise,
    cache hors connexion, import et replay reconstruisent exactement les entrées.
12. Ordinateur 1672 × 941, mobile 390 px, compact 320 px et WebKit : commandes,
    coût, délai, effet, focus et gravité lisibles. Captures réellement inspectées.

## Preuves attendues

Conserver une première séquence de trois minutes puis des mandats complets avec
entrées, graines et résultats. Distinguer audit technique, parties jouées par les
agents et essais de joueurs externes. Aucun essai externe n'est disponible au départ.
Rapports et captures sous `site/strategy-artifacts/`. Les limites de l'exploration
et les paramètres finaux seront consignés après les parties réellement exécutées.

## Paramètres et hypothèses retenus

- Autorisation initiale : 18 Md€, sans création de recettes ; une demande de
  10 Md€ par année est soumise à un vrai vote. Réaffectation d'investissement
  général : 1,2 Md€ au plus une fois par année, avec actifs −1.
- Quatre unités d'exécution partagées. Le secteur prioritaire reçoit les équipes
  en premier au prochain passage du temps ; les autres peuvent attendre. Dans
  chaque groupe, l'ordre reste chronologique, y compris lorsque des ordres sans
  effet matériel allongent le journal. Aucune équipe ni période n'est créée.
- Chaque ministère peut préparer une organisation courante durable, selon sa
  compétence et son plafond annuel. Sa charge commence à la livraison ; aucune
  convention identique n'est rachetée à chaque incident.
- Capacité et organisation traitent des causes différentes. Les coordinations
  ne deviennent disponibles qu'après une transformation réellement livrée et
  affectent aussi d'autres secteurs. Accords et rattrapages sont finis.
  Le premier chantier conserve un bénéfice propre ; 1,5 unité de gain est
  portée par la coordination ultérieure. Une route complète conserve son gain
  nominal, sans imposer un chantier propre dans chacun des six secteurs.
- Au départ, deux ou trois secteurs sont fragiles selon le contexte. La charge
  supplémentaire déjà connue est affichée ; elle progresse entre P4 et P28.
  Les profils des six secteurs diffèrent entre les trois contextes initiaux.
  Les secteurs initialement solides ont 1,2 unité supplémentaire de charge
  finale annoncée. Ce profil dépend du départ, jamais des réussites ultérieures.
- Alerte à partir de 22 de pression, accumulation à 35, organisation à 52 ou
  quand les opérations déléguées atteignent leur limite. Un conflit exige
  pression ≥72 et fatigue ≥22 ; l'arbitrage national exige pression ≥85 et
  trois périodes de tension. Ces seuils sont des hypothèses, pas des données.
- Compromis de gouvernement : 0,35 Md€ d'investissement, 0,2 Md€/an après
  livraison, une équipe pendant au moins deux périodes, +18 appuis à livraison,
  deux engagements au maximum sur le mandat. Les sièges et les appuis sont
  affichés séparément.
- Réussite finale : au moins cinq secteurs à pression ≤45, tous strictement
  sous 65 ; retards totaux au plus égaux au départ ; déficit annuel au plus
  égal au déficit hérité ; cabinet en fonction et appuis ≥30.
- Trois secteurs à pression ≥85 en fin de partie imposent un échec. Une rupture
  institutionnelle ne peut pas être compensée. Quatre secteurs à pression ≥90
  pendant trois périodes ouvrent une fenêtre de redressement de trois périodes ;
  si quatre services restent critiques à son terme, le mandat peut finir tôt.

## Défauts effectivement révélés pendant la recette

- Une seule réorganisation de soins suffisait sur les premiers profils trop
  stables. Les charges héritées ont été rendues explicites et différenciées,
  sans catastrophe ajoutée après une réussite ni quota d'ordres à remplir.
- Plusieurs lois pouvaient se succéder sans temps et économiser les postes
  avant leur suppression effective. Un passage parlementaire par période et
  l'acquisition des charges/économies à livraison corrigent ce raccourci.
- Les index de journal non complétés triaient le programme 10 avant le 2 : des
  bascules neutres de priorité changeaient les livraisons. Le correctif v17 et
  sa comparaison sur six périodes sont désormais dans l'audit permanent.
- Sur 320 × 568, les explications repoussaient les prix hors du panneau. Les
  deux approches sont présentées côte à côte ; les causes détaillées restent
  consultables. Les prix, charges, délais et effets restent avant la commande.
- Les essais de navigateur ont aussi reproduit un double engagement par
  déplacement d'un bouton sous le pointeur, ainsi qu'une perte de focus après
  vote dans le Cabinet. Les preuves avant correction sont conservées.
- Deux mandats complets ont révélé une fin creuse : les derniers ordres acceptés
  étaient à P9, puis vingt et une périodes restaient sans nouvel arbitrage.
  Les propositions fiscales à P12 étaient rejetées dans les deux parties.
  Le second équilibrage répartit les gains entre premiers chantiers et
  coordinations, face aux charges connues ; il n'ajoute pas de catastrophe
  pour annuler une réussite. Une bonne anticipation peut encore produire du calme.
- Une faible réserve suffisait à afficher « décision à prendre », même lorsque
  tout était rétabli. L'alerte exige désormais une action utile, non financée et
  bloquée seulement par les crédits, sans réponse structurelle déjà en préparation.
- L'actualité conservait une ancienne initiative sans date. Elle affiche les
  changements du dernier passage du temps, sinon l'état réel du pays. Le Cabinet
  conserve l'historique daté. Les comptes clos portent leur année ; l'objectif
  financier emploie la prévision de l'année qui commence, sans modifier les livres.
- La revue a trouvé des messages hérités de hausse de besoins par chapitre,
  alors que la v17 utilise son propre profil annoncé. Ces faux motifs sont exclus
  de son historique ; les anciennes versions conservent leurs causes et leurs stocks.

Les captures, vidéos et journaux d'agent constituent des observations de travail,
pas des retours de joueurs externes. Les tests ne prouvent pas que le jeu est amusant.

## Recette de la version gelée

Actif des deux parties complètes : `mandats-CXHsy8iH.js`. Les derniers correctifs
de présentation remplacent la promesse « services rétablis durablement » par
« Les objectifs du mandat sont atteints », présentent le financement comme une
option et retirent le reçu positif lorsqu'un autre contexte est ouvert. Les
erreurs et refus restent visibles ; aucune règle numérique n'est modifiée.
Les paramètres détaillés de chaque action sont
dans [le catalogue du moteur](../site/src/mandats/presidency-strategy-content.ts).

Deux mandats ont été joués dans l'interface depuis la graine 47, avec horloge de
navigateur contrôlée, trois premières périodes à ×1 puis ×4. Il s'agit de parties
d'agent, sans mesure de durée ni retour d'un joueur externe.

| Parcours réel | Résultat | Dernier ordre / livraison | Retards finaux | Déficit année 5 | Appuis |
| --- | --- | --- | --- | --- | --- |
| Capacité, ordinateur 1672 × 941 | Réussite, 4/4 objectifs | P16 / P19 | 11,95 contre 30,9 hérités | 136,09 Md€ | 61,26 |
| Organisation puis capacité Transports, mobile 390 × 844 | Réussite, 4/4 objectifs | P24 / P26 | 8,09 contre 30,9 hérités | 137,86 Md€ | 48,26 |

La première voie accepte une tension Transports finale de 31,69/100 pour conserver
ses crédits ; elle réussit sans fondation propre dans ce secteur. La seconde
finance des transformations et deux compromis politiques, subit un refus de
crédits, puis engage une capacité Transports en année 5 devant des besoins de
13,4 contre 12,33 de capacité effective. Elle devient donc hybride, sans être
présentée comme une voie organisation pure. Les deux parcours utilisent une
réaffectation réelle d'investissement, avec son sacrifice d'actifs.

Le rythme reste variable : après sa dernière livraison, le parcours capacité
conserve onze périodes de maintien ; le parcours hybride en conserve quatre.
Ces parties ont été jouées à 40 secondes par période (respectivement
7 min 20 / 1 min 50 et 2 min 40 / 40 s, à ×1 / ×4). Après cette observation,
la période passe à 30 secondes : ces mêmes segments correspondent désormais à
5 min 30 / 1 min 22,5 et 2 min / 30 s. Cela raccourcit le maintien sans changer
les trajectoires, et le plateau reste une limite à éprouver auprès de joueurs.
Aucune nouvelle catastrophe n'est ajoutée pour remplir une phase calme.

Preuves durables : [entrées capacité](mandats-strategy-v17/capacity-inputs.json),
[entrées organisation hybride](mandats-strategy-v17/organisation-hybrid-inputs.json),
[coordination sur ordinateur](mandats-strategy-v17/desktop-coordination.png),
[arbitrage mobile en année 5](mandats-strategy-v17/mobile-arbitrage-annee5.png),
[bilan complet](mandats-strategy-v17/bilan-organisation-hybride.png).

L'[audit canonique](mandats-strategy-v17/audit-model.json) vérifie 138 539 invariants
sans anomalie : 36 trajectoires, quatre observations à un ordre, quatre branches
de loi, 114 branches locales et les régressions de file et de priorités. Les deux
voies gagnent depuis 0, 1, 2 et 47 ; l'inaction ne gagne pas. Les 585 états des
treize trajectoires historiques restent identiques au témoin avant refonte.

L'[extension à 19, 143 et 9999](mandats-strategy-v17/audit-holdout-initial.json)
conserve explicitement son **échec de critère** : la même politique ne produit pas
deux voies gagnantes sur deux de ces trois départs. Les 73 689 contrôles ne
révèlent aucune anomalie technique ; cette politique ignore la réaffectation
d'investissement. Des [branches distinctes après refus budgétaire](mandats-strategy-v17/holdout-adaptive-redeployment.json)
emploient cette option existante et gagnent pour capacité 19 et organisation 143.
Capacité 143 reste mitigée après quatre refus parlementaires. Aucun seuil,
paramètre ou premier résultat n'a été modifié pour annoncer un holdout vert.
Ce diagnostic ne prouve ni l'impossibilité de gagner autrement, ni une réussite
garantie sur chaque graine et chaque ambition.
