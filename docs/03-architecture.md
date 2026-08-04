# 03 — Livrable 3 : architecture technique

*Règle directrice : chaque composant est justifié par le volume, la fréquence, le
coût, la sécurité ou l'usage. Ce qui n'est pas justifié n'est pas construit.*

## Vue d'ensemble

```
        ┌─────────────────────────── SOURCES ───────────────────────────┐
        │  API A/B (INSEE, ODS, Eurostat…)   Fichiers C/D (CSV, Parquet)│
        └───────────────┬───────────────────────────────┬───────────────┘
                        │ connecteurs TS (Workers+Queues)│ ingestion Python (GitHub Actions)
                        ▼                                ▼
                ┌──────────────────────────────────────────────┐
                │  R2 « raw » — snapshots immuables horodatés   │
                │  raw/{source}/{dataset}/{ts}/…  + SHA-256     │
                └───────────────┬──────────────────────────────┘
                                ▼  transformations versionnées (Python, tests)
                ┌──────────────────────────────────────────────┐
                │  Entrepôt DuckDB (fichier versionné sur R2)   │
                │  meta.* (lineage)  geo.*  core.*  fin.*  pub.*│
                └───────┬──────────────────────────┬───────────┘
                        ▼ exports contrôlés         ▼ (phase 3)
        ┌──────────────────────────────┐   ┌─────────────────────────┐
        │ R2/Pages « published » :      │   │ API publique versionnée │
        │ JSON fiches, séries, PMTiles  │   │ Workers + OpenAPI       │
        └───────────────┬──────────────┘   └───────────┬─────────────┘
                        ▼                              ▼
              Front Astro/MapLibre (Cloudflare Pages, cache CDN)
```

Justifications de stack :
- **Entrepôt DuckDB** (depuis D6quinquies, 04/08/2026 ; Supabase auparavant) :
  un fichier dans le bucket R2 qui sert déjà les données publiées, rapatrié au
  début de chaque job et renvoyé à la fin. Le site ne l'interroge jamais — il lit
  du JSON — donc rien n'exige un serveur allumé. Nécessaire pour (a) l'historisation
  territoriale relationnelle, (b) le lineage requêtable, (c) le comparateur
  (groupes de comparaison = requêtes), (d) préparer API et moteur de questions.
- **R2** : snapshots immuables (reproductibilité) + hébergement PMTiles ; zéro
  frais de sortie.
- **Workers/Queues/Cron** : connecteurs API légers et planification ; les gros
  volumes (Sirene stock, DVF, balances) passent par **GitHub Actions + Python**
  (pas de limite CPU/mémoire des Workers, logs CI natifs, exécution versionnée).
- **KV/D1** : **non retenus** au MVP — aucun besoin identifié que R2 + l'entrepôt ne
  couvrent (règle : pas de composant sans justification).
- **Authentification** : non retenue au MVP (aucun compte utilisateur). Introduite en
  phase 3 uniquement pour l'espace d'administration/validation humaine.

## 1. Collecte

- **Connecteurs déclaratifs** : chaque `dataset_registry` porte son
  `ingestion_mode` (`ods_export`, `sdmx_pull`, `melodi_pull`, `file_download`,
  `datagouv_resource`). Un connecteur générique par mode — le connecteur ODS
  couvre à lui seul ~40 % du registre (data.economie, OFGL, URSSAF, Ameli, DREES,
  éducation, SNCF, ODRE, Webstat).
- **Planification** : Cloudflare Cron Triggers → Queue `ingestion` → Worker
  consommateur (API légères) ; GitHub Actions `schedule` pour les jobs Python
  lourds. Le calendrier suit `update_frequency` du registre (quotidien pour la
  liveness, mensuel/trimestriel/annuel pour les données).
- **Snapshots immuables** : toute réponse/fichier est écrit dans R2 sous
  `raw/{source}/{dataset}/{iso_ts}/` avec SHA-256 en métadonnée et ligne
  `raw_assets`. Interdiction d'écrire deux fois la même clé (immutabilité).
