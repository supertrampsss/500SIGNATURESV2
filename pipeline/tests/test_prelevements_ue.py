"""Les prélèvements obligatoires européens : l'identité, et les deux définitions.

La fixture est un extrait réel du jeu Eurostat `gov_10a_taxag` — neuf
territoires, deux unités, sept postes, douze exercices. Neuf territoires choisis
plutôt que neuf pris au hasard : la Bulgarie ne publie aucun D995 et l'Estonie
aucun D91, deux absences qui ne sont pas des lacunes mais des impôts qui
n'existent pas, et qui feraient tomber le contrôle si on les lisait comme telles.
"""

import json
from pathlib import Path

import pytest

from plateforme.connectors.jsonstat import decoder
from plateforme.normalize import prelevements_ue as p

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def points():
    return decoder(json.loads((FIXTURES / "eurostat_taxag_sample.json").read_bytes()))


def test_l_agregat_francais_2024_est_celui_d_eurostat(points):
    """1 318 860 M€ et 45,2 % du PIB : les deux chiffres que ce module existe
    pour publier, relevés sur la diffusion du 21 juillet 2026."""
    ventile = p.ventiler(points)
    assert ventile[("MIO_EUR", "FR", "2024")][p.AGREGAT] == 1_318_860.0
    assert ventile[("PC_GDP", "FR", "2024")][p.AGREGAT] == 45.2


def test_les_composantes_retrouvent_l_agregat_publie(points):
    """Le contrôle qui bloque, mené en millions d'euros : 453 677 + 366 049
    + 21 474 + 482 281 − 4 621 = 1 318 860, au million près et sans reste."""
    postes = p.ventiler(points)[("MIO_EUR", "FR", "2024")]
    assert postes["D2"] == 453_677.0
    assert postes["D5"] == 366_049.0
    assert postes["D91"] == 21_474.0
    assert postes["D61"] == 482_281.0
    assert postes[p.DEDUCTION] == 4_621.0
    somme = sum(postes[c] for c in p.COMPOSANTES) - postes[p.DEDUCTION]
    assert somme == postes[p.AGREGAT]

    verifies = p.controler(points)
    assert verifies["couples_verifies"] == 112
    assert verifies["identites_exactes"] == 65


def test_un_poste_absent_vaut_zero_et_non_serie_incomplete(points):
    """Quatorze pays ne publient aucun D995 et l'Estonie aucun D91 : l'impôt
    n'existe pas chez eux. Les écarter comme séries incomplètes viderait le
    classement de ses pays les moins taxés — exactement ceux qu'on vient
    regarder."""
    ventile = p.ventiler(points)
    assert p.DEDUCTION not in ventile[("MIO_EUR", "BG", "2024")]
    assert "D91" not in ventile[("MIO_EUR", "EE", "2024")]
    couples = {(geo, temps) for unite, geo, temps in ventile if unite == "MIO_EUR"}
    assert ("BG", "2024") in couples and ("EE", "2024") in couples


def test_le_controle_bloque_sur_un_poste_deplace(points):
    """Déplacer un milliard d'euros d'un poste à l'autre ne fait échouer aucune
    lecture : la somme change, l'agrégat non. C'est ce que ce contrôle voit."""
    fausses = [
        {**point, "valeur": point["valeur"] + 1000.0}
        if (point["unit"], point["geo"], point["time"], point["na_item"])
        == ("MIO_EUR", "FR", "2024", "D5")
        else point
        for point in points
    ]
    with pytest.raises(p.ComposantesDivergentes, match="FR/2024"):
        p.controler(fausses)
    with pytest.raises(p.ComposantesDivergentes, match="aucun couple"):
        p.controler([])


