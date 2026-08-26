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

La page conserve seulement une référence courte et discrète au jeu de données. Le détail du calcul renvoie vers la page dédiée « Sources et méthode » ; aucun panneau méthodologique ne se déplie dans le récit principal.

### 3. Analyse en trois chapitres

La suite répond, dans cet ordre, à trois questions :

1. **D’où vient l’argent ?**
2. **Où part-il ?**
3. **Pourquoi la dette monte-t-elle ?**

Chaque chapitre contient :

- une conclusion rédigée en une phrase ;
- deux à quatre phrases d’analyse visibles par défaut ;
- une visualisation principale ou un tableau court ;
- une évolution historique suffisamment longue pour distinguer tendance et accident annuel ;
- une comparaison avec les principaux voisins européens sur une définition harmonisée ;
- une référence courte et datée qui renvoie vers la page « Sources et méthode ».

Les graphiques servent le propos du chapitre. Ils ne sont pas une galerie autonome de données.

### 4. Deux repères obligatoires : le temps et l’Europe

Les indicateurs structurants — recettes, dépenses, solde public et dette — ne sont jamais présentés comme des valeurs isolées.

Pour chacun, la page montre :

- **l’historique français**, sur au moins dix ans et, lorsque la série harmonisée le permet, depuis 2000 ;
- **la position européenne actuelle**, face à l’Allemagne, la Belgique, le Luxembourg, l’Espagne et l’Italie, complétée par les moyennes de l’Union européenne et de la zone euro lorsqu’elles sont disponibles.

Le Royaume-Uni et la Suisse ne sont ajoutés que si la définition et la période sont strictement comparables. La sélection des pays est stable d’un graphique à l’autre afin d’éviter les comparaisons opportunistes.

Sur ordinateur, un graphique historique principal peut être accompagné d’une comparaison européenne compacte. Sur mobile, les deux se succèdent verticalement dans le même chapitre. Ils restent visibles sans carrousel et sans survol obligatoire.

Les comparaisons utilisent en priorité des ratios harmonisés — notamment en pourcentage du PIB ou par habitant à parité de pouvoir d’achat — plutôt que des montants bruts qui favoriseraient mécaniquement les grands pays.

### 5. Verdict de trajectoire

Après les trois chapitres, un bloc synthétise la situation : niveau de déficit, dette rapportée au PIB et évolution récente. Si les données n’ont pas la même date, leur période est explicitement indiquée à côté de chaque chiffre.

Ce bloc distingue clairement :

- le constat comptable ;
- l’évolution dans le temps ;
- l’interprétation prudente que permettent les données.

### 6. Action suivante

Le simulateur intervient après l’analyse, sous la forme d’une invitation cohérente avec ce que la personne vient d’apprendre : « À vous d’équilibrer les comptes » ou formulation équivalente.

La page ne détourne pas prématurément vers le jeu avant d’avoir livré son diagnostic.

### 7. Page dédiée « Sources et méthode »

Les sources, définitions, conventions de périmètre et limites ne forment pas une section longue au milieu ou au bas du bilan. Elles disposent d’une page autonome, accessible à l’adresse `/sources-et-methode`.

Cette page documente :

- la définition de chaque indicateur ;
- les formules et agrégations utilisées ;
- les organismes producteurs et les liens vers les jeux de données originaux ;
- le millésime, la date de mise à jour et la fréquence de publication ;
- les éventuelles ruptures de série ;
- les règles d’harmonisation des comparaisons européennes ;
- les limites d’interprétation et les écarts de périmètre connus.

Sur la page France, une mention courte de type « Insee et Eurostat · données 2025 » accompagne chaque visualisation et renvoie vers l’ancre correspondante de cette page dédiée. Il n’y a ni accordéon méthodologique, ni paragraphe technique dans le récit principal.

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
- historique puis comparaison européenne affichés verticalement dans chaque chapitre concerné ;
- actions d’au moins 44 px de hauteur ;
- aucun carrousel obligatoire pour accéder aux trois chapitres.

Sur grand écran, la mise en page peut juxtaposer le verdict et son calcul, puis alterner texte et visualisation. Le contenu et son ordre restent identiques.

## Règles éditoriales et de données

- Les calculs et sources existants restent la référence ; cette refonte modifie leur présentation, pas leur valeur.
- Un millésime ou une période accompagne chaque donnée majeure.
- Les chiffres de périodes différentes ne sont pas combinés sans avertissement explicite.
- Les comparaisons européennes emploient une source, une définition et une période harmonisées ; à défaut, elles ne sont pas affichées.
- Une rupture de série reste visible sur le graphique et est expliquée sur la page « Sources et méthode ».
- Les graphiques historiques distinguent les données définitives, provisoires et prévisionnelles lorsqu’elles coexistent.
- Toute conclusion doit être directement étayée par le graphique ou le calcul adjacent.
- Le langage est compréhensible sans connaissances budgétaires préalables.
- Les notions techniques utiles sont définies en une phrase au premier usage.
- La neutralité vient de la méthode, de la traçabilité et de la précision, pas de titres vagues.

## Éléments à retirer ou remplacer

- le briefing territorial supérieur redondant ;
- les répétitions de chiffres entre le haut et le bas des pages ;
- « Comprendre le calcul » comme porte d’accès à l’explication centrale ;
- les accordéons et longs développements méthodologiques dans le flux principal ;
- la succession de quatre cartes-conclusions traitées au même niveau ;
- les titres génériques qui n’expriment aucun enseignement ;
- les appels au simulateur avant que l’analyse principale soit comprise.

## Critères d’acceptation

La refonte est considérée conforme si :

1. le verdict, son année et sa signification sont visibles dès l’ouverture de la page France ;
2. le calcul recettes − dépenses = solde est visible sans clic ;
3. les trois chapitres d’analyse sont identifiables et leurs explications sont ouvertes par défaut ;
4. aucune occurrence de « Comprendre le calcul » ne masque le raisonnement principal ;
5. les quatre indicateurs structurants disposent d’un historique d’au moins dix ans lorsque les données le permettent ;
6. leur position est comparée aux cinq voisins européens retenus ainsi qu’aux moyennes UE et zone euro lorsque ces séries sont harmonisées ;
7. une page autonome `/sources-et-methode` documente les calculs, sources, millésimes, ruptures de série et règles de comparaison ;
8. la page France ne contient ni accordéon méthodologique ni long texte de méthode ;
9. chaque référence courte renvoie directement à la section pertinente de la page dédiée ;
10. le briefing territorial supérieur redondant n’apparaît plus ;
11. la page ne contient pas deux présentations concurrentes du même chiffre ;
12. le parcours fonctionne à 390 px sans débordement horizontal, texte tronqué ni interaction dépendante du survol ;
13. la version réelle est comparée visuellement à la maquette de référence sur mobile et desktop ;
14. les tests de données existants continuent de passer.

## Hors périmètre

Cette décision ne redessine pas encore :

- le simulateur et ses cartes d’arbitrage ;
- la carte géographique ;
- le modèle de données ou les formules budgétaires ;
- les autres pages éditoriales du site.

Ces surfaces pourront reprendre la même direction visuelle après validation de la page France réelle.

## Référence de maquette

La direction retenue est le mockup **01 — Le verdict d’abord** du comparatif présenté le 26 août 2026. Son intention et sa hiérarchie font foi ; les textes et chiffres définitifs restent alimentés par les données réelles du site.
