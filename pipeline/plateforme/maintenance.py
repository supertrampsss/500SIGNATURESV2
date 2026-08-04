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

from plateforme import entrepot


def run() -> int:
    """Force l'écriture du fichier et dit ce qu'il pèse.

    Sous Postgres, ce module lançait un `vacuum full` table par table pour rendre
    au disque l'espace des lignes mortes — l'opération qui, sur une base saturée,
    demandait justement l'espace qu'elle cherchait à libérer. DuckDB n'a pas ce
    problème : le fichier est réécrit au checkpoint, et c'est la seule chose à
    faire avant de le renvoyer au bucket.
    """
    conn = entrepot.connect()
    try:
        avant = entrepot.taille(conn)
        conn.execute("force checkpoint")
        apres = entrepot.taille(conn)
        print(
            f"entrepôt : {avant // 1024 // 1024} -> {apres // 1024 // 1024} Mo"
            f" ({(avant - apres) // 1024 // 1024} Mo récupérés)"
        )
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(run())
