"""Logements par territoire (INSEE, recensement) vers core.observations.

« Combien de logements vides dans ma commune ? » est devenue une question
politique, et elle n'a pas une seule réponse chiffrée. Ce module charge celle du
recensement, et dit ce qu'elle recouvre.

**Vacant au sens du recensement.** Un logement est vacant s'il est inoccupé au
moment de l'enquête : proposé à la vente ou à la location, en attente
d'occupation, gardé vide par son propriétaire, ou sans affectation. Ce n'est pas
le comptage fiscal de la DGFiP, qui part des locaux non soumis à taxe
d'habitation et ne trouve ni les mêmes logements ni le même total. Les deux
existent, ils ne se remplacent pas, et un chiffre pris pour l'autre fait dire au
territoire l'inverse de ce qu'il vit.

**Un recensement qui roule, pas une photographie.** Le millésime 2023 est le
résultat de cinq années d'enquêtes centrées sur 2023 : chaque commune de moins
de dix mille habitants est recensée exhaustivement une fois tous les cinq ans,
les autres par sondage annuel. C'est de là que viennent les décimales — 148
377,4 résidences principales à Bordeaux, et non un compte d'huissier. La fiche
le dit ; l'affichage arrondit.

**France hors Mayotte.** La source l'écrit dans son résumé, et le fichier le
confirme : cent départements, aucune commune de Mayotte. Les fiches mahoraises
n'auront donc pas de logements, et c'est la source qui le décide.

**Le parc social d'ici n'est pas celui de la loi SRU.** Le recensement compte
les résidences principales dont l'occupant se déclare locataire d'un logement
social vide. Le répertoire des bailleurs sociaux (RPLS), qui sert au décompte
SRU, part des logements et non des ménages : les deux nombres diffèrent, et
seul le second a une portée juridique.

**Les contrôles qui bloquent.** Trois identités de la source, vérifiées sur les
108 665 couples territoire-millésime au moment d'écrire ce module, toutes à
1 × 10⁻⁵ près : résidences principales + secondaires + vacants = total des
logements ; propriétaires + locataires + logés gratuitement = résidences
principales ; parc privé + parc social + meublé = locataires. La première
attrape un croisement lu de travers, les deux autres un statut d'occupation
filtré à côté.

Usage : python -m plateforme.normalize.logement [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
import json
import zipfile

from plateforme import entrepot
from plateforme.http import telecharger
from plateforme.normalize.geo import MILLESIME, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "melodi-rp-logement"
SOURCE = "insee-melodi"
JEU = "DS_RP_LOGEMENT_PRINC"

# 98 Mo compressés, 1,2 Go de CSV, 11,9 millions d'observations — dont 870 000
# nous concernent. La pagination de l'API demanderait des milliers de requêtes
# pour la même donnée.
URL = "https://api.insee.fr/melodi/file/DS_RP_LOGEMENT_PRINC/DS_RP_LOGEMENT_PRINC_2023_CSV_FR"

NIVEAUX = {"COM": "commune", "DEP": "departement", "REG": "region"}
FRANCE = "F"

# La mesure : un nombre de logements. Le jeu en publie trois autres — nombre de
# pièces, durée de séjour, population des ménages — au même format et sur les
# mêmes lignes. Les confondre ferait des pièces des logements.
MESURE = "DWELLINGS"

# Les sept dimensions de détail. Une seule ligne par territoire porte le total
# sur toutes : c'est celle-là qu'on charge. Les autres ventilent le même parc
# par type, pièces, chauffage, voitures — et s'additionneraient au total.
DETAIL = ("L_STAY", "TDW", "CARS", "CARPARK", "NOR", "BUILD_END", "NRG_SRC")
TOTAL = "_T"

# Catégorie de logement (OCS), croisée avec le total des statuts d'occupation.
CATEGORIES = {
    "_T": ("insee_logements", "Logements"),
    "DW_MAIN": ("insee_residences_principales", "Résidences principales"),
    "DW_SEC_DW_OCC": (
        "insee_residences_secondaires",
        "Résidences secondaires et occasionnelles",
    ),
    "DW_VAC": ("insee_logements_vacants", "Logements vacants"),
}

# Statut d'occupation (TSH), qui ne s'applique qu'aux résidences principales.
# `211` (parc privé vide) et `212_222` (meublé) ne sont pas publiés : ils
# servent au contrôle du total des locataires, et les publier ferait six lignes
# de statut là où trois répondent à la question.
STATUTS = {
    "100": ("insee_residences_principales_proprietaire", "Propriétaires occupants"),
    "200": ("insee_residences_principales_locataire", "Logements loués"),
    "300": ("insee_residences_principales_gratuit", "Occupants à titre gratuit"),
}
# Le parc privé vide, le meublé et le parc social ne sont pas publiés mais sont
# lus : ils ferment la troisième identité, celle qui dit que les locataires se
# décomposent bien en parc privé et parc social.
#
# **Le parc social du recensement a cessé d'être publié le 7 août.** Le site
# donnait deux nombres de logements sociaux pour la même commune : 20 552 ici
# pour Bordeaux, 24 014 au répertoire des bailleurs. Les deux sont justes — le
# premier est déclaré par les habitants au recensement de 2023, le second compté
# logement par logement chez les bailleurs en 2025 — mais aucun lecteur ne
# pouvait savoir lequel regarder, et les deux libellés voisins se lisaient comme
# un doublon. C'est le répertoire des bailleurs qui reste : c'est lui qui fait
# foi pour la loi SRU, il est plus récent, et il compte des logements plutôt que
# des déclarations. Celui-ci reste lu, parce que l'identité de la source en a
# besoin ; il n'est simplement plus affiché.
STATUTS_DE_CONTROLE = ("211", "212_222", "221")

# `W` — « inclut les données d'une autre catégorie » — marque une commune
# nouvelle qui a absorbé une déléguée et reçoit ses logements ; `K` marque la
# déléguée, dont la ligne est vide. Comme pour les décès, la première est
# chargée et signalée : sa valeur couvre plus de territoire que la commune
# seule, alors que sa population ne couvre qu'elle.
DRAPEAU_REGROUPEMENT = "inclut_une_commune_rattachee"
STATUTS_REGROUPES = {"W"}

# Les identités de la source se referment à 1 × 10⁻⁵ près sur les 108 665
# couples territoire-millésime : le seuil est cent fois cet écart, assez lâche
# pour ne jamais crier sur un arrondi, assez serré pour attraper un logement
# manquant.
TOLERANCE = 0.001

PUBLIQUE = {
    "insee_logements": "Le nombre total de logements du territoire : résidences"
    " principales, résidences secondaires et logements vacants réunis. C'est le parc"
    " existant, pas le nombre de ménages qui y vivent.",
    "insee_residences_principales": "Les logements occupés à l'année par un ménage"
    " qui y a sa résidence principale. Un logement, un ménage : c'est aussi le nombre"
    " de ménages du territoire.",
    "insee_residences_secondaires": "Les logements occupés une partie de l'année"
    " seulement — résidences de vacances, pieds-à-terre professionnels. La source"
    " compte ensemble les résidences secondaires et les logements occasionnels.",
    "insee_logements_vacants": "Les logements inoccupés au moment de l'enquête :"
    " proposés à la vente ou à la location, en attente d'occupation, ou gardés vides"
    " par leur propriétaire. Ce n'est pas le comptage fiscal de la DGFiP, qui donne"
    " un autre chiffre.",
    "insee_residences_principales_proprietaire": "Les résidences principales occupées"
    " par leur propriétaire. Rapporté au total des résidences principales, c'est le"
    " taux de propriétaires occupants du territoire.",
    "insee_residences_principales_locataire": "Les résidences principales louées,"
    " parc privé et parc social confondus, meublé compris.",
    "insee_residences_principales_gratuit": "Les résidences principales occupées sans"
    " payer de loyer : logement de fonction, hébergement par un proche.",
}

TECHNIQUE = (
    "Recensement de la population, dossier complet « Logements », mesure"
    " « Logements » croisée au total de toutes les dimensions de détail — type,"
    " pièces, chauffage, période d'achèvement, équipement automobile, ancienneté"
    " d'emménagement — que le jeu publie sur les mêmes lignes. Champ : France hors"
    " Mayotte, cent départements. Trois millésimes : 2012, 2017, 2023. Le millésime"
    " est le résultat de cinq années d'enquêtes centrées sur lui, et non une"
    " photographie au 1ᵉʳ janvier : les communes de moins de dix mille habitants sont"
    " recensées exhaustivement une fois tous les cinq ans, les autres par sondage"
    " annuel. Les valeurs sont des estimations pondérées, d'où leurs décimales ;"
    " l'affichage les arrondit. Comparer deux millésimes suppose une géographie"
    " communale stable : une commune nouvelle change de périmètre entre deux d'entre"
    " eux."
)


class IdentiteRompue(RuntimeError):
    """Une somme de la source ne fait plus son total.

    Le jeu sert les agrégats et leurs composantes à plat, sur les mêmes lignes.
    Un filtre qui lâche fait donc entrer des composantes dans un total, ou
    l'inverse — et rien ne le signale sinon ces identités.
    """


def lire(archive: bytes) -> list[dict]:
    """CSV zippé du recensement -> lignes d'agrégat, avec leur maille.

    Ne garde que la mesure « logements », les territoires du site, et le
    croisement où les sept dimensions de détail valent toutes « total ». Lecture
    par index de colonne : le fichier fait 1,2 Go décompressés pour 11,9 millions
    de lignes dont on en garde 7 %.
    """
    with zipfile.ZipFile(io.BytesIO(archive)) as zip_:
        nom = next(n for n in zip_.namelist() if n.endswith("_data.csv"))
        with zip_.open(nom) as fichier:
            lecteur = csv.reader(
                io.TextIOWrapper(fichier, encoding="utf-8"), delimiter=";"
            )
            colonne = {nom_: rang for rang, nom_ in enumerate(next(lecteur))}
            objet, geo, mesure = colonne["GEO_OBJECT"], colonne["GEO"], colonne["RP_MEASURE"]
            categorie, statut_occupation = colonne["OCS"], colonne["TSH"]
            periode, valeur, statut = (
                colonne["TIME_PERIOD"], colonne["OBS_VALUE"], colonne["OBS_STATUS"],
            )
            details = [colonne[c] for c in DETAIL]
            retenues = []
            for rang in lecteur:
                if rang[mesure] != MESURE or rang[objet] not in NIVEAUX:
                    continue
                if not rang[valeur] or any(rang[c] != TOTAL for c in details):
                    continue
                retenues.append(
                    {
                        "niveau": NIVEAUX[rang[objet]],
                        "code": rang[geo],
                        "periode": rang[periode],
                        "categorie": rang[categorie],
                        "statut_occupation": rang[statut_occupation],
                        "valeur": float(rang[valeur]),
                        "drapeaux": (
                            [DRAPEAU_REGROUPEMENT]
                            if rang[statut] in STATUTS_REGROUPES
                            else []
                        ),
                    }
                )
            return retenues


def _par_cle(lignes: list[dict]) -> dict[tuple, dict[tuple, float]]:
    table: dict[tuple, dict[tuple, float]] = {}
    for ligne in lignes:
        cle = (ligne["niveau"], ligne["code"], ligne["periode"])
        table.setdefault(cle, {})[(ligne["categorie"], ligne["statut_occupation"])] = (
            ligne["valeur"]
        )
    return table


# Les trois identités : (libellé, composantes, total). Une composante ou un
# total absent d'un territoire fait sauter le contrôle pour ce territoire —
# c'est une donnée manquante, pas une incohérence.
IDENTITES = (
    (
        "categories_egalent_le_parc",
        (("DW_MAIN", "_T"), ("DW_SEC_DW_OCC", "_T"), ("DW_VAC", "_T")),
        ("_T", "_T"),
    ),
    (
        "statuts_egalent_les_residences_principales",
        (("DW_MAIN", "100"), ("DW_MAIN", "200"), ("DW_MAIN", "300")),
        ("DW_MAIN", "_T"),
    ),
    (
        "parcs_egalent_les_locataires",
        (("DW_MAIN", "211"), ("DW_MAIN", "221"), ("DW_MAIN", "212_222")),
        ("DW_MAIN", "200"),
    ),
)


def controler(lignes: list[dict], tolerance: float = TOLERANCE) -> dict[str, int]:
    """Les trois identités de la source, territoire par territoire et millésime.

    -> le nombre de territoires vérifiés par identité. Lève au premier écart :
    un total qui ne fait plus la somme de ses parts veut dire qu'une part est
    entrée dans le mauvais sac, et la carte l'afficherait sans broncher.
    """
    table = _par_cle(lignes)
    verifies = {}
    for nom, composantes, total in IDENTITES:
        compte = 0
        for cle, valeurs in table.items():
            if total not in valeurs or any(c not in valeurs for c in composantes):
                continue
            ecart = sum(valeurs[c] for c in composantes) - valeurs[total]
            if abs(ecart) > tolerance:
                niveau, code, periode = cle
                raise IdentiteRompue(
                    f"{nom} : {niveau} {code} en {periode} s'écarte de {ecart:+.4f}"
                    f" ({sum(valeurs[c] for c in composantes):.2f} contre"
                    f" {valeurs[total]:.2f}). Une part est comptée dans le mauvais sac."
                )
            compte += 1
        if not compte:
            raise IdentiteRompue(f"{nom} : aucun territoire n'a pu être vérifié")
        verifies[nom] = compte
    return verifies


def total_france(lignes_brutes: bytes) -> dict[str, float]:
    """{millésime: parc total de France entière}, tel que la source le publie."""
    with zipfile.ZipFile(io.BytesIO(lignes_brutes)) as zip_:
        nom = next(n for n in zip_.namelist() if n.endswith("_data.csv"))
        with zip_.open(nom) as fichier:
            lecteur = csv.reader(
                io.TextIOWrapper(fichier, encoding="utf-8"), delimiter=";"
            )
            colonne = {nom_: rang for rang, nom_ in enumerate(next(lecteur))}
            details = [colonne[c] for c in DETAIL]
            return {
                rang[colonne["TIME_PERIOD"]]: float(rang[colonne["OBS_VALUE"]])
                for rang in lecteur
                if rang[colonne["GEO_OBJECT"]] == "FRANCE"
                and rang[colonne["GEO"]] == FRANCE
                and rang[colonne["RP_MEASURE"]] == MESURE
                and rang[colonne["OCS"]] == TOTAL
                and rang[colonne["TSH"]] == TOTAL
                and rang[colonne["OBS_VALUE"]]
                and all(rang[c] == TOTAL for c in details)
            }


def indicateurs() -> dict[tuple[str, str], tuple[str, str, str]]:
    """{(catégorie, statut): (identifiant, libellé, unité de compte)}.

    L'unité de compte n'est pas cosmétique : les catégories dénombrent des
    logements, les statuts d'occupation dénombrent des résidences principales.
    Additionner « logements vacants » et « propriétaires occupants » n'aurait
    aucun sens, et c'est cette mention qui le dit sur la fiche.
    """
    publies = {
        (categorie, TOTAL): (*valeur, "logements")
        for categorie, valeur in CATEGORIES.items()
    }
    publies.update(
        {
            ("DW_MAIN", statut): (*valeur, "résidences principales")
            for statut, valeur in STATUTS.items()
        }
    )
    return publies


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for indicateur, libelle, unite in indicateurs().values():
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, ?, ?, 'observed', array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (PUBLIQUE[indicateur], TECHNIQUE, f"Nombre de « {libelle} »", unite),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, geo_levels, time_granularity, published)
                values (?, ?, ?, 'logement', ?, 'count', true,
                        array['commune','departement','region'], 'annuelle', true)
                on conflict (indicator_id) do update set
                    definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                    theme = excluded.theme, published = true
                """,
                (indicateur, DATASET, definition, libelle),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def ecrire(conn, run_id: str, lignes: list[dict]) -> tuple[int, int]:
    publies = indicateurs()
    candidates = []
    drapeaux = {}
    for ligne in lignes:
        cle = (ligne["categorie"], ligne["statut_occupation"])
        if cle not in publies:
            continue
        indicateur = publies[cle][0]
        candidates.append(
            (indicateur, ligne["niveau"], ligne["code"], ligne["periode"], ligne["valeur"])
        )
        if ligne["drapeaux"]:
            drapeaux[(indicateur, ligne["niveau"], ligne["code"], ligne["periode"])] = (
                ligne["drapeaux"]
            )
    gardees, ecartes = filtrer_territoires_connus(conn, candidates)
    noms = [nom for nom, _, _ in publies.values()]
    with conn.cursor() as curseur:
        curseur.execute(
            "delete from core.observations where indicator_id = any(?)", (noms,)
        )
        entrepot.copier(
            conn,
            "core.observations",
            ["indicator_id", "geo_level", "geo_code", "geo_vintage", "period", "value",
             "quality_flags", "run_id"],
            (
                (cle, niveau, code, MILLESIME, periode, valeur,
                 drapeaux.get((cle, niveau, code, periode), []), run_id)
                for cle, niveau, code, periode, valeur in gardees
            ),
        )
    conn.commit()
    return len(gardees), len(ecartes)


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        archive = telecharger(URL, timeout=900)
        entrepot.etape(f"archive de {len(archive) / 1e6:.0f} Mo téléchargée")
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "rp-logement.zip", archive, URL,
            "application/zip",
        )
        lignes = lire(archive)
        entrepot.etape(f"{len(lignes)} lignes lues")
        if not lignes:
            raise ValueError("aucun logement lu")
        verifies = controler(lignes)
        totaux = total_france(archive)
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'identites_du_recensement', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "millesimes": sorted(totaux),
                "parc_france": {p: round(v) for p, v in sorted(totaux.items())},
            })),
        )
        conn.commit()
        ecrites, ecartes = ecrire(conn, run_id, lignes)
        entrepot.etape(f"{ecrites} observations écrites")
        entrepot.finish_run(conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites)
        periodes = sorted(totaux)
        print(
            f"logements : {ecrites} observations, millésimes {', '.join(periodes)},"
            f" {len(indicateurs())} indicateurs, {ecartes} hors référentiel ;"
            f" parc France {periodes[-1]} : {totaux[periodes[-1]]:.0f}"
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
