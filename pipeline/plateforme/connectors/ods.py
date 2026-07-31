"""Connecteur générique Opendatasoft Explore v2.1 (T-07).

Couvre data.economie.gouv.fr, OFGL, URSSAF, Ameli, DREES, éducation, SNCF,
ODRE, Webstat (docs/01, section plomberie). Les extractions de masse passent
par les exports, jamais par la pagination de /records (plafonnée).
"""

from urllib.parse import urlencode

from plateforme.http import fetch


def records_url(base: str, dataset: str, params: dict | None = None) -> str:
    url = f"{base.rstrip('/')}/catalog/datasets/{dataset}/records"
    return f"{url}?{urlencode(params)}" if params else url


def export_url(base: str, dataset: str, fmt: str = "csv") -> str:
    return f"{base.rstrip('/')}/catalog/datasets/{dataset}/exports/{fmt}"


def get_records(base: str, dataset: str, params: dict | None = None) -> dict:
    return fetch(records_url(base, dataset, params)).json()


def parse_records(payload: dict) -> tuple[int, list[dict]]:
    return payload.get("total_count", 0), payload.get("results", [])
