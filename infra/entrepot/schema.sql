-- Schéma de l'entrepôt DuckDB.
--
-- Port du schéma Supabase (infra/supabase/migrations/, 826 lignes, 32 tables).
-- Deux décisions se lisent dans ce fichier.
--
-- **1. Seules les tables réellement écrites sont ici : quinze sur trente-deux.**
-- Dix-sept n'étaient touchées par aucun module du pipeline — structure écrite en
-- avance sur une donnée qui n'est jamais venue : `core.observations_dimensional`
-- et ses deux satellites, `fin.public_executions`, `public_transfers`,
-- `public_debt`, `public_procurement`, `public_subsidies`, `public_companies`,
-- `public_health`, `public_education`, `public_housing`,
-- `demography_firstnames`, `meta.methodology_notes`, `meta.transformations`,
-- `meta.citations`, et l'ensemble des vues `pub.*` que `publish.py` n'a jamais
-- lues — il interroge `core.*` directement. Elles sont nommées ici plutôt que
-- recréées vides : le modèle de données reste décrit dans docs/02, et une table
-- vide qu'aucun code ne remplit finit par se faire lire comme une absence de
-- donnée alors qu'elle est une absence de code.
--
-- **2. Ce que Postgres faisait et que DuckDB ne fait pas** est signalé à chaque
-- endroit concerné, jamais silencieusement abandonné. Trois différences
-- comptent, et la troisième aurait produit des doublons sans qu'on s'en
-- aperçoive :
--
--   - pas de partitionnement (`partition by hash` sur les observations) : il
--     n'était référencé nulle part hors de sa migration, et DuckDB est
--     colonnaire — quatorze millions de lignes ne le gênent pas ;
--   - pas d'index d'expression ni d'index partiel : les unicités qui en
--     dépendaient passent par des colonnes normalisées, écrites plus bas ;
--   - **une table référencée ne se met pas à jour par `on conflict`.** DuckDB
--     exécute `insert ... on conflict` comme un delete suivi d'un insert, et le
--     delete se heurte à la clé étrangère qui pointe vers la ligne. Vérifié : ni
--     `do update` ni même `do nothing` ne passent dès qu'une autre table
--     référence la ligne visée, et un `update` échoue lui aussi s'il touche une
--     colonne qui porte elle-même une clé étrangère. Or le registre des sources
--     et des jeux, le catalogue d'indicateurs et leurs fiches sont précisément
--     des tables qu'on réécrit à chaque run et que tout le reste référence. Les
--     clés entrantes sur ces quatre tables deviennent donc des colonnes simples,
--     signalées par `-> table (vérifié)` et recensées par
--     `entrepot.verifier_integrite()`. C'est la même réponse que pour les clés
--     inter-schémas : la garantie n'est pas perdue, elle est déplacée du moment
--     de l'écriture à celui du contrôle ;
--   - **les clés étrangères ne traversent pas un schéma.** DuckDB refuse de les
--     créer. Celles qui rattachaient une observation, un budget ou un maire à
--     son run d'ingestion sont donc devenues des colonnes simples, signalées une
--     à une par un commentaire `-> table (vérifié)`. La garantie n'est pas
--     perdue mais déplacée : `entrepot.verifier_integrite()` recense les
--     orphelins après chaque chargement, et un orphelin fait échouer le run
--     plutôt que d'être publié. Une contrainte silencieusement retirée aurait
--     été le pire des trois choix ;
--   - **une clé unique contenant NULL ne dédoublonne pas.** Postgres avait
--     `unique nulls not distinct` ; DuckDB suit la norme SQL, où deux NULL sont
--     distincts. Vérifié : deux insertions identiques avec un SIREN nul passent
--     toutes les deux. Les colonnes concernées n'acceptent donc plus NULL et
--     portent la chaîne vide, ce que la contrainte `not null` garantit.

create schema if not exists meta;
create schema if not exists geo;
create schema if not exists core;
create schema if not exists fin;

