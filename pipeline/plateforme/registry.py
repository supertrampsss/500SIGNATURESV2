"""Synchronisation du registre des sources : CSV du dépôt -> meta.*.

Le registre versionné dans Git fait foi. Un connecteur ne peut rien écrire pour
un jeu absent de `meta.dataset_registry` (contrainte de lineage) : la
synchronisation doit donc précéder toute ingestion, sinon ajouter une source au
dépôt ne suffit pas à la rendre ingérable.

Usage : python -m plateforme.registry
"""

import csv
from pathlib import Path

from plateforme import entrepot

RACINE = Path(__file__).resolve().parents[2] / "infra/seed"


def _lire(nom: str) -> list[dict]:
    with open(RACINE / nom, encoding="utf-8") as fichier:
        return list(csv.DictReader(fichier))


def _vide_en_none(valeur: str | None) -> str | None:
    return valeur or None


def sync(conn) -> tuple[int, int]:
    sources = _lire("source_registry.csv")
    jeux = _lire("dataset_registry.csv")

    with conn.cursor() as cur:
        cur.executemany(
            """
            insert into meta.source_registry
                (source_id, name, producer, access_category, base_url, doc_url,
                 auth_mode, license, country_scope)
            values ($source_id, $name, $producer, $access_category,
                    $base_url, $doc_url, $auth_mode, $license, $country_scope)
            on conflict (source_id) do update set
                name = excluded.name, producer = excluded.producer,
                access_category = excluded.access_category, base_url = excluded.base_url,
                doc_url = excluded.doc_url, auth_mode = excluded.auth_mode,
                license = excluded.license, country_scope = excluded.country_scope
            """,
            [{k: _vide_en_none(v) for k, v in s.items()} for s in sources],
        )
        cur.executemany(
            """
            insert into meta.dataset_registry
                (dataset_id, source_id, external_id, title, endpoint_url, format,
                 update_frequency, expected_freshness_days, geo_granularity,
                 time_granularity, priority, ingestion_mode, target_tables,
                 personal_data, statistical_secrecy)
            values ($dataset_id, $source_id, $external_id, $title,
                    $endpoint_url, $format, $update_frequency,
                    $expected_freshness_days, $geo_granularity, $time_granularity,
                    $priority, $ingestion_mode, $target_tables,
                    $personal_data, $statistical_secrecy)
            on conflict (dataset_id) do update set
                source_id = excluded.source_id, external_id = excluded.external_id,
                title = excluded.title, endpoint_url = excluded.endpoint_url,
                format = excluded.format, update_frequency = excluded.update_frequency,
                expected_freshness_days = excluded.expected_freshness_days,
                geo_granularity = excluded.geo_granularity,
                time_granularity = excluded.time_granularity, priority = excluded.priority,
                ingestion_mode = excluded.ingestion_mode, target_tables = excluded.target_tables,
                personal_data = excluded.personal_data,
                statistical_secrecy = excluded.statistical_secrecy
            """,
            [
                {
                    **{k: _vide_en_none(v) for k, v in jeu.items()},
                    "expected_freshness_days": int(jeu["expected_freshness_days"])
                    if jeu["expected_freshness_days"]
                    else None,
                    "target_tables": jeu["target_tables"].split("|")
                    if jeu["target_tables"]
                    else None,
                    "personal_data": jeu["personal_data"] == "true",
                    "statistical_secrecy": jeu["statistical_secrecy"] == "true",
                }
                for jeu in jeux
            ],
        )
    conn.commit()
    return len(sources), len(jeux)


def main() -> int:
    conn = entrepot.connect()
    try:
        n_sources, n_jeux = sync(conn)
        print(f"registre synchronisé : {n_sources} sources, {n_jeux} jeux")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
