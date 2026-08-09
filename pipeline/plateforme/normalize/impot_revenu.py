"""L'impôt sur le revenu, commune par commune (IRCOM, DGFiP).

Le site dit déjà ce que la commune encaisse — foncier bâti, taxe d'habitation,
dotations. Il ne disait pas ce que ses habitants **paient à l'État** : combien
de foyers fiscaux, quel revenu déclaré, quel impôt sur le revenu. IRCOM le dit,
pour 34 901 communes.

**Ce n'est pas un impôt local, et ce n'est pas non plus la recette « impôt sur
le revenu » du budget de l'État.** La source ne compte que l'impôt *émis par
voie de rôle* : hors prélèvement forfaitaire sur les revenus de capitaux
mobiliers, hors prélèvements libératoires, hors impôt sur les plus-values
immobilières. La ligne de recettes de l'État publiée ailleurs sur ce site porte
un autre périmètre ; les deux ne se rapprochent pas, et la fiche le dit.

**La colonne « Dép. » n'est pas un département.** C'est un code de direction de
la DGFiP sur trois caractères, 109 valeurs pour 101 départements : `010` est
l'Ain (zéro-padé **à droite**), les Bouches-du-Rhône, le Nord et les
Hauts-de-Seine sont scindés en deux directions, Paris en cinq. La table
`DIRECTIONS` écrit la correspondance en toutes lettres, et une direction
inconnue fait échouer le chargement plutôt que de produire un code INSEE
inventé.

**`B31` n'est pas un territoire.** C'est la direction des impôts des
non-résidents, et ses 212 « communes » sont des pays — `France`, `Danemark`,
`Autres`. Les publier peindrait le Danemark sur une carte des communes
françaises. Elles sont écartées de la publication — mais **comptées dans le
rapprochement national**, sans quoi il manquerait 298 023 foyers et le contrôle
échouerait pour la mauvaise raison.

**Paris, Lyon et Marseille sont publiés par arrondissement municipal.** Les 45
arrondissements sont agrégés à leur commune (75056, 69123, 13055) : laissés
tels quels, ils ne rencontreraient aucun territoire du référentiel et les trois
plus grandes villes de France sortiraient vides — le défaut du 6 août 2026 que
`couverture.py` raconte.

**`n.c.` est une chaîne dans une colonne de nombres**, 63 815 fois : le secret
statistique. Une commune sous secret est **absente** de la série, jamais à
zéro — et le contrôle des tranches l'exclut, faute de quoi il produirait 1 099
faux échecs.

**L'impôt net peut être négatif**, les crédits d'impôt dépassant l'impôt dû :
−59 932 € à Ambérieu-en-Bugey sur la tranche basse, −326 469 114 € au national.
Un contrôle « ≥ 0 » rejetterait des données parfaitement valides.

**Les deux contrôles qui bloquent.**

1. *Somme des huit tranches = ligne `Total`, commune par commune.* Chaque
   commune détaillée figure neuf fois ; sommer le fichier brut compterait tout
   deux fois. Le contrôle vérifie l'égalité sur les communes dont la colonne
   testée ne porte aucun `n.c.` : 6 062 communes sur le nombre de foyers,
   5 874 sur le revenu et sur l'impôt, écart maximal **0**.
2. *Somme des communes = total national publié*, feuille `national/national.xls`
   de la même archive. 41 634 350 foyers contre 41 635 259 (0,0022 %),
   1 374 657 076 k€ de revenu contre 1 375 058 914 (0,0292 %), 91 678 600 k€
   d'impôt contre 91 718 994 (0,0440 %). L'écart est celui du secret
   statistique : le seuil est donc un millième, pas zéro. Écarter les
   non-résidents ferait bondir l'écart à 1,08 % et bloquerait le run.

Usage : python -m plateforme.normalize.impot_revenu [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
import json
import zipfile
from collections import defaultdict
from typing import NamedTuple

from plateforme import couverture, entrepot, revisions
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "dgfip-ircom"
SOURCE = "data-gouv"

# Un seul millésime. Le jeu en publie trente-quatre (revenus 1992 à 2024) ;
# les charger tous ferait 2,9 millions d'observations pour une série dont le
# périmètre de l'impôt a changé plusieurs fois — et le garde-fou de volume
# existe précisément pour rappeler qu'un connecteur n'est pas un aspirateur.
PERIODE = "2024"
URL = (
    "https://static.data.gouv.fr/resources/"
    "limpot-sur-le-revenu-par-collectivite-territoriale-ircom/"
    "20260526-131537/ircom-2025-revenus-2024.zip"
)
DANS_ARCHIVE = "ircom_2025_revenus_2024/ircom_communes_complet_revenus_2024.xlsx"
NATIONAL_DANS_ARCHIVE = "ircom_2025_revenus_2024/national/national.xls"
FEUILLE = "ListeCommune"

# En-têtes sur deux lignes fusionnées (6 et 7) ; les données commencent à la 8.
# La colonne A est vide : les sept colonnes utiles vont de B à H.
PREMIERE_LIGNE = 8
PREMIERE_COLONNE = 2
DERNIERE_COLONNE = 8

SECRET = "n.c."
_SEPARATEURS = str.maketrans("", "", " \u202f\u00a0")
TOTAL = "Total"

# Les montants sont en milliers d'euros — sauf les bornes des tranches, qui
# sont en euros et ne sont pas chargées. Le facteur est appliqué à l'écriture,
# jamais à la lecture : les contrôles se font dans l'unité de la source, pour
# que les écarts se lisent contre les chiffres que la source publie.
MILLIERS = 1000.0

# Directions « ordinaires » : le numéro du département zéro-padé **à droite**.
# `200` n'existe pas (la Corse a `2A0` et `2B0`) ; `130`, `590`, `750` et `920`
# n'apparaissent pas non plus, ces départements étant scindés en plusieurs
# directions listées juste après. Les garder dans la table ne coûte rien et
# documente la règle.
_ORDINAIRES = {f"{numero:02d}0": f"{numero:02d}" for numero in range(1, 96) if numero != 20}

# Départements servis par plusieurs directions, et la Corse dont le code de
# département n'est pas numérique.
_SCINDEES = {
    "2A0": "2A",
    "2B0": "2B",
    "131": "13",  # Bouches-du-Rhône : Marseille et l'est
    "132": "13",  # Bouches-du-Rhône : Aix, Arles, l'ouest
    "591": "59",  # Nord
    "592": "59",
    "754": "75",  # Paris, cinq directions se partageant les vingt arrondissements
    "755": "75",
    "756": "75",
    "757": "75",
    "758": "75",
    "921": "92",  # Hauts-de-Seine
    "922": "92",
}

# Outre-mer : le département tient sur trois chiffres, et le code commune de la
# source répète son dernier chiffre (971 -> `1xx`, 976 -> `6xx`). `975`
# (Saint-Pierre-et-Miquelon) n'a pas de direction dans ce millésime.
_OUTRE_MER = {code: code for code in ("971", "972", "973", "974", "976")}

# `B31` : direction des impôts des non-résidents. Ses 212 « communes » sont des
# pays. Elle est cartographiée sur `None` — présente dans la table, donc lue
# sans erreur et comptée au national, mais jamais publiée.
NON_RESIDENTS = "B31"

DIRECTIONS: dict[str, str | None] = {
    **_ORDINAIRES,
    **_SCINDEES,
    **_OUTRE_MER,
    NON_RESIDENTS: None,
}

# Arrondissements municipaux -> commune. Le référentiel géographique ne connaît
# que les communes ; sans ce rabattement, Paris, Lyon et Marseille sortiraient
# vides.
ARRONDISSEMENTS = {
    **{f"75{rang}": "75056" for rang in range(101, 121)},
    **{f"13{rang}": "13055" for rang in range(201, 217)},
    **{f"69{rang}": "69123" for rang in range(381, 390)},
}

# Monaco est rattaché à la direction des Alpes-Maritimes sous le code commune
# `900`, ce qui reconstruirait un « 06900 » qui n'est pas une commune française.
# Écarté explicitement plutôt que laissé au hasard du référentiel.
HORS_FRANCE = {"06900": "Monaco"}

# Le rapprochement national admet un millième. L'écart mesuré est de 0,0022 %
# sur les foyers, 0,0292 % sur le revenu et 0,0440 % sur l'impôt : il vient
# entièrement du secret statistique, que le total national ne subit pas. Zéro
# serait inatteignable ; un pour cent laisserait passer l'oubli des
# non-résidents, qui déplace l'impôt de 1,08 %.
ECART_NATIONAL_MAXIMUM = 0.001

# L'impôt sur le revenu est un impôt d'État, pas un impôt local : le placer
# sous `impots_locaux` mettrait la taxe foncière et l'IR dans la même liste,
# et un lecteur les additionnerait. Le thème retenu est `revenus`, où vivent
# déjà le niveau de vie médian et le taux de pauvreté issus des mêmes
# déclarations fiscales — c'est bien la matière imposable des habitants qui est
# décrite ici, pas le budget d'une collectivité.
THEME = "revenus"

INDICATEURS = {
    "dgfip_ircom_foyers_fiscaux": {
        "mesure": "foyers",
        "libelle": "Foyers fiscaux",
        "unite": "count",
        "facteur": 1.0,
        "formule": "Nombre de foyers fiscaux, ligne « Total » de la commune",
        "unit_notes": "nombre de foyers fiscaux",
        "public": "Le nombre de foyers fiscaux ayant déclaré des revenus dans la"
        " commune. Un foyer n'est ni un ménage ni un habitant : un couple marié ou"
        " pacsé n'en fait qu'un, deux concubins en font deux.",
    },
    "dgfip_ircom_revenu_fiscal_reference": {
        "mesure": "rfr",
        "libelle": "Revenu fiscal de référence des foyers fiscaux",
        "unite": "EUR",
        "facteur": MILLIERS,
        "formule": "Somme des revenus fiscaux de référence, ligne « Total » de la commune",
        "unit_notes": "euros courants, convertis depuis les milliers d'euros de la source",
        "public": "La somme des revenus fiscaux de référence déclarés dans la commune."
        " Ce revenu sert à ouvrir des droits et des exonérations : ce n'est ni le"
        " revenu disponible ni le niveau de vie des habitants.",
    },
    "dgfip_ircom_impot_net": {
        "mesure": "impot",
        "libelle": "Impôt sur le revenu net des foyers fiscaux",
        "unite": "EUR",
        "facteur": MILLIERS,
        "formule": "Impôt net total émis par voie de rôle, ligne « Total » de la commune",
        "unit_notes": "euros courants, convertis depuis les milliers d'euros de la source",
        "public": "L'impôt sur le revenu payé par les foyers de la commune. Il peut"
        " être négatif quand les crédits d'impôt dépassent l'impôt dû. Il revient à"
        " l'État : la commune n'en perçoit rien.",
    },
}

MESURES = tuple(fiche["mesure"] for fiche in INDICATEURS.values())

TECHNIQUE = (
    "IRCOM, l'impôt sur le revenu par collectivité territoriale, DGFiP"
    " (Département des études et statistiques fiscales), millésime 2025 portant"
    " sur les **revenus 2024**. Le périmètre est celui de l'impôt **émis par voie"
    " de rôle** : hors prélèvement forfaitaire obligatoire sur les revenus de"
    " capitaux mobiliers et crédit d'impôt correspondant, hors prélèvements"
    " libératoires, hors impôt sur les plus-values immobilières. Ce n'est donc"
    " **pas** la recette « impôt sur le revenu » du budget de l'État, publiée par"
    " ailleurs sur ce site sur un périmètre plus large : les deux montants ne se"
    " rapprochent pas. L'impôt net peut être négatif, les crédits d'impôt pouvant"
    " excéder l'impôt dû. Les montants de la source sont en milliers d'euros et"
    " sont convertis en euros ; les bornes de tranches, elles, sont en euros et ne"
    " sont pas chargées. Les valeurs couvertes par le **secret statistique**"
    " (« n.c. » dans la source, 63 815 cellules) sont **absentes** de la série et"
    " non nulles : une commune sans valeur n'est pas une commune sans impôt. Le"
    " territoire est reconstitué depuis le code de direction de la DGFiP, qui"
    " n'est pas un code département ; les arrondissements municipaux de Paris, de"
    " Lyon et de Marseille sont agrégés à leur commune. Les non-résidents"
    " (direction B31), dont les « communes » sont des pays, sont exclus de la"
    " publication ; Monaco, Saint-Barthélemy et Saint-Martin ne sont pas des"
    " communes du Code officiel géographique et sont également absents."
)


class DirectionInconnue(RuntimeError):
    """Un code de direction DGFiP absent de la table de correspondance."""


class TranchesIncoherentes(RuntimeError):
    """La somme des huit tranches ne retrouve pas la ligne « Total »."""


class TotalNationalDivergent(RuntimeError):
    """La somme des communes s'écarte du total national publié."""


