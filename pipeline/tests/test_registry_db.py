"""Synchronisation du registre (exécutée en CI, job database).

Le registre versionné fait foi : ajouter une source au dépôt doit suffire à la
rendre ingérable, sans intervention manuelle en base.
"""





def test_sync_est_idempotent_et_couvre_les_jeux_p0(tmp_path):
    from plateforme import entrepot, registry

    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    registry.sync(conn)
    try:
        n_sources, n_jeux = registry.sync(conn)
        assert registry.sync(conn) == (n_sources, n_jeux)  # rejouable sans effet de bord

        charges = conn.execute(
            "select count(*) from meta.dataset_registry where priority = 'P0'"
        ).fetchone()[0]
        assert charges >= 30

        orphelins = conn.execute(
            """
            select count(*) from meta.dataset_registry d
            left join meta.source_registry s using (source_id) where s.source_id is null
            """
        ).fetchone()[0]
        assert orphelins == 0
    finally:
        conn.close()
