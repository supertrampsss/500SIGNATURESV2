"""Lecture Melodi : ce qui n'est pas diffusé ne doit jamais devenir un zéro."""

from plateforme.connectors import melodi

OBSERVATIONS = [
    # Commune avec valeur
    {
        "dimensions": {"GEO": "2025-COM-33318", "TIME_PERIOD": "2023"},
        "measures": {"OBS_VALUE_NIVEAU": {"value": 28840.0}},
    },
    # Commune sous secret statistique : l'observation existe, la valeur est vide
    {
        "dimensions": {"GEO": "2025-COM-21055", "TIME_PERIOD": "2023"},
        "measures": {"OBS_VALUE_NIVEAU": {}},
    },
    # Zonage d'étude sans équivalent institutionnel
    {
        "dimensions": {"GEO": "2025-AAV2020-256", "TIME_PERIOD": "2023"},
        "measures": {"OBS_VALUE_NIVEAU": {"value": 19710.0}},
    },
    {
        "dimensions": {"GEO": "2025-DEP-33", "TIME_PERIOD": "2023"},
        "measures": {"OBS_VALUE_NIVEAU": {"value": 23500.0}},
    },
]


def test_une_valeur_non_diffusee_disparait_au_lieu_de_valoir_zero():
    lignes = melodi.valeurs(OBSERVATIONS)
    codes = {ligne["code"] for ligne in lignes}
    assert "21055" not in codes
    assert not any(ligne["valeur"] == 0 for ligne in lignes)


def test_les_zonages_d_etude_sont_ecartes():
    """Aires d'attraction, zones d'emploi, bassins de vie : pas de territoire
    institutionnel correspondant, donc rien à quoi rattacher l'observation."""
    lignes = melodi.valeurs(OBSERVATIONS)
    assert {ligne["niveau"] for ligne in lignes} == {"commune", "departement"}


def test_le_prefixe_de_millesime_est_retire_du_code():
    lignes = melodi.valeurs(OBSERVATIONS)
    assert {ligne["code"] for ligne in lignes} == {"33318", "33"}


def test_le_filtre_de_niveau_est_respecte():
    lignes = melodi.valeurs(OBSERVATIONS, niveaux={"commune"})
    assert [ligne["code"] for ligne in lignes] == ["33318"]
