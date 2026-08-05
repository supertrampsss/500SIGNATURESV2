"""Décès domiciliés par commune (INSEE, état civil) vers core.observations.

**Domiciliés, pas survenus — et c'est toute la différence.** L'INSEE publie deux
comptages : les décès *survenus* sur un territoire et les décès de personnes qui
y étaient *domiciliées*. Le premier fait exploser le chiffre des communes qui
ont un centre hospitalier — on y meurt sans y avoir vécu — et ne dit rien du
territoire. C'est le second qui est chargé ici, et la source le dit en toutes
lettres : « les totaux France diffusés ici correspondent aux décès enregistrés
en France et domiciliés en France. Ces derniers diffèrent de ceux des décès
enregistrés en France quel que soit le lieu de domicile du défunt. »

**Un décompte n'est pas un taux de mortalité.** Une commune de vingt mille
retraités enterre plus de monde qu'une ville nouvelle de vingt mille jeunes
ménages, sans que la santé y soit pire. Le nombre est publié tel quel ; le
rapporter aux habitants donnerait un taux brut, qui mesure d'abord la structure
par âge. La fiche le dit, et aucun agrégat calculé ne le maquille en indicateur
de santé.

**Le contrôle qui bloque.** La somme des communes doit égaler exactement le
total France du même exercice. Vérifié sur les trois derniers millésimes au
moment d'écrire ce module : 637 067 en 2023, 641 023 en 2024, 645 662 en 2025,
à l'unité près des deux côtés. Un écart signifierait qu'une part des décès n'est
plus rattachée à une commune, et le chargement s'arrête.

Usage : python -m plateforme.normalize.deces [--store r2:plateforme-raw]
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

DATASET = "melodi-deces-communes"
SOURCE = "insee-melodi"
JEU = "DS_ETAT_CIVIL_DECES_COMMUNES"

# Le fichier complet plutôt que la pagination de l'API : trois mégaoctets
# compressés contre sept cent cinquante mille observations à parcourir page par
# page, pour exactement la même donnée.
URL = (
    "https://api.insee.fr/melodi/file/DS_ETAT_CIVIL_DECES_COMMUNES/"
    "DS_ETAT_CIVIL_DECES_COMMUNES_2025_CSV_FR"
)

INDICATEUR = "insee_deces_domicilies"

# Le jeu couvre onze découpages ; quatre seulement sont des territoires de ce
# site. Les aires d'attraction, bassins de vie, unités urbaines et zones
# d'emploi sont des zonages d'étude, pas des collectivités : ils n'ont ni fiche
# ni budget ici, et les charger remplirait l'entrepôt sans rien éclairer.
NIVEAUX = {"COM": "commune", "EPCI": "epci", "DEP": "departement", "REG": "region"}

# `F` est la France entière. `FM` (métropolitaine) et `F_X_D976` (hors Mayotte)
# sont deux périmètres plus étroits du même comptage : les charger sous le même
# indicateur ferait trois France dans une carte qui n'en attend qu'une.
FRANCE = "F"

# Statuts de la source, et ce qu'ils veulent dire ici — vérifié ligne à ligne
# plutôt que supposé. `A` est la valeur normale. `K` (« données incluses dans une
# autre catégorie ») marque une commune dont les décès sont comptés ailleurs :
# sa valeur est vide, il n'y a rien à charger. `W` (« inclut les données d'une
# autre catégorie ») marque la commune qui les reçoit — c'est le cas d'une
# commune nouvelle et de sa déléguée. `M` est une valeur qui n'existe pas :
# Mayotte avant 2014.
#
# Un premier jet écartait `W`, en croyant à un doublon. C'était l'inverse : la
# somme des communes tombait alors sous le total France de la source, de
# exactement ce que ces lignes portaient — 140 décès en 2017, 98 en 2023. Elles
# sont donc chargées, et signalées : la valeur couvre plus de territoire que la
# commune seule, alors que sa population, elle, ne couvre qu'elle. Un taux par
# habitant calculé dessus serait surévalué.
DRAPEAU_REGROUPEMENT = "inclut_une_commune_rattachee"
STATUTS_REGROUPES = {"W"}

FICHE = {
    "libelle": "Décès domiciliés",
    "public": "Le nombre de personnes domiciliées dans la commune qui sont décédées"
    " dans l'année, quel que soit le lieu de leur décès. Ce n'est pas le nombre de"
    " décès survenus sur place : une commune qui a un hôpital n'est pas surchargée.",
    "technique": "Décès domiciliés, état civil, mesure DTH du jeu « Nombre de décès"
    " annuels par commune ». À distinguer des décès enregistrés quel que soit le"
    " domicile du défunt, publiés ailleurs par l'INSEE. Les événements de Mayotte"
    " sont inclus depuis 2014. Pour Lyon et Marseille, les décès dont"
    " l'arrondissement de domicile n'est pas renseigné sont regroupés par la source"
    " dans un code dédié, non chargé ici. Un décompte brut, qui dépend d'abord de"
    " la structure par âge du territoire : ce n'est pas un indicateur de santé.",
    "formule": "Décès de l'année des personnes domiciliées sur le territoire",
}


class TotalIncoherent(RuntimeError):
    """La somme des communes ne fait pas le total France de la source.

    Une part des décès ne serait alors rattachée à aucune commune, et la carte
    montrerait un pays qui perd moins d'habitants qu'il n'en perd.
    """


def lire(archive: bytes) -> list[dict]:
    """CSV zippé de l'INSEE -> lignes retenues, avec leur maille."""
    with zipfile.ZipFile(io.BytesIO(archive)) as zip_:
        nom = next(n for n in zip_.namelist() if n.endswith("_data.csv"))
        with zip_.open(nom) as fichier:
            lecteur = csv.DictReader(
                io.TextIOWrapper(fichier, encoding="utf-8"), delimiter=";"
            )
            return [
                {
                    "niveau": NIVEAUX[rang["GEO_OBJECT"]],
                    "code": rang["GEO"],
                    "periode": rang["TIME_PERIOD"],
                    "valeur": float(rang["OBS_VALUE"]),
                    "drapeaux": (
                        [DRAPEAU_REGROUPEMENT]
                        if rang["OBS_STATUS"] in STATUTS_REGROUPES
                        else []
                    ),
                }
                for rang in lecteur
                if rang["GEO_OBJECT"] in NIVEAUX and rang["OBS_VALUE"]
            ]


