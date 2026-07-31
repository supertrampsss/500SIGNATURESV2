import json
from pathlib import Path

from plateforme.connectors.jsonstat import decoder

FIXTURES = Path(__file__).parent / "fixtures"


def test_decode_la_fixture_eurostat_reelle():
    charge = json.load(open(FIXTURES / "eurostat_gov10dd_sample.json"))
    points = decoder(charge)
    assert len(points) == 1
    point = points[0]
    # dette publique française 2024 au sens de Maastricht, en % du PIB
    assert point["geo"] == "FR"
    assert point["time"] == "2024"
    assert point["na_item"] == "GD"
    assert point["valeur"] == 112.6


def test_la_position_lineaire_designe_le_bon_croisement():
    # Deux pays, trois années : une erreur d'ordre attribuerait les valeurs au
    # mauvais pays sans lever la moindre exception.
    charge = {
        "id": ["geo", "time"],
        "size": [2, 3],
        "dimension": {
            "geo": {"category": {"index": {"FR": 0, "DE": 1}}},
            "time": {"category": {"index": {"2022": 0, "2023": 1, "2024": 2}}},
        },
        "value": {"0": 1.0, "2": 3.0, "3": 10.0, "5": 30.0},
        "status": {"5": "p"},
    }
    points = {(p["geo"], p["time"]): p for p in decoder(charge)}
    assert points[("FR", "2022")]["valeur"] == 1.0
    assert points[("FR", "2024")]["valeur"] == 3.0
    assert points[("DE", "2022")]["valeur"] == 10.0
    assert points[("DE", "2024")]["valeur"] == 30.0
    # les valeurs absentes ne deviennent pas des zéros
    assert ("FR", "2023") not in points
    # le drapeau « provisoire » d'Eurostat est conservé
    assert points[("DE", "2024")]["statut"] == "p"
