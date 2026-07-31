# 02 — Livrable 2 : modèle canonique de données (Supabase PostgreSQL + PostGIS)

*Schéma cible. Les migrations réelles seront écrites au ticket T-04 du backlog ;
ce document est la spécification de référence.*

## Principes de modélisation

1. **Un spine générique + des tables métier.** Les indicateurs statistiques
   (population, pauvreté, chômage, conso d'énergie…) vivent dans un modèle
   générique `indicators`/`observations` : une seule mécanique de lineage, de
   qualité et d'API pour des centaines d'indicateurs. Les objets à structure
   forte (lignes budgétaires, marchés, subventions, dette) ont des **tables
   métier dédiées** — les écraser dans un modèle générique ferait perdre les
   contraintes qui garantissent leur cohérence.
2. **Lineage obligatoire.** Toute ligne analytique référence `ingestion_run_id`
   → `raw_asset` (snapshot R2, SHA-256) → `dataset_registry` → `source_registry`.
   On peut toujours répondre à « d'où vient ce chiffre ? » par une jointure.
3. **Historisation territoriale par millésime.** Les géographies sont clés par
   `(geo_level, geo_code, vintage)` ; les comparaisons temporelles passent par
   la table de passage `geography_history`.
4. **Jamais de destruction silencieuse.** Corrections tracées dans `change_log` ;
   les runs remplacés restent en base (statut `superseded`) et les snapshots R2
   sont immuables.
5. **Schémas Postgres** : `meta` (registres et lineage), `geo`, `core`
   (indicateurs/observations), `fin` (tables métier finances), `pub` (vues et
   tables matérialisées exposées, seules accessibles au rôle public via RLS).

Conventions : `id` = `bigint generated always as identity` sauf mention ; horodatages
`timestamptz` ; montants `numeric(18,2)` + `currency char(3) default 'EUR'` ;
`jsonb` réservé aux métadonnées, jamais aux valeurs analytiques.

---

## A. Registres et lineage (schéma `meta`)

### meta.source_registry
- **Objectif** : un producteur/portail (INSEE, OFGL, Eurostat…) et ses conditions d'accès.
- **PK** `source_id` (slug texte, ex. `insee-melodi`).
- **Colonnes** : `name`, `producer`, `access_category` (`A|B|C|D|E|F` — check),
  `base_url`, `doc_url`, `auth_mode`, `license`, `license_url`, `rate_limit`,
  `country_scope` (`FR|EU|INT`), `reliability_notes`, `active bool`, `created_at`.
- **Contraintes** : `access_category` et `license` non nuls — on n'ingère pas une
  source sans licence identifiée.
- **Sensibilité** : publique. **Rétention** : permanente.

### meta.dataset_registry
- **Objectif** : un jeu de données concret d'une source (ex. `ofgl-base-communes-consolidee`).
- **PK** `dataset_id` (slug). **FK** `source_id`.
- **Colonnes** : `external_id` (id chez le producteur), `title`, `landing_url`,
  `endpoint_url`, `format`, `update_frequency`, `expected_freshness_days int`
  (sert au dashboard de fraîcheur), `geo_granularity`, `time_granularity`,
  `history_start`, `join_keys text[]`, `volume_estimate`, `priority`
  (`P0|P1|P2|P3|EXCLU`), `ingestion_mode`, `target_tables text[]`, `limitations`,
  `personal_data bool default false`, `statistical_secrecy bool default false`.
- **Index** : `(source_id)`, `(priority)`.
- Miroir opérationnel du registre du doc 01 — le doc est généré depuis cette table
  à terme (une seule vérité).

### meta.ingestion_runs
- **Objectif** : une exécution de connecteur.
- **PK** `run_id uuid default gen_random_uuid()`. **FK** `dataset_id`.
- **Colonnes** : `started_at`, `finished_at`, `status`
  (`running|success|failed|superseded` — check), `connector_version` (tag git),
  `trigger` (`cron|manual|backfill`), `rows_read`, `rows_written`,
  `error_details jsonb`, `logs_url`.
- **Index** : `(dataset_id, started_at desc)`.
- **Historisation** : jamais supprimé ; un re-run marque le précédent `superseded`.
- **Rétention** : permanente (c'est l'audit trail).

### meta.raw_assets
- **Objectif** : snapshot immuable d'un fichier/réponse source dans R2.
- **PK** `asset_id`. **FK** `run_id`, `dataset_id`.
- **Colonnes** : `r2_key` (ex. `raw/ofgl/ofgl-base-communes-consolidee/2026-07-31T02:00Z/data.parquet`),
  `fetched_at`, `source_url`, `content_sha256 char(64)`, `size_bytes`,
  `content_type`, `producer_last_modified`, `http_status`.
- **Contraintes** : `unique(dataset_id, content_sha256)` — la détection de
  changement est un simple conflit d'insertion : hash identique ⇒ pas de retraitement.
- **Rétention** : permanente (les producteurs écrasent leurs fichiers ; l'archive
  datée est ce qui rend les chiffres reproductibles).

### meta.transformations
- **Objectif** : versionner chaque traitement raw → analytique.
- **PK** `transformation_id`. **FK** `dataset_id`.
- **Colonnes** : `name`, `code_ref` (chemin + commit SHA), `input_schema jsonb`,
  `output_tables text[]`, `methodology_note_id FK`, `version semver`, `valid_from`,
  `valid_to` (null = courante), `approved_by`, `approved_at`.
- **Contrainte produit** : un run ne peut écrire en `core`/`fin` que via une
  transformation approuvée (`approved_at not null`) — c'est la traduction SQL de
  la « validation humaine obligatoire ».

### meta.data_quality_checks
- **Objectif** : résultat de chaque contrôle déterministe.
- **PK** `check_id`. **FK** `run_id`, `dataset_id`.
- **Colonnes** : `check_name` (ex. `row_count_delta`, `sum_matches_published_total`,
  `geo_codes_valid`, `unit_consistency`, `variation_anomaly`), `severity`
  (`blocker|warning|info`), `passed bool`, `observed jsonb`, `expected jsonb`, `ran_at`.
- **Règle** : un `blocker` non passé ⇒ le run ne publie pas (statut `failed`),
  alerte émise. **Index** : `(dataset_id, ran_at desc)`, partiel sur `passed = false`.

### meta.change_log
- **Objectif** : journal public des corrections, ruptures, changements de méthode.
- **PK** `change_id`. **FK** optionnelles vers `dataset_id`, `indicator_id`.
- **Colonnes** : `change_type` (`correction|methodology|break|revision|deprecation`),
  `description_public` (affichable), `description_technical`, `effective_date`,
  `announced_at`, `author`.
- Alimente la page publique « historique des corrections » (charte, doc 06).

### meta.citations & meta.methodology_notes
- `methodology_notes` : **PK** `note_id` ; `scope` (`dataset|indicator|domain`),
  `scope_ref`, `title`, `body_md`, `public_definition` (≤ 50 mots, contrainte
  `char_length`), `technical_definition`, `formula`, `caveats_md`, `version`,
  `valid_from/to`. Une note par indicateur est **obligatoire avant exposition**
  (contrainte applicative + check de publication).
- `citations` : **PK** `citation_id` ; `quoted_source` (ex. « Cour des comptes,
  RPA 2025, p. 143 »), `url`, `quote_text`, `context`, `retrieved_at`. Toute
  explication éditoriale de niveau N3 pointe vers une citation.

---

## B. Référentiel géographique (schéma `geo`)

### geo.geography_reference
- **Objectif** : toute entité territoriale, tous niveaux, tous millésimes.
- **PK** composite `(geo_level, geo_code, vintage)`.
  `geo_level` ∈ `commune|arrondissement_municipal|epci|departement|region|
  collectivite_om|zone_emploi|aav|uu|bassin_vie|iris|nuts1|nuts2|nuts3|pays`.
- **Colonnes** : `name`, `vintage smallint` (millésime COG ou version NUTS),
  `parent_level`, `parent_code` (hiérarchie au sein du millésime), `siren`
  (EPCI/collectivités), `population int` (population légale du millésime),
  `area_ha`, `density_grid smallint` (grille de densité INSEE), `flags jsonb`
  (littoral, montagne, outre-mer, touristique — pour les groupes de comparaison),
  `geom geometry(MultiPolygon, 4326)`, `geom_simplified geometry` (génération tuiles),
  `centroid geometry(Point, 4326)`.
- **Index** : GiST sur `geom` ; `(geo_level, vintage)` ; trigram sur `name`
  (recherche) ; `(siren)` partiel.
- **Contraintes** : `ST_IsValid(geom)` ; parent existant au même millésime (FK
  composite différée).
- **Volumétrie** : ~35 000 communes × ~10 millésimes + niveaux supérieurs ≈ 500 k
  lignes, géométries incluses — pas de partitionnement nécessaire.

### geo.geography_history
- **Objectif** : table de passage entre millésimes (fusions, scissions,
  changements de code/nom, révisions NUTS).
- **PK** `event_id`. 
- **Colonnes** : `event_type` (`fusion|scission|changement_code|changement_nom|
  transfert|creation|suppression|revision_nuts`), `event_date`,
  `from_level, from_code, from_vintage`, `to_level, to_code, to_vintage`,
  `population_share numeric(7,6)` (clé de répartition pour les scissions —
  défaut : part de population ; la méthode est notée), `source` (COG mouvement /
  correspondance NUTS).
- **Index** : `(from_code, from_vintage)`, `(to_code, to_vintage)`.
- **Usage type** — ramener une série communale 2016 sur la géographie 2026 :

```sql
select g26.to_code as geo_code_2026,
       sum(o.value * coalesce(g26.population_share, 1)) as value
from core.observations o
join lateral geo.passage(o.geo_code, o.geo_vintage, 2026) g26 on true
where o.indicator_id = 'ofgl_depenses_fonctionnement' and o.period = '2016'
group by 1;
```

(`geo.passage()` : fonction SQL récursive encapsulant la chaîne d'événements ;
sommes uniquement sur des indicateurs additifs — cf. `indicators.additive`.)

---

## C. Spine analytique (schéma `core`)

### core.indicator_definitions
- **Objectif** : la fiche « 10 points » (doc 06) sous forme de données.
- **PK** `definition_id`. **FK** `methodology_note_id`.
- **Colonnes** : `public_definition` (≤ 50 mots), `technical_definition`,
  `formula`, `unit_notes`, `confidence_level` (`observed|computed|estimated`),
  `download_url`, `badges text[]` (vocabulaire contrôlé du doc 06).

### core.indicators
- **Objectif** : un indicateur publiable.
- **PK** `indicator_id` (slug, ex. `filosofi_taux_pauvrete`).
- **FK** `dataset_id`, `definition_id`.
- **Colonnes** : `theme` (vocabulaire du sélecteur carte), `label_fr`, `unit`
  (`EUR|EUR_per_capita|percent|ratio|count|EUR_M|…`), `denominator_indicator_id`
  (auto-FK — tout ratio déclare son dénominateur), `additive bool` (sommable
  territorialement : vrai pour des dépenses, faux pour médianes/taux),
  `price_basis` (`current|constant|SPA`), `seasonal_adjustment` (`nsa|sa|cvs-cjo`),
  `accounting_frame` (`budgetaire|generale|nationale|null`), `geo_levels text[]`,
  `time_granularity`, `first_period`, `last_period`, `published bool default false`.
- **Règle** : `published = true` exige définition, note méthodo, unité,
  dénominateur si ratio — vérifié par un check de publication déterministe.

### core.observations
- **Objectif** : toutes les valeurs numériques du spine.
- **PK** `(indicator_id, geo_level, geo_code, geo_vintage, period, variant)`.
  `variant` encode la déclinaison courante (`total`, `per_capita`, sexe, tranche…)
  quand elle est petite ; les croisements riches vont dans `observation_dimensions`.
- **FK** : `indicator_id` ; `(geo_level, geo_code, geo_vintage)` →
  `geography_reference` ; `run_id` → `ingestion_runs`.
- **Colonnes** : `period text` (ISO : `2024`, `2024-Q1`, `2024-05`), `value numeric`,
  `value_status` (`normal|provisional|revised|confidential|not_available` — le
  secret statistique est **une ligne à part entière**, pas une absence),
  `quality_flags text[]` (`break_in_series`, `low_reliability`, …), `run_id`.
- **Partitionnement** : par hash de `indicator_id` (16 partitions) — les requêtes
  sont toujours filtrées par indicateur ; volumétrie attendue 10⁷–10⁸ lignes.
- **Index** : PK ; `(geo_level, geo_code, period)` pour les fiches territoire.
- **Historisation** : `observations` = état courant ; les valeurs remplacées
  partent dans `core.observations_revisions` (même clé + `superseded_at`,
  `old_value`, `run_id`) — l'utilisateur peut voir « ce chiffre a été révisé ».
- **Exemple** (fiche commune) :

```sql
select i.label_fr, o.period, o.value, i.unit, d.public_definition,
       ds.title as dataset, ra.fetched_at
from core.observations o
join core.indicators i using (indicator_id)
join core.indicator_definitions d on d.definition_id = i.definition_id
join meta.ingestion_runs r on r.run_id = o.run_id
join meta.raw_assets ra on ra.run_id = r.run_id
join meta.dataset_registry ds on ds.dataset_id = r.dataset_id
where o.geo_level = 'commune' and o.geo_code = '33318' and o.geo_vintage = 2026
  and o.period = '2023';
```

### core.observation_dimensions
- **Objectif** : croisements riches (sexe × âge × PCS…) sans exploser `variant`.
- **PK** `(observation_ref bigint, dim_name, dim_value)` où `observation_ref`
  référence une ligne d'une table jumelle `observations_dimensional` (même
  structure qu'`observations`, PK identity, réservée aux jeux multidimensionnels).
- Vocabulaires de dimensions contrôlés (`dim_registry` : nom, codelist, source
  de la codelist — SDMX quand elle existe).

---

## D. Tables métier finances publiques (schéma `fin`)

### fin.public_budgets
- **Objectif** : un document budgétaire (en-tête) : LFI 2026, LFR, budget primitif
  d'une commune, LFSS…
- **PK** `budget_id`. **FK** `(geo_level, geo_code, geo_vintage)` (national =
  `pays/FR`), `dataset_id`, `run_id`.
- **Colonnes** : `budget_type` (`LFI|LFR|PLF|PLRG|BP|CA|CFU|LFSS|BUDGET_UE` —
  check), `entity_kind` (`etat|commune|epci|departement|region|asso|odac|ue`),
  `entity_siren`, `fiscal_year smallint`, `vote_date`, `accounting_frame`
  (`budgetaire|generale|nationale`), `stage` (`vote|rectifie|execute`).
- **Contrainte** : `unique(entity_kind, entity_siren, fiscal_year, budget_type, stage)`.

### fin.public_budget_lines
- **Objectif** : lignes de crédits/recettes de tout budget.
- **PK** `line_id`. **FK** `budget_id`.
- **Colonnes** : `side` (`depense|recette`), `mission`, `programme`, `action`,
  `sous_action`, `titre` (nature), `cofog varchar(6)`, `fonction_m57`,
  `chapitre`, `nature_compte`, `line_kind` (`credit|depense_fiscale|recette_fiscale|
  recette_non_fiscale|recette_affectee`), `ae numeric(18,2)`, `cp numeric(18,2)`,
  `amount numeric(18,2)` (recettes / cadres sans AE-CP), `currency`, `label`.
- **Contrainte** : exactement l'un de (`ae|cp`) ou `amount` renseigné selon
  `line_kind` (check) ; jamais `ae`/`cp` sur une recette.
- **Partitionnement** : par `fiscal_year` (via colonne dénormalisée) — liste.
- **Index** : `(budget_id)`, `(mission, programme)`, `(cofog)`.
- **Exemple** (voté vs exécuté par mission) :

```sql
select v.mission,
       sum(v.cp) filter (where b.stage = 'vote')    as cp_lfi,
       sum(v.cp) filter (where b.stage = 'execute') as cp_execute
from fin.public_budget_lines v
join fin.public_budgets b using (budget_id)
where b.entity_kind = 'etat' and b.fiscal_year = 2024 and v.side = 'depense'
group by 1 order by 3 desc nulls last;
```

### fin.public_executions
- **Objectif** : exécution infra-annuelle et états d'exécution qui ne sont pas des
  documents votés (situation mensuelle, consommation AE/CP en cours d'année).
- **PK** `execution_id`. **FK** `budget_id` (exercice de rattachement), `run_id`.
- **Colonnes** : `period` (mois ou année), `mission/programme/titre`,
  `ae_consumed`, `cp_paid`, `receipts`, `balance`, `basis` (`encaissements|
  droits_constates`).
- **Partitionnement** : par année. **Index** : `(budget_id, period)`.

### fin.public_transfers
- **Objectif** : flux entre administrations et vers des tiers : dotations DGF,
  péréquation, subventions pour charges de service public aux opérateurs,
  prélèvement UE, APD.
- **PK** `transfer_id`. **FK** émetteur et receveur : `(geo_level, geo_code,
  geo_vintage)` nullable + `siren` nullable (au moins un des deux — check),
  `dataset_id`, `run_id`.
- **Colonnes** : `transfer_type` (`DGF|DSU|DSR|FPIC|SCSP|prelevement_UE|
  fonds_UE|APD|autre` — codelist extensible en table), `fiscal_year`, `amount`,
  `direction` (signe normalisé émetteur→receveur), `label`.
- **Index** : `(receiver_geo_code, fiscal_year)`, `(transfer_type, fiscal_year)`.
- C'est la table du **bridge** « qui finance qui ».

### fin.public_debt
- **Objectif** : encours, flux et coût de la dette par entité.
- **PK** `debt_id`. **FK** entité comme `public_transfers`, `run_id`.
- **Colonnes** : `debt_scope` (`etat_negociable|apu_maastricht|apul|asso|
  collectivite`), `metric` (`stock|interets|emissions|duree_moyenne|taux_moyen|
  part_non_residents`), `period`, `value`, `unit` (`EUR_M|percent|years`),
  `accounting_frame`.
- **Index** : `(debt_scope, metric, period)`.
- **Note** : la détention détaillée par créancier n'existe pas en source publique —
  le schéma ne prévoit volontairement pas de table « holders » nominative.

### fin.public_procurement
- **Objectif** : commande publique (DECP + PLACE).
- **PK** `contract_id` (id DECP normalisé). **FK** `run_id`, `dataset_id`.
- **Colonnes** : `buyer_siret`, `buyer_geo_code`, `supplier_siret`,
  `supplier_geo_code`, `cpv varchar(10)`, `procedure_type`, `notified_at`,
  `duration_months`, `amount`, `execution_geo_code` (lieu d'exécution déclaré),
  `data_quality` (`ok|suspect_amount|duplicate_candidate` — résultat du nettoyage).
- **Partitionnement** : par année de notification.
- **Index** : `(buyer_geo_code, notified_at)`, `(supplier_siret)`, `(cpv)`.
- **Sensibilité** : SIRET = données d'entreprises (publiques par obligation) ; les
  titulaires personnes physiques suivent le statut de diffusion Sirene.

### fin.public_subsidies
- **Objectif** : subventions et aides versées (jaunes, aides d'État, PAC agrégée,
  fonds UE projets).
- **PK** `subsidy_id`. **FK** `run_id`, `dataset_id`.
- **Colonnes** : `granter` (`etat|region|departement|commune|ue|operateur`),
  `granter_ref`, `beneficiary_siren` nullable, `beneficiary_kind`
  (`association|entreprise|collectivite|agrege_commune`), `beneficiary_geo_code`,
  `scheme` (dispositif), `fiscal_year`, `amount`, `source_publication`.
- **Règle RGPD** : personnes physiques uniquement en lignes **agrégées**
  (`beneficiary_kind = 'agrege_commune'`) — contrainte check : `beneficiary_siren
  is null ⇒ beneficiary_kind = 'agrege_commune'`.

### Tables métier « domaines » restantes
Ces tables partagent le même squelette : **PK** identity, **FK**
`(geo_level, geo_code, geo_vintage)` + `run_id`, période, valeurs typées, index
`(geo_code, period)`. Ne sont créées **que** là où le spine `observations` ne
suffit pas (objets à identité propre) ; sinon le domaine vit dans `observations`
avec un `theme` dédié. Décision table par table :

| Table demandée | Décision | Contenu spécifique |
|---|---|---|
| `public_employment` | table dédiée | séries emploi/chômage multi-concepts : `concept` (`BIT|DEFM_A|effectifs_prives|effectifs_FPE/FPT/FPH`), `sector_naf`, valeurs — le concept fait partie de la clé pour interdire les mélanges BIT/DEFM |
| `public_companies` | table dédiée | stock/flux d'établissements par commune × NAF × catégorie (`stock`, `creations`, `defaillances`, `micro_entrepreneur bool`) ; le répertoire unitaire SIRET n'est **pas** stocké au MVP (agrégats seulement), fichiers stock requêtés en Parquet externe |
| `public_demography` | vue sur `observations` | population, naissances, décès, soldes ; prénoms = table annexe `demography_firstnames (geo, year, sexe, prenom, n)` |
| `public_health` | table dédiée | offre de soins : `finess`, `category`, capacité, activité + agrégats communaux (densité, APL) |
| `public_education` | table dédiée | établissements : `uai`, secteur, effectifs, IPS ; résultats seulement accompagnés des indicateurs de valeur ajoutée |
| `public_security` | vue sur `observations` | taux/1000 hab par famille d'infractions, flags méthodo obligatoires ; BAAC agrégé commune×année |
| `public_housing` | table dédiée | DVF agrégé commune×année×type (`n_mutations`, `prix_median_m2`, `couverture`), RPLS, Sitadel, loyers (badge estimation) |
| `public_transport` | vue sur `observations` | fréquentation gares (clé UIC en dimension), régularité |
| `public_energy_environment` | vue sur `observations` | conso énergie commune, artificialisation, déchets, eau |
| `european_comparisons` | vue matérialisée | jointure `observations` (pays) × indicateurs harmonisés Eurostat/OCDE, avec colonnes `harmonized bool`, `series_break bool`, `unit_basis` (`current|SPA|per_capita`) — seule surface autorisée pour le comparateur international |

**Vues matérialisées de service** (rafraîchies post-ingestion, servies à l'export) :
`pub.mv_territory_card` (fiche territoire dénormalisée), `pub.mv_map_layers`
(indicateur × niveau × période, prêt pour tuiles), `pub.mv_freshness` (dashboard
fraîcheur : dernier run OK, retard vs `expected_freshness_days`).

---

## E. Sensibilité, rétention, RLS

| Classe | Tables | Politique |
|---|---|---|
| Public | `pub.*` (vues/MV), `geo.*`, `core.indicators/definitions`, `meta.dataset_registry`, `meta.change_log` | lecture anonyme (RLS `select` pour rôle `anon` via PostgREST/exports) |
| Interne | `meta.ingestion_runs`, `raw_assets`, `data_quality_checks`, `transformations`, `core.observations` (brutes) | rôle `service_role`/CI uniquement |
| Sensible | aucune donnée nominative de personne physique n'est stockée ; les champs SIREN/SIRET concernent des personnes morales ou des entrepreneurs dont le statut de diffusion Sirene est respecté (`diffusion_status` vérifié à l'ingestion) | contrôle à l'ingestion + check `blocker` |
| Rétention | snapshots R2 et lineage : permanents ; logs applicatifs : 90 j ; runs `superseded` : conservés ; aucune donnée utilisateur (pas de compte au MVP) | RGPD : registre de traitement minimal, pas de cookies analytiques nominatifs |

## F. Ce que le modèle interdit par construction

- Publier un indicateur sans définition ni méthodo (checks de publication).
- Additionner une médiane ou un taux entre territoires (`indicators.additive`).
- Comparer deux millésimes territoriaux sans passage (`geo.passage`).
- Mélanger AE/CP et recettes, budgétaire et comptabilité nationale
  (checks sur `public_budget_lines`, `accounting_frame` obligatoire).
- Faire passer une valeur secrétisée pour une absence (`value_status`).
- Stocker une microdonnée fiscale/sociale individuelle (aucune table ne le permet).
