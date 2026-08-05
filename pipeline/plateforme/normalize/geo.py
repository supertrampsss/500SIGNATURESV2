"""T-11 — Référentiel géographique : COG INSEE + population, vers geo.*.

Un seul run couvre la chaîne : snapshots immuables des fichiers officiels, puis
écriture du référentiel et de l'historique territorial. Les deux vont ensemble —
un référentiel sans son historique laisserait comparer des millésimes
incomparables (docs/00, principe 6).

Usage : python -m plateforme.normalize.geo [--store r2:plateforme-raw]
"""

import argparse
import json


from plateforme import entrepot
from plateforme.connectors import cog
from plateforme.http import telecharger
from plateforme.store import LocalStore, R2Store

MILLESIME = 2025
PUBLICATION = "8377162"  # identifiant INSEE du COG 2025 (meta.dataset_registry)
API_GEO = "https://geo.api.gouv.fr"


def commune_mere(code: str) -> str | None:
    """Commune de rattachement d'un arrondissement municipal, sinon None.

    Paris, Lyon et Marseille apparaissent dans plusieurs sources **deux fois**
    — la commune entière et ses arrondissements — ou seulement par
    arrondissement. Les plages sont celles de la loi PLM, stables depuis 1982 ;
    les centraliser ici évite qu'un connecteur les recopie de travers (la
    borne départementale de la délinquance a écarté Marseille pour ça, et
    l'APL de la DREES ne connaît que les arrondissements)."""
    if "75101" <= code <= "75120":
        return "75056"
    if "69381" <= code <= "69389":
        return "69123"
    if "13201" <= code <= "13216":
        return "13055"
    return None

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
        contenu = telecharger(url, timeout=180)
        entrepot.record_asset(
            conn, store, run_id, "cog-communes", "insee-fichiers", fichier, contenu, url, "text/csv"
        )
        contenus[nom] = contenu

    url = f"{API_GEO}/communes?fields=code,population,siren&format=json"
    contenu = telecharger(url, timeout=180)
    entrepot.record_asset(
        conn, store, run_id, "geo-api-communes", "api-geo", "communes.json", contenu, url,
        "application/json",
    )
    contenus["api_communes"] = contenu
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
            values ($geo_level, $geo_code, $vintage, $name,
                    $parent_level, $parent_code, $siren, $population, $flags)
            on conflict (geo_level, geo_code, vintage) do update set
                name = excluded.name, parent_level = excluded.parent_level,
                parent_code = excluded.parent_code, siren = excluded.siren,
                population = excluded.population, flags = excluded.flags
            """,
            [
                {"siren": None, "population": None, "flags": json.dumps({}), **t}
                for t in (
                    {**t, "flags": json.dumps(t["flags"])} if "flags" in t else t for t in territoires
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
            values ($event_type, $event_date, $from_level, $from_code,
                    $from_vintage, $to_level, $to_code, $to_vintage,
                    $population_share, 'COG INSEE — mouvements communaux')
            """,
            [{"population_share": None, **e} for e in evenements],
        )
    conn.commit()
    return len(territoires), len(evenements)


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    run_id = entrepot.start_run(conn, "cog-communes", "manual")
    try:
        contenus = collecter(conn, make_store(store_spec), run_id)
        territoires, evenements = construire(contenus)
        n_territoires, n_evenements = ecrire(conn, territoires, evenements)
        entrepot.finish_run(conn, run_id, "success", rows_written=n_territoires + n_evenements)
        print(f"référentiel : {n_territoires} territoires, {n_evenements} mouvements")
        return 0
    except Exception as error:  # noqa: BLE001 — tout échec doit finir tracé dans le lineage
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
