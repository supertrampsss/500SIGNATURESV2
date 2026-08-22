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

**En ligne** : <https://plateforme-9sz.pages.dev>. Le socle est en production —
ingestion, contrôles, publication, carte — et s'enrichit source par source.

Au 1er août 2026 : **37 indicateurs** issus de **19 jeux de données** de six
producteurs (INSEE, Eurostat, DGFiP / Direction du Budget, OFGL, IGN, Etalab),
soit **1,07 million d'observations** sur 36 349 territoires.

| Domaine | Ce qu'on peut lire |
|---|---|
| Budget de l'État (15) | Recettes, dépenses par titre, prélèvements sur recettes et solde, aux trois moments du même exercice — voté, rectifié, exécuté — de 2013 à 2025. Le pont recettes → dépenses → solde est vérifié à l'euro par un contrôle bloquant |
| Dette publique (6) | Encours Maastricht par sous-secteur : État, organismes centraux, collectivités, Sécurité sociale |
| Finances locales (6) | Recettes et dépenses de fonctionnement, investissement, épargne brute, encours de dette — communes, intercommunalités, départements, régions |
| Europe (4) | Dette, déficit, chômage et PIB par habitant sur les définitions harmonisées d'Eurostat |
| Territoires (6) | Population municipale, niveau de vie médian, taux de pauvreté, dotations de l'État, chômage localisé, établissements actifs |

**Ce que le produit refuse de faire.** Il ne prétend pas suivre un euro d'impôt
jusqu'à une dépense : cette traçabilité n'existe pas dans les comptes publics.
Il montre un **pont explicable** entre ce qui est encaissé et ce qui est dépensé,
et le dit là où on pourrait croire le contraire. Il ne compare pas deux
territoires, deux pays ni deux années sans contrôler la définition, le périmètre,
la période et l'unité — une série qui enjambe une fusion de communes le signale.
Ce qui ne passe pas un contrôle bloquant n'est pas publié.

**Vérifiabilité.** Chaque chiffre porte son producteur, sa licence, la date
d'extraction réellement utilisée, sa définition publique et technique, et sa
formule. Les instantanés bruts sont archivés et immuables. L'état de fraîcheur de
chaque source, ce que les contrôles ont relevé et le journal des corrections sont
publics. Les fichiers publiés sont documentés et réutilisables sans clé
([docs/10](docs/10-api-publique.md)).

**Limites connues, assumées.** La ventilation du budget de l'État par mission et
programme n'est pas atteignable depuis les sources ouvertes actuelles
(docs/08) : le projet de loi de finances n'est pas la loi votée, et l'exécution
par mission s'arrête à l'exercice 2013. L'historique communal commence à 2022 —
les exercices antérieurs ont été retirés pour tenir dans les 500 Mo du plan
gratuit, et se rechargent en une commande depuis les instantanés (D6bis). Le
moteur de questions en langage naturel (docs/05) reste en phase 3 : les questions
auxquelles le site répond réellement sont écrites en clair sur la page d'accueil.

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
| [docs/10-api-publique.md](docs/10-api-publique.md) | Contrat des fichiers publiés : URL stables, contenu, ordres de grandeur, exemples vérifiés |
| [docs/SETUP.md](docs/SETUP.md) | Mise en place : secrets, migrations, seed, déploiement |

