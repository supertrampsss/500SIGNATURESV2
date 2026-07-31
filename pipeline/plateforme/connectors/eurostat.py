"""Connecteur Eurostat (T-09) : API de diffusion, format JSON-stat 2.0.

Les flags Eurostat (ruptures de série, provisoire) sont dans `status` et
doivent être propagés vers quality_flags à la normalisation (docs/01 §9).
"""

from urllib.parse import urlencode

from plateforme.http import fetch

BASE = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data"


def data_url(dataset: str, params: dict | None = None) -> str:
    url = f"{BASE}/{dataset}"
    return f"{url}?{urlencode(params)}" if params else url


def get_data(dataset: str, params: dict | None = None) -> dict:
    return fetch(data_url(dataset, params)).json()


def first_value(payload: dict) -> float | None:
    values = payload.get("value") or {}
    for _, v in sorted(values.items(), key=lambda kv: int(kv[0])):
        return v
    return None
