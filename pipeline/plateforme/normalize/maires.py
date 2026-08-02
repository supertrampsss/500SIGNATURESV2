"""Maires en exercice (Répertoire National des Élus) vers geo.commune_officials.

« On a les communes mais on n'a pas les maires. » Savoir qui dirige sa commune
fait partie de la lecture élémentaire de ses finances : un budget est voté par
quelqu'un.

**Ce qui n'est pas chargé, et c'est délibéré.** Le fichier du Ministère de
l'intérieur porte, pour chaque élu, sa date de naissance, son sexe et sa
catégorie socio-professionnelle. Rien de tout cela n'entre ici. La règle du
projet interdit de stocker des données personnelles, et si le nom d'un maire est
public, c'est au titre de la fonction qu'il exerce — pas de sa vie privée. Nom,
prénom, date de prise de fonction : de quoi répondre à la question posée, et
rien de plus.

**Les maires seulement, pas les adjoints.** Le fichier liste tous les
conseillers municipaux (72 Mo, plus de 500 000 lignes) ; seules les lignes dont
la fonction est « Maire » sont retenues, soit une par commune. Charger le reste
multiplierait le volume par quinze pour une question que le site ne pose pas.

**Le code commune se reconstitue.** La source écrit `1001` là où l'INSEE écrit
`01001` : le zéro de tête saute au passage par un tableur. On complète à cinq
caractères, ce qui laisse intacts les codes corses (`2A004`) et ultramarins.

Usage : python -m plateforme.normalize.maires [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
from collections import Counter

from plateforme import db
from plateforme.http import fetch
from plateforme.normalize.geo import MILLESIME, make_store

DATASET = "rne-conseillers-municipaux"
SOURCE = "data-gouv"

# Le catalogue data.gouv.fr donne l'URL courante du fichier : elle porte un
# horodatage qui change à chaque publication, donc on ne la fige pas.
CATALOGUE = "https://www.data.gouv.fr/api/1/datasets/5c34c4d1634f4173183a64f1/"
RESSOURCE = "conseillers-municipaux"

FONCTION_MAIRE = "Maire"
COLONNES = {"commune": 4, "nom": 6, "prenom": 7, "debut_mandat": 12, "fonction": 13}


def url_courante() -> str:
    """L'URL du fichier change à chaque publication : on la relit du catalogue
    plutôt que de la figer et de découvrir un 404 dans six mois."""
    catalogue = fetch(CATALOGUE).json()
    for ressource in catalogue["resources"]:
        if RESSOURCE in ressource["title"]:
            return ressource["url"]
    raise ValueError(f"aucune ressource « {RESSOURCE} » dans {CATALOGUE}")


def code_commune(brut: str) -> str:
    """`1001` -> `01001`. Les codes corses et ultramarins font déjà cinq
    caractères et traversent sans changer."""
    return brut.strip().zfill(5)


def maires(contenu: bytes) -> list[dict]:
    """Retient une ligne par commune : celle dont la fonction est « Maire »."""
    lecteur = csv.reader(io.StringIO(contenu.decode("utf-8", errors="replace")), delimiter=";")
    next(lecteur, None)  # en-tête
    sortie = []
    for ligne in lecteur:
        if len(ligne) <= COLONNES["fonction"]:
            continue
        if ligne[COLONNES["fonction"]].strip() != FONCTION_MAIRE:
            continue
        sortie.append(
            {
                "geo_code": code_commune(ligne[COLONNES["commune"]]),
                "surname": " ".join(ligne[COLONNES["nom"]].split()),
                "given_name": " ".join(ligne[COLONNES["prenom"]].split()),
                "since": ligne[COLONNES["debut_mandat"]].strip() or None,
            }
        )
    return sortie


def controler(lignes: list[dict]) -> None:
    """Une commune, un maire. Deux maires pour une même commune signifierait
    qu'on a mélangé deux mandats, et le chiffre affiché serait faux."""
    if not lignes:
        raise ValueError("aucun maire lu : le format de la source a dû changer")
    compte = Counter(ligne["geo_code"] for ligne in lignes)
    doublons = sorted(code for code, n in compte.items() if n > 1)
    if doublons:
        raise ValueError(f"plusieurs maires pour {doublons[:5]} ({len(doublons)} communes)")


def ecrire(conn, run_id: str, lignes: list[dict]) -> tuple[int, int]:
    """N'écrit que les communes du référentiel : un maire rattaché à un code
    inconnu signalerait un décalage de millésime, pas une information."""
    with conn.cursor() as curseur:
        connus = {
            code
            for (code,) in curseur.execute(
                "select geo_code from geo.geography_reference"
                " where geo_level = 'commune' and vintage = %s",
                (MILLESIME,),
            ).fetchall()
        }
        gardees = [ligne for ligne in lignes if ligne["geo_code"] in connus]
        curseur.execute("delete from geo.commune_officials where role = 'maire'")
        with curseur.copy(
            "copy geo.commune_officials (geo_code, geo_vintage, role, surname,"
            " given_name, since, run_id) from stdin"
        ) as copie:
            for ligne in gardees:
                copie.write_row(
                    (
                        ligne["geo_code"], MILLESIME, "maire", ligne["surname"],
                        ligne["given_name"], ligne["since"], run_id,
                    )
                )
    conn.commit()
    return len(gardees), len(lignes) - len(gardees)


def run(store_spec: str) -> int:
    conn = db.connect()
    store = make_store(store_spec)
    run_id = db.start_run(conn, DATASET, "manual")
    try:
        url = url_courante()
        contenu = fetch(url).content
        db.record_asset(
            conn, store, run_id, DATASET, SOURCE, "conseillers-municipaux.csv",
            contenu, url, "text/csv",
        )
        lignes = maires(contenu)
        controler(lignes)
        ecrites, ecartes = ecrire(conn, run_id, lignes)
        db.finish_run(conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites)
        print(f"maires : {ecrites} communes")
        if ecartes:
            print(f"{ecartes} communes absentes du référentiel, écartées")
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
