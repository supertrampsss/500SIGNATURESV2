-- Chargement idempotent du registre des sources (T-05).
-- À exécuter depuis la racine du dépôt : psql -v ON_ERROR_STOP=1 -f infra/supabase/seed/load_seed.sql
\set ON_ERROR_STOP on
begin;

create temp table _src (
    source_id text, name text, producer text, access_category text, base_url text,
    doc_url text, auth_mode text, license text, country_scope text
) on commit drop;
\copy _src from 'infra/supabase/seed/source_registry.csv' with (format csv, header true)

insert into meta.source_registry
    (source_id, name, producer, access_category, base_url, doc_url, auth_mode, license, country_scope)
select source_id, name, producer, access_category, nullif(base_url, ''),
       nullif(doc_url, ''), nullif(auth_mode, ''), license, country_scope
from _src
on conflict (source_id) do update set
    name = excluded.name, producer = excluded.producer,
    access_category = excluded.access_category, base_url = excluded.base_url,
    doc_url = excluded.doc_url, auth_mode = excluded.auth_mode,
    license = excluded.license, country_scope = excluded.country_scope;

create temp table _ds (
    dataset_id text, source_id text, external_id text, title text, endpoint_url text,
    format text, update_frequency text, expected_freshness_days text, geo_granularity text,
    time_granularity text, priority text, ingestion_mode text, target_tables text,
    personal_data text, statistical_secrecy text
) on commit drop;
\copy _ds from 'infra/supabase/seed/dataset_registry.csv' with (format csv, header true)

insert into meta.dataset_registry
    (dataset_id, source_id, external_id, title, endpoint_url, format, update_frequency,
     expected_freshness_days, geo_granularity, time_granularity, priority, ingestion_mode,
     target_tables, personal_data, statistical_secrecy)
select dataset_id, source_id, nullif(external_id, ''), title, nullif(endpoint_url, ''),
       nullif(format, ''), nullif(update_frequency, ''),
       nullif(expected_freshness_days, '')::integer, nullif(geo_granularity, ''),
       nullif(time_granularity, ''), priority, nullif(ingestion_mode, ''),
       case when target_tables = '' then null else string_to_array(target_tables, '|') end,
       personal_data::boolean, statistical_secrecy::boolean
from _ds
on conflict (dataset_id) do update set
    source_id = excluded.source_id, external_id = excluded.external_id,
    title = excluded.title, endpoint_url = excluded.endpoint_url,
    format = excluded.format, update_frequency = excluded.update_frequency,
    expected_freshness_days = excluded.expected_freshness_days,
    geo_granularity = excluded.geo_granularity,
    time_granularity = excluded.time_granularity, priority = excluded.priority,
    ingestion_mode = excluded.ingestion_mode, target_tables = excluded.target_tables,
    personal_data = excluded.personal_data,
    statistical_secrecy = excluded.statistical_secrecy;

commit;
