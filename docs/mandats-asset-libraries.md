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
| [Gothic cathedral, Gnemegorl](https://sketchfab.com/3d-models/8b8f08c852e949ecba39ca0dd29448f0) | Un catalogue secondaire attribue le modèle et indique une licence « by ». Aperçu, licence originale et téléchargement officiel non vérifiés. | Piste à examiner lorsque l'accès officiel fonctionne. |
| [York Minster, Chris Bibb](https://sketchfab.com/3d-models/cc80db5047124ee29b526c5416981f6a) | Même limite de vérification ; ses tours carrées diffèrent des aiguilles de la référence. | Piste secondaire, sans validation visuelle ou juridique. |

Le modèle Cathedral de patrix, trouvé avec un aperçu et une licence explicite, représente une construction Minecraft et a été écarté. Le modèle Stylized Gothic Church repéré est sous licence non commerciale et a également été écarté.

## Accès aux bibliothèques

Les requêtes HTTPS officielles de cette machine ont reçu un refus CONNECT 403 du proxy. Les dépôts GitHub consultés restent accessibles. Aucun accès fournisseur, téléchargement ou import de modèle adapté n'est déclaré réussi.

Le brouillon d'environnement révision 11 conserve les destinations existantes et ajoute `polyhaven.com`, `api.polyhaven.com`, `dl.polyhaven.org`, `www.blenderkit.com`, `www.kenney.nl`, `kenney.nl`, `quaternius.com` et `sketchfab.com`. La sauvegarde du brouillon ne modifie pas le réseau de la machine courante. Il faut enregistrer les réglages dans l'interface puis publier l'environnement, et vérifier à nouveau les requêtes officielles après ce changement réel.

La sélection finale doit conserver l'auteur, la source, la licence de l'actif exact, son empreinte et les modifications apportées. Une licence du code, un badge de page ou une déclaration de catalogue secondaire ne suffit pas à établir les droits sur les modèles.
