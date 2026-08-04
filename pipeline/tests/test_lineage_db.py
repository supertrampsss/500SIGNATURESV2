"""Test d'intégration lineage <-> base (exécuté quand PLATEFORME_TEST_DB est défini :
en CI dans le job `database`, en local contre un PostGIS où les migrations et le
seed sont appliqués)."""

import json
import uuid

import pytest

from plateforme import entrepot, registry



@pytest.fixture
def conn(tmp_path):
    from plateforme import entrepot

    connection = entrepot.connect(tmp_path / "entrepot.duckdb")
    registry.sync(connection)
    yield connection
    connection.close()


@pytest.fixture
def dataset_id(conn):
    source = f"test-src-{uuid.uuid4().hex[:8]}"
    dataset = f"test-ds-{uuid.uuid4().hex[:8]}"
    conn.execute(
        "insert into meta.source_registry (source_id, name, producer, access_category, license)"
        " values (?, 'Test', 'Test', 'A', 'LO2.0')",
        (source,),
    )
    conn.execute(
        "insert into meta.dataset_registry (dataset_id, source_id, title, priority)"
        " values (?, ?, 'Jeu de test lineage', 'P3')",
        (dataset, source),
    )
    conn.commit()
    yield dataset
    entrepot.annuler(conn)  # au cas où un test a laissé une transaction avortée
    conn.execute("delete from meta.raw_assets where dataset_id = ?", (dataset,))
    conn.execute("delete from meta.ingestion_runs where dataset_id = ?", (dataset,))
    conn.execute("delete from meta.dataset_registry where dataset_id = ?", (dataset,))
    conn.execute("delete from meta.source_registry where source_id = ?", (source,))
    conn.commit()


def test_snapshot_lineage_and_change_detection(conn, dataset_id, tmp_path):
    from plateforme import entrepot
    from plateforme.store import LocalStore

    store = LocalStore(tmp_path)
    run_id = entrepot.start_run(conn, dataset_id)

    first = entrepot.record_asset(
        conn, store, run_id, dataset_id, "test-src", "data.json", b'{"a": 1}', "http://example"
    )
    assert not first.unchanged and first.asset_id is not None
    assert store.get(first.key) == b'{"a": 1}'

    # même contenu => détection d'inchangé, aucun nouveau fichier écrit
    second = entrepot.record_asset(
        conn, store, run_id, dataset_id, "test-src", "data.json", b'{"a": 1}', "http://example"
    )
    assert second.unchanged and second.asset_id is None

    entrepot.finish_run(conn, run_id, "success", rows_written=1)
    status, rows = conn.execute(
        "select status, rows_written from meta.ingestion_runs where run_id = ?", (run_id,)
    ).fetchone()
    assert status == "success" and rows == 1


def test_failed_run_is_traced(conn, dataset_id):
    from plateforme import entrepot

    run_id = entrepot.start_run(conn, dataset_id)
    entrepot.finish_run(conn, run_id, "failed", error="HTTP 503")
    status, details = conn.execute(
        "select status, error_details from meta.ingestion_runs where run_id = ?", (run_id,)
    ).fetchone()
    assert status == "failed" and json.loads(details)["message"] == "HTTP 503"
