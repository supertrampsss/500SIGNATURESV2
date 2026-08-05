"""Le retrait de l'intercommunalité, contre un vrai entrepôt DuckDB.

Une suppression n'est pas un chargement : elle ne peut pas être vérifiée après
coup par un total qu'on recoupe chez le producteur. Ce qu'elle emporte, elle
l'emporte. Ces tests portent donc sur les trois choses qui peuvent mal tourner :
elle en supprime trop, elle en supprime trop peu, ou elle laisse derrière elle
des lignes orphelines que le run suivant lira comme un défaut.
"""

from plateforme import entrepot, registry, retrait_interco
from plateforme.normalize.geo import MILLESIME

JEU = "melodi-rp-population"


def _remplir(conn) -> str:
    """Un entrepôt minuscule où le niveau retiré côtoie ceux qui restent."""
    registry.sync(conn)
    for niveau, code, nom in (
        ("commune", "33063", "Bordeaux"),
        ("epci", "243300316", "Bordeaux Métropole"),
        ("departement", "33", "Gironde"),
    ):
        conn.execute(
            "insert into geo.geography_reference (geo_level, geo_code, vintage, name)"
            " values (?, ?, ?, ?)",
            (niveau, code, MILLESIME, nom),
        )
    definition = conn.execute(
        "insert into core.indicator_definitions (public_definition, technical_definition,"
        " confidence_level) values ('Population.', 'Recensement.', 'observed')"
        " returning definition_id"
    ).fetchone()[0]
    conn.execute(
        "insert into core.indicators (indicator_id, dataset_id, definition_id, theme,"
        " label_fr, unit, additive, geo_levels, time_granularity, published)"
        " values ('insee_population', ?, ?, 'population', 'Population', 'count', true,"
        " array['commune','epci','departement'], 'annuelle', true)",
        (JEU, definition),
    )
    run_id = entrepot.start_run(conn, JEU)
    for niveau, code in (("commune", "33063"), ("epci", "243300316"), ("departement", "33")):
        conn.execute(
            "insert into core.observations (indicator_id, geo_level, geo_code,"
            " geo_vintage, period, value, run_id) values ('insee_population', ?, ?, ?,"
            " '2023', 1000.0, ?)",
            (niveau, code, MILLESIME, run_id),
        )
    entrepot.finish_run(conn, run_id, "success")
    conn.commit()
    return run_id


def test_retrait(tmp_path, monkeypatch):
    """Le cas nominal : l'intercommunalité part, le reste ne bouge pas."""
    monkeypatch.setattr(entrepot, "LOCAL", tmp_path / "entrepot.duckdb")
    conn = entrepot.connect()
    _remplir(conn)
    conn.close()

    assert retrait_interco.run() == 0

    conn = entrepot.connect()
    try:
        niveaux = [
            n for (n,) in conn.execute(
                "select distinct geo_level from geo.geography_reference order by 1"
            ).fetchall()
        ]
        assert niveaux == ["commune", "departement"]
        observes = [
            n for (n,) in conn.execute(
                "select distinct geo_level from core.observations order by 1"
            ).fetchall()
        ]
        assert observes == ["commune", "departement"]
        # L'indicateur reste : il est observé ailleurs. Le supprimer parce qu'il
        # l'était aussi à l'échelle intercommunale ferait disparaître du site
        # une donnée communale intacte.
        assert conn.execute("select count(*) from core.indicators").fetchone()[0] == 1
        assert entrepot.verifier_integrite(conn) == []
    finally:
        conn.close()


