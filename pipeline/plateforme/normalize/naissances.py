"""Naissances domiciliées par commune (INSEE, état civil) vers core.observations.

Le miroir de `deces.py` : même producteur, même jeu de données jumeau, mêmes
distinctions. Le registre annonce `etat-civil-agrege` — « naissances et décès
agrégés par commune » — et seuls les décès étaient chargés ; ce module referme
la moitié manquante. La donnée vient de l'API Melodi, comme celle des décès, et
le fichier archivé le dit.

**Domiciliées, pas enregistrées — et c'est toute la différence.** L'INSEE publie
les deux comptages, et la source le dit en toutes lettres : « les totaux France
diffusés ici correspondent aux naissances enregistrées en France et domiciliées
en France. Ces derniers diffèrent de ceux des naissances enregistrées en France
quel que soit le lieu de domicile de la mère ». Le premier fait exploser le
chiffre des communes qui ont une maternité — on y naît sans y vivre — et ne dit
rien du territoire. C'est le second qui est chargé, ventilé **au lieu de
domicile de la mère**.

**Un décompte n'est pas un taux de natalité, encore moins une fécondité.** Une
ville nouvelle de vingt mille jeunes ménages voit naître plus d'enfants qu'une
commune de vingt mille retraités, sans qu'on y fasse plus d'enfants par femme.
Le nombre est publié tel quel ; le rapporter aux habitants donnerait un taux
brut, qui mesure d'abord la structure par âge.

**Mayotte n'entre qu'à partir de 2014.** Avant, les valeurs sont *manquantes* —
absentes du fichier, pas nulles — pour Mayotte et pour tout total qui
l'englobe, France entière comprise. Une série qui les lirait comme des zéros
ferait apparaître une natalité mahoraise surgie de nulle part en 2014, et un
saut de dix mille naissances sur le total national.

**Lyon et Marseille : l'arrondissement du domicile de la mère n'est pas toujours
renseigné.** La source crée alors les codes `693XX — Lyon arrondissement non
connu` et `132XX — Marseille arrondissement non connu` (et `751XX` pour Paris,
toujours à zéro). Ces codes n'existent dans aucun référentiel géographique :
`filtrer_territoires_connus` les écarterait et les naissances qu'ils portent
disparaîtraient **silencieusement** de la ventilation par arrondissement — 443
naissances sur dix-huit exercices. Elles sont rattachées à la commune mère, qui
les porte déjà : c'est ce que le second contrôle vérifie, arrondissement par
arrondissement et exercice par exercice.

**Les deux contrôles qui bloquent.** La somme des communes doit égaler
exactement le total France du même exercice — 659 731 en 2024, 642 905 en 2025,
à l'unité près des deux côtés. Avant 2014, la source ne publie pas de total
France entière ; c'est le total France hors Mayotte qui sert de référence, et
les deux se recouvrent exactement sur les six exercices concernés. Second
contrôle : la somme des arrondissements municipaux, plus l'arrondissement non
connu, doit redonner la commune entière.

Usage : python -m plateforme.normalize.naissances [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
import json
import zipfile
from collections import defaultdict

from plateforme import couverture, entrepot, revisions
from plateforme.http import telecharger
from plateforme.normalize.geo import MILLESIME, commune_mere, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "etat-civil-agrege"
SOURCE = "insee-melodi"
JEU = "DS_ETAT_CIVIL_NAIS_COMMUNES"

# Le fichier complet plutôt que la pagination de l'API : trois mégaoctets
# compressés contre 752 688 observations à parcourir page par page, pour
# exactement la même donnée. C'est le choix fait pour les décès.
URL = (
    "https://api.insee.fr/melodi/file/DS_ETAT_CIVIL_NAIS_COMMUNES/"
    "DS_ETAT_CIVIL_NAIS_COMMUNES_2025_CSV_FR"
)

INDICATEUR = "insee_naissances_domiciliees"

# Le jeu couvre onze découpages ; quatre seulement sont des territoires de ce
# site. Les aires d'attraction, bassins de vie, unités urbaines, zones d'emploi
# et arrondissements départementaux sont des zonages d'étude, pas des
# collectivités : ils n'ont ni fiche ni budget ici.
NIVEAUX = {
    "COM": "commune",
    "ARM": "arrondissement_municipal",
    "DEP": "departement",
    "REG": "region",
}

# `F` est la France entière. `FM` (métropolitaine) et `F_X_D976` (hors Mayotte)
# sont deux périmètres plus étroits du même comptage. `F` n'est pas publié avant
# 2014, Mayotte n'entrant qu'à cette date : `F_X_D976` sert alors de référence
# au contrôle, et les deux se recouvrent exactement sur ces exercices.
FRANCE = "F"
FRANCE_HORS_MAYOTTE = "F_X_D976"

# Les codes que la source invente quand l'arrondissement du domicile de la mère
# n'est pas renseigné, et la commune entière qui les porte déjà. Ils ne sont
# écrits nulle part comme observations : les rattacher à la commune mère
# reviendrait à compter deux fois des naissances que la ligne communale
# contient. `controler_arrondissements` vérifie qu'elle les contient bien.
ARRONDISSEMENT_INCONNU = {"693XX": "69123", "132XX": "13055", "751XX": "75056"}

# Statuts de la source, vérifiés ligne à ligne plutôt que supposés. `A` est la
# valeur normale. `K` (« données incluses dans une autre catégorie ») marque une
# commune déléguée dont les naissances sont comptées ailleurs : sa valeur est
# vide, il n'y a rien à charger. `W` (« inclut les données d'une autre
# catégorie ») marque la commune nouvelle qui les reçoit — 2 519 naissances dans
# le fichier complet, qu'écarter ferait tomber la somme des communes sous le
# total France. Elles sont donc chargées, et signalées : leur valeur couvre plus
# de territoire que la commune seule, alors que sa population ne couvre qu'elle.
# `M` est une valeur qui n'existe pas : Mayotte avant 2014.
DRAPEAU_REGROUPEMENT = "inclut_une_commune_rattachee"
STATUTS_REGROUPES = {"W"}

FICHE = {
    "libelle": "Naissances domiciliées",
    "public": "Le nombre d'enfants nés dans l'année dont la mère est domiciliée"
    " dans la commune, quel que soit le lieu de l'accouchement. Ce n'est pas le"
    " nombre de naissances survenues sur place : une commune qui a une maternité"
    " n'est pas gonflée.",
    "technique": "Naissances vivantes domiciliées, état civil, mesure LVB du jeu"
    " « Nombre de naissances annuelles par commune », ventilées au lieu de"
    " domicile de la mère. À distinguer des naissances enregistrées quel que soit"
    " le domicile de la mère, publiées ailleurs par l'INSEE. Les événements de"
    " Mayotte sont inclus depuis 2014 : avant cette date les valeurs sont"
    " manquantes et non nulles, pour Mayotte comme pour le total France entière."
    " Pour Lyon et Marseille, les naissances dont l'arrondissement de domicile de"
    " la mère n'est pas renseigné sont regroupées par la source dans un code"
    " dédié (693XX, 132XX) qui n'appartient à aucun référentiel géographique :"
    " elles sont comptées dans la commune entière, qui les porte déjà, et"
    " manquent donc à la ventilation par arrondissement — 443 naissances sur"
    " l'ensemble des exercices. Un décompte brut, qui dépend d'abord de la"
    " structure par âge du territoire : ce n'est ni un taux de natalité ni un"
    " indicateur de fécondité.",
    "formule": "Naissances vivantes de l'année, au lieu de domicile de la mère",
}


class TotalIncoherent(RuntimeError):
    """La somme des communes ne fait pas le total France de la source.

    Une part des naissances ne serait alors rattachée à aucune commune, et la
    carte montrerait un pays où il naît moins d'enfants qu'il n'en naît.
    """


class RattachementIncoherent(RuntimeError):
    """Les arrondissements municipaux ne redonnent pas leur commune entière.

    Si l'écart vaut l'arrondissement non connu, c'est que ce code n'a pas été
    reconnu et que ses naissances ont disparu sans bruit.
    """


def _rangs(archive: bytes):
    """Les lignes du CSV zippé de l'INSEE, telles que la source les écrit."""
    with zipfile.ZipFile(io.BytesIO(archive)) as zip_:
        nom = next(n for n in zip_.namelist() if n.endswith("_data.csv"))
        with zip_.open(nom) as fichier:
            yield from csv.DictReader(
                io.TextIOWrapper(fichier, encoding="utf-8"), delimiter=";"
            )


