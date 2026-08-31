"""Indices annuels INSEE des fournitures scolaires et de l'IPC d'ensemble.

Les deux series sont des indices base 2015, pas des montants en euros. Elles
restent separees et ne servent jamais a fabriquer un cout de rentree. Seules
leurs annees communes sont publiees afin que la comparaison ne repose ni sur
une interpolation ni sur le raccord d'une autre base.

Usage : python -m plateforme.normalize.fournitures_scolaires [--store .snapshots]
"""

import argparse
import re
import unicodedata
from dataclasses import dataclass

from plateforme import entrepot, revisions
from plateforme.connectors import insee, sdmx
from plateforme.normalize.geo import MILLESIME, make_store


SOURCE = "insee-bdm"
SERIES = {
    "fournitures": "001765036",
    "ensemble": "001764363",
}
DATASETS = {
    "fournitures": "bdm-fournitures-001765036",
    "ensemble": "bdm-ipc-ensemble-001764363",
}
INDICATEURS = {
    "fournitures": "insee_ipc_fournitures_scolaires_base_2015",
    "ensemble": "insee_ipc_ensemble_annuel_base_2015",
}

PREMIERE_ANNEE = "1990"
DERNIERE_ANNEE = "2025"
UNITE = "index_2015_100"
FREQUENCE = "A"
ZONE = "FE"
UNITE_SOURCE = "SO"
BASE = "2015"

FICHES = {
    "fournitures": {
        "libelle": "Indice des prix des fournitures scolaires",
        "public": "L'evolution des prix des autres fournitures scolaires et de bureau. Cet indice"
        " ne mesure ni un panier complet ni le cout total de la rentree scolaire.",
        "technique": "IPC annuel base 2015, ensemble des menages, France, poste COICOP"
        " 09.5.4.9.2 Autres fournitures scolaires et de bureau. Serie arretee en 2025,"
        " conservee sur sa base native sans raccord avec la base 2025.",
    },
    "ensemble": {
        "libelle": "Indice des prix a la consommation, ensemble",
        "public": "L'evolution annuelle de l'indice general des prix pour l'ensemble des menages"
        " en France, utilisee ici comme repere de comparaison.",
        "technique": "IPC annuel d'ensemble base 2015, ensemble des menages, France. Serie"
        " arretee en 2025, conservee sur sa base native sans raccord avec la base 2025.",
    },
}

_ANNEE = re.compile(r"^\d{4}$")
_MENAGES_DIMENSIONS = ("TPH_CPI", "HOUSEHOLD", "POPULATION", "REF_POPULATION")
_TOUS_MENAGES = {"_T", "T", "ALL", "ENSEMBLE"}


class SourceInattendue(ValueError):
    """La reponse BDM ne correspond plus a la serie declaree."""


@dataclass(frozen=True)
class PointIndice:
    periode: str
    valeur: float
    statut: str | None
    value_status: str
    drapeaux: tuple[str, ...]


@dataclass(frozen=True)
class SerieIndice:
    cle: str
    dataset_id: str
    identifiant: str
    titre: str
    points: tuple[PointIndice, ...]


def _sans_accents(texte: str) -> str:
    normalise = unicodedata.normalize("NFKD", texte)
    return "".join(caractere for caractere in normalise if not unicodedata.combining(caractere))


def _verifier_identite(cle: str, attributs: dict[str, str]) -> None:
    attendu = SERIES[cle]
    if attributs.get("IDBANK") != attendu:
        raise SourceInattendue(
            f"identifiant BDM {attributs.get('IDBANK')!r} au lieu de {attendu!r}"
        )
    if attributs.get("FREQ") != FREQUENCE:
        raise SourceInattendue("frequence annuelle A attendue")
    if attributs.get("UNIT_MEASURE") != UNITE_SOURCE:
        raise SourceInattendue("unite SO de l'indice base 2015 attendue")
    if attributs.get("UNIT_MULT") not in (None, "", "0"):
        raise SourceInattendue("les valeurs brutes exigent UNIT_MULT=0")
    if attributs.get("REF_AREA") != ZONE:
        raise SourceInattendue("zone France FE attendue")

    for dimension in _MENAGES_DIMENSIONS:
        valeur = attributs.get(dimension)
        if valeur is not None and valeur.upper() not in _TOUS_MENAGES:
            raise SourceInattendue(
                f"ensemble des menages attendu, {dimension}={valeur!r} recu"
            )

    base_dimension = attributs.get("BASE_PER")
    if base_dimension is not None and base_dimension != BASE:
        raise SourceInattendue("base 2015 attendue, raccord avec une autre base interdit")

    titre = _sans_accents(attributs.get("TITLE_FR", "")).lower()
    fragments = ["indice annuel des prix a la consommation", "base 2015", "ensemble des menages"]
    if cle == "fournitures":
        fragments.extend(["09.5.4.9.2", "autres fournitures scolaires et de bureau"])
    else:
        fragments.append("france - ensemble")
    manquants = [fragment for fragment in fragments if fragment not in titre]
    if manquants:
        raise SourceInattendue(
            "titre incompatible avec la base 2015 : " + ", ".join(manquants)
        )


def _statut(statut: str | None) -> tuple[str, tuple[str, ...]]:
    if statut in (None, "A"):
        return "normal", ()
    return "provisional", (f"insee_obs_status:{statut}",)


