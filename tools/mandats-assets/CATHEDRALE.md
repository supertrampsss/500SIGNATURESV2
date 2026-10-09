# Cathédrale de la miniature MANDATS

`cathedrale.py` compose un monument original d’après la silhouette centrale de
`docs/mandats-diorama/reference-ordinateur.png`. Il conserve une nef étroite,
deux tours de hauteurs différentes, leurs longues flèches, un lanternon central,
un transept plus bas, des arcs-boutants et une abside à chapelles rayonnantes.
Ce modèle remplace le monument plus trapu du premier kit quand la scène charge
ce fichier dédié.

Les fenêtres principales sont des percements géométriques. Le verre est en
retrait des parements ; leurs archivoltes, meneaux, rosaces, galeries, corniches,
pinacles et nervures de couverture sont des volumes. Le monument est une
interprétation de la construction fictive visible dans l’image de référence,
et ne prétend pas être un relevé historique de Notre-Dame.

La géométrie et les matières sont créées dans ce dépôt avec Blender 4.3.2.
Aucune texture photographique, bibliothèque de modèles ou image de l’interface
n’est incorporée dans le monument.

Les cartes de couleur, normale, rugosité, métal et occlusion sont cuites dans
Blender puis incorporées à `site/public/mandats/models/cathedrale.glb`. L’albédo
conserve la couleur de la pierre sans ombres permanentes : l’occlusion constitue
une entrée PBR distincte. L’export GLTF rassemble rugosité, métal et occlusion
dans leurs canaux respectifs. La rugosité distingue pierre, ardoise, zinc, fer
et verre. La scène peut donc éclairer ces surfaces avec son environnement local.

La racine `cathedrale_paris` et son maillage détaillé partagent le même matériau
et les mêmes textures que `cathedrale_paris_distant`. Le niveau de distance
retire les petits segments de ferronnerie et d’archivoltes réservés à l’inspection,
puis réduit les éléments restants. Il conserve les vitrages, volumes et points
extrêmes de la silhouette. Le script exige un résultat mesuré inférieur à 14 %
des triangles détaillés.
Il vérifie les UV, les coordonnées finies, le partage
du matériau et une dérive des limites inférieure à 2 %, puis rétablit les
limites exactes du niveau détaillé. Les dimensions et triangles mesurés des deux
niveaux figurent dans `cathedrale.json`. L’export actuel comporte 79 444 triangles
détaillés et 4 180 triangles de distance, soit 5,26 %. L’atlas utilise 48,17 %
de surface UV utile. Les axes de l’export sont Y vertical,
façade principale vers +Z, origine centrée sur l’emprise au niveau du sol.

Recréation depuis la racine du dépôt :

```sh
blender --background --threads 3 --python tools/mandats-assets/cathedrale.py
```

La source détaillée et ses textures locales sont conservées dans
`cathedrale.blend`. La sauvegarde précède la création du modèle de distance.
`--skip-bake` réutilise les cartes déjà présentes ; `--no-preview` évite le
rendu de contrôle. `--shape-preview` montre seulement la géométrie et les
matières sources, sans remplacer les fichiers de production.
`--lod-only --no-preview` réexporte le GLB et son niveau de distance depuis la
source `.blend` existante, sans refaire les textures ni modifier cette source.

Les aperçus Cycles sont enregistrés hors du dépôt dans
`/workspace/mandats-verification/authored-3d/cathedrale-source-preview.png` et
`cathedrale-atlas-preview.png`. Ils permettent d’inspecter l’actif ; la fidélité
de la carte complète se juge dans Babylon à partir de captures du jeu comparées
à l’image confirmée.
