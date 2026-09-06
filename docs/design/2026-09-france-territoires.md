# France et Territoires : graphiques d'abord

Demande : supprimer les sections de renvoi qui encombrent France, refaire les
graphiques et la page Territoires pour des non-initiés, sur téléphone d'abord.

## Référence et décision

Référence étudiée : https://github.com/larashero3-dotcom/lieflat-charts
Catalogue : F2 Hairline Line, F12 Dumbbell Queue, L14 Hundred Field, G3 Chunky Bars.
Principes retenus : contraste contrôlé, hiérarchie typographique, unités explicites,
comparaison sur une même échelle, valeurs directement consultables.

Le dépôt de référence utilise SVG, ECharts et Chart.js. Sa licence actuelle est
PolyForm Noncommercial 1.0.0. Aucun code, CSS ni actif n'est copié : nos composants
sont écrits dans ce dépôt. Pas de CDN, bibliothèque supplémentaire ou police distante.

## Lecture

France : bilan annuel court, historique tactile, recettes de l'État, composition
publique, postes de dépenses, fonctions publiques, dette et comparaisons européennes.
Les sources restent près des données. Les tableaux et explications détaillées suivent
leur graphique. La liste de six cartes de navigation est supprimée du HTML.

Territoires : recherche, territoire choisi, quatre repères, historique OFGL.
Budget, dette et investissement sont des vues séparées : flux et encours ne sont pas
additionnés. Les analyses complémentaires et la note restent accessibles ensuite.
La carte existante reste fonctionnelle, facultative sur téléphone.

## Modules et contrats

- `chart-studio.ts` : rendu pur SVG et HTML, versions selon la largeur du conteneur.
- `chart-controls.ts` : contrôles délégués, fonctionnels après pré-rendu ou changement de ville.
- `territoire-finances.ts` : sélection et conversion explicite des séries OFGL en M€.
- `dataviz.ts` : courbe des comptes et composition en 100 cases ; valeur partielle
  d'une case conservée pour ne pas arrondir les catégories artificiellement.
- `styles/data-studio.css` : identité et transformations France/Territoires.

Les années absentes cassent les courbes. Les positions utilisent les années réelles.
Les scénarios de dette restent identifiés et les jalons ne sont pas interpolés.
Les contrôles ne réinitialisent pas le défilement et fonctionnent au clavier.
Les animations respectent la réduction de mouvement. Le lecteur peut obtenir les
valeurs sans hover, sans WebGL et sans bibliothèque de graphiques.
