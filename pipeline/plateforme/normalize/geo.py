"""T-11 — Référentiel géographique : COG INSEE + population/EPCI, vers geo.*.

Un seul run couvre la chaîne : snapshots immuables des fichiers officiels, puis
écriture du référentiel et de l'historique territorial. Les deux vont ensemble —
un référentiel sans son historique laisserait comparer des millésimes
incomparables (docs/00, principe 6).

Usage : python -m plateforme.normalize.geo [--store r2:plateforme-raw]
"""

import argparse
import json

from psycopg.types.json import Jsonb

from plateforme import db
from plateforme.connectors import cog
from plateforme.http import fetch
from plateforme.store import LocalStore, R2Store

MILLESIME = 2025
PUBLICATION = "8377162"  # identifiant INSEE du COG 2025 (meta.dataset_registry)
API_GEO = "https://geo.api.gouv.fr"

# Collectivités à statut particulier qui exercent les compétences d'un
# département sans en être un au Code officiel géographique. Les omettre
# reviendrait à effacer l'Alsace et la métropole lyonnaise des cartes
# départementales — 3,4 millions d'habitants. Codes et périmètres repris de
# l'OFGL, qui les traite à ce niveau ; sans chevauchement avec les départements
# classiques (l'Alsace se substitue au Bas-Rhin et au Haut-Rhin sur tout
# l'historique publié, la Métropole de Lyon complète le Rhône depuis 2015).
STATUT_PARTICULIER = [
    ("67A", "Collectivité européenne d'Alsace", "44"),
    ("691", "Métropole de Lyon", "84"),
]

# Établissements publics territoriaux de la Métropole du Grand Paris. Ce ne sont
# pas des EPCI à fiscalité propre — l'API Géo ne les liste donc pas — mais ils
# portent des budgets réels pour environ quatre millions d'habitants. ATTENTION :
# leur périmètre est inclus dans celui de la Métropole du Grand Paris ; les deux
# niveaux ne doivent jamais être additionnés.
TERRITOIRES_GRAND_PARIS = [
    ("200057867", "Plaine Commune"),
    ("200057875", "Est Ensemble"),
    ("200057941", "Paris-Est-Marne et Bois"),
    ("200057966", "Vallée Sud Grand Paris"),
    ("200057974", "Grand Paris Seine Ouest"),
    ("200057982", "Paris Ouest La Défense"),
    ("200057990", "Boucle Nord de Seine"),
    ("200058006", "Grand Paris Sud Est Avenir"),
    ("200058014", "Grand-Orly Seine Bièvre"),
    ("200058097", "Paris Terres d'Envol"),
    ("200058790", "Grand Paris - Grand Est"),
]

FICHIERS = {
    "communes": f"v_commune_{MILLESIME}.csv",
    "mouvements": f"v_mvt_commune_{MILLESIME}.csv",
    "departements": f"v_departement_{MILLESIME}.csv",
    "regions": f"v_region_{MILLESIME}.csv",
}


def make_store(spec: str):
    if spec.startswith("r2:"):
        return R2Store.from_env(spec.removeprefix("r2:"))
    return LocalStore(spec)


def collecter(conn, store, run_id: str) -> dict[str, bytes]:
    """Archive chaque fichier source et renvoie son contenu."""
    contenus = {}
    for nom, fichier in FICHIERS.items():
        url = cog.url_fichier(PUBLICATION, fichier)
        contenu = fetch(url, timeout=180).content
        db.record_asset(
            conn, store, run_id, "cog-communes", "insee-fichiers", fichier, contenu, url, "text/csv"
        )
        contenus[nom] = contenu

    url = f"{API_GEO}/communes?fields=code,population,codeEpci,siren&format=json"
    contenu = fetch(url, timeout=180).content
    db.record_asset(
        conn, store, run_id, "geo-api-communes", "api-geo", "communes.json", contenu, url,
        "application/json",
    )
    contenus["api_communes"] = contenu

    url = f"{API_GEO}/epcis?fields=code,nom,population"
    contenu = fetch(url, timeout=180).content
    db.record_asset(
        conn, store, run_id, "geo-api-epci", "api-geo", "epcis.json", contenu, url,
        "application/json",
    )
    contenus["api_epci"] = contenu
    return contenus


