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

Les versions sont lues, jamais supposées. `pg_dump` refuse de parler à un
serveur plus récent que lui, et le message qu'il produit alors ne dit pas quoi
corriger. La version du serveur source décide donc de celle du client et de
celle de la base de vérification — c'est elle que le workflow interroge avant
d'installer quoi que ce soit.

Usage : python -m plateforme.sauvegarde --verification-url postgres://… [--store r2:plateforme-raw]
       python -m plateforme.sauvegarde --version-source   # majeure du serveur, pour le workflow
"""

import argparse
import hashlib
import os
import re
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


def version_majeure(url: str) -> int:
    with psycopg.connect(url) as connexion:
        return int(connexion.execute("show server_version_num").fetchone()[0]) // 10_000


def version_client() -> int:
    """`pg_dump (PostgreSQL) 17.6` sur Debian, `… 16.14 (Ubuntu 16.14-1.pgdg…)`
    ailleurs : on prend le premier numéro de version rencontré."""
    sortie = _executer(["pg_dump", "--version"])
    trouve = re.search(r"(\d+)\.\d+", sortie)
    if not trouve:
        raise RuntimeError(f"version de pg_dump illisible : {sortie.strip()[:200]}")
    return int(trouve.group(1))


def controler_versions(url_source: str, url_cible: str) -> int:
    """Échoue avant le dump, en nommant le correctif.

    Sans ce contrôle, une montée de version de Supabase produit un
    « aborting because of server version mismatch » qui ne dit ni quelle version
    installer ni où. L'inverse est sans risque : un client ou une cible plus
    récents que la source savent lire son dump.
    """
    source = version_majeure(url_source)
    client = version_client()
    if client < source:
        raise RuntimeError(
            f"pg_dump {client} ne peut pas sauvegarder un serveur {source} :"
            f" installer postgresql-client-{source}"
            " (.github/workflows/sauvegarde.yml lit cette version, il suffit de relancer)"
        )
    cible = version_majeure(url_cible)
    if cible < source:
        raise RuntimeError(
            f"la base de vérification est en PostgreSQL {cible}, la source en {source} :"
            f" utiliser l'image postgis/postgis:{source}-3.5"
        )
    return source


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


def verifier(url_source: str, url_cible: str, avant: dict[str, int] | None = None) -> dict[str, int]:
    """Compare la source et la copie restaurée. Lève à la première divergence.

    `avant` est le comptage pris juste avant le dump. Sans lui, une ingestion
    qui écrit pendant le dump ferait apparaître la copie comme incomplète alors
    qu'elle est fidèle à l'instant sauvegardé : le dump serait bon et le run
    dirait le contraire. On distingue donc les deux causes, parce qu'elles
    n'appellent pas la même réaction.
    """
    source, copie = comptages(url_source), comptages(url_cible)
    if avant is not None and avant != source:
        bougees = [f"{t} {avant[t]}→{source[t]}" for t in TEMOINS if avant[t] != source[t]]
        raise ValueError(
            "la base a changé pendant le dump, la vérification par comptage ne veut"
            f" plus rien dire : {', '.join(bougees)}. Relancer hors ingestion."
        )
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
    majeure = controler_versions(url_source, url_verification)
    print(f"PostgreSQL {majeure} de part et d'autre")
    with tempfile.TemporaryDirectory() as dossier:
        chemin = Path(dossier) / "entrepot.dump"
        avant = comptages(url_source)
        dump(url_source, chemin)
        taille = chemin.stat().st_size
        print(f"dump : {taille / 1e6:.1f} Mo")
        restaurer(chemin, url_verification)
        comptes = verifier(url_source, url_verification, avant)
        print("restauration vérifiée : " + ", ".join(f"{t}={n}" for t, n in comptes.items()))
        fiche = deposer(store, chemin, comptes)
        print(f"sauvegarde déposée : {fiche['cle']} ({fiche['sha256'][:12]}…)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--verification-url", help="base jetable où le dump est restauré")
    parser.add_argument("--store", default=".sauvegardes")
    parser.add_argument(
        "--version-source",
        action="store_true",
        help="affiche la majeure PostgreSQL de la source et sort ; le workflow s'en sert"
        " pour installer le bon client et démarrer la bonne base de vérification",
    )
    arguments = parser.parse_args()
    if arguments.version_source:
        print(version_majeure(os.environ["PLATEFORME_DB_URL"]))
        return 0
    if not arguments.verification_url:
        parser.error("--verification-url est obligatoire pour sauvegarder")
    return run(arguments.verification_url, arguments.store)


if __name__ == "__main__":
    raise SystemExit(main())
