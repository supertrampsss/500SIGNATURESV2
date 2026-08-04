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
# Critères de comparaison publiés par l'OFGL lui-même. Les reprendre plutôt que
# d'inventer nos propres strates rend le groupe de comparaison vérifiable : il
# repose sur une classification officielle, pas sur un découpage maison.
CRITERES = [
    "tranche_population",
    "rural",
    "montagne",
    "touristique",
    "outre_mer",
    "qpv",
    "tranche_revenu_imposable_par_habitant",
]

# L'OFGL publie 56 agrégats par territoire et exercice. Les cinq premiers
# ci-dessous ont longtemps été les seuls chargés : la fiche ne pouvait donc pas
# répondre à « quelle part du budget part en salaires ? » ni à « combien coûtent
# les intérêts de la dette locale ? », faute d'une donnée pourtant publiée au
# même endroit, dans le même fichier, sans surcoût d'extraction.
#
# Les trois suivants ouvrent ces questions. Chacun coûte environ 280 000 lignes
# par exercice pour les seules communes : c'est le garde-fou de volume
# (plateforme.limites) qui refusera le chargement si la marge Supabase n'y
# suffit pas, avant toute écriture — pas une estimation faite ici.
AGREGATS = {
    "Dépenses de fonctionnement": "ofgl_depenses_fonctionnement",
    "Recettes de fonctionnement": "ofgl_recettes_fonctionnement",
    "Dépenses d'investissement": "ofgl_depenses_investissement",
    "Epargne brute": "ofgl_epargne_brute",
    "Encours de dette": "ofgl_encours_dette",
    "Frais de personnel": "ofgl_frais_personnel",
    "Charges financières": "ofgl_charges_financieres",
    "Epargne nette": "ofgl_epargne_nette",
}


def url_export(niveau: str, agregats: list[str]) -> str:
    """Export CSV filtré sur les agrégats retenus, tous exercices confondus."""
    jeu, colonne_code = NIVEAUX[niveau]
    liste = ", ".join(f'"{a}"' for a in agregats)
    where = quote(f"agregat in ({liste})")
    # siren identifie le budget d'origine : indispensable pour ne compter la
    # population qu'une fois par entité (voir docstring du module).
    colonnes = f"exer,{colonne_code},siren,agregat,montant,ptot"
    if niveau == "commune":
        colonnes += "," + ",".join(CRITERES)
    return f"{BASE}/{jeu}/exports/csv?select={quote(colonnes)}&where={where}&limit=-1"


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
                "criteres": {
                    critere: ligne[critere]
                    for critere in CRITERES
                    if ligne.get(critere) not in (None, "")
                },
            }
        )
    return sortie
