# Mandats v13 : pression, arbitrages et rétablissement

Demande propriétaire du 15 octobre 2026 : travailler en boucle avec plusieurs agents pour retrouver une pression systémique comparable à celle étudiée dans *Plague Inc.*. La référence porte sur le rythme, l'accumulation et les arbitrages ; les règles sanitaires de ce jeu ne décrivent pas un pays.

Ce document fixe la cible et les conditions de validation. Il ne suffit pas à établir que chaque interaction décrite est déjà implémentée. La matrice [mandats-pressure-scenarios.json](mandats-pressure-scenarios.json) sépare inventaire existant, scénarios à vérifier et extensions encore à écrire. L'état de livraison doit être rempli à partir des résultats réels.

## Résultat attendu

Un dossier non choisi peut continuer de peser sur le pays. Lorsque les besoins dépassent durablement les moyens, le retard s'accumule, les capacités se fragilisent et plusieurs fronts se disputent nos ressources. Anticiper doit coûter moins cher ou préserver davantage de marge qu'attendre, dans un scénario identique. Une politique efficace doit aussi permettre un véritable rétablissement.

La pression ne vient ni d'un nombre arbitraire de cartes, ni d'une pénalité globale imposée à chaque année, ni du temps passé à lire. Des besoins tendanciels peuvent évoluer selon un calendrier écrit et indépendant des réussites du joueur. On doit pouvoir comprendre ce qui empire, pourquoi, quand et comment agir.

## Périmètre de la première boucle

- Nouveau moteur national v13 ; anciennes versions explicitement demandées conservées.
- Cinq années, six périodes par année, trente décisions au maximum ; fins politiques anticipées existantes conservées.
- Une décision validée avance exactement une période. Lire, choisir le dossier à ouvrir, zoomer, consulter un bilan, fermer l'onglet ou attendre hors connexion n'avance rien.
- Illustration 2D validée et interactions réelles ; aucun retour à une reconstruction 3D.
- Secteurs persistants et contraintes d'exécution articulés avec les comptes, projets, votes et mobilisations existants.
- Pas de nouvelle statistique présentée comme une observation de la France. Les indices, demandes, capacités, délais et coefficients du moteur sont des hypothèses de simulation identifiées.

Le contrat ne promet pas d'explorer toutes les séquences : même trente choix binaires produisent plus d'un milliard de trajectoires. La couverture recherchée porte sur chaque famille authored, chaque transition de pression, chaque type de contrainte et les interactions critiques identifiées. Les parcours explorés sont conservés avec version, seed, choix et résultat.

## État persistant

Chaque secteur expose au minimum : besoin entrant, capacité effective, retard cumulé, stade, tendance, date de la dernière évolution et causes. Les mesures financées conservent leur origine, leur délai et leur nature temporaire ou structurelle. Le retrait d'une carte de l'agenda ne supprime jamais cet état.

Règle de stock de départ :

`retard suivant = max(0, retard précédent + besoins de la période − capacité effective)`

Cette règle n'autorise pas à additionner des personnes, logements et heures de travail. Un secteur qui utilise un indice abstrait le dit explicitement et ne le transforme pas en quantité réelle. Fatigue, entretien, personnels et effets des autres secteurs ajustent la capacité selon des règles sectorielles documentées, avec bornes et sorties possibles.

Les stades doivent modifier ce que le joueur peut faire ou subir : surveillance, tension, perturbation, crise. Une hausse cosmétique d'une jauge jusqu'à 100, suivie d'une pénalité constante, ne suffit pas. Les seuils exacts restent des paramètres de simulation à vérifier avec des trajectoires contrastées.

## Trois natures de dossier

| Nature | Conséquence de l'attente | Exemple existant |
|---|---|---|
| Opportunité | Peut expirer sans punition générique ; le bénéfice potentiel n'est pas acquis. | Pilote de stockage d'énergie, amélioration d'un outil administratif. |
| Besoin structurel | Le besoin et le retard évoluent selon les moyens réellement disponibles. | Accès aux soins, logements, postes vacants, entretien du réseau. |
| Crise active | Une perturbation continue et peut atteindre un nouveau stade, avec avertissement et réponses adaptées. | Cyberattaque, blocage logistique, mobilisation, crise institutionnelle. |

Un dossier peut changer de nature par une transition calculée. Une opportunité devient un engagement seulement après une décision qui le crée. Son simple affichage ne constitue pas une promesse. Reporter doit avoir un horizon lisible ; déléguer doit employer une capacité ou une autorité identifiée. Le premier lot peut proposer un passage de période sans réforme si son coût d'opportunité et les dossiers qui progressent sont visibles.

## Trois contraintes distinctes

