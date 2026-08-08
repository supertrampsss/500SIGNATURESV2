"""Indice des prix à la consommation (INSEE) — l'inflation française.

Le site publie déjà une inflation : l'**IPCH**, l'indice harmonisé européen,
qui sert à comparer les pays entre eux. Ce module apporte l'autre, l'**IPC**
national, et la seule chose qui compte est que les deux ne soient jamais
confondus.

**Ce sont deux indices, et c'est le second qui a des effets juridiques.** L'IPC
de l'INSEE est celui auquel la loi et les contrats renvoient : revalorisation
des pensions, des prestations, du SMIC, indexation des loyers par l'indice de
référence qui en dérive. L'IPCH, lui, existe pour que Paris, Berlin et Rome se
mesurent à la même aune ; il n'indexe rien en France. Les deux séries diffèrent
de quelques dixièmes de point la plupart des mois, et de bien plus certains
mois, parce que leurs champs ne coïncident pas — le traitement des dépenses de
santé remboursées et des loyers imputés n'est pas le même.

Chacun porte donc l'autre dans sa fiche, et le site n'en agrège aucun.

**Un ménage de référence, sur trois publiés.** La source décline l'indice pour
l'ensemble des ménages, pour les ménages urbains dont la personne de référence
est ouvrier ou employé, et pour les loyers imputés. Seul l'ensemble est chargé :
les trois portent le même nom d'« indice des prix » et mesurent des paniers
différents.

**Le contrôle qui bloque.** L'identité de la source, et elle ne se contente pas
de comparer une colonne à sa voisine : le glissement annuel publié est recalculé
depuis l'indice du même mois et de douze mois plus tôt. Vérifié sur les 355
points mensuels de 1997 à 2026, écart nul. C'est ce contrôle qui verrait un
`IND_TYPE` lu de travers — un niveau d'indice chargé comme un taux ferait dire
au site que les prix montent de cent pour cent par an.

Usage : python -m plateforme.normalize.prix [--store r2:plateforme-raw]
"""

import argparse
import json

from plateforme import entrepot, revisions
from plateforme.connectors.insee import MELODI_BASE
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, make_store

DATASET = "melodi-ipc"
SOURCE = "insee-melodi"
JEU = "DS_IPC_PRINC"

# France entière, tous ménages, ensemble des postes, série brute. Chaque filtre
# écarte une série qui porterait le même nom et mesurerait autre chose.
PARAMS = {
    "GEO": "FRANCE-F",
    "COICOP_2018": "00",  # ensemble des postes ; « _Z » désigne les regroupements
    "TPH_CPI": "_T",  # ensemble des ménages, pas les ménages urbains ouvriers
}
FREQ = "M"
SANS_CORRECTION = "N"
BASE_ATTENDUE = "2025"

INDICATEUR = "insee_inflation_ipc"
THEME = "macro"

# Le glissement annuel publié, et l'indice qui sert à le recalculer.
GLISSEMENT = "YOY"
INDICE = "IX"

# Bornes de vraisemblance, dans l'esprit de `conjoncture` : la France n'a pas
# connu de glissement annuel hors de cet intervalle depuis 1997, et une valeur
# au-delà signale un niveau d'indice lu comme un taux.
BORNES = (-10.0, 30.0)
TOLERANCE = 0.05

FICHE = {
    "libelle": "Inflation (IPC, sur un an)",
    "public": "La hausse des prix à la consommation sur douze mois, mesurée par"
    " l'indice national de l'INSEE. C'est celui auquel renvoient les pensions, le"
    " SMIC et les loyers. Ce n'est pas l'indice harmonisé européen, publié à côté"
    " pour comparer les pays.",
    "technique": "Indice des prix à la consommation (IPC), ensemble des ménages,"
    " ensemble des postes (COICOP 00), France entière, série mensuelle brute non"
    " corrigée des variations saisonnières, base 2025. Le taux publié est le"
    " glissement sur douze mois calculé par l'INSEE, recalculé au chargement depuis"
    " l'indice pour vérifier qu'aucune série n'a été lue à la place d'une autre."
    " L'IPC n'est pas l'IPCH, l'indice harmonisé européen également publié ici :"
    " les champs diffèrent (traitement des dépenses de santé remboursées, des"
    " loyers imputés), et les deux séries s'écartent de quelques dixièmes de point"
    " la plupart des mois. C'est l'IPC qui a des effets juridiques en France"
    " (revalorisation des pensions et prestations, SMIC, indice de référence des"
    " loyers qui en dérive) ; l'IPCH n'indexe rien et sert à comparer les pays. La"
    " source publie aussi l'indice pour les ménages urbains dont la personne de"
    " référence est ouvrier ou employé, et pour les loyers imputés : ces paniers"
    " ne sont pas chargés ici.",
    "formule": "Variation de l'indice des prix sur douze mois, en %",
}


class IdentiteRompue(RuntimeError):
    """Le glissement publié ne se retrouve pas depuis l'indice."""


def url() -> str:
    requete = "&".join(f"{cle}={valeur}" for cle, valeur in PARAMS.items())
    return f"{MELODI_BASE}/data/{JEU}?{requete}&maxResult=10000"


