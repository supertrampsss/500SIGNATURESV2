# Atelier de modèles existants du 9 octobre 2026

La [maquette confirmée](../reference-ordinateur.png) reste la cible. Le rendu
complet reste **NONCONFORM**. Cet atelier prépare des modèles CC0 et les importe
expérimentalement dans le jeu. Aucun nouveau modèle n'est intégré à la source 37
livrée ; ses 236 entrées sont [inchangées](production-inputs-unchanged.json).
Le nom du dossier externe `library-adaptation38` désigne une étude, pas une
source ou un build 38.

## Résultats concrets

Le rocher Poly Haven de Rico Cilliers est adapté à partir de son vrai maillage et
de ses textures. La maison assemble les façades, fenêtres, porte, menuiseries,
toiture et cheminée du kit Quaternius 2025. Les
[recettes reproductibles](../../../tools/mandats-library-assets/README.md)
conservent ces composants ; elles ne dessinent pas une imitation de leur aperçu.

| Candidat | Export réellement inspecté | État |
| --- | --- | --- |
| [Rocher](library-boulder-v2.glb) | 195 556 octets, 900 triangles, une primitive, trois images 512 × 512 | Essai de petit décor forestier uniquement ; aucun massif montagneux remplacé. |
| [Maison](library-house-miniature-seated.glb) | 310 700 octets, 1 481 triangles détaillés et 287 à distance, six primitives par niveau, quinze images 256 × 256 | Deux implantations de `maison_alsace_01` examinées par substitution expérimentale ; aucune généralisation. |

Le [rendu de studio détaillé](library-house-study-v2-front.png) montre les
composants assemblés avant réduction. Le
[rendu de studio simplifié](library-house-miniature-front.png) est un aperçu
Blender de la maison, pas la carte finale. Il reste à affiner les jonctions,
la taille des tuiles et la conservation des détails lors de la réduction.

Un téléchargement dans un cache vide a vérifié 44 fichiers, 48 634 608 octets.
Les recettes portables ont réellement reconstruit les trois exports, avec
[identité octet par octet](portable-recipes-reproduction.json).
Les 92 fichiers de l'étude complète, 496 066 206 octets, restent dans le cache
externe. Ils ne sont pas ajoutés au dépôt.

## Licences et sélection

Poly Haven publie ses modèles sous CC0. L'
[archive de sa déclaration](sources/polyhaven-current-license.txt) est conservée
avec les reçus de téléchargement et leurs empreintes. Les auteurs de la
végétation étudiée sont Rico Cilliers et Rob Tuytel ; `tree_small_02` est un
Burkea africana, pas un chêne français.

Le miroir Quaternius est fixé au commit
`21104b4045261c28fc312360841ed1a7b0ac8782`, du 24 avril 2025. Son
[README original](sources/quaternius-mirror-README.txt) précise la distribution
standard du 22 avril et la présence de la licence dans l'archive originale.
Son [LICENSE](sources/quaternius-2025-CC0.txt) est CC0. La
[page officielle d'avril 2025](sources/quaternius-official-april2025.txt)
annonce explicitement cette licence pour les éditions du kit. Cette vérification
ne vaut pas pour une autre archive ni pour les nouveaux actifs sous QAL.

Les jeunes sapins importés sont trop clairsemés pour la forêt de la référence.
Les trois variantes du grand sapin disposent de niveaux de détail existants,
mais une réduction uniforme dégrade leurs branches et leurs plans de feuillage.
La tentative à 2 600 triangles s'arrête encore à 9 986, au-dessus du budget.
Le rendu diagnostique a été examiné et écarté. Aucun sapin dégradé n'est adopté.

## Contrôles et limites

Les premiers imports expérimentaux de rocher et de maison ont chacun conservé
sept vues natives Chromium, sans erreur de page ni requête échouée. L'export
éloigné de la maison perdait ensuite son point le plus bas : le GLB avait un
minY de 0,001378 au lieu de zéro. Le
[recalage exporté](house-export-seating.json) corrige ce décalage avec une
transformation positive des positions et des normales. L'
[inspection du GLB corrigé](library-glb-audit-seated.json) retrouve les limites
locales attendues, sans triangle dégénéré selon son seuil. Deux désaccords de
normales de face restent enregistrés sur le rocher et la maison détaillée.
Ces contrôles ne valident pas leurs contacts avec le terrain de jeu.

L'export corrigé a été chargé dans quatre nouvelles vues Chromium, au format
1672 × 941, seed 0, version 12, ambition `equilibre`, mouvements réduits.
Les [captures et métadonnées](browser-house-seated-probe/01-national.json)
identifient explicitement le corps GLB substitué, les JS/CSS réellement servis,
les commandes natives et zéro décision dépensée. Le
[journal terminé](browser-house-seated-probe.log) conserve les quatre vues.
La [vue nationale](browser-house-seated-probe/01-national.png) et le
[détail près de Lyon](browser-house-seated-probe/04-lyon-detail-canvas.png)
ont été ouverts et comparés à la référence.

Les [scripts exécutés](executed-scripts/capture-house-seated-probe.mjs) et les
[scripts de composition](executed-scripts/merge-house-seated-probe.py)
conservent les chemins de cette machine pour provenance. Les recettes Blender
portables sont dans `tools/mandats-library-assets/`.

Le mécanisme substitue une réponse réseau dans un contexte de test frais.
Il ne modifie aucun fichier de production, aucune sauvegarde et aucun sujet.
Il conserve le binaire et les tableaux JSON des autres préfabriqués.
Il n'est pas un contrôle du cache hors connexion, des délais originaux, du
mandat complet ou d'un téléphone. Les `renderMs` relevés sont des mesures de
frames isolées, pas une cadence GPU stable ou une comparaison de performances.

La [revue visuelle](root-image-review.json) reste NONCONFORM : palette et relief
trop grossiers, montagnes anguleuses, cathédrale trop massive, forêts et ports
encore éloignés de la miniature. Deux nouvelles maisons ne résolvent pas la
composition du pays. Les six primitives de leur niveau éloigné demandent aussi
une évaluation de coût, malgré le nombre réduit de triangles.

Les échecs de réduction précédents restent dans les journaux de cet atelier.
Les trois échecs de la suite complète 37, ses neuf skips et les suites non
exécutées restent consignés dans la
[comparaison 37](../comparaison-37.html). Aucun nouvel essai supplétif ne les
transforme en réussite.
