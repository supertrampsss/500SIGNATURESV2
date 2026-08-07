"""Taux de taxe foncière par commune (DGFiP) vers core.observations.

« Où vont *mes* impôts ? » commence par « à quel taux ma commune me taxe-t-elle,
et monte-t-il ? ». La taxe foncière est l'impôt local que paient les
propriétaires — depuis la fin de la taxe d'habitation sur les résidences
principales, c'est l'essentiel de ce qu'un particulier verse à sa commune.

**Deux taux, parce que deux questions.** Le taux *communal* (`e12vote`) est ce
que vote le conseil municipal : c'est lui qui engage les élus qu'on désigne. Le
taux *global* (`taux_global_tfb`) ajoute l'intercommunalité et les taxes
annexes : c'est lui qu'on retrouve sur l'avis d'imposition. Publier l'un sans
l'autre ferait accuser la commune de hausses qu'elle n'a pas votées — à Pessac,
le taux communal n'a pas bougé depuis 2021 quand le taux global montait.

**Un taux n'est pas un montant.** Un taux élevé sur des valeurs locatives
basses peut coûter moins qu'un taux bas à Paris. La fiche le dit : comparer des
taux, c'est comparer des politiques fiscales, pas des factures.

Contrôle bloquant par ligne : le taux global contient le taux communal, il ne
peut pas lui être inférieur. Une ligne qui viole cette identité est écartée et
comptée, jamais publiée.

Usage : python -m plateforme.normalize.fiscalite [--depuis 2022] [--store …]
"""

import json
import argparse
import csv
import io
from datetime import UTC, datetime
from urllib.parse import urlencode


from plateforme import entrepot
from plateforme.connectors import ods
from plateforme.http import telecharger
from plateforme.normalize.geo import MILLESIME, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "dgfip-fiscalite-particuliers"
SOURCE = "data-economie"
BASE = "https://data.economie.gouv.fr/api/explore/v2.1"
JEU = "fiscalite-locale-des-particuliers"

INDICATEURS = {
    "dgfip_taux_tfb_commune": (
        "e12vote",
        "Taux communal de taxe foncière",
        "La part du taux de taxe foncière sur les propriétés bâties votée par le"
        " conseil municipal. C'est la décision de la commune seule, sans"
        " l'intercommunalité ni les taxes annexes.",
    ),
    "dgfip_taux_tfb_global": (
        "taux_global_tfb",
        "Taux global de taxe foncière",
        "Le taux total appliqué aux propriétés bâties : commune, intercommunalité"
        " et taxes annexes réunies. C'est celui qui figure sur l'avis"
        " d'imposition. Un taux s'applique à la valeur locative cadastrale, pas"
        " au prix du bien : un taux élevé ne signifie pas une facture élevée.",
    ),
}


