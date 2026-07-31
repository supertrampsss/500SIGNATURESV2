"""Le budget de l'État, lu hors réseau sur des extraits réels de la source.

Les fixtures sont des tranches du fichier publié par la DGFiP, encodage et
défauts compris : c'est ce qui permet de tester les deux anomalies réelles
rencontrées — la répartition corrompue des prélèvements sur recettes de la
LFI 2022 et la colonne « Exécution » décalée des textes législatifs.
"""

import json
from pathlib import Path

import pytest

from plateforme.connectors import smb
from plateforme.normalize import etat

FIXTURES = Path(__file__).parent / "fixtures"
SERIES = (FIXTURES / "smb_series_longues_sample.csv").read_bytes()
TEXTES = (FIXTURES / "smb_textes_legislatifs_sample.csv").read_bytes()
RECORDS = (FIXTURES / "smb_records_sample.json").read_bytes()


def test_lecture_des_pieces_jointes_utf16():
    periodes = smb.series_mensuelles(SERIES)
    assert set(periodes) == {"2022-11", "2022-12"}
    decembre = periodes["2022-12"]
    assert len(decembre) == 26
    assert decembre[smb.normaliser("Solde budgétaire")] == pytest.approx(-151_441_437_720, abs=1)


def test_libelles_normalises_apostrophe_et_espaces():
    # « Charges de la dette de l’Etat  » : apostrophe typographique et espaces finales.
    assert smb.normaliser("Charges de la dette de l’Etat  ") == "Charges de la dette de l'Etat"
    assert smb.normaliser("Solde des comptes spéciaux ") in smb.LIGNES


def test_toutes_les_lignes_de_la_source_sont_classees():
    valeurs = smb.series_mensuelles(SERIES)["2022-12"]
    assert smb.lignes_inconnues(valeurs) == []
    assert smb.lignes_inconnues({"Ligne inédite": 1.0}) == ["Ligne inédite"]


def test_records_api_lit_les_colonnes_mensuelles():
    periodes = smb.series_records(json.loads(RECORDS)["results"])
    assert set(periodes) == {"2024-12", "2026-05"}
    assert periodes["2024-12"][smb.normaliser(smb.SOLDE)] == pytest.approx(
        -155_929_972_365, abs=1
    )


def test_identite_du_solde_se_referme_sur_l_execution():
    ecarts = smb.controles(smb.series_mensuelles(SERIES)["2022-12"], fonds_de_concours=True)
    assert all(abs(ecart) < 1 for ecart in ecarts.values())


def test_les_fonds_de_concours_ne_s_ajoutent_pas_au_budget_vote():
    """Depuis 2024 la loi de finances évalue les fonds de concours dans une ligne
    dédiée, déjà comprise dans ses crédits : les ajouter compterait deux fois."""
    valeurs = {
        smb.normaliser(smb.SOLDE): -10.0,
        smb.normaliser("Total recettes nettes du budget général"): 90.0,
        smb.normaliser("Total dépenses nettes du budget général"): 100.0,
        smb.normaliser(smb.FONDS_DE_CONCOURS): 7.0,
    }
    assert smb.controles(valeurs, fonds_de_concours=False)["solde_budgetaire"] == 0
    assert smb.controles(valeurs, fonds_de_concours=True)["solde_budgetaire"] == -7.0


def test_un_total_sans_detail_publie_ne_declenche_pas_de_controle():
    """Une loi rectificative peut ne publier que ses totaux : absence complète
    du détail, contrôle sans objet — pas contrôle en échec."""
    valeurs = {smb.normaliser("Total recettes fiscales"): 350e9}
    assert "Total recettes fiscales" not in smb.controles(valeurs, fonds_de_concours=False)


def test_defaut_reel_de_la_lfi_2022_sur_les_prelevements_sur_recettes():
    """Dans le fichier du producteur, les deux prélèvements sur recettes de la
    LFI 2022 portent des montants qui ne sont pas les leurs. Le total, lui, est
    juste : le contrôle doit isoler la décomposition sans rejeter l'exercice."""
    votes = smb.textes_legislatifs(TEXTES)
    solde, quarantaine = etat.verifier(votes[("LFI", "2022")], fonds_de_concours=False)
    assert abs(solde) < smb.TOLERANCE_EUR  # l'identité du solde, elle, se referme
    assert quarantaine == [smb.normaliser("Total prélèvements sur recettes")]

    solde_2023, quarantaine_2023 = etat.verifier(votes[("LFI", "2023")], fonds_de_concours=False)
    assert abs(solde_2023) < smb.TOLERANCE_EUR
    assert quarantaine_2023 == []


