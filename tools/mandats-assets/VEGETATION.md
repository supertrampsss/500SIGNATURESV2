# Végétation du diorama

Le script `vegetation.py` génère sept modèles locaux avec Blender 4.3.2 : chêne,
hêtre, pin, cyprès, olivier, fruitier et roche. Les six arbres possèdent une
variante `_distant` pour leur faible couverture à l’écran. Leurs couleurs par
sommet, leur écorce, leurs matériaux et leurs origines restent partagés avec
le modèle détaillé. La roche conserve un seul niveau.

Depuis la racine du dépôt :

```sh
blender --background --threads 6 --python tools/mandats-assets/vegetation.py
```

La passe 15 réduit les variantes distantes. La décimation protège le composant
du tronc relié au sol sur la copie distante. Les rapports de décimation sont
adaptés par espèce pour conserver la couronne, le port élancé du pin et la
silhouette étroite du cyprès. Aucun sommet, indice, couleur, normale, UV,
matériau, nom, transform ou borne des sept modèles détaillés n’a changé.

| Modèle | Détaillé | Distant14 | Distant15 |
| --- | ---: | ---: | ---: |
| Chêne | 1760 | 482 | 139 |
| Hêtre | 1352 | 365 | 116 |
| Pin | 3224 | 741 | 223 |
| Cyprès | 824 | 229 | 69 |
| Olivier | 832 | 225 | 109 |
| Fruitier | 728 | 195 | 102 |
| Roche | 80 | aucun | aucun |

Les valeurs sont les triangles effectivement exportés dans le GLB. Le pin
lointain utilise 70 % de triangles en moins que la variante 14. Babylon choisit
les niveaux selon leur couverture à l’écran dans la caméra perspective ;
le modèle détaillé et les dimensions servant à placer l’arbre restent
inchangés. Les parties correspondantes conservent le même matériau.

## Vérification de la passe 15

Le [manifeste](vegetation-lod-manifest.json) conserve les empreintes exactes
et les mesures par modèle. Les attributs et indices des modèles détaillés,
les matériaux et les transforms ont été comparés octet par octet avec le
GLB 14 conservé. Les variantes distantes ont des positions et normales finies,
des normales unitaires, des indices valides, leurs couleurs et leur tronc.
Le contact au sol du tronc reste exact pour chaque espèce.

Des projections CPU des vrais triangles, à 7, 12 et 20 pixels de hauteur et
sous trois angles, ont contrôlé les silhouettes au même emplacement et à
la même échelle. Le recouvrement pondéré minimal atteint 0.871 pour le pin,
0.828 pour le chêne et0.836 pour le hêtre. Le cyprès reste plus sensible à
la couverture d’un contour étroit, avec 0.754 au minimum. Les couronnes
lointaines présentent moins de petits lobes que les modèles détaillés.

Le chargeur réel Babylon a aussi été exécuté dans NullEngine avec les octets
du GLB 15 : sept préfabriqués, dix-neuf parties détaillées liées à leur niveau
distant, couleurs présentes et destruction sans maillage ni texture résiduelle.
Ces contrôles portent sur les modèles. Les captures du jeu avec le GLB 14
conservent leur valeur historique ; la fidélité du rendu 15 et ses performances
sur ordinateur et téléphone nécessitent leurs propres captures et mesures.

GLB 15 : 811064 octets ; SHA256
`a76e9ce21413da32747a1fd9ff6f2f0c54460c2e4bfe6510ea3c23a459119ed5`.
Le versionnement des URL et du cache hors connexion est recalculé au build.
