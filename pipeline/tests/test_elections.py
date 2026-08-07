"""Élections : ce qui est chargé, et surtout ce qui ne l'est pas.

Le fichier du ministère porte, pour chaque commune, le nom de chaque tête de
liste, sa nuance politique, ses voix et ses sièges. Ce module n'en charge aucun.
Ce n'est pas une limite technique mais une décision, et ces tests la tiennent :
une colonne de nuance qui entrerait un jour par inadvertance doit faire échouer
la suite, pas passer inaperçue.
"""

from pathlib import Path

import pytest

from plateforme import couverture
from plateforme.normalize import elections

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def contenu() -> bytes:
    return (FIXTURES / "interieur_municipales_sample.csv").read_bytes()


@pytest.fixture(scope="module")
def lignes(contenu) -> list[dict]:
    return elections.lire(contenu)


def test_seule_la_participation_est_lue(contenu, lignes):
    """Le fichier compte 187 colonnes, dont 169 décrivent les listes et leurs
    têtes de liste. Huit sont lues, et le reste ne doit jamais entrer."""
    entete = contenu.decode("utf-8").split("\n")[0]
    assert "Nuance liste 1" in entete, "la fixture doit porter les colonnes refusées"
    assert "Nom candidat 1" in entete
    interdits = {"nuance", "nom", "prenom", "prénom", "voix", "sieges", "sièges", "elu"}
    for ligne in lignes:
        assert not (set(ligne) & interdits), ligne.keys()
    assert set(lignes[0]) == {
        "code", "inscrits", "votants", "abstentions", "exprimes", "blancs", "nuls",
        "taux_publie",
    }


def test_aucun_indicateur_ne_porte_de_nuance_politique():
    """La liste des indicateurs publiés est la garantie la plus simple : rien
    qui nomme un camp, une liste ou un candidat."""
    interdits = ("nuance", "liste", "candidat", "voix", "siege", "elu", "gauche",
                 "droite", "centre")
    for cle, (libelle, *_) in elections.INDICATEURS.items():
        for mot in interdits:
            assert mot not in cle, cle
            assert mot not in libelle.lower(), libelle


def test_la_fiche_technique_dit_pourquoi_les_nuances_ne_sont_pas_publiees():
    assert "nuance" in elections.TECHNIQUE
    assert "préfectures" in elections.TECHNIQUE
    assert "3 500 habitants" in elections.TECHNIQUE
    assert "premier tour" in elections.TECHNIQUE
    for cle, (_, _, _, publique, _) in elections.INDICATEURS.items():
        assert len(publique.split()) <= 50, cle


def test_les_trois_identites_se_referment(lignes):
    verifies = elections.controler(lignes)
    assert set(verifies) == {
        "inscrits_font_votants_et_abstentions",
        "votants_font_exprimes_blancs_et_nuls",
        "le_taux_recalcule_egale_le_taux_publie",
    }
    assert all(compte == len(lignes) for compte in verifies.values())


def _commune(**champs) -> dict:
    base = {"code": "33063", "inscrits": 100, "votants": 60, "abstentions": 40,
            "exprimes": 55, "blancs": 3, "nuls": 2, "taux_publie": 60.0}
    return {**base, **champs}


def test_le_controle_bloque_si_les_abstentions_ne_bouclent_plus():
    with pytest.raises(elections.IdentiteRompue, match="abstentions"):
        elections.controler([_commune(abstentions=30)])


def test_le_controle_bloque_si_les_blancs_et_nuls_ne_bouclent_plus():
    with pytest.raises(elections.IdentiteRompue, match="exprimés"):
        elections.controler([_commune(exprimes=50)])


def test_le_controle_attrape_une_colonne_qui_a_glisse():
    """Les deux premières identités ne comparent la source qu'à elle-même : si
    « Votants » et « Exprimés » avaient été lues à l'envers, elles se
    refermeraient encore. Le taux publié par le ministère est le seul repère
    extérieur au calcul."""
    with pytest.raises(elections.IdentiteRompue, match="colonne a glissé"):
        elections.controler([_commune(taux_publie=42.0)])


def test_une_commune_sans_inscrit_n_a_pas_de_taux():
    """Diviser par zéro produirait un taux, pas une absence."""
    valeurs = elections.valeurs_publiees([
        _commune(code="00000", inscrits=0, votants=0, abstentions=0,
                 exprimes=0, blancs=0, nuls=0, taux_publie=0.0)
    ])
    assert {cle for cle, *_ in valeurs} == {
        "elections_inscrits", "elections_votants", "elections_blancs", "elections_nuls"
    }


