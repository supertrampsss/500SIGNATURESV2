# Refonte de l’interface du site — design validé

Date : 25 août 2026  
Statut : proposition consolidée, à valider avant plan d’implémentation

## 1. Ambition

Le site doit devenir l’endroit où un citoyen peut, dans un même produit :

1. comprendre rapidement les comptes publics français ;
2. diagnostiquer son territoire ;
3. vérifier une affirmation politique ;
4. éprouver les arbitrages budgétaires dans un simulateur mémorable.

La différenciation ne vient pas d’une accumulation d’effets ludiques. Elle vient d’une mise en scène claire des conflits entre objectifs, d’une conclusion facile à retenir et d’une preuve facile à retrouver.

La mise à jour de Septennats sert de référence pour ses mécaniques — dossier central, progression, décisions successives, conséquences différées — mais pas de modèle graphique à reproduire. Notre produit conserve une identité contemporaine, sobre et fondée sur les données.

## 2. Principes directeurs

### 2.1 Une conclusion avant le détail

Chaque page répond d’abord à une question en une phrase et quelques chiffres. Les explications, tableaux et sources suivent par niveaux de profondeur.

### 2.2 Une action principale par écran

Le premier écran ne doit jamais présenter plusieurs appels à l’action de poids équivalent. Les actions secondaires restent visibles mais calmes.

### 2.3 Mobile comme format de référence

Les contenus essentiels doivent être compréhensibles sans défilement horizontal. Dans le simulateur, la question, les deux options, leurs conséquences principales et les actions doivent tenir dans le premier écran mobile courant, hors petits appareils extrêmes.

### 2.4 La preuve à la demande

La source n’est ni supprimée ni déversée dans le contenu principal. Elle est accessible depuis chaque chiffre par une fiche de preuve normalisée : institution, série, millésime, périmètre, unité, formule, transformations et fraîcheur.

### 2.5 Une tension honnête

Le simulateur peut être dilemmique et polémique par les faits. Il ne doit pas présenter une conséquence éditoriale comme une mesure certaine, inverser l’ordre des choix ou employer des verbes différents entre la carte et les boutons.

## 3. Système visuel

### 3.1 Deux régimes, une signature

- Les pages d’information utilisent un papier clair, une encre bleu nuit et une structure éditoriale aérée.
- Le simulateur utilise une salle de décision bleu nuit et un dossier ivoire central.
- Les deux régimes partagent la même typographie, les mêmes couleurs d’accent, les mêmes motifs de dossier et la même présentation des preuves.

### 3.2 Palette fonctionnelle

- Bleu nuit : structure, navigation, autorité et environnement du simulateur.
- Ivoire : lecture longue, cartes de dossier et surfaces principales.
- Terre cuite : accent éditorial, alerte et contradiction.
- Vert profond : action positive ou option budgétairement favorable, jamais seul porteur du sens.
- Or : progression, moment de jeu et mise en évidence rare.

La couleur n’est jamais le seul moyen de distinguer un état. Icône, libellé ou motif l’accompagnent.

### 3.3 Typographie

- Spectral ou la sérif existante pour les titres, verdicts et montants structurants.
- Public Sans ou la sans-sérif existante pour navigation, libellés, données et textes fonctionnels.
- Une échelle typographique commune remplace les tailles ponctuelles page par page.

### 3.4 Composants communs

Le système repose sur un petit vocabulaire réutilisable :

- en-tête et navigation globale ;
- porte de parcours ;
- bloc « conclusion à retenir » ;
- carte de chiffre ;
- carte de dossier ;
- verdict qualifié ;
- fiche de source ;
- filtre en pastille ;
- barre d’action mobile ;
- tiroir de détails ;
- état vide, erreur, chargement et données périmées.

## 4. Navigation globale validée : « Un cap unique »

La navigation principale comporte quatre destinations stables :

- Accueil ;
- France ;
- Territoires ;
- Simuler.

Sur ordinateur, elles sont dans l’en-tête. Sur mobile, elles sont dans une barre inférieure respectant les zones sûres. « Analyses » n’est plus un silo concurrent : les analyses nationales vivent dans France et les analyses locales dans Territoires. Une entrée éditoriale dédiée reste possible depuis les pages concernées et la recherche.

Le simulateur peut masquer la navigation de site pendant une session, mais conserve une sortie explicite. Le retour ne doit jamais effacer une partie sans confirmation.

## 5. Accueil validé : « Trois portes, un même récit »

### Premier écran

1. Promesse : comprendre ce que racontent réellement les comptes publics.
2. Champ de recherche transversal.
3. Trois portes :
   - Comprendre la France ;
   - Explorer mon territoire ;
   - Prendre les commandes.
