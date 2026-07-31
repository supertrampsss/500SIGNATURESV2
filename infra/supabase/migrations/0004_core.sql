-- Spine analytique : indicateurs et observations (docs/02-modele-donnees.md §C)

create table core.indicator_definitions (
    definition_id       bigint generated always as identity primary key,
    methodology_note_id bigint references meta.methodology_notes,
    -- définition grand public : 50 mots maximum (charte, docs/06)
    public_definition   text not null check (
        array_length(regexp_split_to_array(trim(public_definition), '\s+'), 1) <= 50
    ),
    technical_definition text,
    formula              text,
    unit_notes           text,
    confidence_level     text not null check (confidence_level in ('observed','computed','estimated')),
    download_url         text,
    badges               text[] not null default '{}'
);

create table core.indicators (
    indicator_id             text primary key,
    dataset_id               text not null references meta.dataset_registry,
    definition_id            bigint references core.indicator_definitions,
    theme                    text not null,
    label_fr                 text not null,
    unit                     text not null,
    denominator_indicator_id text references core.indicators,
    -- sommable territorialement (faux pour médianes, taux, indices)
    additive                 boolean not null default false,
    price_basis              text check (price_basis in ('current','constant','SPA')),
    seasonal_adjustment      text check (seasonal_adjustment in ('nsa','sa','cvs-cjo')),
    accounting_frame         text check (accounting_frame in ('budgetaire','generale','nationale')),
    geo_levels               text[] not null default '{}',
    time_granularity         text,
    first_period             text,
    last_period              text,
    published                boolean not null default false,
    -- pas de publication sans fiche complète (docs/06)
    check (not published or definition_id is not null)
);
create index on core.indicators (theme);

alter table meta.change_log
    add constraint change_log_indicator_fk
    foreign key (indicator_id) references core.indicators;

create table core.observations (
    indicator_id  text not null references core.indicators,
    geo_level     text not null,
    geo_code      text not null,
    geo_vintage   smallint not null,
    period        text not null, -- ISO : '2024', '2024-Q1', '2024-05'
    variant       text not null default 'total',
    value         numeric,
    -- le secret statistique est une ligne, pas une absence (docs/02 §F)
    value_status  text not null default 'normal' check (value_status in
                  ('normal','provisional','revised','confidential','not_available')),
    quality_flags text[] not null default '{}',
    run_id        uuid not null references meta.ingestion_runs,
    primary key (indicator_id, geo_level, geo_code, geo_vintage, period, variant),
    foreign key (geo_level, geo_code, geo_vintage)
        references geo.geography_reference (geo_level, geo_code, vintage),
    check (value is not null or value_status in ('confidential','not_available'))
) partition by hash (indicator_id);

do $$
begin
    for i in 0..15 loop
        execute format(
            'create table core.observations_p%s partition of core.observations
             for values with (modulus 16, remainder %s)', i, i);
    end loop;
end $$;

create index on core.observations (geo_level, geo_code, period);

-- valeurs remplacées : « ce chiffre a été révisé » (docs/02 §C)
create table core.observations_revisions (
    indicator_id  text not null,
    geo_level     text not null,
    geo_code      text not null,
    geo_vintage   smallint not null,
    period        text not null,
    variant       text not null,
    old_value     numeric,
    old_status    text,
    superseded_at timestamptz not null default now(),
    run_id        uuid not null references meta.ingestion_runs,
    primary key (indicator_id, geo_level, geo_code, geo_vintage, period, variant, superseded_at)
);

-- jeux multidimensionnels (sexe × âge × PCS…), jumelle d'observations
create table core.observations_dimensional (
    obs_id       bigint generated always as identity primary key,
    indicator_id text not null references core.indicators,
    geo_level    text not null,
    geo_code     text not null,
    geo_vintage  smallint not null,
    period       text not null,
    value        numeric,
    value_status text not null default 'normal' check (value_status in
                 ('normal','provisional','revised','confidential','not_available')),
    run_id       uuid not null references meta.ingestion_runs,
    foreign key (geo_level, geo_code, geo_vintage)
        references geo.geography_reference (geo_level, geo_code, vintage),
    check (value is not null or value_status in ('confidential','not_available'))
);

create table core.dim_registry (
    dim_name     text primary key,
    codelist_url text, -- SDMX quand elle existe
    description  text
);

create table core.observation_dimensions (
    obs_id    bigint not null references core.observations_dimensional on delete cascade,
    dim_name  text not null references core.dim_registry,
    dim_value text not null,
    primary key (obs_id, dim_name)
);
