# Végétation du diorama

Le script `vegetation.py` génère sept modèles locaux avec Blender 4.3.2 : chêne,
hêtre, pin, cyprès, olivier, fruitier et roche. Les six arbres possèdent une
variante `_distant` pour leur faible couverture à l’écran. Les couleurs sont
portées par les sommets ; le kit garde ses matériaux mats et ses origines au sol.

Depuis la racine du dépôt :

```sh
blender --background --threads 6 --python tools/mandats-assets/vegetation.py
```

La commande crée `tools/mandats-assets/vegetation.blend` et exporte uniquement
`site/public/mandats/models/vegetation.glb`. Elle lit le relevé local
`vegetation-bounds.json` pour conserver les dimensions des treize modèles.
Elle ne dépend pas d’un répertoire de vérification ni des sources d’architecture.

## Kit retenu pour la capture 22

Les feuillus portent des bouquets plus petits, verticaux et dissymétriques.
Les pins ont des ramures angulaires étagées et une pointe, conservées dans les
variantes distantes. Le cyprès garde un contour étroit interrompu. Une palette
olive avec des valeurs éclairées et sombres distinctes remplace les verts les
plus noirs, sans changer la lumière du jeu. La teinte d’écorce reste la même.
La géométrie, les attributs et les couleurs de la roche sont conservés exactement.

Les modèles détaillés et distants des arbres changent de géométrie et de couleur.
Une normalisation finale conserve leurs bornes exportées exactes, leurs noms et
leurs pivots. La décimation protège le composant du tronc relié au sol sur chaque
copie distante. Babylon garde les correspondances de matériau entre les niveaux.

| Modèle | Détaillé 15 | Distant 15 | Détaillé 22 | Distant 22 |
| --- | ---: | ---: | ---: | ---: |
| Chêne | 1760 | 139 | 1576 | 172 |
| Hêtre | 1352 | 116 | 1144 | 144 |
| Pin | 3224 | 223 | 1860 | 228 |
| Cyprès | 824 | 69 | 824 | 106 |
| Olivier | 832 | 109 | 832 | 109 |
| Fruitier | 728 | 102 | 728 | 102 |
| Roche | 80 | aucun | 80 | aucun |
| Total | 8800 | 758 | 7044 | 861 |

Ce sont les triangles réellement exportés dans le GLB. Le
[manifeste](vegetation-lod-manifest.json) conserve les counts, les empreintes et
les bornes par modèle. La génération depuis le dépôt produit le même GLB que le
candidat externe retenu, octet par octet. Les treize modèles ont des positions,
couleurs et normales finies, des normales unitaires et des indices valides.

Le chargeur Babylon réel a été vérifié dans NullEngine avec ce GLB : sept
préfabriqués, dix-neuf parties détaillées liées aux variantes distantes, couleurs
présentes et réutilisation des variantes teintées. La destruction du kit retire
ses maillages, transforms, matériaux et géométries ; seule la texture BRDF partagée
appartenant à la scène reste jusqu’à la destruction de celle-ci. Après destruction
de la scène et du moteur, aucun de ces éléments ni aucune texture ne reste.

GLB retenu : 721552 octets ; SHA256
`44ba0d18ea0aa4e8f2211d20b88fb4b9904cf4f1b8518066fdd3ec278e700a0b`.
Le versionnement des URL et du cache hors connexion est recalculé au build.
Ces contrôles portent sur les modèles et leur chargement. La fidélité artistique,
la sélection des niveaux et les performances dans le jeu restent à vérifier
sur les captures et mesures de la prochaine version.
