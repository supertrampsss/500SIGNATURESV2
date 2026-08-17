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

**Les présidents de département et de région, depuis le 17 août 2026.** Le RNE
publie un fichier par type de mandat ; ceux des conseillers départementaux et
régionaux portent une colonne « Libellé de la fonction » d'où sortent les
94 présidents de conseil départemental et les 14 présidents de conseil régional.
La même règle qu'au-dessus s'applique : nom, prénom, prise de fonction, rien
d'autre.

**Ce que la source ne permet pas, et qu'il faut savoir en lisant ce module.**
Le RNE national est une ressource *écrasée* à chaque publication : data.gouv.fr
n'en garde aucune version antérieure. Il donne donc l'exécutif EN EXERCICE, et
jamais ses prédécesseurs. Mesuré le 17 août 2026 : les 34 826 maires du fichier
ont tous un mandat commençant en 2026 — les municipales de mars 2026 ont effacé
du fichier les maires de la mandature 2020-2026, qu'aucune source officielle
accessible ne republie. Les présidents, eux, tiennent leur fonction depuis
juillet 2021 (départementales et régionales de 2021) et couvrent donc les
exercices 2021 et suivants, jamais 2019 ni 2020.

C'est pour cela que le site n'écrit pas « le maire qui a présidé à ces comptes »
mais « l'exécutif en exercice, depuis telle date » : la seconde phrase est vraie,
la première ne le serait qu'avec un historique que personne ne publie.