1. **Financement** : dépenses initiales, dépenses annuelles, recettes et perturbations temporaires entrent dans les comptes une seule fois. Une économie sur le papier ne recrute personne.
2. **Exécution** : personnels et coordination limitent le nombre ou la vitesse des programmes. Financer plusieurs projets simultanément peut créer une attente de mise en œuvre ; un projet livré libère les moyens temporaires qu'il occupait.
3. **Parlement** : le vote précède les effets d'application. Un texte rejeté ne crée ni capacité, ni financement, ni promesse tenue. La période s'écoule néanmoins et les fronts déjà ouverts évoluent.

Une contrainte peut être desserrée sans résoudre les deux autres. Une concession sociale financée n'efface pas instantanément une liste d'attente hospitalière. Les mobilisations conservent leurs acteurs, revendications et votes d'origine ; elles ne deviennent pas une jauge uniforme remplaçant les secteurs.

## Ordre et causalité d'une période

L'intégration doit choisir et figer un ordre déterministe des votes, effets immédiats, livraisons arrivées à échéance, engagements temporaires, évolution des secteurs, mobilisations et clôture annuelle. La restitution distingue la décision choisie de tout ce qui se produit pendant cette période.

Les liens entre secteurs utilisent une photographie commune des conditions de départ pour éviter qu'une boucle eau → santé → exécution ne soit appliquée plusieurs fois dans une même période à cause de l'ordre des tableaux. Une dépendance a une cause, un délai, une intensité bornée et une condition de sortie. Un choc identique à seed identique ne change pas parce que le joueur a simplement ouvert un autre dossier.

Chaque aggravation et chaque soulagement doivent être retraçables : condition héritée, événement extérieur, décision adoptée, projet livré ou mesure temporaire terminée. Les actions rejetées ne sont pas des causes d'effets qui supposent leur application. La fragilité politique et la perte de confiance peuvent suivre un rejet ; elles doivent être nommées séparément.

## Rétablissement et contre-jeu

- Un renfort temporaire achète du temps et annonce son expiration.
- Un programme structurel améliore la capacité après son délai et ses conditions réelles de livraison.
- Réduire ou abandonner un programme libère des contraintes d'exécution sans restituer des dépenses déjà engagées.
- Une négociation peut préserver une capacité ou un soutien avec une concession explicite ; elle ne remet pas indéfiniment le délai à zéro.
- Après stabilisation, le même problème ne crée pas immédiatement une alerte identique sans nouvelle cause.
- Aucun recul ne doit rendre tous les choix inopérants : maintien minimal, réponse limitée ou abandon honnête restent disponibles hors fin institutionnelle réelle.

La survie jusqu'au terme reste l'objectif existant. La pression sociale seule ne destitue pas le président. Le bilan présente aussi les retards restants, les capacités acquises ou perdues, la dette, les engagements et les réalisations ; il n'assimile pas survie et réussite économique.

## Interface à contrôler dans trois états

Les mêmes écrans doivent fonctionner au calme, avec plusieurs fronts qui empirent, puis pendant le rétablissement. Le résumé indique les fronts ouverts, ceux qui s'aggravent et la prochaine échéance. Les fronts affichent stade, tendance, cause principale et date prévisible, avec texte et icône en complément de la couleur.

Le plafond de trois sujets mis en avant peut rester une aide à la lecture, mais ne doit pas faire croire que les autres besoins ont disparu. Un accès compact permet de suivre les secteurs persistants. Sur 320 et 390 px, les choix, coûts et moyens d'action restent accessibles sans devoir parcourir plusieurs écrans d'historique. Le verdict reste bref, non modal et sans bouton Continuer obligatoire ; une trace durable explique ensuite la période.

## Validation bornée

La matrice associe les familles déjà écrites aux mécanismes et aux manques. Avant d'annoncer un scénario couvert, il faut retenir un parcours rejouable et constater ses assertions. Les parcours contrastés réutilisent le même seed et changent un ordre ou une décision identifiable.

Les contrôles bloquants portent sur : absence d'effet d'une loi rejetée, absence de temps réel caché, persistance des besoins, pressions simultanées, rétablissement possible, comptabilité sans doublon, bilan causal et égalité après export/import/rejeu/hors connexion. Les interactions non implémentées restent nommées comme telles. Une exploration automatique de nombreuses parties complète les parcours E2E ; elle ne prouve pas l'équilibrage de toutes les politiques.

## État de l'intégration

Première implémentation soumise à revue : six stocks concernent les soins, le logement, les transports, l'eau et l'énergie, les enseignements et les démarches administratives. Le modèle eau/énergie est agrégé ; il ne calcule pas séparément chaque réseau. Il conserve la demande entrante réelle de la période, la capacité effective après fatigue et perturbations, le retard et cinq stades : stabilisé, vigilance, tension, perturbation, crise.

