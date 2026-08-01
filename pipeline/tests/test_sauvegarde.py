"""La vérification de restauration décide si une sauvegarde compte ou non."""

import pytest

from plateforme import sauvegarde


def test_les_schemas_du_projet_seulement():
    """Les schémas internes de Supabase ne nous appartiennent pas et ne se
    restaurent pas ailleurs."""
    assert set(sauvegarde.SCHEMAS) == {"meta", "geo", "core", "fin", "pub"}
    assert not any(s in sauvegarde.SCHEMAS for s in ("auth", "storage", "extensions"))


def test_les_temoins_couvrent_les_quatre_familles_du_modele():
    familles = {table.split(".")[0] for table in sauvegarde.TEMOINS}
    assert familles == {"meta", "geo", "core", "fin"}


def test_une_divergence_de_comptage_fait_echouer(monkeypatch):
    reponses = {
        "source": dict.fromkeys(sauvegarde.TEMOINS, 10),
        "copie": {**dict.fromkeys(sauvegarde.TEMOINS, 10), "core.observations": 9},
    }
    monkeypatch.setattr(sauvegarde, "comptages", lambda url: reponses[url])
    with pytest.raises(ValueError, match="restauration incomplète"):
        sauvegarde.verifier("source", "copie")


def test_une_base_vide_n_est_pas_une_sauvegarde(monkeypatch):
    vide = dict.fromkeys(sauvegarde.TEMOINS, 0)
    monkeypatch.setattr(sauvegarde, "comptages", lambda url: vide)
    with pytest.raises(ValueError, match="vide"):
        sauvegarde.verifier("source", "copie")


def test_des_comptages_identiques_passent(monkeypatch):
    plein = dict.fromkeys(sauvegarde.TEMOINS, 42)
    monkeypatch.setattr(sauvegarde, "comptages", lambda url: plein)
    assert sauvegarde.verifier("source", "copie") == plein
