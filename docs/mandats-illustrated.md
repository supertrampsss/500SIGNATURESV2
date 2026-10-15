# MANDATS : carte illustrée validée

Le 15 octobre 2026, le propriétaire demande de repartir de la maquette validée,
sans modélisation 3D. Cette décision remplace le contrat de reconstruction Babylon.

## Source visuelle

L’image approuvée est `mandats-diorama/reference-ordinateur.png`. La carte occupe
le rectangle (0, 66, 1268, 801). `site/src/mandats/textures/reference-map.svg`
présente ce rectangle de l’image originale. Les repères de Lille, Nantes, Lyon
et Marseille ainsi que les commandes imprimées sont retirés par restauration
locale ; seuls ces petits rectangles utilisent l’image retouchée. Le reste de
la carte utilise directement les pixels de la référence. Le SVG contient ses
deux images, sans dépendance extérieure.

L’en-tête, les sujets, les choix, les compteurs et les contrôles sont des éléments
HTML vivants. Leur contenu vient de la partie, pas des valeurs illustratives de
la maquette. Les villes, reliefs, forêts et ports sont une illustration fixe.

## Interactions

Le déplacement, le zoom, le retour à la vue France et l’inspection transforment
la même illustration. Ils ne consomment aucune décision. Les repères de sujets,
les mobilisations et les étapes des projets correspondent à l’état sauvegardé.
Les projets financés, bloqués, livrés et retirés ont des signes distincts.

Les contrôles restent utilisables au clavier et au toucher. Une image qui ne
charge pas conserve la carte simplifiée, les sujets et les choix. La réduction
des mouvements est respectée. Le cache hors connexion inclut l’illustration et
les parcours de jeu ; il ne télécharge plus les anciens modèles 3D.

## Vérification

Les parcours rework conservent leurs délais et configurations. Les attentes
spécifiques au GPU, aux GLB et à la perte de contexte sont remplacées par les
risques du nouveau support : image réelle différée ou indisponible, continuité
du même élément, zoom et redimensionnement sans déformation, absence de requêtes
3D, projets préservés et reprise de l’image hors connexion. Les parcours de cinq
ans, décisions, mobilisations, sauvegardes et rejeu restent couverts.

Les captures de référence et du navigateur doivent être comparées à cadrage
identique ; les scores et sujets peuvent différer parce qu’ils proviennent de
la partie réelle. La [comparaison du navigateur avec la référence](mandats-illustrated/comparaison.html)
et le [compte rendu de validation](mandats-illustrated/validation.md) conservent les
captures, les entrées de partie et les rapports de cette livraison.
