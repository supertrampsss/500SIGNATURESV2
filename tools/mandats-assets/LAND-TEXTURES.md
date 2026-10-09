# Textures locales du terrain

Les huit PNG de `site/src/mandats/textures/` sont des cartes de matière répétées,
préparées depuis la recette TypeScript conservée dans `land-texture-recipe.ts`.
Ce sont les mêmes octets RGBA que ceux auparavant calculés au démarrage. La
recette comprend le porteur neutre des cultures de la passe 33.

Pour les reproduire, depuis la racine du dépôt avec les dépendances de `site/`
installées :

```sh
node tools/mandats-assets/generate-land-textures.mjs
```

Le générateur exécute la recette avec une capture de `RawTexture`, sans créer
d'Engine, de NullEngine ou de Scene. Il conserve le clamp, l'arrondi, les tableaux
Float32, l'ordre des lignes et l'alpha 255. Le PNG RGBA8 contient seulement IHDR,
IDAT et IEND, sans profil couleur ou correction gamma. `land-textures.json`
enregistre dimensions, SHA des pixels RGBA, SHA des PNG et réglages des textures.
Les PNG sont conservés dans les sources ; le build courant n'a pas à recalculer
ces particules. Régénérer ces fichiers si la recette change.

Vite transforme les URL littérales en fichiers distribués nommés par leur
contenu. La collecte hors connexion suit leurs URL dans les chunks du jeu. Le
runtime conserve mipmaps, orientation Y, trilinear, répétition, anisotropie,
gammaSpace, intensités des normales et échelles UV. Les PNG restent des textures
bloquantes pour `scene.executeWhenReady` ; leur arrivée ne déclare pas prématurément
le renderer prêt.

La comparaison RGBA établit l'identité des images stockées. Elle ne mesure pas
le gain au démarrage ni le rendu GPU ; il faut encore vérifier chargement réel,
capture, cache hors connexion et parcours navigateur. NullEngine ne décode pas
ces PNG : son contrôle physique ne constitue pas une preuve visuelle des textures.
