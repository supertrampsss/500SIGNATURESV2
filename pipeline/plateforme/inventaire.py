"""Ce que l'entrepôt contient vraiment, en une commande.

Écrit le 4 août après une coupure. Le rechargement communal a atteint le délai
maximum d'un run ; l'entrepôt est bien remonté dans le bucket, mais le
processus d'ingestion tenait encore le verrou au moment de la copie. Reprendre
au jugé aurait été un pari : soit sauter des lots qui n'y sont pas, soit refaire
sept fois 195 Mo par prudence.

Ce module répond à la question à sa place. Il ouvre l'entrepôt — ce qui prouve
déjà qu'il est lisible — et dit, par niveau et par jeu, ce qui s'y trouve.
Pour l'OFGL, il va jusqu'à nommer les agrégats présents et le lot où reprendre :
c'est la seule information qui manquait.

Usage : python -m plateforme.inventaire
"""

import argparse

from plateforme import entrepot


def etat(conn) -> dict:
    """L'état de l'entrepôt, tel qu'il se lit."""
    lignes = conn.execute(
        """
        select geo_level, count(*), count(distinct indicator_id), count(distinct geo_code),
               min(period), max(period)
        from core.observations group by 1 order by 2 desc
        """
    ).fetchall()
    jeux = conn.execute(
        """
        select i.dataset_id, count(*), count(distinct o.indicator_id)
        from core.observations o join core.indicators i using (indicator_id)
        group by 1 order by 2 desc
        """
    ).fetchall()
    runs = conn.execute(
        """
        select dataset_id, status, started_at, rows_written
        from meta.ingestion_runs order by started_at desc limit 12
        """
    ).fetchall()
    return {"niveaux": lignes, "jeux": jeux, "runs": runs}


def ofgl_communal(conn) -> tuple[list[str], list[str]]:
    """-> (agrégats communaux présents, absents), dans l'ordre des lots."""
    from plateforme.connectors import ofgl

    retenus = list(ofgl.agregats_du_niveau("commune"))
    indicateurs = {
        code
        for (code,) in conn.execute(
            "select distinct indicator_id from core.observations where geo_level = 'commune'"
        ).fetchall()
    }
    correspondance = ofgl.agregats()
    presents = [a for a in retenus if correspondance[a] in indicateurs]
    absents = [a for a in retenus if correspondance[a] not in indicateurs]
    return presents, absents


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.parse_args()
    conn = entrepot.connect()
    try:
        print(f"entrepôt : {entrepot.taille(conn) / 1e6:.0f} Mo\n")
        vu = etat(conn)
        print("observations par maille")
        for niveau, total, indicateurs, territoires, debut, fin in vu["niveaux"]:
            print(
                f"  {niveau:14s} {total:>12,} obs  {indicateurs:>4} indicateurs"
                f"  {territoires:>6} territoires  {debut} → {fin}".replace(",", " ")
            )
        print("\nobservations par jeu")
        for jeu, total, indicateurs in vu["jeux"]:
            print(f"  {jeu:28s} {total:>12,} obs  {indicateurs:>4} indicateurs".replace(",", " "))
        print("\nderniers runs")
        for jeu, statut, debut, ecrites in vu["runs"]:
            horodatage = debut.isoformat(timespec="seconds") if debut else "?"
            print(f"  {horodatage}  {statut:10s} {jeu:28s} {ecrites or 0:>10} lignes")

        from plateforme.normalize.ofgl import LOT_AGREGATS

        presents, absents = ofgl_communal(conn)
        total = len(presents) + len(absents)
        print(f"\nOFGL à la commune : {len(presents)} agrégats sur {total}")
        if absents:
            # Les lots suivent l'ordre du fichier de sélection : le premier
            # agrégat manquant dit où reprendre.
            rang = (len(presents) // LOT_AGREGATS) + 1
            print(f"  premier absent : « {absents[0]} »")
            print(f"  reprendre au lot {rang} (lots de {LOT_AGREGATS})")
        else:
            print("  complet")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
