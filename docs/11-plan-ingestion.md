# 11 — Plan d'ingestion : ce qui reste à charger, dans quel ordre

> **État au 3 août 2026.** Ce document existe parce qu'une intention n'est pas
> un plan. Il liste ce qui est **disponible et pas encore chargé**, avec le
> volume que ça coûte et l'ordre dans lequel ça entre. Il est tenu à jour :
> une ligne passe en « chargé » quand son connecteur tourne en production.
>
> **Bloquant en cours (D6quater)** : la base Supabase refuse les connexions
> depuis le 2 août au soir. Aucune ingestion n'est possible avant sa
> réactivation par le propriétaire. Tout ce qui suit est prêt à partir, dans
> cet ordre, dès que l'écriture revient.

## La règle qui gouverne ce plan

L'INSEE publie 144 jeux dans son API Melodi. **On ne peut pas tout charger, et
il ne faut pas.** Les tableaux croisés détaillés du recensement pèsent des
dizaines de millions d'observations chacun :

| Jeu | Observations |
|---|---|
| `DS_RP_TD_MIGRES_PRINC` (migrations × âge × nationalité) | 33 081 048 |
| `DS_RP_TD_LOGEMENT_CARACT_PRINC` | 28 904 148 |
| `DS_RP_TD_POPULATION_AGEHARSEX_PRINC` | 27 567 540 |
| `DS_RP_TD_EDUCATION_PRINC` | 26 314 470 |

Un seul de ces jeux dépasse à lui seul la capacité de la base entière. La règle
est donc :

> **D'un jeu, on charge les quelques indicateurs agrégés à la maille du
> territoire — jamais les croisements détaillés.** « Nombre de décès par
> commune et par an » : 35 000 lignes par millésime. « Décès par commune × âge
> × sexe × mois » : plusieurs millions. Le premier répond à une question, le
> second remplit un disque.

Les croisements détaillés restent accessibles chez le producteur ; le site
donne le lien plutôt que la copie. Ce qui n'est pas cartographiable (séries
nationales, études) alimente l'onglet **Statistiques et études**, pas la carte.

## Ordre d'entrée

Chaque ligne = un connecteur, un lot d'indicateurs, un volume estimé
(35 000 communes × 1 millésime ≈ 35 000 lignes ≈ 4 Mo index compris).

### P0 — dès le rétablissement de la base

| # | Jeu | Ce qu'on en tire | Maille | Volume estimé |
|---|---|---|---|---|
| 1 | `DS_ETAT_CIVIL_DECES_COMMUNES` | décès domiciliés par an | commune | ~4 Mo/millésime |
| 2 | `DS_RP_POPULATION_COMP` | évolution et structure de la population (indicateurs principaux) | commune | ~12 Mo |
| 3 | `DS_RP_LOGEMENT_PRINC` | logements, résidences principales, vacance | commune | ~12 Mo |
| 4 | `DS_RP_FAMILLE_COMP` | composition des familles | commune | ~8 Mo |
| 5 | `DS_BPE` | équipements : commerces, sport, santé, services | commune | ~12 Mo |
| 6 | `DS_SIDE_CREA_ENT_COM` | créations d'entreprises | commune | ~4 Mo |
| 7 | `DS_MAR_PACS_DIV_SERIES` | mariages, PACS, divorces | national/région | < 1 Mo |

### P1 — après mesure du volume réel

| # | Jeu | Ce qu'on en tire | Maille |
|---|---|---|---|
| 8 | `DS_FLORES_A5` | établissements et effectifs salariés par grand secteur | commune |
| 9 | `DS_TOUR_CAP` | capacités d'hébergement touristique | commune |
| 10 | `DS_RP_EMPLOI_LR_PRINC` | activité, chômage au lieu de résidence | commune |
| 11 | `DS_RP_TD_DIPLOMES_PRINC` (agrégé) | part des diplômés du supérieur | commune |
| 12 | DVF (data.gouv) | prix des logements vendus | commune |
| 13 | RPLS (SDES) | logement social | commune |
| 14 | Élections (data.gouv) | résultats par commune | commune |

### P2 — onglet « Statistiques et études », pas la carte

`DD_CNA_APU` (comptes des administrations publiques), `DS_IPC_PRINC` (indice
des prix), `DD_CNA_CONSO_MENAGES_PRODUITS`, `DS_ICA` (activité et chiffre
d'affaires), `DS_PRENOM` — séries nationales ou thématiques : elles éclairent,
elles ne se cartographient pas à la commune.

## Ce que chaque entrée doit porter avant d'être chargée

La discipline des connecteurs déjà en place s'applique sans exception :

1. **sonder la source avant d'écrire le code** — dimensions réelles, unités,
   dénominateurs, valeurs de facettes ;
2. **fiche publique ≤ 50 mots** (contrainte vérifiée par le schéma) et fiche
   technique qui nomme le périmètre ;
3. **un contrôle bloquant** propre au jeu (identité comptable, somme des
   parties, cohérence avec un total publié) ;
4. **tests hors réseau** sur fixture réelle + test `declarer()` contre la base ;
5. **garde-fou de volume** mesuré avant écriture (`limites.py`) ;
6. **rechargements par l'archive des révisions**, jamais par écrasement muet.

## Volume : l'arbitrage à tenir

P0 complet ≈ **50 à 60 Mo**. La base était à ~470 Mo avant l'incident, plafond
470 Mo (D6quater, plan gratuit à 500 Mo réels). **P0 ne rentre pas sans
arbitrage** : soit le plan Supabase passe réellement à 8 Go (Pro), soit on
applique une rétention plus stricte sur les séries communales existantes.

C'est une décision du propriétaire, pas un détail technique — elle est posée
en D6quater (`docs/09`) et ce plan attend sa réponse.
