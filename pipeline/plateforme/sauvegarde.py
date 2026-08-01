"""Sauvegarde vérifiée de l'entrepôt.

Le plan gratuit Supabase n'offre pas de restauration ponctuelle (décision D6) :
une base perdue, c'est tout le travail d'ingestion à refaire. Les snapshots
bruts dans R2 permettraient de tout reconstruire, mais au prix de plusieurs
heures de rechargement et de recalcul.

**Une sauvegarde que personne n'a restaurée n'est pas une sauvegarde.** Ce
module ne se contente donc pas de produire un fichier : il le restaure dans une
base jetable et compare les comptages table par table avec la source. Un dump
qui ne se restaure pas, ou qui se restaure incomplet, n'est jamais déposé — le
run échoue, et l'absence de sauvegarde se voit au lieu d'être découverte le jour
où l'on en a besoin.

Seuls les schémas du projet sont sauvegardés. Les schémas internes de Supabase
(authentification, stockage, files) ne nous appartiennent pas, ne se restaurent
pas ailleurs, et n'ont rien à faire dans une archive publiable.

Usage : python -m plateforme.sauvegarde --verification-url postgres://… [--store r2:plateforme-raw]
"""

import argparse
import hashlib
import os
import subprocess
import tempfile
from datetime import UTC, datetime
from pathlib import Path

import psycopg

from plateforme.normalize.geo import make_store

SCHEMAS = ["meta", "geo", "core", "fin", "pub"]

# Tables dont le comptage sert de preuve de restauration. Elles couvrent les
# quatre familles du modèle : lineage, référentiel, séries, finances.
TEMOINS = [
    "meta.dataset_registry",
    "meta.ingestion_runs",
    "geo.geography_reference",
    "geo.geography_history",
    "core.indicators",
    "core.observations",
    "fin.public_budgets",
    "fin.public_budget_lines",
]


def _executer(commande: list[str], environnement: dict | None = None) -> str:
    """Remonte la sortie d'erreur : un pg_dump qui échoue en silence produirait
    un fichier tronqué que rien ne distinguerait d'une sauvegarde valide."""
    resultat = subprocess.run(  # noqa: S603 — commandes fixes, arguments contrôlés
        commande, capture_output=True, text=True, env={**os.environ, **(environnement or {})}
    )
    if resultat.returncode != 0:
        raise RuntimeError(f"{commande[0]} : {resultat.stderr.strip()[:800]}")
    return resultat.stdout


def dump(url: str, chemin: Path) -> Path:
    """Format `custom` : compressé, restaurable table par table."""
    _executer(
        [
            "pg_dump", "--format=custom", "--no-owner", "--no-privileges",
            *[f"--schema={schema}" for schema in SCHEMAS],
            f"--file={chemin}", url,
        ]
    )
    return chemin


def comptages(url: str) -> dict[str, int]:
    with psycopg.connect(url) as connexion:
        return {
            table: connexion.execute(f"select count(*) from {table}").fetchone()[0]
            for table in TEMOINS
        }


def restaurer(chemin: Path, url_cible: str) -> None:
    """Prépare la base jetable puis y déverse le dump.

    PostGIS doit préexister : les colonnes de `geo` référencent le type
    `geometry`, et un restore sur une base sans l'extension échouerait table par
    table sans que le code de retour le dise clairement.
    """
    with psycopg.connect(url_cible, autocommit=True) as connexion:
        connexion.execute("create extension if not exists postgis")
        connexion.execute("create extension if not exists pg_trgm")
    _executer(
        ["pg_restore", "--no-owner", "--no-privileges", "--exit-on-error",
         f"--dbname={url_cible}", str(chemin)]
    )


def verifier(url_source: str, url_cible: str) -> dict[str, int]:
    """Compare la source et la copie restaurée. Lève à la première divergence."""
    source, copie = comptages(url_source), comptages(url_cible)
    divergences = {
        table: (source[table], copie[table]) for table in TEMOINS if source[table] != copie[table]
    }
    if divergences:
        detail = ", ".join(f"{t} {a} ≠ {b}" for t, (a, b) in divergences.items())
        raise ValueError(f"restauration incomplète : {detail}")
    if not any(source.values()):
        raise ValueError("la source est vide : une sauvegarde de rien n'en est pas une")
    return source


def deposer(store, chemin: Path, comptes: dict[str, int]) -> dict:
    """Dépôt immuable, plus un pointeur réécrit vers la dernière sauvegarde."""
    contenu = chemin.read_bytes()
    empreinte = hashlib.sha256(contenu).hexdigest()
    horodatage = datetime.now(UTC).strftime("%Y-%m-%dT%H%M%SZ")
    cle = f"sauvegardes/{horodatage}/entrepot.dump"
    store.put(cle, contenu)
    fiche = {
        "cle": cle,
        "faite_le": horodatage,
        "octets": len(contenu),
        "sha256": empreinte,
        "schemas": SCHEMAS,
        "comptages_verifies": comptes,
        "restauration": (
            "pg_restore --no-owner --no-privileges --dbname=<url> entrepot.dump,"
            " sur une base où postgis et pg_trgm existent déjà"
        ),
    }
    import json

    store.put("sauvegardes/derniere.json", json.dumps(fiche, ensure_ascii=False).encode(),
              overwrite=True)
    return fiche


def run(url_verification: str, store_spec: str) -> int:
    url_source = os.environ["PLATEFORME_DB_URL"]
    store = make_store(store_spec)
    with tempfile.TemporaryDirectory() as dossier:
        chemin = Path(dossier) / "entrepot.dump"
        dump(url_source, chemin)
        taille = chemin.stat().st_size
        print(f"dump : {taille / 1e6:.1f} Mo")
        restaurer(chemin, url_verification)
        comptes = verifier(url_source, url_verification)
        print("restauration vérifiée : " + ", ".join(f"{t}={n}" for t, n in comptes.items()))
        fiche = deposer(store, chemin, comptes)
        print(f"sauvegarde déposée : {fiche['cle']} ({fiche['sha256'][:12]}…)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--verification-url", required=True, help="base jetable où le dump est restauré"
    )
    parser.add_argument("--store", default=".sauvegardes")
    arguments = parser.parse_args()
    return run(arguments.verification_url, arguments.store)


if __name__ == "__main__":
    raise SystemExit(main())
