"""Population municipale (INSEE, recensement) vers core.observations.

« Ma commune gagne-t-elle ou perd-elle des habitants ? » est la question
démographique que tout le monde se pose, et elle demande deux points dans le
temps, pas un. Deux millésimes espacés de dix ans sont chargés : assez pour
montrer une trajectoire, assez peu pour tenir dans la base (D6bis).

**Population municipale, pas population totale.** L'INSEE publie aussi une
population « totale » qui ajoute les personnes comptées à part (étudiants,
militaires logés ailleurs). La population municipale est celle des dotations et
des seuils légaux : c'est elle qui sert de dénominateur partout ailleurs sur ce
site, et mélanger les deux ferait bouger des ratios sans raison.

**Millésime et année de publication ne sont pas la même chose.** Le millésime
2023 est publié fin 2025 : une population « 2023 » n'est pas une population
d'aujourd'hui, et l'écart se voit sur la fiche.

Usage : python -m plateforme.normalize.population [--store r2:plateforme-raw]
"""

import argparse
import json

from plateforme import db
from plateforme.connectors import insee, melodi
from plateforme.normalize.geo import MILLESIME, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "melodi-populations-historiques"
SOURCE = "insee-melodi"
JEU = "DS_POPULATIONS_HISTORIQUES"
MESURE = "PMUN"  # population municipale

# Deux points, dix ans d'écart. Charger toute la série depuis 1968 coûterait
# huit cent mille lignes pour une question à laquelle deux points répondent.
MILLESIMES = ["2013", "2023"]

INDICATEUR = "insee_population_municipale"
FICHE = {
    "libelle": "Population municipale",
    "public": "Le nombre d'habitants recensés par l'INSEE. C'est le chiffre qui sert"
    " au calcul des dotations et des seuils légaux. Le millésime indiqué est celui"
    " du recensement, publié environ deux ans plus tard.",
    "technique": "Population municipale au sens du recensement, mesure PMUN du jeu"
    " des populations historiques.",
    "formule": "Population municipale légale du millésime",
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
            values (%s, %s, %s, 'population', %s, 'count', true,
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


def run(store_spec: str) -> int:
    conn = db.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = db.start_run(conn, DATASET, "manual")
    try:
        lignes: list[dict] = []
        for millesime in MILLESIMES:
            params = {"POPREF_MEASURE": MESURE, "TIME_PERIOD": millesime}
            observations = melodi.pages(JEU, params)
            url = f"{insee.MELODI_BASE}/data/{JEU}?POPREF_MEASURE={MESURE}&TIME_PERIOD={millesime}"
            db.record_asset(
                conn, store, run_id, DATASET, SOURCE, f"pmun-{millesime}.json",
                json.dumps({"observations": observations}).encode(), url, "application/json",
            )
            lot = melodi.valeurs(observations)
            print(f"{millesime} : {len(lot)} territoires")
            lignes.extend(lot)
        if not lignes:
            raise ValueError("aucune population lue")
        ecrites, ecartes = ecrire(conn, run_id, lignes)
        db.finish_run(conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites)
        print(f"population : {ecrites} observations, {ecartes} hors référentiel")
        return 0
    except Exception as error:  # noqa: BLE001 — tout échec finit tracé dans le lineage
        db.finish_run(conn, run_id, "failed", error=str(error))
        raise
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--store", default=".snapshots")
    return run(parser.parse_args().store)


if __name__ == "__main__":
    raise SystemExit(main())
