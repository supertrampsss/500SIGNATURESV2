"""Rétention des séries volumineuses : appliquer une politique, pas un ménage.

Plutôt que de supprimer des lignes à la main le jour où la base déborde, la
politique est **déclarée ici, versionnée, et rejouable**. Elle ne détruit rien
d'irremplaçable : les snapshots bruts de 2018 à 2025 restent dans R2, et
`plateforme.normalize.ofgl --depuis <exercice>` recharge en une commande ce que
cette politique retire.

Historique : sous le plan gratuit (500 Mo, décision D6), la borne communale
était 2022 — un exercice communal pèse environ 87 Mo, index compris, et les
observations communales font l'essentiel de la base. Le passage au plan payant
(D6ter, plafond porté à 2 Go dans `limites.py`) a tenu la promesse écrite dans
le workflow : la borne redescend à 2018, tout l'historique publié par l'OFGL
est servi de nouveau. La politique reste en place — elle dit désormais « tout
garder depuis 2018 », et le jour où il faudra arbitrer à nouveau, l'arbitrage
se fera ici, à découvert.

Deux gardes-fous :

- la politique ne s'applique qu'aux niveaux qu'elle nomme — un oubli n'efface
  jamais un niveau entier ;
- elle refuse de s'exécuter s'il ne resterait pas au moins deux exercices, car
  une série d'un seul point n'a plus d'évolution à montrer.

Usage : python -m plateforme.retention [--appliquer]
"""

import argparse

from psycopg.types.json import Jsonb

from plateforme import db

# {niveau géographique: premier exercice conservé}. Les autres niveaux gardent
# tout leur historique : ils pèsent 66 000 lignes contre 1,25 million.
RETENTION = {"commune": "2018"}

EXERCICES_MINIMUM = 2
DATASET = "ofgl-communes"


def a_supprimer(conn) -> dict[str, list[str]]:
    """{niveau: exercices hors rétention}, sans rien modifier."""
    hors: dict[str, list[str]] = {}
    for niveau, premier in RETENTION.items():
        periodes = [
            periode
            for (periode,) in conn.execute(
                "select distinct period from core.observations"
                " where geo_level = %s order by 1",
                (niveau,),
            )
        ]
        vieux = [p for p in periodes if p < premier]
        restants = len(periodes) - len(vieux)
        if vieux and restants < EXERCICES_MINIMUM:
            raise ValueError(
                f"{niveau} : la rétention à partir de {premier} ne laisserait que"
                f" {restants} exercice(s) ; une série d'un seul point n'a pas d'évolution"
            )
        if vieux:
            hors[niveau] = vieux
    return hors


def appliquer(conn, hors: dict[str, list[str]]) -> int:
    total = 0
    for niveau, periodes in hors.items():
        supprimees = conn.execute(
            "delete from core.observations where geo_level = %s and period = any(%s)",
            (niveau, periodes),
        ).rowcount
        total += supprimees
        print(f"{niveau} : {supprimees} observations retirées ({', '.join(periodes)})")
    conn.commit()
    return total


def recuperer_espace(conn) -> None:
    """`vacuum full` rend l'espace au système ; un `vacuum` ordinaire le laisse
    réutilisable par la table sans réduire la taille de la base, ce qui ne
    règlerait pas le problème de quota."""
    conn.rollback()
    autocommit = conn.autocommit
    conn.autocommit = True  # VACUUM ne s'exécute pas dans une transaction
    try:
        for (partition,) in conn.execute(
            "select relname from pg_stat_user_tables where relname like 'observations_p%'"
            " order by pg_total_relation_size(relid) desc"
        ).fetchall():
            conn.execute(f"vacuum full analyze core.{partition}")
            print(f"espace récupéré sur {partition}")
    finally:
        conn.autocommit = autocommit


def taille(conn) -> str:
    return conn.execute("select pg_size_pretty(pg_database_size(current_database()))").fetchone()[
        0
    ]


def run(effectif: bool) -> int:
    conn = db.connect()
    try:
        hors = a_supprimer(conn)
        if not hors:
            print(f"rétention déjà respectée — base : {taille(conn)}")
            return 0
        if not effectif:
            for niveau, periodes in hors.items():
                print(f"à retirer — {niveau} : {', '.join(periodes)}")
            print(f"simulation seulement ; base actuelle : {taille(conn)}")
            return 0

        avant = taille(conn)
        # `backfill` : le vocabulaire des déclencheurs est contraint par le
        # schéma, et une rétention est bien une reprise sur données existantes.
        run_id = db.start_run(conn, DATASET, "backfill")
        try:
            supprimees = appliquer(conn, hors)
            recuperer_espace(conn)
            apres = taille(conn)
            conn.execute(
                """
                insert into meta.data_quality_checks
                    (run_id, dataset_id, check_name, severity, passed, observed)
                values (%s, %s, 'retention_appliquee', 'info', true, %s)
                """,
                (
                    run_id,
                    DATASET,
                    Jsonb(
                        {
                            "politique": RETENTION,
                            "observations_retirees": supprimees,
                            "taille_avant": avant,
                            "taille_apres": apres,
                            "rechargement": "plateforme.normalize.ofgl --niveaux commune"
                            " --depuis 2018 (snapshots conservés dans R2)",
                        }
                    ),
                ),
            )
            conn.commit()
            db.finish_run(conn, run_id, "success", rows_written=supprimees)
            print(f"base : {avant} -> {apres}")
            return 0
        except Exception as error:  # noqa: BLE001 — tout échec finit tracé dans le lineage
            db.finish_run(conn, run_id, "failed", error=str(error))
            raise
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--appliquer", action="store_true", help="exécuter ; sans ce drapeau, simulation"
    )
    return run(parser.parse_args().appliquer)


if __name__ == "__main__":
    raise SystemExit(main())