class Ligne(NamedTuple):
    """Une ligne de la source : une commune, une tranche de revenu."""

    direction: str
    commune: str
    libelle: str
    tranche: str
    foyers: float | None
    rfr: float | None
    impot: float | None


def _nombre(valeur) -> float | None:
    """`n.c.` -> None. Le secret statistique est une absence, pas un zéro.

    Écrire zéro à la place ferait d'une commune dont la valeur est masquée une
    commune sans revenu et sans impôt — et, plus grave, ferait passer le
    contrôle des tranches pour 1 099 communes qui n'ont rien à y prouver.
    """
    if valeur is None:
        return None
    texte = str(valeur).strip()
    if not texte or texte == SECRET:
        return None
    # Le classeur rend des flottants ; l'échantillon CSV, du texte. Les
    # séparateurs de milliers de la source sont des espaces fines insécables.
    return float(texte.replace(",", ".").translate(_SEPARATEURS))


def _ligne(valeurs: list) -> Ligne | None:
    """Sept cellules brutes -> une ligne, ou None si la ligne est vide."""
    if valeurs[0] is None or not str(valeurs[0]).strip():
        return None
    return Ligne(
        str(valeurs[0]).strip(),
        str(valeurs[1]).strip(),
        str(valeurs[2]).strip(),
        str(valeurs[3]).strip(),
        _nombre(valeurs[4]),
        _nombre(valeurs[5]),
        _nombre(valeurs[6]),
    )


