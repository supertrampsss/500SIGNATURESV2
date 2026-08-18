"""Les défaillances : ce que la graine doit vérifier pour ne pas mentir.

Le Stat Info se recopie à la main, et une recopie ne se relit pas. Ce sont donc
les identités du tableau qui font foi : les tailles somment exactement à
l'ensemble, les secteurs somment un peu plus bas — la source range les unités au
secteur inconnu dans l'ensemble et nulle part ailleurs.
"""

import pytest

from plateforme import entrepot, registry
from plateforme.normalize import defaillances


@pytest.fixture
def entrepot_neuf(tmp_path):
    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    registry.sync(conn)
    yield conn
    conn.close()


def test_la_graine_se_lit_et_ses_identites_se_referment():
    lignes = defaillances.lire()
    assert len(lignes) == 17, [ligne["cle"] for ligne in lignes]
    defaillances.controler(lignes)


def test_une_taille_mal_recopiee_est_refusee():
    """Les cinq tailles somment EXACTEMENT à l'ensemble. Un chiffre mal relu
    passerait autrement pour une donnée."""
    lignes = [dict(ligne) for ligne in defaillances.lire()]
    for ligne in lignes:
        if ligne["cle"] == "tpe":
            ligne["cumul_2026_06"] = str(int(ligne["cumul_2026_06"]) - 300)
    with pytest.raises(ValueError, match="les tailles somment"):
        defaillances.controler(lignes)


def test_un_secteur_oublie_est_refuse():
    """Les secteurs somment plus bas que l'ensemble — la source y range les
    unités au secteur inconnu — mais de moins d'un pour cent. Une ligne oubliée
    creuse un trou bien plus large."""
    lignes = [ligne for ligne in defaillances.lire() if ligne["cle"] != "fz"]
    with pytest.raises(ValueError, match="secteurs somment"):
        defaillances.controler(lignes)


def test_les_secteurs_ne_depassent_jamais_l_ensemble():
    lignes = [dict(ligne) for ligne in defaillances.lire()]
    for ligne in lignes:
        if ligne["cle"] == "fz":
            ligne["cumul_2026_06"] = str(int(ligne["cumul_2026_06"]) + 30000)
    with pytest.raises(ValueError, match="secteurs somment"):
        defaillances.controler(lignes)


def test_les_trois_periodes_sont_nommees_pour_ce_qu_elles_sont():
    """La moyenne décennale n'est pas un mois : sa période le dit en toutes
    lettres, plutôt que d'être rangée sous un millésime qu'elle n'a pas."""
    assert defaillances.PERIODES["moyenne_2010_2019"] == "2010-2019"
    assert defaillances.PERIODES["cumul_2025_06"] == "2025-06"
    assert defaillances.PERIODES["cumul_2026_06"] == "2026-06"


def test_toutes_les_series_sont_declarees_et_publiees(entrepot_neuf):
    defaillances.declarer(entrepot_neuf)
    publies = {
        identifiant
        for (identifiant,) in entrepot_neuf.execute(
            "select indicator_id from core.indicators where published"
        ).fetchall()
    }
    attendus = {defaillances.identifiant(ligne) for ligne in defaillances.lire()}
    assert attendus <= publies, attendus - publies


def test_le_fait_que_l_agregat_cache_est_dans_le_module():
    """L'agrégat affiche +19,3 % quand les entreprises hors micro font +71 %.
    C'est la raison d'être de ce module, et elle est écrite dedans — sans quoi
    le prochain lecteur le remplacera par l'indice d'Eurostat, qui ne la dit
    pas."""
    source = (defaillances.GRAINE.parents[2] / "pipeline/plateforme/normalize/defaillances.py").read_text(
        encoding="utf-8"
    )
    assert "71,2 %" in source
    assert "5 621" in source
