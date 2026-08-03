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
| Perte de la base (pas de restauration ponctuelle sur le plan gratuit) | élevé | **sauvegarde hebdomadaire vérifiée** (`plateforme/sauvegarde.py`) : le dump est restauré dans une base jetable et comparé table par table à la source avant dépôt dans R2. Un dump qui ne se restaure pas n'est jamais déposé — le run échoue et l'absence de sauvegarde se voit. Procédure de restauration publiée dans `sauvegardes/derniere.json` |
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
| D2 | Nom de domaine et nom public du produit | — | **Tranché le 31/07/2026 : `500signatures.fr`** (domaine détenu par le propriétaire, zone déjà sur Cloudflare) ; le rattachement DNS au site se fera au déploiement (T-17/T-19) |
| D3 | Périmètre DVF au MVP | inclus / phase 2 | décision à S6 sur critère de charge (doc 07) ; sinon phase 2 |
| D4 | Fond de carte | auto-hébergé (OpenMapTiles) / service IGN | auto-hébergé PMTiles (coût nul, indépendance), IGN en option ultérieure |
| D5 | Fréquence de publication des exports | hebdo / à chaque ingestion | hebdo au MVP (prévisibilité), sauf correctifs |
| D6bis | Passage au plan Supabase payant | — | **À trancher maintenant : la limite est franchie.** Mesuré le 31/07/2026 en fin de journée : **608 Mo** (`pg_database_size`) pour un plan gratuit qui en annonce 500. La base accepte encore les écritures (`default_transaction_read_only = off`), mais la marge n'existe plus. Détail : `core.observations` pèse 549 Mo à elle seule (322 Mo de tables, 227 Mo d'index) pour 1 325 516 lignes, dont **1 254 714 au niveau communal — 94,7 %** ; le référentiel géographique ajoute 36 Mo. Aucun gain à attendre d'un nettoyage : les lignes mortes sont à zéro, et l'index `(geo_level, geo_code, period)`, seul candidat à la suppression, a servi 4,2 millions de fois au dernier calcul des groupes de comparaison. **Deux leviers, exclusifs :** (a) plan Pro (~25 $/mois), qui lève la contrainte et rouvre DVF, Filosofi et Sirene ; (b) réduire l'historique communal — chaque exercice communal retiré libère ≈ 87 Mo, deux exercices ramèneraient la base à ≈ 434 Mo au prix de deux années d'historique en moins sur le site. Le levier (b) est réversible : les snapshots 2018-2025 sont archivés dans R2 et se rechargent en une commande. **Levier (b) appliqué le 31/07/2026** à la demande explicite du propriétaire d'aller au bout du produit : la rétention communale à partir de 2022 a retiré 418 416 observations et ramené la base de **618 Mo à 288 Mo**, soit 212 Mo de marge sous le plafond. Le coût est deux exercices communaux d'historique en moins (2020, 2021) ; les snapshots R2 les conservent et `plateforme.normalize.ofgl --niveaux commune --depuis 2018` les recharge. La question du plan payant reste ouverte : elle se reposera avec DVF, Sirene géolocalisé ou l'historique complet. Mesures successives, pour mémoire : 390 Mo, puis 608 Mo, puis 618 Mo avant rétention, 288 Mo après. |
| D6quater | Plafond de volume : retour au constat | — | **Constaté le 02/08/2026** : le rechargement OFGL 2018 permis par D6ter a rempli la base jusqu'à ce que Supabase la passe en **lecture seule** en cours d'écriture (`ReadOnlySqlTransaction`) — le disque réel était resté à ~500 Mo, le « forfait payant » annoncé n'avait pas élargi l'espace de base de données. Le plafond (`limites.py`) redescend à **470 Mo**, la borne de rétention à 2022, et `plateforme/retablissement.py` (job `retablissement`) lève la lecture seule le temps de retirer les exercices chargés par l'incident et de rendre l'espace. Leçon écrite dans les trois modules : un plafond d'infrastructure ne monte que sur un chiffre mesuré (les journaux du rétablissement impriment taille et réglage read-only), jamais sur une déclaration. **Action propriétaire** : vérifier dans le tableau de bord Supabase quel plan est réellement actif (le plan Pro à 25 $/mois porte le disque à 8 Go ; il n'existe pas de palier à 5 $ qui élargisse la base) ; sur constat d'un disque élargi, D6ter se rejouera telle quelle. |
| D6ter | Plafond de volume sous forfait payant | — | **Tranché le 02/08/2026 par le propriétaire** : il indique être sur un forfait Supabase payant. Le garde-fou (plateforme/limites.py) passe de 470 Mo à **2 Go** — palier volontairement sous les 8 Go de disque des plans payants, à élever sur constat. Le 2 août, le garde-fou avait tiré deux fois (492 puis 472 Mo) et deux VACUUM FULL avaient récupéré le bloat des rechargements (83 Mo au premier passage). Ce déblocage rouvre : historique communal OFGL 2018-2021, historique et classes complètes de la délinquance communale, APL des quatre autres professions, effectifs scolaires, puis DVF/logement, élections, naissances-décès, BPE. |
| D6 | Budget infra mensuel plafond | — | **Tranché le 31/07/2026 : plans gratuits Supabase/Cloudflare** tant qu'ils suffisent ; passage au payant une fois le produit rodé ou en cas de blocage. Conséquences assumées et documentées dans `docs/SETUP.md` (pause d'inactivité et 500 Mo Supabase Free, pas de PITR — sauvegardes compensées par dumps versionnés vers R2). **Compensation en place le 01/08/2026** : `plateforme/sauvegarde.py`, hebdomadaire, restaure chaque dump dans une base jetable et compare les comptages table par table avant de le déposer — un dump qui ne se restaure pas fait échouer le run au lieu de passer pour une sauvegarde. Première exécution vérifiée : 9,9 Mo, 1 067 371 observations restaurées et recomptées à l'identique, déposées sous `sauvegardes/<horodatage>/entrepot.dump` dans `plateforme-raw`, avec `sauvegardes/derniere.json` qui donne l'empreinte et la commande de restauration |
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
