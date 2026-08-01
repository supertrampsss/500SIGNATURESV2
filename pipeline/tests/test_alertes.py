"""Une alerte qui se déclenche pour rien apprend à être ignorée. Ces tests
vérifient qu'elle ne parle que quand il y a quelque chose à faire."""

import datetime as dt

from plateforme import alertes


class FausseConnexion:
    """Rend les lignes telles que la requête les produirait."""

    def __init__(self, lignes):
        self.lignes = lignes

    def execute(self, sql, params=None):
        return self.lignes


HIER = dt.datetime(2026, 7, 31, 4, 0, tzinfo=dt.UTC)


def ligne(jeu="ofgl-communes", retard=None, statut="success", bloquants=0):
    return (jeu, f"Titre de {jeu}", "annuelle", HIER, retard, statut, bloquants)


def test_un_jeu_en_ordre_n_est_pas_liste():
    assert alertes.collecter(FausseConnexion([ligne()])) == []


def test_un_retard_au_dela_de_la_tolerance_alerte():
    [alerte] = alertes.collecter(FausseConnexion([ligne(retard=12)]))
    assert "12 j" in alerte["motifs"][0]
    assert alerte["derniere_extraction"] == "2026-07-31"


def test_un_retard_nul_n_alerte_pas():
    """`greatest(0, …)` rend 0 tant que la tolérance n'est pas dépassée : une
    source annuelle n'est pas en panne les 364 premiers jours."""
    assert alertes.collecter(FausseConnexion([ligne(retard=0)])) == []


def test_un_chargement_en_echec_alerte():
    [alerte] = alertes.collecter(FausseConnexion([ligne(statut="failed")]))
    assert alerte["motifs"] == ["le dernier chargement a échoué"]


def test_les_controles_bloquants_du_dernier_run_alertent():
    [alerte] = alertes.collecter(FausseConnexion([ligne(bloquants=2)]))
    assert "2 contrôles bloquants" in alerte["motifs"][0]
    [seul] = alertes.collecter(FausseConnexion([ligne(bloquants=1)]))
    assert "1 contrôle bloquant en échec" in seul["motifs"][0]


def test_les_motifs_se_cumulent():
    [alerte] = alertes.collecter(FausseConnexion([ligne(retard=5, statut="failed", bloquants=1)]))
    assert len(alerte["motifs"]) == 3


def test_le_markdown_du_calme_ne_ressemble_pas_a_une_alerte():
    texte = alertes.markdown([])
    assert "fenêtre de fraîcheur" in texte
    assert "###" not in texte


def test_le_markdown_nomme_le_jeu_et_ses_motifs():
    texte = alertes.markdown(alertes.collecter(FausseConnexion([ligne(retard=9)])))
    assert "`ofgl-communes`" in texte
    assert "9 j" in texte
    # le ton : un retard n'est pas accusé d'être une panne
    assert "n'est pas forcément une" in texte
