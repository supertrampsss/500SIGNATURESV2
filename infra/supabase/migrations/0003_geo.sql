-- Référentiel géographique historisé (docs/02-modele-donnees.md §B)

create table geo.geography_reference (
    geo_level       text not null check (geo_level in (
                    'commune','arrondissement_municipal','epci','departement','region',
                    'collectivite_om','zone_emploi','aav','uu','bassin_vie','iris',
                    'nuts1','nuts2','nuts3','pays')),
    geo_code        text not null,
    vintage         smallint not null,
    name            text not null,
    parent_level    text,
    parent_code     text,
    siren           char(9),
    population      integer,
    area_ha         numeric,
    density_grid    smallint,
    flags           jsonb not null default '{}',
    geom            geometry(MultiPolygon, 4326),
    geom_simplified geometry(MultiPolygon, 4326),
    centroid        geometry(Point, 4326),
    primary key (geo_level, geo_code, vintage),
    check (geom is null or st_isvalid(geom)),
    -- hiérarchie au sein d'un même millésime
    foreign key (parent_level, parent_code, vintage)
        references geo.geography_reference (geo_level, geo_code, vintage)
        deferrable initially deferred
);
create index on geo.geography_reference using gist (geom);
create index on geo.geography_reference (geo_level, vintage);
create index on geo.geography_reference using gin (name gin_trgm_ops);
create index on geo.geography_reference (siren) where siren is not null;

create table geo.geography_history (
    event_id         bigint generated always as identity primary key,
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
    -- clé de répartition pour les scissions (part de population par défaut)
    population_share numeric(7,6) check (population_share > 0 and population_share <= 1),
    source           text,
    check (to_vintage > from_vintage or event_type = 'changement_nom')
);
create index on geo.geography_history (from_level, from_code, from_vintage);
create index on geo.geography_history (to_level, to_code, to_vintage);

-- Squelette de la table de passage entre millésimes. Complété et testé sur les
-- mouvements COG réels au ticket T-11 ; toute comparaison inter-millésimes DOIT
-- passer par cette fonction (docs/00, principe 6). Ne sommer qu'avec
-- core.indicators.additive = true.
create or replace function geo.passage(
    p_level  text,
    p_code   text,
    p_vintage integer,
    p_target  integer
) returns table (geo_code text, population_share numeric)
language sql stable as $$
with recursive walk(code, vintage, share) as (
    select p_code, p_vintage::smallint, 1::numeric
    union all
    select h.to_code, h.to_vintage, w.share * coalesce(h.population_share, 1)
    from walk w
    join geo.geography_history h
      on h.from_level = p_level
     and h.from_code  = w.code
     and h.from_vintage >= w.vintage
     and h.to_vintage   >  w.vintage
     and h.to_vintage   <= p_target
)
select w.code, sum(w.share)
from walk w
where not exists (
    select 1 from geo.geography_history h2
    where h2.from_level = p_level
      and h2.from_code  = w.code
      and h2.from_vintage >= w.vintage
      and h2.to_vintage   >  w.vintage
      and h2.to_vintage   <= p_target
)
group by w.code
$$;