def lire(archive: bytes) -> list[dict]:
    """-> les lignes retenues, avec leur maille. Sans les arrondissements non connus."""
    return [
        {
            "niveau": NIVEAUX[rang["GEO_OBJECT"]],
            "code": rang["GEO"],
            "periode": rang["TIME_PERIOD"],
            "valeur": float(rang["OBS_VALUE"]),
            "drapeaux": (
                [DRAPEAU_REGROUPEMENT]
                if rang["OBS_STATUS"] in STATUTS_REGROUPES
                else []
            ),
        }
        for rang in _rangs(archive)
        if rang["GEO_OBJECT"] in NIVEAUX
        and rang["GEO"] not in ARRONDISSEMENT_INCONNU
        and rang["OBS_VALUE"]
    ]


def arrondissements_inconnus(archive: bytes) -> dict[tuple[str, str], float]:
    """{(commune mère, exercice): naissances sans arrondissement renseigné}."""
    return {
        (ARRONDISSEMENT_INCONNU[rang["GEO"]], rang["TIME_PERIOD"]): float(rang["OBS_VALUE"])
        for rang in _rangs(archive)
        if rang["GEO"] in ARRONDISSEMENT_INCONNU and rang["OBS_VALUE"]
    }


def totaux_france(archive: bytes) -> dict[str, tuple[float, str]]:
    """{exercice: (total France, périmètre lu)}, tel que la source le publie.

    France entière partout où elle est publiée ; France hors Mayotte sur les
    exercices où elle ne l'est pas, c'est-à-dire avant 2014. Ce total ne sert
    qu'au contrôle : il n'est écrit nulle part comme observation, et les deux
    périmètres ne se lisent pas comme une série continue.
    """
    totaux: dict[str, dict[str, float]] = defaultdict(dict)
    for rang in _rangs(archive):
        if rang["GEO_OBJECT"] == "FRANCE" and rang["OBS_VALUE"]:
            totaux[rang["TIME_PERIOD"]][rang["GEO"]] = float(rang["OBS_VALUE"])
    return {
        periode: (valeurs[FRANCE], FRANCE)
        if FRANCE in valeurs
        else (valeurs[FRANCE_HORS_MAYOTTE], FRANCE_HORS_MAYOTTE)
        for periode, valeurs in totaux.items()
        if FRANCE in valeurs or FRANCE_HORS_MAYOTTE in valeurs
    }