Usage : python -m plateforme.normalize.maires [--store r2:plateforme-raw]
"""

import json
import argparse
import csv
import io
from collections import Counter


from plateforme import entrepot
from plateforme.http import fetch, telecharger
from plateforme.normalize.geo import MILLESIME, make_store

DATASET = "rne-conseillers-municipaux"
SOURCE = "data-gouv"

# Le catalogue data.gouv.fr donne l'URL courante du fichier : elle porte un
# horodatage qui change à chaque publication, donc on ne la fige pas.
CATALOGUE = "https://www.data.gouv.fr/api/1/datasets/5c34c4d1634f4173183a64f1/"
RESSOURCE = "conseillers-municipaux"

FONCTION_MAIRE = "Maire"
COLONNES = {"commune": 4, "nom": 6, "prenom": 7, "debut_mandat": 12, "fonction": 13}

#: Les exécutifs départementaux et régionaux : la ressource du catalogue, le
#: rôle écrit en base, l'intitulé exact de la fonction dans le fichier, et les
#: colonnes utiles.
#:
#: Les deux fichiers ont la même forme — code de la collectivité en tête, puis
#: un libellé, puis un découpage (canton ou section départementale) — d'où des
#: indices identiques. Ils sont écrits plutôt que devinés, et `controler_entete`
#: refuse le chargement si la source les déplace.
EXECUTIFS = [
    {
        "ressource": "conseillers-departementaux",
        "role": "president_departement",
        "fonction": "Président du conseil départemental",
        "colonnes": {"geo": 0, "nom": 4, "prenom": 5, "debut_fonction": 12, "fonction": 11},
        "entete": ("Code du département", "Nom de l'élu", "Libellé de la fonction"),
    },
    {
        "ressource": "conseillers-regionaux",
        "role": "president_region",
        "fonction": "Président du conseil régional",
        "colonnes": {"geo": 0, "nom": 4, "prenom": 5, "debut_fonction": 12, "fonction": 11},
        "entete": ("Code de la région", "Nom de l'élu", "Libellé de la fonction"),
    },
]


def url_courante(ressource: str = RESSOURCE) -> str:
    """L'URL du fichier change à chaque publication : on la relit du catalogue
    plutôt que de la figer et de découvrir un 404 dans six mois."""
    catalogue = fetch(CATALOGUE).json()
    for entree in catalogue["resources"]:
        if ressource in entree["title"]:
            return entree["url"]
    raise ValueError(f"aucune ressource « {ressource} » dans {CATALOGUE}")


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


def controler_entete(contenu: bytes, attendus: tuple[str, ...]) -> list[str]:
    """Refuse de lire un fichier dont l'en-tête a bougé.

    Les colonnes sont désignées par leur rang, parce que le RNE ne nomme pas ses
    fichiers de la même façon d'un mandat à l'autre. Un rang est muet : si la
    source insère une colonne, on lirait un prénom là où on attend une fonction
    et le contrôle de doublons ne verrait rien. L'en-tête est donc vérifié.
    """
    entete = next(
        csv.reader(io.StringIO(contenu[:4096].decode("utf-8", errors="replace")), delimiter=";"),
        [],
    )
    manquants = [c for c in attendus if c not in entete]
    if manquants:
        raise ValueError(f"colonnes absentes de l'en-tête RNE : {manquants}")
    return entete


def presidents(contenu: bytes, executif: dict) -> list[dict]:
    """Retient une ligne par collectivité : celle dont la fonction est la
    présidence de l'assemblée.

    Le code n'est pas complété à cinq caractères comme un code commune : un
    département s'écrit « 01 » ou « 971 », une région « 75 », et c'est ainsi que
    le référentiel géographique les porte.
    """
    controler_entete(contenu, executif["entete"])
    cols = executif["colonnes"]
    lecteur = csv.reader(io.StringIO(contenu.decode("utf-8", errors="replace")), delimiter=";")
    next(lecteur, None)  # en-tête
    sortie = []
    for ligne in lecteur:
        if len(ligne) <= max(cols.values()):
            continue
        if ligne[cols["fonction"]].strip() != executif["fonction"]:
            continue
        sortie.append(
            {
                "geo_code": ligne[cols["geo"]].strip(),
                "surname": " ".join(ligne[cols["nom"]].split()),
                "given_name": " ".join(ligne[cols["prenom"]].split()),
                # La prise de FONCTION, pas le début du mandat de conseiller :
                # un président est d'abord élu conseiller, puis porté à la
                # présidence par son assemblée, parfois des mois plus tard.
                "since": ligne[cols["debut_fonction"]].strip() or None,
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
                " where geo_level = 'commune' and vintage = ?",
                (MILLESIME,),
            ).fetchall()
        }
        gardees = [ligne for ligne in lignes if ligne["geo_code"] in connus]
        curseur.execute("delete from geo.commune_officials where role = 'maire'")
        entrepot.copier(
            conn,
            "geo.commune_officials",
            ["geo_code", "geo_vintage", "role", "surname", "given_name", "since", "run_id"],
            (
                (
                    ligne["geo_code"], MILLESIME, "maire", ligne["surname"],
                    ligne["given_name"], ligne["since"], run_id,
                )
                for ligne in gardees
            ),
        )
    conn.commit()
    return len(gardees), len(lignes) - len(gardees)


def ecrire_executifs(conn, run_id: str, role: str, niveau: str, lignes: list[dict]) -> tuple[int, int]:
    """Écrit une présidence par collectivité de la maille, et rien d'autre.

    Même garde que pour les maires : un code inconnu du référentiel signale un
    décalage de millésime, pas une information. La clé primaire porte le rôle,
    donc le département « 75 » et la région « 75 » cohabitent sans s'écraser.
    """
    if not lignes:
        raise ValueError(f"aucun {role} lu : le format de la source a dû changer")
    compte = Counter(ligne["geo_code"] for ligne in lignes)
    doublons = sorted(code for code, n in compte.items() if n > 1)
    if doublons:
        raise ValueError(f"plusieurs {role} pour {doublons[:5]}")
    with conn.cursor() as curseur:
        connus = {
            code
            for (code,) in curseur.execute(
                "select geo_code from geo.geography_reference"
                " where geo_level = ? and vintage = ?",
                (niveau, MILLESIME),
            ).fetchall()
        }
        gardees = [ligne for ligne in lignes if ligne["geo_code"] in connus]
        curseur.execute("delete from geo.commune_officials where role = ?", (role,))
        entrepot.copier(
            conn,
            "geo.commune_officials",
            ["geo_code", "geo_vintage", "role", "surname", "given_name", "since", "run_id"],
            (
                (
                    ligne["geo_code"], MILLESIME, role, ligne["surname"],
                    ligne["given_name"], ligne["since"], run_id,
                )
                for ligne in gardees
            ),
        )
    conn.commit()
    return len(gardees), len(lignes) - len(gardees)


def enregistrer_couverture(conn, run_id: str, ecrites: int) -> dict:
    """La source ne connaît pas tous les maires, et il faut le chiffrer.

    Deux mois après les municipales de mars 2026, 2 % des communes n'ont aucune
    ligne « Maire » dans le fichier : leurs conseillers y sont, pas leur maire.
    Le taux varie fortement d'un département à l'autre — 8 % dans l'Ain, 19 % en
    Guadeloupe, 0 % dans le Nord — ce qui ressemble à un remplissage inégal, pas
    à une règle. Sans mesure, cette lacune passerait pour un choix du site.
    """
    total = conn.execute(
        "select count(*) from geo.geography_reference"
        " where geo_level = 'commune' and vintage = ?",
        (MILLESIME,),
    ).fetchone()[0]
    constat = {
        "communes_du_referentiel": total,
        "maires_renseignes": ecrites,
        "couverture_pct": round(100 * ecrites / total, 2) if total else None,
    }
    conn.execute(
        """
        insert into meta.data_quality_checks
            (run_id, dataset_id, check_name, severity, passed, observed)
        values (?, ?, 'couverture_des_maires', 'info', true, ?)
        """,
        (run_id, DATASET, json.dumps(constat)),
    )
    conn.commit()
    return constat


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        url = url_courante()
        contenu = telecharger(url)
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "conseillers-municipaux.csv",
            contenu, url, "text/csv",
        )
        lignes = maires(contenu)
        controler(lignes)
        ecrites, ecartes = ecrire(conn, run_id, lignes)
        constat = enregistrer_couverture(conn, run_id, ecrites)
        print(f"maires : {ecrites} communes, couverture {constat['couverture_pct']} %")
        if ecartes:
            print(f"{ecartes} communes absentes du référentiel, écartées")

        # Les deux exécutifs des autres mailles. Ils sont chargés dans le même
        # run que les maires : c'est le même producteur, le même jeu du
        # catalogue et la même publication — trois runs séparés auraient laissé
        # croire à trois sources.
        lues = len(lignes)
        for executif in EXECUTIFS:
            url_exec = url_courante(executif["ressource"])
            brut = telecharger(url_exec)
            entrepot.record_asset(
                conn, store, run_id, DATASET, SOURCE,
                f"{executif['ressource']}.csv", brut, url_exec, "text/csv",
            )
            trouves = presidents(brut, executif)
            niveau = "departement" if executif["role"].endswith("departement") else "region"
            posees, hors = ecrire_executifs(conn, run_id, executif["role"], niveau, trouves)
            lues += len(trouves)
            ecrites += posees
            print(f"{executif['role']} : {posees} {niveau}s" + (f", {hors} hors référentiel" if hors else ""))

        entrepot.finish_run(conn, run_id, "success", rows_read=lues, rows_written=ecrites)
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
