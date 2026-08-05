# 11 — Plan d'ingestion : ce qui reste à charger, dans quel ordre

> **État au 3 août 2026.** Ce document existe parce qu'une intention n'est pas
> un plan. Il liste ce qui est **disponible et pas encore chargé**, avec le
> volume que ça coûte et l'ordre dans lequel ça entre. Il est tenu à jour :
> une ligne passe en « chargé » quand son connecteur tourne en production.
>
> **Bloquant levé le 04/08/2026 (D6quinquies)** : l'incident D6quater — base
> Supabase endormie, trente-six heures de données figées, réactivation possible
> par le seul propriétaire — est clos non par une réactivation mais par une
> sortie. L'entrepôt est désormais un fichier DuckDB versionné dans le bucket R2.
> Il n'y a plus de base à réveiller, plus de plafond de 500 Mo à arbitrer, et
> donc plus de rétention subie : tout ce qui suit peut partir.

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
| ~~1~~ | ~~`DS_ETAT_CIVIL_DECES_COMMUNES`~~ | **chargé le 4 août** — 652 211 observations, 2008-2025, quatre mailles | commune | 3 Mo |
| 2 | `DS_RP_POPULATION_COMP` | évolution et structure de la population (indicateurs principaux) | commune | ~12 Mo |
| 3 | `DS_RP_LOGEMENT_PRINC` | logements, résidences principales, vacance | commune | ~12 Mo |
| 4 | `DS_RP_FAMILLE_COMP` | composition des familles | commune | ~8 Mo |
| ~~5~~ | ~~`DS_BPE`~~ | **chargé le 4 août** — 191 209 observations, sept domaines et leur total | commune | 14 Mo |
| ~~6~~ | ~~`DS_SIDE_CREA_ENT_COM`~~ | **chargé le 5 août** — 438 019 observations, 2012-2025, quatre mailles | commune | 12 Mo |
| 7 | `DS_MAR_PACS_DIV_SERIES` | mariages, PACS, divorces | national/région | < 1 Mo |

**Décès domiciliés — chargé le 4 août.** Deux pièges, tous deux tranchés à la
source plutôt qu'au jugé. L'INSEE publie les décès *survenus* et les décès
*domiciliés* ; les premiers font exploser le chiffre des communes qui ont un
hôpital et ne disent rien du territoire. C'est le `scopeNote` du jeu qui
tranche : « les totaux France diffusés ici correspondent aux décès enregistrés
en France et domiciliés en France ». Et deux statuts de la source, `K` et `W`,
marquent une commune déléguée dont les décès sont comptés dans sa commune
nouvelle. Les écarter, comme un premier jet le faisait, faisait tomber la somme
des communes sous le total France de exactement ce qu'ils portaient — 140 décès
en 2017, 98 en 2023. Ils sont donc chargés, et signalés : leur valeur couvre
plus de territoire que la commune seule, alors que sa population ne couvre
qu'elle.

Le contrôle bloquant du connecteur est cette identité : somme des communes égale
total France, exercice par exercice. Vérifiée au chargement réel sur les douze
exercices que la source totalise, à l'unité près.

**Équipements et services — chargé le 4 août.** La base descend à deux cent
trente-six types, de l'orthophoniste au terrain de pétanque : 1,3 million de
lignes communales. Seuls les **sept domaines et leur total** sont chargés, soit
191 209 observations — la règle du plan appliquée à la lettre, le détail restant
chez le producteur.

Le contrôle bloquant est l'identité de la nomenclature : la somme des sept
domaines égale le total publié, territoire par territoire. Vérifiée sur Bordeaux
au chargement — 6 460 + 2 356 + 452 + 4 740 + 316 + 248 + 285 = 14 857. C'est ce
contrôle qui attraperait le piège d'une hiérarchie servie à plat : lire le détail
*et* le total compte chaque équipement deux fois.

Trois réserves sont écrites dans les fiches, parce qu'elles changent la lecture.
Un équipement compte pour un, quelle que soit sa taille : un hypermarché vaut une
supérette, un cabinet de groupe vaut un praticien seul — c'est un dénombrement,
pas une capacité. Le domaine « Services pour les particuliers » mêle la poste et
le coiffeur : son libellé est celui du producteur, le renommer « services
publics » ferait dire à la donnée autre chose. Et son domaine « Enseignement »
n'est pas l'annuaire du ministère, déjà chargé : deux périmètres différents, deux
indicateurs publiés, aucun agrégé à l'autre.

