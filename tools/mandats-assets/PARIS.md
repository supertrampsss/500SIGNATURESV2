# Architecture parisienne de MANDATS

Ce kit distinct est une création originale pour le dépôt. Il vise les façades
claires, fines et verticales de la maquette confirmée dans
`docs/mandats-diorama/reference-ordinateur.png`. Aucun modèle, atlas ou détail ne
provient d'une bibliothèque externe. Les anciens fichiers `architecture.glb`
et `architecture.blend` restent indépendants.

`paris.py`, exécuté avec Blender 4.3.2, compose trois modèles :

* `immeuble_paris_01` : cinq travées, rez-de-chaussée et trois étages, baies
  réellement ouvertes dans la façade, encadrements moulurés, balcons en fer,
  balcon continu, corniche fine, toiture mansardée, lucarnes et cheminées.
* `hotel_angle_paris_01` : deux façades détaillées, pan coupé géométrique,
  entrée d'angle, arcades vitrées au rez-de-chaussée, balcons et toit mansardé.
* `front_mitoyen_paris_01` : trois maisons jointives de hauteurs différentes,
  pierre et enduits variés, volets, commerce, balcons et couvertures différentes.

Les ouvertures possèdent une vraie épaisseur de mur et un vitrage en retrait.
Les cadres, garde-corps, arcades, appuis et ornements sont des volumes. Les
façades arrière possèdent des fenêtres de cour sobres ; les côtés de l'immeuble
et les deux extrémités du front mitoyen ont des baies secondaires. Les façades
principales gardent les balcons et le travail ornemental dominant. Les raccords
entre murs sont ajustés pour éviter les faces extérieures coplanaires qui
produisent des bandes noires par auto-ombrage. Les modèles gardent leur empreinte
centrée et leur origine au sol. Après export
GLTF Y-up, la façade principale regarde +Z ; la seconde façade de l'hôtel
regarde +X. `site/public/mandats/models/paris.json` contient leurs dimensions et
budgets de triangles réels. L'intégration doit préserver ces proportions avant
de juger la silhouette dans le jeu.

Les trois modèles partagent un seul matériau PBR et un atlas de couleurs de
2 048 pixels. L'albedo garde la couleur physique des matériaux. Une carte
d'occlusion indépendante, des normales tangentes et des rugosités distinctes
sont cuites à 1 024 pixels. Le verre est lisse, le fer métallique, et la pierre
plus rugueuse. L'export GLTF réunit l'occlusion et les propriétés métalliques
dans les canaux ORM du même fichier intégré au GLB, sans accès externe.

Les UV sont réunis et placés dans un seul maillage temporaire, puis reportés
sur les sources. Une projection commune conserve la même densité de pixels
sur les trois modèles. Le placement utilise une marge UV absolue avec
`margin_method="FRACTION"` et `.0008`, puis une cuisson avec une marge d'un pixel.
Les faces couvrent 59,883 % de l'atlas, contre 6,85 % avec les anciennes marges
proportionnelles. Le script refuse une couverture inférieure à 40 % pour
empêcher de perdre à nouveau la résolution utile des détails.
Les modèles sont physiquement espacés pendant la cuisson pour
éviter toute occlusion produite par une autre maison du kit. Le fichier source
`.blend` conserve les maillages, le matériau et les textures intégrées.

Depuis la racine du dépôt :

```sh
blender --background --threads 6 --python tools/mandats-assets/paris.py
```

`--shape-preview` produit seulement un rendu de la géométrie et des matériaux
sources, sans remplacer le kit de production. `--skip-bake` réutilise les images
locales existantes après une modification qui ne change pas les UV.

Les versions `nom_du_modele_distant` utilisent une décimation de `.16` pour
l'immeuble et de `.12` pour les deux autres modèles. Les extrémités de façade de
l'immeuble disparaissaient avec une réduction plus forte ; cette limite est
vérifiée avant export. Le matériau, les UV et les origines restent partagés.
Chaque clone passe une validation de maillage qui retire les triangles
dégénérés après la décimation, en conservant les données UV. Les budgets réels
du GLB, après ce nettoyage, sont indiqués ci-dessous. Les dimensions exactes
sont rétablies après une dérive qui doit rester inférieure à 2 %, puis une
seconde validation confirme la topologie et les normales finies. La source
`.blend` garde seulement la géométrie complète. Pour régénérer uniquement les LOD et le
GLB depuis cette source, sans recuire ni modifier les fichiers sources :

```sh
blender --background --threads 2 --python tools/mandats-assets/paris_lod.py
```

| Modèle | Largeur | Profondeur | Hauteur | Triangles détaillés | Triangles distants |
| --- | ---: | ---: | ---: | ---: | ---: |
| `immeuble_paris_01` | 1.872 | 1.287 | 2.485 | 18 642 | 2 371 |
| `hotel_angle_paris_01` | 1.771 | 1.6105 | 2.315 | 15 055 | 1 108 |
| `front_mitoyen_paris_01` | 3.207 | 1.227 | 2.135 | 21 240 | 1 600 |

Le GLB contient six maillages et un matériau, avec les trois images intégrées
(couleur, normales, ORM). Il n'utilise ni URI externe ni extension GLTF.

Les vues de contrôle sont conservées dans
`/workspace/mandats-verification/authored-3d/paris-source-preview.png` et
`paris-atlas-preview.png`. Elles permettent d'inspecter le kit. Seules les
captures du moteur, avec la composition complète et la caméra du jeu, peuvent
établir la fidélité visuelle finale à la référence.

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