def test_l_ecart_entre_les_deux_definitions_est_mesure_et_non_affirme(points):
    """Le piège du jeu. Eurostat publie 45,2 % pour la France 2024, l'INSEE
    42,8 %. Le même jeu Eurostat publie 43,4 % en ne retenant que les
    cotisations obligatoires : 1,8 point d'écart, soit les cotisations sociales
    imputées de l'État employeur. Le reste tient aux crédits d'impôt, traités en
    subventions par Eurostat et en moindres recettes par l'INSEE."""
    ecarts = p.ecart_de_definition(points)
    assert ecarts["2024"] == 1.8
    assert p.ventiler(points)[("PC_GDP", "FR", "2024")][p.OBLIGATOIRES] == 43.4
    assert set(ecarts) == {str(an) for an in range(2013, 2025)}


def test_la_variante_obligatoire_et_la_deduction_ne_sont_pas_publiees(points):
    """Deux séries nommées « prélèvements obligatoires » sur une même page
    seraient pires que le piège qu'elles prétendent lever ; et D995 est une
    déduction, que l'afficher inviterait à additionner."""
    assert p.OBLIGATOIRES not in p.POSTES
    assert p.DEDUCTION not in p.POSTES
    ecrites = p.lignes_a_ecrire(points, {"FR"}, "run")
    assert {ligne[0] for ligne in ecrites} == {poste[0] for poste in p.POSTES.values()}


def test_les_fiches_nomment_la_definition_retenue_et_chiffrent_l_autre():
    """Une page qui affiche « le taux de prélèvements obligatoires » sans dire
    laquelle des deux définitions elle emploie est indéfendable."""
    assert "Définition retenue" in p.TECHNIQUE
    assert "42,8 %" in p.TECHNIQUE and "45,2 %" in p.TECHNIQUE
    assert "cotisations sociales imputées" in p.TECHNIQUE
    assert "crédits d'impôt" in p.TECHNIQUE
    # Le classement mesure un choix d'organisation, pas un niveau de ponction.
    assert "assurance privée obligatoire" in p.TECHNIQUE
    for poste, (_, _, publique) in p.POSTES.items():
        assert len(publique.split()) <= 50, poste


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    p.declarer(entrepot_seme)
    p.declarer(entrepot_seme)
    publies = dict(entrepot_seme.execute(
        "select indicator_id, unit from core.indicators where dataset_id = ?",
        (p.DATASET,),
    ).fetchall())
    assert set(publies) == {poste[0] for poste in p.POSTES.values()}
    assert set(publies.values()) == {"percent"}
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, points):
    from plateforme import entrepot, revisions
    from plateforme.normalize.europe import enregistrer_pays

    p.declarer(entrepot_seme)
    run_id = entrepot.start_run(entrepot_seme, p.DATASET, "manual")
    pays = enregistrer_pays(entrepot_seme, {point["geo"] for point in points})
    ecrites, _ = revisions.remplacer(
        entrepot_seme, run_id, sorted(poste[0] for poste in p.POSTES.values()),
        p.COLONNES, p.lignes_a_ecrire(points, pays, run_id),
    )
    entrepot_seme.commit()
    assert ecrites == 547, "cinq postes, neuf territoires, treize exercices, trous compris"
    (valeur,) = entrepot_seme.execute(
        "select value from core.observations"
        " where indicator_id = 'eurostat_prelevements_obligatoires_pib'"
        " and geo_code = 'FR' and period = '2024'"
    ).fetchone()
    assert valeur == 45.2
    # Sans jeu déclaré au registre, chacune de ces observations serait orpheline.
    assert not entrepot.verifier_integrite(entrepot_seme)


def test_le_jeu_est_declare_au_registre(entrepot_seme):
    """Rien ne peut s'écrire pour un jeu que le registre ignore : chaque
    observation compterait comme orpheline."""
    p.enregistrer_jeu(entrepot_seme)
    p.enregistrer_jeu(entrepot_seme)
    (source,) = entrepot_seme.execute(
        "select source_id from meta.dataset_registry where dataset_id = ?",
        (p.DATASET,),
    ).fetchone()
    assert source == "eurostat"
