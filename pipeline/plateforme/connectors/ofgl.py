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
from pathlib import Path
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

# Le catalogue complet des agrégats OFGL, et ceux qu'on charge.
#
# L'OFGL publie 72 agrégats selon la maille — 56 pour les communes, 68 pour les
# départements et les régions. Cinq étaient chargés, et ce choix n'était écrit
# nulle part : il vivait dans un dictionnaire de ce fichier, sans la liste de ce
# qu'il écartait ni le motif. On ne pouvait donc pas savoir, en lisant le code,
# que « Frais de personnel » existait et n'était pas pris.
#
# La sélection est désormais une donnée, pas un filtre caché :
# `infra/seed/ofgl_agregats.csv` liste **les 72**, avec pour chacun sa
# définition et sa formule comptable publiées par l'OFGL lui-même, le nombre de
# lignes qu'il coûte, et une colonne `charge` à oui/non. Ajouter un agrégat, c'est
# changer un mot dans ce fichier ; ce qui est écarté reste visible à côté de ce
# qui ne l'est pas.
#
# Mesuré le 4 août : un agrégat = 279 865 lignes communales (21 Mo de CSV) sur
# 2018-2025. Les 72 représentent 14,2 millions de lignes contre 2,3 millions
# aujourd'hui. Le plan Supabase gratuit plafonne à 500 Mo, la base en occupe 390 :
# tout charger n'y tient pas, et le garde-fou de volume refusera avant écriture.
# Le choix des agrégats est un arbitrage de plan, pas une préférence technique.
CATALOGUE = Path(__file__).resolve().parents[3] / "infra/seed/ofgl_agregats.csv"


def catalogue(chemin: Path | None = None) -> list[dict]:
    """Les 72 agrégats publiés par l'OFGL, chargés ou non."""
    with open(chemin or CATALOGUE, encoding="utf-8", newline="") as fichier:
        return list(csv.DictReader(fichier))


def agregats(chemin: Path | None = None) -> dict[str, str]:
    """Libellé OFGL -> identifiant, pour les seuls agrégats retenus.

    Le libellé OFGL est la clé de jointure du CSV d'export : il fait partie du
    contrat de source, on ne le normalise pas.
    """
    return {
        ligne["agregat"]: ligne["indicateur"]
        for ligne in catalogue(chemin)
        if ligne["charge"] == "oui"
    }


def agregats_du_niveau(niveau: str, chemin: Path | None = None) -> dict[str, str]:
    """Ceux d'entre eux que l'OFGL publie à cette maille.

    Les départements et les régions ont des agrégats que les communes n'ont pas
    — allocations RSA, APA, DMTO. Demander à l'export d'une maille un agrégat
    qu'elle ne connaît pas ne renvoie rien, mais fait porter à la requête un
    filtre faux ; on n'y met que ce qui existe.
    """
    return {
        ligne["agregat"]: ligne["indicateur"]
        for ligne in catalogue(chemin)
        if ligne["charge"] == "oui" and niveau in ligne["niveaux"].split(",")
    }


AGREGATS = agregats()


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
