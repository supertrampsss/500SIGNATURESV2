# Vérification visuelle — verdict France

Date : 26 août 2026  
Correctif contrôlé : `1e5fbb2`

## Périmètre et méthode

Le pilote a rechargé la version corrigée après avoir constaté des doublons sur
une première version. Les captures ci-dessous sont les preuves pérennes de la
revue visuelle. Les métriques de DOM consignées dans la matrice complètent les
zones qui ne tiennent pas dans le haut d'une capture mobile.

| Vue | Capture |
| --- | --- |
| Bilan, bureau, page entière | [bilan-desktop-1440x900.jpg](bilan-desktop-1440x900.jpg) |
| Bilan, mobile, page entière | [bilan-mobile-390x844.jpg](bilan-mobile-390x844.jpg) |
| Sources et méthode, mobile, haut de page | [sources-mobile-top-390x844.jpg](sources-mobile-top-390x844.jpg) |
| Territoire Paris, mobile, haut de page | [territoire-paris-mobile-top-390x844.jpg](territoire-paris-mobile-top-390x844.jpg) |

## Bilan — desktop 1440 × 900

Métriques relevées : `clientWidth = scrollWidth = 1430 px`, hauteur de document
`6962 px`. Le héros commence à `84 px`; les chapitres Entrées, Sorties, Dette et
Europe commencent respectivement à `656`, `1808`, `5203` et `6346 px`.
`methodText = false`.

| Critère | Preuve | Résultat |
| --- | --- | --- |
| Verdict d'abord | Le héros en deux colonnes (`1120 × 488 px`) ouvre la page avec « La France dépense 152,51 milliards d'euros de plus qu'elle n'encaisse ». | Validé |
| Calcul visible | L'équation « Recettes − Dépenses = Solde public » et les trois montants sont immédiatement sous le verdict. | Validé |
| Sections ouvertes | Navigation et chapitre « D'où vient l'argent ? » suivent le héros; les chapitres suivants sont présents dans la page entière. | Validé |
| Historique lisible | Les séries historiques des dépenses et de la dette sont visibles dans la capture pleine page. | Validé |
| Europe lisible | Le comparatif « La France et ses voisins » est visible à `6346 px`, avec les pays et agrégats européens. | Validé |
| Aucune méthode dans le flux | `methodText = false`; aucun bloc méthodologique n'apparaît dans le bilan. | Validé |
| CTA Bilan | « Passer au simulateur » est visible, avec destination `/simulateur`. | Validé |

## Mobile — sources — territoire 390 × 844

| Critère | Preuve | Résultat |
| --- | --- | --- |
| Bilan sans débordement | `clientWidth = scrollWidth = 380 px`; héros `348 × 482,5 px`, en une colonne. | Validé |
| Bilan lisible | Une seule occurrence des recettes est visible dans le héros; aucune troncature n'a été observée. L'historique (`348 × 1467,6 px`) et l'Europe (`348 × 744,4 px`) restent dans le flux; les tableaux plus larges ont leurs conteneurs défilants. | Validé |
| Actions du Bilan à 44 px | Onglets du bilan et CTA mesurent `44 px` de haut. | Validé |
| Navigation principale à 44 px | Les actions de navigation principale mesurent `44 px` de haut. | Validé |
| Sources sans débordement | `/sources/` a `clientWidth = scrollWidth = 380 px`. | Validé |
| Sources accessible | Un unique `<main>` est présent; le titre « Sources et méthode », la méthode et le registre sont présents. Le lien Accueil mesure `44 px` de haut. | Validé |
| Territoire Paris sans débordement | `/territoire?...territoire=75056` a `clientWidth = scrollWidth = 380 px`. | Validé |
| Briefing territoire absent | Le briefing est absent (`0`). | Validé |
| Fiche Paris présente | La fiche affiche Paris et « 2 103 778 hab ». | Validé |
| Cinq thèmes et carte accessibles | Budget, Fiscalité, Dette, Services, Trajectoire et « Voir sur la carte » sont présents; chacun mesure `44 px` de haut. | Validé |

## Conclusion

Les contrôles exigés aux étapes 3 et 4 du plan sont couverts par les captures
ci-dessus et leurs métriques associées. La revue porte explicitement sur le
correctif `1e5fbb2` qui a supprimé les doublons constatés lors du premier essai.
