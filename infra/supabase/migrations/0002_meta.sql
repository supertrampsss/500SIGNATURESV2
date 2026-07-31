-- Registres et lineage (docs/02-modele-donnees.md §A)

create table meta.source_registry (
    source_id         text primary key,
    name              text not null,
    producer          text not null,
    access_category   char(1) not null check (access_category in ('A','B','C','D','E','F')),
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

create table meta.dataset_registry (
    dataset_id              text primary key,
    source_id               text not null references meta.source_registry,
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
create index on meta.dataset_registry (source_id);
create index on meta.dataset_registry (priority);

create table meta.ingestion_runs (
    run_id            uuid primary key default gen_random_uuid(),
    dataset_id        text not null references meta.dataset_registry,
    started_at        timestamptz not null default now(),
    finished_at       timestamptz,
    status            text not null default 'running'
                      check (status in ('running','success','failed','superseded')),
    connector_version text,
    trigger           text check (trigger in ('cron','manual','backfill')),
    rows_read         bigint,
    rows_written      bigint,
    error_details     jsonb,
    logs_url          text
);
create index on meta.ingestion_runs (dataset_id, started_at desc);

create table meta.raw_assets (
    asset_id                bigint generated always as identity primary key,
    run_id                  uuid not null references meta.ingestion_runs,
    dataset_id              text not null references meta.dataset_registry,
    r2_key                  text not null,
    fetched_at              timestamptz not null default now(),
    source_url              text,
    content_sha256          char(64) not null,
    size_bytes              bigint,
    content_type            text,
    producer_last_modified  timestamptz,
    http_status             integer,
    -- détection de changement : même hash => conflit => pas de retraitement
    unique (dataset_id, content_sha256)
);
create index on meta.raw_assets (run_id);

create table meta.methodology_notes (
    note_id              bigint generated always as identity primary key,
    scope                text not null check (scope in ('dataset','indicator','domain')),
    scope_ref            text not null,
    title                text not null,
    body_md              text,
    -- définition grand public : 50 mots maximum (charte, docs/06)
    public_definition    text check (
        public_definition is null
        or array_length(regexp_split_to_array(trim(public_definition), '\s+'), 1) <= 50
    ),
    technical_definition text,
    formula              text,
    caveats_md           text,
    version              text not null default '1.0.0',
    valid_from           date not null default current_date,
    valid_to             date
);

create table meta.transformations (
    transformation_id   bigint generated always as identity primary key,
    dataset_id          text not null references meta.dataset_registry,
    name                text not null,
    code_ref            text not null, -- chemin + SHA de commit
    input_schema        jsonb,
    output_tables       text[],
    methodology_note_id bigint references meta.methodology_notes,
    version             text not null,
    valid_from          timestamptz not null default now(),
    valid_to            timestamptz,
    approved_by         text,
    approved_at         timestamptz
);

create table meta.data_quality_checks (
    check_id   bigint generated always as identity primary key,
    run_id     uuid not null references meta.ingestion_runs,
    dataset_id text not null references meta.dataset_registry,
    check_name text not null,
    severity   text not null check (severity in ('blocker','warning','info')),
    passed     boolean not null,
    observed   jsonb,
    expected   jsonb,
    ran_at     timestamptz not null default now()
);
create index on meta.data_quality_checks (dataset_id, ran_at desc);
create index on meta.data_quality_checks (dataset_id) where not passed;

create table meta.change_log (
    change_id             bigint generated always as identity primary key,
    dataset_id            text references meta.dataset_registry,
    indicator_id          text, -- FK ajoutée en 0004 (core.indicators)
    change_type           text not null check (change_type in
                          ('correction','methodology','break','revision','deprecation')),
    description_public    text not null,
    description_technical text,
    effective_date        date,
    announced_at          timestamptz not null default now(),
    author                text
);

create table meta.citations (
    citation_id  bigint generated always as identity primary key,
    quoted_source text not null,
    url           text,
    quote_text    text,
    context       text,
    retrieved_at  timestamptz not null default now()
);
