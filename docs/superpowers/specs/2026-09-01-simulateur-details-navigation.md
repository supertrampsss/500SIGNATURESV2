# Simulateur : détails, choix et navigation

## But

Rendre les 45 arbitrages d'une partie compréhensibles sans jargon, garantir que chaque option est sélectionnable et permettre de corriger le dernier choix.

## Règles produit

- Une carte contient plusieurs options uniquement lorsque ces options sont incompatibles.
- Des mesures cumulables deviennent des arbitrages indépendants. Le dossier sécurité et justice est donc séparé en recrutements police-gendarmerie, recrutements justice et places de prison.
- Un clic sur une option l'enregistre immédiatement. Aucun écran de confirmation n'est ajouté.
- Le bouton Retour annule la dernière décision, ses effets immédiats, ses événements, ses promesses et ses éventuelles conséquences, puis rouvre le dossier précédent.
- Le header montre la progression globale, sans numéro ni nom de chapitre.
- Chaque option du catalogue est testée par un clic réel dans le contrôleur.

## Détail d'une option

Le panneau détail ne répète pas le résumé. Il contient uniquement les sections utiles parmi :

1. **La mesure** : paramètres exacts, seuils, montants, populations et dispositifs nommés.
2. **Aujourd'hui** : règle de départ nécessaire pour comprendre le changement.
3. **Effets** : personnes, administrations ou entreprises concernées, avec un exemple lorsque cela clarifie la mesure.
4. **Calcul** : origine du montant annuel et éléments inclus.
5. **Sources** : liens déjà présents dans le dossier.

La rubrique « Quand » est supprimée du type, du rendu et des 55 cartes. Une formulation vague telle que « après les textes nécessaires » est interdite. Une liste annoncée doit être affichée. Les options de maintien décrivent la règle actuelle au lieu d'indiquer seulement que rien ne change.

## Interface

- Header : marque, bouton Retour, `Dossier X sur 45`, barre de progression, solde, Pause.
- Le bouton Retour est désactivé uniquement avant la première décision.
- La carte entière sélectionne l'option, à l'exception du bouton « Comprendre » qui ouvre le panneau.
- Le panneau se ferme par la croix, Échap ou un clic sur le fond.
- Le panneau conserve un bouton explicite « Choisir cette option ».
- Le mot « chapitre » ne paraît plus dans le parcours de décision.

## Validation

- Tests unitaires du contrat éditorial sur toutes les options.
- Test contrôleur qui ouvre puis sélectionne chacune des options des 55 cartes, notamment « Aller vers 65 ans ».
- Tests du retour avec recalcul d'état.
- Contrôle visuel desktop et mobile 390 px.
- `npm test`, `npm run build`, puis vérification de la production.
