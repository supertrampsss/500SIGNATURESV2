"""Dotation globale de fonctionnement des communes vers core.observations.

Ce connecteur ferme une boucle du produit : le budget de l'État inscrit un
prélèvement sur recettes au profit des collectivités, et cette série dit ce que
chaque commune en reçoit. Les deux chiffres viennent de deux administrations
différentes et se contrôlent l'un l'autre.

**Contrôle bloquant, entre sources.** La DGF versée aux communes doit rester
inférieure au prélèvement sur recettes au profit des collectivités territoriales
du même exercice : le prélèvement finance aussi les départements, les régions,
le FCTVA et des compensations d'exonérations. Si la somme des DGF communales
dépassait ce prélèvement, l'un des deux chiffres serait faux — le run échoue
plutôt que de publier.

**Volume.** Un seul indicateur est publié, la DGF totale, et un seul exercice
par défaut : la base tourne à l'étroit sur le plan gratuit (D6bis). Les quatre
composantes restent dans le snapshot R2 et se chargent en changeant une ligne.

Usage : python -m plateforme.normalize.dotations [--exercice 2025] [--store …]
"""

import json
import argparse


from plateforme import entrepot
from plateforme.connectors import dgcl
from plateforme.http import telecharger
from plateforme.normalize.geo import MILLESIME, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "ofgl-dotations-communes"
SOURCE = "ofgl"
INDICATEUR = "dgcl_dotation_globale_fonctionnement"

FICHE = {
    "libelle": "Dotation globale de fonctionnement reçue",
    "public": "Ce que l'État verse chaque année à la commune pour son"
    " fonctionnement : une part forfaitaire, calculée surtout sur la population,"
    " et des parts de péréquation qui tiennent compte des ressources et des"
    " charges de la commune.",
    "technique": "Somme des montants notifiés de dotation forfaitaire, DSU, DSR"
    " et DNP pour l'exercice, source DGCL diffusée par l'OFGL.",
    "formule": "Dotation forfaitaire + DSU + DSR + DNP",
}


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        definition = curseur.execute(
            """
            insert into core.indicator_definitions
                (public_definition, technical_definition, formula, confidence_level, badges)
            values (?, ?, ?, 'observed', array['Officiel','Donnée brute'])
            returning definition_id
            """,
            (FICHE["public"], FICHE["technique"], FICHE["formule"]),
        ).fetchone()[0]
        curseur.execute(
            """
            insert into core.indicators
                (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                 additive, price_basis, accounting_frame, geo_levels,
                 time_granularity, published)
            values (?, ?, ?, 'finances_locales', ?, 'EUR', true, 'current',
                    'budgetaire', array['commune'], 'annuelle', true)
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


def controler_contre_l_etat(conn, run_id: str, exercice: str, total: float) -> tuple[bool, dict]:
    """La DGF communale doit tenir dans le prélèvement sur recettes de l'État.

    Deux administrations, deux chaînes de production : si l'inégalité tombe,
    c'est que l'une des deux est mal lue.
    """
    ligne = conn.execute(
        """
        select value from core.observations
        where indicator_id = 'etat_psr_collectivites' and period = ? and geo_level = 'pays'
        """,
        (exercice,),
    ).fetchone()
    prelevement = float(ligne[0]) if ligne else None
    passe = prelevement is None or total < prelevement
    constat = {
        "dgf_communes": round(total, 2),
        "psr_collectivites": round(prelevement, 2) if prelevement is not None else None,
        "part": round(total / prelevement * 100, 1) if prelevement else None,
    }
    conn.execute(
        """
        insert into meta.data_quality_checks
            (run_id, dataset_id, check_name, severity, passed, observed)
        values (?, ?, 'dgf_inferieure_au_prelevement_sur_recettes', 'blocker', ?, ?)
        """,
        (run_id, DATASET, passe, json.dumps(constat)),
    )
    conn.commit()
    return passe, constat


def ecrire(conn, run_id: str, totaux: dict[tuple[str, str], float]) -> tuple[int, set[str]]:
    lignes = [
        (INDICATEUR, "commune", code, periode, montant)
        for (code, periode), montant in sorted(totaux.items())
    ]
    gardees, ecartes = filtrer_territoires_connus(conn, lignes)
    with conn.cursor() as curseur:
        curseur.execute("delete from core.observations where indicator_id = ?", (INDICATEUR,))
        entrepot.copier(
            conn,
            "core.observations",
            ["indicator_id", "geo_level", "geo_code", "geo_vintage", "period", "value", "run_id"],
            ((indicateur, niveau, code, MILLESIME, periode, valeur, run_id) for indicateur, niveau, code, periode, valeur in gardees),
        )
    conn.commit()
    return len(gardees), ecartes


def run(exercice: int, store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        url = dgcl.url_export(exercice)
        contenu = telecharger(url, timeout=600)
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, f"dotations-{exercice}.csv", contenu,
            url, "text/csv",
        )
        brutes = dgcl.lire(contenu)
        if not brutes:
            raise ValueError(f"exercice {exercice} : aucune ligne de montant lue")
        totaux = dgcl.dgf(brutes)
        ecrites, ecartes = ecrire(conn, run_id, totaux)
        total = sum(totaux.values())
        passe, constat = controler_contre_l_etat(conn, run_id, str(exercice), total)
        if not passe:
            raise ValueError(
                f"exercice {exercice} : la DGF communale ({constat['dgf_communes']:,.0f} €)"
                f" dépasse le prélèvement sur recettes de l'État"
                f" ({constat['psr_collectivites']:,.0f} €)"
            )
        entrepot.finish_run(conn, run_id, "success", rows_read=len(brutes), rows_written=ecrites)
        print(
            f"dotations {exercice} : {ecrites} communes, "
            f"{total / 1e9:.2f} Md€ de DGF"
            + (f", {constat['part']} % du prélèvement sur recettes" if constat["part"] else "")
        )
        if ecartes:
            print(f"{len(ecartes)} territoires absents du référentiel, écartés")
        return 0
    except Exception as error:  # noqa: BLE001 — tout échec finit tracé dans le lineage
        entrepot.finish_run(conn, run_id, "failed", error=str(error))
        raise
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--exercice", type=int, default=2025)
    parser.add_argument("--store", default=".snapshots")
    args = parser.parse_args()
    return run(args.exercice, args.store)


if __name__ == "__main__":
    raise SystemExit(main())
