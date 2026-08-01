-- Totaux dans la table des lignes budgétaires (docs/02-modele-donnees.md §D)
--
-- Un budget publié mêle des lignes de détail et les totaux qui les
-- récapitulent. Les deux sont utiles : le détail pour montrer la composition,
-- le total parce que certains textes ne publient que lui. Mais une table où
-- les deux se ressemblent se laisse sommer et donne un chiffre doublé.
--
-- `agregat` marque les lignes qui en recouvrent d'autres — totaux et reprises.
-- La règle de lecture tient en une clause : `where line_kind <> 'agregat'`.

alter table fin.public_budget_lines
    drop constraint public_budget_lines_line_kind_check;

alter table fin.public_budget_lines
    add constraint public_budget_lines_line_kind_check
    check (line_kind in ('credit','depense_fiscale','recette_fiscale','recette_non_fiscale',
                         'recette_affectee','agregat'));