def lire_xlsx(contenu: bytes) -> list[Ligne]:
    """La feuille `ListeCommune` du classeur communal -> lignes.

    `read_only` n'est pas un confort : le classeur fait 85 612 lignes et son
    chargement complet en mémoire coûte plusieurs centaines de mégaoctets.
    """
    import openpyxl

    classeur = openpyxl.load_workbook(io.BytesIO(contenu), read_only=True, data_only=True)
    try:
        feuille = classeur[FEUILLE]
        lignes = []
        for rang in feuille.iter_rows(min_row=PREMIERE_LIGNE, values_only=True):
            ligne = _ligne(list(rang[PREMIERE_COLONNE - 1 : DERNIERE_COLONNE]))
            if ligne is not None:
                lignes.append(ligne)
        return lignes
    finally:
        classeur.close()


def lire_csv(contenu: bytes) -> list[Ligne]:
    """Le même contenu en CSV : sept colonnes, les en-têtes de la source.

    C'est la forme dans laquelle l'échantillon de test est figé — un classeur
    de neuf mégaoctets n'a pas sa place dans un dépôt Git, et la lecture du
    XLSX se réduit de toute façon à ces sept colonnes.
    """
    lecteur = csv.reader(io.StringIO(contenu.decode("utf-8-sig")), delimiter=";")
    next(lecteur, None)  # en-tête
    lignes = []
    for rang in lecteur:
        if len(rang) < 7:
            continue
        ligne = _ligne(rang[:7])
        if ligne is not None:
            lignes.append(ligne)
    return lignes


