"""Connecteur COG — Code officiel géographique de l'INSEE (T-11).

L'API métadonnées de l'INSEE donne l'état courant ; les **fichiers CSV** du COG
donnent en plus l'historique complet des mouvements territoriaux depuis 1943,
indispensable pour comparer des séries communales entre millésimes
(docs/00, principe 6). C'est donc eux qu'on ingère.

L'identifiant de publication INSEE change à chaque millésime : il est stocké
dans `meta.dataset_registry.external_id`, pas en dur ici.
"""

import csv
import io

BASE = "https://www.insee.fr/fr/statistiques/fichier"

# Communes déléguées/associées : sous-entités d'une commune, jamais des
# territoires autonomes — hors référentiel (leur commune parente les porte).
NIVEAUX_RETENUS = {"COM", "ARM"}

# Codes MOD de l'INSEE -> types d'événements du modèle (docs/02 §B).
# Seuls les mouvements qui déplacent réellement un périmètre sont retenus :
# les changements de statut de commune déléguée/associée (34, 35, 70, 71)
# n'en sont pas, et les changements de nom (10) se lisent dans le référentiel.
EVENEMENTS = {
    "20": "creation",
    "21": "scission",  # rétablissement d'une commune détachée
    "30": "suppression",
    "31": "fusion",  # fusion simple
    "32": "fusion",  # création de commune nouvelle
    "33": "fusion",  # fusion-association
    "41": "changement_code",  # changement de département
    "50": "changement_code",  # transfert de chef-lieu
}


def url_fichier(publication_id: str, nom: str) -> str:
    """publication_id = identifiant INSEE du millésime (external_id du registre)."""
    return f"{BASE}/{publication_id}/{nom}"


def lire_csv(contenu: bytes) -> list[dict]:
    return list(csv.DictReader(io.StringIO(contenu.decode("utf-8-sig"))))


def territoires(lignes: list[dict], millesime: int) -> list[dict]:
    """Lignes de v_commune_<millésime>.csv -> communes et arrondissements municipaux."""
    sortie = []
    for ligne in lignes:
        type_com = ligne["TYPECOM"]
        if type_com not in NIVEAUX_RETENUS:
            continue
        arrondissement = type_com == "ARM"
        sortie.append(
            {
                "geo_level": "arrondissement_municipal" if arrondissement else "commune",
                "geo_code": ligne["COM"],
                "vintage": millesime,
                "name": ligne["LIBELLE"],
                "parent_level": "commune" if arrondissement else "departement",
                "parent_code": ligne["COMPARENT"] if arrondissement else ligne["DEP"],
            }
        )
    return sortie


def _millesimes(date_effet: str) -> tuple[int, int]:
    """'2016-01-01' -> (2015, 2016) : le mouvement sépare deux millésimes du COG."""
    annee = int(date_effet[:4])
    return annee - 1, annee


def mouvements(lignes: list[dict]) -> list[dict]:
    """Lignes de v_mvt_commune_<millésime>.csv -> événements territoriaux.

    Les lignes où le code est inchangé sont écartées : ce sont les communes
    survivantes d'une fusion, qui ne demandent aucun passage.
    """
    sortie = []
    for ligne in lignes:
        type_evenement = EVENEMENTS.get(ligne["MOD"])
        if type_evenement is None:
            continue
        if ligne["TYPECOM_AV"] not in NIVEAUX_RETENUS or ligne["TYPECOM_AP"] not in NIVEAUX_RETENUS:
            continue
        if ligne["COM_AV"] == ligne["COM_AP"]:
            continue
        avant, apres = _millesimes(ligne["DATE_EFF"])
        niveau = lambda t: "arrondissement_municipal" if t == "ARM" else "commune"  # noqa: E731
        sortie.append(
            {
                "event_type": type_evenement,
                "event_date": ligne["DATE_EFF"],
                "from_level": niveau(ligne["TYPECOM_AV"]),
                "from_code": ligne["COM_AV"],
                "from_vintage": avant,
                "to_level": niveau(ligne["TYPECOM_AP"]),
                "to_code": ligne["COM_AP"],
                "to_vintage": apres,
            }
        )
    return sortie


def parts_de_scission(evenements: list[dict], populations: dict[str, int]) -> list[dict]:
    """Renseigne population_share pour les scissions : un territoire d'origine se
    répartit entre plusieurs successeurs, au prorata de leur population actuelle.

    Méthode approchée et documentée (docs/06) : la population d'aujourd'hui n'est
    pas celle de l'année du mouvement. Quand la population d'un successeur est
    inconnue (commune disparue depuis), le partage est égal entre successeurs —
    la part reste toujours strictement positive. Les fusions gardent une part
    de 1 : l'intégralité du territoire absorbé rejoint le survivant, sans
    approximation.
    """
    groupes: dict[tuple, list[dict]] = {}
    for evenement in evenements:
        if evenement["event_type"] != "scission":
            continue
        groupes.setdefault((evenement["from_code"], evenement["event_date"]), []).append(evenement)

    for membres in groupes.values():
        parts = [populations.get(e["to_code"], 0) for e in membres]
        total = sum(parts)
        connues = all(part > 0 for part in parts)
        for evenement, part in zip(membres, parts, strict=True):
            evenement["population_share"] = round(
                part / total if connues else 1 / len(membres), 6
            )
    return evenements
