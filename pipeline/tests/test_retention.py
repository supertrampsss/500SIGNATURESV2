"""La rétention supprime des données publiées : ses gardes-fous se testent.

Ces tests n'ouvrent pas de connexion — ils vérifient la logique de sélection
des exercices sur une base simulée, parce que la conséquence d'une erreur ici
est une perte de données, pas un affichage bancal.
"""

import pytest

from plateforme import retention


class ConnexionSimulee:
    """Rend les périodes déclarées, quel que soit le niveau demandé."""

    def __init__(self, periodes: dict[str, list[str]]):
        self.periodes = periodes

    def execute(self, requete: str, parametres=None):
        niveau = parametres[0]
        return [(p,) for p in sorted(self.periodes.get(niveau, []))]


def test_seuls_les_exercices_anterieurs_a_la_borne_partent():
    conn = ConnexionSimulee({"commune": ["2016", "2017", "2018", "2019", "2020", "2021"]})
    assert retention.a_supprimer(conn) == {"commune": ["2016", "2017"]}


def test_une_retention_deja_respectee_ne_supprime_rien():
    conn = ConnexionSimulee({"commune": ["2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025"]})
    assert retention.a_supprimer(conn) == {}


def test_les_niveaux_non_nommes_ne_sont_jamais_touches():
    """Un oubli dans la politique ne doit pas effacer un niveau entier."""
    assert set(retention.RETENTION) == {"commune"}
    conn = ConnexionSimulee(
        {"commune": ["2018", "2019"], "departement": ["2015", "2016", "2017"]}
    )
    assert "departement" not in retention.a_supprimer(conn)


def test_refus_de_reduire_une_serie_a_moins_de_deux_points():
    """Une série d'un seul exercice n'a plus d'évolution à montrer : mieux vaut
    échouer bruyamment que publier une courbe d'un point."""
    conn = ConnexionSimulee({"commune": ["2016", "2017", "2018"]})
    with pytest.raises(ValueError, match="évolution"):
        retention.a_supprimer(conn)
