"""Participation aux élections municipales (ministère de l'Intérieur).

**Ce module charge la participation, et rien d'autre. C'est une décision, pas
une limite technique.** Le fichier du ministère contient aussi, pour chaque
commune, le nom de chaque tête de liste, sa nuance politique, ses voix et ses
sièges. Quatre raisons de ne pas les publier ici :

1. **La nuance n'est pas une mesure.** Elle est attribuée par l'administration
   préfectorale, sa nomenclature change d'un scrutin à l'autre, et elle est
   régulièrement contestée par les listes qu'elle range. Une carte de France
   peinte par nuance donnerait à une convention administrative l'apparence d'une
   donnée statistique.
2. **Une municipale n'est pas un scrutin national.** Dans les communes de moins
   de 3 500 habitants, l'essentiel des listes est sans nuance ou « divers » : la
   carte serait grise là où vit le tiers du pays, et lisible ailleurs seulement.
   L'écart entre les deux se lirait comme un écart politique, alors qu'il est un
   écart de nomenclature.
3. **Ce site refuse les comparaisons dont il ne contrôle pas la définition.**
   Sur les nuances, il ne la contrôle pas.
4. **Les noms et prénoms des candidats sont des données personnelles** dont ce
   site n'a aucun usage. Ils ne sont pas téléchargés dans l'instantané publié,
   et les élus qui siègent sont déjà couverts par le Répertoire national des
   élus, chargé par ailleurs.

Ce qui reste — combien d'électeurs inscrits, combien se sont déplacés — est une
donnée civique, cartographiable, comparable d'une commune à l'autre, et qui ne
prête aucune intention à personne.

**Le premier tour, et lui seul.** C'est le seul qui a eu lieu partout :
34 836 communes. Le second ne concerne que celles où rien n'était joué, et une
carte qui mêlerait les deux comparerait des communes qui ont voté deux fois à
des communes qui ont voté une fois.

**Un inscrit n'est pas un habitant en âge de voter.** L'inscription est une
démarche : les non-inscrits, les mal-inscrits et les résidents étrangers — qui
votent aux municipales s'ils sont européens, pas sinon — font que le corps
électoral n'est pas la population majeure du territoire. Le taux de
participation se lit sur les inscrits, jamais sur les habitants.

**Les contrôles qui bloquent.** Trois identités de la source, vérifiées sur les
34 836 communes : inscrits = votants + abstentions ; votants = exprimés + blancs
+ nuls ; et le taux recalculé égale celui que la source publie, ce qui garantit
qu'aucune colonne n'a glissé.

Usage : python -m plateforme.normalize.elections [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
import json

from plateforme import couverture, entrepot
from plateforme.connectors import datagouv
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "interieur-municipales-2026-t1"
SOURCE = "data-gouv"
EXTERNE = "69b82a7de5d58cc06ad35ce0"
# Le fichier communal du premier tour. Le titre est stable d'une mise à jour à
# l'autre ; l'URL, non — elle porte l'horodatage du dépôt.
RESSOURCE = "Municipales 2026 - Résultats - Communes"
PERIODE = "2026"
THEME = "elections"
NIVEAU = "commune"

# Les colonnes lues, et elles seules : le fichier en compte 187, dont 169
# décrivent les listes et leurs têtes de liste. Nommer celles qu'on lit vaut
# refus explicite de toutes les autres.
COLONNES = ("Code commune", "Inscrits", "Votants", "Abstentions", "Exprimés",
            "Blancs", "Nuls", "% Votants")

INDICATEURS = {
    "elections_inscrits": (
        "Électeurs inscrits", "count", "électeurs",
        "Le nombre d'électeurs inscrits sur les listes de la commune au premier tour"
        " des municipales de 2026. S'inscrire est une démarche : ce n'est pas le nombre"
        " d'habitants en âge de voter.",
        "Nombre d'inscrits sur les listes électorales",
    ),
    "elections_votants": (
        "Votants", "count", "électeurs",
        "Le nombre d'électeurs qui se sont déplacés au premier tour des municipales de"
        " 2026, bulletins blancs et nuls compris.",
        "Nombre de votants",
    ),
    "elections_taux_participation": (
        "Taux de participation", "percent", "% des inscrits",
        "La part des électeurs inscrits qui se sont déplacés au premier tour des"
        " municipales de 2026 : 57,1 % en France. Une élection municipale ne se compare"
        " pas à une présidentielle, dont la participation est bien plus forte.",
        "Votants ÷ inscrits × 100",
    ),
    "elections_blancs": (
        "Bulletins blancs", "count", "bulletins",
        "Les bulletins déposés vides ou sans nom de liste. Comptés à part depuis 2014,"
        " ils expriment un refus de choisir sans être des suffrages exprimés.",
        "Nombre de bulletins blancs",
    ),
    "elections_nuls": (
        "Bulletins nuls", "count", "bulletins",
        "Les bulletins annulés : déchirés, annotés, ou de modèle non conforme. Ce n'est"
        " pas la même chose qu'un bulletin blanc, et les deux sont publiés séparément.",
        "Nombre de bulletins nuls",
    ),
}

# Un taux ne s'additionne pas d'une commune à l'autre.
ADDITIFS = {cle for cle, (_, unite, *_) in INDICATEURS.items() if unite == "count"}

# Ce que la source ne publie pas : le taux est notre division, pas son chiffre.
# La condition portait sur l'unité `rate`, qui servait donc à deux choses — le
# format d'affichage et la provenance. Le site ne connaît pas `rate` : il
# affichait « 58,1 rate » là où il fallait lire « 58,1 % ».
CALCULES = {"elections_taux_participation"}

TECHNIQUE = (
    "Résultats officiels du premier tour des élections municipales du 15 mars 2026,"
    " publiés par le ministère de l'Intérieur, à la maille communale. Seule la"
    " participation est reprise ici : ni les voix par liste, ni les nuances politiques,"
    " ni les sièges, ni les noms des candidats. La nuance est une convention"
    " administrative attribuée par les préfectures, dont la nomenclature change d'un"
    " scrutin à l'autre et que les listes contestent régulièrement ; dans les communes"
    " de moins de 3 500 habitants, l'essentiel des listes n'en porte pas. Seul le"
    " premier tour est chargé : c'est le seul qui a eu lieu dans les 34 836 communes,"
    " le second ne concernant que celles où aucune liste n'a été élue d'emblée. Un"
    " électeur inscrit n'est pas un habitant en âge de voter — l'inscription est une"
    " démarche, et les résidents étrangers ne votent aux municipales que s'ils sont"
    " ressortissants de l'Union européenne : le taux de participation se lit sur les"
    " inscrits et jamais sur la population. Les bulletins blancs, comptés séparément"
    " des nuls depuis 2014, entrent dans les votants mais pas dans les suffrages"
    " exprimés. La participation d'une municipale ne se compare pas à celle d'un autre"
    " scrutin ; ce site n'en publie qu'un, et aucune série n'est donc disponible."
)

TOLERANCE_TAUX = 0.05


class IdentiteRompue(RuntimeError):
    """Une identité de la participation ne se referme plus."""


def url_ressource() -> str:
    """L'URL du fichier communal, retrouvée par son titre dans le catalogue.

    L'URL porte l'horodatage du dépôt et change à chaque correction du
    ministère ; le titre, lui, est stable. La chercher plutôt que la coder en dur
    évite qu'une republication ne fasse charger un fichier périmé — ou rien.
    """
    jeu = datagouv.get_dataset(EXTERNE)
    for ressource in jeu.get("resources", []):
        if ressource.get("title", "").startswith(RESSOURCE):
            return ressource["url"]
    raise ValueError(
        f"aucune ressource « {RESSOURCE}… » dans le jeu {EXTERNE} :"
        " le ministère a renommé son fichier, il faut regarder avant de recharger"
    )


def _entier(valeur: str) -> int:
    return int(valeur) if valeur.strip() else 0


def _pourcentage(valeur: str) -> float:
    nettoye = valeur.strip().rstrip("%").replace(",", ".").replace(" ", "")
    return float(nettoye) if nettoye else 0.0


def lire(contenu: bytes) -> list[dict]:
    """CSV du ministère -> participation par commune, sans rien d'autre."""
    lecteur = csv.reader(
        io.StringIO(contenu.decode("utf-8")), delimiter=";"
    )
    colonne = {nom: rang for rang, nom in enumerate(next(lecteur))}
    manquantes = [nom for nom in COLONNES if nom not in colonne]
    if manquantes:
        raise ValueError(f"colonnes absentes du fichier : {manquantes}")
    return [
        {
            "code": rang[colonne["Code commune"]],
            "inscrits": _entier(rang[colonne["Inscrits"]]),
            "votants": _entier(rang[colonne["Votants"]]),
            "abstentions": _entier(rang[colonne["Abstentions"]]),
            "exprimes": _entier(rang[colonne["Exprimés"]]),
            "blancs": _entier(rang[colonne["Blancs"]]),
            "nuls": _entier(rang[colonne["Nuls"]]),
            # La source écrit « 55.08% », signe compris, et virgule décimale
            # selon les fichiers : les deux formes sont ramenées à un nombre.
            "taux_publie": _pourcentage(rang[colonne["% Votants"]]),
        }
        for rang in lecteur
        if rang[colonne["Code commune"]].strip()
    ]


