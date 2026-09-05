# Deux hivers

Séquence France expérimentale : `/mandats/france/hiver/`.
Trois décisions liées, distinctes du mandat existant de 45 décisions. Aucun changement des sauvegardes du mandat principal. Aucune donnée financière réelle dans cette séquence : crédits, confort et activité sont des unités fictives.

## Construction visuelle

Décor architectural généré pour ce projet, compressé en WebP (1536 px : 434 Ko ; 900 px : 136 Ko). Le décor est fixe. Les habitants, le véhicule, la vapeur, les flocons, les reflets, les fenêtres et les travaux sont des couches SVG animées au-dessus, dans le même repère 1536 × 1024. Aucun moteur WebGL nécessaire. Le SVG et l’image doivent utiliser le même recadrage pour rester alignés.

Le confort commande les lumières des logements. L’activité commande la présence des ouvriers, les livraisons et la vapeur. Les travaux de printemps sont livrés au retour de l’hiver. Le bref passage des échafaudages est une animation CSS de livraison ; il ne bloque pas les choix et ne modifie jamais l’état affiché. La saison et les travaux livrés reflètent immédiatement le modèle, sans dépendre d’un minuteur.

La scène expose une description accessible. Ses animations s’arrêtent lorsque l’utilisateur le demande, préfère réduire les mouvements, masque la page ou fait défiler la scène hors écran. Un son bref est disponible sur activation explicite. Ce premier essai ne propose ni caméra libre ni quartier 3D explorable.

## État et limites

`model.ts` gère les budgets, les effets différés, les choix autorisés et le bilan. `restore` reconstruit tout état sauvegardé à partir des choix : une réserve modifiée dans un fichier ne passe pas la validation. La clé locale est `mandats.winter.v1`. Le stockage reste sur l’appareil ; aucune synchronisation de compte ni collecte analytique.

Le modèle comporte 21 parcours finançables, un choix sans dépense à chaque étape et aucun financement négatif. La préparation hors connexion télécharge explicitement cette route, le code, les polices et les deux décors. Comme tout stockage navigateur, ce cache peut être supprimé par le navigateur.

## Validation avant extension

Tests des règles dans `model.test.ts`, parcours navigateur dans `tests/winter.test.mjs`. Le pilote doit surtout être essayé par des non-initiés : comprennent-ils les choix, remarquent-ils ce qui change et veulent-ils tenter une autre stratégie ? Ces qualités ne sont pas démontrées par les seuls tests automatiques.

Avant d’étendre aux 45 décisions : valider la direction artistique en jeu, améliorer l’ampleur des conséquences visibles, créer des scènes distinctes pour d’autres secteurs, puis relier ces scènes au modèle financier du mandat. Ne pas multiplier trois questions identiques quinze fois.
