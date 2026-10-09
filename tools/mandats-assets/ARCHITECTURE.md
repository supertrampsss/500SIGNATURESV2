# Architecture de MANDATS

`architecture.glb` contient dix-huit modèles de maisons, fermes et boutiques
régionales, trois monuments et quinze variantes de façade dominante et une variante de distance de chacun. Ce kit est
créé pour le dépôt avec Blender 4.3.2. Ses textures décrivent les surfaces des
modèles ; aucune image de la carte ou du jeu ne sert de décor.

Le générateur `architecture.py` produit les volumes, les matériaux, l'atlas UV et
le fichier d'auteur `architecture.blend`. Les débords de toiture ont une face
inférieure en bois et une bordure en pierre. Les maisons portent des corniches,
des chaînages d'angle, des ouvertures latérales, des encadrements, des volets,
des cheminées et, selon leur région, des lucarnes ou des balcons. Les noms, pivots, emprises XZ, hauteurs et niveau du sol des 42 modèles de base sont conservés. Les quinze variantes `maison_*_dominante`, chacune avec son LOD, partagent exactement l’emprise et le pivot de leur maison de base.
Quatre modèles de base, en pierre, ardoise, brique et enduit rose, portent trois étages
réels. Les quinze variantes dominantes possèdent quatre niveaux réels, avec des ouvertures sur toutes les façades et une toiture dont la pente reste normale. Leurs hauteurs sources augmentent, tandis que le placement conserve
l’emprise et la hauteur expressément définies pour chaque adresse. Les fenêtres
restent sous les corniches au lieu de traverser les débords de toiture.

Chaque racine est centrée au niveau du sol. L'export GLTF utilise l'axe Y vertical.
`architecture.json` fournit les dimensions des modèles avant leur placement.
Les façades parisiennes et la cathédrale principale proviennent de leurs propres
kits, `paris.glb` et `cathedrale.glb`.

Les modèles partagent un atlas UV de couleurs de 2 048 pixels et des textures de
normales et ORM de 1 024 pixels. L'ORM sépare l'occlusion de contact, la rugosité et
le métal dans ses canaux rouge, vert et bleu. L'albédo ne contient pas d'ombre
précalculée. L'occlusion porte sur 0,11 unité et utilise un poids de 48 %. La
pierre utilise une rugosité comprise entre 0,44 et 0,62, la terre cuite entre
0,34 et 0,47, l'ardoise entre 0,26 et 0,41 et le verre entre 0,09 et 0,16.

La pierre et les enduits possèdent des teintes chaudes distinctes. Les couvertures
utilisent, en RGB linéaire, `(0,60 ; 0,16 ; 0,06)` pour les tuiles,
`(0,74 ; 0,295 ; 0,095)` pour les tuiles claires et
`(0,10 ; 0,16 ; 0,235)` pour l'ardoise. Le dessin des joints, le grain et les
variations de teinte sont calculés sur les surfaces locales lors de la cuisson.

Un maillage temporaire unique permet le placement UV sans superposition des
modèles. Des attributs de face et de boucle reportent les coordonnées dans les
maillages sources. La génération refuse une surface UV totale dépassant l'espace
disponible ou inférieure à 30 %. Le kit actuel utilise 56,14 % de surface utile.

Depuis la racine du dépôt :

```sh
blender --background --threads 3 --python tools/mandats-assets/architecture.py
```

Pour régénérer l'albédo seulement, en conservant exactement la géométrie et les
UV du fichier d'auteur ainsi que les cartes PBR existantes :

```sh
blender --background --threads 3 --python tools/mandats-assets/architecture.py -- --albedo-only --skip-preview
```

Pour réexporter les niveaux de distance depuis la source, sans nouvelle cuisson :

```sh
blender --background --threads 3 --python tools/mandats-assets/architecture_lod.py
```

`architecture_lod.py` conserve 48 % des triangles domestiques, 45 % des triangles
de la cathédrale régionale et 40 % des deux autres monuments. Les UV, normales,
matériaux et origines sont partagés entre les deux niveaux. Le script refuse une
dérive des dimensions supérieure à 1,5 %, puis rétablit les bornes exactes pour
que le passage entre les niveaux conserve l'emprise et le niveau du sol.

Le JSON décrit 60 437 triangles détaillés et 28 593 triangles de distance.
L'exporteur nettoie les triangles dégénérés ; le GLB distribué contient
88 841 triangles. Babylon choisit le niveau de détail selon la couverture à
l'écran. Une inspection retrouve la géométrie complète.

`--preview-only` réalise une vue CPU des matériaux d'auteur sans modifier l'export.
`--skip-preview` évite seulement ce rendu de contrôle. Cette planche ne valide pas
la fidélité de la carte. La validation visuelle doit comparer le jeu exécuté à
`docs/mandats-diorama/reference-ordinateur.png`, en vue nationale et rapprochée,
puis sur les formats mobiles.

Les 154 adresses dominantes utilisent les nouvelles variantes avec une hauteur totale plafonnée à 0,34 unité et à 2,05 fois leur largeur ou profondeur maximale. Les autres bâtiments conservent leurs modèles et hauteurs. Le champ `bodyHeight` du JSON indique la hauteur du corps de chaque maison dans les unités du modèle, avant la mise à l’échelle du jeu.
