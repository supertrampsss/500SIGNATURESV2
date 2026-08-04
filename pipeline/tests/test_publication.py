"""La borne des périodes publiées protège les fichiers de carte — elle ne doit
jamais amputer les séries pays qui portent les courbes de conjoncture. Le bug
attrapé ici en vérification réelle : une inflation chargée depuis 2013 sortait
tronquée à ses 12 derniers mois, sans que rien ne le dise."""



from plateforme import publish


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
