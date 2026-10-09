# Crédits des modèles MANDATS

Les modèles architecture.glb, paris.glb, cathedrale.glb et vegetation.glb sont façonnés pour ce dépôt avec Blender. Leurs sources sont conservées dans tools/mandats-assets.

L’éclairage daylight.env est dérivé de umhlanga_sunrise_1k.hdr, publié dans [Babylon.js Assets](https://github.com/BabylonJS/Assets/blob/master/environments/umhlanga_sunrise_1k.hdr) par les contributeurs Babylon.js Assets, sous [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Transformation : conversion en cube 256 px, balance de radiance linéaire RGB multipliée par (1.15, 1.00, 0.65), puis recalcul cohérent du préfiltrage de radiance et des harmoniques sphériques avec Babylon.js 9.30.0. Cette adaptation locale atténue le bleu du ciel pour la direction artistique du diorama. Le panorama brut et le cube préfiltré original sont conservés inchangés. Aucune photographie de ce panorama n’est affichée comme décor.

La source HDR, la licence et les empreintes sont conservées dans tools/mandats-assets/lighting. La référence de la carte est docs/mandats-diorama/reference-ordinateur.png.

Les contours régionaux proviennent de [Natural Earth 10m Admin 1](https://www.naturalearthdata.com/), données du [domaine public](https://www.naturalearthdata.com/about/terms-of-use/). Les 96 départements métropolitains du sous-ensemble conservé sont regroupés en 13 régions. Seules les frontières partagées entre régions distinctes sont rendues ; les limites départementales et le littoral sont exclus. Les données, leur empreinte et la reproduction sont conservées dans tools/mandats-assets/geography.
