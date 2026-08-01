"""Établissements par territoire (INSEE, SIDE) vers core.observations.

« Combien d'entreprises dans ma commune ? » n'a pas une seule réponse, et le
choix entre les deux disponibles change le chiffre du tout au tout.

**Unités locales, pas unités légales.** Une unité légale est une entreprise,
comptée là où elle est immatriculée ; une unité locale est un établissement,
compté là où il travaille. Une chaîne de magasins immatriculée à Paris a des
établissements partout : la compter à Paris seulement viderait la carte de
France de son activité. C'est donc l'unité locale qui est publiée, et la fiche
le dit.

**Un stock, pas un flux.** Ce chiffre est le nombre d'établissements existants à
une date, pas le nombre de créations de l'année. Les deux se confondent
facilement et ne racontent pas la même chose.

**Toutes activités confondues.** La source décline par section d'activité ; seul
le total (`_T`) est chargé. Publier les sections multiplierait le volume par dix
pour une lecture que la fiche ne propose pas encore.

Usage : python -m plateforme.normalize.entreprises [--annee 2023] [--store …]
"""

import argparse
import json

from plateforme import db
from plateforme.connectors import insee, melodi
from plateforme.normalize.geo import MILLESIME, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "melodi-side-stocks"
SOURCE = "insee-melodi"
JEU = "DS_SIDE_STOCKS_COM"
MESURE = "UNIT_LOC"  # unités locales : les établissements, là où ils travaillent
ACTIVITE = "_T"  # toutes activités confondues

INDICATEUR = "insee_etablissements_actifs"
FICHE = {
    "libelle": "Établissements actifs",
    "public": "Le nombre d'établissements présents sur le territoire : magasins,"
    " ateliers, bureaux, exploitations. Un établissement est compté là où il"
    " travaille, et non au siège de l'entreprise qui le détient.",
    "technique": "Stock d'unités locales actives au 31 décembre, toutes activités"
    " confondues, source SIDE (Système d'information sur la démographie des"
    " entreprises).",
    "formule": "Nombre d'unités locales actives, toutes sections d'activité",
}


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        definition = curseur.execute(
            """
            insert into core.indicator_definitions
                (public_definition, technical_definition, formula, confidence_level, badges)
            values (%s, %s, %s, 'observed', array['Officiel','Donnée brute'])
            returning definition_id
            """,
            (FICHE["public"], FICHE["technique"], FICHE["formule"]),
        ).fetchone()[0]
        curseur.execute(
            """
            insert into core.indicators
                (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                 additive, geo_levels, time_granularity, published)
            values (%s, %s, %s, 'entreprises', %s, 'count', true,
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
    candidates = [
        (INDICATEUR, ligne["niveau"], ligne["code"], ligne["periode"], ligne["valeur"])
        for ligne in lignes
    ]
    gardees, ecartes = filtrer_territoires_connus(conn, candidates)
    with conn.cursor() as curseur:
        curseur.execute("delete from core.observations where indicator_id = %s", (INDICATEUR,))
        with curseur.copy(
            "copy core.observations (indicator_id, geo_level, geo_code, geo_vintage,"
            " period, value, run_id) from stdin"
        ) as copie:
            for cle, niveau, code, periode, valeur in gardees:
                copie.write_row((cle, niveau, code, MILLESIME, periode, valeur, run_id))
    conn.commit()
    return len(gardees), len(ecartes)


def run(annee: int, store_spec: str) -> int:
    conn = db.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = db.start_run(conn, DATASET, "manual")
    try:
        params = {"SIDE_MEASURE": MESURE, "ACTIVITY": ACTIVITE, "TIME_PERIOD": str(annee)}
        observations = melodi.pages(JEU, params)
        url = (
            f"{insee.MELODI_BASE}/data/{JEU}?SIDE_MEASURE={MESURE}"
            f"&ACTIVITY={ACTIVITE}&TIME_PERIOD={annee}"
        )
        db.record_asset(
            conn, store, run_id, DATASET, SOURCE, f"unites-locales-{annee}.json",
            json.dumps({"observations": observations}).encode(), url, "application/json",
        )
        lignes = melodi.valeurs(observations)
        if not lignes:
            raise ValueError(f"aucun établissement lu pour {annee}")
        ecrites, ecartes = ecrire(conn, run_id, lignes)
        db.finish_run(conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites)
        communes = sum(1 for ligne in lignes if ligne["niveau"] == "commune")
        print(f"établissements {annee} : {ecrites} observations, {communes} communes")
        if ecartes:
            print(f"{ecartes} territoires absents du référentiel, écartés")
        return 0
    except Exception as error:  # noqa: BLE001 — tout échec finit tracé dans le lineage
        db.finish_run(conn, run_id, "failed", error=str(error))
        raise
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--annee", type=int, default=2023)
    parser.add_argument("--store", default=".snapshots")
    arguments = parser.parse_args()
    return run(arguments.annee, arguments.store)


if __name__ == "__main__":
    raise SystemExit(main())
