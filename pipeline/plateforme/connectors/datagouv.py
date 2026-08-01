"""Connecteur data.gouv.fr (T-06) : catalogue et ressources.

Les URLs de ressources changent ; on archive les métadonnées (dont checksums)
et on référence les ressources par id (docs/01, section plomberie).
"""

import json

from plateforme.http import fetch

BASE = "https://www.data.gouv.fr/api/1"


def dataset_url(slug_or_id: str) -> str:
    return f"{BASE}/datasets/{slug_or_id}/"


def get_dataset(slug_or_id: str) -> dict:
    return fetch(dataset_url(slug_or_id)).json()


def list_resources(dataset: dict) -> list[dict]:
    return [
        {
            "id": r.get("id"),
            "title": r.get("title"),
            "url": r.get("url"),
            "format": r.get("format"),
            "checksum": (r.get("checksum") or {}).get("value"),
            "last_modified": r.get("last_modified"),
        }
        for r in dataset.get("resources", [])
    ]


def snapshot_payload(dataset: dict) -> bytes:
    """Métadonnées re-sérialisées de façon stable (tri des clés) pour un hash reproductible."""
    return json.dumps(dataset, ensure_ascii=False, sort_keys=True).encode()
