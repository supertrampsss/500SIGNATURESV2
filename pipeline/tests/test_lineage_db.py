"""Test d'intégration lineage <-> base (exécuté quand PLATEFORME_TEST_DB est défini :
en CI dans le job `database`, en local contre un PostGIS où les migrations et le
seed sont appliqués)."""

import os
import uuid

import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("PLATEFORME_TEST_DB"), reason="PLATEFORME_TEST_DB non défini"
)


@pytest.fixture
def conn():
    from plateforme import db

    connection = db.connect(os.environ["PLATEFORME_TEST_DB"])
    yield connection
    connection.close()


@pytest.fixture
def dataset_id(conn):
    source = f"test-src-{uuid.uuid4().hex[:8]}"
    dataset = f"test-ds-{uuid.uuid4().hex[:8]}"
    conn.execute(
        "insert into meta.source_registry (source_id, name, producer, access_category, license)"
        " values (%s, 'Test', 'Test', 'A', 'LO2.0')",
        (source,),
    )
    conn.execute(
        "insert into meta.dataset_registry (dataset_id, source_id, title, priority)"
        " values (%s, %s, 'Jeu de test lineage', 'P3')",
        (dataset, source),
    )
    conn.commit()
    yield dataset
    conn.rollback()  # au cas où un test a laissé une transaction avortée
    conn.execute("delete from meta.raw_assets where dataset_id = %s", (dataset,))
    conn.execute("delete from meta.ingestion_runs where dataset_id = %s", (dataset,))
    conn.execute("delete from meta.dataset_registry where dataset_id = %s", (dataset,))
    conn.execute("delete from meta.source_registry where source_id = %s", (source,))
    conn.commit()


def test_snapshot_lineage_and_change_detection(conn, dataset_id, tmp_path):
    from plateforme import db
    from plateforme.store import LocalStore

    store = LocalStore(tmp_path)
    run_id = db.start_run(conn, dataset_id)

    first = db.record_asset(
        conn, store, run_id, dataset_id, "test-src", "data.json", b'{"a": 1}', "http://example"
    )
    assert not first.unchanged and first.asset_id is not None
    assert store.get(first.key) == b'{"a": 1}'

    # même contenu => détection d'inchangé, aucun nouveau fichier écrit
    second = db.record_asset(
        conn, store, run_id, dataset_id, "test-src", "data.json", b'{"a": 1}', "http://example"
    )
    assert second.unchanged and second.asset_id is None

    db.finish_run(conn, run_id, "success", rows_written=1)
    status, rows = conn.execute(
        "select status, rows_written from meta.ingestion_runs where run_id = %s", (run_id,)
    ).fetchone()
    assert status == "success" and rows == 1


def test_failed_run_is_traced(conn, dataset_id):
    from plateforme import db

    run_id = db.start_run(conn, dataset_id)
    db.finish_run(conn, run_id, "failed", error="HTTP 503")
    status, details = conn.execute(
        "select status, error_details from meta.ingestion_runs where run_id = %s", (run_id,)
    ).fetchone()
    assert status == "failed" and details["message"] == "HTTP 503"
