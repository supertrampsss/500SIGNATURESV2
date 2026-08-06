"""Les délais de paiement : une colonne mal nommée, et deux populations.

La source range un SIRET sous un nom de colonne `code_insee`. Lue au premier
degré, elle placerait chaque commune sur un territoire inexistant — sans rien
casser, puisque `21330063500017` est un identifiant parfaitement bien formé.
C'est le rattachement par SIREN, et le contrôle de couverture qui le mesure,
qui tiennent ce connecteur.
"""

from pathlib import Path

import pytest

from plateforme import couverture
from plateforme.normalize import delais_paiement as dp

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def contenu() -> bytes:
    return (FIXTURES / "dgfip_delais_paiement_sample.csv").read_bytes()


@pytest.fixture(scope="module")
def delais(contenu) -> dict[str, float]:
    return dp.lire(contenu)


def test_la_colonne_code_insee_contient_un_siret(delais):
    """Bordeaux y est `21330063500017`, pas `33063`. Neuf chiffres de SIREN en
    sortent ; les cinq derniers désignent l'établissement, pas le territoire."""
    assert "213300635" in delais
    assert delais["213300635"] == 19.85
    assert all(len(siren) == 9 for siren in delais)
    assert "33063" not in delais


def test_seules_les_communes_sont_demandees():
    """Le délai d'un service des eaux ou d'un CCAS n'est pas celui de la
    mairie. La requête ne demande que la commune."""
    assert "type_budget_collectivite%3D%27Commune%27" in dp.url()
    assert "dgp_annuel_moyen" in dp.url()


def test_une_ligne_sans_delai_est_ecartee():
    csv_ = (
        "﻿code_insee;libelle_budget_collectivite;dgp_annuel_moyen\n"
        "21330063500017;BORDEAUX;19.85\n"
        "21330245800012;LIGNAN;\n"
        "999;TRONQUE;12.0\n"
    ).encode()
    lus = dp.lire(csv_)
    assert lus == {"213300635": 19.85}


def test_la_distribution_ressemble_a_des_jours_de_commune(delais):
    verifies = dp.controler(delais)
    assert verifies["communes"] > 2000
    assert dp.MEDIANE_MINIMALE <= verifies["delai_median"] <= dp.MEDIANE_MAXIMALE
    assert verifies["delai_minimum"] > 0
    assert 0 < verifies["part_au_dela_du_delai_legal"] < 0.5


def test_le_controle_bloque_si_la_population_lue_change(delais):
    """Des budgets annexes entrés par erreur, ou une colonne exprimée en mois,
    décalent la médiane de tout le monde à la fois — c'est cela qu'on cherche,
    pas la commune la plus atypique."""
    en_mois = {siren: valeur / 31 for siren, valeur in delais.items()}
    with pytest.raises(dp.DelaiInvraisemblable, match="délai médian"):
        dp.controler(en_mois)
    triples = {siren: valeur * 3 for siren, valeur in delais.items()}
    with pytest.raises(dp.DelaiInvraisemblable, match="délai médian"):
        dp.controler(triples)


def test_le_controle_refuse_un_delai_negatif(delais):
    faux = {**delais, "999999999": -3.0}
    with pytest.raises(dp.DelaiInvraisemblable, match="ne précède pas sa"):
        dp.controler(faux)
    with pytest.raises(dp.DelaiInvraisemblable, match="aucun délai"):
        dp.controler({})


def test_une_commune_hors_referentiel_n_est_pas_ecrite(delais):
    lignes = dp.lignes_a_ecrire(delais, {"213300635": "33063"})
    assert lignes == [(dp.INDICATEUR, "commune", "33063", dp.MILLESIME, "2025", 19.85)]


def test_la_couverture_refuse_une_jointure_qui_decroche(delais):
    lus = {"commune": float(len(delais))}
    couverture.controler(lus, lus)
    with pytest.raises(couverture.CouvertureInsuffisante):
        couverture.controler(lus, {"commune": lus["commune"] * 0.5})


def test_la_fiche_dit_le_delai_legal_et_ce_que_le_chiffre_ne_dit_pas():
    assert "trente" in dp.PUBLIQUE
    assert len(dp.PUBLIQUE.split()) <= 50
    assert "budgets annexes" in dp.TECHNIQUE
    assert "pas une anomalie de la" in dp.TECHNIQUE
    assert "vertu budgétaire" in dp.TECHNIQUE


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    dp.declarer(entrepot_seme)
    dp.declarer(entrepot_seme)
    (unite, sommable) = entrepot_seme.execute(
        "select unit, additive from core.indicators where indicator_id = ?",
        (dp.INDICATEUR,),
    ).fetchone()
    # Un délai ne s'additionne pas entre communes, et ne se rapporte pas à
    # l'habitant : c'est une durée, pas un montant.
    assert unite == "jours"
    assert sommable is False
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, delais):
    from plateforme import entrepot, revisions

    dp.declarer(entrepot_seme)
    entrepot_seme.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code, siren, flags) values ('commune', '33063', ?,"
        " 'Bordeaux', null, null, '213300635', '{}')",
        (dp.MILLESIME,),
    )
    run_id = entrepot.start_run(entrepot_seme, dp.DATASET, "manual")
    sirens = dp.communes_par_siren(entrepot_seme)
    assert sirens == {"213300635": "33063"}
    ecrites, revisees = revisions.remplacer(
        entrepot_seme, run_id, [dp.INDICATEUR], dp.COLONNES,
        dp.lignes_a_ecrire(delais, sirens),
    )
    entrepot_seme.commit()
    assert ecrites == 1 and revisees == 0
    (valeur,) = entrepot_seme.execute(
        "select value from core.observations where indicator_id = ?"
        " and geo_code = '33063'", (dp.INDICATEUR,),
    ).fetchone()
    assert valeur == 19.85
