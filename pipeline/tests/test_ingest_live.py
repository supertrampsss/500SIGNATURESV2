"""Smoke réseau de bout en bout (registre -> connecteur -> snapshot -> lineage).

Exécuté seulement avec PLATEFORME_TEST_NETWORK=1 et PLATEFORME_TEST_DB définis,
sur une base où migrations ET seed sont appliqués. Jamais en CI (hermétique).
"""

import os

import pytest

pytestmark = pytest.mark.skipif(
    not (os.environ.get("PLATEFORME_TEST_NETWORK") and os.environ.get("PLATEFORME_TEST_DB")),
    reason="smoke réseau désactivé",
)


@pytest.mark.parametrize(
    ("dataset_id", "params"),
    [
        ("datagouv-catalogue", None),
        ("eurostat-gov-10dd-edpt1",
         {"geo": "FR", "time": "2024", "na_item": "GD", "sector": "S13", "unit": "PC_GDP"}),
        ("melodi-filosofi-cc", {"GEO": "COM-33318", "maxResult": "20"}),
        ("bdm-dette-trim", None),
    ],
)
def test_ingest_smoke(dataset_id, params, tmp_path, monkeypatch):
    from plateforme.ingest import run

    monkeypatch.setenv("PLATEFORME_ENTREPOT", str(tmp_path / "entrepot.duckdb"))
    assert run(dataset_id, params, str(tmp_path), "manual") == 0
    # Rejouer immédiatement : sources JSON stables => court-circuité (hash identique).
    # BDM insère un horodatage <message:Prepared> dans chaque réponse : nouveau
    # snapshot à chaque appel — normalisation du hash à traiter au ticket T-15.
    assert run(dataset_id, params, str(tmp_path), "manual") == 0
