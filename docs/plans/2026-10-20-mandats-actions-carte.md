# Mandats : commandes compréhensibles sur la carte

> Pour les agents : appliquer subagent-driven-development, puis revue de la branche complète.

**But :** corriger les menus Réformes/Cabinet hors carte, la déformation du pays et l'absence de choix identifiables dans le jeu v17.

**Architecture :** conserver le moteur, les sauvegardes et la miniature approuvée ; relier les commandes existantes à des repères HTML nommés sur la carte. Isoler la géométrie dans les styles et la projection. La présentation traduit les unités internes en explications qualitatives, sans inventer des nombres de patients ou de logements.

**Contraintes communes :** français simple ; décisions réelles et conditions explicites ; aucune modification des équilibres du moteur ; aucune purge de sauvegarde ; versions antérieures conservées ; commandes au clavier et sur téléphone ; illustration non déformée et déplacement conservé ; pas de menu Réformes/Cabinet séparé pour v17. Préserver les autres travaux présents dans le répertoire.

## Vérifications avant correction

- Reproduire une ouverture de trois minutes, enregistrer les entrées légales et les captures.
- Mesurer le ratio natif et affiché de l'image ; inspecter les styles gagnants.
- Vérifier les vraies commandes proposées, leur visibilité et leur résultat enregistré.
- Écrire les régressions de parcours avant les changements de présentation.

## Tâche 1 : carte et accès aux actions

Responsabilité : presidency-view.ts et, si nécessaire, presidency-runtime.ts, plus un petit module de texte de présentation. Examiner d'abord les programmes et événements réellement disponibles. Retirer les boutons hors carte ; garder l'accès permanent aux réformes, ministres et moyens par des repères nommés sur la carte. Les secteurs restent lisibles même quand la situation est calme. Le premier choix et son effet doivent être évidents, avec une formulation d'action ; les commandes non disponibles expliquent leur condition. Afficher les deux voies structurelles lorsqu'elles sont réellement possibles, conserver les accès aux autres commandes. Remplacer les besoins/capacités en unités internes par des phrases humaines, les délais en mois quand la règle permet de les calculer et les équipes par des équipes. Ne pas inventer un délai garanti si la file peut le retarder. Ne modifier aucune règle numérique ni choix enregistré.

## Tâche 2 : géométrie et lisibilité

Responsabilité : presidency-strategy.css et presidency-board-layout.ts seulement. Reproduire et mesurer avant d'éditer. Garantir le ratio naturel de la miniature, sans étirement, sur grand écran, ordinateur compact et mobile. Les nouveaux repères de la tâche 1 utiliseront .pr-board-pin avec data-map-x/y ; corriger les styles qui masquent ou tronquent ces libellés et leur disposition. Les repères regroupés restent nommés et ouvrables. Préserver le déplacement et Vue France. Éviter les collisions et les commandes cachées sous le panneau ; une action visible doit être réellement cliquable. Réduire la bande de titre si les menus retirés la rendent inutilement haute. Ne pas toucher aux autres fichiers sans coordination.

## Tâche 3 : régressions de parcours

Responsabilité : tests de navigateur Mandats uniquement. Avant la correction produit, créer des régressions qui échouent sur l'état actuel : une partie neuve montre les secteurs et les commandes institutionnelles sur la carte, aucune navigation séparée Réformes/Cabinet ; action financée depuis le repère Santé sauvegardée et visible après rechargement ; ratios image/conteneur identiques au natif (tolérance sous-pixel) aux formats 1919×1015, 1280×900, 390×844, 320×568. Vérifier un vrai centre de cible cliquable et une option visible au départ sans ouverture de détails. Adapter les anciennes assertions qui exigeaient les boutons hors carte. Conserver les tests historiques v16. Ne pas affaiblir les tests de règles, double clic, pause, import/export et parcours complets.

## Intégration et livraison

Contrôler une ouverture, plusieurs mandats et les deux voies sur plusieurs graines avec le parcours existant. Inspecter les captures téléphone/ordinateur et le texte affiché. Exécuter check et les suites stratégie, présidence et mobile-boucles pertinentes, ainsi que l'audit borné. Revue indépendante de l'ensemble des changements. Ouvrir une PR avec preuves avant/après, attendre tous les contrôles requis, fusionner puis vérifier le déploiement public réel. Documenter les limites restantes.
