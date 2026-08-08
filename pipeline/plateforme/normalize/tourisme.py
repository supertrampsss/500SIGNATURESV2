"""Capacités d'hébergement touristique (INSEE, TOUR_CAP).

« Combien ma commune peut-elle accueillir de touristes ? » — et la réponse
refuse d'être un seul nombre.

**Il n'y a pas de total, et il n'y en aura pas.** La source ne publie aucune
capacité « tous hébergements confondus », et ce n'est pas un oubli : une chambre
d'hôtel, un emplacement de camping et un lit ne sont pas la même unité de
compte. Additionner 660 489 chambres et 848 302 emplacements donnerait un nombre
qui ne désigne rien. Ce module publie donc trois familles côte à côte, chacune
dans son unité, et jamais leur somme — la règle « une seule unité de compte par
somme » que le site tient déjà sur les classes de la délinquance.

**La même colonne de la source change d'unité.** `PLACE` vaut des chambres pour
un hôtel et des emplacements pour un camping. Lue sans regarder l'hébergement,
elle produirait exactement la somme que le paragraphe précédent interdit. C'est
pourquoi chaque indicateur est défini par un couple (mesure, hébergement), et
jamais par la mesure seule.

**Un emplacement n'est pas un lit.** Un emplacement de camping accueille
plusieurs personnes, une chambre d'hôtel une ou deux : aucune des trois familles
ne dit combien de personnes tiennent sur le territoire. Seuls les « autres
hébergements collectifs » portent une capacité en lits, parce que c'est ainsi
que la source les mesure.

**Une capacité n'est pas une fréquentation.** Ce sont les places qui existent au
1er janvier, pas celles qui ont été occupées. Une commune peut avoir mille
emplacements et personne dedans.

**Les contrôles qui bloquent.** Quatre identités de la source, vérifiées au
moment d'écrire ce module sur les 34 975 territoires qu'elle publie : les trois
sortes d'hébergement collectif font leur total ; les six classements — une à
cinq étoiles et non classé — font le total des hôtels et celui des campings ;
les emplacements à l'année plus ceux de passage font les emplacements ; et les
communes, les départements et les régions font chacun la France.

Usage : python -m plateforme.normalize.tourisme [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
import json
import zipfile

from plateforme import couverture, entrepot
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "melodi-tour-cap"
SOURCE = "insee-melodi"
JEU = "DS_TOUR_CAP"
URL = "https://api.insee.fr/melodi/file/DS_TOUR_CAP/DS_TOUR_CAP_2026_CSV_FR"

NIVEAUX = {"COM": "commune", "DEP": "departement", "REG": "region"}
TOTAL = "_T"

# France hors Mayotte — c'est le champ du jeu, et `F` en est le total. `FM`,
# la métropole, vaut 649 158 chambres d'hôtel contre 660 489 : la prendre pour
# total laisserait les communes d'outre-mer hors du contrôle de somme.
FRANCE = "F"

THEME = "tourisme"

# Hébergement -> (identifiant d'établissement, libellé).
HEBERGEMENTS = {
    "I551": ("insee_hotels", "Hôtels"),
    "I552": ("insee_hebergements_collectifs", "Autres hébergements collectifs"),
    "I553": ("insee_campings", "Terrains de camping"),
}

# Les trois sortes d'hébergement collectif. Elles ne sont pas publiées — le plan
# ne charge que les agrégats — mais elles sont lues : leur somme est l'un des
# contrôles bloquants.
COLLECTIFS = ("I552A", "I552B", "I552C")

# Les six classements. Non publiés non plus, et lus pour la même raison.
CLASSEMENTS = ("1", "2", "3", "4", "5", "NC")

# Les durées de séjour d'un emplacement de camping. Le total les comprend
# toutes les deux ; leur somme est le troisième contrôle.
SEJOURS = ("LONG", "SHORT")

# (mesure, hébergement) -> (identifiant, libellé, unité). La capacité est
# toujours définie par le couple : `PLACE` seul ne désigne pas une grandeur.
CAPACITES = {
    ("PLACE", "I551"): ("insee_hotels_chambres", "Chambres d'hôtel", "chambres"),
    ("PLACE", "I553"): ("insee_campings_emplacements", "Emplacements de camping",
                        "emplacements"),
    ("BEDPLACE", "I552"): ("insee_hebergements_collectifs_lits",
                           "Lits en hébergement collectif", "place-lits"),
}

TOLERANCE = 0.5

# (nom, total, composantes) — chaque terme est un croisement
# (mesure, hébergement, séjour, classement).
IDENTITES = (
    *(
        ("hebergements_collectifs",
         (mesure, "I552", TOTAL, TOTAL),
         tuple((mesure, sorte, TOTAL, TOTAL) for sorte in COLLECTIFS))
        for mesure in ("UNIT_LOC", "PLACE", "BEDPLACE")
    ),
    *(
        ("classements",
         (mesure, hebergement, TOTAL, TOTAL),
         tuple((mesure, hebergement, TOTAL, rang) for rang in CLASSEMENTS))
        for hebergement in ("I551", "I553")
        for mesure in ("UNIT_LOC", "PLACE")
    ),
    ("durees_de_sejour",
     ("PLACE", "I553", TOTAL, TOTAL),
     tuple(("PLACE", "I553", duree, TOTAL) for duree in SEJOURS)),
)

PUBLIQUE = {
    "insee_hotels": "Le nombre d'hôtels de tourisme sur le territoire au 1er janvier,"
    " classés ou non. Un hôtel compte pour un, quelle que soit sa taille.",
    "insee_hotels_chambres": "Le nombre de chambres d'hôtel offertes sur le territoire"
    " au 1er janvier. Une chambre n'est pas un lit et ne s'ajoute ni aux emplacements"
    " de camping ni aux lits des autres hébergements : trois unités différentes.",
    "insee_campings": "Le nombre de terrains de camping sur le territoire au"
    " 1er janvier, classés ou non.",
    "insee_campings_emplacements": "Le nombre d'emplacements de camping au"
    " 1er janvier. Un emplacement accueille plusieurs personnes, et près d'un sur cinq"
    " est loué à l'année plutôt qu'aux vacanciers de passage.",
    "insee_hebergements_collectifs": "Le nombre de villages vacances, résidences de"
    " tourisme, auberges de jeunesse et centres sportifs au 1er janvier. Ni les hôtels"
    " ni les campings, comptés à part.",
    "insee_hebergements_collectifs_lits": "Le nombre de lits offerts par les villages"
    " vacances, résidences de tourisme et auberges de jeunesse au 1er janvier. C'est la"
    " seule des trois familles d'hébergement dont la source mesure la capacité en lits.",
}

TECHNIQUE = (
    "Capacités d'hébergement touristique au 1er janvier 2026, France hors Mayotte."
    " Ce sont des capacités offertes, pas une fréquentation : elles disent ce qui"
    " existe, pas ce qui a été occupé. Les trois familles d'hébergement portent trois"
    " unités de compte différentes (chambres pour les hôtels, emplacements pour les"
    " campings, place-lits pour les autres hébergements collectifs), et la source ne"
    " publie aucun total les réunissant : les additionner donnerait un nombre sans"
    " signification, et ce site ne le fabrique pas. Un emplacement de camping accueille"
    " plusieurs personnes quand une chambre en accueille une ou deux : aucune de ces"
    " trois grandeurs ne dit combien de personnes le territoire peut héberger. Les"
    " emplacements comprennent ceux qui sont loués à l'année (160 477 sur 848 302 en"
    " France, soit 18,9 %), dont l'occupant n'est pas un vacancier de passage. Les"
    " hôtels et les campings sont comptés classés ou non : 3 509 hôtels et 1 924"
    " campings ne portent aucune étoile, et l'absence de classement n'est pas une"
    " absence d'établissement. Un seul millésime est publié, celui du 1er janvier 2026 ;"
    " il n'y a donc pas de série et aucune évolution ne peut être lue ici."
)


class IdentiteRompue(RuntimeError):
    """Une somme de la source ne fait plus son total."""


class TotalIncoherent(RuntimeError):
    """Une maille entière ne fait plus le total France."""


def lire(archive: bytes) -> list[dict]:
    """CSV zippé de TOUR_CAP -> une valeur par territoire et par croisement.

    Tout ce dont les contrôles ont besoin est lu ; le tri entre ce qui est
    publié et ce qui ne sert qu'à vérifier se fait dans `valeurs_publiees`.
    """
    with zipfile.ZipFile(io.BytesIO(archive)) as zip_:
        nom = next(n for n in zip_.namelist() if n.endswith("_data.csv"))
        with zip_.open(nom) as fichier:
            lecteur = csv.reader(
                io.TextIOWrapper(fichier, encoding="utf-8"), delimiter=";"
            )
            colonne = {nom_: rang for rang, nom_ in enumerate(next(lecteur))}
            objet, geo, mesure = (
                colonne["GEO_OBJECT"], colonne["GEO"], colonne["TOUR_MEASURE"],
            )
            activite, sejour, classement = (
                colonne["ACTIVITY"], colonne["L_STAY"], colonne["UNIT_LOC_RANKING"],
            )
            periode, valeur = colonne["TIME_PERIOD"], colonne["OBS_VALUE"]
            return [
                {
                    "niveau": NIVEAUX[rang[objet]],
                    "code": rang[geo],
                    "periode": rang[periode],
                    "mesure": rang[mesure],
                    "hebergement": rang[activite],
                    "sejour": rang[sejour],
                    "classement": rang[classement],
                    "valeur": float(rang[valeur]),
                }
                for rang in lecteur
                if rang[objet] in NIVEAUX and rang[valeur]
            ]


def _par_territoire(lignes: list[dict]) -> dict[tuple, dict[tuple, float]]:
    table: dict[tuple, dict[tuple, float]] = {}
    for ligne in lignes:
        cle = (ligne["niveau"], ligne["code"], ligne["periode"])
        table.setdefault(cle, {})[
            (ligne["mesure"], ligne["hebergement"], ligne["sejour"], ligne["classement"])
        ] = ligne["valeur"]
    return table


def controler(lignes: list[dict], tolerance: float = TOLERANCE) -> dict[str, int]:
    """Les trois identités internes de la source. Lève au premier écart.

    Chacune garde un filtre différent. Les trois sortes d'hébergement collectif
    attrapent une hiérarchie lue à plat — la source sert `I552` *avec* ses
    composantes. Les six classements attrapent un filtre d'étoiles qui aurait
    lâché, et c'est le seul contrôle qui touche `NC` : oublier les non classés
    ferait perdre 3 509 hôtels sans rien casser. Les deux durées de séjour
    attrapent la même erreur sur les emplacements de camping.

    Un croisement manquant est une identité rompue, pas un cas à sauter : la
    source sert les cinquante-quatre lignes pour chacun des territoires qu'elle
    publie, et un territoire amputé publierait des capacités incomplètes sans
    que le contrôle des mailles, qui ne somme que les totaux, ne le voie.
    """
    verifies = dict.fromkeys({nom for nom, _, _ in IDENTITES}, 0)
    for (niveau, code, periode), valeurs in _par_territoire(lignes).items():
        for nom, total, composantes in IDENTITES:
            manquants = [c for c in (total, *composantes) if c not in valeurs]
            if manquants:
                raise IdentiteRompue(
                    f"croisement absent : {niveau} {code} en {periode} n'a pas"
                    f" {manquants[0]}. Une capacité serait publiée amputée sans que"
                    " la somme des mailles le montre."
                )
            somme = sum(valeurs[c] for c in composantes)
            ecart = somme - valeurs[total]
            if abs(ecart) > tolerance:
                raise IdentiteRompue(
                    f"{nom} : {niveau} {code} en {periode} s'écarte de {ecart:+.0f}"
                    f" ({somme:.0f} contre {valeurs[total]:.0f})."
                )
            verifies[nom] += 1
    if not all(verifies.values()):
        raise IdentiteRompue(f"aucun territoire vérifié pour {sorted(verifies)}")
    return verifies


def controler_totaux(
    lignes: list[dict], totaux: dict[tuple, float], tolerance: float = TOLERANCE
) -> dict[str, dict[str, float]]:
    """Chaque maille chargée fait la France, capacité par capacité."""
    publies = {(m, h) for m, h in CAPACITES} | {("UNIT_LOC", h) for h in HEBERGEMENTS}
    sommes: dict[str, dict[str, float]] = {}
    for ligne in lignes:
        cle = (ligne["mesure"], ligne["hebergement"])
        if ligne["sejour"] != TOTAL or ligne["classement"] != TOTAL or cle not in publies:
            continue
        nom = f"{ligne['mesure']}:{ligne['hebergement']}"
        sommes.setdefault(nom, {}).setdefault(ligne["niveau"], 0.0)
        sommes[nom][ligne["niveau"]] += ligne["valeur"]
    for (mesure, hebergement), total in totaux.items():
        nom = f"{mesure}:{hebergement}"
        for niveau, somme in sorted(sommes.get(nom, {}).items()):
            if abs(somme - total) > tolerance:
                raise TotalIncoherent(
                    f"la somme des {niveau}s ne fait pas le total France pour"
                    f" {nom} : {somme:.0f} contre {total:.0f}"
                    f" ({somme - total:+.0f}). Un territoire n'est plus rattaché."
                )
    return sommes


def totaux_france(archive: bytes) -> dict[tuple, float]:
    """{(mesure, hébergement): total France} — le repère des contrôles de somme."""
    attendus = {(mesure, heb) for mesure, heb in CAPACITES} | {
        ("UNIT_LOC", heb) for heb in HEBERGEMENTS
    }
    with zipfile.ZipFile(io.BytesIO(archive)) as zip_:
        nom = next(n for n in zip_.namelist() if n.endswith("_data.csv"))
        with zip_.open(nom) as fichier:
            lecteur = csv.reader(
                io.TextIOWrapper(fichier, encoding="utf-8"), delimiter=";"
            )
            colonne = {nom_: rang for rang, nom_ in enumerate(next(lecteur))}
            trouves = {}
            for rang in lecteur:
                cle = (rang[colonne["TOUR_MEASURE"]], rang[colonne["ACTIVITY"]])
                if (
                    rang[colonne["GEO_OBJECT"]] == "FRANCE"
                    and rang[colonne["GEO"]] == FRANCE
                    and rang[colonne["L_STAY"]] == TOTAL
                    and rang[colonne["UNIT_LOC_RANKING"]] == TOTAL
                    and cle in attendus
                    and rang[colonne["OBS_VALUE"]]
                ):
                    trouves[cle] = float(rang[colonne["OBS_VALUE"]])
            return trouves


def fiches() -> dict[str, dict[str, str]]:
    """{identifiant: {libelle, public, formule, unite}} — les six publiés."""
    publiees = {
        identifiant: {
            "libelle": libelle,
            "public": PUBLIQUE[identifiant],
            "formule": f"Nombre de « {libelle} » au 1er janvier",
            "unite": "établissements",
        }
        for identifiant, libelle in HEBERGEMENTS.values()
    }
    publiees.update(
        {
            identifiant: {
                "libelle": libelle,
                "public": PUBLIQUE[identifiant],
                "formule": f"Nombre de « {libelle} » au 1er janvier",
                "unite": unite,
            }
            for (identifiant, libelle, unite) in CAPACITES.values()
        }
    )
    return publiees


def valeurs_publiees(lignes: list[dict]) -> list[tuple]:
    """-> [(indicateur, niveau, code, période, valeur)].

    Seuls les croisements où le séjour et le classement valent « total »
    sortent : les composantes n'ont servi qu'aux contrôles, et les publier
    compterait chaque hôtel deux fois.
    """
    sorties = []
    for ligne in lignes:
        if ligne["sejour"] != TOTAL or ligne["classement"] != TOTAL:
            continue
        couple = (ligne["mesure"], ligne["hebergement"])
        if couple in CAPACITES:
            identifiant = CAPACITES[couple][0]
        elif ligne["mesure"] == "UNIT_LOC" and ligne["hebergement"] in HEBERGEMENTS:
            identifiant = HEBERGEMENTS[ligne["hebergement"]][0]
        else:
            continue
        sorties.append(
            (identifiant, ligne["niveau"], ligne["code"], ligne["periode"],
             ligne["valeur"])
        )
    return sorties


def hotels_par_maille(candidates) -> dict[str, float]:
    """Combien d'hôtels porte chaque maille — les deux côtés de la couverture."""
    par_maille: dict[str, float] = {}
    for cle, niveau, _, _, valeur in candidates:
        if cle == HEBERGEMENTS["I551"][0]:
            par_maille[niveau] = par_maille.get(niveau, 0.0) + valeur
    return par_maille


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for cle, fiche in fiches().items():
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, ?, ?, 'observed', array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (fiche["public"], TECHNIQUE, fiche["formule"], fiche["unite"]),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, geo_levels, time_granularity, published)
                values (?, ?, ?, ?, ?, 'count', true,
                        array['commune','departement','region'], 'annuelle', true)
                on conflict (indicator_id) do update set unit = excluded.unit,
                    definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                    theme = excluded.theme, published = true
                """,
                (cle, DATASET, definition, THEME, fiche["libelle"]),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def ecrire(conn, run_id: str, lignes: list[dict]) -> tuple[int, int, dict[str, float]]:
    """Renvoie aussi, par maille, les hôtels **réellement écrits**."""
    candidates = valeurs_publiees(lignes)
    gardees, ecartes = filtrer_territoires_connus(conn, candidates)
    noms = list(fiches())
    with conn.cursor() as curseur:
        curseur.execute(
            "delete from core.observations where indicator_id = any(?)", (noms,)
        )
        entrepot.copier(
            conn,
            "core.observations",
            ["indicator_id", "geo_level", "geo_code", "geo_vintage", "period", "value",
             "run_id"],
            (
                (cle, niveau, code, MILLESIME, periode, valeur, run_id)
                for cle, niveau, code, periode, valeur in gardees
            ),
        )
    return len(gardees), len(ecartes), hotels_par_maille(gardees)


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        garde_fou_volume(conn)
        archive = telecharger(URL, timeout=900)
        entrepot.etape(f"archive de {len(archive) / 1e6:.0f} Mo téléchargée")
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "tour-cap.zip", archive, URL,
            "application/zip",
        )
        lignes = lire(archive)
        entrepot.etape(f"{len(lignes)} lignes lues")
        if not lignes:
            raise ValueError("aucune capacité lue")
        verifies = controler(lignes)
        totaux = totaux_france(archive)
        attendus = {(m, h) for m, h in CAPACITES} | {("UNIT_LOC", h) for h in HEBERGEMENTS}
        if set(totaux) != attendus:
            raise TotalIncoherent(f"totaux France incomplets : {sorted(totaux)}")
        sommes = controler_totaux(lignes, totaux)
        ecrites, ecartes, reconnus = ecrire(conn, run_id, lignes)
        entrepot.etape(f"{ecrites} observations écrites")
        parts = couverture.controler(sommes["UNIT_LOC:I551"], reconnus)
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'identites_des_capacites_et_couverture', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "france": {f"{m}:{h}": round(v) for (m, h), v in sorted(totaux.items())},
                "couverture": {n: round(p, 4) for n, p in sorted(parts.items())},
                "hors_referentiel": ecartes,
            })),
        )
        conn.commit()
        entrepot.finish_run(conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites)
        print(
            f"tourisme : {ecrites} observations, {len(fiches())} indicateurs,"
            f" {ecartes} hors référentiel ; France :"
            f" {totaux[('UNIT_LOC', 'I551')]:.0f} hôtels et"
            f" {totaux[('PLACE', 'I551')]:.0f} chambres,"
            f" {totaux[('UNIT_LOC', 'I553')]:.0f} campings et"
            f" {totaux[('PLACE', 'I553')]:.0f} emplacements"
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
