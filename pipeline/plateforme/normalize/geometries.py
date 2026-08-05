"""T-18 — Géométries administratives et tuiles vectorielles.

Les contours viennent de l'API Géo (IGN Admin Express, Licence Ouverte). Le
produit fini est un fichier PMTiles unique déposé dans R2 : la carte le lit par
requêtes de plage à travers le CDN, sans serveur de tuiles.

Les géométries communales ne sont PAS chargées dans Supabase : elles pèsent
plusieurs centaines de mégaoctets, la base n'en a besoin pour aucune requête du
MVP (le géocodage BAN rend déjà un code INSEE), et le plan gratuit n'a pas la
place (décision D6bis). Elles vivent dans R2, versionnées et rejouables.

Usage : python -m plateforme.normalize.geometries [--store r2:plateforme-raw]
                [--publication r2:plateforme-published] [--departements 33,75]
"""

import argparse
import json
import subprocess
import tempfile
from datetime import UTC, datetime
from pathlib import Path

from plateforme import entrepot
from plateforme.http import fetch
from plateforme.normalize.geo import API_GEO, make_store

DATASET = "admin-express-cog"

COUCHES = ["communes", "departements", "regions"]
ZOOM = {"regions": (0, 8), "departements": (4, 10), "communes": (8, 12)}

METROPOLE_DE_LYON = "200046977"


def contours_communes(departements: list[str]) -> list[dict]:
    """L'API Géo ne sert de contours qu'au niveau communal, et département par
    département : demander les 34 875 communes d'un coup échoue."""
    entites = []
    for departement in departements:
        url = (
            f"{API_GEO}/departements/{departement}/communes"
            "?fields=nom,code&format=geojson&geometry=contour"
        )
        entites.extend(fetch(url, timeout=180).json()["features"])
    return entites


def cadre_departemental(conn) -> dict[str, tuple[str, str]]:
    """code commune -> (code départemental au sens des finances locales, région).

    Les contours départementaux et régionaux n'existent pas à l'API Géo : ils
    sont reconstitués en fusionnant les communes, ce qui garantit que les
    niveaux s'emboîtent exactement. La maille retenue est celle de l'OFGL, pour
    que chaque polygone tracé ait des données : l'Alsace remplace le Bas-Rhin et
    le Haut-Rhin, la Métropole de Lyon est distinguée du reste du Rhône.
    """
    hierarchie = {
        commune: (departement, region)
        for commune, departement, region in conn.execute(
            """
            select c.geo_code, d.geo_code, d.parent_code
            from geo.geography_reference c
            join geo.geography_reference d
              on d.geo_level = 'departement' and d.geo_code = c.parent_code
             and d.vintage = c.vintage
            where c.geo_level = 'commune' and c.vintage = (select max(vintage)
                from geo.geography_reference where geo_level = 'commune')
            """
        ).fetchall()
    }
    lyon = {
        commune["code"]
        for commune in fetch(f"{API_GEO}/epcis/{METROPOLE_DE_LYON}/communes?fields=code").json()
    }
    cadre = {}
    for commune, (departement, region) in hierarchie.items():
        if departement in ("67", "68"):
            cadre[commune] = ("67A", region)
        elif commune in lyon:
            cadre[commune] = ("691", region)
        else:
            cadre[commune] = (departement, region)
    return cadre


def fusionner(entites: list[dict], cadre: dict[str, tuple[str, str]]) -> dict[str, list[dict]]:
    """Communes -> départements -> régions, par unions successives."""
    from shapely.geometry import mapping, shape
    from shapely.ops import unary_union

    par_departement: dict[str, list] = {}
    noms = {"67A": "Collectivité européenne d'Alsace", "691": "Métropole de Lyon"}
    regions: dict[str, str] = {}
    for entite in entites:
        rattachement = cadre.get(entite["properties"]["code"])
        if rattachement is None:
            continue
        departement, region = rattachement
        par_departement.setdefault(departement, []).append(shape(entite["geometry"]))
        regions[departement] = region

    departements, par_region = [], {}
    for code, formes in par_departement.items():
        forme = unary_union(formes)
        departements.append(
            {
                "type": "Feature",
                "properties": {"code": code, "nom": noms.get(code, code)},
                "geometry": mapping(forme),
            }
        )
        par_region.setdefault(regions[code], []).append(forme)

    regions_geo = [
        {
            "type": "Feature",
            "properties": {"code": code, "nom": code},
            "geometry": mapping(unary_union(formes)),
        }
        for code, formes in par_region.items()
    ]
    return {"departements": departements, "regions": regions_geo}


