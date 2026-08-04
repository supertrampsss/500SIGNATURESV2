"""Limites d'infrastructure rendues exécutables.

**Ce que ce module surveillait, et ce qu'il surveille maintenant.** Sous
Supabase, le plafond n'était pas un vœu : une base pleine cassait toutes les
ingestions suivantes, pas seulement celle qui débordait. Chaque connecteur
volumineux mesurait donc la base avant d'écrire et refusait de dépasser.

Historique du réglage, gardé parce qu'il explique la prudence qui suit : 470 Mo
sous le plan gratuit (500 Mo, D6bis) — le garde-fou a tiré deux fois le 2 août
2026, à 492 puis 472 Mo. Monté à 2 Go le même jour sur l'annonce d'un forfait
payant (D6ter) : erreur, le disque réel était resté à 500 Mo, et la base est
passée en lecture seule pendant le rechargement OFGL 2018 (D6quater). Trente-six
heures de données figées ont suivi.

**L'entrepôt DuckDB n'a plus de disque à saturer** : c'est un fichier dans un
bucket objet, où quatorze millions de lignes tiennent pour quelques centimes par
mois. Le plafond passe donc à une valeur qui n'arrête plus un chargement légitime
— il reste, parce qu'un connecteur qui produirait cent fois le volume attendu est
un connecteur en défaut, et qu'un entrepôt qui triple en une nuit doit réveiller
quelqu'un avant d'être publié. On garde le garde-fou, on lui retire le rôle
d'arbitre budgétaire qu'il n'aurait jamais dû avoir.
"""

from plateforme import entrepot

# Non plus la contrainte d'un plan, mais un seuil d'invraisemblance : l'entrepôt
# complet — les 72 agrégats OFGL compris — est attendu autour du gigaoctet.
PLAFOND_OCTETS = 8 * 1024 * 1024 * 1024


def garde_fou_volume(conn) -> int:
    """Taille de l'entrepôt ; refuse d'écrire au-delà du plafond."""
    taille = entrepot.taille(conn)
    if taille > PLAFOND_OCTETS:
        raise RuntimeError(
            f"entrepôt à {taille // 1024 // 1024} Mo, plafond"
            f" {PLAFOND_OCTETS // 1024 // 1024} Mo : chargement refusé avant écriture."
            " Une telle taille signale un connecteur en défaut plutôt qu'une"
            " croissance normale — vérifier avant de relever le plafond."
        )
    return taille
