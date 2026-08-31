"""Contrat de registre pour les cinq analyses editoriales V3."""

import csv
from collections import Counter
from pathlib import Path

from plateforme import entrepot, registry


ROOT = Path(__file__).resolve().parents[2]
SOURCE_REGISTRY = ROOT / "infra/seed/source_registry.csv"
DATASET_REGISTRY = ROOT / "infra/seed/dataset_registry.csv"

REQUIRED_EXTERNAL_IDS = {
    "eurostat-nrg-pc-202": "nrg_pc_202",
    "eurostat-nrg-pc-204": "nrg_pc_204",
    "rte-bilan-electrique-2024-echanges": "bilan-electrique-2024-echanges",
    "rte-bilan-electrique-2025-echanges": "bilan-electrique-2025-echanges",
    "cre-trve": "tarifs-reglementes-vente-electricite",
    "cre-arenh": "acces-regule-electricite-nucleaire-historique",
    "bdm-fournitures-001765036": "001765036",
    "bdm-ipc-ensemble-001764363": "001764363",
    "bdm-gaz-menages-011815828": "011815828",
    "cre-prvg-open-data": "prix-repere-vente-gaz",
    "cre-gaz-supply-reference": "reference-couts-approvisionnement-gaz",
    "insee-enl-2002": "1376575",
    "insee-enl-2013-primo-age": "7765775",
    "insee-hvp-2017-2018": "5371267",
    "melodi-srcv-satisfaction": "DS_SRCV_SATISFACTION",
}


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def _duplicates(values: list[str]) -> set[str]:
    return {value for value, count in Counter(values).items() if count > 1}


def test_analysis_rows_are_unique_complete_and_source_backed():
    sources = _read_csv(SOURCE_REGISTRY)
    datasets = _read_csv(DATASET_REGISTRY)

    assert _duplicates([row["source_id"] for row in sources]) == set()
    assert _duplicates([row["dataset_id"] for row in datasets]) == set()

    sources_by_id = {row["source_id"]: row for row in sources}
    datasets_by_id = {row["dataset_id"]: row for row in datasets}

    assert REQUIRED_EXTERNAL_IDS.keys() <= datasets_by_id.keys()
    assert {row["source_id"] for row in datasets} <= sources_by_id.keys()
    for dataset_id, external_id in REQUIRED_EXTERNAL_IDS.items():
        row = datasets_by_id[dataset_id]
        assert row["external_id"] == external_id
        assert row["endpoint_url"].startswith("https://")
        assert row["format"]
        assert row["update_frequency"]
        assert row["ingestion_mode"]
        assert row["target_tables"]

    assert {
        datasets_by_id[dataset_id]["source_id"]
        for dataset_id in REQUIRED_EXTERNAL_IDS
    } == {"cre", "eurostat", "insee-bdm", "insee-fichiers", "insee-melodi", "rte"}


def test_housing_publications_are_separate_and_exclude_unverified_2006_point():
    datasets = _read_csv(DATASET_REGISTRY)
    housing = {
        row["dataset_id"]: row
        for row in datasets
        if row["dataset_id"].startswith("insee-enl-")
        or row["dataset_id"].startswith("insee-hvp-")
    }

    assert set(housing) == {
        "insee-enl-2002",
        "insee-enl-2013-primo-age",
        "insee-hvp-2017-2018",
    }
    assert all("2006" not in " ".join(row.values()).lower() for row in housing.values())
    assert len({row["external_id"] for row in housing.values()}) == len(housing)


def test_electricity_claim_uses_french_primary_sources_without_api_secret():
    sources = {row["source_id"]: row for row in _read_csv(SOURCE_REGISTRY)}

    assert sources["rte"]["producer"] == "RTE"
    assert sources["cre"]["producer"] == "Commission de regulation de l'energie"
    assert sources["rte"]["auth_mode"] == ""
    assert sources["cre"]["auth_mode"] == ""


def test_registry_sync_resolves_analysis_ids_and_preserves_asset_lineage(tmp_path):
    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    try:
        first_counts = registry.sync(conn)
        assert registry.sync(conn) == first_counts

        placeholders = ",".join("?" for _ in REQUIRED_EXTERNAL_IDS)
        resolved = {
            row[0]
            for row in conn.execute(
                f"select dataset_id from meta.dataset_registry where dataset_id in ({placeholders})",
                list(REQUIRED_EXTERNAL_IDS),
            ).fetchall()
        }
        assert resolved == set(REQUIRED_EXTERNAL_IDS)

        orphan_datasets = conn.execute(
            """
            select count(*)
            from meta.dataset_registry d
            left join meta.source_registry s using (source_id)
            where s.source_id is null
            """
        ).fetchone()[0]
        orphan_assets = conn.execute(
            """
            select count(*)
            from meta.raw_assets a
            left join meta.dataset_registry d using (dataset_id)
            where d.dataset_id is null
            """
        ).fetchone()[0]
        assert orphan_datasets == 0
        assert orphan_assets == 0
    finally:
        conn.close()
