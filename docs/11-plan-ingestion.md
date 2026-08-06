# 11 — Plan d'ingestion : ce qui reste à charger, dans quel ordre

> **État au 6 août 2026 — le plan est traité de bout en bout.** Ce document
> existe parce qu'une intention n'est pas un plan. Il listait ce qui était
> disponible et pas encore chargé, avec le volume que ça coûtait et l'ordre dans
> lequel ça entrait ; une ligne passe en « chargé » quand son connecteur tourne
> en production.
>
> **Les sept lignes P0 sont chargées.** **Les lignes P1 accessibles aussi** — 8
> (secteurs d'activité), 9 (hébergement touristique), 10 (activité et diplômes),
> 13 (logement social), 14 (participation électorale) ; la 11 était couverte par
> la 10, et la **12 (DVF) est écartée à la demande du propriétaire du projet**.
> **Les entrées P2 sont traitées une par une** : indice des prix, solde des
> administrations publiques, consommation des ménages et prénoms sont chargés ;
> les indices de chiffre d'affaires sont écartés, sur la recommandation de leur
> propre producteur.
>
> Ce qui n'est pas chargé l'est **explicitement**, avec sa raison écrite : c'est
> vrai des jeux entiers comme des agrégats refusés à l'intérieur d'un jeu chargé
> — recettes et dépenses totales des APU, croisements détaillés du recensement,
> nuances politiques des élections. Une absence sans motif serait indiscernable
> d'un oubli.
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

> **Les sept lignes sont chargées au 5 août 2026.** Ce qui a coûté le plus cher
> n'est pas le volume : c'est de trouver, jeu par jeu, la définition qui change
> la lecture — domicilié contre enregistré, unité légale contre unité locale,
> famille contre ménage, quinze ans et plus contre population. Chaque connecteur
> porte au moins un contrôle bloquant tiré d'une identité de la source, parce
> qu'un croisement lu de travers ne fait rien planter : il publie un chiffre
> faux.

| # | Jeu | Ce qu'on en tire | Maille | Volume estimé |
|---|---|---|---|---|
| ~~1~~ | ~~`DS_ETAT_CIVIL_DECES_COMMUNES`~~ | **chargé le 4 août** — 652 211 observations, 2008-2025, quatre mailles | commune | 3 Mo |
| ~~2~~ | ~~`DS_RP_POPULATION_COMP`~~ | **chargé le 5 août** — 1 303 909 observations, douze indicateurs, 2012/2017/2023 | commune | 38 Mo |
| ~~3~~ | ~~`DS_RP_LOGEMENT_PRINC`~~ | **chargé le 5 août** — 869 272 observations, huit indicateurs, 2012/2017/2023 | commune | 25 Mo |
| ~~4~~ | ~~`DS_RP_FAMILLE_COMP`~~ | **chargé le 5 août** — 470 859 observations, cinq types, 2012/2017/2023 | commune | 14 Mo |
| ~~5~~ | ~~`DS_BPE`~~ | **chargé le 4 août** — 191 209 observations, sept domaines et leur total | commune | 14 Mo |
| ~~6~~ | ~~`DS_SIDE_CREA_ENT_COM`~~ | **chargé le 5 août** — 438 019 observations, 2012-2025, quatre mailles | commune | 12 Mo |
| ~~7~~ | ~~`DS_MAR_PACS_DIV_SERIES`~~ | **chargé le 5 août** — 11 384 observations, cinq séries, 1975-2025 | département/région/France | < 1 Mo |

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

**Logements et vacance — chargé le 5 août.** Le jeu le plus piégeux des trois.
Il croise neuf dimensions et sert les agrégats *avec* leurs composantes sur les
mêmes lignes : un filtre qui lâche ne fait rien planter, il compte le nombre de
pièces comme des logements ou les trois-pièces comme le parc entier. Quatre
mesures cohabitent au même format — logements, nombre de pièces, durée de
séjour, population des ménages — et sept dimensions de détail ventilent le même
parc. Seul le croisement où toutes valent « total » est chargé.

Trois identités de la source servent de contrôle bloquant, et elles se referment
sur les 108 659 couples territoire-millésime à 1 × 10⁻⁵ près : résidences
principales + secondaires + vacants = parc ; propriétaires + locataires + logés
gratuitement = résidences principales ; parc privé + parc social + meublé =
locataires. La première attrape un croisement lu de travers, les deux autres un
statut d'occupation filtré à côté — c'est elle qui garantit que le parc social
affiché est bien une part des locataires et pas un total voisin.

Quatre réserves entrent dans les fiches. Le **vacant du recensement** — logement
inoccupé, proposé à la vente ou à la location, en attente d'occupation ou gardé
vide — n'est pas le comptage fiscal de la DGFiP, qui part des locaux non soumis
à taxe d'habitation et ne trouve ni les mêmes logements ni le même total ; l'un
pris pour l'autre fait dire au territoire l'inverse de ce qu'il vit. Le **parc
social du recensement** est déclaré par les ménages, quand le répertoire des
bailleurs sociaux (RPLS) part des logements et fait seul foi pour la loi SRU. Le
**millésime n'est pas une photographie** : il résulte de cinq années d'enquêtes
centrées sur lui, et c'est de là que viennent les décimales — 148 377,4
résidences principales à Bordeaux. Et le champ est **la France hors Mayotte**,
cent départements : les fiches mahoraises n'auront pas de logements, et c'est la
source qui le décide.

Vérifié au chargement : Bordeaux 2023, 171 777 logements, 6,7 % de vacance,
33,0 % de propriétaires occupants, 13,9 % de parc social.

Un ajout envisagé ne l'a pas été, après vérification : le taux de cambriolages
pour mille logements **existe déjà** sur le site — le SSMSI le publie lui-même
avec ce dénominateur, sur dix millésimes, et il est chargé depuis le 4 août. Le
recalculer à partir du parc du recensement l'aurait remplacé par une série de
deux points, 2017 et 2023, puisque les millésimes doivent se correspondre. Le
dénominateur du producteur reste le bon.

**Familles — chargé le 5 août.** Même forme que les logements, deux mots piégés
en plus. Une **famille n'est pas un ménage** : c'est un couple avec ou sans
enfant, ou un parent seul avec au moins un enfant, sous le même toit. Une
personne qui vit seule n'en forme pas une — 18,7 millions de familles en 2023
pour 31,2 millions de résidences principales, et rapporter les unes aux autres
donne un rapport, pas une part. Et un **« enfant » n'a pas d'âge** : est enfant
d'une famille la personne qui vit chez un parent sans conjoint ni enfant à elle,
fût-elle quadragénaire. La ventilation par nombre d'enfants, elle, s'arrête à
vingt-quatre ans ; elle n'est pas chargée, et les deux comptages ne se recoupent
pas.

Trois identités bloquantes, refermées sur les 108 659 couples
territoire-millésime à 1 × 10⁻⁵ près : monoparentales + couples sans enfant +
couples avec enfant = total ; pères seuls + mères seules = monoparentales ;
recomposées + traditionnelles = couples avec enfant. La troisième ne porte que
sur 2023 — la source ne publie la distinction que sur le dernier millésime — et
le contrôle saute les millésimes où la composante manque plutôt que de crier sur
une donnée qui n'existe pas. La fiche des familles recomposées le dit, faute de
quoi l'absence de série passerait pour une disparition.

Vérifié au chargement : Bordeaux 2023, 60 949 familles, dont 18,6 % de
monoparentales.

**Catégories sociales et tranches d'âge — chargé le 5 août.** Le jeu s'appelle
« évolution et structure de la population », et il ne contient pas la
population : la catégorie socioprofessionnelle n'est définie qu'à partir de
quinze ans, et **aucun total tous âges n'est publié**. 56,5 millions de personnes
en 2023 quand la population municipale en compte 68. L'indicateur porte donc son
âge dans son nom, et il n'est pas le dénominateur des ratios du site — le prendre
pour tel les décalerait de dix-sept pour cent.

Deux autres pièges, écrits dans les fiches. **Retraité est une catégorie, pas un
âge** : la nomenclature range les retraités et les « autres inactifs » — étudiants
compris — à côté des six catégories d'actifs, et le total moins les retraités ne
donne donc pas les actifs. À Bordeaux, les 46 508 « autres inactifs » pèsent plus
que les 41 355 retraités, et ce sont d'abord des étudiants. Et **il n'y a pas de
catégorie 8** dans ce jeu : la huitième de la nomenclature complète y est fondue
dans les autres inactifs, si bien qu'une somme écrite de un à huit manquerait son
total sans prévenir.

Trois identités bloquantes, refermées sur les 108 659 couples
territoire-millésime : les huit catégories font le total, les trois tranches
d'âge font les quinze ans et plus, hommes plus femmes font le total.

**Une mesure a changé le connecteur.** Le jeu croise trois cent vingt-quatre
combinaisons ; tout lire faisait 11,7 millions de dictionnaires en mémoire et
deux minutes trente de lecture — de quoi tuer un runner qui tient déjà
l'entrepôt ouvert. Quatorze croisements suffisent : les douze publiés et les deux
sexes qui ferment la troisième identité. 1,5 million de lignes, vingt-huit
secondes, contrôles identiques. Un test vérifie que ce filtre couvre bien toutes
les composantes des identités — un croisement oublié ferait passer un contrôle
qui ne contrôle rien.

Les huit catégories entrent dans un thème « Professions et catégories sociales »
distinct de « Population » : « combien sommes-nous » et « qui sommes-nous » ne
sont pas la même question, et les mélanger ferait un thème de quinze lignes où
l'on en cherche une.

**Mariages, pacs et divorces — chargé le 5 août.** Le dernier P0, et le plus
petit : 11 384 observations pour cinq séries qui remontent à 1975 par
département. Trois filtres décident de tout, et chacun laisserait passer un
chiffre faux. Les mariages **domiciliés** sont chargés, pas les **enregistrés** —
le piège des décès à l'identique : en Gironde en 2016, la source publie 5 709
mariages domiciliés et 5 587 enregistrés, et seul le premier décrit le
territoire. Les séries **mensuelles** nationales cohabitent avec les annuelles
dans le même fichier ; chargées ensemble, les douze mois d'une année s'ajouteraient
à cette année. Et la source publie **trois France** — entière, métropolitaine,
métropole hors Île-de-France — dont deux passeraient pour le chiffre national.

Contrôle bloquant : mariages de sexe opposé + de même sexe = mariages, sur les
1 379 couples territoire-exercice où les trois termes existent, écart nul. Le
contrôle saute les exercices antérieurs à 2013 : avant mai 2013 il n'y a pas de
donnée manquante, il n'y a pas de mariage possible.

Deux séries s'arrêtent, et les fiches le disent plutôt que de laisser un chiffre
de 2016 voisiner un mariage de 2024 sans explication. Les **pacs** s'arrêtent en
2016 au département et à la région ; la France entière va jusqu'à 2024. Les
**divorces** s'arrêtent en 2016 à tous les niveaux. La raison n'est pas dans les
métadonnées de la source, et n'est donc pas inventée ici.

Vérifié au chargement : France 2024, 246 057 mariages dont 6 663 entre personnes
de même sexe, 197 176 pacs, taux de nuptialité de 3,6 ‰.

### P0 bis — combler les indicateurs sans comparaison

Un audit du 3 août (fiche commune et fiche nationale, données du 2 août) donne
**26 indicateurs comparés sur 28 à la commune, 30 sur 41 au national**. Les
manques restants, et ce qu'ils demandent :

| Indicateurs | Manque | Ce qu'il faut charger |
|---|---|---|
| ~~Écoles ; Collèges et lycées~~ | ~~aucun repère : l'annuaire MENJ n'est chargé qu'à la commune~~ | **fait le 6 août** — chargé aux trois mailles depuis les codes que l'annuaire porte lui-même, avec pour contrôle bloquant l'égalité des totaux départemental et régional |
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
`population` (0 sur 2) — **et c'est la bonne réponse pour deux d'entre eux** :
ce sont des comptages sommables, qu'une médiane brute compare à des territoires
de tailles sans rapport. Chacun a d'ailleurs sa contrepartie en taux, et
celle-là porte bien un repère : `insee_taux_nuptialite`, les seize taux du
SSMSI. Un comptage se compare par le groupe de communes semblables, qui le
rapporte aux habitants, pas par une médiane brute.

**Correction du 6 août — `education` n'y était pas pour cette raison-là.** Les
deux indicateurs de l'annuaire n'avaient *ni* repère *ni* groupe, et le motif
n'était pas méthodologique : leur période valait `datetime.now().year`, soit
« 2026 », quand toutes les populations s'arrêtent à 2025. La requête des
quartiles joint la population sur la période ; elle n'en trouvait aucune, le
dénominateur était nul, et la comparaison disparaissait sans un mot. Deux autres
défauts venaient avec : le même instantané rejoué en janvier aurait porté une
autre période et fabriqué deux rentrées identiques, et une valeur qui dépend de
l'heure du runner n'est pas reproductible depuis son instantané. La période sort
désormais de la date de mise à jour que le portail publie (`data_processed`,
archivée avec l'extraction), ramenée à l'année scolaire de sa rentrée.

**Les intercommunalités n'avaient pas de maille de rattachement — réglé le
4 août.** L'API Géo publie, pour chaque EPCI, la liste des départements et des
régions qu'il touche : c'est le producteur qui la dresse, et **rien n'est déduit
du numéro SIREN**. 1 166 EPCI sur 1 255 ne touchent qu'un département et le
prennent pour parent. Les 89 autres n'en ont pas — aucune majorité de communes
n'est calculée par nous —, mais 63 d'entre eux n'appartiennent qu'à une seule
région, qui est publiée ; les 26 restants n'ont ni parent ni région, et la liste
de leurs départements reste visible dans leurs drapeaux. Une fiche d'EPCI se
compare donc à son département et à sa région, comme une commune.

### Groupes de comparaison v2 — fait le 6 août

Les critères passent de trois à cinq, **en cascade**. Le sur-découpage est le
piège du sujet : chaque critère multiplie les strates, et une strate sous le
seuil de vingt disparaît sans un mot — les communes atypiques, celles qu'un
groupe fin sert le mieux, auraient perdu leur repère. La publication calcule
donc trois découpages (cinq critères, trois, deux) et la fiche prend le premier
qui existe pour sa commune.

Mesuré sur la publication du 6 août : **34 534 communes sur 34 875 (99 %)**
obtiennent le découpage fin, taille médiane d'un groupe **111 contre 635**. Les
341 autres retombent sur trois critères. Tignes, jusque-là noyée parmi les
communes rurales, se compare à 151 stations de montagne ; Bordeaux passe de 40
à 25 villes comparables.

Les critères affichés sous les quartiles sont ceux qui ont servi, et non une
liste figée : ils ne sont pas les mêmes d'une commune à l'autre.

Restent inutilisés `qpv` et `tranche_revenu_imposable_par_habitant`. Le premier
est une indicatrice de présence, pas une caractéristique de la commune entière ;
le second mêlerait un critère de résultat aux critères de contexte — comparer
des communes de même revenu pour constater qu'elles ont le même revenu.

### P1 — après mesure du volume réel

| # | Jeu | Ce qu'on en tire | Maille |
|---|---|---|---|
| ~~8~~ | ~~`DS_FLORES_A5`~~ | **chargé le 6 août** — 419 880 observations, douze indicateurs, millésime 2024 | commune |
| ~~9~~ | ~~`DS_TOUR_CAP`~~ | **chargé le 6 août** — 209 850 observations, six indicateurs, au 1er janvier 2026 | commune |
| ~~10~~ | ~~`DS_RP_EMPLOI_LR_PRINC`~~ | **chargé le 5 août** — 724 410 observations, dix indicateurs ; couvre aussi la ligne 11 | commune |
| ~~11~~ | ~~`DS_RP_TD_DIPLOMES_PRINC`~~ | **inutile** : les diplômes sont dans le jeu de la ligne 10, sur la même population | commune |
| 12 | DVF (data.gouv) | prix des logements vendus | commune |
| ~~13~~ | ~~RPLS (SDES)~~ | **chargé le 6 août** — 5 416 826 logements sociaux comptés un par un, trois indicateurs | commune |
| ~~14~~ | ~~Élections (data.gouv)~~ | **chargé le 6 août** — 174 180 observations, cinq indicateurs de **participation** ; les nuances politiques ne sont pas chargées, et le plan dit pourquoi | commune |

**Activité, chômage et diplômes — chargé le 5 août.** Le premier P1, et il
comble le manque le plus visible : le taux de chômage s'arrêtait au département,
il descend maintenant à la commune. Le jeu couvre au passage la ligne 11 du
plan — les diplômes y sont, sur la même population, ce qui épargne un second
téléchargement de 74 Mo.

**Le risque n'était pas de mal lire un fichier, mais de contredire le site.** Le
chômage du recensement est **déclaratif** : est chômeuse la personne qui se
déclare telle. Le taux de chômage localisé déjà publié applique les critères du
Bureau international du travail — sans emploi, disponible, en recherche active —
et donne un chiffre plus bas. Les deux existent, aucun n'est faux, et la fiche de
chacun nomme l'autre. De même, ce jeu apporte une **troisième** population de
référence : les 15-64 ans, à côté de la population municipale et des quinze ans
et plus des catégories sociales. Chacune porte son périmètre dans son nom. Une
mesure au passage : les deux dossiers du recensement ne donnent pas le même total
de quinze ans et plus — 56 529 157 pour les catégories sociales, 56 485 414 ici.
L'un des deux n'est donc pas publié, et c'est le premier qui reste.

Trois identités bloquantes : actifs occupés + chômeurs = actifs et actifs +
inactifs = 15-64 ans, sur les 108 659 couples territoire-millésime ; les sept
niveaux de diplôme = la même population, sur les 36 223 couples de 2023 — la
source ne ventile par diplôme que le dernier millésime.

**Une seule valeur est calculée, et elle est déclarée.** « Enseignement
supérieur » est la somme des trois niveaux que la source publie séparément
(bac+2, bac+3/4, bac+5 et plus) : personne ne les lit un par un, ils portent la
même population et la même unité de compte, et la formule de l'indicateur le dit.
Si l'un des trois manque, la somme n'est pas produite — un sous-comptage
présenté comme une mesure est pire qu'une absence.

Douze croisements lus sur les cent quatre-vingt-dix-sept du jeu : 797 000 lignes
au lieu de 17,9 millions, quarante-trois secondes. Vérifié au chargement :
Bordeaux 2023, 191 928 habitants de 15 à 64 ans, 11,8 % de chômage au sens du
recensement, 58,7 % de diplômés du supérieur.

**Logement social — chargé le 6 août.** Le site publiait déjà un parc social,
celui du recensement, **déclaré par les ménages** : on demande aux habitants
s'ils logent dans un HLM. Le répertoire des bailleurs sociaux part des bailleurs
et compte leurs logements un par un — 5 416 826 — et c'est lui qui fait foi pour
la loi SRU. Les deux chiffres diffèrent franchement pour la même commune la même
année ; les deux sont publiés, et chaque fiche nomme l'autre, faute de quoi une
commune serait dite en règle ou en infraction sur la foi du mauvais comptage.

Les adresses ne sont jamais téléchargées : le fichier décrit chaque logement par
son numéro de voie, son étage et ses coordonnées, sur soixante-treize colonnes,
et l'API du SDES sait n'en servir que quatre. L'instantané archivé n'en porte
aucune — la règle des données agrégées appliquée en amont plutôt qu'après coup.

Les **passoires thermiques** sont publiées en trois indicateurs et non deux : le
parc, les logements étiquetés, et les F ou G. 657 670 logements — douze pour
cent — n'ont aucune étiquette, et un logement sans diagnostic n'est pas un
logement bien classé : le taux se lit donc sur les étiquetés. 119 527 en F et
26 013 en G, soit 3,1 %. « E » n'entre pas dans le compte, le calendrier légal
portant sur G puis F.

**Et c'est ce chargement qui a fait naître `couverture.py`.** Le répertoire code
Paris, Lyon et Marseille par arrondissement : sans rattachement à la commune,
Paris sortait à zéro logement social quand il en compte 250 640. Le contrôle
bloquant du connecteur — totaux départementaux contre totaux régionaux — était
parfaitement vert, parce qu'un contrôle d'identité compare la source à
elle-même et ne peut pas voir un code que le référentiel ignore. Le nouveau
contrôle compare ce qui est **écrit** à ce qui est **lu**, maille par maille, en
entités et non en codes, et refuse sous 95 %. Il s'applique désormais à tout
connecteur qui écarte des territoires inconnus.

**Établissements employeurs et salariés par secteur — chargé le 6 août.** Le
premier jeu du site qui compte l'emploi **là où il est** plutôt que là où
habitent ceux qui l'occupent : 419 880 observations, douze indicateurs,
2 411 570 établissements employeurs et 26 604 745 postes salariés en France
entière. Trois mots devaient être tenus, chacun contredisant un chiffre déjà en
ligne s'il ne l'était pas.

**Employeur n'est pas actif.** Le site publie déjà 6 625 344 établissements
actifs pour 2024 ; ce jeu-ci n'en compte que 2 411 570, parce qu'il retient les
seuls établissements ayant employé quelqu'un dans l'année. Près de deux tiers
des établissements actifs n'emploient personne. Les deux chiffres sont justes et
voisinent sur la même fiche : chacun nomme l'autre. **Un poste n'est pas une
personne** : l'effectif compte les postes présents la dernière semaine de
décembre, une personne qui en occupe deux est comptée deux fois, et un mi-temps
compte pour un — ce n'est ni un équivalent temps plein ni un nombre d'habitants
qui travaillent. **Le lieu de travail n'est pas le domicile** : ces salariés ne
se rapportent pas à la population du territoire, et n'en donnent donc pas un taux
d'emploi ; les actifs du recensement, comptés au domicile, sont publiés à côté.

Deux pièges de lecture, tranchés à la source. Les neuf tranches d'effectifs sont
servies **avec** leur total sur la même dimension : seul le total est lu, les
charger reviendrait à compter chaque établissement deux fois. Et le fichier
publie deux France sous le même identifiant de zonage — entière et
métropolitaine, 2 411 570 contre 2 344 770 : c'est la première qui est le total,
puisque les communes d'outre-mer sont chargées.

Deux contrôles bloquants, plus celui de la couverture. Les cinq secteurs font le
total, pour chaque mesure et chaque territoire : 69 980 vérifications, écart nul.
Et les communes, les départements et les régions font chacun la France entière,
à l'unité près sur les deux mesures — c'est ce contrôle-là qui verrait une maille
décrocher pendant que les deux autres restent justes.

Deux réserves entrent dans la fiche technique. Le champ est la **France entière,
Mayotte comprise**, contrairement aux jeux du recensement publiés ici, qui
s'arrêtent à cent départements. Et **un seul millésime est publié** : la source
déclare que la comparabilité entre deux millésimes n'est pas garantie, et
fabriquer une série par-dessus cet avertissement reviendrait à inventer une
évolution. Un établissement peut par ailleurs être employeur et n'avoir aucun
salarié la dernière semaine de décembre — 259 789 sont dans ce cas, 10,8 % du
total.

**Le site rapportait ces effectifs aux habitants — corrigé dans la foulée.** La
règle « un effectif additif se compare pour mille habitants » gouvernait la
densité affichée sous chaque chiffre et la base des quartiles du groupe de
communes semblables. Elle vaut pour ce qui décrit les habitants — logements
vacants, chômeurs, familles monoparentales — et elle est fausse pour ce qui
décrit l'activité posée sur le territoire : Bordeaux aurait affiché 750 postes
pour mille habitants, une commune-dortoir voisine trente, et l'écart, présenté
comme une intensité d'emploi, n'aurait mesuré que la distance domicile-travail.
C'est précisément la lecture que la fiche technique interdit, et le site l'aurait
imprimée sous le chiffre.

Ces indicateurs restent **additifs** : ils s'additionnent bel et bien d'une
commune à l'autre, et déclarer le contraire pour obtenir un effet d'affichage
aurait menti sur la donnée pour corriger la présentation. C'est le
**dénominateur** qui n'existe pas. Leurs quartiles se comparent donc en valeur,
à l'intérieur d'une strate qui borne déjà la taille des communes — « comparée à
111 communes semblables, la vôtre compte 14 432 établissements employeurs »
reste une phrase juste. La règle est écrite une fois, au niveau du jeu, et
partagée par le SQL des quartiles et l'affichage : un test vérifie que les deux
expressions disent la même chose, faute de quoi les nombres seraient calculés
sur une base et formatés sur une autre.

Reste une limite connue : la vue « par habitant », que le lecteur active
lui-même, divise encore ces effectifs par les résidents. Elle le fait pour tous
les effectifs du site, et la corriger déborde de ce chargement.

Vérifié au chargement : Bordeaux 2024, 14 432 établissements employeurs et
201 045 postes salariés, dont 100 521 dans les services marchands et 88 409 dans
l'administration, l'enseignement, la santé et l'action sociale. **Aucun
territoire n'est tombé du référentiel** — 419 880 observations lues, 419 880
écrites — ce qui est rare et tient à ce que FLORES publie les arrondissements
municipaux sous leur propre zonage plutôt que mêlés aux communes.

**Capacités d'hébergement touristique — chargé le 6 août.** Le jeu
qui refuse d'être un seul nombre. 209 850 observations, six indicateurs, aux
trois mailles, au 1er janvier 2026.

**Il n'y a pas de total, et il n'y en aura pas ici.** La source ne publie aucune
capacité « tous hébergements confondus », et ce n'est pas un oubli : une chambre
d'hôtel, un emplacement de camping et un lit ne sont pas la même unité de compte.
Additionner les 660 489 chambres et les 848 302 emplacements de France donnerait
un nombre qui ne désigne rien. Trois familles sont donc publiées côte à côte,
chacune dans son unité, et jamais leur somme — la règle « une seule unité de
compte par somme » que le site tient déjà sur les classes de la délinquance.

**La même colonne de la source change d'unité.** `PLACE` vaut des chambres pour
un hôtel et des emplacements pour un camping. Lue sans regarder l'hébergement,
elle produit exactement la somme que le paragraphe précédent interdit : chaque
indicateur est donc défini par un couple (mesure, hébergement), jamais par la
mesure seule. Et **un emplacement n'est pas un lit** : il accueille plusieurs
personnes quand une chambre en accueille une ou deux. Aucune des trois grandeurs
ne dit combien de personnes le territoire peut héberger, et le site ne prétend
pas le calculer.

**Une capacité n'est pas une fréquentation** : ce sont les places qui existent au
1er janvier, pas celles qui ont été occupées.

Quatre identités bloquantes, refermées sur les 34 975 territoires publiés : les
trois sortes d'hébergement collectif font leur total (104 925 vérifications) ;
les six classements — une à cinq étoiles et non classé — font le total des hôtels
et celui des campings (139 900) ; les emplacements à l'année plus ceux de passage
font les emplacements (34 975) ; et les communes, les départements et les régions
font chacun la France, sur les six capacités publiées. La deuxième est celle qui
compte le plus : oublier les non classés ferait perdre 3 509 hôtels et 1 924
campings sans que rien ne casse.

Deux réserves entrent dans les fiches. Les emplacements comprennent ceux qui sont
**loués à l'année** — 160 477 sur 848 302, soit 18,9 % — dont l'occupant n'est pas
un vacancier de passage. Et **un seul millésime est publié**, celui du 1er janvier
2026 : il n'y a pas de série, et aucune évolution ne peut être lue ici.

Vérifié sur la publication : Bordeaux, 82 hôtels et 5 796 chambres, aucun
camping, 24 hébergements collectifs et 6 369 lits.

**Participation électorale — chargée le 6 août.** La ligne 14, et la
seule du plan où le choix de ce qu'on ne charge **pas** compte plus que ce qu'on
charge. 174 180 observations, cinq indicateurs, 34 836 communes, premier tour
des municipales du 15 mars 2026.

**Les nuances politiques ne sont pas chargées, et c'est une décision.** Le
fichier du ministère porte, pour chaque commune, le nom de chaque tête de liste,
sa nuance, ses voix et ses sièges. Quatre raisons de s'en tenir à la
participation :

1. **La nuance n'est pas une mesure.** Elle est attribuée par l'administration
   préfectorale, sa nomenclature change d'un scrutin à l'autre, et les listes la
   contestent régulièrement. Une carte peinte par nuance donnerait à une
   convention administrative l'apparence d'une donnée statistique.
2. **Une municipale n'est pas un scrutin national.** Sous 3 500 habitants,
   l'essentiel des listes est sans nuance : la carte serait grise là où vit une
   grande part du pays et lisible ailleurs, et l'écart entre les deux se lirait
   comme un écart politique alors qu'il est un écart de nomenclature.
3. **Ce site refuse les comparaisons dont il ne contrôle pas la définition.**
   Sur les nuances, il ne la contrôle pas.
4. **Les noms des candidats sont des données personnelles** dont ce site n'a
   aucun usage ; les élus qui siègent sont déjà couverts par le Répertoire
   national des élus, chargé par ailleurs.

Ce qui reste — combien d'inscrits, combien se sont déplacés, combien de blancs
et de nuls — est une donnée civique, cartographiable, comparable, et qui ne
prête d'intention à personne.

**Le premier tour, et lui seul** : c'est le seul qui a eu lieu partout. Le
second ne concerne que les communes où rien n'était joué, et une carte qui
mêlerait les deux comparerait des communes ayant voté deux fois à des communes
ayant voté une fois. **Et un inscrit n'est pas un habitant en âge de voter** :
l'inscription est une démarche, les résidents étrangers ne votent aux
municipales que s'ils sont européens, et le taux se lit donc sur les inscrits,
jamais sur la population.

Trois identités bloquantes, refermées sur les 34 836 communes : inscrits =
votants + abstentions ; votants = exprimés + blancs + nuls ; et le taux
recalculé égale celui que la source publie. La troisième est la seule qui
regarde ailleurs que dans les colonnes lues — les deux premières se refermeraient
encore si « Votants » et « Exprimés » avaient été inversées.

Une précaution de forme, tirée des incidents du matin : l'URL du fichier porte
l'horodatage du dépôt et change à chaque correction du ministère. Elle est
retrouvée par le **titre** de la ressource dans le catalogue, et un fichier
renommé arrête le chargement au lieu de recharger un fichier périmé.

Vérifié au chargement : 48 474 213 inscrits, 27 678 488 votants, **57,10 % de
participation**. Sur la publication en ligne, 34 801 communes portent un taux —
Bordeaux 58,08 %, Paris 58,89 % — les 35 manquantes étant celles que le
référentiel ne connaît pas, Nouvelle-Calédonie et Saint-Pierre-et-Miquelon.

### P2 — la fiche nationale, pas la carte

`DD_CNA_CONSO_MENAGES_PRODUITS`, `DS_ICA` (activité et chiffre d'affaires),
`DS_PRENOM` — séries nationales ou thématiques : elles éclairent, elles ne se
cartographient pas à la commune.

**L'onglet « Statistiques et études » n'a jamais été construit, et il n'a plus
lieu de l'être.** La fiche nationale accueille déjà six thèmes non
cartographiables — budget de l'État, dette, dépenses par fonction, Sécurité
sociale, conjoncture, comparaisons européennes. C'est là que les séries P2
entrent, sans surface nouvelle à bâtir.

**Indice des prix à la consommation — chargé le 6 août.** Le premier
P2, et son seul enjeu est de ne pas se confondre avec ce qui est déjà publié.
Le site porte l'**IPCH**, l'indice harmonisé européen, qui sert à comparer les
pays ; ce module apporte l'**IPC** national, celui auquel renvoient la loi et
les contrats — revalorisation des pensions, des prestations, du SMIC,
indexation des loyers par l'indice de référence qui en dérive. L'IPCH n'indexe
rien en France. Les deux séries s'écartent de quelques dixièmes de point la
plupart des mois, parce que leurs champs ne coïncident pas : les dépenses de
santé remboursées et les loyers imputés n'y sont pas traités de la même façon.
Chacune nomme désormais l'autre dans sa fiche, et le site n'en agrège aucune.

Un panier sur trois est chargé. La source décline le même indice pour
l'ensemble des ménages, pour les ménages urbains dont la personne de référence
est ouvrier ou employé, et pour les loyers imputés : les trois portent le même
nom et mesurent des choses différentes.

Le contrôle bloquant ne compare pas une colonne à sa voisine. Le glissement sur
douze mois publié par l'INSEE est **recalculé depuis l'indice** du même mois et
de douze mois plus tôt, deux séries que la même requête sert sous des
`IND_TYPE` distincts : 355 points mensuels de 1997 à 2026, écart nul. C'est lui
qui verrait un niveau d'indice chargé comme un taux — le site annoncerait alors
cent pour cent d'inflation par an. Un rebasement de la source arrête aussi le
chargement : les niveaux d'indice ne se comparent pas d'une base à l'autre.

Vérifié au chargement : 355 points mensuels de janvier 1997 à juillet 2026,
2,1 % sur un an en juillet, base 2025.

**Un écart de fraîcheur apparaît, et il est visible parce que les deux séries
se touchent.** L'IPC publié va jusqu'à juillet 2026 quand l'IPCH s'arrête à
décembre 2025 : ce n'est pas un défaut de définition mais un retard du
connecteur Eurostat, que le suivi de fraîcheur signale par ailleurs. Il est noté
ici parce qu'un lecteur qui compare les deux inflations verra d'abord cet écart,
et qu'il ne doit pas le prendre pour un écart de mesure.

**Solde des administrations publiques — chargé le 6 août.** Le
« déficit public » dont parlent les 3 % de Maastricht, par sous-secteur, de 1959
à 2025. Quatre indicateurs, niveau pays, dans le thème « dette » où il voisine
l'encours qu'il alimente.

**Ce n'est pas le solde budgétaire de l'État, déjà publié.** Celui-là porte sur
le seul budget général et suit la comptabilité budgétaire — encaissements et
décaissements de l'exercice. Celui-ci couvre toutes les administrations
publiques et suit la comptabilité nationale, où une opération est rattachée à
l'exercice où le droit naît. Deux périmètres, deux conventions, deux chiffres
justes ; chacun nomme l'autre. **Ce n'est pas non plus la dette** : un flux
d'une année contre un encours accumulé. Et **le signe est une convention** : la
source publie une capacité (+) ou un besoin (−) de financement, si bien qu'un
déficit s'écrit en négatif — le retourner rendrait incomparables les rares
exercices excédentaires.

Le contrôle bloquant est l'identité des sous-secteurs : centrales + locales +
sécurité sociale = ensemble. Vérifiée sur les 67 exercices de la source, écart
nul — dont 2024, où −152 464 − 17 794 + 1 140 fait exactement les −169 118
millions publiés.

**Ce que ce chargement refuse, et pourquoi.** Le jeu publie aussi des agrégats
de recettes et de dépenses totales. Leurs valeurs ne retrouvent pas les chiffres
publics connus : 2 034 milliards de recettes et 2 152 de dépenses en 2024, quand
la statistique publique annonce environ 1 500 et 1 670. L'écart vient du
périmètre de consolidation, que la source ne documente pas dans ses métadonnées.
Un agrégat dont on ne peut pas nommer le dénominateur n'est pas publié — c'est
la règle déjà appliquée aux agrégats OFGL sans définition, et elle vaut ici
d'autant plus que le chiffre serait lu comme « ce que coûte l'État ».

Le sous-secteur des administrations centrales réunit l'État **et** les
organismes divers : la source ne publie pas de solde pour l'État isolément dans
ce jeu, et l'identifiant le dit.

Vérifié au chargement, et l'identité se referme jusque sur les fichiers
publiés : solde public 2024 de −169,1 milliards d'euros — dont −152,5 pour les
administrations centrales, −17,8 pour les collectivités et +1,1 pour la Sécurité
sociale — et −152,5 milliards en 2025. Soixante-sept exercices, de 1959 à 2025.

**Les trois P2 restants, et ce que leur sondage a montré (6 août).** Ils ne se
valent pas, et l'ordre dans lequel ils entrent — ou n'entrent pas — se décide
sur la source, pas sur le titre de la ligne.

`DS_ICA` **n'est pas chargé, et c'est le producteur qui le dit.** Voir le refus
motivé plus bas.

`DD_CNA_CONSO_MENAGES_PRODUITS` **s'est révélé plus utile que son titre ne le
disait — chargé le 6 août.** Voir plus bas.

`DS_PRENOM` **est chargé — décision du propriétaire du projet, le 6 août.**
Mon inclination était de l'écarter : il ne répondait, pensais-je, à aucune
question du site. Le sondage a montré l'inverse de ce que je supposais sur un
point décisif — le jeu descend au **département et à la région**, et un filtre
sur le rang rend directement le prénom de tête de chaque territoire. Voir plus
bas.

**Consommation des ménages — chargée le 6 août.** Deux chiffres, et
c'est **leur écart** qui vaut le chargement. La dépense de consommation finale
est ce que les ménages paient de leur poche : 1 527 milliards d'euros en 2024.
La consommation finale effective est ce qu'ils consomment réellement, services
publics compris : 2 051 milliards la même année.

Les **524 milliards** d'écart portent un nom dans les comptes nationaux : les
transferts sociaux en nature. Soins remboursés, école, logement social,
crèches — des biens et services que les ménages consomment sans les payer,
parce que la collectivité les paie. Sur un site qui demande « où vont mes
impôts », c'est la réponse la plus directe qui existe, et elle ne se lit que si
les deux chiffres sont publiés côte à côte. Aucun des deux, seul, ne la donne.

Deux réserves entrent dans la fiche. Ces montants décrivent ce que les **ménages
consomment**, pas ce que les administrations dépensent : ils ne s'additionnent
pas aux dépenses publiques publiées par ailleurs. Et le champ est celui des
ménages **résidents**, où qu'ils dépensent — ce qu'un Français achète à
l'étranger y est, ce qu'un touriste achète en France n'y est pas ; la source
porte à cet effet une correction territoriale, négative de 16 milliards en 2024.

Le contrôle bloquant est une inégalité plutôt qu'une égalité : la consommation
effective ne peut pas descendre sous la dépense, puisque les transferts en
nature ne sont jamais négatifs. Vérifiée sur les 77 exercices de 1949 à 2025.
Elle attraperait deux mesures inversées ou un filtre qui aurait laissé passer un
autre secteur — les administrations et les associations sont servies sous les
mêmes codes.

**Un défaut de méthode, corrigé au premier essai.** Le jeu décline 551 produits.
Demander toutes les lignes puis ne garder le total qu'après lecture faisait
dépasser la page de l'API : le total disparaissait, la série revenait vide, et
rien n'échouait. Le filtre appartient donc à la requête, pas à la lecture — et
un test le vérifie sur l'URL.

Vérifié sur la publication : 77 exercices de 1949 à 2025 ; en 2024, dépense
1 527 123 M€, consommation effective 2 051 008 M€, et donc **523 885 M€** de
transferts en nature — l'écart se relit à l'identique sur les fichiers publiés.

**Prénoms — chargement lancé le 6 août.** Le dernier P2, et celui que j'aurais
eu tort d'écarter. Je le croyais national et sans agrégat ; il descend au
département et à la région, et un filtre sur le rang rend une ligne par
territoire, sexe et année depuis 1900 — 29 792 points.

**Le prénom lui-même n'est pas publié, et c'est une limite du modèle, pas un
choix.** Un indicateur de ce site porte une valeur numérique ; « Gabriel » est
une chaîne, et rien dans `core.observations` ne peut accueillir un fait textuel
attaché à un territoire. Le chargement publie donc **combien** d'enfants portent
le prénom de tête, sans pouvoir dire lequel. Publier le prénom demanderait
d'ouvrir le modèle aux faits textuels : c'est une décision de modèle, elle est
écrite ici plutôt que contournée par un bricolage — un identifiant d'indicateur
par prénom, par exemple, ferait quarante mille colonnes pour un seul jeu.

**Les effectifs départementaux sont arrondis à la dizaine par la source**, au
titre du secret statistique : 130 naissances en Gironde signifie « entre 125 et
134 ». Un écart de dix entre deux départements n'est donc pas interprétable, et
la fiche publique le dit en toutes lettres. **Et un prénom trop rare n'est pas
diffusé** dans un département : ces chiffres ne sont pas un dénombrement complet
des naissances.

Le contrôle bloquant porte sur ce dont tout le module dépend : le sens du rang.
Si `RANK` signifiait autre chose, l'indicateur publierait l'effectif d'un prénom
quelconque sous le nom de « prénom le plus donné », et rien ne le signalerait.
Le chargement compare donc le rang 1 au rang 2 — le premier ne peut pas compter
moins de naissances que le second — sur les 29 792 couples où les deux existent.

Ces effectifs ne sont **pas additifs** : le prénom de tête d'un département n'est
pas celui de sa région, et les additionner sommerait des grandeurs qui ne
parlent pas du même prénom. Le catalogue le déclare.

Relevé sur la source : Gironde 2024, 130 garçons portent le prénom masculin le
plus donné et 110 filles le prénom féminin le plus donné.

**Indices de chiffre d'affaires — écartés le 6 août, et la source elle-même le
recommande.** C'est le seul jeu du plan dont le producteur déconseille l'usage
qu'on en ferait ici. Son `scopeNote` est sans ambiguïté :

> « Concernant l'indice de chiffre d'affaires dans l'industrie, l'Insee préconise
> d'utiliser l'indice de la production industrielle et les indices de prix de
> production et d'importation dans l'industrie pour analyser séparément
> l'évolution de l'activité et celle des prix dans ce secteur d'activité, plutôt
> que de recourir aux indices de chiffre d'affaires dont l'évolution résulte à la
> fois d'évolutions de prix et d'évolutions de l'activité. »

Un indice qui mêle l'effet des prix et celui des volumes, publié sur un site qui
affiche par ailleurs l'inflation et la croissance, serait lu comme une troisième
mesure de l'activité alors qu'il n'en est pas une.

**Et il n'y a pas de série de tête à charger.** La source publie cinq familles
d'indices — industrie et construction, commerce, services, ventes en volume,
production dans les services — sur 245 codes d'activité, sans qu'aucun agrégat
ne soit désigné par le producteur comme « le » chiffre d'affaires de la France.
Choisir une famille et un code d'activité serait notre choix, pas le sien : la
même raison qui a fait écarter les recettes et dépenses totales des APU le matin
même.

Une piste reste ouverte si le sujet revient : les **indices de volume des ventes
dans le commerce**, qu'Eurostat désigne comme données à forte valeur et qui,
étant des volumes, échappent à la confusion que le `scopeNote` dénonce. Ils
demandent d'abord d'identifier, dans la nomenclature du producteur, l'agrégat qui
désigne l'ensemble du commerce de détail — travail de définition, pas de code.

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
