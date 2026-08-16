"""Le cadrage des budgets locaux dit sur combien de territoires il porte.

Les trois volets s'intitulent « Le budget de **tous** les départements », « de
**toutes** les communes », « de **toutes** les régions » — et ils agrègent 97
départements sur 103, 34 778 communes sur 34 875, 17 régions sur 18. La
couverture est connue et acceptée ; ce qui manquait, c'est que l'écran ne la
disait pas. Le cadrage portait la source, le millésime et l'unité, jamais le
dénominateur, quand la règle du dépôt exige les quatre.
"""

import uuid

import pytest

from plateforme import entrepot, publish

DATASET = "ofgl-comptes"


@pytest.fixture
def entrepot_local(entrepot_seme):
    """Trois départements connus de la géographie, deux qui ont des comptes."""
    conn = entrepot_seme
    conn.execute(
        "insert or ignore into meta.dataset_registry (dataset_id, source_id, title,"
        " priority) values (?, 'ofgl', 'Comptes des collectivités', 'P1')",
        (DATASET,),
    )
    run_id = entrepot.start_run(conn, DATASET)
    for code, nom in (("33", "Gironde"), ("34", "Hérault"), ("40", "Landes")):
        conn.execute(
            "insert into geo.geography_reference (geo_level, geo_code, vintage, name)"
            " values ('departement', ?, 2025, ?)",
            (code, nom),
        )
    # Les totaux et leurs composantes directes : un nœud n'ouvre ses enfants que
    # s'ils lui redonnent son montant (`_arbre_verifie`), et sans enfants la
    # fonction ne publie rien du tout.
    for indicateur, libelle in (
        ("ofgl_depenses_totales", "Dépenses totales"),
        ("ofgl_depenses_fonctionnement", "Dépenses de fonctionnement"),
        ("ofgl_depenses_investissement", "Dépenses d'investissement"),
        ("ofgl_recettes_totales", "Recettes totales"),
        ("ofgl_recettes_fonctionnement", "Recettes de fonctionnement"),
        ("ofgl_recettes_d_investissement", "Recettes d'investissement"),
    ):
        conn.execute(
            "insert into core.indicators (indicator_id, dataset_id, theme, label_fr,"
            " unit) values (?, ?, 'finances_locales', ?, 'EUR')",
            (indicateur, DATASET, libelle),
        )
    # Deux départements sur les trois ont des comptes : la couverture est 2/3.
    for code in ("33", "34"):
        for indicateur, valeur in (
            ("ofgl_depenses_totales", 1_000e6),
            ("ofgl_depenses_fonctionnement", 700e6),
            ("ofgl_depenses_investissement", 300e6),
            ("ofgl_recettes_totales", 900e6),
            ("ofgl_recettes_fonctionnement", 600e6),
            ("ofgl_recettes_d_investissement", 300e6),
        ):
            conn.execute(
                "insert into core.observations (indicator_id, geo_level, geo_code,"
                " geo_vintage, period, value, run_id) values (?, 'departement', ?,"
                " 2025, '2025', ?, ?)",
                (indicateur, code, valeur, uuid.UUID(run_id) if isinstance(run_id, str) else run_id),
            )
    conn.commit()
    return conn


def test_le_cadrage_porte_le_denominateur(entrepot_local):
    """« 2 départements » ne dit pas s'il en manque. « sur 3 » le dit."""
    fichiers = publish.simulateur_collectivites(entrepot_local)
    cadre = fichiers["departement"]["cadre"]
    assert "2 départements sur 3" in cadre, cadre
    # La source, le millésime et l'unité restent : la règle en demande quatre.
    assert "2025" in cadre and "OFGL" in cadre.upper() or "Observatoire" in cadre
    assert "millions d'euros" in cadre