- **Détection de changement** : HEAD `Last-Modified`/`ETag` quand disponible,
  sinon hash du contenu ; hash inchangé ⇒ run court-circuité (`rows_written = 0`),
  fraîcheur mise à jour quand même.
- **Retries & rate limits** : backoff exponentiel avec jitter (4 tentatives max),
  budget de requêtes par source (INSEE 30/min, BAN 50/s, ODS ~10 k/j) tenu dans le
  consommateur de queue ; dépassement ⇒ report au run suivant, jamais de
  contournement multi-IP.
- **Archives** : les millésimes historiques (backfill) passent par le même chemin
  que le courant — un `trigger = 'backfill'` distingue les runs.

## 2. Transformation

- **Python + tests** (pandas/polars + DuckDB pour le staging local des gros
  fichiers), exécuté en CI. Chaque transformation est une fonction pure
  fichier(s) raw → tables cibles, enregistrée dans `meta.transformations` avec
  commit SHA et **approbation humaine** avant première publication.
- **Étapes standard** : validation de schéma (colonnes, types — schémas
  schema.data.gouv.fr quand ils existent) → normalisation des unités (€, k€, M€ →
  `numeric` + `unit`) → nettoyage des codes géo (préfixes Melodi `2025-COM-…`,
  arrondissements, outre-mer) → jointure `geography_reference` du bon millésime →
  mapping de nomenclatures (mission/programme, COFOG, NAF, M57) via tables de
  correspondance versionnées → calcul d'agrégats dérivés (par habitant, taux —
  uniquement via `denominator_indicator_id`) → écriture transactionnelle.
- **Contrôles de cohérence** (exemples de `data_quality_checks` bloquants) :
  totaux recalculés = totaux publiés par le producteur (±0,5 %) ; codes géo tous
  résolus ; pas de variation > seuil paramétré sans flag `revision` ; unicité des
  clés ; part de valeurs secrétisées cohérente avec le millésime précédent.
- **Versionnement** : une correction de transformation ⇒ nouvelle version semver,
  re-run backfill, entrée `change_log` publique si les chiffres publiés bougent.

## 3. Stockage

- **R2 `raw`** : archives immuables (rétention permanente).
- **Entrepôt** : schémas `meta/geo/core/fin` (doc 02). Vues matérialisées
  `pub.*` rafraîchies en fin de run (jamais pendant : `REFRESH … CONCURRENTLY`).
- **Exports publiés** : R2 `published/` + Pages — JSON de fiches territoire,
  séries temporelles par indicateur, index de recherche, et **PMTiles** générés
  par `tippecanoe` (géométries simplifiées par niveau de zoom). Chaque export
  porte un numéro de version et un manifeste (datasets + runs sources) : les
  fichiers publiés *sont* un jeu de données réutilisable.
- **Cache Cloudflare** : `published/` derrière le CDN, `Cache-Control` long +
  invalidation par purge ciblée au déploiement d'un export.

## 4. Exposition

