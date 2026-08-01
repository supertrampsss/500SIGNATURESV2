-- Tests des contraintes structurantes (docs/02 §F) + présence du seed.
-- Exécutés en CI après les migrations et le seed ; tout s'exécute dans une
-- transaction annulée pour laisser la base propre.
\set ON_ERROR_STOP on

select postgis_version();

begin;

do $$
declare
    v_def bigint;
    v_run uuid := '00000000-0000-0000-0000-000000000001';
begin
    -- fixture minimale avec lineage complet
    insert into meta.source_registry (source_id, name, producer, access_category, license)
    values ('test-src', 'Test', 'Test', 'A', 'LO2.0');
    insert into meta.dataset_registry (dataset_id, source_id, title, priority)
    values ('test-ds', 'test-src', 'Jeu de test', 'P3');
    insert into meta.ingestion_runs (run_id, dataset_id, status)
    values (v_run, 'test-ds', 'success');
    insert into meta.raw_assets (run_id, dataset_id, r2_key, content_sha256)
    values (v_run, 'test-ds', 'raw/test/1', repeat('a', 64));
    insert into geo.geography_reference (geo_level, geo_code, vintage, name)
    values ('commune', '33318', 2026, 'Pessac'), ('pays', 'FR', 2026, 'France');
    insert into core.indicator_definitions (public_definition, confidence_level)
    values ('Population municipale de test.', 'observed')
    returning definition_id into v_def;
    insert into core.indicators (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                                 additive, published)
    values ('test_ind', 'test-ds', v_def, 'population', 'Indicateur de test', 'count', true, true);
    insert into core.observations (indicator_id, geo_level, geo_code, geo_vintage, period, value, run_id)
    values ('test_ind', 'commune', '33318', 2026, '2023', 65000, v_run);

    -- le secret statistique est une ligne assumée, pas une absence
    insert into core.observations (indicator_id, geo_level, geo_code, geo_vintage, period,
                                   variant, value, value_status, run_id)
    values ('test_ind', 'commune', '33318', 2026, '2022', 'total', null, 'confidential', v_run);

    -- 1. détection de changement : même SHA-256 => rejet
    begin
        insert into meta.raw_assets (run_id, dataset_id, r2_key, content_sha256)
        values (v_run, 'test-ds', 'raw/test/2', repeat('a', 64));
        raise exception 'ECHEC TEST 1 : doublon de snapshot accepté';
    exception when unique_violation then null;
    end;

    -- 2. pas d'observation sans lineage (run_id)
    begin
        insert into core.observations (indicator_id, geo_level, geo_code, geo_vintage, period, value)
        values ('test_ind', 'commune', '33318', 2026, '2021', 1);
        raise exception 'ECHEC TEST 2 : observation sans run_id acceptée';
    exception when not_null_violation then null;
    end;

    -- 3. pas d'observation sur un territoire inconnu du référentiel
    begin
        insert into core.observations (indicator_id, geo_level, geo_code, geo_vintage, period, value, run_id)
        values ('test_ind', 'commune', '99999', 2026, '2023', 1, v_run);
        raise exception 'ECHEC TEST 3 : code géo inconnu accepté';
    exception when foreign_key_violation then null;
    end;

    -- 4. jamais d'AE/CP sur une recette
    declare v_budget bigint;
    begin
        insert into fin.public_budgets (geo_level, geo_code, geo_vintage, budget_type, entity_kind,
                                        fiscal_year, accounting_frame, stage, run_id)
        values ('pays', 'FR', 2026, 'LFI', 'etat', 2026, 'budgetaire', 'vote', v_run)
        returning budget_id into v_budget;
        begin
            insert into fin.public_budget_lines (budget_id, fiscal_year, side, line_kind, ae, amount)
            values (v_budget, 2026, 'recette', 'recette_fiscale', 100, 100);
            raise exception 'ECHEC TEST 4 : AE sur une recette acceptée';
        exception when check_violation then null;
        end;
    end;

    -- 5. pas de publication sans fiche (definition_id)
    begin
        insert into core.indicators (indicator_id, dataset_id, theme, label_fr, unit, published)
        values ('test_ind2', 'test-ds', 'population', 'Sans fiche', 'count', true);
        raise exception 'ECHEC TEST 5 : indicateur publié sans définition accepté';
    exception when check_violation then null;
    end;

    -- 6. définition grand public limitée à 50 mots
    begin
        insert into meta.methodology_notes (scope, scope_ref, title, public_definition)
        values ('indicator', 'test_ind', 'Trop long',
                repeat('mot ', 50) || 'cinquante-et-unieme');
        raise exception 'ECHEC TEST 6 : définition de 51 mots acceptée';
    exception when check_violation then null;
    end;

    -- 7. RGPD : personne physique sans agrégation refusée
    begin
        insert into fin.public_subsidies (granter, beneficiary_kind, fiscal_year, amount, run_id)
        values ('etat', 'entreprise', 2026, 1000, v_run);
        raise exception 'ECHEC TEST 7 : bénéficiaire sans SIREN ni agrégation accepté';
    exception when check_violation then null;
    end;

    -- 8. geo.passage : identité quand aucun événement territorial
    if not exists (
        select 1 from geo.passage('commune', '33318', 2026, 2026)
        where geo_code = '33318' and population_share = 1
    ) then
        raise exception 'ECHEC TEST 8 : geo.passage identité incorrecte';
    end if;

    raise notice 'Tous les tests de contraintes passent.';
end $$;

rollback;

-- Présence du seed : les jeux P0 du registre (docs/01) doivent être chargés
do $$
declare c integer;
begin
    select count(*) into c from meta.dataset_registry where priority = 'P0';
    if c < 25 then
        raise exception 'Seed incomplet : % jeux P0 (attendu >= 25)', c;
    end if;
    if exists (
        select 1 from meta.dataset_registry d
        left join meta.source_registry s using (source_id) where s.source_id is null
    ) then
        raise exception 'Seed incohérent : dataset sans source';
    end if;
    raise notice 'Seed OK : % jeux P0.', c;
end $$;