def test_le_taux_n_est_pas_additif():
    """Un taux de participation ne s'additionne pas d'une commune à l'autre :
    déclaré additif, il serait rapporté aux habitants et comparé en médiane
    comme un effectif."""
    assert "elections_taux_participation" not in elections.ADDITIFS
    assert elections.ADDITIFS == {
        "elections_inscrits", "elections_votants", "elections_blancs", "elections_nuls"
    }


def test_les_valeurs_de_bordeaux(lignes):
    valeurs = {cle: valeur for cle, _, code, _, valeur in
               elections.valeurs_publiees(lignes) if code == "33063"}
    assert valeurs["elections_inscrits"] == 174137
    assert valeurs["elections_votants"] == 101141
    assert round(valeurs["elections_taux_participation"], 2) == 58.08


def test_la_couverture_se_mesure_en_inscrits(lignes):
    """La fixture porte une commune de Nouvelle-Calédonie, absente du
    référentiel du site : c'est une absence normale, et le seuil de 95 % est
    précisément là pour la laisser passer sans laisser passer un format de code
    qui aurait glissé."""
    candidates = elections.valeurs_publiees(lignes)
    lus = elections.inscrits_par_maille(candidates)
    assert lus["commune"] == elections.totaux(lignes)["inscrits"]
    couverture.controler(lus, lus)
    with pytest.raises(couverture.CouvertureInsuffisante):
        couverture.controler(lus, {"commune": lus["commune"] * 0.5})


def test_l_url_est_retrouvee_par_le_titre_pas_codee_en_dur(monkeypatch):
    """L'URL porte l'horodatage du dépôt et change à chaque correction du
    ministère. La coder en dur ferait recharger un fichier périmé — ou rien."""
    monkeypatch.setattr(
        elections.datagouv, "get_dataset",
        lambda _: {"resources": [
            {"title": "Municipales 2026 - Candidats Elus - Tour 1", "url": "non"},
            {"title": "Municipales 2026 - Résultats - Communes_2026-03-20.csv",
             "url": "oui"},
        ]},
    )
    assert elections.url_ressource() == "oui"


def test_un_fichier_renomme_arrete_le_chargement(monkeypatch):
    monkeypatch.setattr(
        elections.datagouv, "get_dataset",
        lambda _: {"resources": [{"title": "autre chose", "url": "x"}]},
    )
    with pytest.raises(ValueError, match="renommé"):
        elections.url_ressource()


def test_un_fichier_ampute_d_une_colonne_arrete_le_chargement():
    with pytest.raises(ValueError, match="colonnes absentes"):
        elections.lire(b'"Code commune";"Inscrits"\n"33063";"100"\n')


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    elections.declarer(entrepot_seme)
    elections.declarer(entrepot_seme)
    publies = dict(entrepot_seme.execute(
        "select indicator_id, additive from core.indicators where dataset_id = ?",
        (elections.DATASET,),
    ).fetchall())
    assert set(publies) == set(elections.INDICATEURS)
    assert publies["elections_taux_participation"] is False
    assert publies["elections_inscrits"] is True
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_le_taux_de_participation_est_un_pourcentage(entrepot_seme):
    """Le site ne connaît pas l'unité `rate` : il affichait « 58,1 rate ».

    L'unité servait à deux choses — le format d'affichage et le fait que le
    taux soit notre division et non le chiffre de la source. Ce sont deux
    questions différentes, et la seconde a désormais sa propre liste.
    """
    elections.declarer(entrepot_seme)
    unite, = entrepot_seme.execute(
        "select unit from core.indicators where indicator_id = 'elections_taux_participation'"
    ).fetchone()
    assert unite == "percent"
    niveau, = entrepot_seme.execute(
        "select d.confidence_level from core.indicators i"
        " join core.indicator_definitions d using (definition_id)"
        " where i.indicator_id = 'elections_taux_participation'"
    ).fetchone()
    assert niveau == "computed"
    observes = entrepot_seme.execute(
        "select count(*) from core.indicators i"
        " join core.indicator_definitions d using (definition_id)"
        " where i.dataset_id = ? and d.confidence_level = 'observed'",
        (elections.DATASET,),
    ).fetchone()[0]
    assert observes == len(elections.INDICATEURS) - 1


def test_une_unite_corrigee_se_propage_a_la_redeclaration(entrepot_seme):
    """`on conflict do update` ne touchait pas `unit` : une correction d'unité
    ne pouvait pas atteindre un indicateur déjà déclaré, et la seule façon de
    la faire prendre était de toucher la base à la main."""
    elections.declarer(entrepot_seme)
    entrepot_seme.execute(
        "update core.indicators set unit = 'rate'"
        " where indicator_id = 'elections_taux_participation'"
    )
    elections.declarer(entrepot_seme)
    unite, = entrepot_seme.execute(
        "select unit from core.indicators where indicator_id = 'elections_taux_participation'"
    ).fetchone()
    assert unite == "percent"