def lire_national(contenu: bytes) -> dict[str, float]:
    """La ligne « Total » de `national/national.xls` -> les trois masses.

    Ce fichier est un classeur Excel binaire (BIFF), pas un XLSX : openpyxl ne
    sait pas le lire. C'est le seul point du connecteur qui dépende de `xlrd`,
    et il porte le contrôle le plus utile du module — le seul qui confronte ce
    qui a été lu à un chiffre publié par ailleurs.
    """
    import xlrd  # noqa: PLC0415 — dépendance du seul rapprochement national

    classeur = xlrd.open_workbook(file_contents=contenu)
    feuille = classeur.sheet_by_index(0)
    for rang in range(feuille.nrows):
        cellules = feuille.row_values(rang)
        if len(cellules) > 4 and str(cellules[1]).strip() == TOTAL:
            return {
                "foyers": float(cellules[2]),
                "rfr": float(cellules[3]),
                "impot": float(cellules[4]),
            }
    raise TotalNationalDivergent(
        "aucune ligne « Total » dans le fichier national : la source a changé de"
        " forme, le rapprochement ne peut plus être fait."
    )


# Les vingt-cinq tranches de la feuille nationale, et leurs bornes en euros.
# Les intitulés de la source disent « 10 001 à 12 000 » là où la borne est
# 10 000 : elles sont donc **écrites**, pas déduites de l'intitulé. C'est ce qui
# rend exact le calcul d'assiette d'un barème refait — voir le commentaire de
# `fin.income_distribution` — et une tranche que la DGFiP renommerait ou
# ajouterait arrête le chargement plutôt que de décaler tout le barème.
#
# La ligne « Plus de 100 000 dont: » est le **parent** des dix-huit suivantes :
# elle n'est pas une tranche, elle les résume. La compter ferait 294 Md€ de
# revenu de trop.
PARENT_HAUTS_REVENUS = "Plus de 100 000 dont:"

TRANCHES = (
    ("0 à 10 000", 0.0, 10_000.0),
    ("10 001 à 12 000", 10_000.0, 12_000.0),
    ("12 001 à 15 000", 12_000.0, 15_000.0),
    ("15 001 à 20 000", 15_000.0, 20_000.0),
    ("20 001 à 30 000", 20_000.0, 30_000.0),
    ("30 001 à 50 000", 30_000.0, 50_000.0),
    ("50 001 à 100 000", 50_000.0, 100_000.0),
    ("100 001 à 200 000", 100_000.0, 200_000.0),
    ("200 001 à 300 000", 200_000.0, 300_000.0),
    ("300 001 à 400 000", 300_000.0, 400_000.0),
    ("400 001 à 500 000", 400_000.0, 500_000.0),
    ("500 001 à 600 000", 500_000.0, 600_000.0),
    ("600 001 à 700 000", 600_000.0, 700_000.0),
    ("700 001 à 800 000", 700_000.0, 800_000.0),
    ("800 001 à 900 000", 800_000.0, 900_000.0),
    ("900 001 à 1 000 000", 900_000.0, 1_000_000.0),
    ("1 000 001 à 2 000 000", 1_000_000.0, 2_000_000.0),
    ("2 000 001 à 3 000 000", 2_000_000.0, 3_000_000.0),
    ("3 000 001 à 4 000 000", 3_000_000.0, 4_000_000.0),
    ("4 000 001 à 5 000 000", 4_000_000.0, 5_000_000.0),
    ("5 000 001 à 6 000 000", 5_000_000.0, 6_000_000.0),
    ("6 000 001 à 7 000 000", 6_000_000.0, 7_000_000.0),
    ("7 000 001 à 8 000 000", 7_000_000.0, 8_000_000.0),
    ("8 000 001 à 9 000 000", 8_000_000.0, 9_000_000.0),
    ("Plus de 9 000 000", 9_000_000.0, None),
)

