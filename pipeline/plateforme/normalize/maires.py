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

**Les maires sortants, c'est-à-dire la mandature 2020-2026.** Le jeu RNE est une
ressource *écrasée* à chaque publication : mesuré le 17 août 2026, ses
34 826 maires ont tous un mandat commençant en 2026, les municipales de mars
ayant effacé leurs prédécesseurs. On a d'abord conclu de là que les maires
2020-2026 n'étaient publiés nulle part. **C'était faux, et l'erreur mérite
d'être gardée** : la conclusion venait d'un seul jeu, sans que la liste des jeux
du ministère qui le publie ait été lue.

Le ministère publie « Élections municipales 2026 — Maires et conseillers
municipaux sortants », arrêté au 27 février 2026, soit juste avant le scrutin.
Mesuré : 34 889 maires, 99,8 % des communes que le site publie et 99,8 % de la
population. Pierre HURMIC à Bordeaux, Grégory DOUCET à Lyon, Benoît PAYAN à
Marseille, Anne HIDALGO à Paris.

**Les dates y sont en JJ/MM/AA**, quand le RNE courant les écrit en AAAA-MM-JJ.
Deux formats dans deux fichiers du même producteur : `date_fr` les ramène au
même, et un test tient la conversion. Lues telles quelles, elles auraient donné
des dates de l'an 20.

**Un maire sortant n'est pas forcément celui de 2020** : 31 480 ont pris leurs
fonctions en 2020, et 3 394 plus tard — démissions, décès, recompositions. Le
fichier donne le DERNIER de la mandature, et le site écrit donc « en fonction
depuis le … », jamais « maire de 2020 à 2026 ».

**Ce qui reste hors d'atteinte** : les présidents de département et de région
n'ont pas d'équivalent « sortants », leur mandature 2021-2028 étant en cours.
Ils tiennent leur fonction depuis juillet 2021 et couvrent donc les exercices
2021 et suivants, jamais 2019 ni 2020.

Usage : python -m plateforme.normalize.maires [--store r2:plateforme-raw]
"""

import json
import argparse
import csv
import io
from datetime import datetime
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

#: Le jeu des maires sortants — un AUTRE jeu du même producteur, avec son
#: propre identifiant : il n'est pas une ressource du RNE mais un arrêté
#: préélectoral, publié une fois avant chaque scrutin municipal.
CATALOGUE_SORTANTS = "https://www.data.gouv.fr/api/1/datasets/69a233819c17f13feedbc2cc/"
RESSOURCE_SORTANTS = "maires-sortants"
ROLE_SORTANT = "maire_precedent"

#: Les colonnes du fichier des sortants. Même forme que le RNE des maires, mais
#: **les dates y sont en JJ/MM/AA** : voir `date_fr`.
COLONNES_SORTANTS = {"commune": 4, "nom": 6, "prenom": 7, "debut_fonction": 13}
ENTETE_SORTANTS = ("Code de la commune", "Nom de l'élu", "Date de début de la fonction")

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


def url_courante(ressource: str = RESSOURCE, catalogue_url: str = CATALOGUE) -> str:
    """L'URL du fichier change à chaque publication : on la relit du catalogue
    plutôt que de la figer et de découvrir un 404 dans six mois.

    Le catalogue est un paramètre parce que les maires sortants ne sont pas une
    ressource du RNE : c'est un jeu distinct du même producteur."""
    catalogue = fetch(catalogue_url).json()
    for entree in catalogue["resources"]:
        if ressource in entree["title"]:
            return entree["url"]
    raise ValueError(f"aucune ressource « {ressource} » dans {catalogue_url}")


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


def date_fr(brut: str) -> str | None:
    """`18/05/20` -> `2020-05-18`.

    Le fichier des sortants écrit ses dates en JJ/MM/AA quand le RNE courant les
    écrit en AAAA-MM-JJ — deux formats, deux fichiers, un seul producteur. Lues
    telles quelles, `18/05/20` serait entrée en base comme une date de l'an 20.

    Le siècle : le RNE ne porte que des mandats en cours ou tout juste clos, donc
    une année à deux chiffres est toujours des années 2000. `%y` de Python coupe
    à 69, ce qui est le bon comportement ici et le restera longtemps.
    """
    brut = (brut or "").strip()
    if not brut:
        return None
    try:
        return datetime.strptime(brut, "%d/%m/%y").date().isoformat()
    except ValueError:
        return None


def sortants(contenu: bytes) -> list[dict]:
    """Le maire sortant de chaque commune, arrêté avant le scrutin de 2026.

    Une commune peut apparaître deux fois — mesuré : une seule le fait. On garde
    la première ligne plutôt que d'échouer, et `controler` compte les doublons.
    """
    controler_entete(contenu, ENTETE_SORTANTS)
    cols = COLONNES_SORTANTS
    lecteur = csv.reader(io.StringIO(contenu.decode("utf-8", errors="replace")), delimiter=";")
    next(lecteur, None)
    vus: set[str] = set()
    sortie = []
    for ligne in lecteur:
        if len(ligne) <= max(cols.values()):
            continue
        code = code_commune(ligne[cols["commune"]])
        if code in vus:
            continue
        vus.add(code)
        sortie.append(
            {
                "geo_code": code,
                "surname": " ".join(ligne[cols["nom"]].split()),
                "given_name": " ".join(ligne[cols["prenom"]].split()),
                # La prise de FONCTION : un maire sortant sur trente a pris la
                # sienne en cours de mandature, après une démission ou un décès.
                "since": date_fr(ligne[cols["debut_fonction"]]),
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

        # Les maires sortants : un AUTRE jeu du même producteur, arrêté avant
        # le scrutin de mars 2026. C'est la seule fenêtre publiée sur la
        # mandature 2020-2026 — le RNE, lui, l'a écrasée.
        url_sortants = url_courante(RESSOURCE_SORTANTS, CATALOGUE_SORTANTS)
        brut_sortants = telecharger(url_sortants)
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE,
            "maires-sortants.csv", brut_sortants, url_sortants, "text/csv",
        )
        precedents = sortants(brut_sortants)
        controler(precedents)
        poses, hors = ecrire_executifs(conn, run_id, ROLE_SORTANT, "commune", precedents)
        print(f"maires sortants : {poses} communes" + (f", {hors} hors référentiel" if hors else ""))

        # Les deux exécutifs des autres mailles. Ils sont chargés dans le même
        # run que les maires : c'est le même producteur, le même jeu du
        # catalogue et la même publication — trois runs séparés auraient laissé
        # croire à trois sources.
        lues = len(lignes) + len(precedents)
        ecrites += poses
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
