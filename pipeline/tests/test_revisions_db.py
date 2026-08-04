"""L'archive des révisions contre une vraie base (PLATEFORME_TEST_DB : en CI
dans le job `database`, en local contre un PostGIS où les migrations sont
appliquées).

Ce qui est vérifié est le contrat de docs/02 §C : un rechargement qui change
une valeur archive l'ancienne — et seulement elle. Archiver trop remplirait le
plan Supabase (D6bis), archiver trop peu réécrirait l'histoire en silence.
"""

import uuid

import pytest

from plateforme import entrepot


VINTAGE = 2099  # millésime de test : n'entre en collision avec aucune vraie donnée


@pytest.fixture
def conn(tmp_path):
    from plateforme import entrepot

    connection = entrepot.connect(tmp_path / "entrepot.duckdb")
    yield connection
    connection.close()


@pytest.fixture
def contexte(conn):
    """Un indicateur, deux territoires, un jeu : le décor minimal pour écrire
    des observations. Tout est démonté à la fin, révisions comprises."""
    source = f"test-src-{uuid.uuid4().hex[:8]}"
    dataset = f"test-ds-{uuid.uuid4().hex[:8]}"
    indicateur = f"test-ind-{uuid.uuid4().hex[:8]}"
    conn.execute(
        "insert into meta.source_registry (source_id, name, producer, access_category, license)"
        " values (?, 'Test', 'Test', 'A', 'LO2.0')",
        (source,),
    )
    conn.execute(
        "insert into meta.dataset_registry (dataset_id, source_id, title, priority)"
        " values (?, ?, 'Jeu de test révisions', 'P3')",
        (dataset, source),
    )
    conn.execute(
        "insert into core.indicators (indicator_id, dataset_id, theme, label_fr, unit)"
        " values (?, ?, 'test', 'Indicateur de test', 'percent')",
        (indicateur, dataset),
    )
    for niveau, code, nom in [
        ("departement", "T1", "Département de test"),
        ("region", "T2", "Région de test"),
    ]:
        conn.execute(
            "insert into geo.geography_reference (geo_level, geo_code, vintage, name)"
            " values (?, ?, ?, ?)",
            (niveau, code, VINTAGE, nom),
        )
    conn.commit()
    yield dataset, indicateur
    entrepot.annuler(conn)
    conn.execute("delete from core.observations where indicator_id = ?", (indicateur,))
    conn.execute("delete from core.observations_revisions where indicator_id = ?", (indicateur,))
    conn.execute("delete from core.indicators where indicator_id = ?", (indicateur,))
    conn.execute(
        "delete from geo.geography_reference where vintage = ? and geo_code in ('T1','T2')",
        (VINTAGE,),
    )
    conn.execute("delete from meta.ingestion_runs where dataset_id = ?", (dataset,))
    conn.execute("delete from meta.dataset_registry where dataset_id = ?", (dataset,))
    conn.execute("delete from meta.source_registry where source_id = ?", (source,))
    conn.commit()


def test_seule_la_valeur_qui_change_est_archivee(conn, contexte):
    from plateforme import entrepot, revisions

    dataset, indicateur = contexte
    run1 = entrepot.start_run(conn, dataset)
    ecrites, revisees = revisions.remplacer(
        conn,
        run1,
        [indicateur],
        ("value", "quality_flags"),
        [
            (indicateur, "departement", "T1", VINTAGE, "2024-Q4", 7.4, ["provisional"]),
            (indicateur, "departement", "T1", VINTAGE, "2024-Q3", 7.5, []),
        ],
    )
    conn.commit()
    assert (ecrites, revisees) == (2, 0), "premier chargement : rien à archiver"

    # Parution suivante : T4 est réestimé, T3 ne bouge pas, T1-2025 apparaît.
    run2 = entrepot.start_run(conn, dataset)
    ecrites, revisees = revisions.remplacer(
        conn,
        run2,
        [indicateur],
        ("value", "quality_flags"),
        [
            (indicateur, "departement", "T1", VINTAGE, "2024-Q4", 7.2, []),
            (indicateur, "departement", "T1", VINTAGE, "2024-Q3", 7.5, []),
            (indicateur, "departement", "T1", VINTAGE, "2025-Q1", 7.1, ["provisional"]),
        ],
    )
    conn.commit()
    assert (ecrites, revisees) == (3, 1)

    archives = conn.execute(
        "select period, old_value, run_id from core.observations_revisions"
        " where indicator_id = ?",
        (indicateur,),
    ).fetchall()
    assert [(p, float(v)) for p, v, _ in archives] == [("2024-Q4", 7.4)]
    # la révision est signée par le run qui l'a provoquée, pas par celui
    # qui avait posé la valeur d'origine
    assert str(archives[0][2]) == str(run2)

    valeurs = dict(
        conn.execute(
            "select period, value from core.observations where indicator_id = ?",
            (indicateur,),
        ).fetchall()
    )
    assert {p: float(v) for p, v in valeurs.items()} == {
        "2024-Q4": 7.2,
        "2024-Q3": 7.5,
        "2025-Q1": 7.1,
    }


def test_le_perimetre_par_niveau_ne_touche_pas_les_autres_niveaux(conn, contexte):
    from plateforme import entrepot, revisions

    dataset, indicateur = contexte
    run1 = entrepot.start_run(conn, dataset)
    revisions.remplacer(
        conn,
        run1,
        [indicateur],
        ("value",),
        [
            (indicateur, "departement", "T1", VINTAGE, "2024", 10.0),
            (indicateur, "region", "T2", VINTAGE, "2024", 20.0),
        ],
    )
    conn.commit()

    # Rechargement des seules régions : le département survit, sans fausse
    # révision — c'est le contrat dont ofgl (chargement niveau par niveau)
    # aura besoin pour adopter l'archive à son tour.
    run2 = entrepot.start_run(conn, dataset)
    ecrites, revisees = revisions.remplacer(
        conn,
        run2,
        [indicateur],
        ("value",),
        [(indicateur, "region", "T2", VINTAGE, "2024", 21.0)],
        niveaux=["region"],
    )
    conn.commit()
    assert (ecrites, revisees) == (1, 1)

    restantes = {
        (niveau, float(valeur))
        for niveau, valeur in conn.execute(
            "select geo_level, value from core.observations where indicator_id = ?",
            (indicateur,),
        ).fetchall()
    }
    assert restantes == {("departement", 10.0), ("region", 21.0)}
