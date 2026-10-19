# Source du graphique ministériel Bercy 2027

Livrable : `docs/sources/retraites-2026/bercy-figure3b-2027.json`.

Source publiée : annexe au PLF 2027, « Rapport sur les pensions de retraite de la fonction publique », figure 3B, page 24, notes page 25. Copie conservée : `docs/sources/retraites-2026/bercy-pensions-plf-2027.pdf`.

URL officielle : https://www2.assemblee-nationale.fr/static/17/Annexes-DL/PLF_2027/12-Jaune-2027-Pensions-de-retraite-fonction-publique.pdf

La reprise graphique regroupe les trois segments publiés T2 CAS, T3 CAS et cotisations salariales dans « Retraites » ; les deux autres segments forment le reste des crédits. Les proportions sont extraites de la géométrie vectorielle du PDF, à la limite gauche du rectangle bleu « Reste des dépenses de personnel ». Ce sont des proportions de dessin, pas les données budgétaires numériques sous-jacentes. Elles ne doivent pas être présentées comme des montants officiels exacts ni multipliées par des budgets pour fabriquer des euros.

L’axe 0 % est x=285.3599853515625 et l’axe 100 % x=537.3099975585938, coordonnées PDF de la page 24. Le JSON conserve les coordonnées de chaque rectangle et de chaque limite pour audit. L’écart minuscule au zéro pour Ville et logement et Aménagement est inférieur à la précision de lecture ; la note publiée indique seulement moins de 1 % de contributions employeur.

Les ministères Santé et Transports, absents de la figure, sont ajoutés à zéro sur la base explicite de la note (1), page 25 : absence de contributions employeur de l’État au CAS Pensions. Les cotisations salariales sont déjà des estimations dans la source Bercy (note (2)). Les flux des opérateurs sont exclus sauf prise en compte partielle de l’Enseignement supérieur, recherche et espace en T3 CAS. Le champ et ces limites sont ceux du graphique publié.

La recherche préparatoire dans les PAP est conservée dans `.snapshots/ministeres-2027/` mais n’est pas employée pour reconstruire les barres, conformément à la demande de reprendre le graphique Bercy.
