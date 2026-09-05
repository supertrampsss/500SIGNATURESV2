# Salaires, France et Territoires : refonte du 5 septembre 2026

## Décisions

Prolonger Barlow Semi Condensed et Source Sans 3 sur les onglets de données. Conserver une surface de lecture claire, avec un accent bleu pétrole pour les calculs et la recherche. Pas de décor de jeu sur des comptes observés, pas de nouvelles pages de transition, pas de bibliothèque d'icônes supplémentaire.

- **Salaires** : saisie, quatre statuts et résultat dans un atelier unique. Répartition visuelle doublée de montants textuels. Les coefficients historiques sont inchangés et désormais publiés dans le détail du calcul, avec leur nature illustrative non calibrée. Le modèle ne reconstitue pas une fiche de paie réelle, un foyer fiscal ou un salaire brut. La référence partisane a quitté les liens destinés au public ; liens institutionnels Urssaf et Insee conservés. Les champs restent locaux et ne sont ni envoyés ni sauvegardés.
- **France** : titre et périmètre explicites, solde présenté une seule fois en grand, recettes et dépenses à la même échelle. Les chiffres arrondis au milliard peuvent présenter un écart d'arrondi dans leur soustraction ; le solde reste calculé sur les valeurs exactes. Quatre liens conduisent aux chapitres dans le même document. Les six aperçus de graphiques dupliqués, tronqués sur certaines largeurs, deviennent des accès éditoriaux aux graphiques complets. Les tableaux accessibles, textes, données et sources restent disponibles.
- **Territoires** : la recherche précède la fiche ; Bordeaux et Paris offrent des points d'entrée immédiats. Aucun budget national n'est présenté comme un territoire choisi. Dès la sélection, la recherche devient compacte, le nom de la collectivité prend le premier niveau de titre. Quatre chiffres avec leur année ouvrent le diagnostic ; le calcul de situation financière se déplie sur place. Carte visible sur grand écran et à la demande sur téléphone ; la recherche et les fiches restent utilisables si WebGL ne peut pas démarrer.
- **Navigation** : cinq destinations tiennent sur une seule ligne mobile. Le thème revient à côté de la marque. Les libellés restent visibles, sans flèches décoratives ajoutées.

## Architecture et limites

La page Salaires possède une entrée Vite et un contrôleur autonomes. Elle ne charge plus les données R2 ni MapLibre. La gestion du thème est partagée avec l'application principale. Les routes et les métadonnées pré-rendues restent stables. Le CSS historique commun demeure volumineux ; son démantèlement et le découpage complet du bundle France/Territoires sont des travaux distincts, non revendiqués comme achevés ici.

L'initialisation de la carte est isolée de celle des comptes. Une erreur réseau sur France est annoncée dans la vue visible et préserve les chiffres pré-rendus. Les sources externes ne sont pas garanties hors connexion. Le téléchargement volontaire de Mandats continue de couvrir le jeu, ses règles et ses illustrations légères, avec sauvegarde locale ; il ne promet pas de télécharger toutes les communes.

Aucune modification des moteurs de Mandats, des coefficients de salaire, des séries financières, des règles de score ou du stockage des sauvegardes. Aucune publicité ni publication sociale.

## Vérification

- Vérifications visuelles locales sur bureau et cadres CSS de 390 px, avec les valeurs de la publication `2026-09-03T0902`. Les copies temporaires utilisées pour cette vérification ont été retirées avant le build et ne sont pas livrées.
- Les tests unitaires existants passent ; les assertions de rendu sont mises à jour pour l'ordre des repères et les liens de chapitres.
- La suite navigateur ajoute les quatre statuts, les saisies invalides et nulles, les montants longs, le thème sombre, les cinq liens, les chapitres France en panne réseau et les fiches territoriales sans WebGL.
- La fixture navigateur contient des extraits financiers publics attribués à leur publication, uniquement pour des tests déterministes. Elle n'est pas une source servie au produit ; les personnes élues sont exclues de cette fixture.
- Les campagnes et la reprise hors connexion de Mandats continuent d'être testées sur les cinq profils de la suite. Les profils sont des émulations Chromium/WebKit, pas une certification sur téléphones physiques.

Les résultats définitifs de CI et la publication sont consignés dans la pull request associée.
