# Retraites : rapprochement des sources au 19 octobre 2026

## Sources archivées

Copies originales dans `docs/sources/retraites-2026/`, téléchargées le 19 octobre 2026. Pages indiquées ci-dessous : pagination imprimée.

| Fichier | Source primaire | SHA256 |
|---|---|---|
| bercy-pensions-plf-2027.pdf | [Direction du Budget, annexe pensions PLF 2027](https://www.budget.gouv.fr/documentation/file-download/34465) | `21020bfc4c4fe2b3ccffe4ec2317343f662a41577780afc03e00191aa74a8c71` |
| cor-rapport-juin-2026.pdf | [COR, rapport complet juin 2026](https://www.cor-retraites.fr/sites/default/files/2026-06/RA_2026_def.pdf) | `ce0fa4fe8aeb87090029dfd2f626d81e1adcdde99730e9978fe597f3a51dd892` |
| cor-synthese-juin-2026.pdf | [COR, synthèse juin 2026](https://www.cor-retraites.fr/sites/default/files/2026-06/Synth%C3%A8se_RA_2026.pdf) | `328eae6cb242d4e9b18df017c580dca7a0133aaece2fc82d86a540c472486437` |

## Bercy : données utilisables et réserve

| Page | Année / statut | Champ | Valeur / unité |
|---|---|---|---|
| 21, figure 3A | 2025, exécution | CAS Pensions : autres recettes / salariales / employeurs | 4,9 / 7,5 / 54,9 Md€ |
| 21, figure 3A | 2025, présentation conventionnelle | Même recettes, taux employeur de référence 16,67 % | 4,9 / 7,5 / 11 / 43,9 Md€ (dernier : équilibrage) |
| 7 et 24–25 | PLF 2027, prévision | Versements au CAS / crédits ministériels totaux | Éducation nationale 32 %, Intérieur 30 % |
| 25 | PLF 2027, prévision | Éducation : employeur / salarial / personnel restant / autres dépenses | 28 / 4 / 63 / 5 % |

Les deux colonnes CAS totalisent 67,3 Md€. Le texte page 20 indique pourtant 41,5 Md€ d’équilibrage et 65,2 %, contre 43,9 dans la figure : divergence non résolue, exclue des KPI. La convention ne crée aucune dépense ni économie consolidée. Les assiettes, droits et démographies des régimes diffèrent. Les 32 % incluent la cotisation salariale, déjà comprise dans la rémunération. Les opérateurs ne sont pas tous représentés (note page 25). Ne pas extrapoler ces parts à 2025, aux dépenses COFOG ou aux collectivités.

## COR : ensemble du système, 2025

Champ : régimes français légalement obligatoires, FSV compris, hors RAFP. Il s'agit des estimations rétrospectives publiées en juin 2026 ; ne pas les présenter comme une nouvelle exécution budgétaire d'octobre.

| Indicateur | Valeur | Repère |
|---|---:|---|
| Dépenses brutes | 422,2 Md€ ; 14,1 % du PIB | Rapport p. 65 |
| Prestations de base et complémentaires hors Aspa | 401 Md€ | p. 65 ; sous-totaux arrondis : droit direct 361, dérivé 39 |
| Ressources hors produits financiers | 416,6 Md€ | p. 85 ; synthèse p. 9 : 417 arrondi |
| Cotisations hors contribution d'équilibre et hors employeurs des opérateurs de l'État | 277 Md€ | p. 87 et note 6 de la synthèse |
| Autres ressources hors produits financiers | 139,6 Md€ | Calcul éditorial explicite : 416,6 − 277 ; contient fiscalité, contributions, transferts et autres produits |
| Ressources avec produits financiers | 422,2 Md€ | p. 85 et tableau 2.2 p. 87 |
| Solde hors charges et produits financiers | −5,1 Md€ | Synthèse p. 1 ; ne pas le recalculer depuis les seuls chiffres bruts arrondis |
| Cotisants / retraités de droit direct | 1,8 en 2025 | Figure 2.3 p. 73, arrondi publié |

Le graphique de financement recommandé utilise **277 + 139,6 = 416,6 Md€**, avec un dénominateur hors produits financiers. La part calculée des cotisations est 66,5 %. Les 65,6 % publiés au tableau 2.2 utilisent le dénominateur **avec** produits financiers : ne pas mélanger les deux.

Tableau 2.2, p. 87, en Md€ : cotisations 277 ; opérateurs 7,1 ; contributions d'équilibre 49,3 ; subventions 7,7 ; ITAF et CSG 64,7 ; transferts externes 16,5 ; produits financiers 5,6 ; autres produits 1,4. Somme des postes arrondis : 422,3, total publié : 422,2 ; écart d'arrondi de 0,1. Les sous-postes fiscaux et de transferts présentent également des arrondis. Aucune correction silencieuse.

## Démographie : ce que mesure le ratio

COR p. 73 : 30,6 millions de cotisants (indicateur d'emploi total des comptes nationaux Insee) et 17,4 millions de retraités de droit direct vivant en France **ou à l'étranger** (modèles Ancètre et Trajectoire DREES). Le ratio publié est 1,8 ; ce n'est ni le ratio des 20–64 ans aux 65 ans et plus, ni celui des seuls fonctionnaires. Les projections 2070 (1,3) sont des hypothèses de scénario, pas des observations.

La [base DREES des effectifs et pensions](https://data.drees.solidarites-sante.gouv.fr/explore/dataset/1393_les-effectifs-et-montants-de-pension-des-retraites/) conserve un fichier de ratio 2004–2016. Les nouvelles données EACR/Ancètre couvrent les retraités jusqu'en 2024, sans établir à elles seules une nouvelle série homogène de cotisants/retraités. Pour le repère récent, citer le COR 2026 avec son champ ; conserver la date 2016 visible sur l'ancienne série. Aucun prolongement inventé.

## Séparation des lectures et décision de pipeline

- Eurostat 2024 : prestations de vieillesse et de survivants, nomenclature et année de la série existante ; aucune révision chiffrée déduite du rapport Bercy.
- COR 2025 : système de retraite, ressources et dépenses selon son champ ; aucune addition au poste Eurostat.
- CAS 2025 : financement d'un sous-ensemble, avec présentation conventionnelle alternative.
- PLF 2027 : crédits ministériels proposés ; aucune transposition aux crédits Défense exécutés en 2025.

Pas de normaliseur DuckDB ajouté : la livraison utilise des repères éditoriaux sourcés, pas une nouvelle série annuelle homogène. Un futur import devra porter année, statut, champ, convention et source ; une valeur absente restera absente. La divergence Bercy interdit notamment de publier une série unique d'équilibrage sans clarification.
