# 08 — Livrable 8 : backlog GitHub priorisé

> **État au 31/07/2026** — fait (PR #2) : T-01, T-04, T-05 ; entamés : T-06/T-07/T-08/T-09
> (connecteurs de snapshot sans clé + lineage ; normalisation vers les tables
> analytiques à venir avec T-11+). T-07 couvre déjà le pattern de T-10 (Webstat
> est un portail Opendatasoft). Bloqués sur les actions de `docs/SETUP.md`
> (comptes + secrets) : T-02, T-03, et la partie Sirene de T-08.

Format des tickets : chaque issue GitHub reprend ce gabarit —
**Epic / User story / Critères d'acceptation / Source(s) / Tables / Endpoint /
Priorité / Effort (S-M-L-XL) / Risque / Dépendances / Tests / Definition of Done.**

DoD commune à tous les tickets : code testé en CI, migration versionnée le cas
échéant, lineage renseigné, documentation mise à jour, revue humaine, déployé en
staging.

## Epics

| Epic | Objectif | Phase |
|---|---|---|
| E1 Socle | monorepo, CI/CD, environnements, secrets | MVP |
| E2 Entrepôt | Supabase, PostGIS, migrations, registres, lineage | MVP |
| E3 Référentiel géo | COG, géométries, historisation, tuiles | MVP |
| E4 Connecteurs P0 | ODS générique, INSEE, Eurostat, data.gouv, fichiers | MVP |
| E5 Domaines MVP | finances locales, État, dette/macro, démographie, entreprises | MVP |
| E6 Publication | exports statiques, PMTiles, cache, fraîcheur | MVP |
| E7 Front carte | carte, fiches, comparateur, traçabilité UI | MVP |
| E8 Qualité | checks, badges, change_log, dashboards | MVP→P2 |
| E9 Domaines P1 | fiscalité, social/santé, éducation, sécurité, marchés… | P2 |
| E10 API publique | gateway, OpenAPI, quotas | P3 |
| E11 Moteur de questions | plan de requête, gabarits SQL, éval | P3 |

## Premiers tickets (ordre d'exécution)

| # | Ticket | Epic | Prio | Effort | Dépend de | Critères d'acceptation clés |
|---|---|---|---|---|---|---|
| T-01 | Initialiser le monorepo (`pipeline/` Python, `site/` TS, `infra/`, `docs/`) + CI lint/test | E1 | P0 | S | — | CI verte sur PR vide ; conventions CLAUDE.md appliquées |
| T-02 | Configurer Cloudflare Pages/Workers + R2 (buckets `raw`, `published`) dev/staging/prod | E1 | P0 | M | T-01 | déploiement preview par PR ; R2 accessible depuis CI avec secrets GitHub |
| T-03 | Créer le projet Supabase, activer PostGIS, brancher les environnements | E2 | P0 | S | T-01 | `select postgis_version()` ok en staging ; RLS activée par défaut |
| T-04 | Écrire les migrations SQL du modèle (doc 02 : `meta`, `geo`, `core`, `fin`, `pub`) | E2 | P0 | L | T-03 | migrations rejouables de zéro ; contraintes du §F testées |
| T-05 | Peupler `source_registry`/`dataset_registry` depuis le registre (doc 01) | E2 | P0 | M | T-04 | 100 % des lignes P0 présentes avec licence et fréquence |
| T-06 | Connecteur data.gouv.fr (catalogue + ressources + hash) | E4 | P0 | M | T-04 | snapshot R2 + `raw_assets` ; re-run sans changement ⇒ 0 écriture |
| T-07 | Connecteur générique Opendatasoft (exports Parquet/CSV + records) | E4 | P0 | M | T-06 | testé sur OFGL + data.economie ; quotas respectés |
| T-08 | Connecteur INSEE (Melodi JSON + BDM SDMX + clé Sirene) | E4 | P0 | L | T-06 | Filosofi, populations, dette Maastricht ingérés ; nettoyage préfixes GEO |
| T-09 | Connecteur Eurostat (statistics API + flags de rupture) | E4 | P0 | M | T-06 | 4 indicateurs UE du MVP ingérés avec flags |
| T-10 | Connecteur Banque de France Webstat | E4 | P1 | S | T-07 | 2 séries tests ingérées, licence tracée par jeu |
| T-11 | Référentiel géo : COG + mouvements + Admin Express + table d'appartenance + GISCO → `geo.*` + fonction `geo.passage()` | E3 | P0 | L | T-04 | commune fusionnée test : série continue ; géométries valides ; NUTS versionnés |
| T-12 | Ingestion finances locales OFGL (4 niveaux) + dotations → `fin.*`/`core.*` + checks totaux | E5 | P0 | L | T-07, T-11 | totaux vs publications OFGL ±0,5 % ; €/hab via dénominateur |
| T-13 | Installer le skill design (`npx skills add https://github.com/Leonxlnx/taste-skill`) et poser le design system du site | E7 | P0 | S | T-01 | skill commité ; tokens/typo/palette validés sur 2 maquettes |
| T-14 | Ingestion État : PLF/LFI + exécution par mission → `fin.public_budgets/lines/executions` | E5 | P0 | L | T-07 | waterfall voté/exécuté 2024 reproduit les documents officiels |
| T-15 | Ingestion dette/macro (BDM + AFT + comptes APU COFOG) | E5 | P0 | M | T-08 | série dette 1995→ en Md€ et % PIB, sous-secteurs |
| T-16 | Ingestion démographie + Filosofi + Sirene stocks/SIDE | E5 | P0 | L | T-08, T-11 | secret statistique rendu `confidential` (jamais 0) ; volumétrie Sirene ok |
| T-17 | Exports publiés : JSON fiches/séries + manifeste + purge CDN | E6 | P0 | M | T-12..16 | reproductibles ; manifeste liste runs sources |
| T-18 | Génération PMTiles (tippecanoe en CI) communes→régions × millésimes | E6 | P0 | M | T-11 | < 300 Mo/couche ; rendu fluide zoom 5→13 |
| T-19 | Première carte MapLibre (choroplèthe + sélecteurs + URL partageable) | E7 | P0 | L | T-13, T-17, T-18 | 4 déclinaisons ; échelle et millésime affichés |
| T-20 | Première fiche commune (blocs + panneaux traçabilité) | E7 | P0 | L | T-17 | 5 communes-tests du doc 07 passent |
| T-21 | Comparateur territorial + groupes de comparaison v1 | E7 | P0 | M | T-20 | refus motivé si non comparable ; groupe liste membres et critères |
| T-22 | Data lineage bout-en-bout : « D'où vient ce chiffre ? » depuis l'UI | E8 | P0 | M | T-17 | chaque valeur remonte à `raw_assets` en ≤ 1 requête |
| T-23 | Contrôles qualité : checks bloquants + `change_log` + alertes (issues) | E8 | P0 | M | T-12..16 | source coupée ⇒ alerte < 24 h ; check rouge ⇒ pas de publication |
| T-24 | Dashboard de fraîcheur public | E8 | P0 | S | T-23 | page publique, statut par jeu, retard calculé |
| T-25 | Documentation OpenAPI du schéma d'export (préfiguration API v1) | E10 | P1 | S | T-17 | manifeste + formats documentés, publiés sur le site |
| T-26 | Déploiement staging complet puis production (checklist doc 03 §7) | E1 | P0 | M | tout MVP | tests d'acceptation doc 07 verts en staging puis prod |

Phase 2/3 : décliner E9–E11 en tickets au moment voulu (un ticket par connecteur
P1, puis API gateway, gabarits SQL du moteur de questions, corpus d'évaluation).
