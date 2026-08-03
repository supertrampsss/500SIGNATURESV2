"""Rétablissement après passage en lecture seule (incident du 2 août 2026).

Le rechargement des finances communales 2018-2021 (promesse D6) a rempli la
base au-delà du disque réel : Supabase a basculé le projet en **lecture
seule** au milieu du chargement — le forfait annoncé n'avait pas élargi
l'espace de base de données, et le plafond de `limites.py`, monté sur
déclaration, ne protégeait plus rien. Les fichiers publiés (R2) n'ont jamais
cessé d'être servis ; c'est l'écriture qui est gelée, donc toute ingestion.

Ce module répare dans une session qui lève explicitement la lecture seule
(`SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE` — la voie documentée
par Supabase pour nettoyer un projet plein) :

1. constat chiffré d'abord : taille réelle et réglage `read_only`, imprimés
   dans les journaux du run — la prochaine décision de plafond se prendra sur
   ces chiffres, pas sur une déclaration ;
2. rétention appliquée avec sa borne revenue à 2022 : les exercices
   2018-2021 chargés par l'incident repartent, leurs instantanés R2 restent ;
3. VACUUM FULL des partitions pour rendre l'espace au système (via
   `retention.run`, qui porte aussi le lineage et le contrôle qualité).

Idempotent : une base déjà rétablie imprime son état et sort.

Usage : python -m plateforme.retablissement
"""

from plateforme import db, retention


def run() -> int:
    conn = db.connect()
    try:
        conn.autocommit = True  # mesures et réglage de session, hors transaction
        reglage = conn.execute("show default_transaction_read_only").fetchone()[0]
        print(f"default_transaction_read_only = {reglage} ; base : {retention.taille(conn)}")
        # Lever la lecture seule pour CETTE session seulement : on ne rétablit
        # pas l'écriture générale, on se donne le droit de nettoyer.
        conn.execute("set session characteristics as transaction read write")
        conn.autocommit = False
        return retention.run(effectif=True, conn=conn)
    finally:
        conn.close()


def main() -> int:
    return run()


if __name__ == "__main__":
    raise SystemExit(main())
