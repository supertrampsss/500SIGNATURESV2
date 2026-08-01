"""Dotations de l'État aux communes (DGCL, diffusé par l'OFGL).

C'est le chaînon qui manquait entre le budget de l'État et celui d'une commune :
l'État inscrit 46 Md€ de « prélèvement sur recettes au profit des collectivités
territoriales », et ce jeu dit combien chaque commune en reçoit au titre de la
dotation globale de fonctionnement.

**La DGF n'est pas tout ce que l'État verse.** Le prélèvement sur recettes
couvre aussi le FCTVA et diverses compensations d'exonérations ; la DGF en est
la part principale, pas la totalité. L'inégalité DGF < prélèvement est d'ailleurs
le contrôle qui relie les deux sources (`normalize/dotations.py`).

Le jeu est en **format long** : une ligne par (commune, exercice, variable), et
il mélange les montants avec les critères qui servent à les calculer — potentiel
fiscal, effort fiscal, éligibilités. 28,7 millions de lignes au total, dont
seules quatre variables portent les montants de la DGF.

Piège de la source : `exercice` est de type **date**, pas texte — un filtre
`exercice = "2025"` est rejeté par le moteur, il faut `year(exercice) = 2025`.
"""

import csv
import io
from urllib.parse import quote

BASE = "https://data.ofgl.fr/api/explore/v2.1/catalog/datasets"
JEU = "dotations-communes"

# Les quatre composantes de la DGF communale : la part forfaitaire et les trois
# dotations de péréquation. Leur somme est la DGF de la commune.
COMPOSANTES = {
    "Montant Dotation forfaitaire": "forfaitaire",
    "Montant Dotation DSU": "dsu",
    "Montant Dotation DSR": "dsr",
    "Montant Dotation DNP": "dnp",
}


def url_export(exercice: int) -> str:
    """Export CSV filtré : quatre variables sur les cent-et-quelques du jeu."""
    variables = ",".join(f'"{v}"' for v in COMPOSANTES)
    ou = f"year(exercice)={exercice} and variable in ({variables})"
    select = "exercice,code_insee,variable,valeur,unite"
    return (
        f"{BASE}/{JEU}/exports/csv?select={quote(select)}&where={quote(ou)}"
        "&limit=-1&delimiter=%3B"
    )


def lire(contenu: bytes) -> list[dict]:
    """CSV long -> lignes {code, exercice, composante, montant}.

    Une valeur absente n'est pas un zéro : une commune non éligible à la DSU n'a
    tout simplement pas de ligne DSU, et lui en inventer une à 0 € serait exact
    ici mais faux dès qu'une donnée manquante ressemblerait à une non-éligibilité.
    """
    texte = contenu.decode("utf-8-sig")
    lignes = []
    for ligne in csv.DictReader(io.StringIO(texte), delimiter=";"):
        composante = COMPOSANTES.get((ligne.get("variable") or "").strip())
        code = (ligne.get("code_insee") or "").strip()
        brut = (ligne.get("valeur") or "").strip()
        if not composante or not code or not brut:
            continue
        if (ligne.get("unite") or "").strip() != "euros":
            continue  # une composante changeant d'unité doit être vue, pas convertie
        lignes.append(
            {
                "code": code,
                "exercice": (ligne.get("exercice") or "")[:4],
                "composante": composante,
                "montant": float(brut),
            }
        )
    return lignes


def dgf(lignes: list[dict]) -> dict[tuple[str, str], float]:
    """{(code commune, exercice): DGF totale}. La somme des composantes présentes
    — une commune sans DSU reçoit une DGF sans DSU, ce n'est pas une lacune."""
    totaux: dict[tuple[str, str], float] = {}
    for ligne in lignes:
        cle = (ligne["code"], ligne["exercice"])
        totaux[cle] = totaux.get(cle, 0.0) + ligne["montant"]
    return totaux
