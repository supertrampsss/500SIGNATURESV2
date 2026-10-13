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

L'itération 39 rétablit les proportions complètes de cette source, sans
compression des flèches ni élargissement de la façade. Le GLB mesure
1,907 × 2,9465 au sol pour 3,84 de haut. Depuis l’itération 43, Paris applique une réduction uniforme
à 0,94 de largeur ; les petits monuments utilisent également une échelle
uniforme. L'export de cette ancienne source produisait les mêmes 11 171 848 octets,
SHA-256 `60235a5e34d8c49f40c2d07d43a7914eae1aae2ac515c439991b19f969c288f4`.

Les aperçus Cycles sont enregistrés hors du dépôt dans
`/workspace/mandats-verification/authored-3d/cathedrale-source-preview.png` et
`cathedrale-atlas-preview.png`. Ils permettent d’inspecter l’actif ; la fidélité
de la carte complète se juge dans Babylon à partir de captures du jeu comparées
à l’image confirmée.

La palette source de l'ardoise utilise le bleu profond RGB linéaire
`(0,025 ; 0,045 ; 0,075)`. Le changement concerne seulement l'albédo de ses
îlots UV ; la pierre, les tuiles, les vitrages, les normales et les canaux ORM
restent inchangés. Les fichiers `.blend` existants conservent leur géométrie et
peuvent garder leur ancienne image intégrée. À chaque export final, y compris
un export de LOD seul, `slate_albedo.py` synchronise l'image d'albédo du GLB avec
l'atlas PNG local courant. Il vérifie que tous les autres bufferViews restent
identiques octet par octet. Les modèles détaillés et distants utilisent la même
image ; aucune couleur de toiture n'est appliquée globalement au matériau PBR.
Une génération complète recuit directement la nouvelle palette enregistrée dans
le générateur, sans retouche de la lumière dans les couleurs.

L’itération 45 répare la maçonnerie de la rosace et du fronton, amincit les murs des tours selon leur largeur et adapte les cadres des petites lancettes. Les chapelles possèdent huit panneaux, avec une ouverture réelle tournée vers l’extérieur ; leur distribution évite les contreforts terminaux. La source est triangulée et nettoyée avant son dépliage et sa cuisson complète. Les 35 rayons de contrôle atteignent le verre dans la source puis des texels bleus dans les deux niveaux de détail exportés. Ce contrôle d’actif ne certifie pas les filtres du rendu natif ni la fidélité du diorama entier.

Le kit des itérations 45 à 49 mesure 1,907 × 2,918 au sol pour 3,84 de haut : la largeur et la hauteur restent celles du kit précédent ; la profondeur diminue d’environ 1 %. Il comporte 81 012 triangles détaillés et 4 141 distants, sans triangle dégénéré ni désaccord de normale dans les accès glTF contrôlés. Deux exports depuis la nouvelle source cuite donnent les mêmes 11 764 076 octets, SHA-256 `fd8d587d9a82beeb889365969d1c2b1c57f202db84a42b947a31f86099a17a1e`. Le nom explicite de la géométrie distante évite les noms temporaires différents selon les objets encore présents dans Blender. L’intégralité du buffer binaire reste identique à l’export issu de la cuisson complète, y compris les normales, les UV et les trois images intégrées.

L’itération 50 rapproche la façade et la hauteur des tours de la miniature de
référence. L’export applique les options existantes à la source détaillée :

```sh
blender --background --disable-autoexec --threads 2 --python-exit-code 1 \
  --python tools/mandats-assets/cathedrale.py -- \
  --lod-only --no-preview --upper-profile .65 --facade-span 1.25
```

Les limites mesurées directement dans les deux niveaux glTF sont désormais
2,38375 × 2,918 au sol et 3,2065 de haut. Le profil supérieur est recoupé avant
la création du niveau distant ; celui-ci partage toujours l’atlas du modèle
détaillé. Deux exports frais donnent les mêmes 11 897 980 octets, avec
83 956 triangles détaillés et 4 271 distants. Cette opération conserve la source
`.blend` et réutilise les textures déjà cuites ; elle ne constitue pas une
nouvelle cuisson des matières.

Paris utilise une largeur de 1,175, avec la même échelle uniforme et la même
profondeur réelle qu’avant cet élargissement. Le centre local passe de x = 0,34
à x = 0,365. Le socle couvre toute l’emprise du monument pour soutenir les
contreforts extérieurs. Une observation des 50 faces inférieures dans Babylon
relève 150 points soutenus par la maçonnerie du socle, sans contact avec l’eau
ni recouvrement des faces inférieures des maisons voisines. Ces observations
locales ne certifient pas la fidélité artistique de la carte entière.
