# Modèles du diorama MANDATS

Les modèles architecturaux et végétaux sont créés pour ce dépôt avec Blender
4.3.2. Les fichiers GLB distribués dans `site/public/mandats/models/` contiennent
leur géométrie, leurs couleurs et leurs textures locales. Ils n'emploient pas de
décodeur distant, d'image de carte ou de capture du jeu comme décor.

Depuis la racine du dépôt :

```sh
blender --background --threads 6 --python tools/mandats-assets/architecture.py
blender --background --threads 6 --python tools/mandats-assets/architecture_lod.py
blender --background --threads 6 --python tools/mandats-assets/paris.py
blender --background --threads 6 --python tools/mandats-assets/paris_lod.py
blender --background --threads 6 --python tools/mandats-assets/cathedrale.py
blender --background --python tools/mandats-assets/vegetation.py
```

Le [kit régional](ARCHITECTURE.md), les [façades parisiennes](PARIS.md) et la
[cathédrale](CATHEDRALE.md) conservent leurs fichiers Blender et leurs atlas UV.
L'albédo ne contient pas d'occlusion ; les contacts précalculés, les rugosités et
les métaux occupent les canaux séparés de la texture ORM. Le kit végétal possède
sept silhouettes : chêne,
hêtre, pin, cyprès, olivier, arbre fruitier et roche. Ses couleurs par sommet
incluent une variation de teinte et une ombre locale sur les couronnes et troncs.
Cette variation n'est pas une texture d'occlusion cuite.

Les variantes `_distant` réduisent la géométrie des objets petits à l'écran,
avec les mêmes origines et matériaux. Babylon choisit ces modèles selon leur
couverture à l'écran dans la caméra en perspective. Une inspection retrouve
les modèles complets. Les modèles assombris des pays voisins partagent la
géométrie du kit ; leurs sources restent hors de la hiérarchie des préfabriqués.

Les racines des modèles sont centrées au contact du sol et exportées avec l'axe
Y vertical. Le jeu charge les quatre bibliothèques via `map-asset-kit.ts`, puis
partage leur géométrie et leurs matériaux entre les exemplaires. Les quartiers,
rivières, cultures et végétaux utilisent la même hauteur du terrain. Les acteurs
des mobilisations et projets continuent de venir de la partie sauvegardée.

Le script de préparation hors connexion ajoute récursivement les modèles,
buffers et textures du répertoire distribué au cache optionnel du jeu. Une
modification des GLB change l'empreinte de ce cache.
`npm run dev` et `npm run build`, depuis `site/`, régénèrent également les URL
versionnées par leur contenu. Après une génération Blender avec un serveur
déjà ouvert, exécuter `node --experimental-strip-types scripts/mandats-model-revisions.ts`
depuis `site/` pour actualiser ces URL. Cette version évite de charger un ancien
kit depuis un service worker encore actif avec le nouveau code du jeu.

Une planche de modèles ne valide pas la carte. La comparaison obligatoire porte
sur le jeu exécuté, à côté de `docs/mandats-diorama/reference-ordinateur.png`,
avec vues nationales, inspections et formats mobiles.

Les matériaux PBR utilisent aussi un [éclairage extérieur préfiltré](lighting/README.md)
local. La source HDR, sa licence et la procédure de reproduction sont conservées ;
seul le cube `.env` précalculé est distribué et inclus au cache optionnel.

Les fins [contours régionaux](geography/README.md) viennent du sous-ensemble
français Natural Earth conservé. Leur script retire les limites départementales
et les côtes ; les rubans suivent ensuite le relief réel du diorama.
