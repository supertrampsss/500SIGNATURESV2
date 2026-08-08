"""Créations d'entreprises par territoire (INSEE, SIDE) vers core.observations.

Le pendant en flux du stock déjà publié sous « Établissements actifs ». Les deux
répondent à « combien d'entreprises ici ? » et ne comptent pas la même chose.

**Unités légales au siège, pas unités locales au travail.** Le stock compte les
établissements là où ils travaillent ; ce flux compte les entreprises là où
elles sont immatriculées. Une société de domiciliation suffit à faire d'une
commune un haut lieu de la création sans qu'un bureau y ouvre : Paris pèse à
elle seule 100 973 des 1 111 238 immatriculations de France en 2024, soit neuf
pour cent. La fiche le dit avant que la carte ne le laisse croire.

**Un flux annuel, pas un stock.** Additionner deux exercices ne donne pas un
parc d'entreprises : une entreprise créée en 2019 et fermée en 2020 compte une
fois dans le flux et zéro fois dans le stock d'aujourd'hui. Les cessations ne
sont pas dans ce jeu, la démographie nette non plus.

**Hors agriculture, et micro-entrepreneurs indissociables.** Le champ est la
nomenclature A10 sans l'agriculture — la source le dit, et le total `_T` en
hérite. Les entrepreneurs individuels font 74,4 % des immatriculations de 2024,
mais la forme légale ne distingue pas le micro-entrepreneur du reste : ce jeu ne
permet pas de dire ce que le régime doit à lui-même dans le doublement de la
série entre 2012 et 2025.

**Le contrôle qui bloque.** La somme des communes doit égaler exactement le
total France entière du même exercice. Vérifié sur les quatorze exercices au
moment d'écrire ce module — 1 111 238 en 2024, 1 165 795 en 2025, à l'unité près
des deux côtés. Un écart signifierait qu'une part des immatriculations n'est
plus rattachée à une commune, et le chargement s'arrête.

Usage : python -m plateforme.normalize.creations [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
import json
import zipfile

from plateforme import entrepot
from plateforme.http import telecharger
from plateforme.normalize.geo import MILLESIME, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "melodi-side-creations"
SOURCE = "insee-melodi"
JEU = "DS_SIDE_CREA_ENT_COM"

# Le fichier complet plutôt que la pagination de l'API : 8,6 millions
# d'observations dans le jeu, dont 438 000 nous concernent. Page par page, ce
# serait des milliers de requêtes ; ici c'est un téléchargement de 43 Mo.
URL = (
    "https://api.insee.fr/melodi/file/DS_SIDE_CREA_ENT_COM/"
    "DS_SIDE_CREA_ENT_COM_2025_CSV_FR"
)

INDICATEUR = "insee_creations_entreprises"

# Le jeu couvre onze découpages ; quatre sont des territoires de ce site. Les
# aires d'attraction, bassins de vie, unités urbaines et zones d'emploi sont des
# zonages d'étude, et les arrondissements municipaux (Paris, Lyon, Marseille)
# sont déjà comptés dans leur commune — les charger la compterait deux fois.
NIVEAUX = {"COM": "commune", "DEP": "departement", "REG": "region"}

# `F` est la France entière, Mayotte comprise. `FM` (métropolitaine) est le même
# comptage sur un périmètre plus étroit : c'est `F` qui sert de total de contrôle,
# puisque les communes chargées incluent les départements d'outre-mer.
FRANCE = "F"

# Le total du jeu, sur les deux dimensions qu'il croise. Charger les lignes de
# détail compterait chaque immatriculation autant de fois qu'elle a de secteurs
# et de formes légales, c'est-à-dire deux fois.
TOTAL = "_T"

# `A` est la valeur normale. `W` — « inclut les données d'une autre catégorie » —
# marque une commune nouvelle qui a absorbé une commune déléguée et reçoit ses
# immatriculations. Ces lignes comptent dans le total France : les écarter ferait
# tomber la somme des communes sous ce total. Elles sont donc chargées et
# signalées, car leur valeur couvre plus de territoire que la commune seule,
# alors que sa population ne couvre qu'elle.
DRAPEAU_REGROUPEMENT = "inclut_une_commune_rattachee"
STATUTS_REGROUPES = {"W"}

FICHE = {
    "libelle": "Créations d'entreprises",
    "public": "Le nombre d'entreprises immatriculées dans l'année, comptées dans la"
    " commune de leur siège et non là où elles travaillent. Les entreprises"
    " individuelles, micro-entrepreneurs compris, en forment les trois quarts."
    " L'agriculture n'est pas comptée. C'est un flux annuel, pas le nombre"
    " d'entreprises présentes.",
    "technique": "Nombre de nouvelles unités légales enregistrées dans l'année,"
    " mesure BURE du Système d'information sur la démographie d'entreprises, toutes"
    " formes légales et tous secteurs de la nomenclature A10 hors agriculture : le"
    " champ de la source exclut l'agriculture. L'unité légale est rattachée à la"
    " commune de son siège : une commune qui héberge des sociétés de domiciliation"
    " concentre des immatriculations dont l'activité se fait ailleurs, et Paris seule"
    " pèse neuf pour cent des créations de France. À distinguer du stock"
    " d'établissements actifs, publié ici sous « Établissements actifs », qui compte"
    " des unités locales là où elles travaillent. La forme légale « entrepreneur"
    " individuel » ne sépare pas les micro-entrepreneurs des autres : la série double"
    " entre 2012 et 2025 sans que ce jeu permette de dire ce qui revient au régime et"
    " ce qui revient à l'activité. Au communal, l'évolution d'une année sur l'autre"
    " est très dispersée (de −34 % à +42 % en 2024 pour les communes d'au moins cinq"
    " cents créations, autour d'une médiane de +4 %) : un siège qui déménage suffit à"
    " faire bouger le chiffre. Une commune absente d'un exercice n'y a enregistré"
    " aucune immatriculation.",
    "formule": "Unités légales nouvellement enregistrées dans l'année,"
    " tous secteurs hors agriculture",
}


class TotalIncoherent(RuntimeError):
    """La somme des communes ne fait pas le total France de la source.

    Une part des immatriculations ne serait alors rattachée à aucune commune, et
    la carte montrerait un pays qui crée moins d'entreprises qu'il n'en crée.
    """


def lire(archive: bytes) -> list[dict]:
    """CSV zippé de l'INSEE -> lignes retenues, avec leur maille.

    Lecture par index de colonne plutôt que par `DictReader` : le fichier fait
    410 Mo décompressés pour 8,6 millions de lignes, et construire un
    dictionnaire par ligne pour en garder 5 % coûte le triple du temps.
    """
    with zipfile.ZipFile(io.BytesIO(archive)) as zip_:
        nom = next(n for n in zip_.namelist() if n.endswith("_data.csv"))
        with zip_.open(nom) as fichier:
            lecteur = csv.reader(
                io.TextIOWrapper(fichier, encoding="utf-8"), delimiter=";"
            )
            colonne = {nom_: rang for rang, nom_ in enumerate(next(lecteur))}
            objet, geo, activite, forme = (
                colonne["GEO_OBJECT"], colonne["GEO"],
                colonne["ACTIVITY"], colonne["LEGAL_FORM"],
            )
            periode, valeur, statut = (
                colonne["TIME_PERIOD"], colonne["OBS_VALUE"], colonne["OBS_STATUS"],
            )
            return [
                {
                    "niveau": NIVEAUX[rang[objet]],
                    "code": rang[geo],
                    "periode": rang[periode],
                    "valeur": float(rang[valeur]),
                    "drapeaux": (
                        [DRAPEAU_REGROUPEMENT]
                        if rang[statut] in STATUTS_REGROUPES
                        else []
                    ),
                }
                for rang in lecteur
                if rang[activite] == TOTAL
                and rang[forme] == TOTAL
                and rang[objet] in NIVEAUX
                and rang[valeur]
            ]


def totaux_france(archive: bytes) -> dict[str, float]:
    """{exercice: total France entière}, tel que la source le publie."""
    with zipfile.ZipFile(io.BytesIO(archive)) as zip_:
        nom = next(n for n in zip_.namelist() if n.endswith("_data.csv"))
        with zip_.open(nom) as fichier:
            lecteur = csv.reader(
                io.TextIOWrapper(fichier, encoding="utf-8"), delimiter=";"
            )
            colonne = {nom_: rang for rang, nom_ in enumerate(next(lecteur))}
            return {
                rang[colonne["TIME_PERIOD"]]: float(rang[colonne["OBS_VALUE"]])
                for rang in lecteur
                if rang[colonne["GEO_OBJECT"]] == "FRANCE"
                and rang[colonne["GEO"]] == FRANCE
                and rang[colonne["ACTIVITY"]] == TOTAL
                and rang[colonne["LEGAL_FORM"]] == TOTAL
                and rang[colonne["OBS_VALUE"]]
            }


def controler(lignes: list[dict], totaux: dict[str, float]) -> dict[str, float]:
    """Somme des communes contre total France, exercice par exercice.

    -> les écarts constatés, vides si tout se referme. Lève si un exercice
    s'écarte : c'est un défaut de rattachement, pas un arrondi.
    """
    sommes: dict[str, float] = {}
    for ligne in lignes:
        if ligne["niveau"] == "commune":
            sommes[ligne["periode"]] = sommes.get(ligne["periode"], 0.0) + ligne["valeur"]
    ecarts = {
        periode: sommes[periode] - total
        for periode, total in totaux.items()
        if periode in sommes and abs(sommes[periode] - total) > 0.5
    }
    if ecarts:
        detail = ", ".join(f"{p} : {e:+.0f}" for p, e in sorted(ecarts.items())[:5])
        raise TotalIncoherent(
            f"la somme des communes ne fait pas le total France ({detail})."
            " Une part des immatriculations n'est plus rattachée à une commune."
        )
    return ecarts


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        definition = curseur.execute(
            """
            insert into core.indicator_definitions
                (public_definition, technical_definition, formula, unit_notes,
                 confidence_level, badges)
            values (?, ?, ?, 'unités légales enregistrées', 'observed',
                    array['Officiel','Donnée brute'])
            returning definition_id
            """,
            (FICHE["public"], FICHE["technique"], FICHE["formule"]),
        ).fetchone()[0]
        curseur.execute(
            """
            insert into core.indicators
                (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                 additive, geo_levels, time_granularity, published)
            values (?, ?, ?, 'entreprises', ?, 'count', true,
                    array['commune','departement','region'], 'annuelle', true)
            on conflict (indicator_id) do update set unit = excluded.unit,
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
    drapeaux = {
        (ligne["niveau"], ligne["code"], ligne["periode"]): ligne["drapeaux"]
        for ligne in lignes
        if ligne["drapeaux"]
    }
    candidates = [
        (INDICATEUR, ligne["niveau"], ligne["code"], ligne["periode"], ligne["valeur"])
        for ligne in lignes
    ]
    gardees, ecartes = filtrer_territoires_connus(conn, candidates)
    with conn.cursor() as curseur:
        curseur.execute("delete from core.observations where indicator_id = ?", (INDICATEUR,))
        entrepot.copier(
            conn,
            "core.observations",
            ["indicator_id", "geo_level", "geo_code", "geo_vintage", "period", "value",
             "quality_flags", "run_id"],
            (
                (cle, niveau, code, MILLESIME, periode, valeur,
                 drapeaux.get((niveau, code, periode), []), run_id)
                for cle, niveau, code, periode, valeur in gardees
            ),
        )
    conn.commit()
    return len(gardees), len(ecartes)


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        archive = telecharger(URL, timeout=900)
        entrepot.etape(f"archive de {len(archive) / 1e6:.0f} Mo téléchargée")
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "creations-entreprises.zip",
            archive, URL, "application/zip",
        )
        lignes = lire(archive)
        entrepot.etape(f"{len(lignes)} lignes lues")
        if not lignes:
            raise ValueError("aucune création lue")
        totaux = totaux_france(archive)
        controler(lignes, totaux)
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'somme_communes_egale_total_france', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                "exercices": len(totaux), "dernier": max(totaux),
                "total_france": totaux[max(totaux)],
            })),
        )
        conn.commit()
        ecrites, ecartes = ecrire(conn, run_id, lignes)
        entrepot.etape(f"{ecrites} observations écrites")
        entrepot.finish_run(conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites)
        periodes = sorted({ligne["periode"] for ligne in lignes})
        print(
            f"créations d'entreprises : {ecrites} observations, {periodes[0]} →"
            f" {periodes[-1]}, {ecartes} hors référentiel ; total France"
            f" {max(totaux)} : {totaux[max(totaux)]:.0f}"
        )
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
