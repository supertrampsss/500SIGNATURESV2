"""Limites d'infrastructure rendues exécutables.

Le plafond n'est pas un vœu : une base pleine casse toutes les ingestions
suivantes, pas seulement celle qui déborde. Chaque connecteur volumineux
mesure donc la base **avant** d'écrire et refuse de dépasser — l'arbitrage se
fait les yeux ouverts, jamais par accident.

Historique du réglage : 470 Mo sous le plan gratuit (500 Mo, D6bis) — le
garde-fou a tiré deux fois le 2 août 2026, à 492 puis 472 Mo. Monté à 2 Go le
même jour sur l'annonce d'un forfait payant (D6ter) : erreur — le disque réel
était resté à 500 Mo et Supabase a passé la base en **lecture seule** pendant
le rechargement OFGL 2018 (D6quater, `retablissement.py`). Retour à 470 Mo :
ce plafond ne remontera que sur un constat mesuré — les journaux du
rétablissement impriment taille et réglage read-only — jamais plus sur une
déclaration.
"""

PLAFOND_OCTETS = 470 * 1024 * 1024


def garde_fou_volume(conn) -> int:
    """Taille actuelle de la base ; refuse d'écrire au-delà du plafond."""
    taille = conn.execute("select pg_database_size(current_database())").fetchone()[0]
    if taille > PLAFOND_OCTETS:
        raise RuntimeError(
            f"base à {taille // 1024 // 1024} Mo, plafond {PLAFOND_OCTETS // 1024 // 1024} Mo"
            " (D6bis) : chargement refusé avant écriture — arbitrer le plan Supabase"
        )
    return taille