def controler(lignes: list[dict]) -> dict[str, int]:
    """Les trois identités de la participation. Lève au premier écart.

    La troisième — le taux recalculé contre celui que la source publie — est
    celle qui attrape une colonne qui aurait glissé : les deux premières se
    refermeraient encore si `Votants` et `Exprimés` avaient été lues à l'envers,
    parce qu'elles ne comparent la source qu'à elle-même sur les mêmes colonnes.
    """
    verifies = dict.fromkeys(
        ("inscrits_font_votants_et_abstentions",
         "votants_font_exprimes_blancs_et_nuls",
         "le_taux_recalcule_egale_le_taux_publie"), 0
    )
    for ligne in lignes:
        if ligne["inscrits"] != ligne["votants"] + ligne["abstentions"]:
            raise IdentiteRompue(
                f"commune {ligne['code']} : {ligne['inscrits']} inscrits contre"
                f" {ligne['votants']} votants + {ligne['abstentions']} abstentions."
            )
        verifies["inscrits_font_votants_et_abstentions"] += 1
        if ligne["votants"] != ligne["exprimes"] + ligne["blancs"] + ligne["nuls"]:
            raise IdentiteRompue(
                f"commune {ligne['code']} : {ligne['votants']} votants contre"
                f" {ligne['exprimes']} exprimés + {ligne['blancs']} blancs +"
                f" {ligne['nuls']} nuls."
            )
        verifies["votants_font_exprimes_blancs_et_nuls"] += 1
        if not ligne["inscrits"]:
            continue
        recalcule = 100 * ligne["votants"] / ligne["inscrits"]
        if abs(recalcule - ligne["taux_publie"]) > TOLERANCE_TAUX:
            raise IdentiteRompue(
                f"commune {ligne['code']} : taux recalculé {recalcule:.2f} %"
                f" contre {ligne['taux_publie']:.2f} % publié. Une colonne a glissé."
            )
        verifies["le_taux_recalcule_egale_le_taux_publie"] += 1
    if not all(verifies.values()):
        raise IdentiteRompue(f"aucune commune vérifiée pour {sorted(verifies)}")
    return verifies