**Créations d'entreprises — chargé le 5 août.** Le pendant en flux du stock
d'établissements déjà publié, et il ne se lit pas de la même façon. Le stock
compte des **unités locales** là où elles travaillent ; ce flux compte des
**unités légales** là où elles sont immatriculées, c'est-à-dire au siège. Une
société de domiciliation suffit à faire d'une commune un haut lieu de la
création : Paris pèse 100 973 des 1 111 238 immatriculations de France en 2024,
neuf pour cent à elle seule. La fiche publique le dit en première phrase.

Le jeu croise secteur A10 et forme légale, et sert le détail *avec* les totaux
sur la même dimension : ne charger que le croisement `_T`/`_T` n'est pas une
simplification mais la condition pour ne pas compter chaque immatriculation dix
fois. Le champ exclut l'agriculture — c'est la source qui le dit, et le total en
hérite. Onze découpages sont servis ; quatre sont chargés, et les arrondissements
municipaux de Paris, Lyon et Marseille sont écartés parce qu'ils sont déjà
comptés dans leur commune.

Le contrôle bloquant reprend celui des décès : somme des communes égale total
France entière, exercice par exercice. Vérifié sur les **quatorze** exercices,
à l'unité près — dont 1 111 238 en 2024 et 1 165 795 en 2025. Le total à retenir
est `F` (France entière) et non `FM` (métropolitaine), plus bas de trente mille
créations, puisque les communes chargées incluent les départements d'outre-mer.
Comme pour les décès, le statut `W` marque une commune nouvelle qui reçoit les
immatriculations d'une déléguée : chargée et signalée, pas écartée.

Deux réserves sont écrites dans la fiche technique parce qu'elles interdisent
une lecture qu'on ferait spontanément. Les entrepreneurs individuels font 74,4 %
des immatriculations de 2024, mais la forme légale ne sépare pas le
micro-entrepreneur du reste : ce jeu ne permet pas de dire ce que le régime doit
à lui-même dans le doublement de la série entre 2012 et 2025. Et au communal,
l'évolution d'une année sur l'autre est très dispersée — mesurée sur les 291
communes d'au moins 500 créations en 2023, elle va de −34 % à +42 % en 2024
autour d'une médiane de +4 % : un siège qui déménage suffit à faire bouger le
chiffre.

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
dans `infra/seed/ofgl_agregats.csv`, chacun avec sa définition et sa
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

Les 72 sont marqués « oui ». Le chargement multipliait par six l'empreinte OFGL,
ce qui ne tenait pas dans les 500 Mo du plan gratuit — c'est l'une des raisons
qui ont conduit à sortir de Supabase (D6quinquies). Sur un fichier DuckDB dans un
bucket objet, quatorze millions de lignes tiennent pour quelques centimes par
mois : le garde-fou de `plateforme.limites` est passé à 8 Go et ne sert plus
qu'à repérer un connecteur en défaut.

**Ce que la publication coûte à cette échelle**, mesuré le 4 août sur un
entrepôt fabriqué de 20 505 992 observations — 35 000 communes × 73 indicateurs
× 8 exercices, plus les départements et les régions :

| Étape | Durée |
|---|---:|
| Écriture des 20,5 M d'observations | 148 s |
| Fichiers de carte (trois mailles) | 159 s |
| Repères (72 indicateurs) | 226 s |
| Groupes de comparaison | 6 s |

Environ **six minutes**, contre un délai maximum de 330 minutes par run. La
crainte que les repères — une requête par indicateur, par maille et par période
— ne tiennent pas à cette échelle était donc infondée, et il valait mieux la
mesurer que l'optimiser à l'aveugle.

Trois agrégats — crédits de trésorerie, fonds de roulement, produit des cessions
d'immobilisations — sont publiés par l'OFGL **sans commentaire**. Leur fiche est
écrite ici, à partir de la formule comptable que l'OFGL publie bien : ce ne sont
pas des suppositions, mais ce n'est pas sa documentation non plus, et la fiche
technique le dit en toutes lettres. Tout autre agrégat sans définition arrête le
chargement (`DefinitionManquante`) au lieu d'être publié muet.

