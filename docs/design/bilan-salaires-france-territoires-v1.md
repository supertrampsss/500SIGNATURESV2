# Maquette produit — Salaires, France et Territoires

État : lot 1 implémenté localement et vérifié ; refonte graphique détaillée au lot 2.

Objectif : rendre les comptes publics lisibles en moins de 30 secondes, puis
permettre d'aller au détail sans imposer 100 cartes ni un texte méthodologique
à chaque écran. La page est pensée d'abord pour un écran de 390 px.

## 1. Navigation commune

La navigation principale ne contient que quatre destinations : **France**,
**Territoires**, **Salaires** et **Simulateur**. La recherche reste uniquement
dans Territoires. Chaque page conserve le même bandeau, le même retour et le
même niveau de titre.

## 2. France — verdict puis exploration

Ordre de lecture :

1. verdict annuel : recettes, dépenses, déficit ;
2. repères clés ;
3. six graphiques pour lire les comptes ;
4. comparaison européenne ;
5. exploration des huit familles d'analyses.

Wireframe :

```text
FRANCE · 2025

−153 Md€
Déficit public

1 562 Md€ encaissés      1 714 Md€ dépensés

[Depuis 2000] [Où va l'argent ?] [Face à l'Europe]

À retenir
• Les recettes progressent moins vite que les dépenses
• La charge de la dette prend une place croissante
• La France dépense davantage que la moyenne de ses voisins

[Explorer les 8 thèmes]
```

Une carte d'analyse contient un titre-constat, une phrase, un graphique ou un
chiffre de comparaison, puis une seule source. Le détail s'ouvre dans la carte
elle-même ; aucune page intermédiaire n'est créée.

### Correspondance sujet → graphique

| Sujet | Forme |
| --- | --- |
| Déficit | barre recettes / dépenses avec axe zéro |
| Historique | courbes recettes et dépenses depuis 2000 |
| Recettes 2017 → 2025 | barres comparées ou slopegraph |
| Dépenses | classement horizontal trié |
| Dette à 2032 | trois trajectoires basse, centrale et haute |
| Redistribution | pente avant / après |
| France / voisins | dot plot, France accentuée |
| Sécurité sociale | courbe du solde avec ligne zéro |

## 3. Territoires — une fiche avant la carte

La recherche et la carte restent disponibles, mais la fiche sélectionnée
devient le point d'entrée :

```text
BORDEAUX · 2025

417 M€ recettes   369 M€ dépenses
48 M€ épargne     413 M€ dette

[Comparer aux communes voisines]

Ce qui a changé depuis 2019
→ cascade des variations

Les chiffres à suivre
→ marge · dette · investissement

[Explorer les analyses]
```

La page par défaut montre les analyses prioritaires. Les autres restent
disponibles dans « Explorer » et sont filtrables par budget, fiscalité, dette,
services et trajectoire.

Le module « salariés par établissement » ne doit plus être un verdict : il est
secondaire, avec son dénominateur, son champ et une comparaison entre communes
de taille comparable. Si les données ne permettent pas cette comparaison, le
module disparaît plutôt que de produire une lecture ambiguë.

## 4. Salaires — parcours inspiré du format public de référence

Référence observée : <https://sarahknafo.fr/simulateur>.

La mécanique retenue est similaire : une saisie, quatre statuts, un résultat
immédiat, puis une ventilation. Les textes et calculs publiés par le site
seront toutefois originaux et recalculés à partir de sources publiques.

```text
Quel revenu arrive sur votre compte chaque mois ?

[ 2 100 € ]
[Salarié] [Fonctionnaire] [Indépendant] [Retraité]

Ce que votre travail représente
3 979 € par mois

Net reçu                 2 100 €
Cotisations salariales      …
Impôt sur le revenu         …
Cotisations employeur       …
Coût total                  …

[Voir le calcul]

Où vont ces prélèvements ?
Santé · retraite · chômage · famille · dette · services

[Comparer avec la moyenne] [Partager mon résultat]
```

Le calcul différencie toujours salaire brut, cotisations salariales,
prélèvement à la source, cotisations employeur et coût total. Les résultats
seront accompagnés de leur année et de leur périmètre.

Sources prévues : [Urssaf](https://www.urssaf.fr/accueil/outils-documentation/simulateurs/cotisations-employeur.html),
[Insee — salaires privés](https://www.insee.fr/fr/statistiques/8376872?sommaire=8376908),
[Insee — fonction publique](https://www.insee.fr/fr/statistiques/fichier/8986474/ip2100.pdf)
et [DREES — protection sociale en Europe](https://drees.solidarites-sante.gouv.fr/sites/default/files/2025-01/La%20protection%20sociale%20en%20Europe%20en%202023_MEL.pdf).

## 5. Règles d'interface

- un seul message principal par écran ;
- pas de sous-titres répétitifs ni de paragraphes de réserve dans les cartes ;
- chiffres arrondis à l'unité utile, unités toujours visibles ;
- pas de couleur seule pour transmettre une information ;
- graphique accompagné d'une alternative textuelle ;
- cibles tactiles d'au moins 44 px ;
- aucun débordement horizontal à 390 px ;
- une seule source affichée par analyse, les autres dans Sources ;
- le détail est un panneau local refermable, pas une nouvelle étape.

## 6. Critères d'acceptation de la prochaine implémentation

1. France affiche d'abord le verdict, puis six graphiques et les thèmes.
2. Territoires affiche la fiche avant les analyses longues.
3. Salaires fonctionne avec les quatre statuts et un résultat calculé.
4. Chaque graphique répond à une question unique et possède un tableau accessible.
5. Les données et les sources affichent leur millésime et leur périmètre.
6. Les parcours mobile et bureau passent le contrôle de largeur et de clavier.

## 7. Raccord technique prévu

Le lot sera découpé pour rester réversible et limiter le risque de quota :

- `site/src/routes.ts` : ajouter une route éditoriale `/salaires` sans détour
  par l'accueil supprimé ;
- `site/src/navigation.ts` et le gabarit de `site/src/main.ts` : ajouter l'onglet
  Salaires et conserver la recherche uniquement sur Territoires ;
- nouveau module `site/src/salaires.ts` : calculs purs par statut, ventilation
  et libellés vulgarisés ; aucune dépendance à l'état du simulateur politique ;
- `site/src/insights-rendu.ts` : rendre France par graphiques puis thèmes, avec
  un nombre limité de cartes ouvertes par défaut ;
- `site/src/insights-territoire.ts` : faire ressortir les priorités et reléguer
  les indicateurs contestables dans Explorer ;
- `site/src/styles/` : appliquer le même bandeau, les mêmes espacements et les
  mêmes règles mobile aux quatre destinations ;
- tests : route Salaires, quatre statuts, calculs de base, clavier, largeur
  390 px et absence de recherche hors Territoires.

Le lot 1 (page Salaires, navigation et hiérarchie des listes) est local,
vérifié par les tests et le build, puis enregistré dans un checkpoint Git.
La refonte des types de graphiques et la publication restent séparées pour
laisser valider la direction visuelle et respecter le quota d'exécution.
