"""Comparaisons européennes (Eurostat) vers core.observations, niveau pays.

Doctrine du produit (docs/00, §7) : pour comparer des pays, **Eurostat prime
sur les sources nationales**. Les définitions y sont harmonisées, ce qui est la
seule condition qui rende une comparaison honnête. Un chiffre national et un
chiffre Eurostat portant le même nom ne sont pas interchangeables : ils sont
publiés séparément, jamais mélangés dans une même série.

Les drapeaux d'Eurostat sont conservés : `b` signale une rupture de série,
`p` une valeur provisoire, `e` une estimation. Une courbe qui enjambe une
rupture doit le dire plutôt que de laisser croire à une évolution réelle.

Usage : python -m plateforme.normalize.europe [--store r2:plateforme-raw]
"""

import argparse
import json

from plateforme import db
from plateforme.connectors import eurostat
from plateforme.connectors.jsonstat import decoder
from plateforme.http import fetch
from plateforme.normalize.geo import MILLESIME, make_store

DATASET_PAR_JEU = {
    "gov_10dd_edpt1": "eurostat-gov-10dd-edpt1",
    "nama_10_pc": "eurostat-nama-10-pc",
    "une_rt_a": "eurostat-une-rt-a",
}

# Agrégats retenus, avec les filtres qui les rendent comparables entre pays.
INDICATEURS = {
    "eurostat_dette_pib": {
        "jeu": "gov_10dd_edpt1",
        "params": {"na_item": "GD", "sector": "S13", "unit": "PC_GDP", "freq": "A"},
        "libelle": "Dette publique en % du PIB (définition européenne)",
        "public": "La dette de toutes les administrations publiques rapportée à la"
        " richesse produite en un an, calculée de la même façon dans chaque pays"
        " de l'Union.",
        "technique": "Dette brute consolidée au sens du protocole sur la procédure"
        " concernant les déficits excessifs, secteur S13, en % du PIB.",
        "unite": "percent",
    },
    "eurostat_deficit_pib": {
        "jeu": "gov_10dd_edpt1",
        "params": {"na_item": "B9", "sector": "S13", "unit": "PC_GDP", "freq": "A"},
        "libelle": "Déficit ou excédent public en % du PIB",
        "public": "L'écart d'une année entre ce que les administrations publiques"
        " encaissent et ce qu'elles dépensent. Un chiffre négatif est un déficit,"
        " qui se finance par l'emprunt.",
        "technique": "Capacité (+) ou besoin (−) de financement des administrations"
        " publiques, secteur S13, en % du PIB, au sens de Maastricht.",
        "unite": "percent",
    },
    "eurostat_pib_habitant_spa": {
        "jeu": "nama_10_pc",
        "params": {"na_item": "B1GQ", "unit": "CP_PPS_EU27_2020_HAB", "freq": "A"},
        "libelle": "PIB par habitant en standards de pouvoir d'achat",
        "public": "La richesse produite par habitant, corrigée des écarts de prix"
        " entre pays. C'est ce qui permet de comparer des niveaux de vie sans être"
        " trompé par le coût de la vie.",
        "technique": "Produit intérieur brut par habitant en standards de pouvoir"
        " d'achat, base UE27 2020.",
        "unite": "count",
    },
    "eurostat_chomage": {
        "jeu": "une_rt_a",
        # Le jeu mensuel (une_rt_m) n'a pas de fréquence annuelle, et la classe
        # d'âge s'y nomme Y15-74 : « TOTAL » n'existe pas et renvoie du vide.
        "params": {"age": "Y15-74", "sex": "T", "unit": "PC_ACT", "freq": "A"},
        "libelle": "Taux de chômage harmonisé",
        "public": "La part des personnes sans emploi qui en cherchent un activement,"
        " mesurée selon la définition du Bureau international du travail, identique"
        " dans tous les pays.",
        "technique": "Taux de chômage au sens du BIT, 15-74 ans, tous sexes,"
        " en % de la population active.",
        "unite": "percent",
    },
}

