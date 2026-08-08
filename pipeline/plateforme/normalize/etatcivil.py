"""Mariages, pacs et divorces (INSEE, état civil) vers core.observations.

Des séries longues — les mariages remontent à 1975 par département, à 1901 pour
la France — sur les trois actes qui font et défont les couples. Quatre
précautions, toutes tirées de la source.

**Domiciliés, pas enregistrés.** L'INSEE publie les deux : le mariage
*enregistré* est compté là où la cérémonie a eu lieu, le mariage *domicilié* là
où les époux habitent. Le premier gonfle les communes dont la mairie attire, le
second décrit le territoire. C'est le second qui est chargé, comme pour les
décès.

**Le mariage entre personnes de même sexe commence en mai 2013.** La série
démarre donc sur une année incomplète, et l'absence de valeur avant 2013 n'est
pas un trou de données : c'est l'état du droit. Le contrôle en tient compte,
puisqu'il ne vérifie l'identité que là où les trois termes existent.

**Les pacs et les divorces s'arrêtent en 2016 au niveau local.** Les
départements et les régions n'en ont plus depuis. La source continue de publier
les pacs pour la France entière jusqu'en 2024 ; les divorces s'arrêtent partout.
Les fiches le disent — un chiffre de 2016 affiché à côté d'un mariage de 2024 se
lit mal si l'on ne sait pas pourquoi.

**Un taux de nuptialité n'est pas un nombre.** `MARRT` est exprimé pour mille
habitants ; le mélanger aux effectifs dans une même somme n'aurait aucun sens,
et son unité le dit.

**Le contrôle qui bloque.** Mariages de sexe opposé + mariages de même sexe =
mariages, exercice par exercice et territoire par territoire. Vérifié sur les
2 808 couples où les trois termes existent au moment d'écrire ce module : écart
nul, au sens strict.

Usage : python -m plateforme.normalize.etatcivil [--store r2:plateforme-raw]
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

DATASET = "melodi-etat-civil-unions"
SOURCE = "insee-melodi"
JEU = "DS_MAR_PACS_DIV_SERIES"
URL = (
    "https://api.insee.fr/melodi/file/DS_MAR_PACS_DIV_SERIES/"
    "DS_MAR_PACS_DIV_SERIES_CSV_FR"
)

# Le jeu ne descend pas sous le département. `F` est la France entière ; `FM`
# (métropolitaine) et `FM_X_R11` (métropole hors Île-de-France) sont des
# périmètres plus étroits qui passeraient pour le chiffre national.
NIVEAUX = {"DEP": "departement", "REG": "region"}
FRANCE = "F"
NIVEAU_FRANCE = ("pays", "FR")

# Annuel seulement : la source publie aussi des séries mensuelles nationales,
# qui n'entrent pas dans un site dont toutes les fiches sont annuelles.
FREQUENCE = "A"

# Mariages domiciliés, jamais enregistrés — voir l'en-tête du module.
MARIAGES = "MAR_DOM"

# (mesure, statut marital) -> (identifiant, libellé, unité, unité de compte)
SERIES = {
    (MARIAGES, "MAR"): (
        "insee_mariages", "Mariages", "count", "mariages",
    ),
    (MARIAGES, "MARS"): (
        "insee_mariages_meme_sexe", "Mariages entre personnes de même sexe",
        "count", "mariages",
    ),
    ("PACS", "REP"): (
        "insee_pacs", "Pacs conclus", "count", "pacs",
    ),
    ("DIV", "DIV"): (
        "insee_divorces", "Divorces", "count", "divorces",
    ),
    ("MARRT", "_Z"): (
        "insee_taux_nuptialite", "Taux de nuptialité", "pour_1000_habitants",
        "mariages pour mille habitants",
    ),
}

# Le troisième terme de l'identité, lu sans être publié : les mariages entre
# personnes de sexe opposé.
SEXE_OPPOSE = (MARIAGES, "MARO")

# `P` provisoire, `R` révisée : la valeur est publiable, le lecteur doit savoir
# qu'elle peut bouger. `L` et `O` marquent une valeur manquante, sans contenu.
DRAPEAUX = {"P": "provisional", "R": "revised"}

THEME = "famille"

PUBLIQUE = {
    "insee_mariages": "Le nombre de mariages célébrés dans l'année, comptés là où"
    " les époux habitent et non là où la cérémonie a eu lieu. Une commune dont la"
    " mairie attire les mariages n'est donc pas gonflée par ce chiffre.",
    "insee_mariages_meme_sexe": "Le nombre de mariages entre personnes de même sexe."
    " La série commence en 2013, année de l'ouverture du mariage à ces couples :"
    " avant, il n'y a pas de donnée manquante, il n'y a pas de mariage possible.",
    "insee_pacs": "Le nombre de pactes civils de solidarité conclus dans l'année."
    " Au niveau du département et de la région, la source s'arrête en 2016 ; seule"
    " la France entière est publiée jusqu'à aujourd'hui.",
    "insee_divorces": "Le nombre de divorces prononcés dans l'année. La source"
    " s'arrête en 2016 à tous les niveaux : le dernier chiffre disponible a dix ans,"
    " et il n'est pas comparable aux mariages de l'année en cours.",
    "insee_taux_nuptialite": "Le nombre de mariages pour mille habitants. C'est un"
    " taux, pas un effectif : il permet de comparer des territoires de tailles"
    " différentes, et ne s'additionne pas.",
}

TECHNIQUE = (
    "Séries longues de l'état civil sur les mariages, les pacs et les divorces."
    " Mariages domiciliés (mesure MAR_DOM), c'est-à-dire rattachés au domicile des"
    " époux : à distinguer des mariages enregistrés, publiés par la même source et"
    " rattachés au lieu de célébration. Séries annuelles ; la source publie aussi"
    " des séries mensuelles nationales, non chargées. Niveaux : département, région"
    " et France entière. Les agrégats « France métropolitaine » et « métropole hors"
    " Île-de-France » sont écartés, ils passeraient pour le chiffre national. Les"
    " mariages remontent à 1975 par département et à 1901 pour la France, les"
    " mariages entre personnes de même sexe à 2013, le taux de nuptialité à 2007 par"
    " département. Pacs et divorces s'arrêtent en 2016 hors France entière. Les"
    " valeurs provisoires et révisées sont signalées comme telles."
)


class IdentiteRompue(RuntimeError):
    """Les mariages de même sexe et de sexe opposé ne font plus les mariages."""


def _territoire(objet: str, code: str) -> tuple[str, str] | None:
    """(GEO_OBJECT, GEO) -> (niveau, code), ou None si le territoire est écarté."""
    if objet == "FRANCE":
        return NIVEAU_FRANCE if code == FRANCE else None
    niveau = NIVEAUX.get(objet)
    return (niveau, code) if niveau else None


def lire(archive: bytes) -> list[dict]:
    """CSV zippé de l'INSEE -> séries annuelles des territoires du site."""
    with zipfile.ZipFile(io.BytesIO(archive)) as zip_:
        nom = next(n for n in zip_.namelist() if n.endswith("_data.csv"))
        with zip_.open(nom) as fichier:
            lecteur = csv.DictReader(
                io.TextIOWrapper(fichier, encoding="utf-8"), delimiter=";"
            )
            lignes = []
            for rang in lecteur:
                if rang["FREQ"] != FREQUENCE or not rang["OBS_VALUE"]:
                    continue
                cible = _territoire(rang["GEO_OBJECT"], rang["GEO"])
                if cible is None:
                    continue
                serie = (rang["EC_MEASURE"], rang["MARSTA"])
                if serie not in SERIES and serie != SEXE_OPPOSE:
                    continue
                niveau, code = cible
                drapeau = DRAPEAUX.get(rang["OBS_STATUS"])
                lignes.append(
                    {
                        "niveau": niveau,
                        "code": code,
                        "periode": rang["TIME_PERIOD"],
                        "serie": serie,
                        "valeur": float(rang["OBS_VALUE"]),
                        "drapeaux": [drapeau] if drapeau else [],
                    }
                )
            return lignes