-- DuckDB n'a pas `generated always as identity` : une séquence par table.
create sequence if not exists meta.seq_data_quality_checks;
create sequence if not exists meta.seq_change_log;
create sequence if not exists geo.seq_geography_history;
create sequence if not exists core.seq_indicator_definitions;
create sequence if not exists fin.seq_public_budgets;
create sequence if not exists fin.seq_public_budget_lines;
create sequence if not exists fin.seq_public_employment;
create sequence if not exists fin.seq_public_subsidies;

-- ---------------------------------------------------------------- meta
-- Registres et lineage (docs/02 §A).

create table if not exists meta.source_registry (
    source_id         text primary key,
    name              text not null,
    producer          text not null,
    access_category   text not null check (access_category in ('A','B','C','D','E','F')),
    base_url          text,
    doc_url           text,
    auth_mode         text,
    license           text not null,
    license_url       text,
    rate_limit        text,
    country_scope     text not null default 'FR' check (country_scope in ('FR','EU','INT')),
    reliability_notes text,
    active            boolean not null default true,
    created_at        timestamptz not null default now()
);

create table if not exists meta.dataset_registry (
    dataset_id              text primary key,
    source_id               text not null,  -- -> meta.source_registry (vérifié)
    external_id             text,
    title                   text not null,
    landing_url             text,
    endpoint_url            text,
    format                  text,
    update_frequency        text,
    expected_freshness_days integer,
    geo_granularity         text,
    time_granularity        text,
    history_start           text,
    join_keys               text[],
    volume_estimate         text,
    priority                text not null check (priority in ('P0','P1','P2','P3','EXCLU')),
    ingestion_mode          text,
    target_tables           text[],
    limitations             text,
    personal_data           boolean not null default false,
    statistical_secrecy     boolean not null default false,
    created_at              timestamptz not null default now()
);

-- L'identifiant de run est un UUID produit côté Python : DuckDB sait générer un
-- uuid, mais le lineage doit pouvoir citer le run avant de l'écrire.
create table if not exists meta.ingestion_runs (
    run_id            uuid primary key,
    dataset_id        text not null,  -- -> meta.dataset_registry (vérifié)
    started_at        timestamptz not null default now(),
    finished_at       timestamptz,
    status            text not null default 'running'
                      check (status in ('running','success','failed','superseded')),
    connector_version text,
    trigger           text check (trigger in ('cron','manual','backfill')),
    rows_read         bigint,
    rows_written      bigint,
    error_details     json,
    logs_url          text
);

-- La détection de changement du projet : même contenu, même sha, conflit, donc
-- pas de retraitement. C'est la seule contrainte d'unicité dont dépend la
-- correction du pipeline — d'où le test qui la couvre.
create table if not exists meta.raw_assets (
    asset_id                text primary key,
    run_id                  uuid not null references meta.ingestion_runs (run_id),
    dataset_id              text not null,  -- -> meta.dataset_registry (vérifié)
    r2_key                  text not null,
    fetched_at              timestamptz not null default now(),
    source_url              text,
    content_sha256          text not null,
    size_bytes              bigint,
    content_type            text,
    producer_last_modified  timestamptz,
    http_status             integer,
    unique (dataset_id, content_sha256)
);

create table if not exists meta.data_quality_checks (
    check_id   bigint primary key default nextval('meta.seq_data_quality_checks'),
    run_id     uuid not null references meta.ingestion_runs (run_id),
    dataset_id text not null,  -- -> meta.dataset_registry (vérifié)
    check_name text not null,
    severity   text not null check (severity in ('blocker','warning','info')),
    passed     boolean not null,
    observed   json,
    expected   json,
    ran_at     timestamptz not null default now()
);

create table if not exists meta.change_log (
    change_id             bigint primary key default nextval('meta.seq_change_log'),
    dataset_id            text,  -- -> meta.dataset_registry (vérifié)
    indicator_id          text,
    change_type           text not null check (change_type in
                          ('correction','methodology','break','revision','deprecation')),
    description_public    text not null,
    description_technical text,
    effective_date        date,
    announced_at          timestamptz not null default now(),
    author                text
);

-- ---------------------------------------------------------------- geo
-- Référentiel historisé (docs/02 §B).

