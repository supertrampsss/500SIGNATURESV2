"""Limites d'infrastructure rendues exécutables.

Le plafond n'est pas un vœu : une base pleine casse toutes les ingestions
suivantes, pas seulement celle qui déborde. Chaque connecteur volumineux
mesure donc la base **avant** d'écrire et refuse de dépasser — l'arbitrage se
fait les yeux ouverts, jamais par accident.

Historique du réglage : 470 Mo sous le plan gratuit (500 Mo, décision D6bis) —
le garde-fou a tiré deux fois le 2 août 2026, à 492 puis 472 Mo. Le
commanditaire a alors indiqué être sur un forfait payant : le plafond monte à
2 Go, un palier volontairement sous les 8 Go du disque de base des plans
payants — on l'élèvera sur constat, pas sur supposition (D6ter).
"""

PLAFOND_OCTETS = 2 * 1024 * 1024 * 1024


def garde_fou_volume(conn) -> int:
    """Taille actuelle de la base ; refuse d'écrire au-delà du plafond."""
    taille = conn.execute("select pg_database_size(current_database())").fetchone()[0]
    if taille > PLAFOND_OCTETS:
        raise RuntimeError(
            f"base à {taille // 1024 // 1024} Mo, plafond {PLAFOND_OCTETS // 1024 // 1024} Mo"
            " (D6bis) : chargement refusé avant écriture — arbitrer le plan Supabase"
        )
    return taille
