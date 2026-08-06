"""Le REI : trois lignes de la source confrontées entre elles.

Ce jeu ne se contrôle pas comme les autres. Il n'a pas de total à retrouver —
il a une identité comptable, base × taux = produit, que la source vérifie mal
elle-même : trois cents communes s'en écartent de plus d'un pour cent pour des
corrections qu'elle n'expose pas. Le contrôle porte donc sur la distribution,
et c'est lui qui a attrapé le défaut le plus discret de cette source.
"""

import urllib.parse
from pathlib import Path

import pytest

from plateforme import couverture
from plateforme.normalize import impots_locaux as il

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def contenu() -> bytes:
    return (FIXTURES / "ofgl_rei_sample.csv").read_bytes()


@pytest.fixture(scope="module")
def lignes(contenu) -> dict:
    return il.lire(contenu)


def test_le_bom_ne_mange_pas_l_exercice(lignes):
    """L'export de l'OFGL commence par un BOM, qui se colle au nom de la
    première colonne. Lu en `utf-8` simple, `annee` revient vide et les deux
    exercices s'écrasent sous la même clé — la base d'une année se retrouve
    comparée au produit de l'autre. C'est le contrôle base × taux qui l'a
    signalé ; aucun total ne l'aurait montré."""
    exercices = {annee for _, annee, _ in lignes}
    assert exercices == {"2024", "2025"}
    assert "" not in exercices


def test_une_valeur_sous_secret_est_absente_et_non_nulle():
    csv_ = (
        "﻿annee;idcom;varlib;valeur;secret_statistique\n"
        "2025;33063;FB - COMMUNE / MONTANT RÉEL;;sec_stat\n"
        "2025;33063;FNB - COMMUNE / MONTANT RÉEL;100;\n"
    ).encode()
    lus = il.lire(csv_)
    assert ("33063", "2025", "FB - COMMUNE / MONTANT RÉEL") not in lus
    assert lus[("33063", "2025", "FNB - COMMUNE / MONTANT RÉEL")] == 100.0


def test_seuls_les_produits_communaux_sont_publies(lignes):
    """La même base décrit ce qui revient à l'intercommunalité, au département
    et aux chambres consulaires. La requête ne demande que la commune, et seuls
    les quatre produits sortent — la base, le taux et le lissage sont lus pour
    le contrôle, pas pour la publication."""
    publies = {cle for cle, _, _, _, _ in il.valeurs_publiees(lignes)}
    assert publies == {identifiant for identifiant, _ in il.PRODUITS.values()}
    assert urllib.parse.quote("destinataire='Commune'") in il.url((il.PRODUIT_FB,))


def test_l_identite_tient_en_masse_et_au_total(lignes):
    verifies = il.controler(lignes)
    assert verifies["communes_verifiees"] > 500
    assert verifies["ecart_median"] <= il.ECART_MEDIAN_MAXIMUM
    assert verifies["part_sous_un_pourcent"] >= il.PART_MINIMALE_SOUS_UN_POURCENT
    assert verifies["ecart_agrege"] <= il.ECART_AGREGE_MAXIMUM


def test_le_controle_bloque_si_toutes_les_communes_decrochent(lignes):
    """Un taux lu sur la ligne du département, ou une base prise sur un autre
    impôt, décale toutes les communes à la fois : c'est cela que le contrôle
    cherche, pas la commune la plus atypique."""
    fausses = {
        cle: (valeur * 2 if cle[2] == il.TAUX_FB else valeur)
        for cle, valeur in lignes.items()
    }
    with pytest.raises(il.IdentiteRompue, match="écart médian"):
        il.controler(fausses)


def test_le_controle_bloque_si_la_somme_France_decroche(lignes):
    """Une poignée de communes très grosses peut décrocher sans bouger la
    médiane : la somme les rattrape."""
    plus_grosse = max(
        (cle for cle in lignes if cle[2] == il.PRODUIT_FB),
        key=lambda cle: lignes[cle],
    )
    fausses = dict(lignes)
    fausses[plus_grosse] = lignes[plus_grosse] * 3
    with pytest.raises(il.IdentiteRompue, match="somme France"):
        il.controler(fausses)


def test_le_controle_echoue_s_il_n_a_rien_a_verifier():
    with pytest.raises(il.IdentiteRompue, match="aucune commune"):
        il.controler({})


def test_bordeaux_n_a_pas_de_produit_de_CFE(lignes):
    """Sa métropole la lève à sa place. Zéro ne veut pas dire aucune
    entreprise, et c'est la première chose que dit la fiche."""
    bordeaux = {
        variable: valeur
        for (code, annee, variable), valeur in lignes.items()
        if code == "33063" and annee == "2025"
    }
    assert bordeaux["FB - COMMUNE / MONTANT RÉEL"] == 248422691.0
    assert bordeaux["TH - COMMUNE / MONTANT RÉEL THS"] == 6334778.0
    assert "CFE - COMMUNE / PRODUIT RÉEL" not in bordeaux
    assert "intercommunalité" in il.PUBLIQUE["dgfip_produit_cfe"]


def test_les_fiches_disent_la_taxe_d_habitation_supprimee():
    assert "résidences secondaires" in il.PUBLIQUE[
        "dgfip_produit_th_residences_secondaires"
    ]
    assert "supprimée pour tous en 2023" in il.PUBLIQUE[
        "dgfip_produit_th_residences_secondaires"
    ]
    assert "supprimée" in il.TECHNIQUE
    assert "ne sont pas la décomposition" in il.TECHNIQUE
    for identifiant, publique in il.PUBLIQUE.items():
        assert len(publique.split()) <= 50, identifiant


def test_la_couverture_se_mesure_en_euros(lignes):
    candidates = il.valeurs_publiees(lignes)
    lus = il.foncier_par_maille(candidates)
    assert lus["commune"] > 0
    couverture.controler(lus, lus)
    with pytest.raises(couverture.CouvertureInsuffisante):
        couverture.controler(lus, {"commune": lus["commune"] * 0.5})


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    il.declarer(entrepot_seme)
    il.declarer(entrepot_seme)
    publies = dict(entrepot_seme.execute(
        "select indicator_id, unit from core.indicators where dataset_id = ?",
        (il.DATASET,),
    ).fetchall())
    assert set(publies) == {identifiant for identifiant, _ in il.PRODUITS.values()}
    assert set(publies.values()) == {"EUR"}
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, lignes):
    from plateforme import entrepot

    il.declarer(entrepot_seme)
    entrepot_seme.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code, flags) values ('commune', '33063', ?, 'Bordeaux',"
        " null, null, '{}')",
        (il.MILLESIME,),
    )
    run_id = entrepot.start_run(entrepot_seme, il.DATASET, "manual")
    ecrites, ecartes, reconnus = il.ecrire(entrepot_seme, run_id, lignes)
    entrepot_seme.commit()
    assert ecrites > 0 and ecartes > 0, "les communes hors référentiel sont écartées"
    (valeur,) = entrepot_seme.execute(
        "select value from core.observations"
        " where indicator_id = 'dgfip_produit_foncier_bati' and geo_code = '33063'"
        " and period = '2025'"
    ).fetchone()
    assert valeur == 248422691.0
    assert reconnus["commune"] > 0