-- Les géométries étaient stockées en PostGIS. Elles le sont désormais en
-- GeoJSON : le calcul géométrique — unions d'EPCI, simplifications — se faisait
-- déjà en Shapely dans `normalize/geometries.py`, jamais en SQL. PostGIS servait
-- de type de colonne, pas de moteur. La contrainte `st_isvalid` disparaît donc
-- avec lui ; la validité se vérifie côté Shapely, où la forme est construite.
create table if not exists geo.geography_reference (
    geo_level       text not null check (geo_level in (
                    'commune','arrondissement_municipal','epci','departement','region',
                    'collectivite_om','zone_emploi','aav','uu','bassin_vie','iris',
                    'nuts1','nuts2','nuts3','pays')),
    geo_code        text not null,
    vintage         smallint not null,
    name            text not null,
    parent_level    text,
    parent_code     text,
    siren           text,
    population      integer,
    area_ha         double,
    density_grid    smallint,
    flags           json not null default '{}',
    geom            text,
    geom_simplified text,
    centroid        text,
    primary key (geo_level, geo_code, vintage)
);

create table if not exists geo.geography_history (
    event_id         bigint primary key default nextval('geo.seq_geography_history'),
    event_type       text not null check (event_type in (
                     'fusion','scission','changement_code','changement_nom',
                     'transfert','creation','suppression','revision_nuts')),
    event_date       date not null,
    from_level       text not null,
    from_code        text not null,
    from_vintage     smallint not null,
    to_level         text not null,
    to_code          text not null,
    to_vintage       smallint not null,
    population_share double check (population_share > 0 and population_share <= 1),
    source           text,
    check (to_vintage > from_vintage or event_type = 'changement_nom')
);

-- Maires en exercice (RNE). Ni date de naissance, ni sexe, ni profession : la
-- règle du projet interdit de stocker des données personnelles, et l'identité
-- d'un maire n'est publique qu'au titre de la fonction qu'il exerce.
create table if not exists geo.commune_officials (
    geo_code    text not null,
    geo_vintage smallint not null,
    role        text not null default 'maire' check (role in ('maire')),
    surname     text not null,
    given_name  text not null,
    since       date,
    run_id      uuid,  -- -> meta.ingestion_runs, vérifié par entrepot.verifier_integrite
    primary key (geo_code, geo_vintage, role)
);

-- ---------------------------------------------------------------- core
-- Indicateurs et observations (docs/02 §C).

create table if not exists core.indicator_definitions (
    definition_id        bigint primary key default nextval('core.seq_indicator_definitions'),
    public_definition    text not null check (len(regexp_split_to_array(trim(public_definition), '\s+')) <= 50),
    technical_definition text,
    formula              text,
    unit_notes           text,
    confidence_level     text not null check (confidence_level in ('observed','computed','estimated','derived')),
    download_url         text,
    badges               text[] not null default []
);

create table if not exists core.indicators (
    indicator_id             text primary key,
    dataset_id               text not null,  -- -> meta.dataset_registry (vérifié)
    definition_id            bigint,  -- -> core.indicator_definitions (vérifié)
    theme                    text not null,
    label_fr                 text not null,
    unit                     text not null,
    denominator_indicator_id text,
    additive                 boolean not null default false,
    price_basis              text check (price_basis in ('current','constant','SPA')),
    seasonal_adjustment      text check (seasonal_adjustment in ('nsa','sa','cvs-cjo')),
    accounting_frame         text check (accounting_frame in ('budgetaire','generale','nationale')),
    geo_levels               text[] not null default [],
    time_granularity         text,
    first_period             text,
    last_period              text,
    published                boolean not null default false,
    -- pas de publication sans fiche complète (docs/06)
    check (not published or definition_id is not null)
);

