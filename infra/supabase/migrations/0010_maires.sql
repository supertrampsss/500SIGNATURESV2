-- 0010 — Maires en exercice (Répertoire National des Élus, Ministère de l'intérieur).
--
-- « On a les communes mais on n'a pas les maires » : savoir qui dirige sa
-- commune fait partie de la lecture élémentaire des finances locales.
--
-- **Ce que cette table ne contient pas, et pourquoi.** Le fichier source porte
-- aussi la date de naissance, le sexe et la catégorie socio-professionnelle de
-- chaque élu. Rien de tout cela n'est chargé : la règle du projet interdit de
-- stocker des données personnelles, et l'identité d'un maire n'est publique
-- qu'au titre de la fonction qu'il exerce. Nom, prénom, date de prise de
-- fonction — c'est ce qu'il faut pour répondre à la question, et rien de plus.
--
-- Migration purement additive : `if not exists` partout, rejouable sans effet.

create table if not exists geo.commune_officials (
    geo_code    text     not null,
    geo_vintage smallint not null,
    -- Seuls les maires sont chargés. Les adjoints et conseillers demanderaient
    -- une autre migration : mieux vaut une contrainte qui refuse que des
    -- colonnes qui accueillent ce qu'on n'a pas décidé de publier.
    role        text     not null default 'maire' check (role in ('maire')),
    surname     text     not null,
    given_name  text     not null,
    since       date,
    run_id      uuid references meta.ingestion_runs,
    primary key (geo_code, geo_vintage, role)
);

create index if not exists commune_officials_geo_idx
    on geo.commune_officials (geo_code);

alter table geo.commune_officials enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
         where schemaname = 'geo' and tablename = 'commune_officials'
           and policyname = 'public_read'
    ) then
        create policy public_read on geo.commune_officials for select using (true);
    end if;
end $$;

grant select on geo.commune_officials to anon, authenticated;
