import json
from pathlib import Path

from plateforme.connectors import datagouv, eurostat, insee, ods

FIXTURES = Path(__file__).parent / "fixtures"


def load(name: str):
    return json.loads((FIXTURES / name).read_text())


def test_datagouv_resources():
    dataset = load("datagouv_dataset_sample.json")
    resources = datagouv.list_resources(dataset)
    assert resources and resources[0]["id"] and resources[0]["url"]
    # sérialisation stable : même contenu => même snapshot => détection d'inchangé
    assert datagouv.snapshot_payload(dataset) == datagouv.snapshot_payload(dataset)


def test_ods_urls_and_parsing():
    base = "https://data.ofgl.fr/api/explore/v2.1"
    assert ods.records_url(base, "rei", {"limit": 1}).endswith("/datasets/rei/records?limit=1")
    assert ods.export_url(base, "rei", "parquet").endswith("/datasets/rei/exports/parquet")
    total, results = ods.parse_records(load("ods_records_sample.json"))
    assert total > 0 and len(results) == 2


def test_melodi_observations_and_geo_prefix():
    payload = load("melodi_filosofi_sample.json")
    observations = insee.melodi_observations(payload)
    assert observations
    raw_geo = observations[0]["dimensions"]["GEO"]
    assert insee.clean_geo(raw_geo) == "33318"  # piège du préfixe millésime (docs/01)
    assert insee.clean_geo("33318") == "33318"


def test_bdm_fixture_is_sdmx():
    content = (FIXTURES / "bdm_series_sample.xml").read_bytes()
    assert b"StructureSpecificData" in content


def test_eurostat_first_value():
    payload = load("eurostat_gov10dd_sample.json")
    assert payload["class"] == "dataset"
    value = eurostat.first_value(payload)
    assert value is not None and value > 0