-- Le partitionnement par hash sur `indicator_id` disparaît : il n'était
-- référencé nulle part hors de sa migration, et un moteur colonnaire n'en a pas
-- besoin pour quatorze millions de lignes.
create table if not exists core.observations (
    indicator_id  text not null,  -- -> core.indicators (vérifié)
    geo_level     text not null,
    geo_code      text not null,
    geo_vintage   smallint not null,
    period        text not null,
    variant       text not null default 'total',
    value         double,
    -- le secret statistique est une ligne, pas une absence (docs/02 §F)
    value_status  text not null default 'normal' check (value_status in
                  ('normal','provisional','revised','confidential','not_available')),
    quality_flags text[] not null default [],
    run_id        uuid not null,  -- -> meta.ingestion_runs (vérifié)
    primary key (indicator_id, geo_level, geo_code, geo_vintage, period, variant),
    check (value is not null or value_status in ('confidential','not_available'))
);

create table if not exists core.observations_revisions (
    indicator_id  text not null,
    geo_level     text not null,
    geo_code      text not null,
    geo_vintage   smallint not null,
    period        text not null,
    variant       text not null,
    old_value     double,
    old_status    text,
    superseded_at timestamptz not null default now(),
    run_id        uuid not null,  -- -> meta.ingestion_runs (vérifié)
    primary key (indicator_id, geo_level, geo_code, geo_vintage, period, variant, superseded_at)
);

-- ---------------------------------------------------------------- fin
-- Budgets publics (docs/02 §D).

-- `entity_siren` ne peut plus être NULL : la clé d'unicité le contient, et une
-- clé unique contenant NULL ne dédoublonne pas sous DuckDB. Le budget de l'État,
-- qui n'a pas de SIREN, porte la chaîne vide.
create table if not exists fin.public_budgets (
    budget_id                bigint primary key default nextval('fin.seq_public_budgets'),
    geo_level                text not null,
    geo_code                 text not null,
    geo_vintage              smallint not null,
    budget_type              text not null check (budget_type in
                             ('LFI','LFR','PLF','PLRG','BP','CA','CFU','LFSS','BUDGET_UE')),
    entity_kind              text not null check (entity_kind in
                             ('etat','commune','epci','departement','region','asso','odac','ue')),
    entity_siren             text not null default '',
    fiscal_year              smallint not null,
    vote_date                date,
    accounting_frame         text not null check (accounting_frame in ('budgetaire','generale','nationale')),
    stage                    text not null check (stage in ('vote','rectifie','execute')),
    balance                  double,
    special_accounts_balance double,
    annexed_budgets_balance  double,
    dataset_id               text,  -- -> meta.dataset_registry (vérifié)
    run_id                   uuid not null,  -- -> meta.ingestion_runs (vérifié)
    unique (entity_kind, entity_siren, fiscal_year, budget_type, stage)
);

-- `agregat` marque les lignes qui en recouvrent d'autres — totaux et reprises.
-- La règle de lecture tient en une clause : `where line_kind <> 'agregat'`.
-- Sans elle, une table où détail et totaux se ressemblent se laisse sommer et
-- donne un chiffre doublé.
create table if not exists fin.public_budget_lines (
    line_id       bigint primary key default nextval('fin.seq_public_budget_lines'),
    budget_id     bigint not null references fin.public_budgets (budget_id),
    fiscal_year   smallint not null,
    side          text not null check (side in ('depense','recette')),
    mission       text,
    programme     text,
    action        text,
    sous_action   text,
    titre         text,
    cofog         text,
    fonction_m57  text,
    chapitre      text,
    nature_compte text,
    line_kind     text not null check (line_kind in
                  ('credit','depense_fiscale','recette_fiscale','recette_non_fiscale',
                   'recette_affectee','agregat')),
    ae            double,
    cp            double,
    amount        double,
    currency      text not null default 'EUR',
    label         text,
    -- jamais d'AE/CP sur une recette (docs/02 §F)
    check (side <> 'recette' or (ae is null and cp is null)),
    check (ae is not null or cp is not null or amount is not null)
);

