# Présentation monétaire des budgets ministériels — 19 octobre 2026

La présentation publique utilise désormais `ministeres-montants-2027.json` dans `docs/sources/retraites-2026/` : crédits de paiement monétaires du PLF, contributions civiles/militaires des PAP et estimation des cotisations salariales aux taux publiés. Le script et le rapport de validation sont conservés à côté du JSON. Les champs `budget`, `retraites` et `apresReclassement` sont en euros ; le site affiche des Md€ avec une précision adaptée aux petits montants.

Les montants après reclassement sont les budgets diminués des retraites ; aucune somme inter-ministères n'est présentée comme le coût de toutes les retraites françaises. Les remboursements et dégrèvements sont retirés des crédits Action et comptes publics. Les cotisations salariales étant estimées, la présentation signale ces montants et leurs résultats par ≈. Les contributions ATI et les différences d’assiette limitent la précision du calcul, comme décrit dans le fichier source.

Limite : le montant T3 des opérateurs de l’Enseignement supérieur n’est pas chiffré dans les sources monétaires consultées ; ses deux cellules restent indisponibles, sans remplacer le total par son seul T2. Santé et Transports sont à zéro dans le champ CAS retenu par Bercy : cela ne signifie pas zéro retraite tous régimes. Aucune somme en euros n’est extrapolée depuis la géométrie de la figure.

Le module `bercy-ministeres-montants.ts` et les preuves monétaires du dossier reprennent les mêmes valeurs. Les tests vérifient cette concordance, les soustractions, les unités et la conservation des données absentes. Le graphique original ci-dessous reste archivé pour provenance et contrôle de cohérence, sans servir au calcul des montants.

## Graphique original archivé


Livrable : `docs/sources/retraites-2026/bercy-figure3b-2027.json`.

Source publiée : annexe au PLF 2027, « Rapport sur les pensions de retraite de la fonction publique », figure 3B, page 24, notes page 25. Copie conservée : `docs/sources/retraites-2026/bercy-pensions-plf-2027.pdf`.

URL officielle : https://www2.assemblee-nationale.fr/static/17/Annexes-DL/PLF_2027/12-Jaune-2027-Pensions-de-retraite-fonction-publique.pdf

La reprise graphique regroupe les trois segments publiés T2 CAS, T3 CAS et cotisations salariales dans « Retraites » ; les deux autres segments forment le reste des crédits. Les proportions sont extraites de la géométrie vectorielle du PDF, à la limite gauche du rectangle bleu « Reste des dépenses de personnel ». Ce sont des proportions de dessin, pas les données budgétaires numériques sous-jacentes. Elles ne doivent pas être présentées comme des montants officiels exacts ni multipliées par des budgets pour fabriquer des euros.

L’axe 0 % est x=285.3599853515625 et l’axe 100 % x=537.3099975585938, coordonnées PDF de la page 24. Le JSON conserve les coordonnées de chaque rectangle et de chaque limite pour audit. L’écart minuscule au zéro pour Ville et logement et Aménagement est inférieur à la précision de lecture ; la note publiée indique seulement moins de 1 % de contributions employeur.

Les ministères Santé et Transports, absents de la figure, sont ajoutés à zéro sur la base explicite de la note (1), page 25 : absence de contributions employeur de l’État au CAS Pensions. Les cotisations salariales sont déjà des estimations dans la source Bercy (note (2)). Les flux des opérateurs sont exclus sauf prise en compte partielle de l’Enseignement supérieur, recherche et espace en T3 CAS. Le champ et ces limites sont ceux du graphique publié.

La recherche préparatoire dans les PAP est conservée dans `.snapshots/ministeres-2027/` mais n’est pas employée pour reconstruire les barres, conformément à la demande de reprendre le graphique Bercy.
