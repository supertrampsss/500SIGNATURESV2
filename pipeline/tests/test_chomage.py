"""Le chômage est l'indicateur le plus lu : ses confusions se testent."""

from plateforme.normalize import chomage

SERIES = [
    {
        "attributs": {"REF_AREA": "D33", "CORRECTION": "CVS"},
        "observations": [
            {"periode": "2026-Q1", "valeur": 7.9, "statut": "SD"},
            {"periode": "2025-Q4", "valeur": 7.7, "statut": "A"},
        ],
    },
    {
        "attributs": {"REF_AREA": "R75"},
        "observations": [{"periode": "2025-Q4", "valeur": 7.2, "statut": "A"}],
    },
    {"attributs": {"REF_AREA": "D2A"}, "observations": [
        {"periode": "2025-Q4", "valeur": 6.5, "statut": "A"}]},
    # Agrégats qui ne couvrent pas le territoire national
    {"attributs": {"REF_AREA": "FM"}, "observations": [
        {"periode": "2025-Q4", "valeur": 7.4, "statut": "A"}]},
    {"attributs": {"REF_AREA": "FR-D976"}, "observations": [
        {"periode": "2025-Q4", "valeur": 7.5, "statut": "A"}]},
]


def test_les_codes_de_zone_deviennent_des_territoires():
    assert chomage.zone_vers_territoire("D33") == ("departement", "33")
    assert chomage.zone_vers_territoire("D2A") == ("departement", "2A")
    assert chomage.zone_vers_territoire("D971") == ("departement", "971")
    assert chomage.zone_vers_territoire("R75") == ("region", "75")


def test_la_france_metropolitaine_n_est_pas_la_france():
    """Ni « France métropolitaine » ni « France entière hors Mayotte » ne
    couvrent le territoire national : les ranger au niveau pays en ferait le
    chiffre France."""
    assert chomage.zone_vers_territoire("FM") is None
    assert chomage.zone_vers_territoire("FR-D976") is None
    niveaux = {ligne[1] for ligne in chomage.observations(SERIES)}
    assert niveaux == {"departement", "region"}


def test_une_valeur_semi_definitive_porte_son_drapeau():
    lignes = {(ligne[3], ligne[2]): ligne[5] for ligne in chomage.observations(SERIES)}
    assert lignes[("2026-Q1", "33")] == ["provisional"]
    assert lignes[("2025-Q4", "33")] == []


def test_toutes_les_observations_datees_sont_conservees():
    lignes = chomage.observations(SERIES)
    assert len(lignes) == 4  # 2 pour la Gironde, 1 pour l'Île-de-France, 1 pour la Corse
