# Refonte visuelle complète du bilan France — contrat v2

Date : 26 août 2026

Statut : validé par l'utilisateur le 26 août 2026 (« GO »)

## Objet

Cette spécification corrige l'écart entre la direction 01 validée et la première
implémentation. La précédente version a changé l'ordre de lecture, mais a
conservé trop de surfaces, de rythmes et de composants du tableau de bord
historique. La présente version fait de la maquette **01 — Le verdict d'abord**
un contrat de composition, pas seulement un principe éditorial.

Elle complète la spécification
`docs/superpowers/specs/2026-08-26-verdict-france-editorial-design.md`. En cas
de conflit sur l'apparence de `/bilan`, ce document v2 prévaut. Les calculs,
données et sources existants restent inchangés.

## Résultat attendu en deux secondes

À 1440 × 900, l'œil doit rencontrer dans cet ordre :

1. une couverture éditoriale contenue, distincte du chrome du site ;
2. une conclusion forte à gauche ;
3. un chiffre-totem à droite, souligné par l'accent rouge ;
4. l'équation complète sur une ligne ;
5. trois portes d'analyse clairement identifiables.

La page ne doit plus évoquer une liste de blocs techniques. Elle doit évoquer
un rapport contemporain destiné au grand public : précis, calme, éditorial et
visuellement fini.

## 1. Chrome de la page

Sur `/bilan`, l'en-tête global adopte un traitement bleu nuit compact. Le nom
du site et la navigation restent disponibles, mais la recherche territoriale et
le sous-titre ne doivent pas dominer l'ouverture France. Le contraste et les
cibles tactiles restent conformes.

Le fond général est légèrement froid ; le contenu France repose sur une grande
surface papier chaude. Cette différence rend immédiatement visible le passage
du site-outil au dossier éditorial.

## 2. Couverture éditoriale

La couverture possède une largeur maximale de 1180 px et un fond papier
`#fbf8f1` ou équivalent. Elle n'est pas un simple texte posé dans la page.

### Colonne éditoriale

- surligne : « Les comptes de la France · 2025 » ;
- titre de 56 à 72 px sur grand écran, sans dépasser environ 16 caractères par
  ligne visuelle ;
- phrase définissant le solde en langage courant ;
- mention « Pour 100 € encaissés… » et trajectoire en informations secondaires.

### Chiffre-totem

- carte blanche distincte dans la couverture ;
- bord supérieur rouge épais ;
- libellé « Le verdict en un chiffre » ;
- montant du solde en très grand ;
- qualification explicite : « à financer sur l'année », « excédent sur
  l'année » ou « comptes à l'équilibre » selon le signe réel.

### Équation

Une seule rangée montre :

`Recettes 1 561,6 Md€ − Dépenses 1 714,1 Md€ = Solde −152,5 Md€`

Les signes sont visuellement présents, la sémantique reste lisible par lecteur
d'écran et la rangée se transforme en trois étapes reliées sur mobile. Cette
équation remplace le panneau gris vertical de trois chiffres.

### Trois portes

La couverture se termine par exactement trois liens :

1. « D'où vient l'argent ? » ;
2. « Où part-il ? » ;
3. « Pourquoi la dette monte ? ».

Chaque porte possède un filet supérieur bleu nuit, une phrase de conclusion et
une cible de 44 px minimum. Il n'existe plus de porte autonome « Europe » : la
comparaison européenne devient une preuve dans le troisième chapitre.

## 3. Chapitres éditoriaux

Chaque chapitre utilise la même grammaire : numéro et surligne, titre-question,
conclusion en une phrase, deux à quatre phrases d'analyse, puis preuve visuelle.

Sur ordinateur, l'introduction occupe une colonne latérale stable et la preuve
principale une colonne large. Sur mobile, le titre précède immédiatement la
preuve. Les contenus secondaires restent accessibles, mais ne doivent pas
concurrencer la visualisation principale.