def controler(lignes: list[dict]) -> int:
    """Mariages de sexe opposé + de même sexe = mariages.

    -> le nombre de couples territoire-exercice vérifiés. Les exercices
    antérieurs à 2013 n'ont pas de mariage entre personnes de même sexe : ce
    n'est pas une donnée manquante, c'est l'état du droit, et l'identité est
    simplement sautée là.
    """
    table: dict[tuple, dict[tuple, float]] = {}
    for ligne in lignes:
        cle = (ligne["niveau"], ligne["code"], ligne["periode"])
        table.setdefault(cle, {})[ligne["serie"]] = ligne["valeur"]
    total, meme, oppose = (MARIAGES, "MAR"), (MARIAGES, "MARS"), SEXE_OPPOSE
    compte = 0
    for (niveau, code, periode), valeurs in table.items():
        if not {total, meme, oppose} <= set(valeurs):
            continue
        ecart = valeurs[oppose] + valeurs[meme] - valeurs[total]
        if abs(ecart) > 0.5:
            raise IdentiteRompue(
                f"{niveau} {code} en {periode} : {valeurs[oppose]:.0f} +"
                f" {valeurs[meme]:.0f} ne font pas {valeurs[total]:.0f}"
                f" (écart {ecart:+.0f}). Un mariage est compté deux fois ou pas du tout."
            )
        compte += 1
    if not compte:
        raise IdentiteRompue("aucun territoire n'a pu être vérifié")
    return compte


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for indicateur, libelle, unite, compte in SERIES.values():
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, ?, ?, 'observed', array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (PUBLIQUE[indicateur], TECHNIQUE, f"Nombre de « {libelle} »", compte),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, geo_levels, time_granularity, published)
                values (?, ?, ?, ?, ?, ?, ?,
                        array['departement','region','pays'], 'annuelle', true)
                on conflict (indicator_id) do update set unit = excluded.unit,
                    definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                    theme = excluded.theme, published = true
                """,
                (indicateur, DATASET, definition, THEME, libelle, unite,
                 unite == "count"),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def ecrire(conn, run_id: str, lignes: list[dict]) -> tuple[int, int]:
    candidates = []
    drapeaux = {}
    for ligne in lignes:
        if ligne["serie"] not in SERIES:
            continue
        indicateur = SERIES[ligne["serie"]][0]
        candidates.append(
            (indicateur, ligne["niveau"], ligne["code"], ligne["periode"], ligne["valeur"])
        )
        if ligne["drapeaux"]:
            drapeaux[(indicateur, ligne["niveau"], ligne["code"], ligne["periode"])] = (
                ligne["drapeaux"]
            )
    gardees, ecartes = filtrer_territoires_connus(conn, candidates)
    noms = [nom for nom, _, _, _ in SERIES.values()]
    with conn.cursor() as curseur:
        curseur.execute(
            "delete from core.observations where indicator_id = any(?)", (noms,)
        )
        entrepot.copier(
            conn,
            "core.observations",
            ["indicator_id", "geo_level", "geo_code", "geo_vintage", "period", "value",
             "quality_flags", "run_id"],
            (
                (cle, niveau, code, MILLESIME, periode, valeur,
                 drapeaux.get((cle, niveau, code, periode), []), run_id)
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
        archive = telecharger(URL)
        entrepot.etape(f"archive de {len(archive) / 1e6:.0f} Mo téléchargée")
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "etat-civil-unions.zip", archive,
            URL, "application/zip",
        )
        lignes = lire(archive)
        entrepot.etape(f"{len(lignes)} lignes lues")
        if not lignes:
            raise ValueError("aucune union lue")
        verifies = controler(lignes)
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'mariages_par_sexe_egalent_le_total', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                "couples_verifies": verifies,
                "series": len(SERIES),
            })),
        )
        conn.commit()
        ecrites, ecartes = ecrire(conn, run_id, lignes)
        entrepot.etape(f"{ecrites} observations écrites")
        entrepot.finish_run(conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites)
        periodes = sorted({ligne["periode"] for ligne in lignes if ligne["serie"] in SERIES})
        print(
            f"état civil : {ecrites} observations, {periodes[0]} → {periodes[-1]},"
            f" {len(SERIES)} indicateurs, {ecartes} hors référentiel ;"
            f" {verifies} couples vérifiés"
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
