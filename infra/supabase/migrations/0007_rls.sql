-- RLS et rôles (docs/02 §E, docs/03 §7).
-- Sur Supabase, anon/authenticated/service_role existent déjà ; on les crée
-- si absents pour que les migrations se rejouent à l'identique en CI (PostGIS nu).
do $$
begin
    if not exists (select from pg_roles where rolname = 'anon') then
        create role anon nologin;
    end if;
    if not exists (select from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin;
    end if;
    if not exists (select from pg_roles where rolname = 'service_role') then
        create role service_role nologin bypassrls;
    end if;
end $$;

-- RLS activée partout ; refus par défaut (aucune policy = aucun accès)
do $$
declare t record;
begin
    for t in
        select schemaname, tablename from pg_tables
        where schemaname in ('meta','geo','core','fin')
    loop
        execute format('alter table %I.%I enable row level security', t.schemaname, t.tablename);
    end loop;
end $$;

-- Métadonnées publiques : lecture anonyme (le lineage interne reste fermé)
create policy public_read on meta.source_registry    for select using (true);
create policy public_read on meta.dataset_registry   for select using (priority <> 'EXCLU');
create policy public_read on meta.change_log         for select using (true);
create policy public_read on meta.methodology_notes  for select using (true);
create policy public_read on meta.citations          for select using (true);
create policy public_read on geo.geography_reference for select using (true);
create policy public_read on geo.geography_history   for select using (true);
create policy public_read on core.indicators             for select using (published);
create policy public_read on core.indicator_definitions  for select using (true);

grant usage on schema meta, geo, core, pub to anon, authenticated;
grant select on meta.source_registry, meta.dataset_registry, meta.change_log,
                meta.methodology_notes, meta.citations,
                geo.geography_reference, geo.geography_history,
                core.indicators, core.indicator_definitions
    to anon, authenticated;
grant select on all tables in schema pub to anon, authenticated;

-- Écriture : uniquement les pipelines (service_role)
grant usage on schema meta, geo, core, fin to service_role;
grant all on all tables in schema meta, geo, core, fin to service_role;
grant usage, select on all sequences in schema meta, geo, core, fin to service_role;
