"""Connecteur INSEE (T-08) : Melodi (JSON, sans clé) et BDM (SDMX-ML, sans clé).

Sirene (clé requise) sera ajouté quand INSEE_API_KEY existera (docs/SETUP.md).
Piège documenté (docs/01) : les codes géo Melodi sont préfixés par le millésime
du zonage (« 2025-COM-33318 ») — clean_geo les normalise avant toute jointure.
"""

import re
from urllib.parse import urlencode

from plateforme.http import fetch, telecharger

MELODI_BASE = "https://api.insee.fr/melodi"
BDM_BASE = "https://api.insee.fr/series/BDM/V1"

_GEO_PREFIX = re.compile(r"^\d{4}-[A-Z]+-")


def clean_geo(code: str) -> str:
    """'2025-COM-33318' -> '33318' ; laisse inchangé un code déjà nu."""
    return _GEO_PREFIX.sub("", code)


def melodi_data(dataset: str, params: dict | None = None) -> dict:
    url = f"{MELODI_BASE}/data/{dataset}"
    if params:
        url = f"{url}?{urlencode(params)}"
    return fetch(url).json()


def melodi_observations(payload: dict) -> list[dict]:
    return payload.get("observations", [])


def bdm_sdmx(dataflow_or_series: str) -> bytes:
    """SDMX-ML brut. L'en-tête Accept est obligatoire (406 sinon)."""
    url = f"{BDM_BASE}/data/{dataflow_or_series}"
    return telecharger(url, headers={"Accept": "application/xml"})
