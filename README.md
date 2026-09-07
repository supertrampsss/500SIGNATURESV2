# 500signatures

[500signatures.fr](https://500signatures.fr) permet de comprendre les comptes publics,
comparer les territoires et éprouver ses arbitrages dans le jeu Mandats.

## Parcours actuels

| Parcours | Utilité | Code principal |
|---|---|---|
| France | Lire les finances publiques et comparer des séries harmonisées | `site/src/insights-france.ts`, `site/src/insights-europe.ts` |
| Territoires | Rechercher une commune et comprendre ses indicateurs | `site/src/main.ts`, `site/src/territoire-finances.ts` |
| Salaires | Comprendre les prélèvements et la dépense collective | `site/src/salaires.ts` |
| Mandats | Prendre 45 décisions sur cinq ans, priorité au mode national | `site/src/mandats/` |

Les comptes observés, les calculs et les hypothèses de jeu ont des statuts différents.
Les sources et leurs limites font partie de la lecture. Les comparaisons visibles
sur les courbes France se limitent à France, Allemagne, Espagne et Italie lorsque
les données existent au même périmètre. Aucun bouton pour ajouter les autres pays.

## Travailler sur le projet

Lire [AGENTS.md](AGENTS.md), puis [CONTRIBUTING.md](CONTRIBUTING.md).
Depuis `site/`, avec Node 22 ou plus récent :

```sh
npm ci
npm run dev
```

Après installation, `npm run check:local` vérifie les tests, les types et la
compilation du client sans télécharger les données de production. Ce contrôle
ne remplace pas le pré-rendu complet ni les tests navigateur requis par la CI.
`npm run check` reste le contrôle complet avec données publiées.

## Architecture en service

- Interface : TypeScript, Vite, HTML/CSS, MapLibre GL JS et PMTiles.
- Ingestion et normalisation : Python et DuckDB (`pipeline/`).
- Publication : fichiers de données dans R2 et site pré-rendu sur Cloudflare Pages.
- Fonctions de partage : `site/functions/`. Le déploiement part de `site/`.
- Validation et publication : `.github/workflows/ci.yml` et `deploy.yml`.

Les premiers documents décrivent une architecture Supabase/PostgreSQL antérieure.
Pour une modification, le code courant et les workflows font référence ; ne pas
réinstaller cette ancienne architecture sur la base d'un plan historique.

## Produit et économie

[Décisions produit et modèle économique](docs/product-business-decisions.md) est
le document de travail courant. Il distingue l'existant, les hypothèses et les
conditions de lancement. L'accès public reste gratuit et la publicité finance
le site : placements discrets dans les contenus et vente directe d'espaces.
Le jeu reste sans interruption publicitaire. Aucune recette n'est présumée.

`npm run business:case`, depuis `site/`, recalcule les revenus selon l'audience,
les impressions réellement monétisables, les ventes directes et les coûts.
La politique partagée est dans `site/src/advertising-policy.ts`. Ces calculs
et règles ne chargent aucune régie et ne créent aucun paiement.

## Références

| Document | Usage |
|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Commandes et niveau de vérification attendu |
| [Contrat des fichiers publiés](docs/10-api-publique.md) | Données accessibles et structure des publications |
| [Décisions produit et économie](docs/product-business-decisions.md) | Emplacements, formats, revenus publicitaires et critères de lancement |
| [Stratégie Mandats](docs/mandats/STRATEGIE.md) | Contexte de conception historique, certains choix ont évolué |
| [Plans et spécifications](docs/superpowers/) | Historique des changements, pas une nouvelle liste de fonctionnalités à livrer |