def url_export(depuis: int) -> str:
    """URL d'export CSV, correctement encodée.

    Deux leçons du premier échec (HTTP 400) : `exercice` est un champ texte et
    l'API refuse `>=` entre textes — la borne devient une clause `IN` sur des
    années énumérées ; et une URL se construit avec `urlencode`, jamais par
    concaténation — les quotes et le `>` non encodés suffisaient à casser la
    requête.
    """
    annees = ",".join(f"'{a}'" for a in range(depuis, datetime.now(UTC).year + 1))
    q = urlencode(
        {
            "select": "exercice,dep,com,e12vote,taux_global_tfb",
            "where": f"exercice in ({annees})",
        }
    )
    return f"{ods.export_url(BASE, JEU)}?{q}"


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for indicateur, (_, libelle, publique) in INDICATEURS.items():
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, confidence_level, badges)
                values (?, ?, ?, 'observed', array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (
                    publique,
                    "Recensement des éléments d'imposition (REI) de la DGFiP, jeu"
                    " « fiscalité locale des particuliers », taux en % de la valeur"
                    " locative cadastrale.",
                    "DGFiP, colonnes e12vote et taux_global_tfb du REI",
                ),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, geo_levels, time_granularity, published)
                values (?, ?, ?, 'impots_locaux', ?, 'percent', false,
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


def code_commune(dep: str, com: str) -> str:
    """`33` + `318` -> `33318`, `2A` + `004` -> `2A004`, `971` + `01` -> `97101`.

    Le code INSEE fait cinq caractères : la part communale se complète à ce qui
    reste après le département, jamais l'inverse.
    """
    dep = dep.strip()
    return dep + com.strip().zfill(5 - len(dep))


def lire(contenu: bytes, depuis: int) -> tuple[list[dict], dict]:
    """CSV d'export ODS (`;`) -> lignes par commune-exercice, plus les écartées.

    L'identité `global >= communal` est contrôlée ligne à ligne : le taux global
    contient le communal, une ligne qui l'inverse est fausse quelque part et
    n'est pas publiée.
    """
    lecteur = csv.DictReader(io.StringIO(contenu.decode("utf-8-sig")), delimiter=";")
    lignes, ecartees = [], {}
    for rang in lecteur:
        exercice = (rang.get("exercice") or "").strip()
        if not exercice.isdigit() or int(exercice) < depuis:
            continue
        code = code_commune(rang.get("dep") or "", rang.get("com") or "")
        if len(code) != 5:
            ecartees[f"{code}/{exercice}"] = "code commune illisible"
            continue
        try:
            communal = float(rang["e12vote"]) if rang.get("e12vote") else None
            total = float(rang["taux_global_tfb"]) if rang.get("taux_global_tfb") else None
        except ValueError:
            ecartees[f"{code}/{exercice}"] = "taux illisible"
            continue
        if communal is None or total is None:
            continue  # secret ou absence : rien à publier, rien à inventer
        if total < communal - 0.01:
            ecartees[f"{code}/{exercice}"] = f"global {total} < communal {communal}"
            continue
        lignes.append(
            {"code": code, "exercice": exercice, "communal": communal, "total": total}
        )
    return lignes, ecartees


def ecrire(conn, run_id: str, lignes: list[dict]) -> tuple[int, int]:
    candidates = []
    for ligne in lignes:
        candidates.append(
            ("dgfip_taux_tfb_commune", "commune", ligne["code"], ligne["exercice"],
             ligne["communal"])
        )
        candidates.append(
            ("dgfip_taux_tfb_global", "commune", ligne["code"], ligne["exercice"],
             ligne["total"])
        )
    gardees, ecartes = filtrer_territoires_connus(conn, candidates)
    with conn.cursor() as curseur:
        curseur.execute(
            "delete from core.observations where indicator_id = any(?)",
            (list(INDICATEURS),),
        )
        entrepot.copier(
            conn,
            "core.observations",
            ["indicator_id", "geo_level", "geo_code", "geo_vintage", "period", "value", "run_id"],
            ((cle, niveau, code, MILLESIME, periode, valeur, run_id) for cle, niveau, code, periode, valeur in gardees),
        )
    conn.commit()
    return len(gardees), ecartes


def run(depuis: int, store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        url = url_export(depuis)
        contenu = telecharger(url, timeout=600)
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, f"taux-tfb-depuis-{depuis}.csv",
            contenu, url, "text/csv",
        )
        lignes, ecartees = lire(contenu, depuis)
        if not lignes:
            raise ValueError("aucun taux lu : le format de la source a dû changer")
        ecrites, hors_referentiel = ecrire(conn, run_id, lignes)
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'identite_global_contient_communal', ?, ?, ?)
            """,
            (run_id, DATASET, "warning" if ecartees else "info", not ecartees,
             json.dumps({"ecartees": dict(list(ecartees.items())[:20]), "total_ecartees": len(ecartees)})),
        )
        conn.commit()
        entrepot.finish_run(conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites)
        print(f"taux fonciers : {ecrites} observations, {len(ecartees)} lignes écartées,"
              f" {hors_referentiel} hors référentiel")
        return 0
    except Exception as error:  # noqa: BLE001 — tout échec finit tracé dans le lineage
        entrepot.finish_run(conn, run_id, "failed", error=str(error))
        raise
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--depuis", type=int, default=2022)
    parser.add_argument("--store", default=".snapshots")
    arguments = parser.parse_args()
    return run(arguments.depuis, arguments.store)


if __name__ == "__main__":
    raise SystemExit(main())
