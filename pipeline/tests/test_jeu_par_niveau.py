"""La source d'une série, maille par maille.

Un indicateur ne porte qu'un `dataset_id`, et le connecteur de l'OFGL en
télécharge trois — un par maille — puis déclare tout sous celui des communes.
Le catalogue publié affirmait donc que les recettes de fonctionnement d'un
département viennent des « Finances des communes », et l'export CSV du site
écrivait cette phrase sous « Source : ».

Ces tests portent sur le couple (indicateur, maille) que la publication doit
corriger, et sur les deux prudences qui l'encadrent : ne rien dire quand deux
jeux se disputent une maille, ne rien répéter quand la source est celle qui est
déjà déclarée.
"""

import pytest

from plateforme import entrepot, publish, registry
from plateforme.normalize.geo import MILLESIME


DECLARE = "ofgl-communes"
REEL = "ofgl-departements"
INDICATEUR = "ofgl_recettes_fonctionnement"


def _socle(conn) -> None:
    registry.sync(conn)
    for niveau, code, nom, parent in (
        ("pays", "FR", "France", (None, None)),
        ("region", "75", "Nouvelle-Aquitaine", ("pays", "FR")),
        ("departement", "33", "Gironde", ("region", "75")),
    ):
        conn.execute(
            "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
            " parent_level, parent_code) values (?, ?, ?, ?, ?, ?)",
            (niveau, code, MILLESIME, nom, *parent),
        )
    conn.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code) values ('commune', '33063', ?, 'Bordeaux',"
        " 'departement', '33')",
        (MILLESIME,),
    )
    definition = conn.execute(
        "insert into core.indicator_definitions (public_definition, technical_definition,"
        " confidence_level) values ('Recettes de fonctionnement.', 'Agrégat OFGL.',"
        " 'observed') returning definition_id"
    ).fetchone()[0]
    conn.execute(
        """
        insert into core.indicators
            (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
             additive, geo_levels, time_granularity, published)
        values (?, ?, ?, 'finances_locales', 'Recettes de fonctionnement', 'EUR',
                true, array['commune', 'departement'], 'annuelle', true)
        """,
        (INDICATEUR, DECLARE, definition),
    )


def _observer(conn, jeu: str, niveau: str, code: str, valeur: float, periode="2025") -> None:
    run_id = entrepot.start_run(conn, jeu)
    conn.execute(
        "insert into core.observations (indicator_id, geo_level, geo_code, geo_vintage,"
        " period, value, run_id) values (?, ?, ?, ?, ?, ?, ?)",
        (INDICATEUR, niveau, code, MILLESIME, periode, valeur, run_id),
    )
    entrepot.finish_run(conn, run_id, "success")


@pytest.fixture
def conn(tmp_path):
    connexion = entrepot.connect(tmp_path / "e.duckdb")
    try:
        _socle(connexion)
        yield connexion
    finally:
        connexion.close()


def test_la_maille_chargee_ailleurs_declare_son_jeu(conn):
    """Le cas réel : la commune vient du jeu déclaré, le département d'un autre.

    C'est exactement le montage de `normalize/ofgl.py` — un run par maille, sous
    le jeu de cette maille, et un `dataset_id` unique pour l'indicateur.
    """
    _observer(conn, DECLARE, "commune", "33063", 417_137_958.52)
    _observer(conn, REEL, "departement", "33", 1_814_328_375.32)
    conn.commit()

    reels = publish.jeux_reels_par_niveau(conn)
    assert reels == {INDICATEUR: {"departement": REEL}}

    fiche = next(f for f in publish.indicateurs(conn, {}, {}) if f["id"] == INDICATEUR)
    # Le jeu déclaré reste ce qu'il est : c'est le repli du site, et la maille
    # commune y a droit puisque c'est vraiment sa source.
    assert fiche["jeu"] == DECLARE
    assert fiche["jeu_par_niveau"] == {"departement": REEL}
    assert "commune" not in fiche["jeu_par_niveau"]


def test_une_source_unique_ne_publie_rien(conn):
    """Trois cent quinze indicateurs sur trois cent quatre-vingt-six n'ont qu'une
    source : leur republier l'identité gonflerait le catalogue sans rien
    apprendre, et le site lit déjà `jeu`."""
    _observer(conn, DECLARE, "commune", "33063", 417_137_958.52)
    _observer(conn, DECLARE, "departement", "33", 1_814_328_375.32)
    conn.commit()

    assert publish.jeux_reels_par_niveau(conn) == {}
    fiche = next(f for f in publish.indicateurs(conn, {}, {}) if f["id"] == INDICATEUR)
    assert "jeu_par_niveau" not in fiche


def test_deux_jeux_pour_une_maille_se_taisent(conn):
    """Deux jeux qui ont écrit la même maille ne se résument pas à un nom.

    Le site retombe alors sur `jeu`, qui est ce qu'il faisait déjà : une source
    incomplète vaut mieux qu'une source choisie au hasard entre deux. Les deux
    exercices diffèrent parce que la clé primaire d'une observation ne porte pas
    le run : deux jeux ne se disputent une maille que sur deux périodes.
    """
    _observer(conn, REEL, "departement", "33", 1_814_328_375.32, "2025")
    _observer(conn, "ofgl-regions", "departement", "33", 1_700_000_000.0, "2024")
    conn.commit()

    assert publish.jeux_reels_par_niveau(conn) == {}


def test_un_indicateur_non_publie_reste_dehors(conn):
    """Le catalogue ne parle que de ce qu'il publie."""
    conn.execute("update core.indicators set published = false")
    _observer(conn, REEL, "departement", "33", 1_814_328_375.32)
    conn.commit()

    assert publish.jeux_reels_par_niveau(conn) == {}