def controler(lignes: list[dict], totaux: dict[str, tuple[float, str]]) -> dict[str, float]:
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
        for periode, (total, _) in totaux.items()
        if periode in sommes and abs(sommes[periode] - total) > 0.5
    }
    if ecarts:
        detail = ", ".join(f"{p} : {e:+.0f}" for p, e in sorted(ecarts.items())[:5])
        raise TotalIncoherent(
            f"la somme des communes ne fait pas le total France ({detail})."
            " Une part des naissances n'est plus rattachée à une commune."
        )
    return ecarts


def controler_arrondissements(
    lignes: list[dict], inconnus: dict[tuple[str, str], float]
) -> dict:
    """Somme des arrondissements + arrondissement non connu = commune entière.

    Le contrôle qui rend visible le piège de Lyon et Marseille. Sans le terme
    « non connu », l'égalité tombe de exactement ce que ce code portait — et
    c'est ainsi qu'on sait qu'il ne doit pas être écarté sans être compté.
    """
    sommes: dict[tuple[str, str], float] = defaultdict(float)
    for ligne in lignes:
        if ligne["niveau"] == "arrondissement_municipal":
            sommes[(commune_mere(ligne["code"]), ligne["periode"])] += ligne["valeur"]
    communes = {
        (ligne["code"], ligne["periode"]): ligne["valeur"]
        for ligne in lignes
        if ligne["niveau"] == "commune"
    }
    ecarts = {}
    for cle, somme in sommes.items():
        entiere = communes.get(cle)
        if entiere is None:
            continue
        ecart = somme + inconnus.get(cle, 0.0) - entiere
        if abs(ecart) > 0.5:
            ecarts[f"{cle[0]}/{cle[1]}"] = ecart
    if ecarts:
        cle, ecart = next(iter(sorted(ecarts.items())))
        raise RattachementIncoherent(
            f"{len(ecarts)} couples commune-exercice où les arrondissements ne"
            f" redonnent pas la commune entière, par exemple {cle} : {ecart:+.0f}."
            " Un arrondissement non connu n'est pas compté dans sa commune mère."
        )
    return {
        "couples_verifies": len(sommes),
        "naissances_sans_arrondissement": round(sum(inconnus.values())),
    }


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        definition = curseur.execute(
            """
            insert into core.indicator_definitions
                (public_definition, technical_definition, formula, unit_notes,
                 confidence_level, badges)
            values (?, ?, ?, 'naissances vivantes domiciliées', 'observed',
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
            values (?, ?, ?, 'population', ?, 'count', true,
                    array['commune','arrondissement_municipal','departement','region'],
                    'annuelle', true)
            on conflict (indicator_id) do update set
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


COLONNES = ("value", "quality_flags")


def masse_par_maille(lignes) -> dict[str, float]:
    """Les naissances par maille, pour les deux côtés de la couverture.

    En naissances et non en nombre de codes : trois codes perdus ne pèsent rien
    s'ils portent trois naissances, et tout s'ils portent Marseille.
    """
    masses: dict[str, float] = defaultdict(float)
    for ligne in lignes:
        masses[ligne["niveau"]] += ligne["valeur"]
    return dict(masses)


def ecrire(conn, run_id: str, lignes: list[dict]) -> tuple[int, int, set[str], dict]:
    candidates = [
        (INDICATEUR, ligne["niveau"], ligne["code"], ligne["periode"], ligne["valeur"])
        for ligne in lignes
    ]
    gardees, ecartes = filtrer_territoires_connus(conn, candidates)
    reconnues = {(niveau, code) for _, niveau, code, _, _ in gardees}
    drapeaux = {
        (ligne["niveau"], ligne["code"], ligne["periode"]): ligne["drapeaux"]
        for ligne in lignes
        if ligne["drapeaux"]
    }
    ecrites, revisees = revisions.remplacer(
        conn, run_id, [INDICATEUR], COLONNES,
        [
            (cle, niveau, code, MILLESIME, periode, valeur,
             drapeaux.get((niveau, code, periode), []))
            for cle, niveau, code, periode, valeur in gardees
        ],
    )
    parts = couverture.controler(
        masse_par_maille(lignes),
        masse_par_maille(
            [ligne for ligne in lignes if (ligne["niveau"], ligne["code"]) in reconnues]
        ),
    )
    return ecrites, revisees, ecartes, parts


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        archive = telecharger(URL, timeout=300)
        entrepot.etape(f"archive de {len(archive) / 1e6:.0f} Mo téléchargée")
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "naissances-communes.zip", archive,
            URL, "application/zip",
        )
        lignes = lire(archive)
        entrepot.etape(f"{len(lignes)} lignes lues")
        if not lignes:
            raise ValueError("aucune naissance lue")
        totaux = totaux_france(archive)
        controler(lignes, totaux)
        inconnus = arrondissements_inconnus(archive)
        rattachements = controler_arrondissements(lignes, inconnus)
        entrepot.etape(
            f"{rattachements['couples_verifies']} communes à arrondissements"
            f" vérifiées ; {rattachements['naissances_sans_arrondissement']}"
            " naissances sans arrondissement, portées par la commune entière"
        )
        ecrites, revisees, ecartes, parts = ecrire(conn, run_id, lignes)
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'somme_communes_egale_total_france', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                "exercices": len(totaux),
                "dernier": max(totaux),
                "total_france": totaux[max(totaux)][0],
                "exercices_hors_mayotte": sorted(
                    periode for periode, (_, perimetre) in totaux.items()
                    if perimetre == FRANCE_HORS_MAYOTTE
                ),
                **rattachements,
                "hors_referentiel": len(ecartes),
                "couverture": {n: round(p, 4) for n, p in sorted(parts.items())},
            })),
        )
        conn.commit()
        entrepot.etape(f"{ecrites} observations écrites")
        entrepot.finish_run(
            conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites
        )
        periodes = sorted({ligne["periode"] for ligne in lignes})
        print(
            f"naissances domiciliées : {ecrites} observations, {periodes[0]} →"
            f" {periodes[-1]}, {len(ecartes)} hors référentiel, {revisees} révisées ;"
            f" total France {max(totaux)} : {totaux[max(totaux)][0]:.0f}"
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
