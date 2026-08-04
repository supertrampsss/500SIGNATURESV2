"""geo.passage() sur des chaînes territoriales (exécuté en CI, job database).

Aucune série communale ne doit être comparée entre millésimes sans passer par
cette fonction (docs/00, principe 6) : elle mérite un test qui reproduit le cas
le plus retors — un changement de département suivi d'une fusion, tel que l'a
vécu Le Fresne-sur-Loire (44060 → 49382 en 2015, fusionné dans 49160 en 2016).

Les codes utilisés ici sont fictifs (99xxx) : le test doit valoir aussi bien sur
une base vide qu'après le chargement du référentiel réel.
"""


import pytest


CHAINE = [
    ("changement_code", "2015-12-31", "99060", 2014, "99382", 2015, None),
    ("fusion", "2016-01-01", "99382", 2015, "99160", 2016, None),
]
SCISSION = [
    ("scission", "2024-01-01", "99001", 2023, "99002", 2024, 0.75),
    ("scission", "2024-01-01", "99001", 2023, "99003", 2024, 0.25),
]


@pytest.fixture
def conn(tmp_path):
    from plateforme import entrepot, registry

    connection = entrepot.connect(tmp_path / "entrepot.duckdb")
    registry.sync(connection)
    yield connection
    entrepot.annuler(connection)  # aucun test ne laisse de trace
    connection.close()


def charger(conn, evenements):
    conn.cursor().executemany(
        """
        insert into geo.geography_history
            (event_type, event_date, from_level, from_code, from_vintage,
             to_level, to_code, to_vintage, population_share, source)
        values (?, ?, 'commune', ?, ?, 'commune', ?, ?, ?, 'test')
        """,
        evenements,
    )


def test_passage_suit_une_chaine_de_deux_mouvements(conn):
    charger(conn, CHAINE)
    resultat = conn.execute(
        "select geo_code, population_share from geo.passage('commune', '99060', 2014, 2025)"
    ).fetchall()
    assert resultat == [("99160", 1)]


def test_passage_est_l_identite_sans_mouvement(conn):
    resultat = conn.execute(
        "select geo_code, population_share from geo.passage('commune', '99999', 2015, 2025)"
    ).fetchall()
    assert resultat == [("99999", 1)]


def test_passage_repartit_une_scission_sans_creer_de_valeur(conn):
    charger(conn, SCISSION)
    resultat = dict(
        conn.execute(
            "select geo_code, population_share from geo.passage('commune', '99001', 2023, 2025)"
        ).fetchall()
    )
    assert resultat == {"99002": 0.75, "99003": 0.25}
    assert sum(resultat.values()) == 1  # une scission ne crée ni ne détruit de masse


def test_passage_s_arrete_avant_le_millesime_cible(conn):
    charger(conn, CHAINE)
    # Vue depuis 2015, la fusion de 2016 n'a pas encore eu lieu.
    resultat = conn.execute(
        "select geo_code from geo.passage('commune', '99060', 2014, 2015)"
    ).fetchall()
    assert resultat == [("99382",)]