def test_le_registre_perd_les_deux_jeux_devenus_sans_connecteur(tmp_path, monkeypatch):
    """Sans cela, `alertes.py` les signalerait en retard de fraîcheur tous les
    jours, sur des jeux qu'on a décidé de ne plus charger."""
    monkeypatch.setattr(entrepot, "LOCAL", tmp_path / "entrepot.duckdb")
    conn = entrepot.connect()
    _remplir(conn)
    # Le registre versionné ne les déclare plus : on rejoue ce qu'un entrepôt
    # existant contient encore, écrit par les runs d'avant le retrait.
    for jeu in retrait_interco.JEUX_RETIRES:
        conn.execute(
            "insert into meta.dataset_registry (dataset_id, source_id, title, priority,"
            " ingestion_mode) values (?, 'api-geo', 'Ancien jeu', 'P0', 'api_pull')",
            (jeu,),
        )
        run_id = entrepot.start_run(conn, jeu)
        entrepot.finish_run(conn, run_id, "success")
    conn.commit()
    conn.close()

    assert retrait_interco.run() == 0

    conn = entrepot.connect()
    try:
        restants = [
            j for (j,) in conn.execute(
                "select dataset_id from meta.dataset_registry where dataset_id in"
                " ('geo-api-epci', 'ofgl-gfp')"
            ).fetchall()
        ]
        assert restants == []
        assert conn.execute("select count(*) from meta.ingestion_runs").fetchone()[0] == 1
        assert entrepot.verifier_integrite(conn) == []
    finally:
        conn.close()


def test_le_retrait_est_idempotent(tmp_path, monkeypatch):
    """Le job peut être relancé — une requête d'ingestion se rejoue. Une seconde
    exécution doit être un non-événement, pas une erreur."""
    monkeypatch.setattr(entrepot, "LOCAL", tmp_path / "entrepot.duckdb")
    conn = entrepot.connect()
    _remplir(conn)
    conn.close()

    assert retrait_interco.run() == 0
    assert retrait_interco.run() == 0

    conn = entrepot.connect()
    try:
        assert conn.execute("select count(*) from core.observations").fetchone()[0] == 2
    finally:
        conn.close()


def test_a_sec_ne_supprime_rien(tmp_path, monkeypatch):
    monkeypatch.setattr(entrepot, "LOCAL", tmp_path / "entrepot.duckdb")
    conn = entrepot.connect()
    _remplir(conn)
    conn.close()

    assert retrait_interco.run(sec=True) == 0

    conn = entrepot.connect()
    try:
        assert conn.execute(
            "select count(*) from core.observations where geo_level = 'epci'"
        ).fetchone()[0] == 1
    finally:
        conn.close()


def test_le_retrait_refuse_d_emporter_un_indicateur_encore_rattache(tmp_path, monkeypatch):
    """Le garde-fou qui compte : les indicateurs de l'OFGL sont tous déclarés
    sous `ofgl-communes`, donc `ofgl-gfp` n'en porte aucun. Si la convention
    changeait, supprimer le jeu emporterait des indicateurs encore observés à
    l'échelle communale — et le contrôle d'intégrité ne s'en apercevrait
    qu'après l'écriture."""
    import pytest

    monkeypatch.setattr(entrepot, "LOCAL", tmp_path / "entrepot.duckdb")
    conn = entrepot.connect()
    _remplir(conn)
    conn.execute(
        "insert into meta.dataset_registry (dataset_id, source_id, title, priority,"
        " ingestion_mode) values ('ofgl-gfp', 'ofgl', 'Ancien jeu', 'P0', 'ods_export')"
    )
    conn.execute(
        "update core.indicators set dataset_id = 'ofgl-gfp' where indicator_id ="
        " 'insee_population'"
    )
    conn.commit()
    conn.close()

    with pytest.raises(RuntimeError, match="retrait refusé"):
        retrait_interco.run()

    conn = entrepot.connect()
    try:
        # Rien n'a été écrit : le refus précède la suppression.
        assert conn.execute(
            "select count(*) from core.observations where geo_level = 'epci'"
        ).fetchone()[0] == 1
    finally:
        conn.close()


def test_les_indicateurs_qui_disparaitraient_sont_nommes(tmp_path, monkeypatch, capsys):
    """Aucun n'est attendu — les connecteurs chargent l'intercommunalité en plus
    des communes, jamais seule. S'il en apparaît un, c'est une perte réelle de
    catalogue, et elle doit se lire dans le journal du run plutôt que se
    découvrir sur le site."""
    monkeypatch.setattr(entrepot, "LOCAL", tmp_path / "entrepot.duckdb")
    conn = entrepot.connect()
    _remplir(conn)
    conn.execute("delete from core.observations where geo_level <> 'epci'")
    conn.commit()
    conn.close()

    retrait_interco.run(sec=True)
    assert "insee_population" in capsys.readouterr().out
