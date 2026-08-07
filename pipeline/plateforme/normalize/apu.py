"""Solde des administrations publiques (INSEE, comptes nationaux).

Le « déficit public » dont parlent les 3 % de Maastricht, par sous-secteur, de
1959 à 2025. Trois choses doivent être tenues, faute de quoi ce chiffre en
contredirait un autre déjà publié ici.

**Ce n'est pas le solde budgétaire de l'État.** Le site publie déjà celui-là :
périmètre État seul, comptabilité budgétaire, encaissements et décaissements de
l'exercice. Celui-ci couvre **toutes** les administrations publiques — État,
organismes centraux, collectivités, Sécurité sociale — en comptabilité
nationale, où une dépense est rattachée au moment où le droit naît et non au
moment où elle est payée. Les deux chiffres sont justes, ils ne mesurent pas la
même chose, et chacun nomme l'autre dans sa fiche. C'est ce solde-ci, et lui
seul, que la règle européenne des 3 % regarde.

**Ce n'est pas la dette.** Le solde est un flux d'une année ; la dette, déjà
publiée, est l'encours accumulé. Un déficit qui se réduit reste un déficit, et
la dette continue de monter.

**Le signe est une convention, pas une erreur de saisie.** La source publie une
« capacité (+) ou besoin (−) de financement » : un déficit est donc **négatif**.
Le retourner pour l'afficher « en positif » rendrait incomparables les rares
exercices excédentaires — il y en a eu.

**Ce que ce module refuse de charger.** Le jeu publie aussi des agrégats de
recettes et de dépenses totales dont les valeurs ne retrouvent pas les chiffres
publics connus : 2 034 milliards de recettes et 2 152 de dépenses en 2024, quand
la statistique publique annonce environ 1 500 et 1 670. L'écart vient du
périmètre de consolidation, que la source ne documente pas dans ses métadonnées.
Un agrégat dont on ne peut pas nommer le dénominateur n'est pas publié ici —
c'est la même règle que celle appliquée aux agrégats OFGL sans définition.

**Le contrôle qui bloque.** L'identité des sous-secteurs : administrations
centrales + locales + sécurité sociale = ensemble des administrations publiques.
Vérifiée sur les 67 exercices que la source couvre, écart nul — dont 2024, où
−152 464 − 17 794 + 1 140 fait exactement les −169 118 millions publiés.

Usage : python -m plateforme.normalize.apu [--store r2:plateforme-raw]
"""

import argparse
import json

from plateforme import entrepot, revisions
from plateforme.connectors.insee import MELODI_BASE
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, make_store

DATASET = "melodi-cna-apu"
SOURCE = "insee-melodi"
JEU = "DD_CNA_APU"

# Capacité (+) ou besoin (−) de financement : le solde du compte de capital,
# celui que la règle des 3 % regarde.
STO = "B9"

# Les filtres qui font qu'une valeur en désigne une seule. `COUNTERPART_SECTOR`
# vaut « tous secteurs » : la source décline le même solde face à chaque
# contrepartie, et les charger ensemble compterait le déficit huit fois.
FILTRES = {
    "COUNTERPART_SECTOR": "S1",
    "CONSOLIDATION": "C",
    "UNIT_MEASURE": "XDC",
    "TRANSFORMATION": "N",
    "FREQ": "A",
}

# La source publie en **millions** d'euros ; le site publie en euros, comme la
# dette et le budget de l'État. Sans ce facteur, un déficit de 169 milliards
# s'afficherait à 169 mille.
MILLIONS = 1_000_000

