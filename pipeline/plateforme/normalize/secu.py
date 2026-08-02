"""Comptes de la Sécurité sociale (Eurostat, S1314) vers core.observations.

La Sécurité sociale dépense plus que l'État — environ 26 % du PIB contre 22 —
et le site n'en disait rien au-delà de la fonction « protection sociale ».
Ce connecteur charge les trois agrégats du sous-secteur **administrations de
sécurité sociale** (S1314) de la comptabilité nationale : dépenses, recettes,
solde, en % du PIB, pour tous les pays publiés par Eurostat.

**Le cadre est dit, parce qu'il piège.** Ce S1314 n'est pas le « régime
général » des débats budgétaires : il couvre l'ensemble des administrations de
sécurité sociale au sens du SEC 2010 — assurance maladie et retraites de base,
mais aussi retraites complémentaires obligatoires (Agirc-Arrco) et assurance
chômage. Le « trou de la Sécu » de la loi de financement (périmètre régime
général + FSV, comptabilité de droits constatés) est un autre chiffre, sur un
autre périmètre : les fiches le disent pour que personne ne compare l'un à
l'autre. De même, les *recettes* mêlent cotisations sociales et impôts affectés
(CSG, fractions de TVA) — le mot « cotisations » seul serait faux.

**Contrôle d'identité.** En comptabilité nationale, le solde (B9) *est* la
différence recettes moins dépenses. Trois valeurs arrondies au dixième de
point : l'écart honnête maximal est 0,15 — tolérance 0,16, quarantaine au-delà,
et série incomplète écartée plutôt que publiée à trous. Vérifié sur les données
réelles avant d'écrire ce module : douze pays-années FR et DE, écart maximal
constaté 0,1.

Les rechargements passent par l'archive des révisions (revisions.py) : les
comptes d'une année restent provisoires puis semi-définitifs longtemps, et un
solde qui change de signe ne doit pas réécrire l'histoire en silence.

Usage : python -m plateforme.normalize.secu [--store r2:plateforme-raw]
"""

import argparse
import json

from psycopg.types.json import Jsonb

from plateforme import db, revisions
from plateforme.connectors import eurostat
from plateforme.connectors.jsonstat import decoder
from plateforme.http import fetch
from plateforme.normalize.europe import DRAPEAUX, enregistrer_pays
from plateforme.normalize.geo import MILLESIME, make_store

DATASET = "eurostat-gov-10a-main"
JEU = "gov_10a_main"

PARAMS = {
    "na_item": ["TE", "TR", "B9"],
    "sector": "S1314",
    "unit": "PC_GDP",
    "freq": "A",
    "sinceTimePeriod": "2013",
}

TOLERANCE_PTS = 0.16  # trois valeurs arrondies à 0,1 : 0,15 au pire

