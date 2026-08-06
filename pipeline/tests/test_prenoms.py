"""Les prénoms : un rang auquel on fait confiance, et une limite du modèle.

Ce module publie l'effectif du prénom le plus donné sans pouvoir dire lequel :
un indicateur porte une valeur numérique, et « Gabriel » est une chaîne. Ces
tests tiennent les deux bouts — que le rang veut bien dire ce qu'on croit, et
que les réserves de lecture sont écrites.
"""

import json
from pathlib import Path

import pytest

from plateforme.normalize import prenoms

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def brut() -> dict:
    return json.loads((FIXTURES / "insee_prenoms_sample.json").read_text("utf-8"))


@pytest.fixture(scope="module")
def lus(brut) -> dict:
    return {
        rang: prenoms.lire(charge["observations"]) for rang, charge in brut.items()
    }


def test_les_trois_niveaux_sont_lus(lus):
    niveaux = {cle[0] for cle in lus[prenoms.PREMIER]}
    assert niveaux == {"departement", "region", "pays"}


def test_la_France_prend_le_code_du_referentiel(lus):
    """La source écrit « 2025-FRANCE-F » ; le référentiel du site connaît le
    pays sous « FR ». Sans la traduction, la série nationale tomberait."""
    codes = {cle[1] for cle in lus[prenoms.PREMIER] if cle[0] == "pays"}
    assert codes == {"FR"}


def test_le_departement_perd_son_prefixe_de_millesime(lus):
    gironde = {
        cle[3]: valeur
        for cle, valeur in lus[prenoms.PREMIER].items()
        if cle[:3] == ("departement", "33", "2024")
    }
    assert gironde == {"M": 130.0, "F": 110.0}


def test_le_rang_un_domine_le_rang_deux(lus):
    verifies = prenoms.controler(lus[prenoms.PREMIER], lus[prenoms.SECOND])
    assert verifies["le_rang_un_domine_le_rang_deux"] > 100


def test_le_controle_bloque_si_le_rang_n_ordonne_plus():
    """Tout le module repose sur le sens de `RANK`. S'il signifiait autre chose,
    l'indicateur publierait l'effectif d'un prénom quelconque sous le nom de
    « prénom le plus donné », et rien ne le signalerait."""
    cle = ("departement", "33", "2024", "M")
    with pytest.raises(prenoms.RangIncoherent, match="n'ordonne pas"):
        prenoms.controler({cle: 10.0}, {cle: 90.0})


def test_le_controle_echoue_s_il_n_a_rien_a_comparer():
    with pytest.raises(prenoms.RangIncoherent, match="n'a rien rendu"):
        prenoms.controler({}, {})
    with pytest.raises(prenoms.RangIncoherent, match="ne contrôle rien"):
        prenoms.controler({("departement", "33", "2024", "M"): 10.0}, {})


def test_les_zonages_inconnus_sont_ecartes():
    """La source publie d'autres découpages que ceux du site."""
    assert prenoms.lire([
        {"dimensions": {"GEO": "2025-ZE2020-0051", "SEX": "M", "TIME_PERIOD": "2024"},
         "measures": {"OBS_VALUE_NIVEAU": {"value": 40.0}}},
    ]) == {}


def test_une_mesure_absente_n_est_pas_un_zero():
    assert prenoms.lire([
        {"dimensions": {"GEO": "2025-DEP-33", "SEX": "M", "TIME_PERIOD": "2024"},
         "measures": {"OBS_VALUE_NIVEAU": {}}},
    ]) == {}


def test_les_lignes_suivent_les_colonnes_declarees(lus):
    from plateforme import revisions

    lignes = prenoms.lignes_a_ecrire(lus[prenoms.PREMIER])
    attendue = len(revisions.CLES) + len(prenoms.COLONNES)
    assert lignes and all(len(ligne) == attendue for ligne in lignes)


def test_les_fiches_disent_l_arrondi_et_la_limite_du_modele():
    assert "arrondis" in prenoms.TECHNIQUE
    assert "à la dizaine" in prenoms.TECHNIQUE
    assert "le prénom lui-même n'est pas publié" in prenoms.TECHNIQUE
    assert "dénombrement complet" in prenoms.TECHNIQUE
    for _, (identifiant, _, publique) in prenoms.SEXES.items():
        assert len(publique.split()) <= 50, identifiant
        assert "dizaine" in publique, identifiant


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, lus):
    from plateforme import entrepot, revisions

    prenoms.declarer(entrepot_seme)
    for niveau, code in (("pays", "FR"), ("departement", "33"), ("region", "75")):
        entrepot_seme.execute(
            "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
            " parent_level, parent_code, flags) values (?, ?, ?, ?, null, null, '{}')",
            (niveau, code, prenoms.MILLESIME, f"{niveau} {code}"),
        )
    run_id = entrepot.start_run(entrepot_seme, prenoms.DATASET, "manual")
    lignes = prenoms.lignes_a_ecrire(lus[prenoms.PREMIER])
    ecrites, _ = revisions.remplacer(
        entrepot_seme, run_id, [s[0] for s in prenoms.SEXES.values()],
        prenoms.COLONNES, lignes,
    )
    entrepot_seme.commit()
    assert ecrites == len(lignes)
    (valeur,) = entrepot_seme.execute(
        "select value from core.observations where indicator_id ="
        " 'insee_prenom_premier_effectif_garcons' and geo_code = '33'"
        " and period = '2024'"
    ).fetchone()
    assert valeur == 130.0


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    prenoms.declarer(entrepot_seme)
    prenoms.declarer(entrepot_seme)
    lignes = dict(entrepot_seme.execute(
        "select indicator_id, additive from core.indicators where dataset_id = ?",
        (prenoms.DATASET,),
    ).fetchall())
    assert set(lignes) == {s[0] for s in prenoms.SEXES.values()}
    # Le prénom de tête d'un département n'est pas celui de sa région : additionner
    # ces effectifs sommerait des grandeurs qui ne parlent pas du même prénom.
    assert set(lignes.values()) == {False}
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0