# Sous-secteur -> (identifiant, libellé, fiche publique). `S1311` est l'ensemble
# des administrations centrales — l'État **et** les organismes divers — et non
# l'État seul : c'est `S13111` qui désigne l'État, et la source ne lui donne pas
# de solde dans ce jeu.
_COMMUN = (
    " Négatif, c'est un déficit. Ce n'est ni la dette, qui est l'encours accumulé,"
    " ni le solde budgétaire de l'État, publié à côté."
)
SOUS_SECTEURS = {
    "S13": (
        "insee_apu_solde", "Solde public",
        "L'écart, sur une année, entre ce que toutes les administrations publiques"
        " encaissent et ce qu'elles dépensent. C'est le solde que regarde la règle"
        " européenne des 3 %." + _COMMUN,
    ),
    "S1311": (
        "insee_apu_solde_centrales", "Solde des administrations centrales",
        "L'écart, sur une année, entre ce que l'État et les organismes divers"
        " d'administration centrale encaissent et ce qu'ils dépensent." + _COMMUN,
    ),
    "S1313": (
        "insee_apu_solde_apul", "Solde des collectivités locales",
        "L'écart, sur une année, entre ce que les collectivités locales encaissent"
        " et ce qu'elles dépensent." + _COMMUN,
    ),
    "S1314": (
        "insee_apu_solde_asso", "Solde de la Sécurité sociale",
        "L'écart, sur une année, entre ce que les administrations de sécurité"
        " sociale encaissent et ce qu'elles dépensent." + _COMMUN,
    ),
}

TOTAL = "S13"
COMPOSANTES = ("S1311", "S1313", "S1314")

THEME = "dette"
COLONNES = ("value",)
TOLERANCE = 0.5

TECHNIQUE = (
    "Capacité (+) ou besoin (−) de financement des administrations publiques,"
    " comptes nationaux annuels de l'INSEE, en comptabilité nationale et non"
    " budgétaire : une opération y est rattachée à l'exercice où le droit naît,"
    " pas à celui où elle est encaissée ou payée. C'est ce solde, et lui seul, que"
    " la règle européenne des 3 % du PIB regarde. Il ne doit pas être confondu avec"
    " le solde budgétaire de l'État publié par ailleurs sur ce site, qui porte sur"
    " le seul budget général de l'État et suit la comptabilité budgétaire : deux"
    " périmètres, deux conventions, deux chiffres. Il ne doit pas non plus être"
    " confondu avec la dette : le solde est un flux annuel, la dette un encours"
    " accumulé. Un déficit s'écrit en négatif, la source publiant une capacité de"
    " financement. Le sous-secteur des administrations centrales réunit l'État et"
    " les organismes divers d'administration centrale ; la source ne publie pas de"
    " solde pour l'État isolément dans ce jeu. Séries consolidées, en millions"
    " d'euros à la source, converties en euros ici."
)


class IdentiteRompue(RuntimeError):
    """Les sous-secteurs ne font plus le solde de l'ensemble."""


def url(secteur: str) -> str:
    requete = "&".join(
        f"{cle}={valeur}"
        for cle, valeur in {"REF_SECTOR": secteur, "STO": STO}.items()
    )
    return f"{MELODI_BASE}/data/{JEU}?{requete}&maxResult=5000"


def lire(charges: dict[str, bytes]) -> dict[str, dict[str, float]]:
    """{sous-secteur: {exercice: solde en euros}}.

    Les filtres sont appliqués ici plutôt qu'à la requête : la source décline le
    même solde face à huit contreparties et sous plusieurs conventions de
    consolidation, et une valeur qui passerait sans être filtrée écraserait la
    bonne sous le même identifiant.
    """
    series: dict[str, dict[str, float]] = {}
    for secteur, contenu in charges.items():
        soldes: dict[str, float] = {}
        for observation in json.loads(contenu).get("observations", []):
            dimensions = observation.get("dimensions", {})
            if any(dimensions.get(cle) != valeur for cle, valeur in FILTRES.items()):
                continue
            valeur = (
                observation.get("measures", {}).get("OBS_VALUE_NIVEAU") or {}
            ).get("value")
            if valeur is None:
                continue
            soldes[dimensions["TIME_PERIOD"]] = float(valeur) * MILLIONS
        series[secteur] = soldes
    return series


