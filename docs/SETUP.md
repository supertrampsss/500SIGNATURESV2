# SETUP — actions à réaliser par le propriétaire du dépôt

Ce guide couvre les tickets **T-02** (Cloudflare) et **T-03** (Supabase) du
backlog : la création des comptes et des secrets ne peut pas être faite par
l'agent. Tout le reste (migrations, CI) est déjà dans le dépôt.

Décision D6 (31/07/2026) : **plans gratuits** tant qu'ils suffisent. Limites
assumées et compensations plus bas.

## 1. Supabase (T-03)

> **✅ Fait le 31/07/2026** via l'API de management (token personnel, révoqué
> ensuite) sur le projet actif `ictrljmcfdukqswukbtv` (région `eu-west-1`) :
> PostGIS 3.3 + pg_trgm activés, 7 migrations appliquées, seed chargé
> (16 sources, 30 jeux P0), tests de contraintes passés.
> **Reste à faire par le propriétaire** : créer le secret GitHub
> `SUPABASE_DB_URL` (§3) — le mot de passe de la base n'est connu que de lui.

Procédure d'origine (conservée pour re-créer un environnement de zéro) :

1. Créer un projet Supabase (plan Free).
2. Dashboard → Database → Extensions : activer **postgis** (et `pg_trgm`).
3. Récupérer la chaîne de connexion (bouton Connect → URI, utilisateur `postgres`).
4. Appliquer les migrations :

   ```bash
   export SUPABASE_DB_URL='postgresql://postgres:...@...supabase.com:5432/postgres'
   for f in infra/supabase/migrations/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f infra/supabase/seed/load_seed.sql
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f infra/supabase/tests/checks.sql
   ```

5. Le projet **plateforme-prod** sera créé à T-26 seulement.

Limites du plan Free assumées (D6) : base 500 Mo, **pause après ~7 jours
d'inactivité** (un cron de liveness la réveillera), pas de PITR — compensé par
un dump hebdomadaire versionné vers R2 (prévu au ticket T-23) et par le fait que
toute la base est reconstructible depuis les snapshots R2.

## 2. Cloudflare (T-02)

1. Créer un compte sur https://dash.cloudflare.com (plan Free).
2. R2 : créer les buckets **plateforme-raw** et **plateforme-published**
   (R2 demande l'ajout d'une carte bancaire même en usage gratuit ≤ 10 Go —
   si c'est bloquant maintenant, le dire : les snapshots iront temporairement
   dans le dépôt via Git LFS ou attendront, rien d'autre n'en dépend au socle).
3. Créer un API token : My Profile → API Tokens → template « Edit Cloudflare
   Workers » + permission R2 Read/Write, portée limitée au compte.
4. Pages/Workers seront branchés à T-17/T-19 (`infra/cloudflare/wrangler.toml.example`).

## 3. Secrets GitHub (Settings → Secrets and variables → Actions)

| Secret | Contenu | Utilisé par |
|---|---|---|
| `SUPABASE_DB_URL` | chaîne de connexion Postgres du projet staging | migrations, ingestions |
| `CLOUDFLARE_API_TOKEN` | token créé en §2.3 | déploiements, écriture R2 |
| `CLOUDFLARE_ACCOUNT_ID` | Dashboard → vue d'ensemble du compte | idem |
| `INSEE_API_KEY` | clé créée sur https://portail-api.insee.fr (gratuite, pour Sirene) | connecteur T-08 |

Aucun secret n'est nécessaire pour la CI actuelle (elle utilise un PostGIS
éphémère) — le dépôt fonctionne donc dès maintenant sans ces comptes ; ils
débloquent les tickets d'ingestion réelle (T-06+).

## 4. Vérifier

- CI verte sur la PR en cours (jobs `python` et `database`).
- Après §1 : `psql "$SUPABASE_DB_URL" -c "select count(*) from meta.dataset_registry where priority='P0'"` ⇒ ≥ 25.
