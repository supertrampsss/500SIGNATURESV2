"""Familles par territoire (INSEE, recensement) vers core.observations.

« Combien de familles monoparentales dans ma commune ? » est une question de
politique sociale ordinaire, et la réponse suppose de savoir ce que la
statistique appelle une famille.

**Une famille n'est pas un ménage.** Au recensement, une famille est un couple
avec ou sans enfant, ou un parent seul avec au moins un enfant, vivant dans le
même logement. Une personne seule ne forme donc pas une famille, ni deux amis en
colocation : la France compte 18,7 millions de familles en 2023 pour 31,2
millions de résidences principales. Rapporter les familles aux logements donne
un rapport, pas une part.

**Un « enfant » n'a pas d'âge.** Est enfant d'une famille la personne qui vit
avec au moins un de ses parents, sans conjoint ni enfant à elle — quel que soit
son âge. Un adulte de quarante ans qui vit chez sa mère fait donc de ce foyer
une famille monoparentale. La ventilation par nombre d'enfants, elle, ne compte
que les moins de vingt-cinq ans ; elle n'est pas chargée ici, et les deux
comptages ne se recoupent pas.

**Les familles recomposées n'existent qu'en 2023.** La source ne publie la
distinction recomposée / traditionnelle que sur le dernier millésime. Cet
indicateur n'a donc pas de série, et la fiche le dit plutôt que de laisser
croire à une disparition.

**Les contrôles qui bloquent.** Trois identités de la source, vérifiées sur les
108 665 couples territoire-millésime au moment d'écrire ce module, toutes à
1 × 10⁻⁵ près : monoparentales + couples sans enfant + couples avec enfant =
total ; pères seuls + mères seules = monoparentales ; recomposées +
traditionnelles = couples avec enfant. La dernière ne porte que sur 2023, et le
contrôle saute les millésimes où la composante manque plutôt que de crier sur
une donnée que la source ne publie pas.

Usage : python -m plateforme.normalize.famille [--store r2:plateforme-raw]
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

DATASET = "melodi-rp-famille"
SOURCE = "insee-melodi"
JEU = "DS_RP_FAMILLE_COMP"
URL = "https://api.insee.fr/melodi/file/DS_RP_FAMILLE_COMP/DS_RP_FAMILLE_COMP_2023_CSV_FR"

NIVEAUX = {"COM": "commune", "EPCI": "epci", "DEP": "departement", "REG": "region"}
FRANCE = "F"
TOTAL = "_T"

# Le jeu ventile aussi par nombre d'enfants de moins de vingt-cinq ans. Seul le
# total est chargé : les deux dimensions décrivent les mêmes familles et
# s'additionneraient.
NOMBRE_ENFANTS = "NCH"

# Types de famille publiés. `11` (père seul), `12` (mère seule) et `223`
# (traditionnelle) ne le sont pas : ils ferment les identités de contrôle, et
# les publier ferait huit lignes là où cinq répondent à la question.
TYPES = {
    "_T": ("insee_familles", "Familles"),
    "1": ("insee_familles_monoparentales", "Familles monoparentales"),
    "21": ("insee_couples_sans_enfant", "Couples sans enfant au domicile"),
    "22": ("insee_couples_avec_enfant", "Couples avec enfant au domicile"),
    "220": ("insee_familles_recomposees", "Familles recomposées"),
}
TYPES_DE_CONTROLE = ("11", "12", "223")

DRAPEAU_REGROUPEMENT = "inclut_une_commune_rattachee"
STATUTS_REGROUPES = {"W"}

TOLERANCE = 0.001

# (nom, composantes, total). Une composante absente fait sauter le contrôle pour
# ce territoire : c'est le cas des recomposées avant 2023, que la source ne
# publie pas.
IDENTITES = (
    ("types_egalent_le_total", ("1", "21", "22"), "_T"),
    ("parents_seuls_egalent_les_monoparentales", ("11", "12"), "1"),
    ("recomposees_et_traditionnelles_egalent_les_couples", ("220", "223"), "22"),
)

PUBLIQUE = {
    "insee_familles": "Le nombre de familles du territoire : un couple, avec ou sans"
    " enfant, ou un parent seul avec au moins un enfant, sous le même toit. Une"
    " personne qui vit seule ne compte pas comme une famille.",
    "insee_familles_monoparentales": "Les familles où un seul parent vit avec son ou"
    " ses enfants. Est enfant celui qui vit chez un parent sans conjoint ni enfant à"
    " lui, quel que soit son âge : un adulte resté au domicile compte.",
    "insee_couples_sans_enfant": "Les couples vivant sans enfant au domicile — jeunes"
    " ménages comme couples dont les enfants sont partis. Le chiffre ne dit pas s'ils"
    " ont eu des enfants, seulement qu'aucun ne vit là.",
    "insee_couples_avec_enfant": "Les couples vivant avec au moins un enfant au"
    " domicile, quel que soit l'âge de cet enfant et que le couple soit marié,"
    " pacsé ou en union libre.",
    "insee_familles_recomposees": "Les couples avec enfant dont au moins un enfant"
    " n'est pas celui des deux parents. Ce chiffre n'existe que pour 2023 : la"
    " source ne le publie pas sur les millésimes précédents.",
}

TECHNIQUE = (
    "Recensement de la population, dossier complet « Famille », mesure « Nombre de"
    " familles » croisée au total de la ventilation par nombre d'enfants — que le jeu"
    " publie sur les mêmes lignes et qui compterait deux fois les mêmes familles."
    " Champ : France hors Mayotte. Trois millésimes : 2012, 2017, 2023 ; la"
    " distinction recomposée / traditionnelle n'existe qu'en 2023. Une famille au"
    " sens du recensement n'est pas un ménage : une personne seule n'en forme pas"
    " une, et le total des familles est plus bas que celui des résidences"
    " principales. Est enfant d'une famille la personne vivant avec au moins un de"
    " ses parents, sans conjoint ni enfant, quel que soit son âge — la ventilation"
    " par nombre d'enfants, elle, s'arrête à vingt-quatre ans. Le millésime résulte"
    " de cinq années d'enquêtes centrées sur lui et non d'une photographie au 1ᵉʳ"
    " janvier : les valeurs sont des estimations pondérées, d'où leurs décimales ;"
    " l'affichage les arrondit."
)


class IdentiteRompue(RuntimeError):
    """Une somme de la source ne fait plus son total.

    Le jeu sert les agrégats et leurs composantes à plat. Un type de famille
    entré dans le mauvais sac ne fait rien planter — seules ces identités le
    voient.
    """


def lire(archive: bytes) -> list[dict]:
    """CSV zippé du recensement -> familles par territoire et type."""
    with zipfile.ZipFile(io.BytesIO(archive)) as zip_:
        nom = next(n for n in zip_.namelist() if n.endswith("_data.csv"))
        with zip_.open(nom) as fichier:
            lecteur = csv.reader(
                io.TextIOWrapper(fichier, encoding="utf-8"), delimiter=";"
            )
            colonne = {nom_: rang for rang, nom_ in enumerate(next(lecteur))}
            objet, geo, type_ = colonne["GEO_OBJECT"], colonne["GEO"], colonne["TFN"]
            enfants = colonne[NOMBRE_ENFANTS]
            periode, valeur, statut = (
                colonne["TIME_PERIOD"], colonne["OBS_VALUE"], colonne["OBS_STATUS"],
            )
            return [
                {
                    "niveau": NIVEAUX[rang[objet]],
                    "code": rang[geo],
                    "periode": rang[periode],
                    "type": rang[type_],
                    "valeur": float(rang[valeur]),
                    "drapeaux": (
                        [DRAPEAU_REGROUPEMENT]
                        if rang[statut] in STATUTS_REGROUPES
                        else []
                    ),
                }
                for rang in lecteur
                if rang[objet] in NIVEAUX and rang[enfants] == TOTAL and rang[valeur]
            ]


def controler(lignes: list[dict], tolerance: float = TOLERANCE) -> dict[str, int]:
    """Les trois identités de la source, territoire par territoire et millésime.

    -> le nombre de territoires vérifiés par identité. Lève au premier écart.
    """
    table: dict[tuple, dict[str, float]] = {}
    for ligne in lignes:
        cle = (ligne["niveau"], ligne["code"], ligne["periode"])
        table.setdefault(cle, {})[ligne["type"]] = ligne["valeur"]
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
                    f" {valeurs[total]:.2f}). Un type est compté dans le mauvais sac."
                )
            compte += 1
        if not compte:
            raise IdentiteRompue(f"{nom} : aucun territoire n'a pu être vérifié")
        verifies[nom] = compte
    return verifies


def totaux_france(archive: bytes) -> dict[str, float]:
    """{millésime: nombre de familles de France entière}, tel que publié."""
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
                and rang[colonne["TFN"]] == TOTAL
                and rang[colonne[NOMBRE_ENFANTS]] == TOTAL
                and rang[colonne["OBS_VALUE"]]
            }


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for indicateur, libelle in TYPES.values():
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, ?, 'familles', 'observed',
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
                values (?, ?, ?, 'population', ?, 'count', true,
                        array['commune','epci','departement','region'], 'annuelle', true)
                on conflict (indicator_id) do update set
                    definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                    theme = excluded.theme, published = true
                """,
                (indicateur, DATASET, definition, libelle),
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
        if ligne["type"] not in TYPES:
            continue
        indicateur = TYPES[ligne["type"]][0]
        candidates.append(
            (indicateur, ligne["niveau"], ligne["code"], ligne["periode"], ligne["valeur"])
        )
        if ligne["drapeaux"]:
            drapeaux[(indicateur, ligne["niveau"], ligne["code"], ligne["periode"])] = (
                ligne["drapeaux"]
            )
    gardees, ecartes = filtrer_territoires_connus(conn, candidates)
    noms = [nom for nom, _ in TYPES.values()]
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
            conn, store, run_id, DATASET, SOURCE, "rp-famille.zip", archive, URL,
            "application/zip",
        )
        lignes = lire(archive)
        if not lignes:
            raise ValueError("aucune famille lue")
        verifies = controler(lignes)
        totaux = totaux_france(archive)
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'identites_des_types_de_famille', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "familles_france": {p: round(v) for p, v in sorted(totaux.items())},
            })),
        )
        conn.commit()
        ecrites, ecartes = ecrire(conn, run_id, lignes)
        entrepot.finish_run(conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites)
        periodes = sorted(totaux)
        print(
            f"familles : {ecrites} observations, millésimes {', '.join(periodes)},"
            f" {len(TYPES)} indicateurs, {ecartes} hors référentiel ;"
            f" familles France {periodes[-1]} : {totaux[periodes[-1]]:.0f}"
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