-- Les subventions de l'État aux associations, bénéficiaire par bénéficiaire.
--
-- Ce n'est pas une ligne de budget et la table est donc à part. `public_budget_lines`
-- décrit un budget voté, dont la géographie est celle de la collectivité qui le
-- vote ; ici chaque ligne porte **sa propre** commune, celle du bénéficiaire, et
-- il y en a cinquante-trois mille pour un seul budget. Les loger sous un budget
-- unique aurait perdu la commune, qui est justement ce qu'on veut publier.
--
-- `geo_code` est la commune de **l'établissement bénéficiaire**, telle que le
-- jaune budgétaire l'a appariée au moment du versement — pas la commune où
-- l'action est menée. Une fédération nationale est comptée à l'adresse de son
-- siège. Les agrégats qui en découlent ne se comparent donc pas d'un territoire
-- à l'autre, et le site refuse cette comparaison.
--
-- Le grain est le couple (bénéficiaire, programme) : le jaune porte une ligne
-- par versement, et une même association reçoit plusieurs versements au titre
-- d'un même programme. Les sommer ici plutôt qu'à la lecture évite qu'un total
-- dépende de qui l'additionne.
create table if not exists fin.public_subsidies (
    subsidy_id        bigint primary key default nextval('fin.seq_public_subsidies'),
    fiscal_year       smallint not null,
    geo_level         text not null,
    geo_code          text not null,
    geo_vintage       smallint not null,
    beneficiary_siren text not null,
    beneficiary_name  text not null,
    programme         text not null default '',
    purpose           text,
    amount            double not null,
    currency          text not null default 'EUR',
    dataset_id        text,  -- -> meta.dataset_registry (vérifié)
    run_id            uuid not null,  -- -> meta.ingestion_runs (vérifié)
    unique (fiscal_year, geo_level, geo_code, beneficiary_siren, programme)
);

-- `sector_naf` ne peut plus être NULL, pour la même raison que `entity_siren` :
-- l'unicité passait par un index d'expression `coalesce(sector_naf, '')`, que
-- DuckDB ne connaît pas. La colonne porte la chaîne vide.
create table if not exists fin.public_employment (
    id          bigint primary key default nextval('fin.seq_public_employment'),
    -- le concept fait partie de l'identité : interdit de mélanger BIT et DEFM
    concept     text not null check (concept in
                ('BIT','DEFM_A','DEFM_ABC','effectifs_prives','effectifs_fpe',
                 'effectifs_fpt','effectifs_fph','etpt')),
    geo_level   text not null,
    geo_code    text not null,
    geo_vintage smallint not null,
    period      text not null,
    sector_naf  text not null default '',
    value       double not null,
    unit        text not null,
    run_id      uuid not null,  -- -> meta.ingestion_runs (vérifié)
    unique (concept, geo_level, geo_code, geo_vintage, period, sector_naf)
);

-- ---------------------------------------------------------------- passage
-- Table de passage entre millésimes géographiques (docs/00, principe 6) :
-- **toute** comparaison inter-millésimes doit y passer, et ne sommer que des
-- indicateurs déclarés `additive`. La fonction SQL de Postgres devient une macro
-- table DuckDB — la récursion, elle, est identique.
create or replace macro geo.passage(p_level, p_code, p_vintage, p_target) as table
with recursive walk(code, vintage, share) as (
    -- Les parts sont en double, pas en décimal. Le littéral `1.0` est un
    -- DECIMAL(2,1) pour DuckDB : la multiplication en gardait l'échelle, et une
    -- scission à 0,75 / 0,25 ressortait à 0,8 / 0,3 — une population réattribuée
    -- de travers, sans erreur, sur toute comparaison inter-millésimes.
    select p_code, p_vintage, 1.0::double
    union all
    select h.to_code, h.to_vintage, w.share * coalesce(h.population_share, 1)::double
    from walk w
    join geo.geography_history h
      on h.from_level = p_level
     and h.from_code = w.code
     and h.from_vintage >= w.vintage
     and h.to_vintage > w.vintage
     and h.to_vintage <= p_target
)
select w.code as geo_code, sum(w.share) as population_share
from walk w
where not exists (
    select 1 from geo.geography_history h2
    where h2.from_level = p_level
      and h2.from_code = w.code
      and h2.from_vintage >= w.vintage
      and h2.to_vintage > w.vintage
      and h2.to_vintage <= p_target
)
group by w.code;
