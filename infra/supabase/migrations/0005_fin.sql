-- Tables métier finances publiques et domaines (docs/02-modele-donnees.md §D)
-- Partitionnement des grosses tables (budget_lines, procurement) volontairement
-- différé : tables vides aujourd'hui, stratégie documentée dans docs/02 — sera
-- activé quand le volume le justifiera (CLAUDE.md « Simplicity First »).

create table fin.public_budgets (
    budget_id        bigint generated always as identity primary key,
    geo_level        text not null,
    geo_code         text not null,
    geo_vintage      smallint not null,
    budget_type      text not null check (budget_type in
                     ('LFI','LFR','PLF','PLRG','BP','CA','CFU','LFSS','BUDGET_UE')),
    entity_kind      text not null check (entity_kind in
                     ('etat','commune','epci','departement','region','asso','odac','ue')),
    entity_siren     char(9),
    fiscal_year      smallint not null,
    vote_date        date,
    accounting_frame text not null check (accounting_frame in ('budgetaire','generale','nationale')),
    stage            text not null check (stage in ('vote','rectifie','execute')),
    dataset_id       text references meta.dataset_registry,
    run_id           uuid not null references meta.ingestion_runs,
    foreign key (geo_level, geo_code, geo_vintage)
        references geo.geography_reference (geo_level, geo_code, vintage),
    unique nulls not distinct (entity_kind, entity_siren, fiscal_year, budget_type, stage)
);

create table fin.public_budget_lines (
    line_id       bigint generated always as identity primary key,
    budget_id     bigint not null references fin.public_budgets on delete cascade,
    fiscal_year   smallint not null,
    side          text not null check (side in ('depense','recette')),
    mission       text,
    programme     text,
    action        text,
    sous_action   text,
    titre         text,
    cofog         varchar(6),
    fonction_m57  text,
    chapitre      text,
    nature_compte text,
    line_kind     text not null check (line_kind in
                  ('credit','depense_fiscale','recette_fiscale','recette_non_fiscale','recette_affectee')),
    ae            numeric(18,2),
    cp            numeric(18,2),
    amount        numeric(18,2),
    currency      char(3) not null default 'EUR',
    label         text,
    -- jamais d'AE/CP sur une recette (docs/02 §F)
    check (side <> 'recette' or (ae is null and cp is null)),
    check (ae is not null or cp is not null or amount is not null)
);
create index on fin.public_budget_lines (budget_id);
create index on fin.public_budget_lines (mission, programme);
create index on fin.public_budget_lines (cofog);
create index on fin.public_budget_lines (fiscal_year);

create table fin.public_executions (
    execution_id bigint generated always as identity primary key,
    budget_id    bigint not null references fin.public_budgets,
    run_id       uuid not null references meta.ingestion_runs,
    period       text not null, -- mois ou année
    mission      text,
    programme    text,
    titre        text,
    ae_consumed  numeric(18,2),
    cp_paid      numeric(18,2),
    receipts     numeric(18,2),
    balance      numeric(18,2),
    basis        text check (basis in ('encaissements','droits_constates'))
);
create index on fin.public_executions (budget_id, period);

create table fin.public_transfers (
    transfer_id          bigint generated always as identity primary key,
    transfer_type        text not null,
    fiscal_year          smallint not null,
    amount               numeric(18,2) not null,
    currency             char(3) not null default 'EUR',
    label                text,
    sender_geo_level     text,
    sender_geo_code      text,
    sender_geo_vintage   smallint,
    sender_siren         char(9),
    receiver_geo_level   text,
    receiver_geo_code    text,
    receiver_geo_vintage smallint,
    receiver_siren       char(9),
    dataset_id           text references meta.dataset_registry,
    run_id               uuid not null references meta.ingestion_runs,
    foreign key (sender_geo_level, sender_geo_code, sender_geo_vintage)
        references geo.geography_reference (geo_level, geo_code, vintage),
    foreign key (receiver_geo_level, receiver_geo_code, receiver_geo_vintage)
        references geo.geography_reference (geo_level, geo_code, vintage),
    -- un receveur identifiable : territoire ou SIREN
    check (receiver_geo_code is not null or receiver_siren is not null)
);
create index on fin.public_transfers (receiver_geo_code, fiscal_year);
create index on fin.public_transfers (transfer_type, fiscal_year);

create table fin.public_debt (
    debt_id          bigint generated always as identity primary key,
    debt_scope       text not null check (debt_scope in
                     ('etat_negociable','apu_maastricht','apul','asso','collectivite')),
    metric           text not null check (metric in
                     ('stock','interets','emissions','duree_moyenne','taux_moyen','part_non_residents')),
    period           text not null,
    value            numeric not null,
    unit             text not null check (unit in ('EUR_M','percent','years')),
    accounting_frame text check (accounting_frame in ('budgetaire','generale','nationale')),
    geo_level        text,
    geo_code         text,
    geo_vintage      smallint,
    siren            char(9),
    run_id           uuid not null references meta.ingestion_runs,
    foreign key (geo_level, geo_code, geo_vintage)
        references geo.geography_reference (geo_level, geo_code, vintage),
    unique nulls not distinct (debt_scope, metric, period, geo_level, geo_code, geo_vintage, siren)
);

