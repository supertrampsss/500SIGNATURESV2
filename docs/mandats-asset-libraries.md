# Modèles existants pour le diorama MANDATS

Le 9 octobre 2026, le propriétaire a demandé de privilégier des modèles existants, retravaillés dans Blender, plutôt que de fabriquer tous les éléments par script. La [maquette confirmée](mandats-diorama/reference-ordinateur.png) reste la référence. La [comparaison réelle 37](mandats-diorama/comparaison-37.html) reste non conforme ; aucun nouveau modèle de bibliothèque n'est intégré dans cette version.

## Méthode retenue

Rechercher des bâtiments européens détaillés, une cathédrale gothique et une végétation organique. Examiner leur silhouette et leurs matières avant de choisir un pack. Importer les modèles retenus dans Blender, harmoniser leurs proportions, leurs textures et leur palette, puis les exporter en GLB pour Babylon.js. Vérifier le résultat dans la scène réelle, à la distance et à l'échelle de la référence, ainsi que le coût de chargement sur mobile.

Le terrain de France, les implantations et les manifestations issues des décisions restent propres au jeu. Des éléments existants ne dispensent pas de travailler la composition, le relief, l'éclairage et les ombres. Aucun aperçu de bibliothèque ne constitue une preuve de rendu dans MANDATS.

## Sélection documentaire initiale

| Source | État vérifié | Décision actuelle |
| --- | --- | --- |
| [Quaternius Medieval Village](https://quaternius.com/packs/medievalvillage.html) | Aperçu officiel lu depuis le dépôt du site : colombages, tuiles et petits accessoires détaillés. Le site présente une divergence entre des badges CC0 et sa nouvelle licence générale QALv1.0. | Piste visuelle seulement. La licence de l'archive exacte doit autoriser sa redistribution dans ce dépôt public avant tout import. |
| [Kenney](https://kenney.nl/assets) et [KayKit](https://kaylousberg.com/game-assets) | Aperçus City Builder et Medieval Hexagon réellement ouverts. Leurs volumes simples et leurs couleurs uniformes s'écartent de la miniature riche demandée. | Écartés comme base esthétique de la carte. |
| [Quaternius Medieval Village MegaKit 2025](https://github.com/J-Ponzo/gltf-medieval-village-megakit/tree/21104b4045261c28fc312360841ed1a7b0ac8782) | Archive standard datée du 22 avril 2025, LICENSE CC0, déclaration corroborée par la page officielle d'avril 2025. Douze composants et leurs dépendances téléchargés avec vérification des blobs Git et SHA256. | Maison témoin assemblée dans Blender et importée expérimentalement dans Babylon. Aucune généralisation ni adoption en production. |
| [Poly Haven](https://polyhaven.com/models) | Cinq modèles originaux avec textures téléchargés et vérifiés. Licence officielle CC0. Variantes et niveaux de détail existants ouverts dans Blender. | Rocher adapté et exporté ; jeunes sapins trop clairsemés, réduction uniforme du grand sapin écartée. |
| [Gothic cathedral, Gnemegorl](https://sketchfab.com/3d-models/8b8f08c852e949ecba39ca0dd29448f0) | Page officielle accessible : attribution Gnemegorl, CC BY 4.0, 537 464 triangles, neuf textures et onze matériaux. L'endpoint de téléchargement répond 401 et demande un compte ; l'API et l'hôte des aperçus restent refusés par le proxy. | Modèle non téléchargé, non importé et non validé visuellement. |
| [York Minster, Chris Bibb](https://sketchfab.com/3d-models/cc80db5047124ee29b526c5416981f6a) | Aperçu et licence originale non vérifiés ; ses tours carrées diffèrent des aiguilles de la référence. | Piste secondaire, sans validation visuelle ou juridique. |

Le modèle Cathedral de patrix, trouvé avec un aperçu et une licence explicite, représente une construction Minecraft et a été écarté. Le modèle Stylized Gothic Church repéré est sous licence non commerciale et a également été écarté.

## Accès aux bibliothèques

Les requêtes officielles fonctionnent désormais pour le catalogue, la licence et les téléchargements Poly Haven, les pages Quaternius et la page Sketchfab citée. Les fichiers Poly Haven correspondent aux tailles et MD5 publiés, avec conservation de leur SHA256. L'API `/files/` exige ici un User-Agent explicite identifiant le projet ; cette correction a permis ses requêtes.

L'accès n'est pas universel : les requêtes de cette machine vers BlenderKit, Google Drive, l'API Sketchfab et les hôtes d'aperçus ont encore reçu CONNECT 403. Les sources accessibles permettent déjà les études Blender. Aucun nouveau domaine ni secret n'est demandé pour les recettes vérifiées. La sauvegarde d'un brouillon d'environnement ne constitue toujours pas une modification ou une publication du runtime.

## Atelier exécuté

Les [modèles, recettes, rendus et essais dans le jeu](mandats-diorama/library-study-20261009/README.md) sont conservés pour revue. Une reconstruction depuis les sources vérifiées produit des GLB identiques octet par octet. Le rocher compte 900 triangles ; la maison compte 1 481 triangles détaillés et 287 à distance dans le GLB inspecté. Ces essais utilisent une substitution de modèle déclarée dans le navigateur, au-dessus de la source 37 inchangée. Ils ne sont pas une nouvelle livraison de la carte, ni une réussite des délais originaux ou une conformité à la maquette.

La sélection finale doit conserver l'auteur, la source, la licence de l'actif exact, son empreinte et les modifications apportées. Une licence du code, un badge de page ou une déclaration de catalogue secondaire ne suffit pas à établir les droits sur les modèles.
