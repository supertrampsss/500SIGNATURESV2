# 08 — Livrable 8 : backlog GitHub priorisé

> **État au 31/07/2026** — fait (PR #2) : T-01, T-04, T-05, **T-03** (schéma,
> seed et checks appliqués au projet Supabase réel) et **T-02** (token vérifié,
> buckets R2 créés, store R2 du pipeline testé en réel, workflow Ingestion
> manuel) ; entamés : T-06/T-07/T-08/T-09 (connecteurs de snapshot sans clé +
> lineage ; normalisation vers les tables analytiques à venir avec T-11+).
> T-07 couvre déjà le pattern de T-10 (Webstat est un portail Opendatasoft).
> Secrets GitHub en place ; premier run d'ingestion réel exécuté.
>
> **T-11 (référentiel géographique)** : fait pour la partie non géométrique —
> COG 2025 (36 295 territoires : pays, régions, départements, EPCI, communes,
> arrondissements municipaux) et **4 882 mouvements territoriaux depuis 1943**,
> avec `geo.passage()` vérifiée sur des chaînes réelles (changement de
> département suivi d'une fusion, fusions successives). Reste dans T-11 : les
> **géométries** (Admin Express), traitées avec T-18 (tuiles vectorielles).
>
> **T-12 (finances locales OFGL)** : 5 indicateurs (dépenses et recettes de
> fonctionnement, dépenses d'investissement, épargne brute, encours de dette)
> plus la population de référence, sur communes, EPCI, départements et régions,
> avec fiche publiable pour chacun et contrôle de cohérence bloquant
> (épargne brute = recettes − dépenses). Reste : dotations (`public_transfers`)
> et groupes de comparaison v1.
>
> **T-18 (tuiles vectorielles)** : archive PMTiles unique publiée dans R2
> (`geo/<date>/territoires.pmtiles`, 56 Mo, zooms 0-12), trois couches —
> 34 875 communes, 101 départements, 18 régions — outre-mer compris. Les
> contours départementaux et régionaux sont reconstitués par fusion des
> communes, sur la maille des finances locales (Alsace, Métropole de Lyon).
>
> **T-14 (budget de l'État)** : fait pour la **nature** de la dépense, pas
> encore pour sa destination. Source retenue : la situation mensuelle
> budgétaire de la DGFiP, qui publie sur la même nomenclature la loi de
> finances initiale, la dernière loi rectificative et l'exécution — 39 budgets
> de 2013 à 2025, 628 lignes, 15 indicateurs nationaux. Le pont recettes →
> dépenses → solde est vérifié à l'euro par un contrôle bloquant sur les 39
> budgets. Deux défauts du fichier producteur sont traités (docs/06) : colonne
> « Exécution » décalée sur 2019-2021, répartition des PSR de la LFI 2022
> corrompue. **Reste dans T-14** : la ventilation par mission et programme, et
> les comptes spéciaux détaillés.
>
> **Obstacle constaté sur la ventilation par mission** (vérifié le 31/07/2026
> sur le catalogue de data.economie.gouv.fr) : le « voté contre exécuté par
> mission » demandé au plan n'est pas atteignable depuis ce portail.
> D'un côté, les jeux détaillés par mission portent le **projet** de loi de
> finances, pas la loi votée — `plf25-depenses-2025-selon-destination` a
> `loi = PLF`, et son budget général hors remboursements totalise 446,9 Md€
> contre 438,8 Md€ dans la LFI 2025 effectivement votée. De l'autre,
> l'exécution par mission s'arrête à l'exercice 2013 (`execution-2013-…`) ; le
> projet de loi de règlement le plus récent (`projet-de-loi-de-reglement-2020`)
> ne contient aucun enregistrement, seulement des pièces jointes.
> Publier le PLF seul en le présentant comme « le budget » confondrait un
> projet déposé et une loi votée. La suite passe donc par les annexes RAP ou
> par une autre source d'exécution ; un ticket dédié plutôt qu'un raccourci.
>
> **T-21 (comparateur) et T-24 (état des données)** : faits. Le comparateur
> met 2 à 5 territoires côte à côte sur les indicateurs du thème courant, avec
> la sélection dans l'URL ; il **refuse en le motivant** une comparaison entre
> niveaux différents, signale les périmètres qui se recouvrent et écrit
> « donnée non disponible » plutôt que de combler un trou. L'état des données
> affiche, jeu par jeu, la dernière lecture, le retard sur la fréquence
> annoncée, l'issue du dernier chargement et ce que les contrôles ont relevé.
>
> **Au-delà du backlog initial**, livrés le 31/07/2026 : le module « 100 € »
> (part de chaque poste dans 100 € encaissés puis dépensés par l'État, avec le
> refus explicite de tracer un euro), les questions d'entrée, l'API publique
> documentée (`docs/10`) et la politique de rétention (`plateforme/retention.py`)
> qui ramène la base sous le plafond du plan gratuit sans rien détruire
> d'irremplaçable.
>
> **T-23, journal et alertes** : faits le 01/08/2026. Le journal des changements
> est déclaré en code (`plateforme/journal.py`), synchronisé à chaque
> publication et exporté dans `journal.json`. Trois entrées à l'ouverture, toutes
> antérieures et jusque-là invisibles : l'exécution 2019-2021 corrigée du
> décalage producteur, la répartition des PSR de la LFI 2022 mise en quarantaine,
> les finances communales d'avant 2022 retirées par la rétention.
> Les alertes (`plateforme/alertes.py`) tiennent **une** issue à jour — ouverte
> quand un jeu dépasse sa tolérance de fraîcheur, échoue au chargement ou rate un
> contrôle bloquant ; fermée d'elle-même quand tout est rentré dans l'ordre. Un
> message par run produirait un fil que personne ne lirait, ce qui reviendrait à
> ne pas alerter. **Clos le 02/08/2026** : `core.observations_revisions` a son
> écrivain (`plateforme/revisions.py`) — seules les valeurs qui changent sont
> archivées (D6bis), le chômage localisé l'adopte en premier, et la page « État
> des données » compte les valeurs révisées sur 90 jours. Le « corrigé le … » à
> la cellule reste à construire au-dessus de cette archive (docs/06).
>
> **2 août 2026 — les trois manques relevés face à la demande initiale.**
> **COFOG** : « combien pour la santé, la défense, l'école ? » — la question
> fondatrice — se répond désormais au niveau de l'ensemble des administrations
> publiques (11 indicateurs, 34 pays, % du PIB, Eurostat harmonisé), avec un
> bloc national France / Allemagne / zone euro. Le choix est méthodologique
> autant que pratique : la mission Santé de l'État pèse 1,5 Md€ quand la
> dépense publique de santé en pèse plus de 260 — un « budget de l'État par
> mission » aurait répondu à côté. Contrôle d'identité : la somme des dix
> fonctions redonne le total, quarantaine sinon. Ce bloc fait aussi entrer la
> protection sociale — premier poste de la dépense publique — dans le champ.
> **Mobile** : première vérification en 375 px. Le viewport s'étirait à 424 px
> (tableaux larges), les commandes mangeaient 528 px : corrigé, vérifié.
> **Impôts locaux** : taux de taxe foncière par commune (REI DGFiP,
> 2022-2025). Deux indicateurs — le taux communal, que vote le conseil
> municipal, et le taux global, celui de l'avis d'imposition — parce que les
> confondre ferait accuser une commune de hausses votées ailleurs. Également :
> maires (RNE, sans données personnelles), repères médians région/France sur
> chaque fiche, repère « pays comparés » au niveau national.
>
> **2 août 2026, après-midi — quatre livraisons.** **Export CSV en un clic** :
> le tableau des données gagne un bouton de téléchargement au format tableur
> français (point-virgule, virgule décimale, BOM UTF-8), en-tête qui nomme
> l'indicateur, la source, la date et la licence ; le tableau montre 100
> territoires, le fichier les contient tous (34 772 lignes vérifiées en
> téléchargement réel). **Archive des révisions** : `plateforme/revisions.py`
> (voir T-23 ci-dessus), première adoption chômage + Sécu, colonne « Révisions »
> sur l'état des données. **Comptes de la Sécurité sociale** : dépenses,
> recettes et solde du sous-secteur S1314 (Eurostat gov_10a_main, 32 pays,
> 2013-2025), identité recettes − dépenses = solde vérifiée pays par pays
> (zéro quarantaine au premier chargement), bloc national « La Sécu, c'est
> combien ? » qui dit pourquoi ce chiffre n'est pas le « trou de la Sécu »
> parlementaire. Le premier chargement a été refusé par la contrainte des
> 50 mots de `indicator_definitions` — la charte a fait son travail ; les
> fiches sont resserrées et `declarer()` s'exécute désormais contre la base de
> test en CI. **Vérification CORS durcie** : les déploiements rougissaient sur
> un 403 anti-robot du bord R2 alors que la politique était bonne ; la
> vérification est désormais double — relecture autoritaire de la politique
> sur le bucket, puis rejeu navigateur (vrai User-Agent, retries) dont
> l'inconclusif n'est toléré que si la relecture a confirmé. Incident du jour :
> l'API BDM de l'INSEE répond 500 (panne producteur, issue d'alerte #3 tenue à
> jour automatiquement) — le chômage se rechargera au cron de lundi.
>
> **2 août 2026, soirée — l'insécurité entre sur la carte** (manque relevé par
> le commanditaire : « où sont les indicateurs d'insécurité ? »). Bases SSMSI
> de la délinquance enregistrée : 32 indicateurs (16 classes × taux + nombre),
> commune (6 classes phares, dernière année, 10 614 communes diffusées),
> département et région (16 classes, 2016-2025). Le dénominateur dépend de la
> classe — cambriolages pour 1 000 *logements*, le reste pour 1 000 habitants —
> constaté sur les données et recalculé ligne à ligne. Le secret de diffusion
> (~46 % des lignes communales) n'est jamais publié ; couverture par classe
> enregistrée. Trois défauts attrapés par les contrôles et l'écran au premier
> chargement réel, corrigés le jour même : Paris, Lyon et Marseille comptés
> deux fois (commune + arrondissements) dans la borne départementale, qui les
> écartait de la carte ; bruit d'arrondi d'années non chargées dans le rapport
> d'écartées ; et deux mensonges d'affichage — un repère « Communes de
> France » calculé sur l'ensemble censuré par le secret (médiane 0 ‰ : vraie,
> mais l'étiquette mentait sur le périmètre → plus de repères pour les jeux
> sous secret), et une légende « 0 ‰ – 0 ‰ » répétée quand la moitié des
> communes sont à zéro (quantiles dédupliqués). Vérifié à l'écran : Marseille
> 9,3 ‰ de cambriolages, repère régional médian +134 %, note de légende
> nommant le bon dénominateur.
>
> **2 août 2026, soir — la maille intercommunale.** La carte gagne le niveau
> « Intercommunalités » : 1 255 EPCI dessinés par union exacte de leurs
> communes membres (appartenance API Géo, libellés du référentiel), quatre
> couches dans l'archive PMTiles, cartes et repères publiés sur huit exercices
> (2018-2025, 1 266 EPCI avec données — l'écart, vérifié code par code, est
> exactement les onze établissements publics territoriaux du Grand Paris :
> porteurs de comptes OFGL mais absents de la liste des EPCI à fiscalité
> propre de l'API Géo, leur fiche reste accessible par la recherche, sans
> polygone). Un EPCI n'a pas de parent
> (chevauchement départemental possible) : ses repères se limitent à
> l'ensemble des EPCI de France, sans région fabriquée. Vérifié à l'écran :
> carte peinte, fiche Bordeaux Métropole (dénominateur de l'exercice), clic
> carte, export CSV à 1 266 territoires. Déploiement en deux temps — le
> sélecteur n'a été poussé qu'avec le garde-fou « couche non chargée » actif
> pendant la régénération des tuiles, et l'état s'est réparé seul à la
> publication.
>
> **Séries dans le temps** (01/08/2026, hors backlog initial). La fiche affichait
> « +18 % depuis 2016 » sans vérifier que le territoire avait la même surface en
> 2016 — une série est une comparaison d'un territoire avec lui-même, et la règle
> du périmètre s'y applique. Les 4 882 mouvements de `geo.geography_history`
> étaient chargés mais jamais publiés : fusions et scissions accompagnent
> désormais chaque fiche, l'évolution chiffrée est bornée au dernier périmètre
> constant, et la courbe marque la rupture en toutes lettres.
>
> **Sauvegarde vérifiée** (conséquence de D6, pas de PITR sur le plan gratuit) :
> faite le 01/08/2026. Hebdomadaire, elle restaure chaque dump dans une base
> jetable et compare table par table avant de le déposer — un fichier qui ne se
> restaure pas fait échouer le run au lieu de passer pour une sauvegarde.
> Première exécution réussie : 9,9 Mo, 1 067 371 observations restaurées et
> recomptées à l'identique. Trois échecs ont précédé, tous du même genre — le
> workflow *supposait* l'environnement au lieu de le lire : version de PostgreSQL
> (Supabase est en 17, pas 16), schéma des extensions (`extensions`, pas
> `public`), et une attente qui ne bouclait pas. Les trois lisent désormais la
> source.
>
> **T-16 (domaines sociaux et démographiques)** : entamé. Chargés le
> 31/07/2026 — dotations de l'État aux communes (34 875 communes, contrôlées
> contre le prélèvement sur recettes de l'État), niveau de vie médian
> (30 793 communes, 88,3 %), taux de pauvreté (2 482 communes, 7,1 % — l'INSEE
> ne le diffuse qu'au-dessus d'un seuil de taille, et la couverture réelle est
> enregistrée avec le run), population municipale sur deux millésimes espacés
> de dix ans. Reste : chômage localisé, entreprises, éducation, santé.
>
> **Deux bugs d'affichage corrigés au passage**, tous deux de la même famille —
> une liste écrite en dur qui contredit la donnée publiée. Les niveaux
> géographiques d'un indicateur étaient écrasés par le dernier chargement
> partiel, ce qui vidait le site dès qu'on choisissait « Départements » ; ils
> sont désormais relus depuis les observations à chaque publication. Et un
> thème absent d'une table du site n'est plus écarté du sélecteur.
>
> Reste côté propriétaire : une clé INSEE pour la partie Sirene de T-08, et
> l'arbitrage D6bis sur le volume de la base.
>
> **Prochaine étape** : la ventilation par mission (fin de T-14), puis les
> revenus et la pauvreté communaux.

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
| T-14 | Ingestion État : situation mensuelle budgétaire (nature) **faite**, PLF/LFI par mission (destination) à faire → `fin.public_budgets/lines/executions` | E5 | P0 | L | T-07 | pont voté/exécuté reproduit les soldes publiés à l'euro ; identité du solde vérifiée sur chaque exercice |
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
