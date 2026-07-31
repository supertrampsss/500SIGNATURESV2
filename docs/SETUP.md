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

> **✅ Fait le 31/07/2026** :
> - API token scopé vérifié (Account : R2 Edit, Pages Edit, Workers Edit,
>   Settings Read ; Zone `500signatures.fr` : DNS Edit) — ce token EST la
>   valeur du secret `CLOUDFLARE_API_TOKEN` ; son id (non secret) est
>   `f142f16ee69b9e33f8b2b4acd83d7f6a` (= `CLOUDFLARE_TOKEN_ID`).
> - Account ID : `8f1b454e7961068fe7a3750341fe7aaf` (= `CLOUDFLARE_ACCOUNT_ID`).
> - R2 activé par le propriétaire ; buckets **plateforme-raw** et
>   **plateforme-published** créés (hint `weur`).
> - Store R2 du pipeline branché et **testé en réel** (écriture, relecture,
>   immutabilité, nettoyage) via l'API S3 de R2 — credentials dérivés du
>   token : `access_key_id` = id du token, `secret_access_key` = SHA-256 du
>   token. Un seul secret alimente donc management ET stockage.
> - Zone `500signatures.fr` active ; le DNS n'est pas modifié avant le
>   déploiement du site (T-17/T-19).

Procédure d'origine (si re-création de zéro) : compte Free, activer R2, créer
les deux buckets, créer le token custom ci-dessus, brancher Pages/Workers à
T-17/T-19 (`infra/cloudflare/wrangler.toml.example`).

## 3. Secrets GitHub (Settings → Secrets and variables → Actions)

| Secret | Contenu | Utilisé par |
|---|---|---|
| `SUPABASE_DB_URL` | chaîne de connexion Postgres du projet staging | migrations, ingestions |
| `CLOUDFLARE_API_TOKEN` | token créé en §2.3 | déploiements, écriture R2 |
| `CLOUDFLARE_ACCOUNT_ID` | Dashboard → vue d'ensemble du compte | idem |
| `INSEE_API_KEY` | clé créée sur https://portail-api.insee.fr (gratuite, pour Sirene) | connecteur T-08 |

Aucun secret n'est nécessaire pour la CI de validation (PostGIS éphémère).
Les trois secrets ci-dessus alimentent le workflow **Ingestion**
(`.github/workflows/ingest.yml`) : registre Supabase → connecteur → snapshot
R2 → lineage Supabase. `CLOUDFLARE_TOKEN_ID` n'est pas un secret (id public du
token) et est fixé dans le workflow.

Deux façons de lancer un run :
- **Humain** : Actions → Ingestion → « Run workflow » → saisir un `dataset_id`
  du registre (et des filtres JSON optionnels).
- **Agent** : committer `.github/ingest-request.json`
  (`{"dataset_id": "...", "params": {...}}`) — l'app GitHub de l'agent n'a pas
  la permission `workflow_dispatch`, ce fichier en tient lieu. Modifier le
  champ libre `request` suffit à relancer le même jeu.

> **✅ Premier run réel le 31/07/2026** — `bdm-dette-trim` (dette trimestrielle
> des administrations publiques, INSEE BDM) : snapshot de 240 289 octets archivé
> sous `raw/insee-bdm/bdm-dette-trim/2026-07-31T110611Z/data.xml` dans
> `plateforme-raw`, run tracé `success` dans `meta.ingestion_runs` avec le SHA
> de commit du connecteur et l'empreinte SHA-256 du contenu.

Note réseau : l'environnement de développement distant ne laisse sortir que du
HTTPS — le protocole Postgres direct (port 5432) n'y passe pas. Les opérations
SQL vers Supabase s'y font via l'API de management ; les ingestions réelles
s'exécutent dans GitHub Actions, qui a un réseau complet.

## 4. Vérifier

- CI verte sur la PR en cours (jobs `python` et `database`).
- Après §1 : `psql "$SUPABASE_DB_URL" -c "select count(*) from meta.dataset_registry where priority='P0'"` ⇒ ≥ 25.
