# Reclassement Bercy — validation du 19 octobre 2026

Demande : afficher les budgets hors financement des pensions, réunir ce financement dans une seule ligne Retraites et ne plus laisser la réversion dans Autres dépenses.

## Calculs et périmètres

Direction du Budget, annexe pensions PLF 2027, pages 11–12 : Éducation 89,1 − 25,1 − 3,4 = 60,6 Md€ ; Intérieur 34,2 − 9,3 − 1,1 = 23,8 Md€ ; Retraites 28,5 + 10,4 = 38,9 Md€. Total avant et après : 123,3 Md€. Les retenues salariales sont déjà dans les crédits, donc retirées une seule fois. Les pourcentages arrondis ne servent pas au calcul.

Le tableau porte explicitement sur les DEUX ministères dont les montants nominaux sont publiés, pas sur tous les ministères. Les opérateurs non détaillés restent hors du reclassement. Aucun montant des autres ministères n’est inventé depuis le graphique global. Voir `docs/retraites-reclassement-sources.md` pour les sources et limites.

Les comptes nationaux conservent leur périmètre : la ligne Retraites réunit vieillesse et survivants au même exercice et le résidu diminue d’autant. Le financement ministériel PLF 2027 n’est pas ajouté aux pensions Eurostat. Les données COFOG et les comparaisons internationales conservent leurs définitions officielles ; aucun coefficient de 32 % ne leur est appliqué.

## Vérifications

Tests de non-régression : sommes conservées, pensions de réversion regroupées, unicité de la ligne, exercice commun, historique salarial, cohérence des montants entre module et dossier. Les tests navigateur contrôlent France, Salaires et les dossiers sur cinq formats, dont WebKit et 320 px. Le contrôle Python des 14 dossiers est passé sans erreur après référencement du total calculé.

La première suite locale a signalé deux assertions historiques interdisant tout tableau dans le fragment des comptes ; elles sont désormais limitées au bloc national précédent le nouveau tableau Bercy. Les vérifications des totaux et les légendes sont conservées.

Les captures sont des rendus complets du site construit ; les vues ciblées portent sur les tableaux et graphiques modifiés. La revue visuelle est distincte des tests unitaires. La publication attend les contrôles GitHub de la tête exacte de la PR ; la vérification en production suit le déploiement.

Résultats locaux finaux : 1 108 tests unitaires réussis ; typage/build/prérendu complet réussis ; 14 dossiers validés sans erreur ; 15 parcours retraites réussis sur cinq formats, puis 5 parcours Salaires rejoués après ajout de la feuille CSS à son entrée autonome. La revue a aussi corrigé l’en-tête collant du tableau Bercy, qui masquait le total dans une capture longue. Les 14 captures conservées comprennent les pages complètes et les graphiques/tableaux ciblés sur mobile et ordinateur. La barre Bercy est désormais visible sur les deux entrées publiques.
