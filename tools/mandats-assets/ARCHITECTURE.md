# Architecture de MANDATS

`architecture.glb` est un kit de modèles 3D créé pour ce dépôt. Il ne contient ni
fond de carte photographique, ni écran de jeu intégré dans une texture.

Le générateur d'auteur est `tools/mandats-assets/architecture.py`, exécuté avec
Blender 4.3.2. Le fichier source `architecture.blend` et son atlas de couleurs sont
conservés dans le même répertoire que ce script. La géométrie et les matériaux ne
proviennent pas d'une bibliothèque tierce.

Le kit comprend dix-huit maisons, fermes ou boutiques régionales et trois
monuments distincts, avec une version de distance de chaque modèle. Chaque modèle
possède une racine nommée et un enfant maillé,
avec son origine d’auteur au niveau du sol. L'export GLTF utilise l'axe Y
vertical. `architecture.json` fournit les dimensions réelles du modèle, avant la
mise à l'échelle effectuée par la carte.

Les murs, couvertures, lucarnes, cheminées, encadrements et monuments sont des
volumes. Les maisons partagent un atlas UV local de 2 048 pixels. Les matériaux
colorés et l'occlusion de contact sont précalculés séparément dans Blender, après avoir
séparé physiquement les modèles pendant la cuisson. Deux cartes de 1 024 pixels
conservent le grain des normales et les canaux ORM : occlusion, rugosité et métal.
Le fichier GLB incorpore les trois textures pour fonctionner sans service externe et pendant
une partie hors ligne.

La correction des matières du 8 octobre conserve strictement les vingt et un
maillages détaillés, leurs origines et dimensions. L’albédo ne contient plus
d’ombres permanentes. L’occlusion de contact possède une portée de 0,085 unité et
un poids de 35 %, dans le canal rouge ORM. Le verre est plus lisse (0,14 à 0,21)
que l’ardoise (0,43 à 0,56), la terre cuite (0,54 à 0,65) et la pierre (0,73 à
0,85). Le fer et le zinc ont leurs propres valeurs métalliques. Les couvertures
d’ardoise disposent d’une teinte bleue sombre.

La palette de couverture du 9 octobre remplace les terres cuites trop pâles par
des teintes plus rouges : `tuile` utilise le RGB linéaire `(0,40; 0,115; 0,048)`,
`tuile_claire` `(0,55; 0,185; 0,064)` et `ardoise` `(0,045; 0,065; 0,085)`.
Les couleurs des murs, briques et pierres restent les mêmes. Cette modification
recalcule l’albédo à partir des matériaux d’auteur ; elle ne modifie aucune
géométrie, coordonnée UV, normale, transformation, emprise ou texture PBR.
La fidélité des teintes à la maquette doit être examinée dans la capture du jeu.

La préparation utilise un seul maillage temporaire pour le placement UV. Des
attributs de face et de boucle permettent de reporter les coordonnées exactes
sur les modèles originaux. Cette étape évite de superposer les UV individuels
des maisons dans l'atlas. La marge est exprimée en fraction de l’image, au lieu
du mode relatif qui laissait de grands espaces entre de petits îlots. Le nouvel
atlas utilise 70,93 % de surface UV utile. Le script refuse une surface UV totale supérieure à
l'espace disponible; la vue de contrôle vérifie ensuite les couleurs réelles.

Pour reproduire les fichiers depuis la racine du dépôt :

```sh
blender --background --threads 6 --python tools/mandats-assets/architecture.py
```

Pour recuire seulement les couleurs après une modification de palette, à partir
du `.blend` et des cartes PBR déjà présents :

```sh
blender --background --threads 6 --python tools/mandats-assets/architecture.py -- --albedo-only --skip-preview
```

Ce mode vérifie la géométrie haute régénérée, conserve exactement son placement
UV, cuit un nouvel albédo et réutilise les cartes de normales, rugosité, métal,
occlusion et ORM existantes. Les modèles de distance sont ensuite réexportés par
`architecture_lod.py`. `--skip-preview` évite seulement le rendu de contrôle
Blender en fin de génération.

Le fichier `.blend` garde uniquement la géométrie haute complète. Pour régénérer
les versions de distance et l'export GLB depuis ce fichier, sans nouvelle cuisson
des textures et sans modifier la source :

```sh
blender --background --threads 2 --python tools/mandats-assets/architecture_lod.py
```

Les racines de distance sont nommées `nom_du_modele_distant`. La décimation
Blender conserve 35 % des triangles domestiques, 45 % de ceux de la cathédrale et
40 % de ceux des autres monuments. Les UV, normales et références des matériaux
restent présents; aucune texture ni matière n'est dupliquée. Le script refuse une
dérive des dimensions supérieure à 1,5 %, puis rétablit les emprises exactes dans
les coordonnées du maillage pour conserver le niveau du sol et les mêmes
transformations lors du changement de détail. Les comptes du JSON décrivent les
triangles du maillage Blender ; l’exporteur élimine les triangles sans aire.
Le GLB actuel conserve les mêmes comptes exportés que la version précédente,
soit 31 996 triangles sur les deux niveaux réunis.

Le moteur peut instancier `nom_du_modele_distant` pour une vue éloignée et
`nom_du_modele` pour une inspection. Les deux racines partagent l'origine et les
dimensions. Ce choix de rendu ne change aucun état de partie. Le JSON version 2
documente chaque réduction avec `lodOf`, `lodRatio`, les triangles réels et la
dérive mesurée avant correction des emprises.

Le script produit aussi une véritable vue de contrôle de cinq modèles dans
`/workspace/mandats-verification/architecture-kit-preview.png`. Cette vue sert à
examiner le kit; seules les captures de Babylon dans le navigateur permettent
de vérifier la composition finale de la carte.

`--preview-only` produit une vue de la géométrie et des matériaux sources sans
remplacer l'export de production. Les rendus utilisent Cycles sans débruitage,
car l'installation cloud de Blender ne comprend pas OpenImageDenoise.
