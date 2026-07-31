"""Connecteur OFGL — finances des collectivités locales (T-12).

La base « consolidée » est retenue plutôt que la base simple : elle rattache
l'historique à la géographie courante (vérifié sur 2018-2025, aucun code absent
du COG 2025) et consolide budgets principaux et annexes. Les séries sont donc
comparables d'une année à l'autre sans table de passage.

PIÈGE : la consolidation porte sur la géographie, pas sur les montants. Pour une
commune nouvelle, chaque commune d'origine garde sa ligne (son SIREN) sous le
code de la commune actuelle. Exemple réel : Saint-Jean-d'Hermine (85223), créée
en 2025, a deux lignes par agrégat de 2018 à 2024 — Sainte-Hermine et
Saint-Jean-de-Beugné. Publier une seule de ces lignes reviendrait à annoncer la
moitié de la dette. Les montants doivent donc être sommés par territoire et
exercice, et la population sommée sur les SIREN distincts.

Format long : une ligne par (territoire, exercice, agrégat, budget). Les
extractions passent par l'export filtré, jamais par la pagination de /records —
13,6 millions de lignes pour les seules communes.
"""

import csv
import io
from urllib.parse import quote

BASE = "https://data.ofgl.fr/api/explore/v2.1/catalog/datasets"

# Un jeu par niveau institutionnel, avec le nom de sa colonne de code.
NIVEAUX = {
    "commune": ("ofgl-base-communes-consolidee", "com_code"),
    "epci": ("ofgl-base-gfp-consolidee", "epci_code"),
    "departement": ("ofgl-base-departements-consolidee", "dep_code"),
    "region": ("ofgl-base-regions-consolidee", "reg_code"),
}

# Agrégats retenus : ceux qui répondent aux questions de la fiche territoire.
# Le libellé OFGL est la clé de jointure — il fait partie du contrat de source.
AGREGATS = {
    "Dépenses de fonctionnement": "ofgl_depenses_fonctionnement",
    "Recettes de fonctionnement": "ofgl_recettes_fonctionnement",
    "Dépenses d'investissement": "ofgl_depenses_investissement",
    "Epargne brute": "ofgl_epargne_brute",
    "Encours de dette": "ofgl_encours_dette",
}


def url_export(niveau: str, agregats: list[str]) -> str:
    """Export CSV filtré sur les agrégats retenus, tous exercices confondus."""
    jeu, colonne_code = NIVEAUX[niveau]
    liste = ", ".join(f'"{a}"' for a in agregats)
    where = quote(f"agregat in ({liste})")
    # siren identifie le budget d'origine : indispensable pour ne compter la
    # population qu'une fois par entité (voir docstring du module).
    select = quote(f"exer,{colonne_code},siren,agregat,montant,ptot")
    return f"{BASE}/{jeu}/exports/csv?select={select}&where={where}&limit=-1"


def lire(contenu: bytes, niveau: str) -> list[dict]:
    """CSV OFGL (séparateur ';', BOM) -> lignes normalisées.

    Les lignes sans montant sont écartées : OFGL ne distingue pas un budget
    absent d'un montant nul, on ne peut donc pas les publier comme des zéros.
    """
    _, colonne_code = NIVEAUX[niveau]
    lecteur = csv.DictReader(
        io.StringIO(contenu.decode("utf-8-sig")), delimiter=";"
    )
    sortie = []
    for ligne in lecteur:
        code, montant = ligne[colonne_code], ligne["montant"]
        if not code or not montant:
            continue
        sortie.append(
            {
                "indicator_id": AGREGATS[ligne["agregat"]],
                "geo_level": niveau,
                "geo_code": code,
                "period": ligne["exer"],
                "value": float(montant),
                "population": int(ligne["ptot"]) if ligne["ptot"] else None,
                "budget": ligne.get("siren") or code,
            }
        )
    return sortie
