# Végétation du diorama

`vegetation.py` génère sept modèles locaux avec Blender 4.3.2 : chêne,
hêtre, pin, cyprès, olivier, fruitier et roche. Les six arbres possèdent une
variante `_distant`. Les couleurs sont portées par les sommets, les matériaux
sont mats et les origines restent au sol.

Depuis la racine du dépôt :

```sh
blender --background --threads 2 --python tools/mandats-assets/vegetation.py
python3 tools/mandats-assets/inspect-vegetation.py --output /tmp/vegetation-audit.json
```

La génération crée `vegetation.blend` et exporte seulement
`site/public/mandats/models/vegetation.glb`. Le relevé `vegetation-bounds.json`
conserve les dimensions exactes des treize modèles. La génération ne dépend
ni d'un répertoire de vérification ni des sources d'architecture.

## Modèles de l'itération 43

Les feuillus portent des bouquets composés de petites pousses dissymétriques.
Les pins gardent leurs ramures angulaires étagées et leur pointe. Les cyprès
gardent un contour étroit interrompu. Des tons olive, éclairés et sombres,
remplacent les feuillages trop pâles observés dans les captures précédentes.
La teinte d'écorce est conservée.

Chaque arbre exporte une seule primitive : son écorce et ses feuillages partagent
le même matériau mat, avec leurs couleurs distinctes dans `COLOR_0`. Cette
organisation réduit le nombre de parties instanciées par Babylon. Les bornes,
noms et pivots sont conservés exactement. La décimation protège le composant
du tronc relié au sol sur chaque copie distante. La roche conserve ses attributs,
indices et couleurs précédents.

| Modèle | Triangles détaillés | Triangles distants | Primitives par niveau |
| --- | ---: | ---: | ---: |
| Chêne | 2596 | 426 | 1 |
| Hêtre | 1804 | 340 | 1 |
| Pin | 1860 | 378 | 1 |
| Cyprès | 1424 | 228 | 1 |
| Olivier | 1312 | 135 | 1 |
| Fruitier | 1148 | 136 | 1 |
| Roche | 80 | aucune variante | 1 |
| Total | 10224 | 1643 | |

Ce sont les triangles décodés dans le GLB exporté. Le
[manifeste](vegetation-lod-manifest.json) conserve les empreintes, nombres de
primitives et bornes par modèle. Une seconde génération depuis le dépôt a
reproduit le modèle retenu octet par octet. Les treize modèles ont des attributs
finis, des normales unitaires et des indices valides. L'audit ne relève aucun
triangle dégénéré ni désaccord entre la normale d'une face et ses sommets.

GLB retenu : 1203012 octets ; SHA256
`9614a8ab7d69bc8c3e9c13ae5252baf177519fabe77afa92f24cbc6772174872`.
La comparaison utilise les octets du GLB du commit précédent, dont le SHA256
est `5cd9595f3818e0123847db180d9b1dbac12260b190d35bf32f004e910acbdd42`.
Les feuillus utilisent sept petites pousses plus espacées par bouquet, contre
cinq pousses plus volumineuses précédemment. Les couronnes détaillées et
distantes sont modifiées ensemble. Le pin et la roche conservent leurs
attributs, indices et couleurs exactement.

La sélection réelle des modèles de végétation détaillés utilise maintenant
une couverture d'écran de 0,0024, contre 0,0012 précédemment. Les bâtiments
gardent 0,0012. Cette modification appartient au moteur livré ; les captures
n'imposent aucun niveau de détail. Les deux variantes de chaque arbre gardent
leurs bornes exactes, y compris le composant du tronc relié au sol.

Le versionnement des URL et du cache hors connexion est recalculé au build.
Ces contrôles établissent la structure et la reproductibilité des modèles.
La sélection des niveaux, les performances et la fidélité artistique doivent
être évaluées dans le jeu réel ; un audit de GLB ne suffit pas à les établir.
