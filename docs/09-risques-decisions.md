# 09 — Risques et décisions à prendre avant de coder

## Risques juridiques

| Risque | Gravité | Mitigation |
|---|---|---|
| Licence non-LO2.0 mal tracée (ODbL SNCF/OSM, conditions BdF, Citepa, INPI) | moyen | licence par jeu dans `source_registry`, bloquante à l'ingestion ; ODbL ⇒ partage à l'identique respecté ou source écartée |
| Réidentification via mailles fines (fiscal, santé, petites communes) | élevé | ne publier que ce que le producteur publie ; `confidential` conservé ; pas de croisement désagrégeant ; revue avant tout nouvel indicateur fin |
| Données nominatives réglementaires (PAC, subventions, DECP entrepreneurs individuels) | moyen | agrégation systématique personnes physiques ; respect du statut de diffusion Sirene ; procédure de retrait documentée |
| RGPD côté produit | faible (pas de compte, pas de tracking nominatif) | registre de traitement ; analytics agrégée sans cookie |
| Réutilisation Eurostat/OCDE/BCE | faible | mention de source systématique (déjà requise par la charte) |

## Risques techniques

| Risque | Gravité | Mitigation |
|---|---|---|
| Rupture d'API/portail (migration INSEE déjà survenue, ids ODS annuels) | élevé | tests de liveness quotidiens, découverte par catalogue, alerte < 24 h, connecteurs génériques |
| Volumétrie (Sirene 28 M établissements, DVF 5 M/an, balances) | moyen | fichiers stock plutôt qu'API, agrégats en base, détail en Parquet R2 requêté par DuckDB |
| Coûts Supabase/R2 dérivants | moyen | budget mensuel suivi ; exports statiques = coût de lecture nul ; alerte de coût |
| Tuiles communales lourdes | moyen | simplification par zoom, PMTiles, budget taille par couche testé en CI |
| Dépendance à un seul mainteneur des connecteurs | moyen | connecteurs déclaratifs + doc registre = un connecteur se répare sans archéologie |

## Risques méthodologiques

| Risque | Gravité | Mitigation |
|---|---|---|
| Confusion budgétaire/CN, voté/exécuté | élevé (réputation) | `accounting_frame` obligatoire, lexique, revue humaine des pages nationales |
| Séries recollées à tort (Filosofi 2, TH, rebasements, NUTS) | élevé | flags de rupture portés par la donnée, comparateur qui refuse, notes visibles |
| Groupes de comparaison contestables | moyen | critères publiés, membres listés, pas de score ; méthodo versionnée |
| Indicateurs modélisés pris pour des mesures (APL, loyers) | moyen | badge Estimation + méthodo producteur liée |
| Erreur d'agrégation territoriale (médianes sommées, périmètres) | élevé | interdits par le schéma (`additive`, `geo.passage`) |

## Risques réputationnels

- **Instrumentalisation politique** d'une carte (sécurité, immigration, fiscalité) :
  verrous d'affichage (taux normalisés, avertissements, pas de classement),
  neutralité éditoriale N3 (tout est attribué), réponse publique documentée.
- **Une seule erreur de chiffre très visible** peut coûter la crédibilité :
  checks bloquants, correction publique rapide (`change_log`), post-mortem.
- **Accusation de « wrapper » des producteurs** : liens systématiques vers la
  source, republication des exports en open data, aucune rétention.

## Décisions à prendre avant de coder

| # | Décision | Options | Recommandation / statut |
|---|---|---|---|
| D1 | Visibilité du repo `500signaturesv2` | privé / public | **Tranché le 31/07/2026 : privé** pendant la conception et le début du développement ; passage en public au lancement du MVP |
| D2 | Nom de domaine et nom public du produit | — | à choisir avant le front (impacte SEO, partages) |
| D3 | Périmètre DVF au MVP | inclus / phase 2 | décision à S6 sur critère de charge (doc 07) ; sinon phase 2 |
| D4 | Fond de carte | auto-hébergé (OpenMapTiles) / service IGN | auto-hébergé PMTiles (coût nul, indépendance), IGN en option ultérieure |
| D5 | Fréquence de publication des exports | hebdo / à chaque ingestion | hebdo au MVP (prévisibilité), sauf correctifs |
| D6 | Budget infra mensuel plafond | — | **Tranché le 31/07/2026 : plans gratuits Supabase/Cloudflare** tant qu'ils suffisent ; passage au payant une fois le produit rodé ou en cas de blocage. Conséquences assumées et documentées dans `docs/SETUP.md` (pause d'inactivité et 500 Mo Supabase Free, pas de PITR — sauvegardes compensées par dumps versionnés vers R2) |
| D7 | Qui est le relecteur humain des validations méthodo | — | **Tranché le 31/07/2026 : le propriétaire du dépôt (`supertrampsss`)** approuve chaque nouveau connecteur et changement de méthodologie via les PRs, présentés avec un résumé en français |
| D8 | Comptes utilisateurs (alertes territoriales, phase 3) | Supabase Auth / pas de comptes (e-mail simple) | trancher en phase 3 seulement |
| D9 | Politique de marque vis-à-vis des producteurs (mentions, logos) | — | mentions textuelles uniquement, pas de logos sans autorisation |
| D10 | Corpus et seuils d'évaluation du moteur de questions | — | à définir avant tout développement phase 3 |

## Informations à re-vérifier au moment de coder (non bloquantes pour la conception)

- URLs marquées **(nv)** dans le registre (doc 01) — vérification systématique à
  l'écriture de chaque connecteur (ticket correspondant).
- Quotas exacts par portail ODS et modalités de clé Webstat (variable par jeu).
- Conditions RNE/INPI si un besoin « comptes d'entreprises » émerge (P3).
- État de l'API Données locales INSEE (recouvrement avec Melodi) au moment de T-08.
