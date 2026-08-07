"""Les droits de mutation : la même masse, publiée deux fois.

La source ventile 130 milliards d'euros de deux façons — par lieu
d'encaissement et par collectivité bénéficiaire — avec des cardinalités
différentes. Les deux doivent tomber au centime, mois par mois et taxe par
taxe. Aucune erreur de lecture ne satisfait cette égalité par hasard ; c'est
pour cela que les deux fichiers entiers servent de fixture.
"""

from pathlib import Path

import pytest

from plateforme import couverture
from plateforme.normalize import mutations as m

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def encaissees():
    return m.lire(
        (FIXTURES / "dgfip_dmto_recouvrement_sample.csv").read_bytes(),
        "direction_recouvrement",
    )


@pytest.fixture(scope="module")
def attribuees():
    return m.lire(
        (FIXTURES / "dgfip_dmto_attribution_sample.csv").read_bytes(),
        "collectivite_attributaire",
    )


def test_les_deux_ventilations_tombent_au_centime(encaissees, attribuees):
    """Cardinalités différentes — 35 395 lignes contre 34 554 — pour le même
    argent : la taxe communale est encaissée par la direction départementale et
    reversée aux communes."""
    assert len(encaissees) != len(attribuees)
    verifies = m.controler(encaissees, attribuees)
    assert verifies["couples_verifies"] == 450
    assert verifies["mois_couverts"] == 90
    assert verifies["masse_totale"] == 130_326_685_268.21


def test_le_controle_bloque_sur_un_centime(encaissees, attribuees):
    """Un centime suffit : c'est ce qui rend ce contrôle utile."""
    mois, code, categorie, recettes = encaissees[0]
    fausses = [(mois, code, categorie, recettes + 0.01), *encaissees[1:]]
    with pytest.raises(m.MassesDivergentes, match="divergent"):
        m.controler(fausses, attribuees)


def test_le_controle_bloque_si_un_mois_disparait(encaissees, attribuees):
    tronquees = [ligne for ligne in attribuees if not ligne[0].startswith("2024-03")]
    with pytest.raises(m.MassesDivergentes, match="d'un seul côté"):
        m.controler(encaissees, tronquees)
    with pytest.raises(m.MassesDivergentes, match="est vide"):
        m.controler([], attribuees)


def test_l_exercice_en_cours_n_est_pas_publie(attribuees):
    """La source va jusqu'au mois dernier. Publier l'année en cours à côté des
    précédentes montrerait un effondrement qui n'est que le calendrier."""
    complets = m.exercices_complets(attribuees)
    assert complets == {"2019", "2020", "2021", "2022", "2023", "2024", "2025"}
    mois = {ligne[0][:4] for ligne in attribuees}
    assert "2026" in mois and "2026" not in complets


def test_departement_et_communes_ne_se_melangent_pas(attribuees):
    observations = m.par_departement(attribuees, m.exercices_complets(attribuees))
    par_indicateur = {}
    for identifiant, _, _, annee, montant in observations:
        par_indicateur[(identifiant, annee)] = (
            par_indicateur.get((identifiant, annee), 0.0) + montant
        )
    # Ce que le département encaisse, et ce que ses communes encaissent : deux
    # niveaux de collectivité, deux totaux, jamais une somme.
    assert round(par_indicateur[("dgfip_dmto_departement", "2022")]) == 16_758_507_339
    assert round(par_indicateur[("dgfip_dmto_communes", "2022")]) == 4_191_606_238
    # La chute que ce jeu existe pour montrer : un tiers en deux ans.
    baisse = 1 - (
        par_indicateur[("dgfip_dmto_departement", "2024")]
        / par_indicateur[("dgfip_dmto_departement", "2022")]
    )
    assert 0.30 < baisse < 0.35


def test_la_taxe_regionale_et_les_codes_non_localises_sont_ecartes(attribuees):
    """99,996 % de la taxe régionale n'est pas localisée dans la source, et la
    colonne géographique porte deux orthographes de la valeur manquante."""
    observations = m.par_departement(attribuees, m.exercices_complets(attribuees))
    codes = {code for _, _, code, _, _ in observations}
    assert not codes & set(m.NON_LOCALISES)
    assert m.REGION_ECARTEE not in {ligne[2] for ligne in observations}
    regionale = [ligne for ligne in attribuees if ligne[2] == m.REGION_ECARTEE]
    non_localisee = sum(
        ligne[3] for ligne in regionale if ligne[1] in m.NON_LOCALISES
    )
    assert non_localisee / sum(ligne[3] for ligne in regionale) > 0.999


def test_les_fiches_refusent_la_lecture_communale():
    assert "ne se divise pas" in m.INDICATEURS["dgfip_dmto_communes"][1]
    assert "agrégée sur toutes les" in m.TECHNIQUE
    assert "ne s'additionnent pas" in m.TECHNIQUE
    assert "mois de comptabilisation" in m.TECHNIQUE
    for identifiant, (_, publique, _) in m.INDICATEURS.items():
        assert len(publique.split()) <= 50, identifiant


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    m.declarer(entrepot_seme)
    m.declarer(entrepot_seme)
    publies = dict(entrepot_seme.execute(
        "select indicator_id, unit from core.indicators where dataset_id = ?",
        (m.DATASET,),
    ).fetchall())
    assert set(publies) == set(m.INDICATEURS)
    assert set(publies.values()) == {"EUR"}
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, attribuees):
    from plateforme import entrepot, revisions
    from plateforme.normalize.ofgl import filtrer_territoires_connus

    m.declarer(entrepot_seme)
    entrepot_seme.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code, flags) values ('departement', '33', ?,"
        " 'Gironde', null, null, '{}')",
        (m.MILLESIME,),
    )
    run_id = entrepot.start_run(entrepot_seme, m.DATASET, "manual")
    candidates = m.par_departement(attribuees, m.exercices_complets(attribuees))
    gardees, ecartes = filtrer_territoires_connus(entrepot_seme, candidates)
    ecrites, _ = revisions.remplacer(
        entrepot_seme, run_id, sorted(m.INDICATEURS), m.COLONNES,
        [
            (identifiant, niveau, code, m.MILLESIME, annee, montant)
            for identifiant, niveau, code, annee, montant in gardees
        ],
    )
    entrepot_seme.commit()
    assert ecrites == 14, "deux indicateurs sur sept exercices, un département"
    assert len(ecartes) > 0, "les autres départements ne sont pas au référentiel"
    (valeur,) = entrepot_seme.execute(
        "select value from core.observations"
        " where indicator_id = 'dgfip_dmto_departement' and geo_code = '33'"
        " and period = '2024'"
    ).fetchone()
    assert valeur > 0


def test_la_couverture_se_mesure_en_euros(attribuees):
    candidates = m.par_departement(attribuees, m.exercices_complets(attribuees))
    lus = m.masse_par_maille(candidates)
    assert lus["departement"] > 0
    couverture.controler(lus, lus)
    with pytest.raises(couverture.CouvertureInsuffisante):
        couverture.controler(lus, {"departement": lus["departement"] * 0.5})
