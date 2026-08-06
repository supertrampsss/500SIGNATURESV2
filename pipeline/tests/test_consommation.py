"""Deux chiffres dont l'écart est le sujet.

Publier la dépense des ménages sans leur consommation effective, ou l'inverse,
laisserait invisible ce que ce module vient dire : les 524 milliards d'euros de
services que la collectivité fournit aux ménages sans les leur facturer.
"""

import json
from pathlib import Path

import pytest

from plateforme.normalize import consommation as conso

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def charges() -> dict[str, bytes]:
    brut = json.loads((FIXTURES / "insee_conso_menages_sample.json").read_text("utf-8"))
    return {mesure: json.dumps(charge).encode() for mesure, charge in brut.items()}


@pytest.fixture(scope="module")
def series(charges) -> dict:
    return conso.lire(charges)


def test_les_deux_mesures_sont_lues(series):
    assert set(series) == {"P31", "P4"}
    assert series["P31"] and series["P4"]


def test_les_montants_sont_en_euros_pas_en_millions(series):
    assert series["P31"]["2024"] == 1527122900000.0
    assert series["P4"]["2024"] == 2051008200000.0


def test_l_ecart_est_la_valeur_des_services_publics_en_nature(series):
    """C'est la raison d'être de ce module : soins remboursés, école, logement
    social — ce que les ménages consomment sans le payer."""
    ecarts = conso.transferts_en_nature(series)
    assert round(ecarts["2024"] / conso.MILLIONS) == 523885


def test_la_consommation_effective_ne_descend_jamais_sous_la_depense(series):
    verifies = conso.controler(series)
    assert verifies["la_consommation_effective_depasse_la_depense"] == len(
        set(series["P31"]) & set(series["P4"])
    )


def test_le_controle_bloque_si_les_deux_mesures_sont_inversees():
    """Des transferts sociaux en nature négatifs n'existent pas : c'est le
    signe qu'un filtre a laissé passer un autre secteur, ou que les deux
    mesures ont été échangées."""
    with pytest.raises(conso.IdentiteRompue, match="inversées"):
        conso.controler({"P31": {"2024": 2e12}, "P4": {"2024": 1e12}})


def test_le_controle_exige_les_deux_series():
    with pytest.raises(conso.IdentiteRompue, match="séries incomplètes"):
        conso.controler({"P31": {"2024": 1e12}, "P4": {}})
    with pytest.raises(conso.IdentiteRompue, match="aucun exercice commun"):
        conso.controler({"P31": {"2023": 1e12}, "P4": {"2024": 2e12}})


def test_le_produit_et_la_zone_sont_filtres_dans_la_requete():
    """Le jeu décline 551 produits : filtrer après coup fait dépasser la page de
    l'API, et le total disparaît sans que rien n'échoue — la série revient
    simplement vide. C'est le défaut qu'a montré le premier essai."""
    adresse = conso.url("P31")
    assert "PRODUCT=_T" in adresse
    assert "COUNTERPART_AREA=W0" in adresse
    assert "REF_SECTOR=S14" in adresse


def test_les_lignes_suivent_les_colonnes_declarees(series):
    from plateforme import revisions

    lignes = conso.lignes_a_ecrire(series)
    attendue = len(revisions.CLES) + len(conso.COLONNES)
    assert lignes and all(len(ligne) == attendue for ligne in lignes)


def test_la_fiche_dit_que_ce_n_est_pas_de_la_depense_publique():
    assert "ne s'additionnent pas aux dépenses publiques" in conso.TECHNIQUE
    assert "ménages résidents" in conso.TECHNIQUE
    assert "transferts sociaux en nature" in conso.TECHNIQUE
    for _, (identifiant, _, publique) in conso.MESURES.items():
        assert len(publique.split()) <= 50, identifiant
    assert "de leur poche" in conso.MESURES["P31"][2]
    assert "à leur place" in conso.MESURES["P4"][2]


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, series):
    from plateforme import entrepot, revisions

    conso.declarer(entrepot_seme)
    entrepot_seme.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code, flags) values ('pays', 'FR', ?, 'France',"
        " null, null, '{}')",
        (conso.MILLESIME,),
    )
    run_id = entrepot.start_run(entrepot_seme, conso.DATASET, "manual")
    lignes = conso.lignes_a_ecrire(series)
    ecrites, _ = revisions.remplacer(
        entrepot_seme, run_id,
        [m[0] for m in conso.MESURES.values()], conso.COLONNES, lignes,
    )
    entrepot_seme.commit()
    assert ecrites == len(lignes)
    (valeur,) = entrepot_seme.execute(
        "select value from core.observations"
        " where indicator_id = 'insee_conso_menages_effective' and period = '2024'"
    ).fetchone()
    assert valeur == 2051008200000.0


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    conso.declarer(entrepot_seme)
    conso.declarer(entrepot_seme)
    lignes = dict(entrepot_seme.execute(
        "select indicator_id, theme from core.indicators where dataset_id = ?",
        (conso.DATASET,),
    ).fetchall())
    assert set(lignes) == {m[0] for m in conso.MESURES.values()}
    assert set(lignes.values()) == {"macro"}
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0
