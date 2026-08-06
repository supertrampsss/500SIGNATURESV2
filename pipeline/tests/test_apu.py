"""Le solde public : trois chiffres voisins qu'il ne faut pas confondre.

Le site publie déjà un solde budgétaire de l'État et une dette publique. Ce
module en ajoute un troisième, le déficit au sens de Maastricht, et le seul
risque de ce jeu est qu'un lecteur prenne l'un pour l'autre — ou que le
connecteur charge un agrégat dont il ne sait pas nommer le périmètre.
"""

import json
from pathlib import Path

import pytest

from plateforme.normalize import apu

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def charges() -> dict[str, bytes]:
    brut = json.loads((FIXTURES / "insee_apu_b9_sample.json").read_text("utf-8"))
    return {secteur: json.dumps(charge).encode() for secteur, charge in brut.items()}


@pytest.fixture(scope="module")
def series(charges) -> dict:
    return apu.lire(charges)


def test_les_quatre_sous_secteurs_sont_lus(series):
    assert set(series) == set(apu.SOUS_SECTEURS)
    assert all(soldes for soldes in series.values())


def test_le_solde_est_en_euros_pas_en_millions(series):
    """La source publie en millions ; le site publie en euros, comme la dette
    et le budget de l'État. Sans le facteur, un déficit de 169 milliards
    s'afficherait à 169 mille."""
    assert series["S13"]["2024"] == -169118100000.0


def test_un_deficit_reste_negatif(series):
    """La source publie une capacité (+) ou un besoin (−) de financement. Le
    retourner pour l'afficher « en positif » rendrait incomparables les rares
    exercices excédentaires."""
    assert series["S13"]["2024"] < 0
    assert series["S1314"]["2024"] > 0, "la Sécurité sociale est excédentaire en 2024"


def test_les_sous_secteurs_font_l_ensemble(series):
    verifies = apu.controler(series)
    assert verifies["les_sous_secteurs_font_l_ensemble"] > 5


def test_le_controle_bloque_si_un_sous_secteur_double():
    with pytest.raises(apu.IdentiteRompue, match="manque ou double"):
        # En euros : la tolérance vaut un demi-million, l'écart cinquante
        # milliards. Un sous-secteur compté deux fois se voit à cette échelle.
        apu.controler({
            "S13": {"2024": -100e9},
            "S1311": {"2024": -80e9},
            "S1313": {"2024": -20e9},
            "S1314": {"2024": -50e9},
        })


def test_le_controle_saute_un_exercice_incomplet_mais_exige_d_en_avoir_verifie():
    """La source ne remonte pas aussi loin pour tous les sous-secteurs : sauter
    l'exercice incomplet est juste, ne rien vérifier du tout ne l'est pas."""
    assert apu.controler({
        "S13": {"1960": -1e9, "2024": -100e9},
        "S1311": {"2024": -80e9},
        "S1313": {"2024": -20e9},
        "S1314": {"2024": 0.0},
    }) == {"les_sous_secteurs_font_l_ensemble": 1}
    with pytest.raises(apu.IdentiteRompue, match="aucun exercice"):
        apu.controler({"S13": {"1960": -1e9}, "S1311": {}, "S1313": {}, "S1314": {}})


def test_les_filtres_ecartent_les_contreparties_et_les_conventions(charges):
    """La source décline le même solde face à huit contreparties et sous
    plusieurs conventions de consolidation. Sans filtre, le déficit serait
    compté huit fois sous le même identifiant."""
    brut = json.loads(charges["S13"].decode())
    total = len(brut["observations"])
    lus = len(apu.lire({"S13": charges["S13"]})["S13"])
    assert lus < total, "le filtre doit écarter la majorité des croisements"
    assert apu.FILTRES["COUNTERPART_SECTOR"] == "S1"
    assert apu.FILTRES["CONSOLIDATION"] == "C"


def test_les_lignes_suivent_les_colonnes_declarees(series):
    """Le défaut qui a fait échouer l'IPC en production : cinq clés plus les
    colonnes déclarées, pas un champ de plus."""
    from plateforme import revisions

    lignes = apu.lignes_a_ecrire(series)
    assert lignes
    attendue = len(revisions.CLES) + len(apu.COLONNES)
    assert all(len(ligne) == attendue for ligne in lignes)


def test_la_fiche_distingue_le_solde_public_du_budget_de_l_etat():
    assert "comptabilité nationale et non" in apu.TECHNIQUE
    assert "solde budgétaire de l'État" in apu.TECHNIQUE
    assert "la dette un encours accumulé" in apu.TECHNIQUE
    assert "administrations centrales réunit l'État" in apu.TECHNIQUE
    for _, (identifiant, _, publique) in apu.SOUS_SECTEURS.items():
        assert len(publique.split()) <= 50, identifiant
        assert "déficit" in publique


def test_les_recettes_et_depenses_totales_ne_sont_pas_chargees():
    """Leurs valeurs ne retrouvent pas les chiffres publics connus et la source
    ne documente pas leur périmètre de consolidation. Un agrégat dont on ne
    peut pas nommer le dénominateur n'est pas publié — même règle que pour les
    agrégats OFGL sans définition."""
    assert apu.STO == "B9"
    identifiants = {i for i, _, _ in apu.SOUS_SECTEURS.values()}
    assert not any("recette" in i or "depense" in i for i in identifiants)
    assert "ne retrouvent pas" in apu.__doc__


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, series):
    from plateforme import entrepot, revisions

    apu.declarer(entrepot_seme)
    entrepot_seme.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code, flags) values ('pays', 'FR', ?, 'France',"
        " null, null, '{}')",
        (apu.MILLESIME,),
    )
    run_id = entrepot.start_run(entrepot_seme, apu.DATASET, "manual")
    lignes = apu.lignes_a_ecrire(series)
    ecrites, _ = revisions.remplacer(
        entrepot_seme, run_id,
        [i for i, _, _ in apu.SOUS_SECTEURS.values()], apu.COLONNES, lignes,
    )
    entrepot_seme.commit()
    assert ecrites == len(lignes)
    (valeur,) = entrepot_seme.execute(
        "select value from core.observations where indicator_id = 'insee_apu_solde'"
        " and period = '2024'"
    ).fetchone()
    assert valeur == -169118100000.0


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    apu.declarer(entrepot_seme)
    apu.declarer(entrepot_seme)
    lignes = dict(entrepot_seme.execute(
        "select indicator_id, unit from core.indicators where dataset_id = ?",
        (apu.DATASET,),
    ).fetchall())
    assert set(lignes) == {i for i, _, _ in apu.SOUS_SECTEURS.values()}
    assert set(lignes.values()) == {"EUR"}
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0