Les dix dépendances écrites sont : logement vers soins ; transports vers soins, enseignements et démarches ; énergie vers soins, enseignements et transports ; démarches vers logement et énergie ; enseignements vers démarches. Elles lisent la période précédente et leur perte cumulée de capacité est plafonnée. Il n'existe pas encore de stock industriel, de simulation des stocks physiques d'un port ou de modèle de recrutement métier par métier. Les scènes industrielles conservent leurs effets financiers, sociaux et leurs projets existants ; leur simple présence dans la matrice ne crée pas ces sous-systèmes.

Le calendrier fixe huit perturbations finies, des besoins saisonniers et le profil suivant de besoin supplémentaire par période, au-dessus du besoin de base. Ce profil écrit s'applique aux cinq chapitres, indépendamment des choix. Il est borné à ces cinq valeurs et ne constitue ni une croissance démographique observée ni une génération de crise en réponse à une réussite.

| Secteur | Année 1 | Année 2 | Année 3 | Année 4 | Année 5 |
|---|---:|---:|---:|---:|---:|
| Soins | 0 | 0,4 | 0,8 | 1,2 | 1,6 |
| Logement | 0 | 0,25 | 0,5 | 0,75 | 1 |
| Transports | 0 | 0,2 | 0,4 | 0,6 | 0,8 |
| Eau et énergie | 0 | 0,15 | 0,3 | 0,45 | 0,6 |
| Enseignements | 0 | 0,1 | 0,2 | 0,1 | 0 |
| Démarches | 0 | 0,2 | 0,4 | 0,6 | 0,8 |

Les mesures utilisent une file commune de travail, avec un débit initial de quatre unités de mise en œuvre par période, réduit par une crise de gouvernement ou une administration en forte tension. Les projets narratifs utilisent la même allocation avant de déclarer une livraison, afin que le décor, les promesses et la nouvelle capacité restent synchronisés. Ce débit est une hypothèse de jeu, pas un effectif observé.

La revue croisée a entraîné des corrections concrètes avant validation : application des sacrifices de capacité des choix de maintien ; synchronisation des projets et de la file d'exécution ; lien explicite des réformes nationales avec les nouveaux secteurs ; restauration des postes scolaires à la livraison effective d'une suspension du regroupement ; désactivation des ouvertures de fronts indisponibles pendant une crise institutionnelle ; provenance des tournants de pression plutôt qu'attribution automatique au dernier clic. Une crise peut avoir plusieurs causes ; le replay retient une origine pertinente, sans prétendre fournir une attribution économique exhaustive.

Limite fonctionnelle connue : les projets narratifs existants conservent leurs actions d'abandon, mais un nouveau programme sectoriel déjà financé n'offre pas encore de commande générale d'annulation ou de changement de priorité de sa file. La cible de réduction du périmètre reste donc une extension, pas un contrôle livré. Les statuts de preuve restent dans la matrice jusqu'à exécution des parcours.

### Diagnostics de calibration retenus

Trois parcours légaux complets du moteur ont été conservés pour le seed 5367, priorité équilibre, version 13. Ils comparent négligence, anticipation et réponse tardive après douze périodes. Ce sont trois diagnostics ; ils ne remplacent ni la matrice multi-seeds, ni les parcours navigateur, ni des parties humaines.

| Résultat au terme | Négligence | Anticipation | Réponse tardive |
|---|---:|---:|---:|
| Pression soins /100 | 100 | 0 | 53,6 |
| Pression logement /100 | 100 | 0 | 81,7 |
| Pression enseignements /100 | 100 | 0 | 69,1 |
| Déficit annuel, Md€ | 143,1 | 161,3 | 171,6 |
| Dette, Md€ | 3 938,9 | 4 033,9 | 3 982,9 |

Les trois atteignent le terme. L'anticipation garde des services stabilisés avec davantage de dépenses ; une réponse tardive réduit la crise de soins mais conserve des retards ailleurs. Ces observations illustrent le contre-jeu et ses coûts sur ce seed, sans démontrer une stratégie dominante ni une difficulté universelle.

Un parcours ciblé supplémentaire, seed 0, a regroupé les classes puis financé la suspension : capacité d'enseignement 10,2 → 7,9 après le regroupement adopté, toujours 7,9 lors du financement de la suspension et à la période suivante, puis 10,2 à sa livraison effective en décision 4. La mobilisation est alors résolue, tandis que les enseignements en attente restent à rattraper. Le replay reconstruit le même état de pression. Les entrées et résultats sont associés au scénario P36 dans la matrice.

### Preuves moteur de la boucle finale

