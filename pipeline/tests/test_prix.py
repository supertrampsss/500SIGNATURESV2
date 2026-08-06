"""L'IPC et l'IPCH : deux inflations, et une seule qui indexe les pensions.

Le site publiait déjà une inflation. En ajouter une seconde n'a d'intérêt que si
chacune dit laquelle elle est — sans quoi le lecteur lit deux chiffres différents
pour la même chose et conclut que l'un des deux est faux.
"""

import json
from pathlib import Path

import pytest

from plateforme.normalize import prix

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def contenu() -> bytes:
    return (FIXTURES / "insee_ipc_sample.json").read_bytes()


@pytest.fixture(scope="module")
def series(contenu) -> dict:
    return prix.lire(contenu)


def test_les_deux_series_sont_separees(series):
    """Elles portent le même nom de mesure et ne se distinguent que par
    `IND_TYPE` : l'une est un niveau d'indice, l'autre un pourcentage."""
    assert set(series) == {"YOY", "IX"}
    assert series["YOY"] and series["IX"]
    # Un glissement tourne autour de quelques points, un indice autour de cent.
    assert max(series["YOY"].values()) < 20
    assert min(series["IX"].values()) > 50


def test_le_glissement_se_recalcule_depuis_l_indice(series):
    verifies = prix.controler(series)
    assert verifies["le_glissement_recalcule_egale_le_publie"] > 12


def test_le_controle_bloque_si_un_niveau_est_lu_comme_un_taux():
    """C'est le défaut que ce contrôle existe pour attraper : l'indice chargé à
    la place du glissement ferait dire au site que les prix montent de cent pour
    cent par an."""
    with pytest.raises(prix.IdentiteRompue, match="lue à la place"):
        prix.controler({
            "YOY": {"2026-01": 102.0},
            "IX": {"2026-01": 102.0, "2025-01": 100.0},
        })


def test_le_controle_echoue_si_une_des_deux_series_manque():
    with pytest.raises(prix.IdentiteRompue, match="séries incomplètes"):
        prix.controler({"YOY": {"2026-01": 2.0}, "IX": {}})


def test_le_controle_echoue_si_aucun_mois_n_a_de_repere():
    """Douze mois d'indice sont nécessaires avant le premier glissement
    vérifiable : sans eux, le contrôle passerait sans rien contrôler."""
    with pytest.raises(prix.IdentiteRompue, match="aucun mois"):
        prix.controler({"YOY": {"2026-01": 2.0}, "IX": {"2026-01": 102.0}})


def test_un_rebasement_de_la_source_arrete_le_chargement(contenu):
    """Les niveaux d'indice ne se comparent pas d'une base à l'autre : le jour
    où l'INSEE rebase, le glissement recalculé cesserait d'être comparable et le
    chargement doit s'arrêter avant, pas après."""
    charge = json.loads(contenu)
    for observation in charge["observations"]:
        observation["dimensions"]["BASE_PER"] = "2030"
    with pytest.raises(prix.IdentiteRompue, match="rebasé"):
        prix.lire(json.dumps(charge).encode())


def test_les_series_corrigees_et_les_autres_menages_sont_ecartees(contenu):
    """La source décline le même indice pour trois paniers de ménages et en
    série corrigée des saisons. Chargés ensemble, ils écraseraient le même
    identifiant avec des valeurs différentes."""
    charge = json.loads(contenu)
    intrus = dict(charge["observations"][0])
    intrus["dimensions"] = {**intrus["dimensions"], "SEASONAL_ADJUST": "S"}
    charge["observations"].append(intrus)
    avant = prix.lire(contenu)
    apres = prix.lire(json.dumps(charge).encode())
    assert avant == apres


def test_les_bornes_ecartent_sans_corriger():
    assert prix.controler_plausibilite({"2026-01": 2.0}) == {}
    assert prix.controler_plausibilite({"2026-01": 120.0}) == {"2026-01": 120.0}


def test_la_fiche_nomme_l_autre_inflation():
    assert "harmonisé" in prix.FICHE["public"]
    assert "IPCH" in prix.FICHE["technique"]
    assert "n'indexe rien" in prix.FICHE["technique"]
    assert "loyers imputés" in prix.FICHE["technique"]
    assert len(prix.FICHE["public"].split()) <= 50


def test_le_filtre_ecarte_les_autres_menages():
    assert prix.PARAMS["TPH_CPI"] == "_T"
    assert prix.PARAMS["COICOP_2018"] == "00"
    assert prix.PARAMS["GEO"] == "FRANCE-F"


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    prix.declarer(entrepot_seme)
    prix.declarer(entrepot_seme)
    lignes = entrepot_seme.execute(
        "select indicator_id, theme, unit, additive from core.indicators"
        " where dataset_id = ?", (prix.DATASET,),
    ).fetchall()
    assert lignes == [(prix.INDICATEUR, "macro", "percent", False)]
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_les_deux_inflations_cohabitent_sans_se_confondre(entrepot_seme):
    """Le thème « macro » porte désormais deux inflations. Elles doivent avoir
    des identifiants et des libellés distincts, et chacune nommer l'autre."""
    from plateforme.normalize import conjoncture

    prix.declarer(entrepot_seme)
    conjoncture.declarer(entrepot_seme)
    libelles = dict(entrepot_seme.execute(
        "select indicator_id, label_fr from core.indicators where theme = 'macro'"
    ).fetchall())
    assert libelles["insee_inflation_ipc"] == "Inflation (IPC, sur un an)"
    assert libelles["eurostat_inflation_ipch"] == "Inflation (IPCH, sur un an)"
    assert (
        "indice national de l'INSEE"
        in conjoncture.INDICATEURS["eurostat_inflation_ipch"]["public"]
    )