def lire(cle: str, contenu: bytes) -> SerieIndice:
    """Lit une reponse SDMX BDM et bloque toute ambiguite de serie ou de base."""
    if cle not in SERIES:
        raise KeyError(f"serie inconnue : {cle}")
    entrees = sdmx.series(contenu)
    if len(entrees) != 1:
        raise SourceInattendue(
            f"une seule serie BDM attendue pour {SERIES[cle]}, {len(entrees)} recue(s)"
        )
    entree = entrees[0]
    attributs = entree["attributs"]
    _verifier_identite(cle, attributs)

    points = []
    periodes = set()
    for observation in entree["observations"]:
        periode = observation["periode"]
        if not _ANNEE.fullmatch(periode):
            raise SourceInattendue(f"periode annuelle YYYY attendue, {periode!r} recue")
        if periode in periodes:
            raise SourceInattendue(f"doublon pour la periode {periode}")
        periodes.add(periode)
        value_status, drapeaux = _statut(observation["statut"])
        points.append(
            PointIndice(
                periode=periode,
                valeur=observation["valeur"],
                statut=observation["statut"],
                value_status=value_status,
                drapeaux=drapeaux,
            )
        )

    par_periode = {point.periode: point for point in points}
    if "2015" not in par_periode or abs(par_periode["2015"].valeur - 100.0) > 1e-9:
        raise SourceInattendue("l'indice de l'annee 2015 doit valoir 100")
    return SerieIndice(
        cle=cle,
        dataset_id=DATASETS[cle],
        identifiant=SERIES[cle],
        titre=attributs["TITLE_FR"],
        points=tuple(sorted(points, key=lambda point: point.periode)),
    )


def intersection(series: dict[str, SerieIndice]) -> dict[str, tuple[PointIndice, ...]]:
    """Conserve les seules annees communes de 1990 a 2025, sans interpolation."""
    if set(series) != set(SERIES):
        raise SourceInattendue("les deux series fournitures et ensemble sont requises")
    index = {
        cle: {point.periode: point for point in serie.points}
        for cle, serie in series.items()
    }
    communes = set.intersection(*(set(points) for points in index.values()))
    periodes = sorted(
        periode
        for periode in communes
        if PREMIERE_ANNEE <= periode <= DERNIERE_ANNEE
    )
    if not periodes:
        raise SourceInattendue("aucune annee commune entre les deux series")
    return {
        cle: tuple(index[cle][periode] for periode in periodes)
        for cle in SERIES
    }


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for cle, fiche in FICHES.items():
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, 'Indice annuel, base 2015 = 100',
                        'Indice sans unite. Ce n est pas un montant en euros.',
                        'observed', array['Officiel','Donnee brute','Serie arretee'])
                returning definition_id
                """,
                (fiche["public"], fiche["technique"]),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, accounting_frame, geo_levels, time_granularity,
                     first_period, last_period, published)
                values (?, ?, ?, 'prix', ?, ?, false, 'nationale', array['pays'],
                        'annuelle', ?, ?, true)
                on conflict (indicator_id) do update set
                    dataset_id = excluded.dataset_id,
                    definition_id = excluded.definition_id,
                    label_fr = excluded.label_fr,
                    unit = excluded.unit,
                    additive = false,
                    first_period = excluded.first_period,
                    last_period = excluded.last_period,
                    published = true
                """,
                (
                    INDICATEURS[cle],
                    DATASETS[cle],
                    definition,
                    fiche["libelle"],
                    UNITE,
                    PREMIERE_ANNEE,
                    DERNIERE_ANNEE,
                ),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def lignes_a_ecrire(cle: str, points: tuple[PointIndice, ...]) -> list[tuple]:
    return [
        (
            INDICATEURS[cle],
            "pays",
            "FR",
            MILLESIME,
            point.periode,
            point.valeur,
            point.value_status,
            list(point.drapeaux),
        )
        for point in points
    ]


def ecrire(conn, run_id: str, cle: str, points: tuple[PointIndice, ...]) -> tuple[int, int]:
    resultat = revisions.remplacer(
        conn,
        run_id,
        [INDICATEURS[cle]],
        ("value", "value_status", "quality_flags"),
        lignes_a_ecrire(cle, points),
    )
    conn.commit()
    return resultat


def ingester(conn, store) -> int:
    """Telecharge et archive chaque BDM dans son propre run, puis publie l'intersection."""
    declarer(conn)
    runs: dict[str, str] = {}
    termines: set[str] = set()
    lues: dict[str, SerieIndice] = {}
    try:
        for cle, identifiant in SERIES.items():
            dataset_id = DATASETS[cle]
            run_id = entrepot.start_run(conn, dataset_id, "manual")
            runs[cle] = run_id
            chemin = f"SERIES_BDM/{identifiant}"
            contenu = insee.bdm_sdmx(chemin)
            adresse = f"{insee.BDM_BASE}/data/{chemin}"
            entrepot.record_asset(
                conn,
                store,
                run_id,
                dataset_id,
                SOURCE,
                f"{identifiant}.xml",
                contenu,
                adresse,
                "application/xml",
            )
            lues[cle] = lire(cle, contenu)

        communes = intersection(lues)
        total = 0
        ecrites_par_serie = {}
        for cle, points in communes.items():
            ecrites, _ = ecrire(conn, runs[cle], cle, points)
            ecrites_par_serie[cle] = ecrites
            total += ecrites
        for cle, run_id in runs.items():
            entrepot.finish_run(
                conn,
                run_id,
                "success",
                rows_read=len(lues[cle].points),
                rows_written=ecrites_par_serie[cle],
            )
            termines.add(cle)
        return total
    except Exception as error:
        for cle, run_id in runs.items():
            if cle not in termines:
                entrepot.finish_run(conn, run_id, "failed", error=str(error))
        raise


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    try:
        total = ingester(conn, make_store(store_spec))
        print(
            f"fournitures scolaires : {total} observations, "
            f"annees communes {PREMIERE_ANNEE} a {DERNIERE_ANNEE}"
        )
        return 0
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--store", default=".snapshots")
    return run(parser.parse_args().store)


if __name__ == "__main__":
    raise SystemExit(main())