create table fin.public_procurement (
    contract_id       text primary key, -- id DECP normalisé
    buyer_siret       char(14),
    buyer_geo_code    text,
    supplier_siret    char(14),
    supplier_geo_code text,
    cpv               varchar(10),
    procedure_type    text,
    notified_at       date,
    duration_months   integer,
    amount            numeric(18,2),
    execution_geo_code text,
    data_quality      text not null default 'ok'
                      check (data_quality in ('ok','suspect_amount','duplicate_candidate')),
    dataset_id        text references meta.dataset_registry,
    run_id            uuid not null references meta.ingestion_runs
);
create index on fin.public_procurement (buyer_geo_code, notified_at);
create index on fin.public_procurement (supplier_siret);
create index on fin.public_procurement (cpv);

create table fin.public_subsidies (
    subsidy_id         bigint generated always as identity primary key,
    granter            text not null check (granter in
                       ('etat','region','departement','commune','ue','operateur')),
    granter_ref        text,
    beneficiary_siren  char(9),
    beneficiary_kind   text not null check (beneficiary_kind in
                       ('association','entreprise','collectivite','agrege_commune')),
    beneficiary_geo_code text,
    scheme             text,
    fiscal_year        smallint not null,
    amount             numeric(18,2) not null,
    source_publication text,
    run_id             uuid not null references meta.ingestion_runs,
    -- RGPD : personnes physiques uniquement en agrégats communaux (docs/02 §D)
    check (beneficiary_siren is not null or beneficiary_kind = 'agrege_commune')
);
create index on fin.public_subsidies (beneficiary_geo_code, fiscal_year);

create table fin.public_employment (
    id          bigint generated always as identity primary key,
    -- le concept fait partie de l'identité : interdit de mélanger BIT et DEFM
    concept     text not null check (concept in
                ('BIT','DEFM_A','DEFM_ABC','effectifs_prives','effectifs_fpe',
                 'effectifs_fpt','effectifs_fph','etpt')),
    geo_level   text not null,
    geo_code    text not null,
    geo_vintage smallint not null,
    period      text not null,
    sector_naf  text,
    value       numeric not null,
    unit        text not null,
    run_id      uuid not null references meta.ingestion_runs,
    foreign key (geo_level, geo_code, geo_vintage)
        references geo.geography_reference (geo_level, geo_code, vintage)
);
create unique index on fin.public_employment
    (concept, geo_level, geo_code, geo_vintage, period, coalesce(sector_naf, ''));

create table fin.public_companies (
    id                bigint generated always as identity primary key,
    geo_level         text not null,
    geo_code          text not null,
    geo_vintage       smallint not null,
    period            text not null,
    naf               text,
    metric            text not null check (metric in ('stock','creations','defaillances')),
    legal_category    text,
    micro_entrepreneur boolean,
    value             numeric not null,
    run_id            uuid not null references meta.ingestion_runs,
    foreign key (geo_level, geo_code, geo_vintage)
        references geo.geography_reference (geo_level, geo_code, vintage)
);
create unique index on fin.public_companies
    (geo_level, geo_code, geo_vintage, period, metric,
     coalesce(naf, ''), coalesce(legal_category, ''), coalesce(micro_entrepreneur, false));

create table fin.public_health (
    id          bigint generated always as identity primary key,
    geo_level   text not null,
    geo_code    text not null,
    geo_vintage smallint not null,
    period      text not null,
    finess      text,
    category    text,
    metric      text not null,
    value       numeric not null,
    run_id      uuid not null references meta.ingestion_runs,
    foreign key (geo_level, geo_code, geo_vintage)
        references geo.geography_reference (geo_level, geo_code, vintage)
);
create index on fin.public_health (geo_code, period);

create table fin.public_education (
    id          bigint generated always as identity primary key,
    geo_level   text not null,
    geo_code    text not null,
    geo_vintage smallint not null,
    period      text not null, -- rentrée scolaire
    uai         char(8),
    sector      text,
    metric      text not null,
    value       numeric not null,
    run_id      uuid not null references meta.ingestion_runs,
    foreign key (geo_level, geo_code, geo_vintage)
        references geo.geography_reference (geo_level, geo_code, vintage)
);
create index on fin.public_education (geo_code, period);
create index on fin.public_education (uai) where uai is not null;

create table fin.public_housing (
    id            bigint generated always as identity primary key,
    geo_level     text not null,
    geo_code      text not null,
    geo_vintage   smallint not null,
    period        text not null,
    metric        text not null check (metric in
                  ('n_mutations','prix_median_m2','parc_social','logements_autorises',
                   'loyer_indicatif_m2','couverture')),
    property_type text,
    value         numeric not null,
    -- valeurs modélisées (loyers) : badge Estimation obligatoire côté produit
    estimation    boolean not null default false,
    run_id        uuid not null references meta.ingestion_runs,
    foreign key (geo_level, geo_code, geo_vintage)
        references geo.geography_reference (geo_level, geo_code, vintage)
);
create unique index on fin.public_housing
    (geo_level, geo_code, geo_vintage, period, metric, coalesce(property_type, ''));

create table fin.demography_firstnames (
    geo_level   text not null,
    geo_code    text not null,
    geo_vintage smallint not null,
    year        smallint not null,
    sex         char(1) not null check (sex in ('F','M')),
    firstname   text not null,
    n           integer not null,
    run_id      uuid not null references meta.ingestion_runs,
    primary key (geo_level, geo_code, geo_vintage, year, sex, firstname),
    foreign key (geo_level, geo_code, geo_vintage)
        references geo.geography_reference (geo_level, geo_code, vintage)
);
