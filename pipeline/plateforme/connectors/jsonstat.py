"""Décodage JSON-stat 2.0 (format de diffusion d'Eurostat).

Les valeurs arrivent dans un dictionnaire plat indexé par une position
linéaire ; les dimensions sont décrites à part. Se tromper dans le calcul de
position ne provoque aucune erreur : cela attribue simplement les chiffres au
mauvais pays ou à la mauvaise année. D'où un décodage explicite, testé.
"""


def decoder(charge: dict) -> list[dict]:
    """-> [{dimension: catégorie, …, 'valeur': float, 'statut': str|None}]."""
    ordre = charge["id"]
    tailles = charge["size"]
    dimensions = charge["dimension"]

    # Pour chaque dimension, la liste des catégories dans l'ordre des indices.
    categories = []
    for nom in ordre:
        index = dimensions[nom]["category"]["index"]
        if isinstance(index, dict):
            libelles = sorted(index, key=index.get)
        else:
            libelles = list(index)
        categories.append(libelles)

    # Pas de chaque dimension dans l'index linéaire (ordre ligne-majeur).
    pas = [1] * len(tailles)
    for i in range(len(tailles) - 2, -1, -1):
        pas[i] = pas[i + 1] * tailles[i + 1]

    statuts = (charge.get("status") or {}) if isinstance(charge.get("status"), dict) else {}
    sorties = []
    for position, valeur in charge.get("value", {}).items():
        if valeur is None:
            continue
        reste = int(position)
        point = {}
        for i, nom in enumerate(ordre):
            point[nom] = categories[i][reste // pas[i]]
            reste %= pas[i]
        point["valeur"] = float(valeur)
        point["statut"] = statuts.get(str(position))
        sorties.append(point)
    return sorties