def controler(series: dict[str, dict[str, float]]) -> dict[str, int]:
    """Les trois sous-secteurs font l'ensemble, exercice par exercice.

    Le contrôle saute les exercices où une composante manque plutôt que de
    crier sur une donnée qui n'existe pas — la source ne remonte pas aussi loin
    pour tous les sous-secteurs — mais il exige d'en avoir vérifié.
    """
    total = series.get(TOTAL, {})
    if not total:
        raise IdentiteRompue("aucun solde d'ensemble : la requête n'a rien rendu")
    verifies = 0
    for exercice, attendu in sorted(total.items()):
        parts = [series.get(secteur, {}).get(exercice) for secteur in COMPOSANTES]
        if any(part is None for part in parts):
            continue
        ecart = sum(parts) - attendu
        if abs(ecart) > TOLERANCE * MILLIONS:
            raise IdentiteRompue(
                f"{exercice} : les sous-secteurs font {sum(parts) / MILLIONS:.1f} M€"
                f" contre {attendu / MILLIONS:.1f} M€ pour l'ensemble"
                f" ({ecart / MILLIONS:+.1f}). Un sous-secteur manque ou double."
            )
        verifies += 1
    if not verifies:
        raise IdentiteRompue("aucun exercice n'a pu être vérifié")
    return {"les_sous_secteurs_font_l_ensemble": verifies}


def lignes_a_ecrire(series: dict[str, dict[str, float]]) -> list[tuple]:
    """-> les lignes prêtes pour `revisions.remplacer`, cinq clés puis la valeur."""
    return [
        (SOUS_SECTEURS[secteur][0], "pays", "FR", MILLESIME, exercice, valeur)
        for secteur, soldes in sorted(series.items())
        if secteur in SOUS_SECTEURS
        for exercice, valeur in sorted(soldes.items())
    ]


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for _, (identifiant, libelle, publique) in sorted(SOUS_SECTEURS.items()):
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, 'Capacité (+) ou besoin (−) de financement, code B9',
                        'euros courants', 'observed', array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (publique, TECHNIQUE),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, price_basis, accounting_frame, geo_levels,
                     time_granularity, published)
                values (?, ?, ?, ?, ?, 'EUR', false, 'current', 'nationale',
                        array['pays'], 'annuelle', true)
                on conflict (indicator_id) do update set unit = excluded.unit,
                    definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                    theme = excluded.theme, published = true
                """,
                (identifiant, DATASET, definition, THEME, libelle),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    garde_fou_volume(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        charges = {}
        for secteur in SOUS_SECTEURS:
            adresse = url(secteur)
            contenu = telecharger(adresse, timeout=600)
            entrepot.record_asset(
                conn, store, run_id, DATASET, SOURCE, f"apu-b9-{secteur}.json",
                contenu, adresse, "application/json",
            )
            charges[secteur] = contenu
        series = lire(charges)
        entrepot.etape(
            f"{sum(len(s) for s in series.values())} soldes lus sur"
            f" {len(series)} sous-secteurs"
        )
        verifies = controler(series)
        lignes = lignes_a_ecrire(series)
        if not lignes:
            raise IdentiteRompue("aucun solde à écrire")
        ecrites, revisees = revisions.remplacer(
            conn, run_id, [f[0] for f in SOUS_SECTEURS.values()], COLONNES, lignes
        )
        exercices = sorted(series[TOTAL])
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'les_sous_secteurs_font_l_ensemble', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "premier_exercice": exercices[0],
                "dernier_exercice": exercices[-1],
                "solde_dernier_exercice_millions": round(
                    series[TOTAL][exercices[-1]] / MILLIONS, 1
                ),
            })),
        )
        conn.commit()
        entrepot.finish_run(
            conn, run_id, "success",
            rows_read=sum(len(s) for s in series.values()), rows_written=ecrites,
        )
        print(
            f"APU : {ecrites} observations, {exercices[0]} à {exercices[-1]},"
            f" {revisees} valeurs révisées ; solde {exercices[-1]} :"
            f" {series[TOTAL][exercices[-1]] / MILLIONS:.1f} M€"
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
