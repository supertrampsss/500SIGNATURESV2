"""Écoles, collèges et lycées par commune (annuaire MENJ) vers core.observations.

« Ma commune a-t-elle encore son école ? » — la fermeture d'une école rurale
est un fait de vie communal autant qu'une ligne de budget. L'annuaire de
l'éducation nationale recense chaque établissement avec sa commune, son type,
son statut et son état : deux comptages en sortent, les écoles du premier
degré, et les collèges et lycées réunis.

**Zéro est une donnée.** Une commune sans école n'est pas une commune sans
information : la ligne vaut 0, elle est écrite, et la carte la colorie. La
laisser absente l'afficherait « donnée non disponible » — le contraire de ce
qu'on sait. C'est le référentiel géographique qui fournit l'univers des
communes, jamais l'annuaire seul.

**Un comptage se lit chez soi, pas en palmarès.** Paris a des centaines
d'écoles parce qu'elle a des centaines de milliers d'habitants : ces
indicateurs n'ont pas de repère de comparaison (publish.py), et la fiche le
dit. Public et privé sous contrat sont comptés ensemble, la définition le dit
aussi.

Usage : python -m plateforme.normalize.education [--store r2:plateforme-raw]
"""

import json
import argparse
import csv
import io
from collections import Counter
from datetime import UTC, datetime


from plateforme import entrepot, revisions
from plateforme.connectors import ods
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, commune_mere, make_store

DATASET = "menj-annuaire-education"
SOURCE = "data-education"
BASE = "https://data.education.gouv.fr/api/explore/v2.1"
JEU = "fr-en-annuaire-education"

# Valeurs constatées sur les facettes du portail, jamais supposées :
# type_etablissement 'Ecole' (47 947), 'Collège' (9 057), 'Lycée' (5 576) ;
# etat 'OUVERT'. Les EREA, services administratifs et centres d'orientation
# ne sont ni des écoles ni des collèges-lycées : hors champ.
TYPES = {"Ecole": "ecoles", "Collège": "colleges_lycees", "Lycée": "colleges_lycees"}

PLANCHER_ECOLES = 30_000  # en dessous, ce n'est plus l'annuaire qu'on lit

INDICATEURS = {
    "menj_ecoles": (
        "Écoles",
        "Le nombre d'écoles maternelles et élémentaires ouvertes dans la commune,"
        " publiques et privées sous contrat comptées ensemble. Zéro est une"
        " information : beaucoup de communes rurales n'ont plus d'école. Un"
        " nombre se lit pour sa commune, pas en palmarès entre villes de"
        " tailles différentes.",
    ),
    "menj_colleges_lycees": (
        "Collèges et lycées",
        "Le nombre de collèges et de lycées ouverts dans la commune, publics et"
        " privés sous contrat réunis. La carte scolaire dépasse la commune : un"
        " zéro dit qu'on étudie ailleurs, pas qu'on n'étudie pas.",
    ),
}


def url_export() -> str:
    return (
        f"{ods.export_url(BASE, JEU)}?"
        "select=identifiant_de_l_etablissement,code_commune,type_etablissement,etat"
    )


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for indicateur, (libelle, publique) in INDICATEURS.items():
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, confidence_level, badges)
                values (?, ?, ?, 'observed', array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (
                    publique,
                    "Annuaire de l'éducation nationale (MENJ), établissements à l'état"
                    " OUVERT, comptés par code commune du référentiel. État du"
                    " répertoire au jour de l'extraction.",
                    f"MENJ, annuaire {JEU}, comptage par commune",
                ),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, geo_levels, time_granularity, published)
                values (?, ?, ?, 'education', ?, 'count', true,
                        array['commune'], 'annuelle', true)
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


def compter(contenu: bytes) -> tuple[dict[str, Counter], int]:
    """CSV d'export -> comptages par commune et par famille, et le total lu.

    Seuls les établissements OUVERT comptent : un établissement « à fermer »
    est encore ouvert administrativement mais le compter figerait le passé.
    """
    lecteur = csv.DictReader(io.StringIO(contenu.decode("utf-8-sig")), delimiter=";")
    comptes: dict[str, Counter] = {"ecoles": Counter(), "colleges_lycees": Counter()}
    lus = 0
    for rang in lecteur:
        lus += 1
        if (rang.get("etat") or "").strip().upper() != "OUVERT":
            continue
        famille = TYPES.get((rang.get("type_etablissement") or "").strip())
        code = (rang.get("code_commune") or "").strip()
        # L'annuaire code Paris, Lyon et Marseille par arrondissement : sans
        # rattachement à la commune, Paris affichait « 0 école » — un zéro
        # honnêtement écrit, et faux. Troisième source, troisième variante du
        # même piège PLM ; le rattachement vit dans geo.commune_mere.
        if len(code) == 5:
            code = commune_mere(code) or code
        if famille and len(code) == 5:
            comptes[famille][code] += 1
    return comptes, lus


def ecrire(conn, run_id: str, comptes: dict[str, Counter]) -> tuple[int, int, int]:
    """Toutes les communes du référentiel reçoivent une ligne — zéro compris."""
    annee = str(datetime.now(UTC).year)
    communes = [
        code for (code,) in conn.execute(
            """
            select geo_code from geo.geography_reference
            where geo_level = 'commune' and vintage = ?
            """,
            (MILLESIME,),
        ).fetchall()
    ]
    lignes = []
    for indicateur, famille in (("menj_ecoles", "ecoles"),
                                ("menj_colleges_lycees", "colleges_lycees")):
        for code in communes:
            lignes.append(
                (indicateur, "commune", code, MILLESIME, annee, comptes[famille].get(code, 0))
            )
    connues = set(communes)
    hors_referentiel = sum(
        1 for famille in comptes.values() for code in famille if code not in connues
    )
    ecrites, revisees = revisions.remplacer(
        conn, run_id, list(INDICATEURS), ("value",), lignes
    )
    return ecrites, revisees, hors_referentiel


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        avant = garde_fou_volume(conn)
        url = url_export()
        contenu = telecharger(url, timeout=600)
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "annuaire-education.csv", contenu, url,
            "text/csv",
        )
        comptes, lus = compter(contenu)
        total_ecoles = sum(comptes["ecoles"].values())
        if total_ecoles < PLANCHER_ECOLES:
            raise ValueError(
                f"{total_ecoles} écoles lues, plancher {PLANCHER_ECOLES} :"
                " le format de l'annuaire a dû changer"
            )
        ecrites, revisees, hors_referentiel = ecrire(conn, run_id, comptes)
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'effectif_de_l_annuaire_plausible', 'info', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                "etablissements_lus": lus,
                "ecoles": total_ecoles,
                "colleges_lycees": sum(comptes["colleges_lycees"].values()),
                "hors_referentiel": hors_referentiel,
            })),
        )
        conn.commit()
        entrepot.finish_run(conn, run_id, "success", rows_read=lus, rows_written=ecrites)
        apres = entrepot.taille(conn)
        print(
            f"éducation : {ecrites} observations ({total_ecoles} écoles,"
            f" {sum(comptes['colleges_lycees'].values())} collèges-lycées),"
            f" {hors_referentiel} hors référentiel, {revisees} valeurs révisées"
        )
        print(f"volume base : {avant // 1024 // 1024} -> {apres // 1024 // 1024} Mo")
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
