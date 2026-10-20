# Mandats v17 - geometrie et reperes

## Avant

Preuves : `.snapshots/mandats-actions-carte/before.json`, `before-opening-0.png`, `before-opening-6.png`.

A 1919 x 1015, la zone carte mesurait 1919 x 757 px, mais son image mesurait 1919 x 1079,44 px et commencait a y = -21,22 px. Le defaut principal etait le recadrage de plus de 322 px de hauteur, et non un fort etirement : le ratio affiche etait deja tres proche du ratio natif 1672 / 941.

## Correction

- Ratio exact 1672 / 941 et image contenue, sans deformation.
- Vue France ajuste les deux dimensions a la zone disponible ; le mode normal garde le deplacement horizontal sur telephone.
- Bande introductive de 56 px, ou 48 px sur telephone court.
- Noms des secteurs et des institutions toujours visibles, y compris au calme ; focus clavier explicite.
- Huit reperes initiaux sur deux colonnes sur telephone. Cibles de 48 px sur les petits ecrans, 68 px sinon ; reserve de 58 px pour Vue France.
- Les regroupements copient `data-panel` pour ouvrir egalement les commandes institutionnelles.
- Les geometries historiques restent intactes ; aucun changement du moteur, des sauvegardes ou de l'illustration.

## Verification

Captures apres construction coordonnee : `.snapshots/mandats-actions-carte/after-{1919,1280,390,320}.png` et variantes `-whole.png`, inspectees visuellement dans les huit cas. Mesures : `after-geometry.json`.

| Ecran | Image normale | Vue France | Recadrage en Vue France |
| --- | --- | --- | --- |
| 1919 x 1015 | 1359,27 x 764,98 | identique | aucun |
| 1280 x 900 | 1154,94 x 649,98 | identique | aucun |
| 390 x 844 | 913,28 x 513,98 | 390 x 219,48 | aucun |
| 320 x 568 | 504,61 x 283,98 | 320 x 180,09 | aucun |

Dans les huit vues, les huit cibles initiales sont visibles, leur centre atteint le bon bouton, aucun rectangle de cible ne se chevauche, et la hauteur des libelles reste contenue dans leur bouton. Le ratio calcule reste identique au ratio natif a l'arrondi sous-pixel.

L'inspection a revele une ligne explicative de la bande titre debordant a 320 px : une derniere correction masque cette ligne sur telephone court et ajuste la hauteur du titre ; nouvelle capture apres reconstruction encore necessaire pour cette derniere correction uniquement.

## Limite

Sur telephone, la vue normale conserve un recadrage horizontal pour permettre l'exploration ; Vue France affiche toute l'illustration.
