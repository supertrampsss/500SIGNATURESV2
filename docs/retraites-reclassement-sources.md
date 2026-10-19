# Reclassement des retraites : audit des sources (19 octobre 2026)

Source primaire : Direction du Budget, Rapport sur les pensions de retraite de la fonction publique, annexe au PLF 2027, [document original](https://www.budget.gouv.fr/documentation/file-download/34465), copie `docs/sources/retraites-2026/bercy-pensions-plf-2027.pdf`.

## Montants directement publiés : deux ministères

Pages 7 et 10 : le rapport indique explicitement que 32 % des crédits de l’Éducation nationale et 30 % de ceux de l’Intérieur sont versés au CAS Pensions. Les pages 11–12 publient les montants suivants, en milliards d’euros, au PLF 2027 :

| Ministère | Crédits totaux | Personnel | Contributions employeur | Cotisations salariales | Total financement retraites |
| --- | ---: | ---: | ---: | ---: | ---: |
| Éducation nationale (p.11) | 89,1 | 84,6 | 25,1 | 3,4 | 28,5 |
| Intérieur (p.12) | 34,2 | 25,1 | 9,3 | 1,1 | 10,4 |
| Total des deux ministères | 123,3 | 109,7 | 34,4 | 4,5 | 38,9 |

Le reclassement à total constant, calculé à partir des montants publiés arrondis au dixième, donne :

| Affectation après reclassement | Md€ |
| --- | ---: |
| Éducation nationale hors financement des retraites identifié | 60,6 |
| Intérieur hors financement des retraites identifié | 23,8 |
| Retraites (contributions employeur et cotisations salariales regroupées) | 38,9 |
| Total des deux ministères | 123,3 |

Calculs : 89,1−25,1−3,4=60,6 ; 34,2−9,3−1,1=23,8 ; 28,5+10,4=38,9 ; 60,6+23,8+38,9=123,3. Les pourcentages publiés de 32 et 30 sont arrondis ; employer les montants nominaux publiés pour ce tableau, et non le produit des pourcentages arrondis par les budgets.

La méthodologie des pages 11–12 considère les cotisations salariales comme une fraction de la masse salariale hors contribution employeur, prélevée sur les traitements des fonctionnaires. Les contributions employeur correspondent aux versements prévisionnels au programme 741 du CAS Pensions. Les transferts entre les opérateurs et le CAS sont exclus, et qualifiés de marginaux pour ces deux ministères ; les subventions aux opérateurs restent incluses dans les autres dépenses. Le tableau couvre exclusivement ces deux ministères et ce financement identifié : il ne représente ni tous les ministères, ni toutes les retraites de France.

## Limite du tableau tous ministères

Pages 24–25, figure 3B : décomposition en pourcentage des crédits du budget général au PLF 2027. Les contributions T2 CAS, le T3 CAS de l’enseignement supérieur, les cotisations salariales, le personnel restant et les autres dépenses sont distingués. La lecture explicite p.25 détaille pour l’Éducation : 28 % employeur + 4 % salariés + 63 % personnel restant + 5 % hors personnel.

La figure 3B ne comporte pas de budgets nominaux pour tous les ministères. L’extraction du texte, des liens, des pièces jointes et des objets vectoriels n’a trouvé ni table de valeurs exactes de cette figure ni données embarquées. Le rapport permet un tableau exact aux arrondis publiés pour les deux ministères ci-dessus ; il ne permet pas à lui seul de reconstruire tous les budgets ministériels en euros après reclassement.

Les ministères Santé et Transports ne sont pas représentés car leurs contributions employeur de l’État au CAS sont nulles ; Aménagement du territoire et Ville/logement y consacrent moins de 1 % de leurs crédits. Cela ne signifie pas que toutes leurs dépenses de retraite, tous régimes confondus, sont nulles. La moyenne d’environ 13 % des crédits ministériels annoncée p.10 ne remplace pas les montants manquants.

Le [texte officiel du PLF 2027](https://www.assemblee-nationale.fr/dyn/docs/PRJLANR5L17B3210.raw) comporte une présentation des crédits par ministère et programme, mais doit être rapproché des composantes précises de la figure dans le même périmètre avant tout calcul supplémentaire.

## Recettes du CAS et prévention du double compte

Pages 20–21, figure 3A : exécution 2025, contributions employeur civils et militaires hors ATI 54,9 Md€, cotisations salariales 7,5 Md€, autres recettes 4,9 Md€, soit 67,3 Md€ de recettes représentées. Les 62,4 Md€ (=54,9+7,5) sont des recettes de financement, non des pensions supplémentaires. Ne jamais les additionner aux prestations déjà comptabilisées.

La variante conventionnelle du graphique conserve le total : 11,0 Md€ employeur + 43,9 Md€ subvention + 7,5 Md€ salariés + 4,9 Md€ autres = 67,3 Md€. Le texte p.20 mentionne toutefois 41,5 Md€ de subvention et 65,2 %, contrairement aux 43,9 du graphique. Cette incohérence interne impose de qualifier la variante ; elle ne remet pas en cause les valeurs de la colonne aux taux actuels.

Pour reclasser un budget ministériel, soustraire les mêmes montants des ministères et les ajouter une seule fois à une ligne Retraites, en conservant le total. Pour une dépense publique consolidée incluant déjà les prestations, neutraliser les transferts de financement plutôt que les additionner. Ne pas mélanger exécution 2025, budget 2026 et PLF 2027.

## Regroupement national vieillesse-survie

L’API Eurostat `gov_10a_exp`, secteur S13, transaction D62, année 2024, confirme 362 178,4 M€ pour GF1002 (vieillesse) et 40 254,8 M€ pour GF1003 (survie). Le total éditorial est donc 402 433,2 M€, soit 402,4332 Md€ et 26,76 % des recettes publiques de 1 503,5901 Md€. Il ne constitue pas une nouvelle observation officielle : les deux composantes officielles restent documentées. Les réponses primaires et leurs URL sont archivées dans `docs/sources/retraites-2026/eurostat-*.json`.

France, les comptes pour 100 € et Salaires réunissent ces composantes dans une seule ligne Retraites au même exercice. Les pensions de réversion sont retirées du résidu ou de l’ancienne ligne séparée selon la présentation, sans modifier la dépense totale. Le fragment historique pour 100 € utilisait auparavant des fonctions de 2024 au milieu de transactions de 2025 ; il retient désormais un seul millésime complet et son résidu réconcilie effectivement les feuilles affichées.
