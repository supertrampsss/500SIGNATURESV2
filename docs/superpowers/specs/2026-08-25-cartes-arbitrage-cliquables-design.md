# Cartes d’arbitrage cliquables — conception

## Objectif

Supprimer la rangée de boutons qui répète les deux options du dilemme. Chaque carte gauche ou droite devient directement l’action de vote correspondante.

## Interaction

- La carte « adopter » porte `data-geste="adopter"` et la carte « rejeter » porte `data-geste="rejeter"`.
- Les cartes sont des éléments `<button type="button">` natifs : clic, Entrée et Espace fonctionnent sans code clavier supplémentaire.
- Tout le contenu visible de l’option reste dans la cible tactile.
- Le tiroir « Voir les conséquences et le chiffrage », « Ajourner » et « Annuler » restent des contrôles séparés.
- La rangée `.tunnel__actions-fixes` disparaît du rendu du conseil.

## Présentation

- Desktop : deux cartes côte à côte.
- Mobile : cartes empilées, largeur complète et cible tactile généreuse.
- Les cartes conservent leur fond, leur filet latéral et leur hiérarchie typographique ; un état de survol et un focus visible signalent qu’elles sont interactives.
- Aucun nouveau texte ou pictogramme n’est ajouté.

## Validation

- Tests de rendu : exactement deux actions de vote, portées par les cartes, et aucune rangée d’actions dupliquée.
- Tests d’interaction : le gestionnaire existant continue de lire `data-geste` depuis la carte.
- Contrôle visuel réel sur la version publique en desktop et en viewport mobile.

