# 500signatures

[500signatures.fr](https://500signatures.fr) raconte les comptes publics en une page,
puis vous laisse gouverner dans le jeu Mandats.

| Page | Utilité | Code |
|---|---|---|
| `/` Récit | De la facture de l’État à votre ville, en défilant, chiffres sourcés | `site/src/recit/` |
| `/salaires/` | Du coût du travail au revenu, et la dépense collective | `site/src/salaires.ts` |
| `/mandats/` | Cinq ans au pouvoir, tour par tour | `site/src/jeu/` |

Les comptes observés et les hypothèses de jeu ont des statuts différents. Chaque chiffre
porte sa source et son année.

## Travailler sur le projet

Lire [AGENTS.md](AGENTS.md), puis [CONTRIBUTING.md](CONTRIBUTING.md).

## Architecture en service

- Interface : TypeScript, Vite, HTML/CSS.
- Ingestion et normalisation : Python et DuckDB (`pipeline/`).
- Publication : fichiers de données dans R2 et site pré-rendu sur Cloudflare Pages.
- Fonction de domaine canonique : `site/functions/`. Le déploiement part de `site/`.
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


## Références

| Document | Usage |
|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Commandes et niveau de vérification attendu |
| [Contrat des fichiers publiés](docs/10-api-publique.md) | Données accessibles et structure des publications |
| [Décisions produit et économie](docs/product-business-decisions.md) | Emplacements, formats, revenus publicitaires et critères de lancement |
