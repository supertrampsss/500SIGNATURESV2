"""La borne des périodes publiées protège les fichiers de carte — elle ne doit
jamais amputer les séries pays qui portent les courbes de conjoncture. Le bug
attrapé ici en vérification réelle : une inflation chargée depuis 2013 sortait
tronquée à ses 12 derniers mois, sans que rien ne le dise."""



import json

import pytest

from plateforme import entrepot, publish


def test_les_series_pays_gardent_leur_profondeur_entiere(tmp_path):
    from plateforme import entrepot, registry
    from plateforme.normalize.geo import MILLESIME

    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    registry.sync(conn)
    indicateur = "test_serie_longue_pays"
    try:
        definition = conn.execute(
            "insert into core.indicator_definitions (public_definition, confidence_level)"
            " values ('Série de test pour la borne de publication des pays.', 'observed')"
            " returning definition_id"
        ).fetchone()[0]
        conn.execute(
            """
            insert into core.indicators
                (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                 additive, accounting_frame, geo_levels, time_granularity, published)
            values (?, 'eurostat-prc-hicp-manr', ?, 'macro', 'Série test', 'percent',
                    false, 'nationale', array['pays'], 'mensuelle', true)
            """,
            (indicateur, definition),
        )
        conn.execute(
            "insert into geo.geography_reference (geo_level, geo_code, vintage, name)"
            " values ('pays', 'TST', ?, 'Pays test') on conflict do nothing",
            (MILLESIME,),
        )
        run_id = entrepot.start_run(conn, "eurostat-prc-hicp-manr")
        for mois in range(1, 16):  # 15 périodes : au-delà de la borne de 12
            annee, m = 2024 + (mois - 1) // 12, (mois - 1) % 12 + 1
            conn.execute(
                "insert into core.observations (indicator_id, geo_level, geo_code,"
                " geo_vintage, period, value, run_id)"
                " values (?, 'pays', 'TST', ?, ?, 2.0, ?)",
                (indicateur, MILLESIME, f"{annee}-{m:02d}", run_id),
            )
        conn.commit()

        bornees = [p for i, p in publish.couples_publies(conn, "pays") if i == indicateur]
        entieres = [
            p for i, p in publish.couples_publies(conn, "pays", borne=False) if i == indicateur
        ]
        assert len(bornees) == publish.PERIODES_CARTOGRAPHIEES
        assert len(entieres) == 15
        # les périodes les plus récentes survivent à la borne, pas les vieilles
        assert bornees[-1] == entieres[-1] == "2025-03"
        assert "2024-01" in entieres and "2024-01" not in bornees
    finally:
        entrepot.annuler(conn)
        conn.execute("delete from core.observations where indicator_id = ?", (indicateur,))
        conn.execute("delete from core.indicators where indicator_id = ?", (indicateur,))
        conn.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
        conn.execute("delete from geo.geography_reference where geo_code = 'TST'")
        conn.execute(
            "delete from meta.ingestion_runs where dataset_id = 'eurostat-prc-hicp-manr'"
            " and status = 'running'"
        )
        conn.commit()
        conn.close()


class StoreAvecCatalogue:
    """Un bucket qui porte déjà une publication : pointeur et catalogue."""

    def __init__(self, indicateurs: int):
        self.objets = {
            "data/derniere.json": json.dumps({"version": "2026-08-02T1838"}).encode(),
            "data/2026-08-02T1838/indicateurs.json": json.dumps(
                [{"id": f"i{n}"} for n in range(indicateurs)]
            ).encode(),
        }

    def get(self, cle):
        if cle not in self.objets:
            raise FileNotFoundError(cle)
        return self.objets[cle]

    def put(self, cle, contenu, overwrite=False):
        self.objets[cle] = contenu


def _publier_n_indicateurs(conn, combien: int) -> None:
    conn.execute(
        """insert into meta.source_registry (source_id, name, producer, access_category, license)
           values ('s', 'S', 'S', 'A', 'LO2.0')"""
    )
    conn.execute(
        """insert into meta.dataset_registry (dataset_id, source_id, title, priority)
           values ('d', 's', 'D', 'P0')"""
    )
    for n in range(combien):
        definition = conn.execute(
            """insert into core.indicator_definitions (public_definition, confidence_level)
               values ('Une définition grand public suffisamment longue pour la contrainte.', 'observed')
               returning definition_id"""
        ).fetchone()[0]
        conn.execute(
            """insert into core.indicators
                 (indicator_id, dataset_id, definition_id, theme, label_fr, unit, published)
               values (?, 'd', ?, 't', 'X', 'EUR', true)""",
            [f"x{n}", definition],
        )


def test_un_entrepot_ampute_ne_remplace_pas_un_site_complet(tmp_path):
    """Le pointeur est la seule chose que le site lit. Le réécrire vers une
    publication presque vide ferait disparaître le site sans erreur nulle part —
    les fichiers déposés seraient valides, simplement vides."""
    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    _publier_n_indicateurs(conn, 10)
    store = StoreAvecCatalogue(indicateurs=100)
    with pytest.raises(RuntimeError, match="publication refusée"):
        publish.controler_avant_publication(conn, store)
    conn.close()


def test_une_perte_marginale_ne_bloque_pas_la_publication(tmp_path):
    # Un producteur qui décale un millésime, une classe passée sous secret :
    # quelques indicateurs en moins sont normaux, le garde-fou ne doit pas les
    # confondre avec un entrepôt vide.
    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    _publier_n_indicateurs(conn, 95)
    publish.controler_avant_publication(conn, StoreAvecCatalogue(indicateurs=100))
    conn.close()


def test_la_premiere_publication_n_a_rien_a_preserver(tmp_path):
    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    publish.controler_avant_publication(conn, type("Vide", (), {"get": lambda self, c: (_ for _ in ()).throw(FileNotFoundError(c)), "put": lambda self, c, d, overwrite=False: None})())
    conn.close()