# La charte impose 50 mots au plus par définition grand public — et le schéma
# le vérifie (0004). La pédagogie longue vit dans le bloc du site, pas ici.
INDICATEURS = {
    "TE": (
        "eurostat_secu_depenses_pib",
        "Dépenses de la Sécurité sociale",
        "Tout ce que dépensent les administrations de sécurité sociale — maladie,"
        " retraites de base et complémentaires obligatoires, famille, assurance"
        " chômage — rapporté à la richesse produite dans l'année. En France,"
        " c'est davantage que le budget de l'État.",
    ),
    "TR": (
        "eurostat_secu_recettes_pib",
        "Recettes de la Sécurité sociale",
        "Ce que reçoivent les administrations de sécurité sociale : des"
        " cotisations sociales pour l'essentiel, complétées d'impôts et de taxes"
        " affectés comme la CSG. Cotisation et impôt ne sont pas la même chose ;"
        " ce total les additionne en le disant.",
    ),
    "B9": (
        "eurostat_secu_solde_pib",
        "Solde de la Sécurité sociale",
        "Recettes moins dépenses des administrations de sécurité sociale, en"
        " comptabilité nationale. Ce n'est pas le « trou de la Sécu » des lois"
        " de financement, qui porte sur le seul régime général : ce périmètre-ci"
        " inclut l'assurance chômage et les retraites complémentaires.",
    ),
}


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for na_item, (indicateur, libelle, publique) in INDICATEURS.items():
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, confidence_level, badges)
                values (%s, %s, %s, 'observed',
                        array['Officiel','Comparaison harmonisée UE'])
                returning definition_id
                """,
                (
                    publique,
                    "Agrégats du sous-secteur administrations de sécurité sociale"
                    " (S1314) en % du PIB, comptabilité nationale harmonisée"
                    " SEC 2010. Périmètre distinct de la loi de financement de la"
                    " Sécurité sociale (régime général + FSV).",
                    f"Eurostat, jeu {JEU}, secteur S1314, na_item {na_item}, unité PC_GDP",
                ),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, accounting_frame, geo_levels, time_granularity, published)
                values (%s, %s, %s, 'securite_sociale', %s, 'percent', false, 'nationale',
                        array['pays'], 'annuelle', true)
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


def controler_identite(points: list[dict]) -> tuple[list[dict], dict]:
    """Écarte les pays-années où recettes − dépenses ≠ solde, ou incomplets.

    Le constat conserve chaque écart : une quarantaine muette serait une
    destruction silencieuse.
    """
    par_cle: dict[tuple, dict[str, float]] = {}
    for p in points:
        par_cle.setdefault((p["geo"], p["time"]), {})[p["na_item"]] = p["valeur"]
    ecartes = {}
    for (geo, temps), valeurs in par_cle.items():
        if set(valeurs) != set(INDICATEURS):
            ecartes[f"{geo}/{temps}"] = "serie incomplete"
            continue
        ecart = abs(round(valeurs["TR"] - valeurs["TE"], 3) - valeurs["B9"])
        if ecart > TOLERANCE_PTS:
            ecartes[f"{geo}/{temps}"] = round(ecart, 2)
    gardes = [p for p in points if f"{p['geo']}/{p['time']}" not in ecartes]
    return gardes, ecartes


def run(store_spec: str) -> int:
    conn = db.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = db.start_run(conn, DATASET, "manual")
    try:
        url = eurostat.data_url(JEU, PARAMS)
        contenu = fetch(url, timeout=300).content
        db.record_asset(
            conn, store, run_id, DATASET, "eurostat", "gov_10a_main.json",
            contenu, url, "application/json",
        )
        points = decoder(json.loads(contenu))
        gardes, ecartes = controler_identite(points)
        pays = enregistrer_pays(conn, {p["geo"] for p in gardes})
        lignes = (
            (INDICATEURS[p["na_item"]][0], "pays", p["geo"], MILLESIME, p["time"],
             p["valeur"],
             [DRAPEAUX[p["statut"]]] if p.get("statut") in DRAPEAUX else [])
            for p in gardes
            if p["geo"] in pays
        )
        ecrites, revisees = revisions.remplacer(
            conn, run_id, [i[0] for i in INDICATEURS.values()],
            ("value", "quality_flags"), lignes,
        )
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (%s, %s, 'identite_recettes_moins_depenses_egale_solde', %s, %s, %s)
            """,
            (run_id, DATASET, "warning" if ecartes else "info",
             not ecartes, Jsonb({"tolerance_pts": TOLERANCE_PTS, "ecartes": ecartes})),
        )
        conn.commit()
        db.finish_run(conn, run_id, "success", rows_read=len(points), rows_written=ecrites)
        print(f"sécu : {ecrites} observations, {len({p['geo'] for p in gardes})} pays,"
              f" {len(ecartes)} pays-années en quarantaine, {revisees} valeurs révisées")
        return 0
    except Exception as error:  # noqa: BLE001 — tout échec finit tracé dans le lineage
        db.finish_run(conn, run_id, "failed", error=str(error))
        raise
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--store", default=".snapshots")
    return run(parser.parse_args().store)


if __name__ == "__main__":
    raise SystemExit(main())
