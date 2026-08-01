-- Soldes d'un budget (docs/02-modele-donnees.md §D)
--
-- Un solde n'est pas une ligne budgétaire : il n'a ni sens de dépense ni sens
-- de recette, et le ranger dans fin.public_budget_lines obligerait soit à lui
-- inventer un côté, soit à relâcher la contrainte qui garantit que chaque ligne
-- en a un. Il appartient au budget pris dans son ensemble.
--
-- Les porter ici permet de comparer un solde voté à un solde exécuté sans le
-- recalculer à chaque lecture, et de vérifier que la somme des lignes publiées
-- redonne bien le solde publié.

alter table fin.public_budgets
    add column balance                  numeric(18,2), -- solde budgétaire
    add column special_accounts_balance numeric(18,2), -- solde des comptes spéciaux
    add column annexed_budgets_balance  numeric(18,2); -- solde des budgets annexes

comment on column fin.public_budgets.balance is
    'Solde du budget dans son cadre comptable propre. En comptabilité budgétaire'
    ' de l''État, ce n''est pas le déficit public au sens de Maastricht.';
