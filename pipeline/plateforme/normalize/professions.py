"""Population de 15 ans et plus par catégorie sociale (INSEE, recensement).

« Qui vit ici ? » — la question que la carte ne posait pas encore. Ce module
charge la répartition par catégorie socioprofessionnelle et par tranche d'âge,
et deux précautions gouvernent tout le reste.

**Quinze ans et plus, jamais la population entière.** La catégorie
socioprofessionnelle n'est définie qu'à partir de quinze ans, et le jeu ne
publie rien d'autre : 56,5 millions de personnes en 2023 quand la population
municipale en compte 68. Cet indicateur porte donc son âge dans son nom, et il
n'est pas le dénominateur des autres indicateurs du site — c'est
`insee_population_municipale` qui l'est, et les confondre décalerait tous les
ratios de dix-sept pour cent.

**Retraité est une catégorie, pas un âge.** La nomenclature range les retraités
et les « autres inactifs » — étudiants compris — à côté des six catégories
d'actifs. Le total moins les retraités ne donne donc pas les actifs, et à
Bordeaux les 46 508 « autres inactifs » sont d'abord des étudiants. La fiche le
dit ; aucun taux d'activité n'est calculé ici à partir de ces chiffres.

**Il n'y a pas de catégorie 8.** La nomenclature complète en compte une —
« autres sans activité professionnelle » — que ce jeu fond dans les « autres
inactifs ». Une somme écrite de un à huit manquerait donc son total sans
prévenir ; c'est la première chose que le contrôle attrape.

**Les contrôles qui bloquent.** Trois identités de la source, vérifiées sur les
108 665 couples territoire-millésime, à 2 × 10⁻⁵ près : les huit catégories font
le total ; les trois tranches d'âge font les quinze ans et plus ; hommes plus
femmes font le total.

Usage : python -m plateforme.normalize.professions [--store r2:plateforme-raw]
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

DATASET = "melodi-rp-population"
SOURCE = "insee-melodi"
JEU = "DS_RP_POPULATION_COMP"
URL = (
    "https://api.insee.fr/melodi/file/DS_RP_POPULATION_COMP/"
    "DS_RP_POPULATION_COMP_2023_CSV_FR"
)

NIVEAUX = {"COM": "commune", "EPCI": "epci", "DEP": "departement", "REG": "region"}
FRANCE = "F"
TOTAL = "_T"

# Le jeu n'a pas de tranche « tous âges » : `Y_GE15` *est* son total, parce que
# la catégorie sociale n'existe qu'à partir de quinze ans.
QUINZE_ET_PLUS = "Y_GE15"

# Catégories socioprofessionnelles, au niveau agrégé de la nomenclature. La
# catégorie 8 n'existe pas dans ce jeu : la source la fond dans « Autres
# inactifs ».
CATEGORIES = {
    "1": ("insee_pcs_agriculteurs", "Agriculteurs"),
    "2": ("insee_pcs_artisans_commercants", "Artisans, commerçants, chefs d'entreprise"),
    "3": ("insee_pcs_cadres", "Cadres et professions intellectuelles supérieures"),
    "4": ("insee_pcs_professions_intermediaires", "Professions intermédiaires"),
    "5": ("insee_pcs_employes", "Employés"),
    "6": ("insee_pcs_ouvriers", "Ouvriers"),
    "7": ("insee_pcs_retraites", "Retraités"),
    "9": ("insee_pcs_autres_inactifs", "Autres personnes sans activité professionnelle"),
}

# Tranches d'âge, sur la même population de quinze ans et plus.
TRANCHES = {
    "Y15T24": ("insee_population_15_24_ans", "Population de 15 à 24 ans"),
    "Y25T54": ("insee_population_25_54_ans", "Population de 25 à 54 ans"),
    "Y_GE55": ("insee_population_55_ans_et_plus", "Population de 55 ans et plus"),
}

TOTAL_QUINZE = ("insee_population_15_ans_et_plus", "Population de 15 ans et plus")

# Le thème des catégories sociales, distinct de « Population » : « combien
# sommes-nous » et « qui sommes-nous » ne sont pas la même question.
THEME_CATEGORIES = "professions"
THEME_AGES = "population"

DRAPEAU_REGROUPEMENT = "inclut_une_commune_rattachee"
STATUTS_REGROUPES = {"W"}

TOLERANCE = 0.001

# (nom, composantes, total), chaque terme étant un triplet (PCS, sexe, âge).
IDENTITES = (
    (
        "categories_egalent_le_total",
        tuple((code, TOTAL, QUINZE_ET_PLUS) for code in CATEGORIES),
        (TOTAL, TOTAL, QUINZE_ET_PLUS),
    ),
    (
        "tranches_egalent_les_quinze_ans_et_plus",
        tuple((TOTAL, TOTAL, tranche) for tranche in TRANCHES),
        (TOTAL, TOTAL, QUINZE_ET_PLUS),
    ),
    (
        "sexes_egalent_le_total",
        ((TOTAL, "M", QUINZE_ET_PLUS), (TOTAL, "F", QUINZE_ET_PLUS)),
        (TOTAL, TOTAL, QUINZE_ET_PLUS),
    ),
)

PUBLIQUE = {
    "insee_population_15_ans_et_plus": "Le nombre d'habitants de quinze ans et plus."
    " Ce n'est pas la population du territoire : la statistique des catégories"
    " sociales ne descend pas sous quinze ans, et il manque donc tous les enfants.",
    "insee_pcs_agriculteurs": "Les habitants de quinze ans et plus qui exercent ou"
    " ont exercé en dernier lieu comme exploitants agricoles. Un agriculteur parti à"
    " la retraite compte parmi les retraités, pas ici.",
    "insee_pcs_artisans_commercants": "Les artisans, commerçants et chefs"
    " d'entreprise en activité. Comme pour toutes ces catégories, les retraités de"
    " ces métiers sont comptés parmi les retraités.",
    "insee_pcs_cadres": "Les cadres, ingénieurs, professeurs, professions libérales"
    " et professions de l'information et des arts, en activité.",
    "insee_pcs_professions_intermediaires": "Les professions intermédiaires en"
    " activité : techniciens, contremaîtres, infirmiers, instituteurs, travailleurs"
    " sociaux.",
    "insee_pcs_employes": "Les employés en activité : employés de commerce, de la"
    " fonction publique, personnels de services aux particuliers.",
    "insee_pcs_ouvriers": "Les ouvriers en activité, qualifiés comme non qualifiés,"
    " agricoles compris.",
    "insee_pcs_retraites": "Les habitants retraités, quel que soit le métier exercé"
    " avant. C'est une catégorie sociale et non une tranche d'âge : un retraité de"
    " cinquante-cinq ans y figure, un actif de soixante-dix ans non.",
    "insee_pcs_autres_inactifs": "Les habitants de quinze ans et plus sans activité"
    " professionnelle et non retraités : étudiants, personnes au foyer, invalides."
    " Dans une ville universitaire, cette catégorie est d'abord faite d'étudiants.",
    "insee_population_15_24_ans": "Les habitants de 15 à 24 ans. Les moins de quinze"
    " ans ne sont pas dans cette source : ce n'est pas une pyramide des âges"
    " complète.",
    "insee_population_25_54_ans": "Les habitants de 25 à 54 ans, c'est-à-dire le"
    " cœur des âges d'activité.",
    "insee_population_55_ans_et_plus": "Les habitants de 55 ans et plus. Rapporté"
    " aux quinze ans et plus, c'est une mesure du vieillissement du territoire —"
    " pas un taux de retraités.",
}

TECHNIQUE = (
    "Recensement de la population, dossier complet « Évolution et structure de la"
    " population », mesure « Population » croisée sexe × âge × catégorie"
    " socioprofessionnelle. Champ : personnes de quinze ans et plus, France hors"
    " Mayotte — la catégorie sociale n'est pas définie sous quinze ans, et ce jeu ne"
    " publie aucun total tous âges. À ne pas confondre avec la population municipale,"
    " publiée ici sous « Population municipale » et seule utilisée comme dénominateur"
    " des ratios du site : 56,5 millions contre 68 en 2023. La nomenclature agrégée"
    " compte huit catégories dans ce jeu — la huitième de la nomenclature complète,"
    " « autres sans activité professionnelle », y est fondue dans les autres inactifs."
    " Retraités et autres inactifs sont des catégories sociales et non des tranches"
    " d'âge : le total moins les retraités ne donne pas les actifs. Trois millésimes :"
    " 2012, 2017, 2023 ; chacun résulte de cinq années d'enquêtes centrées sur lui, et"
    " les valeurs sont des estimations pondérées, d'où leurs décimales."
)


class IdentiteRompue(RuntimeError):
    """Une somme de la source ne fait plus son total."""


def croisements_retenus() -> frozenset[tuple[str, str, str]]:
    """Les seuls triplets (PCS, sexe, âge) que la lecture garde.

    Le jeu en croise trois cent vingt-quatre : neuf catégories × trois sexes ×
    quatre tranches, sur trois millésimes et onze découpages. Tout garder
    faisait 11,7 millions de dictionnaires en mémoire, mesuré — de quoi tuer un
    runner d'intégration continue qui tient déjà l'entrepôt ouvert. Quatorze
    suffisent : les douze publiés, plus les deux sexes qui ferment la troisième
    identité de contrôle.
    """
    return frozenset(indicateurs()) | frozenset(
        composante for _, composantes, _ in IDENTITES for composante in composantes
    ) | frozenset(total for _, _, total in IDENTITES)


def lire(archive: bytes) -> list[dict]:
    """CSV zippé du recensement -> population par territoire, sexe, âge et PCS.

    Seuls les croisements publiés et ceux qui ferment les contrôles sont gardés
    (voir `croisements_retenus`).
    """
    with zipfile.ZipFile(io.BytesIO(archive)) as zip_:
        nom = next(n for n in zip_.namelist() if n.endswith("_data.csv"))
        with zip_.open(nom) as fichier:
            lecteur = csv.reader(
                io.TextIOWrapper(fichier, encoding="utf-8"), delimiter=";"
            )
            colonne = {nom_: rang for rang, nom_ in enumerate(next(lecteur))}
            objet, geo = colonne["GEO_OBJECT"], colonne["GEO"]
            sexe, pcs, age = colonne["SEX"], colonne["PCS"], colonne["AGE"]
            periode, valeur, statut = (
                colonne["TIME_PERIOD"], colonne["OBS_VALUE"], colonne["OBS_STATUS"],
            )
            retenus = croisements_retenus()
            return [
                {
                    "niveau": NIVEAUX[rang[objet]],
                    "code": rang[geo],
                    "periode": rang[periode],
                    "sexe": rang[sexe],
                    "categorie": rang[pcs],
                    "age": rang[age],
                    "valeur": float(rang[valeur]),
                    "drapeaux": (
                        [DRAPEAU_REGROUPEMENT]
                        if rang[statut] in STATUTS_REGROUPES
                        else []
                    ),
                }
                for rang in lecteur
                if rang[objet] in NIVEAUX
                and (rang[pcs], rang[sexe], rang[age]) in retenus
                and rang[valeur]
            ]


def controler(lignes: list[dict], tolerance: float = TOLERANCE) -> dict[str, int]:
    """Les trois identités de la source. Lève au premier écart."""
    table: dict[tuple, dict[tuple, float]] = {}
    for ligne in lignes:
        cle = (ligne["niveau"], ligne["code"], ligne["periode"])
        table.setdefault(cle, {})[
            (ligne["categorie"], ligne["sexe"], ligne["age"])
        ] = ligne["valeur"]
    verifies = {}
    for nom, composantes, total in IDENTITES:
        compte = 0
        for (niveau, code, periode), valeurs in table.items():
            if total not in valeurs or any(c not in valeurs for c in composantes):
                continue
            ecart = sum(valeurs[c] for c in composantes) - valeurs[total]
            if abs(ecart) > tolerance:
                raise IdentiteRompue(
                    f"{nom} : {niveau} {code} en {periode} s'écarte de {ecart:+.4f}"
                    f" ({sum(valeurs[c] for c in composantes):.2f} contre"
                    f" {valeurs[total]:.2f})."
                )
            compte += 1
        if not compte:
            raise IdentiteRompue(f"{nom} : aucun territoire n'a pu être vérifié")
        verifies[nom] = compte
    return verifies


def totaux_france(archive: bytes) -> dict[str, float]:
    """{millésime: population de 15 ans et plus de France entière}."""
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
                and rang[colonne["SEX"]] == TOTAL
                and rang[colonne["PCS"]] == TOTAL
                and rang[colonne["AGE"]] == QUINZE_ET_PLUS
                and rang[colonne["OBS_VALUE"]]
            }


def indicateurs() -> dict[tuple[str, str, str], tuple[str, str, str]]:
    """{(PCS, sexe, âge): (identifiant, libellé, thème)} — ce qui est publié.

    Seuls les croisements « tous sexes » sortent : la ventilation par sexe ferme
    une identité de contrôle, mais publier deux fois chaque catégorie doublerait
    le volume pour une lecture que la fiche ne propose pas.
    """
    publies = {
        (TOTAL, TOTAL, QUINZE_ET_PLUS): (*TOTAL_QUINZE, THEME_AGES),
    }
    publies.update(
        {
            (code, TOTAL, QUINZE_ET_PLUS): (*valeur, THEME_CATEGORIES)
            for code, valeur in CATEGORIES.items()
        }
    )
    publies.update(
        {
            (TOTAL, TOTAL, tranche): (*valeur, THEME_AGES)
            for tranche, valeur in TRANCHES.items()
        }
    )
    return publies


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for indicateur, libelle, theme in indicateurs().values():
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, ?, 'personnes de 15 ans et plus', 'observed',
                        array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (PUBLIQUE[indicateur], TECHNIQUE, f"Nombre de « {libelle} »"),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, geo_levels, time_granularity, published)
                values (?, ?, ?, ?, ?, 'count', true,
                        array['commune','epci','departement','region'], 'annuelle', true)
                on conflict (indicator_id) do update set
                    definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                    theme = excluded.theme, published = true
                """,
                (indicateur, DATASET, definition, theme, libelle),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def ecrire(conn, run_id: str, lignes: list[dict]) -> tuple[int, int]:
    publies = indicateurs()
    candidates = []
    drapeaux = {}
    for ligne in lignes:
        cle = (ligne["categorie"], ligne["sexe"], ligne["age"])
        if cle not in publies:
            continue
        indicateur = publies[cle][0]
        candidates.append(
            (indicateur, ligne["niveau"], ligne["code"], ligne["periode"], ligne["valeur"])
        )
        if ligne["drapeaux"]:
            drapeaux[(indicateur, ligne["niveau"], ligne["code"], ligne["periode"])] = (
                ligne["drapeaux"]
            )
    gardees, ecartes = filtrer_territoires_connus(conn, candidates)
    noms = [nom for nom, _, _ in publies.values()]
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
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "rp-population.zip", archive, URL,
            "application/zip",
        )
        lignes = lire(archive)
        if not lignes:
            raise ValueError("aucune population lue")
        verifies = controler(lignes)
        totaux = totaux_france(archive)
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'identites_de_la_structure', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "quinze_ans_et_plus_france": {
                    p: round(v) for p, v in sorted(totaux.items())
                },
            })),
        )
        conn.commit()
        ecrites, ecartes = ecrire(conn, run_id, lignes)
        entrepot.finish_run(conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites)
        periodes = sorted(totaux)
        print(
            f"catégories sociales : {ecrites} observations, millésimes"
            f" {', '.join(periodes)}, {len(indicateurs())} indicateurs,"
            f" {ecartes} hors référentiel ; 15 ans et plus en France"
            f" {periodes[-1]} : {totaux[periodes[-1]]:.0f}"
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
