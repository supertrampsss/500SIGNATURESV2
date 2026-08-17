"""Le rendement des retraites par génération : ce qui doit rester dit.

Ces quatre chiffres sortent d'un modèle, portent sur les seuls salariés du
privé et supposent la législation de 2014. Chacune de ces trois bornes, tue,
transformerait une projection en constat — et ce dépôt refuse cette confusion
partout ailleurs.
"""

import pytest

from plateforme import entrepot, registry
from plateforme.normalize import rendement_retraite as rendement


@pytest.fixture
def entrepot_neuf(tmp_path):
    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    registry.sync(conn)
    yield conn
    conn.close()


def test_la_graine_porte_les_huit_generations_de_l_annexe_1():
    lignes = rendement.lire()
    assert [ligne["generation"] for ligne in lignes] == [
        "1950", "1955", "1960", "1965", "1970", "1975", "1980", "1985",
    ]
    # Les deux bouts, tels que l'annexe 1 les publie.
    assert float(lignes[0]["taux_recuperation"]) == 158.57
    assert float(lignes[-1]["taux_recuperation"]) == 117.28


def test_le_taux_de_recuperation_decroit_de_generation_en_generation():
    """C'est le fait que l'étude établit, et le seul que la série raconte : une
    génération née en 1950 récupère nettement plus qu'une née en 1985. Une
    colonne mal recopiée casserait cette monotonie."""
    valeurs = [float(ligne["taux_recuperation"]) for ligne in rendement.lire()]
    # Décroissante jusqu'à 1980, avec un très léger redressement en 1985 que
    # l'étude publie telle quelle : la vérifier stricte serait faux.
    assert valeurs[0] > valeurs[3] > valeurs[6]
    assert all(valeur > 100 for valeur in valeurs), valeurs


def test_le_taux_de_prestation_n_est_pas_repris_et_c_est_une_decision():
    """L'annexe 1 porte un quatrième indicateur sous l'intitulé « TPR = TR × TP ».

    La ligne imprimée ne vérifie pas cette identité : pour 1950, TR × TP vaut
    37,71 quand la ligne affiche 42,87 — et 37,71 s'y trouve deux colonnes plus
    loin, systématiquement, sur six générations. C'est un défaut d'alignement,
    et ce dépôt ne corrige pas une source : il la cite ou il s'abstient.

    Ce contrôle existe pour que personne ne « complète » la graine plus tard
    sans rouvrir la question. C'est le contrôle d'identité, écrit d'abord, qui
    a fait tomber la première version de cette graine.
    """
    lignes = rendement.lire()
    assert "taux_prestation" not in lignes[0], lignes[0]
    assert not any("prestation" in identifiant for identifiant in rendement.INDICATEURS)
    # Et la raison est écrite là où on la cherchera : dans le module.
    source = (
        __import__("pathlib").Path(rendement.__file__).read_text(encoding="utf-8")
    )
    assert "42,87" in source and "37,71" in source


def test_le_chiffre_est_declare_modelise_et_non_observe(entrepot_neuf):
    """Un chiffre de microsimulation posé sans mention à côté d'un chiffre
    constaté est la confusion que ce dépôt refuse partout ailleurs."""
    rendement.declarer(entrepot_neuf)
    niveaux = entrepot_neuf.execute(
        "select distinct d.confidence_level from core.indicator_definitions d"
        " join core.indicators i using (definition_id)"
        " where i.indicator_id like 'insee_retraite_%'"
    ).fetchall()
    assert niveaux == [("estimated",)]


def test_les_trois_bornes_sont_dans_la_definition_technique(entrepot_neuf):
    """Le champ, la législation et le modèle. Sans le premier, le chiffre passe
    pour celui de tous les Français ; sans le deuxième, pour l'état du système
    après la réforme de 2023 ; sans le troisième, pour un constat."""
    rendement.declarer(entrepot_neuf)
    for (technique,) in entrepot_neuf.execute(
        "select d.technical_definition from core.indicator_definitions d"
        " join core.indicators i using (definition_id)"
        " where i.indicator_id like 'insee_retraite_%'"
    ).fetchall():
        assert "secteur privé" in technique, technique
        assert "2014" in technique, technique
        assert "Destinie 2" in technique, technique


def test_la_periode_est_une_generation_et_le_catalogue_le_dit(entrepot_neuf):
    """« 1950 » est une année de naissance. Lu comme un exercice, il ferait dire
    à la série que le rendement valait 158 % en 1950."""
    rendement.declarer(entrepot_neuf)
    granularites = entrepot_neuf.execute(
        "select distinct time_granularity from core.indicators"
        " where indicator_id like 'insee_retraite_%'"
    ).fetchall()
    assert granularites == [("generation",)]
    for (libelle,) in entrepot_neuf.execute(
        "select label_fr from core.indicators where indicator_id like 'insee_retraite_%'"
    ).fetchall():
        assert "génération" in libelle.lower(), libelle


def test_le_jeu_est_au_registre(entrepot_neuf):
    connu = entrepot_neuf.execute(
        "select count(*) from meta.dataset_registry where dataset_id = ?",
        (rendement.DATASET,),
    ).fetchone()[0]
    assert connu == 1