def ecrire_geojsonseq(chemin: Path, entites: list[dict]) -> None:
    """GeoJSON par lignes : tippecanoe le lit en parallèle, sans tout charger."""
    with open(chemin, "w", encoding="utf-8") as fichier:
        for entite in entites:
            fichier.write(json.dumps(entite, ensure_ascii=False) + "\n")


def construire_tuiles(couches: dict[str, Path], sortie: Path) -> None:
    """Une seule archive PMTiles, une couche par niveau territorial."""
    mbtiles = sortie.with_suffix(".mbtiles")
    commande = [
        "tippecanoe", "--output", str(mbtiles), "--force", "--read-parallel",
        "--simplification=4", "--drop-densest-as-needed", "--no-tile-size-limit",
        "--attribute-type=code:string",
        f"--minimum-zoom={min(z for z, _ in ZOOM.values())}",
        f"--maximum-zoom={max(z for _, z in ZOOM.values())}",
    ]
    for nom, chemin in couches.items():
        commande += [f"--named-layer={nom}:{chemin}"]
    _executer(commande)
    _executer(["pmtiles-convert", str(mbtiles), str(sortie)])
    mbtiles.unlink()


def _executer(commande: list[str]) -> None:
    """Remonte la sortie d'erreur de l'outil : sans elle, un échec de tippecanoe
    n'est qu'un code de retour indéchiffrable."""
    resultat = subprocess.run(commande, capture_output=True, text=True)
    if resultat.returncode != 0:
        raise RuntimeError(
            f"{commande[0]} a échoué ({resultat.returncode}) : "
            f"{(resultat.stderr or resultat.stdout).strip()[:500]}"
        )


def run(departements: list[str], store_spec: str, publication_spec: str) -> int:
    conn = entrepot.connect()
    store, publication = make_store(store_spec), make_store(publication_spec)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        with tempfile.TemporaryDirectory() as dossier:
            racine = Path(dossier)
            communes = contours_communes(departements)
            niveaux = {"communes": communes}
            niveaux.update(fusionner(communes, cadre_departemental(conn)))

            chemins, total = {}, 0
            for nom in COUCHES:
                entites = niveaux[nom]
                chemins[nom] = racine / f"{nom}.geojsonl"
                ecrire_geojsonseq(chemins[nom], entites)
                total += len(entites)
                entrepot.record_asset(
                    conn, store, run_id, DATASET, "ign", f"{nom}.geojsonl",
                    chemins[nom].read_bytes(), f"{API_GEO}/departements/*/communes",
                    "application/geo+json",
                )
                print(f"{nom} : {len(entites)} géométries")

            tuiles = racine / "territoires.pmtiles"
            construire_tuiles(chemins, tuiles)
            contenu = tuiles.read_bytes()
            version = datetime.now(UTC).strftime("%Y-%m-%d")
            cle = f"geo/{version}/territoires.pmtiles"
            publication.put(cle, contenu)
            # Pointeur vers la version courante : la carte ne devine pas la date.
            publication.put(
                "geo/derniere.json",
                json.dumps({"cle": cle, "version": version}).encode(),
                overwrite=True,
            )
            print(f"tuiles publiées : {cle} ({len(contenu) // 1024} Kio)")

        entrepot.finish_run(conn, run_id, "success", rows_written=total)
        return 0
    except Exception as error:  # noqa: BLE001 — tout échec finit tracé dans le lineage
        entrepot.finish_run(conn, run_id, "failed", error=str(error))
        raise
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--store", default=".snapshots")
    parser.add_argument("--publication", default=".published")
    parser.add_argument(
        "--departements", default="", help="liste de codes, vide = tous (via l'API Géo)"
    )
    args = parser.parse_args()
    departements = (
        args.departements.split(",")
        if args.departements
        else [d["code"] for d in fetch(f"{API_GEO}/departements", timeout=60).json()]
    )
    return run(departements, args.store, args.publication)


if __name__ == "__main__":
    raise SystemExit(main())
