-- Extensions requises (Supabase : à activer aussi via le dashboard, cf. docs/SETUP.md)
create extension if not exists postgis;
create extension if not exists pg_trgm;

create schema if not exists meta;
create schema if not exists geo;
create schema if not exists core;
create schema if not exists fin;
create schema if not exists pub;