# Un millième de la masse : la distribution nationale est publiée telle quelle,
# ses vingt-cinq tranches doivent faire le total à l'unité près. L'écart mesuré
# sur le millésime 2025 est nul sur les trois colonnes.
ECART_DISTRIBUTION = 0.001


class DistributionIncoherente(RuntimeError):
    """Les tranches nationales ne font plus le total national publié."""


def lire_distribution(contenu: bytes) -> list[tuple[str, float, float | None, float, float, float]]:
    """La distribution nationale par tranche -> [(intitulé, borne basse, borne
    haute, foyers, revenu, impôt)], montants en euros.

    Le fichier national porte trois sortes de lignes : les vingt-cinq tranches,
    leur parent « Plus de 100 000 dont: », et deux totaux. Seules les tranches
    sortent d'ici ; le contrôle vérifie ensuite qu'elles font bien le total.
    """
    import xlrd  # noqa: PLC0415 — dépendance du seul fichier national

    feuille = xlrd.open_workbook(file_contents=contenu).sheet_by_index(0)
    lus: dict[str, tuple[float, float, float]] = {}
    for rang in range(feuille.nrows):
        cellules = feuille.row_values(rang)
        if len(cellules) < 5 or not isinstance(cellules[2], float):
            continue
        intitule = " ".join(str(cellules[1]).split())
        lus[intitule] = (float(cellules[2]), float(cellules[3]), float(cellules[4]))
    manquantes = [nom for nom, _, _ in TRANCHES if nom not in lus]
    if manquantes:
        raise DistributionIncoherente(
            f"{len(manquantes)} tranche(s) absente(s) du fichier national, par"
            f" exemple « {manquantes[0]} ». Les bornes du barème sont écrites ici"
            " et ne peuvent pas être devinées : la source a changé de découpage."
        )
    return [
        (nom, bas, haut, lus[nom][0], lus[nom][1] * MILLIERS, lus[nom][2] * MILLIERS)
        for nom, bas, haut in TRANCHES
    ]


def controler_distribution(
    distribution: list[tuple], national: dict[str, float]
) -> dict:
    """Les vingt-cinq tranches font le total national, sur les trois colonnes.

    C'est le contrôle interne. Le contrôle croisé, lui, est déjà là : la somme
    des communes du fichier communal est rapprochée de ce même total par
    `controler_national`, sur un fichier différent et une lecture différente.
    Une tranche perdue ici la ferait diverger de la distribution sans toucher au
    rapprochement communal, et réciproquement.
    """
    sommes = {
        "foyers": sum(t[3] for t in distribution),
        "rfr": sum(t[4] for t in distribution) / MILLIERS,
        "impot": sum(t[5] for t in distribution) / MILLIERS,
    }
    ecarts = {}
    for mesure, somme in sommes.items():
        attendu = national[mesure]
        ecarts[mesure] = 0.0 if not attendu else (somme - attendu) / attendu
        if abs(ecarts[mesure]) > ECART_DISTRIBUTION:
            raise DistributionIncoherente(
                f"les {len(distribution)} tranches font {somme:,.3f} sur « {mesure} »"
                f" pour un total national publié de {attendu:,.3f}"
                f" ({100 * ecarts[mesure]:+.4f} %). Une tranche manque, ou la ligne"
                f" « {PARENT_HAUTS_REVENUS} » a été comptée avec ses composantes."
            )
    return {
        "tranches": len(distribution),
        "ecarts_relatifs_distribution": {m: round(e, 8) for m, e in ecarts.items()},
        "foyers": sommes["foyers"],
    }