**MVP** : pas d'API dynamique — le front lit exclusivement les exports statiques
(latence minimale, coût nul, aucune surface d'attaque SQL).

**Phase 3 — API publique versionnée** :
- Worker « gateway » (`/v1/…`) devant les fichiers publiés (les vues `pub.*`
  uniquement) — jamais d'accès direct du client à la base.
- Endpoints : `/v1/indicators`, `/v1/observations` (filtres indicateur/geo/période,
  pagination par curseur), `/v1/territories/{level}/{code}` (fiche),
  `/v1/compare` (2–5 territoires, refus si non comparable, avec motif),
  `/v1/map/{indicator}/{level}/{period}` (GeoJSON/vector), `/v1/meta/...`
  (définitions, méthodo, fraîcheur — la traçabilité est une ressource d'API à
  part entière).
- **OpenAPI 3.1** générée et publiée ; versionnement d'URL (`/v1`), politique de
  dépréciation documentée (12 mois).
- Protection : cache CDN par clé de requête normalisée, rate limiting Cloudflare
  (par IP + par clé optionnelle gratuite), quotas progressifs, limites de taille
  de réponse, pas d'endpoint de requête libre.

## 5. Orchestration IA

- **FABLE5 (sessions Claude planifiées)** : surveille le dashboard de fraîcheur,
  lit les échecs de runs, relance, ouvre des issues avec diagnostic, prépare des
  PRs de correction de connecteurs. Ne touche jamais aux données publiées.
- **Opus 5** : tâches ponctuelles complexes — rétro-ingénierie d'un nouveau
  millésime au format changeant, écriture de tables de correspondance de
  nomenclatures, investigation d'anomalies.
- **Garde-fous non négociables** : (1) aucun chiffre publié sans passer par une
  transformation approuvée + checks déterministes verts ; (2) tout nouveau
  connecteur ou changement de méthodologie = PR revue par un humain ; (3) les
  agents proposent, la CI et l'humain disposent ; (4) les prompts/outils des
  agents sont versionnés dans le repo.

## 6. Observabilité

- **Logs structurés** (JSON) : Workers → Logpush ; jobs Python → artefacts CI +
  résumé en base (`ingestion_runs.logs_url`).
- **Alertes** : échec de run bloquant, liveness d'une source P0 en échec 2 jours,
  variation anormale détectée, dérive de quota. Canal : issues GitHub + e-mail.
- **Dashboard de fraîcheur** : `pub.mv_freshness` exposée publiquement — chaque
  jeu affiche dernière mise à jour, retard vs fréquence attendue, statut du
  dernier run. La transparence opérationnelle fait partie du produit.
  *En place* : exporté dans `fraicheur.json` et affiché sur le site sous
  « État des données », avec ce que les contrôles du dernier chargement ont
  relevé — nom du contrôle en français, portée du défaut, et distinction entre
  un signalement (une partie du fichier source n'a pas été publiée) et un
  contrôle bloquant (le run a échoué, rien n'a été publié). Un jeu dont la
  publication est antérieure à ce champ affiche « non renseigné » et non
  « aucune anomalie » : une lacune n'est pas une garantie.
- **Métriques de couverture** : % de communes couvertes par indicateur/millésime,
  % de valeurs secrétisées — affichées sur les fiches méthodo.

## 7. Sécurité

- **Secrets** : GitHub Actions Secrets (jobs CI), Cloudflare secrets (Workers),
  les secrets GitHub — jamais en clair dans le repo ; clé INSEE et future clé France
  Travail uniquement côté serveur.
- **Contrôle d'accès** : sans objet depuis D6quinquies — l'entrepôt n'est pas un
  service exposé, c'est un fichier privé du bucket. Auparavant : RLS, `anon` ne voyait que `pub.*` et les
  métadonnées publiques ; écriture réservée au rôle de service des pipelines.
- **Environnements** : `dev` (entrepôt local) → `staging` (bucket dédié,
  données réelles, exports non indexés) → `prod`. Promotion par migration SQL
  versionnée (jamais de DDL manuel en prod).
- **RBAC & audit** : les droits sont ceux du bucket ;
  `meta.*` fait office d'audit trail des données ; journaux GitHub Actions pour les
  accès admin.
- **Sauvegardes** : le versionnement du bucket sur le fichier d'entrepôt lui-même ; les
  snapshots raw permettent de reconstruire la base de zéro (testé une fois par
  trimestre — restauration = test d'acceptation).
- **RGPD** : aucune donnée personnelle d'utilisateur (pas de compte, pas de
  tracking nominatif) ; données de personnes physiques côté sources limitées aux
  cas publics par obligation légale et respect du statut de diffusion Sirene ;
  registre de traitement tenu dans le repo ; procédure de retrait documentée.