def lire(contenu: bytes) -> dict[str, dict[str, float]]:
    """-> {type d'indicateur: {période: valeur}} pour la série mensuelle brute.

    Les deux séries lues portent le même nom de mesure et ne se distinguent que
    par `IND_TYPE` : l'une est un niveau d'indice, l'autre un pourcentage. Les
    séparer ici est la condition du contrôle qui suit.
    """
    charge = json.loads(contenu)
    series: dict[str, dict[str, float]] = {GLISSEMENT: {}, INDICE: {}}
    bases = set()
    for observation in charge.get("observations", []):
        dimensions = observation.get("dimensions", {})
        if (
            dimensions.get("FREQ") != FREQ
            or dimensions.get("SEASONAL_ADJUST") != SANS_CORRECTION
            or dimensions.get("IND_TYPE") not in series
        ):
            continue
        valeur = (
            observation.get("measures", {}).get("OBS_VALUE_INDICE_DE_PRIX") or {}
        ).get("value")
        if valeur is None:
            continue
        bases.add(dimensions.get("BASE_PER"))
        series[dimensions["IND_TYPE"]][dimensions["TIME_PERIOD"]] = float(valeur)
    if bases and bases != {BASE_ATTENDUE}:
        raise IdentiteRompue(
            f"base de l'indice {sorted(bases)} au lieu de ['{BASE_ATTENDUE}'] :"
            " l'INSEE a rebasé sa série, et les niveaux d'indice ne se comparent"
            " pas d'une base à l'autre. Chargement refusé avant vérification."
        )
    return series


def mois_precedent(periode: str) -> str:
    """« 2026-07 » -> « 2025-07 », le même mois un an plus tôt."""
    annee, mois = periode.split("-")
    return f"{int(annee) - 1}-{mois}"


def controler(series: dict[str, dict[str, float]]) -> dict[str, int]:
    """Le glissement publié, recalculé depuis l'indice. Lève au premier écart.

    L'identité regarde ailleurs que dans la série publiée : elle confronte deux
    `IND_TYPE` distincts servis par la même requête. Un niveau d'indice chargé
    comme un taux ne la passerait pas.
    """
    glissements, indices = series[GLISSEMENT], series[INDICE]
    if not glissements or not indices:
        raise IdentiteRompue(
            f"séries incomplètes : {len(glissements)} glissements,"
            f" {len(indices)} indices — la requête n'a pas servi les deux."
        )
    verifies = 0
    for periode, publie in sorted(glissements.items()):
        precedent = mois_precedent(periode)
        if periode not in indices or precedent not in indices or not indices[precedent]:
            continue
        recalcule = 100 * (indices[periode] / indices[precedent] - 1)
        if abs(recalcule - publie) > TOLERANCE:
            raise IdentiteRompue(
                f"{periode} : glissement publié {publie:.2f} %, recalculé depuis"
                f" l'indice {recalcule:.2f} %. Une série a été lue à la place"
                " d'une autre."
            )
        verifies += 1
    if not verifies:
        raise IdentiteRompue("aucun mois n'a pu être vérifié contre l'indice")
    return {"le_glissement_recalcule_egale_le_publie": verifies}


def controler_plausibilite(glissements: dict[str, float]) -> dict[str, float]:
    """Écarte et compte les valeurs hors bornes — sans jamais les corriger."""
    basse, haute = BORNES
    return {
        periode: valeur
        for periode, valeur in glissements.items()
        if not basse <= valeur <= haute
    }


# Les colonnes que le chargement remplace, et donc la longueur des lignes que
# `revisions.remplacer` attend : cinq clés, puis ces colonnes-là. Un champ de
# plus ou de moins passe tous les tests d'unité et casse à l'écriture réelle,
# faute de quoi c'est DuckDB qui l'apprend en production.
COLONNES = ("value",)


def lignes_a_ecrire(glissements: dict[str, float]):
    """-> les lignes prêtes pour `revisions.remplacer`, dans l'ordre des mois."""
    return [
        (INDICATEUR, "pays", "FR", MILLESIME, periode, valeur)
        for periode, valeur in sorted(glissements.items())
    ]


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        definition = curseur.execute(
            """
            insert into core.indicator_definitions
                (public_definition, technical_definition, formula, unit_notes,
                 confidence_level, badges)
            values (?, ?, ?, '% sur douze mois', 'observed',
                    array['Officiel','Donnée brute'])
            returning definition_id
            """,
            (FICHE["public"], FICHE["technique"], FICHE["formule"]),
        ).fetchone()[0]
        curseur.execute(
            """
            insert into core.indicators
                (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                 additive, accounting_frame, geo_levels, time_granularity, published)
            values (?, ?, ?, ?, ?, 'percent', false, 'nationale',
                    array['pays'], 'mensuelle', true)
            on conflict (indicator_id) do update set unit = excluded.unit,
                definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                theme = excluded.theme, published = true
            """,
            (INDICATEUR, DATASET, definition, THEME, FICHE["libelle"]),
        )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    garde_fou_volume(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        adresse = url()
        contenu = telecharger(adresse, timeout=600)
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "ipc.json", contenu, adresse,
            "application/json",
        )
        series = lire(contenu)
        verifies = controler(series)
        glissements = series[GLISSEMENT]
        ecartes = controler_plausibilite(glissements)
        gardes = {p: v for p, v in glissements.items() if p not in ecartes}
        if not gardes:
            raise IdentiteRompue("aucune valeur plausible à écrire")
        entrepot.etape(f"{len(gardes)} mois retenus")
        ecrites, revisees = revisions.remplacer(
            conn, run_id, [INDICATEUR], COLONNES, lignes_a_ecrire(gardes)
        )
        periodes = sorted(gardes)
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'le_glissement_recalcule_egale_le_publie', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "premier_mois": periodes[0],
                "dernier_mois": periodes[-1],
                "dernier_glissement": gardes[periodes[-1]],
                "hors_bornes": ecartes,
            })),
        )
        conn.commit()
        entrepot.finish_run(
            conn, run_id, "success", rows_read=len(glissements), rows_written=ecrites
        )
        print(
            f"prix : {ecrites} observations, {periodes[0]} à {periodes[-1]},"
            f" {revisees} valeurs révisées, {len(ecartes)} hors bornes ;"
            f" dernier glissement {gardes[periodes[-1]]:.1f} %"
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