# Drapeaux Eurostat -> signalements du modèle (docs/06).
DRAPEAUX = {"b": "break_in_series", "p": "provisional", "e": "estimated", "d": "definition_differs"}


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for indicateur, fiche in INDICATEURS.items():
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, confidence_level, badges)
                values (%s, %s, %s, 'observed',
                        array['Officiel','Comparaison harmonisée UE'])
                returning definition_id
                """,
                (fiche["public"], fiche["technique"], f"Eurostat, jeu {fiche['jeu']}"),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, accounting_frame, geo_levels, time_granularity, published)
                values (%s, %s, %s, 'europe', %s, %s, false, 'nationale',
                        array['pays'], 'annuelle', true)
                on conflict (indicator_id) do update set
                    definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                    published = true
                """,
                (indicateur, DATASET_PAR_JEU[fiche["jeu"]], definition, fiche["libelle"],
                 fiche["unite"]),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def enregistrer_pays(conn, codes: set[str]) -> set[str]:
    """Les pays deviennent des territoires du référentiel. Les agrégats
    (zone euro, UE27) en font partie : ce sont des repères légitimes, mais ils
    ne s'additionnent pas aux pays qui les composent."""
    with conn.cursor() as curseur:
        curseur.executemany(
            """
            insert into geo.geography_reference (geo_level, geo_code, vintage, name, flags)
            values ('pays', %s, %s, %s, %s)
            on conflict (geo_level, geo_code, vintage) do nothing
            """,
            [
                (code, MILLESIME, code, json.dumps({"agregat": True} if len(code) > 2 else {}))
                for code in sorted(codes)
            ],
        )
    conn.commit()
    return {
        code
        for (code,) in conn.execute(
            "select geo_code from geo.geography_reference where geo_level = 'pays'"
            " and vintage = %s",
            (MILLESIME,),
        )
    }


def run(store_spec: str) -> int:
    conn = db.connect()
    store = make_store(store_spec)
    declarer(conn)
    total = 0
    for indicateur, fiche in INDICATEURS.items():
        dataset_id = DATASET_PAR_JEU[fiche["jeu"]]
        run_id = db.start_run(conn, dataset_id, "manual")
        try:
            url = eurostat.data_url(fiche["jeu"], fiche["params"])
            contenu = fetch(url, timeout=300).content
            db.record_asset(
                conn, store, run_id, dataset_id, "eurostat", f"{indicateur}.json",
                contenu, url, "application/json",
            )
            points = decoder(json.loads(contenu))
            pays = enregistrer_pays(conn, {p["geo"] for p in points})
            lignes = [
                (indicateur, "pays", p["geo"], MILLESIME, p["time"], p["valeur"],
                 [DRAPEAUX[p["statut"]]] if p.get("statut") in DRAPEAUX else [], run_id)
                for p in points
                if p["geo"] in pays
            ]
            with conn.cursor() as curseur:
                curseur.execute(
                    "delete from core.observations where indicator_id = %s", (indicateur,)
                )
                with curseur.copy(
                    "copy core.observations (indicator_id, geo_level, geo_code, geo_vintage,"
                    " period, value, quality_flags, run_id) from stdin"
                ) as copie:
                    for ligne in lignes:
                        copie.write_row(ligne)
            conn.commit()
            db.finish_run(conn, run_id, "success", rows_written=len(lignes))
            total += len(lignes)
            print(f"{indicateur} : {len(lignes)} observations, {len({ligne[2] for ligne in lignes})} pays")
        except Exception as error:  # noqa: BLE001 — tout échec finit tracé dans le lineage
            db.finish_run(conn, run_id, "failed", error=str(error))
            raise
    conn.close()
    print(f"Europe : {total} observations")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--store", default=".snapshots")
    return run(parser.parse_args().store)


if __name__ == "__main__":
    raise SystemExit(main())