def totaux_france(archive: bytes) -> dict[str, float]:
    """{exercice: total France entière}, tel que la source le publie."""
    with zipfile.ZipFile(io.BytesIO(archive)) as zip_:
        nom = next(n for n in zip_.namelist() if n.endswith("_data.csv"))
        with zip_.open(nom) as fichier:
            lecteur = csv.DictReader(
                io.TextIOWrapper(fichier, encoding="utf-8"), delimiter=";"
            )
            return {
                rang["TIME_PERIOD"]: float(rang["OBS_VALUE"])
                for rang in lecteur
                if rang["GEO_OBJECT"] == "FRANCE" and rang["GEO"] == FRANCE
                and rang["OBS_VALUE"]
            }


def controler(lignes: list[dict], totaux: dict[str, float]) -> dict[str, float]:
    """Somme des communes contre total France, exercice par exercice.

    -> les écarts constatés, vides si tout se referme. Lève si un exercice
    s'écarte : c'est un défaut de rattachement, pas un arrondi.
    """
    sommes: dict[str, float] = {}
    for ligne in lignes:
        if ligne["niveau"] == "commune":
            sommes[ligne["periode"]] = sommes.get(ligne["periode"], 0.0) + ligne["valeur"]
    ecarts = {
        periode: sommes[periode] - total
        for periode, total in totaux.items()
        if periode in sommes and abs(sommes[periode] - total) > 0.5
    }
    if ecarts:
        detail = ", ".join(f"{p} : {e:+.0f}" for p, e in sorted(ecarts.items())[:5])
        raise TotalIncoherent(
            f"la somme des communes ne fait pas le total France ({detail})."
            " Une part des décès n'est plus rattachée à une commune."
        )
    return ecarts


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        definition = curseur.execute(
            """
            insert into core.indicator_definitions
                (public_definition, technical_definition, formula, unit_notes,
                 confidence_level, badges)
            values (?, ?, ?, 'personnes domiciliées', 'observed',
                    array['Officiel','Donnée brute'])
            returning definition_id
            """,
            (FICHE["public"], FICHE["technique"], FICHE["formule"]),
        ).fetchone()[0]
        curseur.execute(
            """
            insert into core.indicators
                (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                 additive, geo_levels, time_granularity, published)
            values (?, ?, ?, 'population', ?, 'count', true,
                    array['commune','epci','departement','region'], 'annuelle', true)
            on conflict (indicator_id) do update set
                definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                theme = excluded.theme, published = true
            """,
            (INDICATEUR, DATASET, definition, FICHE["libelle"]),
        )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def ecrire(conn, run_id: str, lignes: list[dict]) -> tuple[int, int]:
    drapeaux = {
        (ligne["niveau"], ligne["code"], ligne["periode"]): ligne["drapeaux"]
        for ligne in lignes
        if ligne["drapeaux"]
    }
    candidates = [
        (INDICATEUR, ligne["niveau"], ligne["code"], ligne["periode"], ligne["valeur"])
        for ligne in lignes
    ]
    gardees, ecartes = filtrer_territoires_connus(conn, candidates)
    with conn.cursor() as curseur:
        curseur.execute("delete from core.observations where indicator_id = ?", (INDICATEUR,))
        entrepot.copier(
            conn,
            "core.observations",
            ["indicator_id", "geo_level", "geo_code", "geo_vintage", "period", "value",
             "quality_flags", "run_id"],
            (
                (cle, niveau, code, MILLESIME, periode, valeur,
                 drapeaux.get((niveau, code, periode), []), run_id)
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
        archive = telecharger(URL, timeout=300)
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "deces-communes.zip", archive, URL,
            "application/zip",
        )
        lignes = lire(archive)
        if not lignes:
            raise ValueError("aucun décès lu")
        totaux = totaux_france(archive)
        controler(lignes, totaux)
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'somme_communes_egale_total_france', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                "exercices": len(totaux), "dernier": max(totaux),
                "total_france": totaux[max(totaux)],
            })),
        )
        conn.commit()
        ecrites, ecartes = ecrire(conn, run_id, lignes)
        entrepot.finish_run(conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites)
        periodes = sorted({ligne["periode"] for ligne in lignes})
        print(
            f"décès domiciliés : {ecrites} observations, {periodes[0]} → {periodes[-1]},"
            f" {ecartes} hors référentiel ; total France {max(totaux)} :"
            f" {totaux[max(totaux)]:.0f}"
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