4. Une preuve de fraîcheur discrète : date de dernière mise à jour et institutions principales.

### Suite de page

- L’équation nationale du moment.
- Un dossier de vérification récent.
- Un diagnostic territorial contextualisé ou une invitation à choisir un territoire.
- Le défi du simulateur.
- Les nouveautés, reléguées après les quatre usages principaux.

La page ne doit plus ressembler à une longue juxtaposition de modules de même importance.

## 6. France / bilan national validé : « L’équation guidée »

Le bilan national commence par une formulation mémorable, par exemple : « Pour 100 € encaissés, la France en dépense 109,77 ». Elle est suivie de quatre questions :

1. Qu’est-ce qui entre ?
2. Où part l’argent ?
3. Pourquoi la dette augmente-t-elle ?
4. Quel verdict peut-on raisonnablement tirer ?

Chaque chapitre suit la même structure :

- une phrase à retenir ;
- deux à quatre chiffres essentiels ;
- une visualisation adaptée ;
- un lien « comprendre le calcul » ;
- les tableaux complets dans un niveau secondaire.

La page devient une histoire guidée. Elle conserve l’exhaustivité, mais ne l’impose pas avant la conclusion.

## 7. Territoires validé : « Briefing territorial »

Le premier écran d’un territoire contient :

- le nom et le périmètre exacts ;
- un diagnostic en une phrase ;
- quatre chiffres clés maximum ;
- la position relative face à des territoires comparables ;
- deux actions : comparer et simuler.

Le contenu détaillé est organisé par thèmes : budget, fiscalité, dette, services et trajectoire. Chaque thème présente un fait saillant avant ses graphiques.

La carte devient un outil de contexte et de changement de territoire, pas la surface dominante par défaut. Sur mobile, elle est repliée derrière « Voir sur la carte ».

La comparaison doit utiliser des pairs explicites et modifiables : même strate, population proche, département, région ou sélection manuelle.

## 8. Index des analyses validé : « Dossiers de vérification »

Chaque carte d’analyse expose avant le clic :

- l’affirmation contrôlée ;
- le nombre publié ;
- le verdict en une phrase ;
- le sujet, la date et le périmètre ;
- la fraîcheur des données.

Les filtres sont formulés dans le vocabulaire du lecteur. Sur mobile, les filtres secondaires passent dans un tiroir. Un état vide explique comment élargir la recherche.

## 9. Page d’analyse validée : « Le dossier de preuve »

La page suit cet ordre :

1. affirmation ou question contrôlée ;
2. verdict immédiat et qualifié ;
3. confrontation entre le chiffre affirmé et le chiffre effectivement publié ;
4. chemin de preuve en trois à cinq étapes ;
5. visualisation ou tableau utile ;
6. limites, réserves et variantes ;
7. source et reproduction du calcul.

Les verdicts ne sont pas réduits à vrai/faux lorsque le problème porte sur le périmètre, l’année, la comparaison ou l’interprétation. Les libellés possibles doivent rester stables : confirmé, ordre de grandeur correct, contexte manquant, périmètre trompeur, non démontré, contredit.

## 10. Sources et méthode validées : « Le registre des sources »

La page commence par une recherche et des filtres National, Territoires et Simulateur. Chaque résultat ouvre une fiche normalisée contenant :

- nom de l’indicateur ;
- statut : publié, provisoire, estimation ou règle de jeu ;
- institution et lien vers la publication primaire ;
- identifiant de série lorsque disponible ;
- date de publication et millésime ;
- périmètre et unité ;
- traitement appliqué ;
- formule reproductible ;
- date de dernière vérification ;
- pages du site qui l’utilisent.

Une introduction courte explique le parcours général de la donnée, mais le registre reste l’interface principale.

## 11. Simulateur validé : « Cabinet contemporain »

### 11.1 Entrée

L’entrée explique directement :

- le déficit à résorber ;
- le nombre de décisions ;
- la durée estimée ;
- ce que produit le résultat final.

Les engagements préalables restent supprimés. Le choix de durée comporte deux options cohérentes, sans barre décorative latérale. L’appel « Prendre mes fonctions » est centré.

### 11.2 Écran de décision : « Arbitrage éclair »

Sur mobile, l’écran est composé de trois zones :

1. bandeau de mission compact : déficit restant et progression ;
2. dossier : thème, question, tension en une phrase, deux options et conséquence principale ;
3. barre d’action fixe : exactement les mêmes verbes et le même ordre que les options.

Règles de contenu :

