"""Orchestration d'un run d'ingestion : registre -> connecteur -> snapshot -> lineage.

Usage : python -m plateforme.ingest <dataset_id> [--params '{"GEO":"COM-33318"}']
        [--store .snapshots] [--trigger manual|cron|backfill]

Le snapshot est l'étape 1 de la chaîne (docs/03 §1) ; la normalisation vers les
tables analytiques est propre à chaque jeu et arrive avec les tickets T-11+.
`--params` restreint l'extrait pour les modes API (échantillon, backfill par
territoire) ; les extractions de masse (ods_export) archivent l'export complet.
"""

import argparse
import json
import sys

from plateforme import db
from plateforme.connectors import datagouv, eurostat, insee, ods
from plateforme.http import fetch
from plateforme.store import LocalStore, R2Store


def make_store(spec: str):
    """'r2:<bucket>' -> R2Store (credentials via env, cf. docs/SETUP.md) ; sinon chemin local."""
    if spec.startswith("r2:"):
        return R2Store.from_env(spec.removeprefix("r2:"))
    return LocalStore(spec)


def snapshot_for(dataset: dict, params: dict | None) -> tuple[str, bytes, str, str]:
    """-> (filename, content, source_url, content_type) selon le mode d'ingestion."""
    mode = dataset["ingestion_mode"]
    external = dataset["external_id"]
    endpoint = dataset["endpoint_url"]

    if mode == "api_pull" and dataset["source_id"] == "data-gouv":
        if external:
            payload = datagouv.get_dataset(external)
            url = datagouv.dataset_url(external)
        else:  # liveness du catalogue lui-même
            url = endpoint
            payload = fetch(url).json()
        return "dataset.json", datagouv.snapshot_payload(payload), url, "application/json"

    if mode == "melodi_pull":
        payload = insee.melodi_data(external, params)
        content = json.dumps(payload, ensure_ascii=False, sort_keys=True).encode()
        return "data.json", content, f"{insee.MELODI_BASE}/data/{external}", "application/json"

    if mode == "sdmx_pull" and dataset["source_id"] == "insee-bdm":
        content = insee.bdm_sdmx(external)
        return "data.xml", content, f"{insee.BDM_BASE}/data/{external}", "application/xml"

    if mode == "sdmx_pull" and dataset["source_id"] == "eurostat":
        payload = eurostat.get_data(external, params)
        content = json.dumps(payload, ensure_ascii=False, sort_keys=True).encode()
        return "data.json", content, eurostat.data_url(external, params), "application/json"

    if mode == "ods_export":
        url = ods.export_url(dataset["base_url"], external, "csv")
        return "export.csv", fetch(url, timeout=600).content, url, "text/csv"

    raise NotImplementedError(
        f"mode {mode!r} / source {dataset['source_id']!r} : connecteur à venir (docs/08)"
    )


def run(dataset_id: str, params: dict | None, store_spec: str, trigger: str) -> int:
    conn = db.connect()
    store = make_store(store_spec)
    dataset = db.get_dataset(conn, dataset_id)
    run_id = db.start_run(conn, dataset_id, trigger)
    try:
        filename, content, source_url, content_type = snapshot_for(dataset, params)
        result = db.record_asset(
            conn, store, run_id, dataset_id, dataset["source_id"],
            filename, content, source_url, content_type,
        )
        db.finish_run(conn, run_id, "success", rows_written=0 if result.unchanged else 1)
        state = "inchangé (hash identique)" if result.unchanged else f"snapshot {result.key}"
        print(f"[{dataset_id}] run {run_id} : {state}")
        return 0
    except Exception as error:  # noqa: BLE001 — tout échec doit finir tracé dans le lineage
        db.finish_run(conn, run_id, "failed", error=str(error))
        print(f"[{dataset_id}] run {run_id} : ÉCHEC {error}", file=sys.stderr)
        return 1
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset_id")
    parser.add_argument("--params", type=json.loads, default=None)
    parser.add_argument("--store", default=".snapshots")
    parser.add_argument("--trigger", default="manual", choices=["manual", "cron", "backfill"])
    args = parser.parse_args()
    return run(args.dataset_id, args.params, args.store, args.trigger)


if __name__ == "__main__":
    raise SystemExit(main())