def construire(contenus: dict[str, bytes]) -> tuple[list[dict], list[dict]]:
    """-> (territoires, événements) prêts à insérer."""
    communes_api = {c["code"]: c for c in json.loads(contenus["api_communes"])}

    territoires = [
        {
            "geo_level": "pays",
            "geo_code": "FR",
            "vintage": MILLESIME,
            "name": "France",
            "parent_level": None,
            "parent_code": None,
        }
    ]

    for ligne in cog.lire_csv(contenus["regions"]):
        territoires.append(
            {
                "geo_level": "region",
                "geo_code": ligne["REG"],
                "vintage": MILLESIME,
                "name": ligne["LIBELLE"],
                "parent_level": "pays",
                "parent_code": "FR",
            }
        )

    for ligne in cog.lire_csv(contenus["departements"]):
        territoires.append(
            {
                "geo_level": "departement",
                "geo_code": ligne["DEP"],
                "vintage": MILLESIME,
                "name": ligne["LIBELLE"],
                "parent_level": "region",
                "parent_code": ligne["REG"],
            }
        )

    for code, nom, region in STATUT_PARTICULIER:
        territoires.append(
            {
                "geo_level": "departement",
                "geo_code": code,
                "vintage": MILLESIME,
                "name": nom,
                "parent_level": "region",
                "parent_code": region,
                "flags": {"statut_particulier": True, "source": "OFGL"},
            }
        )

    for epci in json.loads(contenus["api_epci"]):
        territoires.append(
            {
                "geo_level": "epci",
                "geo_code": epci["code"],
                "vintage": MILLESIME,
                "name": epci["nom"],
                # Un EPCI peut chevaucher deux départements : pas de parent unique.
                "parent_level": None,
                "parent_code": None,
                "siren": epci["code"],
                "population": epci.get("population"),
            }
        )

    for code, nom in TERRITOIRES_GRAND_PARIS:
        territoires.append(
            {
                "geo_level": "epci",
                "geo_code": code,
                "vintage": MILLESIME,
                "name": nom,
                "parent_level": None,
                "parent_code": None,
                "siren": code,
                "flags": {
                    "type": "EPT",
                    "inclus_dans": "Métropole du Grand Paris",
                    "source": "OFGL",
                },
            }
        )

    for territoire in cog.territoires(cog.lire_csv(contenus["communes"]), MILLESIME):
        commune = communes_api.get(territoire["geo_code"], {})
        territoire["population"] = commune.get("population")
        territoire["siren"] = commune.get("siren")
        territoires.append(territoire)

    populations = {code: (c.get("population") or 0) for code, c in communes_api.items()}
    evenements = cog.parts_de_scission(
        cog.mouvements(cog.lire_csv(contenus["mouvements"])), populations
    )
    return territoires, evenements


def ecrire(conn, territoires: list[dict], evenements: list[dict]) -> tuple[int, int]:
    with conn.cursor() as cur:
        cur.executemany(
            """
            insert into geo.geography_reference
                (geo_level, geo_code, vintage, name, parent_level, parent_code,
                 siren, population, flags)
            values (%(geo_level)s, %(geo_code)s, %(vintage)s, %(name)s,
                    %(parent_level)s, %(parent_code)s, %(siren)s, %(population)s, %(flags)s)
            on conflict (geo_level, geo_code, vintage) do update set
                name = excluded.name, parent_level = excluded.parent_level,
                parent_code = excluded.parent_code, siren = excluded.siren,
                population = excluded.population, flags = excluded.flags
            """,
            [
                {"siren": None, "population": None, "flags": Jsonb({}), **t}
                for t in (
                    {**t, "flags": Jsonb(t["flags"])} if "flags" in t else t for t in territoires
                )
            ],
        )
        # Rechargement complet de l'historique : la source republie l'intégralité
        # des mouvements à chaque millésime, un delta serait plus fragile.
        cur.execute("delete from geo.geography_history")
        cur.executemany(
            """
            insert into geo.geography_history
                (event_type, event_date, from_level, from_code, from_vintage,
                 to_level, to_code, to_vintage, population_share, source)
            values (%(event_type)s, %(event_date)s, %(from_level)s, %(from_code)s,
                    %(from_vintage)s, %(to_level)s, %(to_code)s, %(to_vintage)s,
                    %(population_share)s, 'COG INSEE — mouvements communaux')
            """,
            [{"population_share": None, **e} for e in evenements],
        )
    conn.commit()
    return len(territoires), len(evenements)


def run(store_spec: str) -> int:
    conn = db.connect()
    run_id = db.start_run(conn, "cog-communes", "manual")
    try:
        contenus = collecter(conn, make_store(store_spec), run_id)
        territoires, evenements = construire(contenus)
        n_territoires, n_evenements = ecrire(conn, territoires, evenements)
        db.finish_run(conn, run_id, "success", rows_written=n_territoires + n_evenements)
        print(f"référentiel : {n_territoires} territoires, {n_evenements} mouvements")
        return 0
    except Exception as error:  # noqa: BLE001 — tout échec doit finir tracé dans le lineage
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
