"""Activité, chômage et diplômes par commune (INSEE, recensement).

« Y a-t-il du travail chez moi ? » n'avait pas de réponse communale sur ce site :
le taux de chômage publié jusqu'ici s'arrête au département. Ce module la donne,
et une réserve gouverne tout le reste.

**Le chômage du recensement n'est pas celui du BIT.** Le recensement compte les
personnes qui se déclarent au chômage ; le taux localisé du BIT, déjà publié
ici, applique des critères stricts — sans emploi, disponible, en recherche
active — et donne un chiffre systématiquement plus bas. Les deux existent, ils
mesurent des choses différentes, et aucun des deux n'est faux. Ce site publie les
deux, chacun sous son nom, et interdit de les comparer entre territoires sans
regarder lequel est affiché.

**Quinze à soixante-quatre ans, la population de référence de l'activité.** Ce
n'est ni la population municipale, ni les quinze ans et plus des catégories
sociales : trois périmètres, trois chiffres, chacun nommé.

**Les diplômes n'existent qu'en 2023.** La source ne ventile par diplôme que le
dernier millésime. L'indicateur n'a donc pas de série, et la fiche le dit plutôt
que de laisser croire à une disparition.

**Le supérieur est une somme, et elle est déclarée.** La source publie trois
niveaux — bac+2, bac+3/4, bac+5 et au-delà — que personne ne lit séparément. Ils
sont additionnés en un « enseignement supérieur », sur la même population et la
même unité de compte, et la formule le dit. Les quatre autres niveaux restent
tels quels, si bien que les cinq indicateurs publiés somment au total.

**Les contrôles qui bloquent.** Trois identités de la source, vérifiées au
moment d'écrire ce module : actifs occupés + chômeurs = actifs, sur les 108 659
couples territoire-millésime ; actifs + inactifs = population de 15 à 64 ans, sur
les mêmes ; les sept niveaux de diplôme = la même population, sur les 36 223
couples de 2023.

Usage : python -m plateforme.normalize.emploi [--store r2:plateforme-raw]
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

DATASET = "melodi-rp-emploi"
SOURCE = "insee-melodi"
JEU = "DS_RP_EMPLOI_LR_PRINC"
URL = (
    "https://api.insee.fr/melodi/file/DS_RP_EMPLOI_LR_PRINC/"
    "DS_RP_EMPLOI_LR_PRINC_2023_CSV_FR"
)

NIVEAUX = {"COM": "commune", "DEP": "departement", "REG": "region"}
FRANCE = "F"
TOTAL = "_T"

# La tranche d'âge de référence de l'activité. Le jeu en publie cinq ; celle-ci
# est la seule sur laquelle un taux d'activité ou de chômage a un sens, et c'est
# celle que la statistique publique utilise.
AGE = "Y15T64"

# Statut d'emploi -> (identifiant, libellé). `31`, `33`, `35` et `36`
# — retraités, étudiants, au foyer, autres inactifs — ne sont pas publiés : les
# catégories sociales, déjà chargées, portent la même distinction sur une autre
# population, et deux « retraités » différents sur la même fiche se
# contrediraient.
STATUTS = {
    "_T": ("insee_population_15_64_ans", "Population de 15 à 64 ans"),
    "1T2": ("insee_actifs", "Population active"),
    "1": ("insee_actifs_occupes", "Actifs ayant un emploi"),
    # « Chômeurs au sens du recensement » : la précision méthodologique tenait
    # lieu de libellé. Elle vit dans la fiche, où on la lit quand on la
    # cherche ; en titre de ligne elle noyait le mot qui informe.
    "2": ("insee_chomeurs_rp", "Chômeurs"),
    "3": ("insee_inactifs", "Inactifs de 15 à 64 ans"),
}

# Diplôme -> (identifiant, libellé). Les trois niveaux du supérieur sont
# additionnés plus bas : personne ne lit « bac+2 » séparément de « bac+5 », et
# la somme se fait sur la même population et la même unité de compte.
DIPLOMES = {
    "001T100_RP": ("insee_diplome_aucun", "Aucun diplôme ou certificat d'études"),
    "200_RP": ("insee_diplome_brevet", "Brevet des collèges"),
    "300_RP": ("insee_diplome_cap_bep", "CAP ou BEP"),
    "350T351_RP": ("insee_diplome_bac", "Baccalauréat"),
}
SUPERIEUR = ("500_RP", "600_RP", "700_RP")
DIPLOME_SUPERIEUR = ("insee_diplome_superieur", "Enseignement supérieur")

THEME_EMPLOI = "emploi"
THEME_DIPLOMES = "diplomes"

DRAPEAU_REGROUPEMENT = "inclut_une_commune_rattachee"
STATUTS_REGROUPES = {"W"}

TOLERANCE = 0.001

# (nom, composantes, total), chaque terme étant un couple (statut, diplôme).
IDENTITES = (
    ("actifs_occupes_et_chomeurs_font_les_actifs",
     (("1", TOTAL), ("2", TOTAL)), ("1T2", TOTAL)),
    ("actifs_et_inactifs_font_les_quinze_soixante_quatre",
     (("1T2", TOTAL), ("3", TOTAL)), (TOTAL, TOTAL)),
    ("les_diplomes_font_la_meme_population",
     tuple((TOTAL, code) for code in (*DIPLOMES, *SUPERIEUR)), (TOTAL, TOTAL)),
)

PUBLIQUE = {
    "insee_population_15_64_ans": "Le nombre d'habitants de 15 à 64 ans, la tranche"
    " d'âge sur laquelle se calculent l'activité et le chômage. Ce n'est ni la"
    " population du territoire, ni les quinze ans et plus des catégories sociales.",
    "insee_actifs": "Les habitants de 15 à 64 ans qui travaillent ou cherchent du"
    " travail. Rapporté à leur classe d'âge, c'est le taux d'activité du territoire.",
    "insee_actifs_occupes": "Les habitants de 15 à 64 ans qui ont un emploi, quel"
    " qu'il soit : salarié, indépendant, à temps plein ou partiel. Ils sont comptés"
    " là où ils habitent, pas là où ils travaillent.",
    "insee_chomeurs_rp": "Les habitants de 15 à 64 ans qui se déclarent au chômage au"
    " recensement. Ce n'est pas le chômage au sens du Bureau international du travail,"
    " publié ici sous « Taux de chômage » : les critères diffèrent et le chiffre aussi.",
    "insee_inactifs": "Les habitants de 15 à 64 ans qui ne travaillent pas et n'en"
    " cherchent pas : étudiants, retraités précoces, personnes au foyer. Ne pas être"
    " actif n'est pas être au chômage.",
    "insee_diplome_aucun": "Les habitants de 15 à 64 ans sans diplôme ou titulaires"
    " du seul certificat d'études primaires. Les élèves encore scolarisés y figurent"
    " tant qu'ils n'ont rien obtenu.",
    "insee_diplome_brevet": "Les habitants de 15 à 64 ans dont le diplôme le plus"
    " élevé est le brevet des collèges ou un titre équivalent.",
    "insee_diplome_cap_bep": "Les habitants de 15 à 64 ans dont le diplôme le plus"
    " élevé est un CAP, un BEP ou un titre de niveau équivalent.",
    "insee_diplome_bac": "Les habitants de 15 à 64 ans dont le diplôme le plus élevé"
    " est le baccalauréat ou un brevet professionnel.",
    "insee_diplome_superieur": "Les habitants de 15 à 64 ans titulaires d'un diplôme"
    " du supérieur, de bac+2 au doctorat. C'est la somme des trois niveaux que la"
    " source publie séparément. Ce chiffre n'existe que pour 2023.",
}

TECHNIQUE = (
    "Recensement de la population, dossier complet « Population active et chômage »,"
    " au lieu de résidence. Population de 15 à 64 ans, tous sexes, France hors"
    " Mayotte. Le chômage y est déclaratif : une personne est chômeuse si elle se"
    " déclare telle, sans les critères du Bureau international du travail — sans"
    " emploi, disponible sous quinze jours, en recherche active — qui fondent le taux"
    " de chômage localisé publié par ailleurs sur ce site. Les deux chiffres"
    " coexistent, mesurent des choses différentes, et le taux du recensement est le"
    " plus élevé des deux. Les actifs sont comptés au lieu de résidence, pas au lieu"
    " de travail : une commune-dortoir compte ses actifs, la commune où ils"
    " travaillent ne les compte pas. Trois millésimes — 2012, 2017, 2023 — pour"
    " l'activité ; la ventilation par diplôme n'existe qu'en 2023. « Enseignement"
    " supérieur » est la somme des trois niveaux publiés séparément par la source"
    " (bac+2, bac+3/4, bac+5 et plus) sur la même population, l'identité étant"
    " vérifiée au chargement. Le millésime résulte de cinq années d'enquêtes centrées"
    " sur lui : les valeurs sont des estimations pondérées, d'où leurs décimales."
)


class IdentiteRompue(RuntimeError):
    """Une somme de la source ne fait plus son total."""


def croisements_retenus() -> frozenset[tuple[str, str]]:
    """Les couples (statut d'emploi, diplôme) que la lecture garde.

    Le jeu en croise cent quatre-vingt-dix-sept, sur cinq tranches d'âge et
    trois sexes : 17,9 millions de lignes. Douze suffisent — les cinq statuts
    publiés et les sept niveaux de diplôme, dont trois ne sortent que sommés.
    """
    return (
        frozenset((statut, TOTAL) for statut in STATUTS)
        | frozenset((TOTAL, code) for code in (*DIPLOMES, *SUPERIEUR))
    )


def lire(archive: bytes) -> list[dict]:
    """CSV zippé du recensement -> population par territoire, statut et diplôme."""
    with zipfile.ZipFile(io.BytesIO(archive)) as zip_:
        nom = next(n for n in zip_.namelist() if n.endswith("_data.csv"))
        with zip_.open(nom) as fichier:
            lecteur = csv.reader(
                io.TextIOWrapper(fichier, encoding="utf-8"), delimiter=";"
            )
            colonne = {nom_: rang for rang, nom_ in enumerate(next(lecteur))}
            objet, geo, sexe, age = (
                colonne["GEO_OBJECT"], colonne["GEO"], colonne["SEX"], colonne["AGE"],
            )
            statut_emploi, diplome = colonne["EMPSTA_ENQ"], colonne["EDUC"]
            periode, valeur, statut = (
                colonne["TIME_PERIOD"], colonne["OBS_VALUE"], colonne["OBS_STATUS"],
            )
            retenus = croisements_retenus()
            return [
                {
                    "niveau": NIVEAUX[rang[objet]],
                    "code": rang[geo],
                    "periode": rang[periode],
                    "statut": rang[statut_emploi],
                    "diplome": rang[diplome],
                    "valeur": float(rang[valeur]),
                    "drapeaux": (
                        [DRAPEAU_REGROUPEMENT]
                        if rang[statut] in STATUTS_REGROUPES
                        else []
                    ),
                }
                for rang in lecteur
                if rang[objet] in NIVEAUX
                and rang[sexe] == TOTAL
                and rang[age] == AGE
                and (rang[statut_emploi], rang[diplome]) in retenus
                and rang[valeur]
            ]


def _par_cle(lignes: list[dict]) -> dict[tuple, dict[tuple, float]]:
    table: dict[tuple, dict[tuple, float]] = {}
    for ligne in lignes:
        cle = (ligne["niveau"], ligne["code"], ligne["periode"])
        table.setdefault(cle, {})[(ligne["statut"], ligne["diplome"])] = ligne["valeur"]
    return table


def controler(lignes: list[dict], tolerance: float = TOLERANCE) -> dict[str, int]:
    """Les trois identités de la source. Lève au premier écart.

    La troisième ne porte que sur 2023 : la source ne ventile par diplôme que le
    dernier millésime, et le contrôle saute ceux où la composante manque.
    """
    table = _par_cle(lignes)
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
    """{millésime: population de 15 à 64 ans de France entière}."""
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
                and rang[colonne["AGE"]] == AGE
                and rang[colonne["EMPSTA_ENQ"]] == TOTAL
                and rang[colonne["EDUC"]] == TOTAL
                and rang[colonne["OBS_VALUE"]]
            }


def indicateurs() -> dict[str, tuple[str, str]]:
    """{identifiant: (libellé, thème)} — tout ce que ce module publie."""
    publies = {
        identifiant: (libelle, THEME_EMPLOI)
        for identifiant, libelle in STATUTS.values()
    }
    publies.update(
        {
            identifiant: (libelle, THEME_DIPLOMES)
            for identifiant, libelle in DIPLOMES.values()
        }
    )
    publies[DIPLOME_SUPERIEUR[0]] = (DIPLOME_SUPERIEUR[1], THEME_DIPLOMES)
    return publies


def valeurs_publiees(lignes: list[dict]) -> list[tuple]:
    """-> [(indicateur, niveau, code, période, valeur, drapeaux)].

    Le supérieur est la seule valeur calculée : la somme des trois niveaux, et
    seulement quand ils sont tous les trois là — un supérieur amputé d'un niveau
    serait un sous-comptage présenté comme une mesure. Il hérite des drapeaux de
    ses composantes : une commune nouvelle qui reçoit les diplômés d'une
    déléguée doit le signaler sur la somme comme sur les parts, faute de quoi
    la même donnée serait signalée à un endroit et pas à l'autre.
    """
    sorties = []
    for ligne in lignes:
        statut, diplome = ligne["statut"], ligne["diplome"]
        if diplome == TOTAL and statut in STATUTS:
            identifiant = STATUTS[statut][0]
        elif statut == TOTAL and diplome in DIPLOMES:
            identifiant = DIPLOMES[diplome][0]
        else:
            continue
        sorties.append(
            (identifiant, ligne["niveau"], ligne["code"], ligne["periode"],
             ligne["valeur"], ligne["drapeaux"])
        )
    marques: dict[tuple, list[str]] = {}
    for ligne in lignes:
        if ligne["drapeaux"] and (ligne["statut"], ligne["diplome"]) in {
            (TOTAL, code_) for code_ in SUPERIEUR
        }:
            cle = (ligne["niveau"], ligne["code"], ligne["periode"])
            marques[cle] = sorted(set(marques.get(cle, [])) | set(ligne["drapeaux"]))
    for (niveau, code, periode), valeurs in _par_cle(lignes).items():
        parts = [valeurs.get((TOTAL, code_)) for code_ in SUPERIEUR]
        if any(part is None for part in parts):
            continue
        sorties.append(
            (DIPLOME_SUPERIEUR[0], niveau, code, periode, sum(parts),
             marques.get((niveau, code, periode), []))
        )
    return sorties


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for identifiant, (libelle, theme) in indicateurs().items():
            formule = (
                "Somme des trois niveaux du supérieur publiés par la source"
                if identifiant == DIPLOME_SUPERIEUR[0]
                else f"Nombre de « {libelle} »"
            )
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, ?, 'personnes de 15 à 64 ans', 'observed',
                        array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (PUBLIQUE[identifiant], TECHNIQUE, formule),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, geo_levels, time_granularity, published)
                values (?, ?, ?, ?, ?, 'count', true,
                        array['commune','departement','region'], 'annuelle', true)
                on conflict (indicator_id) do update set
                    definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                    theme = excluded.theme, published = true
                """,
                (identifiant, DATASET, definition, theme, libelle),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def ecrire(conn, run_id: str, lignes: list[dict]) -> tuple[int, int]:
    valeurs = valeurs_publiees(lignes)
    candidates = [(cle, niveau, code, periode, valeur)
                  for cle, niveau, code, periode, valeur, _ in valeurs]
    drapeaux = {
        (cle, niveau, code, periode): marques
        for cle, niveau, code, periode, _, marques in valeurs
        if marques
    }
    gardees, ecartes = filtrer_territoires_connus(conn, candidates)
    noms = list(indicateurs())
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
        archive = telecharger(URL, timeout=900)
        entrepot.etape(f"archive de {len(archive) / 1e6:.0f} Mo téléchargée")
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "rp-emploi.zip", archive, URL,
            "application/zip",
        )
        lignes = lire(archive)
        entrepot.etape(f"{len(lignes)} lignes lues")
        if not lignes:
            raise ValueError("aucune population active lue")
        verifies = controler(lignes)
        totaux = totaux_france(archive)
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'identites_de_l_activite', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "quinze_soixante_quatre_france": {
                    p: round(v) for p, v in sorted(totaux.items())
                },
            })),
        )
        conn.commit()
        ecrites, ecartes = ecrire(conn, run_id, lignes)
        entrepot.etape(f"{ecrites} observations écrites")
        entrepot.finish_run(conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites)
        periodes = sorted(totaux)
        print(
            f"activité et diplômes : {ecrites} observations, millésimes"
            f" {', '.join(periodes)}, {len(indicateurs())} indicateurs,"
            f" {ecartes} hors référentiel ; 15-64 ans en France"
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