def test_recoupement_entre_les_deux_fichiers_du_producteur():
    """La colonne « Exécution » des textes législatifs doit coïncider avec la
    colonne de décembre des séries mensuelles. Sur 2022 elle coïncide ; c'est ce
    même recoupement qui révèle le décalage de 2019 à 2021."""
    clos, _ = etat.exercices({"series_longues": SERIES, "records": RECORDS})
    votes = smb.textes_legislatifs(TEXTES)
    assert (smb.EXECUTION, "2022") in votes  # le texte est bien lu, pas filtré
    assert etat.recouper_execution(clos, votes) == {}

    decale = dict(votes)
    decale[(smb.EXECUTION, "2022")] = {
        **votes[(smb.EXECUTION, "2022")],
        smb.normaliser("Total dépenses nettes du budget général"): 1.0,
    }
    assert etat.recouper_execution(clos, decale) == {
        "2022": [smb.normaliser("Total dépenses nettes du budget général")]
    }


def test_la_quarantaine_ecarte_les_composantes_et_garde_le_total():
    ecartees = etat._composantes_ecartees([smb.normaliser("Total prélèvements sur recettes")])
    assert smb.normaliser("PSR au profit de l'Union européenne") in ecartees
    assert smb.normaliser("Total prélèvements sur recettes") not in ecartees
    assert smb.normaliser("Dépenses de personnel") not in ecartees


def test_seule_la_colonne_de_decembre_vaut_montant_annuel():
    """Les colonnes mensuelles portent un cumul depuis janvier : un exercice en
    cours n'a pas de montant annuel."""
    clos, dernier = etat.exercices(
        {"series_longues": SERIES, "records": RECORDS, "textes_2013_2023": TEXTES}
    )
    assert sorted(clos) == ["2022", "2024"]  # 2026 s'arrête en mai
    assert dernier == "2026-05"


def test_les_feuilles_recomposent_exactement_leurs_totaux():
    """C'est la propriété qui rend la table des lignes budgétaires sommable."""
    valeurs = smb.series_mensuelles(SERIES)["2022-12"]
    for total, composantes in smb.SOUS_TOTAUX.items():
        somme = sum(valeurs[smb.normaliser(c)] for c in composantes)
        assert somme == pytest.approx(valeurs[smb.normaliser(total)], abs=1), total
        # Un total n'est jamais une feuille, et ses composantes sont soit des
        # feuilles, soit des totaux eux-mêmes décomposés plus bas.
        assert not smb.LIGNES[smb.normaliser(total)].feuille
        for composante in composantes:
            assert smb.LIGNES[smb.normaliser(composante)].feuille or composante in smb.SOUS_TOTAUX

    # Les feuilles seules, sans aucun total, reconstituent les deux agrégats de tête.
    feuilles = [
        (libelle, ligne) for libelle, ligne in smb.LIGNES.items() if ligne.feuille
    ]
    recettes = sum(
        valeurs[libelle]
        for libelle, ligne in feuilles
        if ligne.cote == "recette" and libelle != smb.normaliser(smb.FONDS_DE_CONCOURS)
    )
    depenses = sum(valeurs[libelle] for libelle, ligne in feuilles if ligne.cote == "depense")
    assert recettes == pytest.approx(
        valeurs[smb.normaliser("Total recettes nettes du budget général")], abs=1
    )
    assert depenses == pytest.approx(
        valeurs[smb.normaliser("Total dépenses nettes du budget général")]
        + valeurs[smb.normaliser("Total prélèvements sur recettes")],
        abs=1,
    )


def test_chaque_indicateur_publie_a_une_fiche():
    references = {ligne.indicateur for ligne in smb.LIGNES.values() if ligne.indicateur}
    assert references == set(etat.INDICATEURS)
    for fiche in etat.INDICATEURS.values():
        # La charte plafonne la définition grand public à 50 mots (docs/06).
        assert len(fiche["public"].split()) <= 50
