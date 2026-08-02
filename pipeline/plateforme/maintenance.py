"""Maintenance de l'entrepôt : récupérer l'espace que les rechargements gaspillent.

Le garde-fou D6bis a refusé le chargement de l'APL : base à 492 Mo pour un
plafond de 470. Or la chaîne recharge par « delete puis copy » — et PostgreSQL
ne rend pas l'espace des lignes supprimées : chaque rechargement laisse du
*bloat*. Après une journée à recharger sécurité (deux fois), fiscalité, Sécu et
les autres, une part substantielle des 492 Mo est de l'espace mort.

`VACUUM FULL` réécrit chaque table à sa taille réelle. Il se fait **partition
par partition** : la réécriture demande temporairement l'espace de la table
copiée, et les seize partitions d'observations (~20-30 Mo chacune) passent là
où la table entière (~300 Mo) risquerait le quota disque. Le verrou exclusif
est sans effet lecteur : le site lit les fichiers publiés sur R2, jamais la
base — c'est un des dividendes de cette architecture.

Chaque table est mesurée avant et après : le journal du run dit précisément ce
qui a été récupéré, et si ça ne suffit pas, l'arbitrage du plan payant se fait
sur des chiffres, pas des impressions.

Usage : python -m plateforme.maintenance
"""

from plateforme import db


def tables_a_compacter(conn) -> list[str]:
    """Toutes les tables des schémas métier, partitions comprises, plus grosses
    d'abord — si le temps manque, le gros est déjà fait."""
    return [
        nom for (nom,) in conn.execute(
            """
            select format('%I.%I', schemaname, tablename)
            from pg_tables
            where schemaname in ('core', 'geo', 'fin', 'meta', 'pub')
            order by pg_total_relation_size(format('%I.%I', schemaname, tablename)) desc
            """
        ).fetchall()
    ]


def run() -> int:
    conn = db.connect()
    try:
        conn.autocommit = True  # VACUUM refuse de tourner dans une transaction
        avant_base = conn.execute("select pg_database_size(current_database())").fetchone()[0]
        for table in tables_a_compacter(conn):
            avant = conn.execute(
                "select pg_total_relation_size(%s::regclass)", (table,)
            ).fetchone()[0]
            conn.execute(f"vacuum (full, analyze) {table}")
            apres = conn.execute(
                "select pg_total_relation_size(%s::regclass)", (table,)
            ).fetchone()[0]
            if avant - apres > 1024 * 1024:
                print(f"{table} : {avant // 1024 // 1024} -> {apres // 1024 // 1024} Mo")
        apres_base = conn.execute("select pg_database_size(current_database())").fetchone()[0]
        print(
            f"base : {avant_base // 1024 // 1024} -> {apres_base // 1024 // 1024} Mo"
            f" ({(avant_base - apres_base) // 1024 // 1024} Mo récupérés)"
        )
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(run())
