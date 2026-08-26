# Vérification visuelle — verdict France

Date : 26 août 2026
Correctif contrôlé : `2813b45`

## Périmètre et méthode

Le pilote a rechargé la version corrigée après la revue finale. Les captures
ci-dessous sont les preuves pérennes de la revue visuelle. Les métriques de DOM
consignées dans la matrice complètent les zones qui ne tiennent pas dans le haut
d'une capture mobile.

| Vue | Capture |
| --- | --- |
| Bilan, bureau, page entière | [bilan-desktop-1440x900.jpg](bilan-desktop-1440x900.jpg) |
| Bilan, mobile, page entière | [bilan-mobile-390x844.jpg](bilan-mobile-390x844.jpg) |
| Sources et méthode, mobile, haut de page | [sources-mobile-top-390x844.jpg](sources-mobile-top-390x844.jpg) |
| Territoire Paris, mobile, haut de page | [territoire-paris-mobile-top-390x844.jpg](territoire-paris-mobile-top-390x844.jpg) |

## Bilan — desktop 1440 × 900

Métriques relevées : `clientWidth = scrollWidth = 1440 px`, hauteur de document
`6959 px`. Le héros commence à `84 px`; les chapitres Entrées, Sorties, Dette et
Europe commencent respectivement à `656`, `1827`, `5211` et `6344 px`.
`methodText = false`.

| Critère | Preuve | Résultat |
| --- | --- | --- |
| Verdict d'abord | Le héros en deux colonnes ouvre la page avec « La France dépense 152,51 milliards d'euros de plus qu'elle n'encaisse ». | Validé |
| Calcul visible | L'équation « Recettes − Dépenses = Solde public » et les trois montants sont immédiatement sous le verdict. | Validé |
| Sections ouvertes | Navigation et chapitre « D'où vient l'argent ? » suivent le héros; les chapitres suivants sont présents dans la page entière. | Validé |
| Historique lisible | La table visible couvre les exercices `2000` à `2025` (26 exercices) pour dépenses, recettes et solde ; la narration conserve explicitement sa comparaison `2017`–`2025`. | Validé |
| Europe lisible et sourcée | Le comparatif « La France et ses voisins » est visible à `6344 px`, avec les pays et agrégats européens. Ses trois liens mènent aux fiches `/sources/#eurostat-gov-10a-exp-1ltka7k`, `/sources/#eurostat-gov-10a-taxag-1f0o6e2` et `/sources/#eurostat-gov-10dd-edpt1-45pd0a`. | Validé |
| Aucune méthode dans le flux | `methodText = false`; aucun bloc méthodologique n'apparaît dans le bilan. | Validé |
| CTA Bilan | « Passer au simulateur » est visible, avec destination `/simulateur`. | Validé |

## Mobile — sources — territoire 390 × 844

| Critère | Preuve | Résultat |
| --- | --- | --- |
| Bilan sans débordement | `/bilan` a `clientWidth = scrollWidth = 390 px`; le héros mesure `358 × 482,5 px`, en une colonne. | Validé |
| Bilan lisible | L'historique (`358 × 457,8 px`) et l'Europe (`358 × 712,3 px`) restent dans le flux; les tableaux plus larges ont leurs conteneurs défilants. Les trois liens de sources Europe sont présents. | Validé |
| CTA Bilan à 44 px | « Passer au simulateur » mesure `44 px` de haut. | Validé |
| Sources sans débordement | `/sources/` a `clientWidth = scrollWidth = 380 px`. | Validé |
| Sources accessible | Un unique `<main>` est présent. L'outline est « Sources et méthode » (H1), puis « Les sources », « La méthode » et « La grille de verdicts » (H2), suivis de leurs intertitres (H3). | Validé |
| Territoire Paris sans débordement | `/territoire?...territoire=75056` a `clientWidth = scrollWidth = 380 px`. | Validé |
| Briefing territoire absent | Le briefing est absent (`0`). | Validé |
| Fiche Paris présente | La fiche Paris est présente. | Validé |
| Cinq thèmes et carte accessibles | Budget, Fiscalité, Dette, Services, Trajectoire et « Voir sur la carte » sont présents; chacun mesure `44 px` de haut. | Validé |

## Conclusion

Les contrôles exigés aux étapes 3 et 4 du plan sont couverts par les captures
ci-dessus et leurs métriques associées. La revue porte explicitement sur le
correctif `2813b45`, y compris l'historique étendu, les liens Europe vers les
fiches Eurostat et la hiérarchie de titres de la page Sources.
