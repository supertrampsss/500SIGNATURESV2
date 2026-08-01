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


def test_une_base_qui_bouge_pendant_le_dump_ne_dit_pas_restauration_incomplete(monkeypatch):
    """Le dump reste fidèle à l'instant sauvegardé : accuser la restauration
    enverrait chercher un bug là où il n'y en a pas."""
    avant = dict.fromkeys(sauvegarde.TEMOINS, 10)
    apres = {**avant, "core.observations": 12}
    monkeypatch.setattr(sauvegarde, "comptages", lambda url: {"source": apres, "copie": avant}[url])
    with pytest.raises(ValueError, match="changé pendant le dump"):
        sauvegarde.verifier("source", "copie", avant)


@pytest.mark.parametrize(
    ("sortie", "attendu"),
    [
        ("pg_dump (PostgreSQL) 17.6\n", 17),
        ("pg_dump (PostgreSQL) 16.14 (Ubuntu 16.14-1.pgdg24.04+1)\n", 16),
        ("pg_dump (PostgreSQL) 18.0 (Debian 18.0-1.pgdg13+1)\n", 18),
    ],
)
def test_la_version_du_client_se_lit_quel_que_soit_le_paquet(monkeypatch, sortie, attendu):
    """Debian ajoute son propre numéro derrière celui de PostgreSQL : prendre le
    dernier mot donnerait `16.14-1.pgdg24.04+1)`."""
    monkeypatch.setattr(sauvegarde, "_executer", lambda commande: sortie)
    assert sauvegarde.version_client() == attendu


def test_un_client_trop_ancien_dit_lequel_installer(monkeypatch):
    """L'échec réel — `aborting because of server version mismatch` — ne nomme
    ni la version à installer ni le fichier à corriger. Celui-ci, si."""
    monkeypatch.setattr(sauvegarde, "version_majeure", lambda url: 17)
    monkeypatch.setattr(sauvegarde, "version_client", lambda: 16)
    with pytest.raises(RuntimeError, match="postgresql-client-17"):
        sauvegarde.controler_versions("source", "cible")


def test_une_base_de_verification_trop_ancienne_est_refusee(monkeypatch):
    versions = {"source": 17, "cible": 16}
    monkeypatch.setattr(sauvegarde, "version_majeure", lambda url: versions[url])
    monkeypatch.setattr(sauvegarde, "version_client", lambda: 17)
    with pytest.raises(RuntimeError, match="postgis/postgis:17-3.5"):
        sauvegarde.controler_versions("source", "cible")


def test_des_versions_plus_recentes_que_la_source_passent(monkeypatch):
    """Lire un dump plus ancien est sans risque ; seul l'inverse casse."""
    versions = {"source": 17, "cible": 18}
    monkeypatch.setattr(sauvegarde, "version_majeure", lambda url: versions[url])
    monkeypatch.setattr(sauvegarde, "version_client", lambda: 18)
    assert sauvegarde.controler_versions("source", "cible") == 17
