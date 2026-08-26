# Refonte éditoriale du bilan France — « Le verdict d’abord »

Date : 26 août 2026

Statut : direction validée, prête pour plan d’implémentation

## Décision

La page France adopte la direction **01 — Le verdict d’abord**. Elle ne se présente plus comme une succession de tableaux de bord et de blocs repliables, mais comme une analyse éditoriale courte : une conclusion nette, son calcul visible, puis les explications qui la démontrent.

La page territoriale perd parallèlement son grand bloc de briefing supérieur, puisque ses informations sont déjà expliquées plus bas dans la page.

## Problème à résoudre

La page actuelle fragmente la compréhension :

- plusieurs blocs répètent des chiffres ou des intitulés proches ;
- l’explication centrale est dissimulée derrière « Comprendre le calcul » ;
- les données apparaissent avant la conclusion qu’elles doivent soutenir ;
- le haut de la page territoriale duplique des informations présentes plus bas ;
- sur mobile, l’accumulation de cartes, boutons et accordéons allonge le parcours sans améliorer la compréhension.

L’utilisateur doit comprendre le diagnostic avant de choisir d’explorer les détails.

## Promesse de la nouvelle page

En quelques secondes, une personne doit pouvoir répondre à trois questions :

1. Quel est le verdict sur les comptes publics français ?
2. Comment ce verdict est-il calculé ?
3. Quelles explications permettent de le comprendre ?

La preuve reste traçable, mais elle ne remplace plus l’analyse et ne la masque pas.

## Architecture de la page France

### 1. Ouverture éditoriale

Le premier écran affiche :

- le périmètre et l’année des données ;
- un titre-conclusion, par exemple : « La France dépense 152,5 Md€ de plus qu’elle n’encaisse » ;
- une phrase qui explique en langage courant ce que mesure cet écart ;
- un chiffre de verdict clairement qualifié, sans jargon ni mise en scène ambiguë.

Le titre est une conclusion fondée sur les données, pas un titre de rubrique générique.

### 2. Calcul visible

L’équation qui produit le verdict est affichée directement :

> Recettes − Dépenses = Solde public

Les montants, l’unité, l’année et le périmètre sont visibles. Ce contenu n’est pas placé dans un accordéon.

Chaque terme peut proposer un lien secondaire « Source et méthode », mais l’ouverture de ce détail n’est jamais nécessaire pour comprendre le raisonnement principal.

### 3. Analyse en trois chapitres

La suite répond, dans cet ordre, à trois questions :

1. **D’où vient l’argent ?**
2. **Où part-il ?**
3. **Pourquoi la dette monte-t-elle ?**

Chaque chapitre contient :

- une conclusion rédigée en une phrase ;
- deux à quatre phrases d’analyse visibles par défaut ;
- une visualisation principale ou un tableau court ;
- un repère de comparaison si celui-ci éclaire réellement le chiffre ;
- une source datée et accessible.

Les graphiques servent le propos du chapitre. Ils ne sont pas une galerie autonome de données.

### 4. Verdict de trajectoire

Après les trois chapitres, un bloc synthétise la situation : niveau de déficit, dette rapportée au PIB et évolution récente. Si les données n’ont pas la même date, leur période est explicitement indiquée à côté de chaque chiffre.

Ce bloc distingue clairement :

- le constat comptable ;
- l’évolution dans le temps ;
- l’interprétation prudente que permettent les données.

### 5. Action suivante

Le simulateur intervient après l’analyse, sous la forme d’une invitation cohérente avec ce que la personne vient d’apprendre : « À vous d’équilibrer les comptes » ou formulation équivalente.

La page ne détourne pas prématurément vers le jeu avant d’avoir livré son diagnostic.

### 6. Sources et méthode

Une section finale regroupe les sources, définitions, conventions de périmètre et limites. Elle complète les références courtes présentes dans chaque chapitre.

Cette section peut être structurée en détails repliables. En revanche, les conclusions et explications nécessaires à la compréhension restent toujours visibles.

## Page territoriale