### Chapitre 1 — D'où vient l'argent ?

- preuve dominante : évolution recettes, dépenses et solde depuis 2000 ;
- explication de la couverture des dépenses par les recettes ;
- détail des recettes de l'État traité comme preuve secondaire.

### Chapitre 2 — Où part-il ?

- preuve dominante : répartition de 100 € de dépense publique ;
- fonctions publiques présentées dans un langage graphique cohérent ;
- redistribution et Sécurité sociale traitées comme approfondissements, avec
  une hiérarchie moindre.

### Chapitre 3 — Pourquoi la dette monte ?

- preuve dominante : dette et trajectoire ;
- comparaison européenne intégrée à la suite, avec ses trois liens Eurostat ;
- conclusion distinguant déficit annuel et stock de dette.

## 4. Direction graphique

Tokens dédiés au bilan :

- bleu nuit `#0b1d36` pour l'encre forte et le chrome ;
- papier `#fbf8f1` pour les surfaces éditoriales ;
- rouge `#b7372f` comme unique accent de verdict et de déficit ;
- gris bleuté pour textes secondaires ;
- serif existante pour conclusions et chiffres, sans-serif pour navigation et
  légendes.

Les couleurs de séries restent possibles dans les graphiques lorsque leur
distinction porte de l'information. Elles ne deviennent jamais des accents de
chrome concurrents.

Les cartes arrondies génériques, les pilules de navigation et les bordures
verticales héritées sont neutralisées dans `/bilan`. Les séparateurs, le blanc
et les filets supérieurs structurent la page.

## 5. Mobile 390 × 844

- aucun retrait hérité de `.national` ;
- couverture bord à bord dans la colonne utile ;
- titre entre 38 et 48 px ;
- chiffre-totem immédiatement après le titre ;
- équation en trois étapes, avec signes conservés ;
- trois portes empilées, jamais en carrousel ;
- chapitre en une colonne ;
- graphiques et tableaux défilent localement si nécessaire, sans élargir la
  page ;
- boutons et portes : 44 px minimum ;
- aucun texte essentiel dépend du survol ou d'un accordéon.

## 6. Frontières techniques

Les huit renderers de données existants, leurs identifiants et leurs formules
sont conservés. La refonte porte sur :

- le shell HTML de `/bilan` ;
- le markup présentatif de `renduConclusionsBilan()` ;
- la feuille `styles/bilan-guide.css`, entièrement propriétaire du rendu Bilan ;
- les tests de structure SPA/pré-rendu et les preuves navigateur.

Les IDs des slots de données restent uniques afin de conserver la parité entre
SPA et pré-rendu. La comparaison Europe peut être déplacée dans le chapitre
dette sans changer son renderer.

## 7. Critères d'acceptation visuelle

1. Le premier écran desktop reproduit la composition de la maquette 01 : texte
   à gauche, totem à droite, équation horizontale, trois portes sous le calcul.
2. Le panneau gris vertical de chiffres et la navigation à cinq pilules ont
   disparu.
3. Le corps comporte exactement trois chapitres éditoriaux ; Europe est intégrée
   au troisième.
4. Le header France est visuellement cohérent avec la couverture et ne ressemble
   plus au header blanc historique.
5. À 390 px, le document n'a aucun débordement horizontal et les portes/actions
   mesurent au moins 44 px.
6. La hauteur et la densité du mobile sont réduites par la hiérarchie visuelle,
   sans masquer les conclusions principales.
7. Les captures desktop et mobile sont comparées côte à côte à la maquette 01 ;
   un simple respect du contenu ne suffit pas.
8. Les calculs, millésimes, liens sources, historique 2000–2025, voisins
   européens et 1 320 tests existants restent valides.

## Hors périmètre

- refonte du simulateur ;
- refonte de la carte territoriale ;
- changement des données ou des formules ;
- création d'une nouvelle bibliothèque de graphiques.