def totaux(lignes: list[dict]) -> dict[str, int]:
    """Les totaux France du fichier, tels quels — le repère du chargement."""
    return {
        mesure: sum(ligne[mesure] for ligne in lignes)
        for mesure in ("inscrits", "votants", "exprimes", "blancs", "nuls")
    }


def valeurs_publiees(lignes: list[dict]) -> list[tuple]:
    """-> [(indicateur, niveau, code, période, valeur)].

    Le taux est la seule valeur calculée, et une commune sans inscrit n'en a
    pas : diviser par zéro produirait un taux, pas une absence.
    """
    sorties = []
    for ligne in lignes:
        for cle, mesure in (
            ("elections_inscrits", "inscrits"),
            ("elections_votants", "votants"),
            ("elections_blancs", "blancs"),
            ("elections_nuls", "nuls"),
        ):
            sorties.append((cle, NIVEAU, ligne["code"], PERIODE, float(ligne[mesure])))
        if ligne["inscrits"]:
            sorties.append((
                "elections_taux_participation", NIVEAU, ligne["code"], PERIODE,
                100 * ligne["votants"] / ligne["inscrits"],
            ))
    return sorties


def inscrits_par_maille(candidates) -> dict[str, float]:
    """Combien d'inscrits porte la maille — les deux côtés de la couverture."""
    par_maille: dict[str, float] = {}
    for cle, niveau, _, _, valeur in candidates:
        if cle == "elections_inscrits":
            par_maille[niveau] = par_maille.get(niveau, 0.0) + valeur
    return par_maille


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for cle, (libelle, unite, notes, publique, formule) in INDICATEURS.items():
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, ?, ?, ?, array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (publique, TECHNIQUE, formule, notes,
                 "computed" if cle in CALCULES else "observed"),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, geo_levels, time_granularity, published)
                values (?, ?, ?, ?, ?, ?, ?, array['commune'], 'annuelle', true)
                on conflict (indicator_id) do update set
                    definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                    theme = excluded.theme, unit = excluded.unit, published = true
                """,
                (cle, DATASET, definition, THEME, libelle, unite, cle in ADDITIFS),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def ecrire(conn, run_id: str, lignes: list[dict]) -> tuple[int, int, dict[str, float]]:
    candidates = valeurs_publiees(lignes)
    gardees, ecartes = filtrer_territoires_connus(conn, candidates)
    noms = list(INDICATEURS)
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
    return len(gardees), len(ecartes), inscrits_par_maille(gardees)


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        garde_fou_volume(conn)
        url = url_ressource()
        contenu = telecharger(url, timeout=900)
        entrepot.etape(f"{len(contenu) // 1024 // 1024} Mo reçus")
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "municipales-2026-t1-communes.csv",
            contenu, url, "text/csv",
        )
        lignes = lire(contenu)
        entrepot.etape(f"{len(lignes)} communes lues")
        if not lignes:
            raise ValueError("aucune commune lue")
        verifies = controler(lignes)
        france = totaux(lignes)
        ecrites, ecartes, reconnus = ecrire(conn, run_id, lignes)
        entrepot.etape(f"{ecrites} observations écrites")
        parts = couverture.controler({NIVEAU: float(france["inscrits"])}, reconnus)
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'identites_de_la_participation_et_couverture', 'blocker',
                    true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "france": france,
                "taux_participation_france": round(
                    100 * france["votants"] / france["inscrits"], 2
                ),
                "couverture": {n: round(p, 4) for n, p in sorted(parts.items())},
                "hors_referentiel": ecartes,
            })),
        )
        conn.commit()
        entrepot.finish_run(conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites)
        print(
            f"élections : {ecrites} observations sur {len(lignes)} communes,"
            f" {len(INDICATEURS)} indicateurs, {ecartes} hors référentiel ;"
            f" France : {france['inscrits']} inscrits, {france['votants']} votants,"
            f" {100 * france['votants'] / france['inscrits']:.2f} % de participation"
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
