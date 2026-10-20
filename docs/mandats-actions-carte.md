# Mandats : commandes sur la carte

Correction du 20 octobre 2026, limitée à la présentation v17.

## Défauts reproduits

L'ouverture de trois minutes ne montrait aucun repère cliquable : les secteurs calmes étaient filtrés, alors que deux transformations étaient réellement disponibles. Réformes et Cabinet avaient été réintroduits hors carte. La miniature de 1919 × 1079 px était recadrée dans une carte de 1919 × 757 px ; Vue France conservait ce recadrage. Les cartes de commande exposaient des unités internes sans signification pour le joueur.

## Comportement attendu

- Six secteurs toujours nommés sur la carte ; Réformes et Gouvernement et moyens intégrés aux repères.
- Les choix « Lancer » annoncent un engagement réel, son coût, ses équipes et son délai minimal. Les effets sont expliqués avec les termes du secteur : créneaux de soins, remplacements, logements, entretien, démarches.
- Le diagnostic décrit la demande et les moyens actuels, puis les retards accumulés. Une livraison peut donc modifier le texte sans effacer un retard existant.
- Les groupes mobiles montrent les noms des sujets et rendent chaque membre ouvrable. La fermeture d'une institution restitue le focus à son repère ou à son groupe visible.
- La miniature conserve son ratio natif 1672 / 941. Sur ordinateur, elle tient dans la carte ; sur téléphone, l'exploration horizontale est conservée et Vue France affiche l'image entière.

Le moteur, les montants, les règles des anciennes versions, les identifiants de décisions et les sauvegardes restent ceux de la version publiée.

## Vérification et reproduction

Depuis `site`, construire avec `npm run check`, puis exécuter la suite `playwright.strategy.config.ts`. Les cas ajoutés couvrent l'ouverture, une décision Santé financée et rechargée, les diagnostics sains/tendus, une livraison et un groupe institutionnel au clavier à 390 × 660 px. Les mesures géométriques couvrent 1919 × 1015, 1280 × 900, 390 × 844 et 320 × 568 px. La suite conserve les deux stratégies de mandat complet, les contrôles de financement, double activation, pause, sauvegarde et version 16.

L'audit `node --experimental-strip-types scripts/mandats-strategy-audit.ts` a vérifié 36 trajectoires, 114 branches et 138 539 invariants sans écart ; la fixture indépendante des anciennes versions conserve 572 transitions. Ce sont des vérifications techniques et des parcours automatisés, sans évaluation du plaisir de jeu par un panel humain.

Les captures, entrées légales et rapports sont conservés dans les artefacts de navigateur de la PR ; les observations locales se trouvent dans `.snapshots/mandats-actions-carte/`.

## Limite

Les lieux de la miniature sont des repères illustratifs de décisions nationales. Pression et fatigue restent des indices du jeu ; aucun nombre de patients, de logements ou d'agents n'est inventé à partir des unités internes.
