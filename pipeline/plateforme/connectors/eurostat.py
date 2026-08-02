"""Connecteur Eurostat (T-09) : API de diffusion, format JSON-stat 2.0.

Les flags Eurostat (ruptures de série, provisoire) sont dans `status` et
doivent être propagés vers quality_flags à la normalisation (docs/01 §9).
"""

from urllib.parse import urlencode

from plateforme.http import fetch

BASE = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data"


def data_url(dataset: str, params: dict | None = None) -> str:
    url = f"{BASE}/{dataset}"
    # doseq : une liste devient une clé répétée (cofog99=GF01&cofog99=GF02…),
    # la façon dont l'API attend un filtre à plusieurs valeurs. Sans effet sur
    # les paramètres simples.
    return f"{url}?{urlencode(params, doseq=True)}" if params else url


def get_data(dataset: str, params: dict | None = None) -> dict:
    return fetch(data_url(dataset, params)).json()


def first_value(payload: dict) -> float | None:
    values = payload.get("value") or {}
    for _, v in sorted(values.items(), key=lambda kv: int(kv[0])):
        return v
    return None
