"""Limites d'infrastructure rendues exécutables.

D6bis n'est pas un vœu : le plan Supabase gratuit fait 500 Mo, et une base
pleine casse toutes les ingestions suivantes, pas seulement celle qui déborde.
Chaque connecteur volumineux mesure donc la base **avant** d'écrire et refuse
de dépasser — l'arbitrage (passer au plan payant, réduire un périmètre) se fait
les yeux ouverts, jamais par accident.
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
