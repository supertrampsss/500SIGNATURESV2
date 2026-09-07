# Derniers retours France, Territoires et Salaires

- Suppression des intitulés visibles « Chapitre XX » et de « Un pays. Des choix. ».
- Une section européenne rassemble désormais comparaison générale et dépenses par fonction, en conservant les graphiques et les données.
- Chaque analyse dont une preuve possède plusieurs observations dispose de son graphique, même lorsque plusieurs analyses partagent un indicateur. Aucun plafond par thème. Le bouton du titre et le clic sur la carte ouvrent une lecture agrandie ; fermeture et Échap rendent le focus au titre. Sur mobile, la lecture occupe tout l’écran.
- Redistribution et Sécurité sociale sont visibles directement. Le bouton « Voir les chiffres » de la Sécu disparaît ; son tableau reste disponible aux lecteurs d’écran.
- Recherche Territoires : champ avec loupe, suggestions, bouton de carte et raccourcis de villes alignés avec le thème.
- Salaires : historique de la répartition des dépenses, avec sélection du poste. Les parts sont calculées sur chaque exercice complet, avec la même base que la répartition actuelle. Les années manquantes restent absentes. Ce graphique ne simule pas un ancien salaire avec les coefficients actuels.
- Bâtiments, fenêtres et sphère animés ; arrêt lorsque le système demande une réduction des animations.

## Dette

Le graphique abandonne la juxtaposition d’une ancienne projection de la Commission et de deux jalons arrondis de la mission indépendante. Il présente l’historique annuel Eurostat et le scénario à politique inchangée publié en juillet 2026, avec les valeurs exactes du tableau 5, page 15 : 118,4 % en 2026 ; 121,4 % en 2027 ; 124,2 % en 2028 ; 127,3 % en 2029 ; 130,5 % en 2030. Aucune extrapolation après 2030. Les projections déjà couvertes par une observation annuelle ultérieure ne sont plus affichées comme futures.

[Rapport officiel, tableau 5](https://www.budget.gouv.fr/files/files/plf/PLF%202027/904%20%20Rapport%20%20Mission%20sur%20la%20transparence%20des%20finances%20publiques.pdf#page=20).

## Vérification

1 008 tests unitaires réussis. Contrôles ajoutés sur la couverture des historiques, les exercices incomplets du salaire et la projection sourcée. Parcours navigateur ajouté pour l’agrandissement, le retour du focus, la redistribution visible, la section Europe commune et la sélection de l’historique du salaire. Validation multi-navigateurs par la CI avant fusion.

Captures du rendu réel : [recherche mobile](editorial-search-mobile.jpg), [analyse agrandie sur ordinateur](editorial-analysis-expanded.jpg).
