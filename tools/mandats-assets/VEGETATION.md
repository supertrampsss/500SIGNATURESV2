# Végétation du diorama

`vegetation.py` génère sept modèles locaux avec Blender 4.3.2 : chêne,
hêtre, pin, cyprès, olivier, fruitier et roche. Les six arbres possèdent une
variante `_distant`. Les couleurs sont portées par les sommets, les matériaux
sont mats et les origines restent au sol.

Depuis la racine du dépôt :

```sh
blender --background --threads 2 --python tools/mandats-assets/vegetation.py
python3 tools/mandats-assets/inspect-vegetation.py --revision 52 --output /tmp/vegetation-audit.json
```

La génération crée `vegetation.blend` et exporte seulement
`site/public/mandats/models/vegetation.glb`. Le relevé `vegetation-bounds.json`
conserve les dimensions exactes des treize modèles. La génération ne dépend
ni d'un répertoire de vérification ni des sources d'architecture.

## Modèles de l'itération 52

Les feuillus portent des bouquets associant un cœur opaque réduit et neuf
surfaces de feuilles pliées, inclinées dans plusieurs directions. Un atlas
local de 512 × 512 pixels découpe leurs contours. Ces surfaces restent fixes
dans les branches ; elles ne s'orientent pas vers la caméra. Les pins gardent
leurs volumes de ramures angulaires et leur pointe. Les couleurs olive,
éclairées et sombres restent portées par les sommets.

Chaque arbre exporte une seule primitive : son écorce et ses feuillages partagent
le même matériau mat, avec leurs couleurs distinctes dans `COLOR_0`. L'atlas
est embarqué dans le GLB. Les UV d'écorce et des cœurs opaques utilisent une
zone blanche ; seules les feuilles reçoivent des contours découpés. Le mode
glTF est `MASK`, avec un seuil de 0,45 et deux faces éclairées. Le renderer
conserve ce seuil lors de la copie des matériaux régionaux. Cette
organisation réduit le nombre de parties instanciées par Babylon. Les bornes,
noms et pivots sont conservés exactement. La décimation protège le composant
du tronc relié au sol, les cœurs de couronne et les surfaces feuillues retenues
sur chaque copie distante. Les autres branches sont décimées. La roche conserve ses attributs,
indices et couleurs précédents.

| Modèle | Triangles détaillés | Triangles distants | Primitives par niveau |
| --- | ---: | ---: | ---: |
| Chêne | 1168 | 586 | 1 |
| Hêtre | 880 | 394 | 1 |
| Pin | 1860 | 378 | 1 |
| Cyprès | 584 | 352 | 1 |
| Olivier | 640 | 293 | 1 |
| Fruitier | 560 | 266 | 1 |
| Roche | 80 | aucune variante | 1 |
| Total | 5772 | 2269 | |

Ce sont les triangles décodés dans le GLB exporté. Le
[manifeste](vegetation-lod-manifest.json) conserve les empreintes, nombres de
primitives et bornes par modèle. Une seconde génération depuis le dépôt a
reproduit le modèle retenu octet par octet. Les treize modèles ont des attributs
finis, des normales unitaires et des indices valides. L'audit ne relève aucun
triangle dégénéré ni désaccord entre la normale d'une face et ses sommets.

GLB retenu : 767428 octets ; SHA256
`a9c329f886f98544e7bf7ab06ac0e81d8f622188f9e860268bb404f7378c86a5`.
La comparaison utilise les octets du GLB du commit précédent, dont le SHA256
est `b3eb53de00352151171db066afeb1311a112a11f6c7509d502a09415f370a350`.
Les couronnes détaillées et distantes sont modifiées ensemble. Les treize
bornes restent exactes ; l'audit confirme les attributs, indices et couleurs
de la roche. L'export Blender réserve un `COLOR_0` blanc sur le matériau
texturé et place les couleurs d'angle dans `COLOR_1` : la fabrication relie
cet accesseur au `COLOR_0` utilisé par glTF, avant de fixer le masque alpha.
Les surfaces feuillues supplémentaires augmentent les triangles des modèles
détaillés et distants. Ces comptes ne prouvent pas une hausse
de fréquence d'affichage.

Depuis l'itération 43, la sélection réelle des modèles détaillés utilise
une couverture d'écran de 0,0024, contre 0,0012 précédemment. Les bâtiments
gardent 0,0012. Cette modification appartient au moteur livré ; les captures
n'imposent aucun niveau de détail. Les deux variantes de chaque arbre gardent
leurs bornes exactes, y compris le composant du tronc relié au sol.

Le versionnement des URL et du cache hors connexion est recalculé au build.
Ces contrôles établissent la structure et la reproductibilité des modèles.
La sélection des niveaux, les performances et la fidélité artistique doivent
être évaluées dans le jeu réel ; un audit de GLB ne suffit pas à les établir.
