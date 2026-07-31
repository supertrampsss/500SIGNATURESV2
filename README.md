# 500signaturesv2 — la référence publique des données économiques, sociales, territoriales et budgétaires françaises

Plateforme web centrée sur une **carte interactive de la France**, complétée d'une
couche européenne, qui rend la donnée publique **accessible, compréhensible,
cartographiable, comparable, vérifiable, reproductible, contextualisée et historisée**.

L'utilisateur doit pouvoir répondre à des questions comme : où vont mes impôts ?
combien l'État dépense-t-il pour la santé ou la défense ? ma commune est-elle mieux
gérée que les communes comparables ? comment la France se compare-t-elle à
l'Allemagne ? quel est l'écart entre budget voté et exécuté ?

**Positionnement de fiabilité** : rigueur, neutralité politique, transparence sur les
limites. Jamais de corrélation présentée comme causalité, jamais de donnée budgétée
présentée comme exécutée. Le produit doit résister à une vérification par un
journaliste, un économiste, un élu, un citoyen ou la Cour des comptes.

## Stack

- Frontend / Edge : Cloudflare Pages, Workers, Queues, Cron Triggers, R2
- Base de données : Supabase PostgreSQL + PostGIS
- Cartographie : MapLibre GL JS + tuiles vectorielles PMTiles
- Ingestion lourde : Python ; connecteurs edge et application : TypeScript
- Orchestration IA : Claude (FABLE5 pour planifier/observer, Opus 5 pour les
  transformations complexes) — **aucun chiffre publié sans contrôle déterministe
  et validation humaine**

## État du projet

Phase actuelle : **conception**. Aucun code applicatif tant que le benchmark des
sources et l'architecture ne sont pas validés.

## Documentation

| Document | Contenu |
|---|---|
| [docs/00-resume-executif.md](docs/00-resume-executif.md) | Résumé exécutif ; principes et limites de la promesse « de l'impôt à l'euro dépensé » |
| [docs/01-registre-sources.md](docs/01-registre-sources.md) | **Livrable 1** — Registre complet des sources FR/UE, priorisation P0/P1/P2/P3/EXCLU |
| [docs/02-modele-donnees.md](docs/02-modele-donnees.md) | **Livrable 2** — Modèle canonique PostgreSQL/PostGIS (Supabase) |
| [docs/03-architecture.md](docs/03-architecture.md) | **Livrable 3** — Architecture technique : collecte, transformation, stockage, exposition API, orchestration, observabilité, sécurité |
| [docs/04-carte-ux.md](docs/04-carte-ux.md) | **Livrable 4** — UX et carte interactive |
| [docs/05-moteur-questions.md](docs/05-moteur-questions.md) | **Livrable 5** — Moteur de questions en langage naturel, strictement sourcé |
| [docs/06-qualite-methodologie.md](docs/06-qualite-methodologie.md) | **Livrable 6** — Charte de qualité, méthodologie, badges, traçabilité |
| [docs/07-roadmap.md](docs/07-roadmap.md) | **Livrable 7** — Roadmap MVP / Phase 2 / Phase 3 |
| [docs/08-backlog.md](docs/08-backlog.md) | **Livrable 8** — Backlog GitHub priorisé, premiers tickets |
| [docs/09-risques-decisions.md](docs/09-risques-decisions.md) | Risques juridiques, techniques, méthodologiques, réputationnels ; décisions à prendre avant de coder |

Les conventions de travail pour les agents de code sont dans [CLAUDE.md](CLAUDE.md).