L'exploration stricte, rapport généré `site/pressure-artifacts/model-final/summary.json`, a exécuté 72 parties : trois seeds couvrant les trois contextes, trois priorités de mandat et huit stratégies. Elle a réalisé 178 121 contrôles sans violation constatée. Les 17 modules moteur suivis présentent les mêmes empreintes au début, à la fin et lors de la revue du rapport. Les priorités pondèrent le bilan ; une même stratégie peut donc conserver la même trajectoire brute sous plusieurs priorités. Ces 72 exécutions ne sont pas 72 mondes indépendants.

Les observations comprennent 255 rejets, 360 clôtures annuelles, 45 trajectoires avec récupération de pression, 27 avec crises simultanées, 264 périodes d'interventions temporaires franchissant une année et 267 périodes de contention d'exécution. Les neuf comparaisons seed/priorité donnent une pression moyenne finale de 83,85 à 90,34 sous négligence contre 0 sous anticipation, avec des réponses tardives intermédiaires sur cet échantillon. Les contrôles de reconstruction comparent les choix, comptes, événements, votes et états persistants après replay et import.

Le lot ciblé, rapport généré `site/pressure-artifacts/authored-final/summary.json`, a joué 39 branches correspondant à 39 des 52 couples authored reliés aux secteurs, avec 65 081 contrôles et aucune violation. Le complément `site/pressure-artifacts/authored-complement/summary.json` a joué les treize couples restants avec 24 996 contrôles sans violation. L'union vérifiée couvre donc 52 couples sur 52, sans doublon entre ces deux lots. Les 17 empreintes sont identiques entre les lots et les fichiers relus. Avec la matrice des stratégies, cela représente 268 198 contrôles moteur sans violation constatée. Les projets bloqués ou abandonnés et les fins de démission, destitution ou rupture ne sont pas apparus dans ces échantillons ; ils exigent des preuves séparées.

Ces répertoires sont des artefacts générés et ignorés par Git. Les [commandes de reproduction et emplacements des preuves](mandats-pressure-validation.md#reproduire) permettent de les recréer ; les rapports navigateur sont aussi conservés comme artefacts CI. La matrice versionnée retient les empreintes, résumés et entrées des diagnostics ciblés, afin que les chemins locaux de provenance ne soient pas nécessaires à leur reproduction.

Ces résultats valident des propriétés moteur et des trajectoires bornées. Les sept scénarios d'interactions candidates P17 à P23 ne deviennent pas des sous-systèmes complets du seul fait qu'une interaction voisine apparaît dans les six secteurs.

Un parcours ciblé supplémentaire a rencontré un projet de protection des établissements contre la chaleur bloqué à la décision 17, puis une rupture négociée du mandat à la décision 21. Le replay reconstruit la même fin et aucune décision supplémentaire n'est acceptée. Ses entrées figurent dans la matrice. La reprise ou l'abandon du projet ainsi que les autres types de fin restent à vérifier séparément.

Le lot navigateur de pression a validé onze cas actifs : ouverture et lecture sans temps dépensé, coûts complets, navigation, attente de livraison et persistance sur bureau, 390 px, 320 px et WebKit ; préparation puis décision hors connexion sur Android ; restauration des postes scolaires après accord exécuté ; trente décisions, cinq clôtures et replay causal sur bureau. Neuf variantes ont été volontairement ignorées selon la répartition des parcours. Le test long a d'abord dépassé son délai global de 180 secondes, puis passé en 114 secondes lors du rejeu ciblé avec un plafond de 360 secondes. Les rapports générés `site/pressure-artifacts/report.json` et `site/pressure-artifacts/replay-final/report.json` doivent être lus ensemble ; le premier conserve ce dépassement initial.

La collision d'un marqueur sur petit écran a été corrigée : le placement est recalculé après le chargement des polices, le contrôle de la carte est traité comme un obstacle et la carte repliée conserve 164 px de hauteur. Le nouveau parcours ciblé a passé sur le site reconstruit : aucune collision avant ou après le chargement retardé des polices et après le dépliage/repliage, sans avancer la partie. Il est reproductible depuis `site/` avec `npx playwright test --config playwright.rework.config.ts --project compact --grep "compact markers avoid one another"` après le build. Le journal local `/workspace/mandats-v13-font-built.log` est une provenance de cette exécution, pas un fichier requis pour rejouer le contrôle. La preuve du défaut corrigé ne remplace pas les suites complètes carte et pression ni les contrôles CI finaux, encore en cours à ce stade.

Limite d'équilibrage observée : les renforts temporaires sont financièrement avantageux dans certaines stratégies. Ils peuvent contenir la pression en mobilisant 26 à 30 décisions, sans augmenter la capacité durable. La durée, le coût d'opportunité et l'expiration constituent leur contrepartie actuelle ; l'échantillon ne démontre pas encore qu'ils ne dominent aucune stratégie d'investissement. Ce point relève d'une prochaine calibration, sans le dissimuler derrière l'absence d'erreur technique.
