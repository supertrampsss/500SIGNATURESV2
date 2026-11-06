# Correspondances postales

`codes-postaux.json` est un instantané de l'API officielle de découpage administratif :
https://geo.api.gouv.fr/communes?fields=code,codesPostaux&format=json

La propriété `extrait_le` donne la date d'extraction, pas une date de fraîcheur revendiquée pour chaque commune. `codes` associe chaque code postal aux codes INSEE retournés par l'API. Les codes sont des chaînes, y compris leurs zéros initiaux. Un code postal peut correspondre à plusieurs communes ; aucun premier résultat n'est choisi arbitrairement.

Actualisation explicite, depuis `site/` : `node scripts/actualiser-codes-postaux.mjs`. Le script vérifie la structure et refuse une liste nationale manifestement incomplète. Ce téléchargement n'est pas requis à chaque build.

Le navigateur charge cet instantané sur le domaine du site seulement pour une saisie de cinq chiffres, puis le croise avec les communes dont les données sont publiées. Il ne transmet aucune saisie à l'API. Une erreur de chargement conserve la saisie et propose de réessayer ; la recherche par nom reste indépendante de cet instantané.

Documentation officielle : https://geo.api.gouv.fr/decoupage-administratif/communes