**Les classes SSMSI n'ont pas toutes la même unité de compte — réglé le
4 août.** La définition technique se contentait de « unité de compte de la
source » sans la nommer. Il n'y avait pourtant rien à deviner : le SSMSI publie
une colonne `unite_de_compte` dans ses trois bases, et elle dit quatre choses
différentes — *infraction* pour un cambriolage ou une dégradation, *victime*
pour une violence, *véhicule* pour un vol de voiture, *mis en cause* pour un
fait de stupéfiants. Elle est désormais reprise telle quelle dans la fiche,
publiée dans le catalogue, et un changement chez le producteur arrête le
chargement.

Cela a corrigé un agrégat faux. « Atteintes aux biens » additionnait les
cambriolages et les vols de véhicules en affirmant qu'ils étaient comptés de la
même façon. À la maille communale, une seule des six classes publiées est
comptée en infractions : il n'y a donc pas d'agrégat homogène à cette maille, et
la version communale a été retirée. Il en reste un au département et à la
région, cambriolages + dégradations. La règle « une seule unité de compte par
somme » est maintenant tenue par le code, pas par un commentaire.

**La sécurité n'avait aucun repère dans `references.json` — réglé le 4 août.**
Le refus se posait par jeu, alors qu'il ne vaut que par maille. La censure du
SSMSI ne porte que sur la base communale — c'est là, et là seulement, que le
dictionnaire des variables déclare l'indicatrice `est_diffuse` — et elle sélectionne
sur la valeur (moins de cinq faits sur trois ans), ce qui tire une médiane
communale vers le haut d'un montant inconnu. Au département, la source publie
101 départements sur 101 ; à la région, 18 sur 18. Le refus s'applique donc
maintenant au couple (jeu, maille) : commune pour le SSMSI, commune et
intercommunalité pour Filosofi.

La censure est mesurée, pas invoquée. Part des communes dont la valeur est
diffusée par le SSMSI, relevée le 4 août sur la base complète : cambriolages de
logement **30,6 %**, escroqueries 30,2 %, destructions et dégradations 32,1 %,
vols sans violence 32,7 %, violences intrafamiliales 34,8 %, violences
sexuelles 40,7 %, vols de véhicule 45,6 %, violences hors famille 48,6 %, vols
dans les véhicules 51,4 %, vols d'accessoires 52,5 %, usage de stupéfiants
55,6 %, trafic 79,5 %, vols violents 85,1 %, vols avec armes 91,0 %. Le
critère — moins de cinq faits sur trois années — porte sur la valeur
elle-même : ce sont les basses valeurs qui manquent, et une médiane des
communes visibles est tirée vers le haut d'un montant inconnu.

Vérifié après correction, sur un entrepôt réel : 16 indicateurs SSMSI portent
désormais un repère, au département (n = 101) et à la région (n = 18), aucun à
la commune. Les 16 autres — les comptages en nombre — n'en ont pas, pour la
raison qui suit.

Restent sans repère `education` (0 sur 2), `entreprises` (0 sur 1) et
`population` (0 sur 2) — **et c'est la bonne réponse** : ce sont des comptages
sommables, qu'une médiane brute compare à des territoires de tailles sans
rapport. Ce qui leur manque n'est pas une médiane mais un taux : « écoles pour
10 000 habitants » est un indicateur à écrire, pas un repère à calculer.

**Les intercommunalités n'avaient pas de maille de rattachement — réglé le
4 août.** L'API Géo publie, pour chaque EPCI, la liste des départements et des
régions qu'il touche : c'est le producteur qui la dresse, et **rien n'est déduit
du numéro SIREN**. 1 166 EPCI sur 1 255 ne touchent qu'un département et le
prennent pour parent. Les 89 autres n'en ont pas — aucune majorité de communes
n'est calculée par nous —, mais 63 d'entre eux n'appartiennent qu'à une seule
région, qui est publiée ; les 26 restants n'ont ni parent ni région, et la liste
de leurs départements reste visible dans leurs drapeaux. Une fiche d'EPCI se
compare donc à son département et à sa région, comme une commune.

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

## Volume : l'arbitrage est clos

P0 complet ≈ **50 à 60 Mo**. La question ne se pose plus : l'entrepôt n'est plus
une base hébergée avec un plafond de 500 Mo mais un fichier DuckDB versionné
dans le bucket R2 (D6quinquies). Quatorze millions de lignes OFGL y tiennent
pour quelques centimes par mois. Le garde-fou de `plateforme.limites` est passé
à 8 Go et ne sert plus qu'à repérer un connecteur en défaut.
