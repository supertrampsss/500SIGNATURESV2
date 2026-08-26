# Cent arbitrages en défilement continu — conception

## Décision

La section « Les arbitrages derrière les comptes » publie exactement 100
analyses France lorsque la publication de données du 22 août 2026 est chargée.
Les 100 cartes sont visibles dans la page, sans pagination, accordéon global ni
bouton « voir plus ». Elles sont regroupées en chapitres thématiques et
précédées d'un sommaire d'ancres adapté au mobile.

## Ligne éditoriale

Chaque carte part d'une tension du débat public, mais son titre reste une
conclusion statistique défendable. Une carte contient un verdict, une courte
analyse, une réserve méthodologique et au moins deux preuves chiffrées avec leur
millésime. Les sujets sensibles — immigration, sécurité, retraites, pauvreté,
fiscalité — ne reçoivent aucune causalité ou intention que les séries ne
mesurent pas.

Les 12 analyses actuelles restent en tête de leurs thèmes. Les 88 nouvelles
analyses se répartissent entre 64 trajectoires éditorialisées et 24 écarts entre
crédits votés et consommés. Les recettes sont déclaratives : identifiant,
famille, angle, libellé et réserve. Les valeurs restent calculées au rendu à
partir des séries publiées.

## Thèmes et navigation

Huit chapitres ordonnent le défilement :

1. Dette et budget ;
2. Fiscalité ;
3. Travail et entreprises ;
4. Retraites et générations ;
5. Niveau de vie et inégalités ;
6. Services publics et société ;
7. Sécurité et justice ;
8. Énergie et environnement.

Le sommaire est une liste de liens natifs vers les identifiants de chapitre.
Il peut défiler horizontalement sur petit écran, mais les cartes restent dans
une colonne verticale. Chaque chapitre annonce son nombre de sujets.

## Architecture

- `insights-france.ts` conserve les 12 lectures composées existantes.
- `insights-france-catalogue.ts` porte les 88 recettes éditoriales, sans donnée.
- `insights-france-generiques.ts` transforme les recettes et les séries en
  `Insight`, en refusant les périodes, unités et dénominateurs incompatibles.
- `insights-rendu.ts` groupe les cartes par famille et produit le sommaire.

Une trajectoire en pourcentage est exprimée en points ; une trajectoire en
euros, comptes, indices ou ratios est exprimée en variation relative. Un écart
voté/exécuté utilise exclusivement la dernière période commune. Une recette
impossible disparaît isolément. Le moteur ne complète jamais artificiellement
le total.

## Critères d'acceptation

- 100 identifiants uniques avec la publication France courante ;
- 88 recettes nouvelles : 64 trajectoires et 24 écarts de mission ;
- huit chapitres visibles et un sommaire d'ancres ;
- aucune carte sans deux preuves, millésime ou réserve ;
- aucune occurrence de « À garder en tête » ;
- aucun débordement à 390 px ;
- pré-rendu et SPA identiques ;
- suite complète, build, CI et déploiement réussis.

