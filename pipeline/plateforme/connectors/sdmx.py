"""Lecture des réponses SDMX-ML de la BDM (INSEE).

Deux pièges de la source, traités ici plutôt que dans chaque appelant :

1. **Séries arrêtées.** L'attribut `SERIE_ARRETEE` vaut `TRUE`, `FALSE` ou `SO`
   (sans objet). Une série arrêtée continue d'être servie et se termine
   silencieusement il y a des années : la publier reviendrait à afficher un
   chiffre périmé comme s'il était courant.
2. **Facteur d'échelle.** `UNIT_MULT` donne la puissance de dix à appliquer :
   ignorer ce champ décale les montants d'un facteur mille ou million.

Les séries sont sélectionnées par leurs attributs (secteur institutionnel,
unité…) et non par des identifiants opaques : le choix reste lisible et
vérifiable dans le code.
"""

import xml.etree.ElementTree as ET


def _fin(balise: str, nom: str) -> bool:
    return balise == nom or balise.endswith("}" + nom)


def series(contenu: bytes) -> list[dict]:
    """-> une entrée par série, avec ses attributs et ses observations."""
    racine = ET.fromstring(contenu)
    sorties = []
    for noeud in racine.iter():
        if not _fin(noeud.tag, "Series"):
            continue
        attributs = dict(noeud.attrib)
        facteur = 10 ** int(attributs.get("UNIT_MULT") or 0)
        observations = []
        for obs in noeud:
            if not _fin(obs.tag, "Obs"):
                continue
            valeur = obs.attrib.get("OBS_VALUE")
            if valeur in (None, ""):
                continue
            observations.append(
                {
                    "periode": obs.attrib["TIME_PERIOD"],
                    "valeur": float(valeur) * facteur,
                    "statut": obs.attrib.get("OBS_STATUS"),
                }
            )
        sorties.append({"attributs": attributs, "observations": observations})
    return sorties


def vivantes(entrees: list[dict]) -> list[dict]:
    """Écarte les séries que l'INSEE a cessé d'alimenter."""
    return [e for e in entrees if e["attributs"].get("SERIE_ARRETEE") != "TRUE"]


def choisir(entrees: list[dict], filtres: dict[str, str]) -> list[dict]:
    """Sélection par attributs, par exemple {"SECT-INST": "S13"}.

    Les noms sont ceux de la source, tels quels : certains portent un tiret
    (`SECT-INST`), d'autres un souligné (`UNIT_MEASURE`). Les réécrire
    mécaniquement casserait la sélection sans prévenir.
    """
    return [
        entree
        for entree in vivantes(entrees)
        if all(entree["attributs"].get(cle) == valeur for cle, valeur in filtres.items())
    ]
