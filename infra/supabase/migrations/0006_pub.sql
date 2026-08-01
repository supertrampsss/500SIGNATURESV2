-- Surface publique : seules ces vues sont exposées (docs/02 §E).
-- pub.mv_territory_card et pub.mv_map_layers arrivent au ticket T-17 (exports),
-- quand la forme exacte des fiches sera fixée — pas de stub spéculatif.

create view pub.indicators as
select indicator_id, dataset_id, definition_id, theme, label_fr, unit,
       denominator_indicator_id, additive, price_basis, seasonal_adjustment,
       accounting_frame, geo_levels, time_granularity, first_period, last_period
from core.indicators
where published;

create view pub.observations as
select o.indicator_id, o.geo_level, o.geo_code, o.geo_vintage, o.period,
       o.variant, o.value, o.value_status, o.quality_flags
from core.observations o
join core.indicators i using (indicator_id)
where i.published;

-- Domaines servis par le spine (docs/02 §D) : une vue par thème
create view pub.public_demography as
select o.* from pub.observations o
join core.indicators i using (indicator_id) where i.theme = 'population';

create view pub.public_security as
select o.* from pub.observations o
join core.indicators i using (indicator_id) where i.theme = 'securite';

create view pub.public_transport as
select o.* from pub.observations o
join core.indicators i using (indicator_id) where i.theme = 'transport';

create view pub.public_energy_environment as
select o.* from pub.observations o
join core.indicators i using (indicator_id) where i.theme in ('energie','environnement');

-- Seule surface autorisée pour le comparateur international (docs/02 §D)
create materialized view pub.european_comparisons as
select o.indicator_id, o.geo_code as country, o.period, o.variant,
       o.value, o.value_status,
       i.unit, i.price_basis as unit_basis,
       ('break_in_series' = any(o.quality_flags)) as series_break,
       true as harmonized
from core.observations o
join core.indicators i using (indicator_id)
where i.published and o.geo_level = 'pays' and i.theme = 'europe'
with no data;
create unique index on pub.european_comparisons (indicator_id, country, period, variant);

-- Dashboard public de fraîcheur (docs/03 §6)
create materialized view pub.mv_freshness as
select d.dataset_id, d.title, d.priority, d.update_frequency, d.expected_freshness_days,
       r.last_success_at,
       ra.last_fetched_at,
       case
         when d.expected_freshness_days is null or ra.last_fetched_at is null then null
         else greatest(0,
              extract(day from now() - ra.last_fetched_at)::int - d.expected_freshness_days)
       end as delay_days
from meta.dataset_registry d
left join lateral (
    select max(finished_at) as last_success_at
    from meta.ingestion_runs r where r.dataset_id = d.dataset_id and r.status = 'success'
) r on true
left join lateral (
    select max(fetched_at) as last_fetched_at
    from meta.raw_assets a where a.dataset_id = d.dataset_id
) ra on true
where d.priority <> 'EXCLU';
create unique index on pub.mv_freshness (dataset_id);
