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

## Modèles de l'itération 40

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
| Chêne | 1916 | 132 | 1 |
| Hêtre | 1364 | 134 | 1 |
| Pin | 1860 | 378 | 1 |
| Cyprès | 1024 | 161 | 1 |
| Olivier | 992 | 101 | 1 |
| Fruitier | 868 | 101 | 1 |
| Roche | 80 | aucune variante | 1 |
| Total | 8104 | 1007 | |

Ce sont les triangles décodés dans le GLB exporté. Le
[manifeste](vegetation-lod-manifest.json) conserve les empreintes, nombres de
primitives et bornes par modèle. Une seconde génération depuis le dépôt a
reproduit le modèle retenu octet par octet. Les treize modèles ont des attributs
finis, des normales unitaires et des indices valides. L'audit ne relève aucun
triangle dégénéré ni désaccord entre la normale d'une face et ses sommets.

GLB retenu : 910600 octets ; SHA256
`ae3495cea9ef8d8fcfea18afc80b65eb976a3b63b0ba422930554d58059229ef`.
La comparaison utilise les octets du GLB du commit précédent, dont le SHA256
est `ff03f10336871efcec8e2c2867044215eaa522b873283590c4f3e8387213c4de`.
Les ramures du pin et le contour du cyprès distants conservent davantage de
triangles que dans l'itération 39. Les six modèles détaillés restent identiques.

Le versionnement des URL et du cache hors connexion est recalculé au build.
Ces contrôles établissent la structure et la reproductibilité des modèles.
La sélection des niveaux, les performances et la fidélité artistique doivent
être évaluées dans le jeu réel ; un audit de GLB ne suffit pas à les établir.
