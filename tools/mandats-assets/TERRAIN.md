# Maillage de terrain de MANDATS

`bake-terrain.mjs` exécute le générateur canonique `buildLandscapeSurvey`
dans Babylon NullEngine, sans navigateur, caméra ou état de partie. Il exporte
les vrais sommets, indices, normales, couleurs, UV et familles géologiques de
la France, de ses cultures, falaises et cours d'eau. Il ne contient aucune vue
de la scène ni image de la maquette.

L'archive `site/public/mandats/models/terrain-survey.bin.gz` utilise un en-tête
JSON et des vues binaires alignées, puis une compression gzip déterministe.
Les positions et autres attributs conservent les valeurs float32 réellement
envoyées à WebGL. Les coordonnées analytiques de `landHeight` restent en double
précision. Le manifeste mesure l'arrondi maximal par maillage : moins de
`4,8 × 10⁻⁷` unité dans cet export, face à des dégagements de plusieurs millièmes.

Les sommets sans indice sont retirés. Les 299 816 triangles visibles sont
conservés, avec 326 044 sommets au lieu de 437 985. L'archive compte 17 maillages,
8 matériaux et aucun point de verger dans ce relevé. Elle pèse 10 187 628 octets
compressés pour 19 779 512 octets décodés. Cette ressource supplémentaire échange
du transfert et du stockage hors connexion contre le calcul du terrain dans le
navigateur ; les contrôles de chargement doivent établir le résultat réel.

En développement, la scène utilise directement le générateur. En production,
`map-landscape-cache.ts` reconstruit des `Mesh` Babylon à partir de l'archive,
avec les mêmes textures locales, matériaux et plugins de surface. Les arbres,
le couvert neigeux final, les fondations, les véhicules et les effets des vraies
décisions restent construits dans la scène. Une archive indisponible déclenche
le générateur canonique. Le précache facultatif inclut son URL versionnée.

Recréation depuis la racine du dépôt :

```sh
node --experimental-strip-types site/scripts/mandats-model-revisions.ts
node tools/mandats-assets/bake-terrain.mjs
node site/scripts/mandats-terrain-check.mjs
```

Le manifeste conserve les empreintes de 45 sources et de la version Babylon.
Les commandes `build` et `build:client` refusent une archive périmée ou une URL
qui ne correspond pas à ses octets. Après modification d'une dépendance du
relevé, il faut réexporter avant le build. L'empreinte de l'archive actuelle est
`59447be34fc797502392c80d6cbc30506b30abec472ed2b44ee9de36b201b528`.

NullEngine vérifie la fabrication des données ; il ne valide ni les shaders,
ni le rendu artistique, ni le fonctionnement hors connexion dans un navigateur.
Ces points demandent les captures de production et les parcours Playwright.
