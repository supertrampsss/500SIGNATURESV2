# Éclairage du diorama

`daylight.env` est un cube de radiance préfiltré de 256 pixels par face,
avec harmoniques sphériques. Il éclaire les matériaux PBR de la miniature ;
le panorama source n'est pas affiché comme décor.

La source est `umhlanga_sunrise_1k.hdr` du dépôt
[Babylon.js Assets](https://github.com/BabylonJS/Assets/blob/master/environments/umhlanga_sunrise_1k.hdr).
Le dépôt publie ses actifs sous [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
La licence est conservée ici. `source.json` conserve le blob Git, la taille et
les empreintes SHA-256 de la source téléchargée et du fichier distribué.
Les crédits sont aussi accessibles depuis la méthode du jeu.

La version du 8 octobre 2026 adapte la balance de l'éclairage à la pierre chaude
et à l'ardoise du diorama. Chaque face du cube en radiance linéaire est multipliée
par `(1.15, 1.00, 0.65)` avant de calculer les harmoniques diffuses et les mipmaps
spéculaires. Les deux dérivations utilisent donc la même radiance corrigée.
Le panorama RGBE reste inchangé ; `daylight-original.env` conserve également le
cube préfiltré antérieur. Cette adaptation est une dérivation artistique locale,
qui ne modifie ni les modèles ni leurs atlas.

`prefilter-report.json` conserve la balance, les coefficients avant/après,
les coefficients exportés et le moteur WebGL utilisé. Pour la normale verticale,
l'irradiance RGB passe de `(0.748731, 0.948337, 1.386923)` à
`(0.855447, 0.948337, 0.901500)`. Le `.env` version 2 distribué contient les
54 images PNG des six faces et neuf niveaux de 256 à 1 pixel. Les empreintes
actuelles, originales et source sont dans `source.json`.

Avec les dépendances de `site/` installées et Chromium disponible, lancer
`npm run dev -- --host 127.0.0.1 --port 4179` depuis `site/`, puis depuis
la racine :

```sh
node tools/mandats-assets/lighting/prefilter.mjs
```

Le script prépare une page temporaire dans la racine autorisée par Vite et
la retire ensuite. Il utilise le préfiltrage Babylon.js 9.30.0 puis exporte
les mipmaps RGBD en PNG dans `site/public/mandats/models/daylight.env`.
Le serveur peut être passé comme premier argument et l'exécutable Chromium
avec `MANDATS_CHROMIUM_EXECUTABLE`. Régénérer ensuite les URL de modèles
ou lancer le build. Le panorama brut ne se charge jamais chez le joueur.