Le grand bloc supérieur « Briefing de [territoire] » est supprimé, avec ses chiffres, son bouton de comparaison et son renvoi au simulateur lorsqu’ils répètent des contenus présents plus bas.

La page commence directement par son analyse territoriale utile, avec :

- le nom du territoire et le contexte minimum requis ;
- le constat principal associé à l’indicateur sélectionné ;
- la comparaison et l’explication déjà présentes dans le corps de page.

Aucune donnée n’est supprimée si elle n’existe nulle part ailleurs : elle est déplacée dans la section d’analyse appropriée.

## Principes visuels

- Ton de rapport éditorial contemporain : sobre, précis, crédible.
- Hiérarchie typographique forte entre verdict, analyse et preuve.
- Une seule couleur d’accent principale, réservée aux repères utiles et aux actions.
- Peu de cadres : la structure repose d’abord sur l’espace, la typographie et les séparateurs.
- Pas de motifs décoratifs gratuits, de petite barre verticale isolée ou d’effet « dashboard » systématique.
- Les chiffres importants sont accompagnés de leur sens, pas seulement agrandis.

## Comportement mobile

La conception est mobile-first :

- une seule colonne à 390 px ;
- titre, explication et verdict lisibles sans défilement horizontal ;
- calcul empilé si nécessaire, tout en conservant le sens de l’équation ;
- textes d’analyse visibles sans interaction préalable ;
- visualisations utilisables au toucher, avec libellés lisibles sans survol ;
- actions d’au moins 44 px de hauteur ;
- aucun carrousel obligatoire pour accéder aux trois chapitres.

Sur grand écran, la mise en page peut juxtaposer le verdict et son calcul, puis alterner texte et visualisation. Le contenu et son ordre restent identiques.

## Règles éditoriales et de données

- Les calculs et sources existants restent la référence ; cette refonte modifie leur présentation, pas leur valeur.
- Un millésime ou une période accompagne chaque donnée majeure.
- Les chiffres de périodes différentes ne sont pas combinés sans avertissement explicite.
- Toute conclusion doit être directement étayée par le graphique ou le calcul adjacent.
- Le langage est compréhensible sans connaissances budgétaires préalables.
- Les notions techniques utiles sont définies en une phrase au premier usage.
- La neutralité vient de la méthode, de la traçabilité et de la précision, pas de titres vagues.

## Éléments à retirer ou remplacer

- le briefing territorial supérieur redondant ;
- les répétitions de chiffres entre le haut et le bas des pages ;
- « Comprendre le calcul » comme porte d’accès à l’explication centrale ;
- la succession de quatre cartes-conclusions traitées au même niveau ;
- les titres génériques qui n’expriment aucun enseignement ;
- les appels au simulateur avant que l’analyse principale soit comprise.

## Critères d’acceptation

La refonte est considérée conforme si :

1. le verdict, son année et sa signification sont visibles dès l’ouverture de la page France ;
2. le calcul recettes − dépenses = solde est visible sans clic ;
3. les trois chapitres d’analyse sont identifiables et leurs explications sont ouvertes par défaut ;
4. aucune occurrence de « Comprendre le calcul » ne masque le raisonnement principal ;
5. les sources, dates et périmètres restent accessibles pour chaque donnée importante ;
6. le briefing territorial supérieur redondant n’apparaît plus ;
7. la page ne contient pas deux présentations concurrentes du même chiffre ;
8. le parcours fonctionne à 390 px sans débordement horizontal, texte tronqué ni interaction dépendante du survol ;
9. la version réelle est comparée visuellement à la maquette de référence sur mobile et desktop ;
10. les tests de données existants continuent de passer.

## Hors périmètre

Cette décision ne redessine pas encore :

- le simulateur et ses cartes d’arbitrage ;
- la carte géographique ;
- le modèle de données ou les formules budgétaires ;
- les autres pages éditoriales du site.

Ces surfaces pourront reprendre la même direction visuelle après validation de la page France réelle.

## Référence de maquette

La direction retenue est le mockup **01 — Le verdict d’abord** du comparatif présenté le 26 août 2026. Son intention et sa hiérarchie font foi ; les textes et chiffres définitifs restent alimentés par les données réelles du site.
