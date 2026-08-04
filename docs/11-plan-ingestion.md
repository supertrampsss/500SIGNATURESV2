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

### P0 bis — combler les indicateurs sans comparaison

Un audit du 3 août (fiche commune et fiche nationale, données du 2 août) donne
**26 indicateurs comparés sur 28 à la commune, 30 sur 41 au national**. Les
manques restants, et ce qu'ils demandent :

| Indicateurs | Manque | Ce qu'il faut charger |
|---|---|---|
| Écoles ; Collèges et lycées | aucun repère : l'annuaire MENJ n'est chargé qu'à la commune | le même jeu aux mailles département et région, pour comparer les densités |
| Soldes budgétaires, prélèvements sur recettes, remboursements | pas de part d'un total : un solde n'est la part de rien, et l'imputation des PSR demande une convention comptable | rien — l'absence est la bonne réponse |
| Dette publique en % du PIB (INSEE) | pas de repère européen au même millésime | rien : `eurostat_dette_pib`, dans le même onglet, porte la comparaison à définition et période homogènes |

Les quinze lignes du budget de l'État et les six de la dette portent désormais
leur **part dans leur propre total** — vérifiée contre les chiffres publiés :
les quatre composantes de la dette somment au total à 0,003 % près, recettes
fiscales plus non fiscales font exactement les recettes nettes.

**L'OFGL publie 56 agrégats, nous en chargions 5.** Vérifié le 4 août contre
les facettes de l'API (`ofgl-base-communes-consolidee`, facette `agregat`) :
« Frais de personnel », « Charges financières », « Épargne nette », « Annuité de
la dette », « Dépenses d'équipement », « Impôts locaux », « Fiscalité
reversée »… tous publiés dans le même fichier, au même format, sans surcoût
d'extraction. Le connecteur les filtrait simplement hors de sa requête. C'est ce
qui rendait impossible la question la plus posée sur les finances locales — la
part des salaires dans le budget de fonctionnement.

Le choix des agrégats n'est plus un filtre dans le code. Les **72** sont listés
dans `infra/supabase/seed/ofgl_agregats.csv`, chacun avec sa définition et sa
formule comptable publiées par l'OFGL (jeux `methodologie-ofgl-definitions-…` et
`methodologie-ofgl-formules-…`), le nombre de lignes qu'il coûte, et une colonne
`charge` à oui/non. Ajouter un agrégat, c'est changer un mot dans ce fichier ; ce
qui est écarté reste visible à côté de ce qui ne l'est pas.

Mesuré le 4 août : **un agrégat = 279 865 lignes communales, 21 Mo de CSV** sur
2018-2025.

| | agrégats | lignes |
|---|---:|---:|
| **Retenus (décision du 4 août)** | **72** | **14 216 512** |
| Chargés à ce jour | 5 | 1 399 325 |

Les 72 sont marqués « oui ». Le chargement multiplie par six l'empreinte OFGL,
sur une base qui occupe déjà 390 des 500 Mo du plan gratuit : il suppose donc un
plan payant, et le plafond de `plateforme.limites` devra être relevé en même
temps. Le garde-fou refuse avant écriture tant que ce n'est pas fait — c'est
voulu : mieux vaut un run qui s'arrête qu'une base saturée en lecture seule.

Trois agrégats — crédits de trésorerie, fonds de roulement, produit des cessions
d'immobilisations — sont publiés par l'OFGL **sans commentaire**. Leur fiche est
écrite ici, à partir de la formule comptable que l'OFGL publie bien : ce ne sont
pas des suppositions, mais ce n'est pas sa documentation non plus, et la fiche
technique le dit en toutes lettres. Tout autre agrégat sans définition arrête le
chargement (`DefinitionManquante`) au lieu d'être publié muet.

**Les classes SSMSI n'ont pas toutes la même unité de compte.** Nos définitions
publiées le disent en toutes lettres pour certaines — « en victimes enregistrées »
pour les violences, « personnes mises en cause » pour les stupéfiants — mais la
définition technique se contente de « unité de compte de la source » sans la
nommer. C'est une information indispensable pour savoir ce qui s'additionne :
un cambriolage est un fait, une violence est une victime, un stupéfiant est un
auteur présumé. À faire : publier l'unité de compte de chaque classe dans la
fiche de l'indicateur, plutôt que de la laisser deviner au lecteur du site — et
à celui qui écrit ses agrégats.

**La sécurité n'a aucun repère dans `references.json`.** Vérifié le 4 août :
sur les 32 indicateurs SSMSI, zéro médiane publiée, à aucune maille — comme
pour `education` (0 sur 2), `entreprises` (0 sur 1), `population` (0 sur 2) et
`revenus` (0 sur 2). La sécurité s'en sortait jusqu'ici par les *comparateurs*
— la valeur publiée du département et de la région — mais ce détour s'arrête à
la région, dont le seul parent est la France, où le SSMSI ne publie rien. Une
fiche régionale ne peut donc comparer sa délinquance à rien, et l'ouverture y
écrit « Aucun repère publié à cette maille » faute de mieux. Ce qu'il faut :
calculer les médianes SSMSI par maille comme pour l'OFGL, au moins commune /
département / région, et les ajouter à l'export des repères.

**Les intercommunalités n'ont pas de maille de rattachement publiée.** Leur
enregistrement sort avec `parent: null` et `region: null` — vérifié le 4 août
sur Bordeaux Métropole. Conséquences visibles : la fiche d'un EPCI ne se situe
dans aucun département ni aucune région, et ses mesures ne se comparent qu'à la
médiane nationale, là où une commune se compare aussi à son département et à sa
région. Le rattachement existe dans la correspondance EPCI–communes déjà
ingérée ; il reste à le porter dans l'export des territoires. Un EPCI peut
chevaucher deux départements : le rattachement doit alors suivre la règle du
producteur (département du siège), pas une majorité de communes calculée par
nous. **Rien ne doit être déduit du numéro SIREN** — sa structure n'est pas une
garantie de code départemental.

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
