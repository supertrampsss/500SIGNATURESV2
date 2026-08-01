"""Melodi (INSEE) — lecture paginée et prudente des observations.

Melodi diffuse en JSON, sans clé. Deux caractéristiques commandent ce module :

1. **Un jeu couvre tous les zonages à la fois.** Une même requête renvoie des
   communes, des EPCI, des zones d'emploi, des aires d'attraction, des unités
   urbaines. Le préfixe du code `GEO` dit lequel : `2025-COM-33318`. Filtrer
   après coup est plus sûr que d'espérer un filtre serveur qui n'existe pas.
2. **Une mesure sans valeur n'est pas une mesure à zéro.** L'INSEE ne diffuse
   pas tout à toutes les échelles : sur une commune, la médiane du niveau de vie
   et le taux de pauvreté sont publiés, les déciles ne le sont pas. Le JSON rend
   alors `{"OBS_VALUE_NIVEAU": {}}` — un objet vide. Le confondre avec un zéro
   ferait apparaître des communes à revenu nul.

La pagination ne dit ni le total ni la page suivante : on avance jusqu'à ce
qu'une page revienne plus courte que demandé.
"""

from plateforme.connectors.insee import MELODI_BASE, clean_geo
from plateforme.http import fetch

# Préfixes de zonage Melodi -> niveaux du référentiel. Les zonages d'étude
# (aires d'attraction, zones d'emploi, bassins de vie) n'ont pas d'équivalent
# institutionnel : ils sont volontairement absents.
NIVEAUX = {
    "COM": "commune",
    "EPCI": "epci",
    "DEP": "departement",
    "REG": "region",
}

PAGE = 10_000
PAGES_MAX = 40  # garde-fou : 400 000 observations, très au-delà d'un jeu communal


def pages(dataset: str, params: dict, page_max: int = PAGES_MAX) -> list[dict]:
    """Toutes les observations d'une requête, page après page.

    Melodi ne publie ni compteur ni lien « suivant » : la fin se reconnaît à une
    page plus courte que demandée. Le garde-fou existe pour qu'une évolution de
    l'API ne se traduise pas par une boucle sans fin.
    """
    observations: list[dict] = []
    for page in range(1, page_max + 1):
        requete = "&".join(f"{cle}={valeur}" for cle, valeur in params.items())
        url = f"{MELODI_BASE}/data/{dataset}?{requete}&maxResult={PAGE}&page={page}"
        lot = fetch(url, timeout=300).json().get("observations", [])
        observations.extend(lot)
        if len(lot) < PAGE:
            return observations
    raise ValueError(f"{dataset} : plus de {page_max} pages, pagination suspecte")


def valeurs(observations: list[dict], niveaux: set[str] | None = None) -> list[dict]:
    """-> [{niveau, code, periode, valeur}] pour les seules observations diffusées.

    Les zonages sans équivalent institutionnel et les mesures non diffusées sont
    écartés ici plutôt que plus loin : une valeur absente doit disparaître avant
    de pouvoir être prise pour un zéro.
    """
    retenus = niveaux or set(NIVEAUX.values())
    lignes = []
    for observation in observations:
        dimensions = observation.get("dimensions", {})
        brut = dimensions.get("GEO", "")
        morceaux = brut.split("-")
        niveau = NIVEAUX.get(morceaux[1]) if len(morceaux) > 2 else None
        if niveau is None or niveau not in retenus:
            continue
        valeur = (observation.get("measures", {}).get("OBS_VALUE_NIVEAU") or {}).get("value")
        if valeur is None:
            continue
        lignes.append(
            {
                "niveau": niveau,
                "code": clean_geo(brut),
                "periode": dimensions.get("TIME_PERIOD"),
                "valeur": float(valeur),
            }
        )
    return lignes