def ecrire_distribution(conn, run_id: str, distribution: list[tuple]) -> int:
    conn.execute("delete from fin.income_distribution where dataset_id = ?", (DATASET,))
    for rang, (_, bas, haut, foyers, revenu, impot) in enumerate(distribution):
        conn.execute(
            """
            insert into fin.income_distribution
                (fiscal_year, bracket_rank, floor_euros, ceiling_euros, households,
                 income_total, tax_net, dataset_id, run_id)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (int(PERIODE), rang, bas, haut, foyers, revenu, impot, DATASET, run_id),
        )
    return len(distribution)


def extraire(archive: bytes) -> tuple[bytes, bytes]:
    """-> (classeur communal, classeur national) de l'archive téléchargée."""
    with zipfile.ZipFile(io.BytesIO(archive)) as zip_:
        return zip_.read(DANS_ARCHIVE), zip_.read(NATIONAL_DANS_ARCHIVE)


def code_insee(ligne: Ligne) -> str | None:
    """Direction DGFiP + code commune relatif -> code INSEE, ou None.

    None signale un territoire qui ne doit pas être publié : les « pays » de la
    direction des non-résidents, et Monaco. Une direction absente de la table
    lève : mieux vaut un run rouge qu'un code INSEE inventé, qui produirait une
    commune plausible et fausse.
    """
    if ligne.direction not in DIRECTIONS:
        raise DirectionInconnue(
            f"direction DGFiP « {ligne.direction} » inconnue (commune"
            f" {ligne.commune}, {ligne.libelle}). La table des directions doit être"
            " complétée avant de publier ce millésime : reconstituer un code INSEE"
            " au jugé fabriquerait une commune."
        )
    departement = DIRECTIONS[ligne.direction]
    if departement is None:
        return None
    if len(departement) == 3:
        # Outre-mer : le code commune répète le dernier chiffre du département.
        if ligne.commune[0] != departement[2]:
            raise DirectionInconnue(
                f"direction {ligne.direction} : le code commune {ligne.commune} ne"
                f" commence pas par {departement[2]}, la règle de reconstitution"
                " outre-mer ne s'applique pas."
            )
        code = departement + ligne.commune[1:]
    else:
        code = departement + ligne.commune
    if code in HORS_FRANCE:
        return None
    return ARRONDISSEMENTS.get(code, code)


def controler_tranches(lignes: list[Ligne]) -> dict:
    """Somme des huit tranches = ligne « Total », commune par commune.

    Le contrôle ne compare pas la source à un chiffre extérieur : il confronte
    deux lectures du même fichier, celle par tranche et celle par total. C'est
    exactement le piège que le fichier tend — chaque commune détaillée y figure
    neuf fois — et une somme du fichier brut le déclencherait aussitôt.

    Il n'est appliqué qu'aux communes dont la colonne testée ne porte **aucun**
    `n.c.` : une tranche masquée manque à la somme sans que rien ne soit faux.
    Sans ce filtre, le contrôle échoue 1 099 fois sur un fichier intact.

    Deux communes de Guyane sortent du moule : Maripasoula porte deux fois la
    tranche « + de 100 000 », Camopi n'en porte que sept. Aucune des deux n'est
    vérifiable — leurs lignes surnuméraires ou manquantes sont sous secret — et
    elles sont donc recensées, pas ignorées. Une commune mal formée dont les
    valeurs seraient, elles, toutes publiées ferait échouer le run : il faudrait
    alors comprendre avant de charger.
    """
    groupes: dict[tuple[str, str], list[Ligne]] = defaultdict(list)
    for ligne in lignes:
        groupes[(ligne.direction, ligne.commune)].append(ligne)
    detaillees = [groupe for groupe in groupes.values() if len(groupe) == 9]
    if not detaillees:
        raise TranchesIncoherentes(
            "aucune commune détaillée : le fichier ne porte plus les huit tranches,"
            " le contrôle ne vérifie plus rien."
        )
    hors_forme = []
    for groupe in groupes.values():
        if len(groupe) in (1, 9):
            continue
        hors_forme.append(f"{groupe[0].direction}/{groupe[0].commune} {groupe[0].libelle}")
        for mesure in MESURES:
            if all(getattr(ligne, mesure) is not None for ligne in groupe):
                raise TranchesIncoherentes(
                    f"{groupe[0].libelle} ({groupe[0].direction}/{groupe[0].commune})"
                    f" porte {len(groupe)} lignes au lieu de neuf, et « {mesure} » y"
                    " est intégralement publié : ni les tranches ni le total ne"
                    " peuvent être rapprochés."
                )
    verifiees: dict[str, int] = {}
    ecart_maximal = 0.0
    for mesure in MESURES:
        comptees = 0
        for groupe in detaillees:
            valeurs = [getattr(ligne, mesure) for ligne in groupe]
            if any(valeur is None for valeur in valeurs):
                continue
            total = next(getattr(ligne, mesure) for ligne in groupe if ligne.tranche == TOTAL)
            somme = sum(getattr(ligne, mesure) for ligne in groupe if ligne.tranche != TOTAL)
            ecart = abs(round(somme - total, 3))
            ecart_maximal = max(ecart_maximal, ecart)
            if ecart:
                exemple = groupe[0]
                raise TranchesIncoherentes(
                    f"{exemple.libelle} ({exemple.direction}/{exemple.commune}) :"
                    f" les huit tranches font {somme:,.3f} pour un total publié de"
                    f" {total:,.3f} sur « {mesure} ». Les tranches et le total ne"
                    " décrivent plus la même commune."
                )
            comptees += 1
        if not comptees:
            raise TranchesIncoherentes(
                f"aucune commune vérifiable sur « {mesure} » : toutes portent un"
                " secret statistique, le contrôle ne prouve plus rien."
            )
        verifiees[mesure] = comptees
    return {
        "communes_detaillees": len(detaillees),
        "communes_verifiees": verifiees,
        "communes_hors_forme": sorted(hors_forme),
        "ecart_maximal": ecart_maximal,
    }


def sommes_nationales(lignes: list[Ligne]) -> dict[str, float]:
    """Les trois masses, sommées sur les lignes « Total » de **toutes** les directions.

    Les non-résidents en font partie : le total national publié les comprend
    (« Dont non-résidents (DINR) », 298 023 foyers). Les retirer ici ferait
    échouer le rapprochement pour une raison qui n'est pas une erreur de
    lecture — et c'est précisément ce que le test vérifie.
    """
    return {
        mesure: sum(
            getattr(ligne, mesure)
            for ligne in lignes
            if ligne.tranche == TOTAL and getattr(ligne, mesure) is not None
        )
        for mesure in MESURES
    }


def controler_national(
    sommes: dict[str, float],
    publie: dict[str, float],
    seuil: float = ECART_NATIONAL_MAXIMUM,
) -> dict:
    """La somme des communes retrouve le total national publié, à un millième.

    Contrairement au contrôle des tranches, celui-ci confronte le fichier lu à
    un chiffre venu d'un **autre fichier** de l'archive. Une colonne décalée,
    une tranche comptée deux fois, une direction oubliée : rien de tout cela ne
    peut satisfaire l'égalité par hasard.
    """
    ecarts = {}
    for mesure in MESURES:
        reference = publie.get(mesure)
        if not reference:
            raise TotalNationalDivergent(
                f"le total national ne donne pas « {mesure} » : le rapprochement ne"
                " peut pas être fait."
            )
        ecarts[mesure] = (sommes.get(mesure, 0.0) - reference) / reference
    depassements = {m: e for m, e in ecarts.items() if abs(e) > seuil}
    if depassements:
        mesure, ecart = next(iter(sorted(depassements.items())))
        raise TotalNationalDivergent(
            f"la somme des communes s'écarte du total national de {100 * ecart:+.4f} %"
            f" sur « {mesure} » ({sommes.get(mesure, 0.0):,.3f} contre"
            f" {publie[mesure]:,.3f}), au-delà des {100 * seuil:.1f} % admis pour le"
            " seul secret statistique. Une direction manque, ou les tranches ont été"
            " sommées avec les totaux."
        )
    return {
        "ecarts_relatifs": {m: round(e, 6) for m, e in sorted(ecarts.items())},
        "national_publie": {m: publie[m] for m in sorted(publie)},
    }


def par_commune(lignes: list[Ligne]) -> dict[str, dict[str, float | None]]:
    """Lignes « Total » -> {code INSEE: {mesure: valeur en unité source}}.

    Les arrondissements municipaux se replient ici sur leur commune. Une mesure
    dont l'un des morceaux est sous secret vaut None pour l'ensemble : publier
    la somme des seize arrondissements dont un manque donnerait un Marseille
    faux plutôt qu'un Marseille absent.
    """
    cumuls: dict[str, dict[str, float | None]] = {}
    for ligne in lignes:
        if ligne.tranche != TOTAL:
            continue
        code = code_insee(ligne)
        if code is None:
            continue
        cumul = cumuls.setdefault(code, dict.fromkeys(MESURES, 0.0))
        for mesure in MESURES:
            valeur = getattr(ligne, mesure)
            if valeur is None or cumul[mesure] is None:
                cumul[mesure] = None
            else:
                cumul[mesure] += valeur
    return cumuls


def observations(lignes: list[Ligne]) -> list[tuple]:
    """-> [(indicateur, 'commune', code INSEE, période, valeur)], en euros."""
    cumuls = par_commune(lignes)
    sorties = []
    for identifiant, fiche in sorted(INDICATEURS.items()):
        for code, mesures in sorted(cumuls.items()):
            valeur = mesures[fiche["mesure"]]
            if valeur is None:
                continue
            sorties.append(
                (identifiant, "commune", code, PERIODE, round(valeur * fiche["facteur"], 2))
            )
    return sorties


def foyers_par_maille(candidates) -> dict[str, float]:
    """La couverture se mesure en foyers fiscaux, pas en codes.

    Trois codes perdus ne pèsent rien s'ils portent trois foyers, et tout s'ils
    portent Paris (docs : `couverture.py`).
    """
    par_maille: dict[str, float] = defaultdict(float)
    for identifiant, niveau, _, _, valeur in candidates:
        if identifiant == "dgfip_ircom_foyers_fiscaux":
            par_maille[niveau] += valeur
    return dict(par_maille)


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for identifiant, fiche in sorted(INDICATEURS.items()):
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, ?, ?, 'observed', array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (fiche["public"], TECHNIQUE, fiche["formule"], fiche["unit_notes"]),
            ).fetchone()[0]
            # `accounting_frame` reste nul : IRCOM n'est ni de la comptabilité
            # budgétaire, ni générale, ni nationale — c'est une statistique
            # d'assiette. Le renseigner à « budgetaire » inviterait à rapprocher
            # ces montants des recettes de l'État, ce que la fiche refuse.
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, price_basis, geo_levels, time_granularity, published)
                values (?, ?, ?, ?, ?, ?, true, ?, array['commune'], 'annuelle', true)
                on conflict (indicator_id) do update set
                    definition_id = excluded.definition_id,
                    label_fr = excluded.label_fr, unit = excluded.unit,
                    theme = excluded.theme, published = true
                """,
                (
                    identifiant,
                    DATASET,
                    definition,
                    THEME,
                    fiche["libelle"],
                    fiche["unite"],
                    "current" if fiche["unite"] == "EUR" else None,
                ),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


# `revisions.remplacer` attend : cinq clés, puis ces colonnes-là.
COLONNES = ("value",)


def ecrire(conn, run_id: str, lignes: list[Ligne]) -> tuple[int, int, int, int, dict, dict]:
    """Remplace les trois séries en archivant ce qui a bougé.

    La DGFiP republie IRCOM chaque année et corrige les millésimes antérieurs :
    un montant rectifié doit rester visible comme révision plutôt que
    disparaître sous le suivant — d'où `revisions.remplacer` et non un
    effacement suivi d'une copie.
    """
    candidates = observations(lignes)
    gardees, ecartes = filtrer_territoires_connus(conn, candidates)
    ecrites, revisees = revisions.remplacer(
        conn,
        run_id,
        sorted(INDICATEURS),
        COLONNES,
        (
            (identifiant, niveau, code, MILLESIME, periode, valeur)
            for identifiant, niveau, code, periode, valeur in gardees
        ),
    )
    return (
        ecrites,
        len(ecartes),
        revisees,
        # Les trois séries n'ont pas la même longueur — le secret ne masque pas
        # les mêmes communes d'une colonne à l'autre —, alors diviser le nombre
        # d'observations par trois donnerait un compte faux.
        len({code for _, _, code, _, _ in gardees}),
        foyers_par_maille(candidates),
        foyers_par_maille(gardees),
    )


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        garde_fou_volume(conn)
        archive = telecharger(URL, timeout=900)
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "ircom-communes.zip", archive, URL,
            "application/zip",
        )
        entrepot.etape(f"{len(archive) // 1024 // 1024} Mo reçus")
        classeur, national = extraire(archive)
        lignes = lire_xlsx(classeur)
        entrepot.etape(f"{len(lignes)} lignes lues")

        tranches = controler_tranches(lignes)
        entrepot.etape(
            f"tranches = total sur {tranches['communes_verifiees']['foyers']} communes"
        )
        totaux_nationaux = lire_national(national)
        rapproche = controler_national(sommes_nationales(lignes), totaux_nationaux)
        entrepot.etape("somme des communes rapprochée du total national")

        distribution = lire_distribution(national)
        repartie = controler_distribution(distribution, totaux_nationaux)
        tranches_ecrites = ecrire_distribution(conn, run_id, distribution)
        entrepot.etape(
            f"{tranches_ecrites} tranches de revenu écrites,"
            f" {repartie['foyers']:,.0f} foyers fiscaux"
        )

        ecrites, ecartes, revisees, communes, lus, reconnus = ecrire(conn, run_id, lignes)
        parts = couverture.controler(lus, reconnus)
        entrepot.etape(f"{ecrites} observations écrites")

        observe = json.dumps({
            **tranches,
            **rapproche,
            "periode": PERIODE,
            "communes_publiees": communes,
            "hors_referentiel": ecartes,
            "couverture": {n: round(p, 4) for n, p in sorted(parts.items())},
        })
        observe_distribution = json.dumps(repartie)
        for nom in (
            "tranches_font_le_total_par_commune",
            "somme_des_communes_egale_le_total_national",
        ):
            conn.execute(
                """
                insert into meta.data_quality_checks
                    (run_id, dataset_id, check_name, severity, passed, observed)
                values (?, ?, ?, 'blocker', true, ?)
                """,
                (run_id, DATASET, nom, observe),
            )
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'les_tranches_nationales_font_le_total', 'blocker', true, ?)
            """,
            (run_id, DATASET, observe_distribution),
        )
        conn.commit()
        entrepot.finish_run(
            conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites
        )
        print(
            f"impôt sur le revenu : {ecrites} observations sur revenus {PERIODE},"
            f" {len(INDICATEURS)} indicateurs, {ecartes} hors référentiel,"
            f" {revisees} valeurs révisées ;"
            f" {tranches['communes_verifiees']['foyers']} communes dont les tranches"
            f" font le total, écart national maximal"
            f" {100 * max(abs(e) for e in rapproche['ecarts_relatifs'].values()):.4f} %"
        )
        return 0
    except Exception as error:  # noqa: BLE001 — tout échec finit tracé dans le lineage
        entrepot.finish_run(conn, run_id, "failed", error=str(error))
        raise
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--store", default=".snapshots")
    return run(parser.parse_args().store)


if __name__ == "__main__":
    raise SystemExit(main())
