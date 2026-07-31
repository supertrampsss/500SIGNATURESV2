"""Accès base et primitives de lineage.

Toute écriture analytique passe par un run d'ingestion et un snapshot
(docs/02-modele-donnees.md §A). La détection de changement est le conflit
d'unicité sur (dataset_id, content_sha256) de meta.raw_assets.
"""

import hashlib
import os
from dataclasses import dataclass
from datetime import UTC, datetime

import psycopg
from psycopg.types.json import Jsonb


def connect(db_url: str | None = None) -> psycopg.Connection:
    """`keepalives` : sans eux, une connexion inactive pendant une longue
    transformation est coupée en silence par l'infrastructure, et l'échec
    n'apparaît qu'à la requête suivante."""
    url = db_url or os.environ["PLATEFORME_DB_URL"]
    return psycopg.connect(
        url, keepalives=1, keepalives_idle=30, keepalives_interval=10, keepalives_count=5
    )


def get_dataset(conn: psycopg.Connection, dataset_id: str) -> dict:
    row = conn.execute(
        """
        select d.dataset_id, d.source_id, d.external_id, d.endpoint_url,
               d.ingestion_mode, s.base_url
        from meta.dataset_registry d
        join meta.source_registry s using (source_id)
        where d.dataset_id = %s
        """,
        (dataset_id,),
    ).fetchone()
    if row is None:
        raise KeyError(f"dataset inconnu du registre : {dataset_id}")
    keys = ["dataset_id", "source_id", "external_id", "endpoint_url", "ingestion_mode", "base_url"]
    return dict(zip(keys, row, strict=True))


def start_run(conn: psycopg.Connection, dataset_id: str, trigger: str = "manual") -> str:
    row = conn.execute(
        """
        insert into meta.ingestion_runs (dataset_id, status, trigger, connector_version)
        values (%s, 'running', %s, %s) returning run_id
        """,
        (dataset_id, trigger, os.environ.get("GITHUB_SHA", "dev")),
    ).fetchone()
    conn.commit()
    return str(row[0])


def finish_run(
    conn: psycopg.Connection,
    run_id: str,
    status: str,
    rows_read: int = 0,
    rows_written: int = 0,
    error: str | None = None,
) -> None:
    # Une écriture ratée laisse la transaction avortée : sans ce rollback, tracer
    # l'échec échouerait à son tour et masquerait l'erreur d'origine.
    conn.rollback()
    details = Jsonb({"message": error}) if error is not None else None
    conn.execute(
        """
        update meta.ingestion_runs
        set finished_at = now(), status = %s, rows_read = %s, rows_written = %s,
            error_details = %s
        where run_id = %s
        """,
        (status, rows_read, rows_written, details, run_id),
    )
    conn.commit()


@dataclass
class AssetResult:
    unchanged: bool
    asset_id: int | None
    key: str | None


def record_asset(
    conn: psycopg.Connection,
    store,
    run_id: str,
    dataset_id: str,
    source_id: str,
    filename: str,
    content: bytes,
    source_url: str,
    content_type: str | None = None,
) -> AssetResult:
    """Enregistre un snapshot : d'abord le lineage (détection de doublon), puis le fichier."""
    sha = hashlib.sha256(content).hexdigest()
    ts = datetime.now(UTC).strftime("%Y-%m-%dT%H%M%SZ")
    key = f"raw/{source_id}/{dataset_id}/{ts}/{filename}"
    row = conn.execute(
        """
        insert into meta.raw_assets
            (run_id, dataset_id, r2_key, source_url, content_sha256, size_bytes, content_type)
        values (%s, %s, %s, %s, %s, %s, %s)
        on conflict (dataset_id, content_sha256) do nothing
        returning asset_id
        """,
        (run_id, dataset_id, key, source_url, sha, len(content), content_type),
    ).fetchone()
    if row is None:  # contenu identique déjà archivé : rien à retraiter
        conn.commit()
        return AssetResult(unchanged=True, asset_id=None, key=None)
    store.put(key, content)
    conn.commit()
    return AssetResult(unchanged=False, asset_id=row[0], key=key)
