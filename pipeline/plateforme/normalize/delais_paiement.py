"""En combien de jours ma commune paie ses fournisseurs (DGFiP).

Le site dit ce qu'une commune dépense. Il ne disait pas si elle paie. Le délai
global de paiement est la mesure la plus concrète de la relation entre une
collectivité et les entreprises qui travaillent pour elle : la loi fixe
**trente jours**, et un artisan payé à quatre-vingts jours porte la trésorerie
de la mairie.

**La colonne `code_insee` de la source n'est pas un code INSEE.** Elle contient
un **SIRET** à quatorze chiffres : Bordeaux y est `21330063500017`, pas `33063`.
Le rattachement passe donc par les neuf premiers chiffres — le SIREN — et le
référentiel géographique, qui porte le SIREN de chaque commune. Lue au premier
degré, cette colonne aurait placé chaque commune sur un territoire inexistant.

**Un seul budget par commune, et c'est le principal.** La source décrit aussi
les budgets annexes — eau, assainissement, lotissements — et les CCAS, les
syndicats, les métropoles. Le délai d'un service d'assainissement n'est pas
celui de la mairie ; seules les lignes de type « Commune » entrent, et elles
sont toutes des budgets principaux.

**Ce que le chiffre ne dit pas.** C'est une moyenne annuelle pondérée par les
montants : une commune peut payer vite ses petites factures et faire attendre
la grosse. Et un délai court n'est pas en soi une vertu budgétaire — payer vite
suppose de la trésorerie.

Usage : python -m plateforme.normalize.delais_paiement [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
import json
import statistics
import urllib.parse

from plateforme import couverture, entrepot, revisions
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, make_store

DATASET = "dgfip-delais-paiement-communes"
SOURCE = "data-economie"
JEU = "delai-paiement-moyen-collectivites-2025"
BASE = f"https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/{JEU}"
EXERCICE = "2025"

# La source décrit quatorze types de collectivité et trois types de budget.
# Seule la commune, sur son budget principal : le délai d'un service des eaux
# n'est pas celui de la mairie, et les additionner mélangerait deux comptes.
TYPE = "Commune"

INDICATEUR = "dgfip_delai_global_paiement"
THEME = "finances_locales"
UNITE = "jours"

# Le délai légal de paiement d'une collectivité territoriale. Il sert de repère
# de lecture, pas de seuil de contrôle : le dépassement est fréquent et légal à
# constater — c'est même ce que la donnée sert à voir.
DELAI_LEGAL = 30

# Contrôles de vraisemblance. Ils ne cherchent pas la commune atypique — une
# commune en difficulté peut vraiment payer à six cents jours — mais le
# décalage qui toucherait tout le monde à la fois : des lignes de budgets
# annexes entrées par erreur, ou une colonne lue en mois.
MEDIANE_MAXIMALE = 30.0
MEDIANE_MINIMALE = 3.0

PUBLIQUE = (
    "Le nombre de jours que la commune met en moyenne à payer ses fournisseurs,"
    " du dépôt de la facture au paiement. La loi lui en accorde trente."
)

TECHNIQUE = (
    "Délai global de paiement annuel moyen du budget principal de la commune,"
    " calculé par la DGFiP sur les mandats de l'exercice et pondéré par les"
    " montants. Sont exclus les budgets annexes (eau, assainissement,"
    " lotissements), les CCAS et les groupements : leur délai est celui d'un"
    " autre ordonnateur. Le délai légal est de trente jours pour les"
    " collectivités territoriales ; le dépasser n'est pas une anomalie de la"
    " donnée mais un fait que la donnée sert à constater. La moyenne étant"
    " pondérée par les montants, une commune peut payer vite ses petites"
    " factures et faire attendre la plus grosse. Un délai court n'est pas en"
    f" soi une vertu budgétaire : il suppose de la trésorerie. Exercice {EXERCICE}."
)


class DelaiInvraisemblable(RuntimeError):
    """La distribution des délais ne ressemble pas à des jours de paiement."""


def url() -> str:
    clause = f"type_budget_collectivite='{TYPE}'"
    select = "code_insee,libelle_budget_collectivite,dgp_annuel_moyen"
    return (
        f"{BASE}/exports/csv?where={urllib.parse.quote(clause)}"
        f"&select={urllib.parse.quote(select)}&delimiter=%3B"
    )


def lire(contenu: bytes) -> dict[str, float]:
    """-> {SIREN de la commune: délai en jours}.

    Le SIREN est tiré des neuf premiers chiffres du SIRET, que la source range
    sous un nom de colonne trompeur. Le SIRET est diffusé comme un nombre : le
    zéro de tête d'un établissement le perdrait, mais un SIRET de commune
    commence toujours par 2 — le cas ne se présente pas, et le contrôle de
    couverture le verrait si la source changeait d'avis.
    """
    lecteur = csv.DictReader(io.StringIO(contenu.decode("utf-8-sig")), delimiter=";")
    delais: dict[str, float] = {}
    for rang in lecteur:
        siret = (rang.get("code_insee") or "").strip()
        brut = (rang.get("dgp_annuel_moyen") or "").strip()
        if len(siret) != 14 or not brut:
            continue
        delais[siret[:9]] = float(brut)
    return delais


def controler(delais: dict[str, float]) -> dict:
    """La distribution doit ressembler à des jours, et à des jours de commune.

    Ce jeu n'a pas d'identité comptable à retrouver : c'est une mesure unique
    par commune. Ce qui se vérifie, c'est que la population lue est la bonne —
    des budgets annexes entrés par erreur, ou une colonne exprimée dans une
    autre unité, décaleraient la médiane de tout le monde à la fois.
    """
    if not delais:
        raise DelaiInvraisemblable("aucun délai lu")
    valeurs = sorted(delais.values())
    mediane = statistics.median(valeurs)
    if not MEDIANE_MINIMALE <= mediane <= MEDIANE_MAXIMALE:
        raise DelaiInvraisemblable(
            f"délai médian de {mediane:.1f} jours, hors de l'intervalle"
            f" [{MEDIANE_MINIMALE}, {MEDIANE_MAXIMALE}] attendu pour des communes."
            " La colonne lue n'est pas celle qu'on croit, ou la population lue"
            " n'est pas celle des communes."
        )
    if valeurs[0] <= 0:
        raise DelaiInvraisemblable(
            f"un délai de {valeurs[0]} jour(s) : un paiement ne précède pas sa"
            " facture."
        )
    return {
        "communes": len(valeurs),
        "delai_median": round(mediane, 2),
        "delai_minimum": valeurs[0],
        "delai_maximum": valeurs[-1],
        "part_au_dela_du_delai_legal": round(
            sum(1 for v in valeurs if v > DELAI_LEGAL) / len(valeurs), 4
        ),
    }


def communes_par_siren(conn) -> dict[str, str]:
    """SIREN -> code commune, depuis le référentiel géographique."""
    return {
        siren: code
        for siren, code in conn.execute(
            "select siren, geo_code from geo.geography_reference"
            " where geo_level = 'commune' and vintage = ? and siren is not null",
            (MILLESIME,),
        ).fetchall()
    }


COLONNES = ("value",)


def lignes_a_ecrire(delais: dict[str, float], sirens: dict[str, str]) -> list[tuple]:
    return [
        (INDICATEUR, "commune", sirens[siren], MILLESIME, EXERCICE, delai)
        for siren, delai in sorted(delais.items())
        if siren in sirens
    ]


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        definition = curseur.execute(
            """
            insert into core.indicator_definitions
                (public_definition, technical_definition, formula, unit_notes,
                 confidence_level, badges)
            values (?, ?, 'Délai global de paiement annuel moyen, budget principal',
                    'jours', 'observed', array['Officiel','Donnée brute'])
            returning definition_id
            """,
            (PUBLIQUE, TECHNIQUE),
        ).fetchone()[0]
        curseur.execute(
            """
            insert into core.indicators
                (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                 additive, price_basis, accounting_frame, geo_levels,
                 time_granularity, published)
            values (?, ?, ?, ?, 'Délai de paiement des fournisseurs', ?, false,
                    'current', 'budgetaire', array['commune'], 'annuelle', true)
            on conflict (indicator_id) do update set
                definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                theme = excluded.theme, published = true
            """,
            (INDICATEUR, DATASET, definition, THEME, UNITE),
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
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        garde_fou_volume(conn)
        adresse = url()
        contenu = telecharger(adresse, timeout=600)
        entrepot.etape(f"{len(contenu) // 1024} Ko reçus")
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "delais-paiement.csv", contenu,
            adresse, "text/csv",
        )
        delais = lire(contenu)
        entrepot.etape(f"{len(delais)} communes lues")
        verifies = controler(delais)
        sirens = communes_par_siren(conn)
        lignes = lignes_a_ecrire(delais, sirens)
        ecrites, revisees = revisions.remplacer(
            conn, run_id, [INDICATEUR], COLONNES, lignes
        )
        # La couverture se mesure en communes : c'est la jointure par SIREN
        # qu'elle contrôle, et c'est elle qui verrait la source changer de
        # format d'identifiant sans rien casser d'autre.
        parts = couverture.controler(
            {"commune": float(len(delais))}, {"commune": float(len(lignes))}
        )
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'delais_vraisemblables_et_rattaches', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "rattachees": len(lignes),
                "couverture": {n: round(p, 4) for n, p in sorted(parts.items())},
            })),
        )
        conn.commit()
        entrepot.finish_run(
            conn, run_id, "success", rows_read=len(delais), rows_written=ecrites
        )
        print(
            f"délais de paiement {EXERCICE} : {ecrites} communes,"
            f" médiane {verifies['delai_median']} jours,"
            f" {100 * verifies['part_au_dela_du_delai_legal']:.1f} % au-delà des"
            f" {DELAI_LEGAL} jours légaux, {revisees} valeurs révisées"
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
