# Études de modèles existants pour MANDATS

Ces recettes adaptent des modèles CC0 dans Blender. Elles produisent leurs exports
hors de `site/public/`. La maison finie est intégrée dans la branche du diorama,
avec ses deux implantations à Besançon ; les autres études restent des candidats.
L'étude initiale, ses images et
ses limites sont dans [le dossier de preuve](../../docs/mandats-diorama/library-study-20261009/README.md).

## Sources retenues

- Rocher `boulder_01`, Rico Cilliers, [Poly Haven](https://polyhaven.com/a/boulder_01),
  [CC0](https://polyhaven.com/license).
- Pièces de maison, Quaternius, Medieval Village MegaKit standard, distribution
  du 22 avril 2025 conservée dans le
  [miroir](https://github.com/J-Ponzo/gltf-medieval-village-megakit/tree/21104b4045261c28fc312360841ed1a7b0ac8782).
  Son fichier LICENSE est CC0. La
  [page officielle d'avril 2025](https://raw.githubusercontent.com/Quaternius/quaternius.github.io/078c6fd1b03ba0e41b25bc491cd3e398261e384e/packs/medievalvillagemegakit.html)
  annonce explicitement CC0 pour les trois éditions. Cette preuve porte sur
  l'édition archivée ; la licence générale QAL publiée en août 2026 reste distincte.

`sources.json` fixe les URL, tailles et SHA256 des fichiers réellement examinés.
Il conserve aussi les cinq études Poly Haven, dont les originaux de végétation
restent trop lourds ou mal adaptés au rendu demandé. Le cache complet représente
496 066 206 octets ; les deux études de maison et de rocher utilisent
44 fichiers, 48 634 608 octets. Les sources ne sont pas commitées.

## Reproduire

Depuis la racine du dépôt, Python 3.12, Blender 4.3.2 et Pillow sont disponibles
sur la machine vérifiée. Garder le cache et les exports hors du checkout.

```bash
python tools/mandats-library-assets/download-sources.py --cache /workspace/mandats-library-sources
blender --background --disable-autoexec --threads 6 --python-exit-code 1 --python tools/mandats-library-assets/adapt-boulder.py -- --source-dir /workspace/mandats-library-sources/polyhaven/boulder_01 --output-dir /workspace/mandats-library-reproduced
blender --background --disable-autoexec --threads 6 --python-exit-code 1 --python tools/mandats-library-assets/assemble-house.py -- --source-dir /workspace/mandats-library-sources/quaternius/glTF --output-dir /workspace/mandats-library-reproduced
python tools/mandats-library-assets/seat-house.py --directory /workspace/mandats-library-reproduced
python tools/mandats-library-assets/inspect-exports.py --directory /workspace/mandats-library-reproduced
```

Le téléchargement vérifie la taille et le SHA256 avant de placer chaque fichier
dans le cache. Il refuse d'écraser un cache différent. `--all` inclut les études
de végétation. Le User-Agent déclaré identifie le projet auprès de Poly Haven.
Les fichiers téléchargés ne déclenchent aucun script Blender embarqué.

## Résultat de l'étude initiale du 9 octobre

Les commandes ont été exécutées. Un second téléchargement dans un cache vide a
vérifié les 44 fichiers. Les trois GLB reproduits sont identiques octet par octet
aux candidats inspectés. Le rocher compte 900 triangles. La maison exportée
compte 1 481 triangles en détail et 287 à distance, avec six primitives par
niveau. Ces nombres viennent du GLB ; le comptage Blender avant export diffère.

Le recalage corrige le minY de la géométrie réellement exportée à distance et
transforme ses normales avec la matrice inverse. Il ne prouve pas l'appui des
instances sur le terrain. L'inspection conserve deux désaccords entre normales
moyennes et normales de face sur le rocher et sur la maison détaillée. Elle ne
les masque pas derrière un statut de conformité physique.

Les images de studio sont des rendus 3D de ces composants, pas la carte finale.
L'import expérimental dans Babylon ne remplace pas les contrôles de placement,
la revue de la maquette, les délais des parcours existants ni les essais mobiles.

## Finition et composition du kit

La [finition de la maison](HOUSE-ATLAS.md) regroupe ses matières dans un atlas par
niveau, corrige les normales et reconstruit un niveau de distance plus fidèle.
La source est l'export recalé de l'atelier conservé, SHA256
`faf6d7be24644ae2a9869d958a0791f0f659d3988a8cfa0c251249e43d6645d0`.

```bash
blender --background --disable-autoexec --threads 2 --python-exit-code 1 --python tools/mandats-library-assets/finish-house.py -- --source docs/mandats-diorama/library-study-20261009/library-house-miniature-seated.glb --output-dir /workspace/mandats-house-finished
python tools/mandats-library-assets/inspect-exports.py --directory /workspace/mandats-house-finished --files library-house-atlas.glb --report house-atlas-audit.json --strict-house
git show 5cf6fcf4b0783188e21e27e38f9666ba0ff9946f:site/public/mandats/models/architecture.glb > /workspace/mandats-house-finished/architecture-before.glb
git show 5cf6fcf4b0783188e21e27e38f9666ba0ff9946f:site/public/mandats/models/architecture.json > /workspace/mandats-house-finished/architecture-before.json
python tools/mandats-library-assets/compose-house-kit.py --base /workspace/mandats-house-finished/architecture-before.glb --metadata /workspace/mandats-house-finished/architecture-before.json --house /workspace/mandats-house-finished/library-house-atlas.glb --output /workspace/mandats-house-finished/architecture.glb
```

La composition doit partir du kit d'auteur original, avant l'ajout de la maison
CC0, ou du kit nouvellement régénéré par `architecture_lod.py`. Ne pas composer
plusieurs fois à partir d'un export déjà composé : le script refuse ses racines
dupliquées. Le reçu conserve les empreintes, les 70 autres racines actives
et tous leurs tableaux JSON et octets d'origine. Après les contrôles du navigateur,
copier ensemble les deux fichiers `architecture.glb` et `architecture.json`
produits dans `site/public/mandats/models/`, puis reconstruire le site pour
actualiser les URL versionnées et le précache. `--skip-preview` omet uniquement
les deux rendus de studio et ne change pas l'export.