- une option tient en un titre, une conséquence budgétaire et une conséquence politique ou sociale ;
- les formulations « gagnants/perdants » ne sont affichées que si elles apportent une information supplémentaire ;
- les jauges complètes, hypothèses et sources sont dans des tiroirs ;
- « Chiffrage, hypothèses et source » n’apparaît plus comme une ligne vide ;
- la phrase « Chaque décision modifie le compteur… » reste supprimée ;
- l’ajournement est une action tertiaire stable ;
- aucun dialogue fugace après le clic.

La sélection est exécutée en un tap sur le bouton d’action. Une annulation persistante et discrète est disponible jusqu’à la décision suivante. Cela évite le double clic systématique tout en permettant de corriger une erreur.

### 11.3 Conséquences

Les réactions ordinaires modifient silencieusement les indicateurs. Une scène intermédiaire n’apparaît que lorsqu’un événement change réellement la partie : crise, rupture d’un soutien, palier majeur ou conséquence différée. Elle reste affichée jusqu’à une action explicite.

### 11.4 Conclusion

Le verdict final est organisé en cinq blocs courts :

1. résultat budgétaire et objectif atteint ou non ;
2. profil de mandat en une phrase ;
3. deux ou trois arbitrages déterminants ;
4. soutiens restants et crises déclenchées ;
5. rejouer, comparer ou partager.

Les détails des quinze choix sont repliés. Les décorations sans valeur explicative ne concurrencent pas le résultat. Le partage génère une carte lisible et une URL reproductible, sans paragraphe technique dans l’interface principale.

## 12. Mouvement et retour d’état

Le mouvement sert à expliquer la causalité :

- le compteur évolue après la décision ;
- la progression avance ;
- le dossier suivant remplace le précédent ;
- une jauge signale brièvement sa variation.

Pas de confettis systématiques ni de fenêtre qui disparaît avant lecture. Toutes les animations respectent `prefers-reduced-motion` et n’empêchent jamais une action.

## 13. Accessibilité et qualité d’usage

Objectif : WCAG 2.1 AA au minimum.

- zones tactiles d’au moins 44 × 44 px ;
- contraste vérifié dans les deux régimes visuels ;
- focus clavier visible ;
- ordre du DOM identique à l’ordre visuel ;
- libellés explicites pour les lecteurs d’écran ;
- graphiques accompagnés d’une conclusion textuelle et d’un tableau accessible ;
- navigation mobile compatible avec les zones sûres ;
- aucune information portée uniquement par la couleur ou le survol ;
- messages d’erreur proches du champ concerné ;
- états chargement, vide, indisponible et périmé prévus dès les composants.

## 14. Mesure du succès

Les changements seront évalués par :

- taux de démarrage puis de fin du simulateur ;
- abandon par dossier et temps par décision ;
- taux d’ouverture des preuves et des sources ;
- recherche ou sélection d’un territoire ;
- passage de l’accueil vers chacune des trois portes ;
- profondeur de lecture du bilan national ;
- partage ou nouvelle partie après le verdict ;
- erreurs d’interaction, retours arrière et annulations ;
- performance mobile et stabilité visuelle.

Les événements mesurent les actions, pas les opinions ni les choix politiques individuels sans consentement approprié.

## 15. Ordre de déploiement

### Lot 1 — Fondations et simulateur

- tokens, typographie, navigation et composants communs ;
- entrée, décision mobile, conséquences et verdict du simulateur ;
- instrumentation et tests mobiles.

### Lot 2 — Parcours principaux

- accueil à trois portes ;
- briefing territorial ;
- équation guidée nationale.

### Lot 3 — Preuve et profondeur

- index des dossiers de vérification ;
- page d’analyse ;
- registre des sources ;
- harmonisation des états secondaires et des tableaux détaillés.

Chaque lot est déployable séparément. Les anciennes routes et URLs partagées doivent rester compatibles ou être redirigées explicitement.

## 16. Critères d’acceptation de la refonte

- Un nouveau visiteur identifie les trois usages principaux depuis le premier écran de l’accueil.
- Sur mobile, une décision du simulateur est comprise et actionnable sans chercher les boutons.
- Le texte des boutons du simulateur correspond toujours aux options, dans le même ordre.
- Les réactions importantes persistent jusqu’à ce que l’utilisateur les ferme ou poursuive.
- Toute conclusion nationale, territoriale ou analytique expose sa source en deux interactions maximum.
- Les pages longues proposent une conclusion avant les tableaux détaillés.
- Les quatre destinations globales restent identifiables sur toutes les pages hors session immersive.
- Le site fonctionne au clavier, avec réduction des animations et sans dépendance à la couleur.
- Les performances et la lisibilité sont vérifiées sur les largeurs mobiles usuelles avant chaque déploiement.

