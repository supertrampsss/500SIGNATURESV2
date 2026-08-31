"""Prix de l'energie des menages : selection et unite restent comparables."""

import json
from itertools import product

import pytest

from plateforme.normalize import prix_energie_menages as prix


def charge_jsonstat(energie="gaz", *, remplacements=None, periodes=None):
    """Petite fixture JSON-stat locale, avec un ordre volontairement inhabituel."""
    fiche = prix.ENERGIES[energie]
    categories = {
        "geo": ["DE", "FR"],
        "tax": ["X_TAX", "I_TAX"],
        "time": list(periodes or ("2024S1", "2024-S2")),
        "currency": ["EUR"],
        "nrg_cons": [fiche["nrg_cons"]],
        "freq": ["S"],
        "unit": ["KWH"],
        "siec": [fiche["siec"]],
    }
    categories.update(remplacements or {})
    ordre = ["geo", "tax", "time", "currency", "nrg_cons", "freq", "unit", "siec"]
    valeurs = {}
    statuts = {}
    for position, combinaison in enumerate(product(*(categories[nom] for nom in ordre))):
        point = dict(zip(ordre, combinaison, strict=True))
        valeur = 0.10
        valeur += {"DE": 0.00, "FR": 0.10}[point["geo"]]
        valeur += 0.05 if point["tax"] == "I_TAX" else 0
        valeur += 0.01 if point["time"].endswith("S2") else 0
        valeurs[str(position)] = valeur
        if point["geo"] == "DE" and point["tax"] == "I_TAX" and point["time"].endswith("S1"):
            statuts[str(position)] = "p"
        if point["geo"] == "FR" and point["tax"] == "X_TAX" and point["time"].endswith("S2"):
            statuts[str(position)] = "b"
    return {
        "id": ordre,
        "size": [len(categories[nom]) for nom in ordre],
        "dimension": {
            nom: {
                "category": {
                    "index": {categorie: index for index, categorie in enumerate(categories[nom])}
                }
            }
            for nom in ordre
        },
        "value": valeurs,
        "status": statuts,
    }


def test_les_deux_jeux_portent_tous_les_filtres_exacts():
    assert prix.ENERGIES == {
        "gaz": {"dataset": "nrg_pc_202", "siec": "G3000", "nrg_cons": "GJ20-199"},
        "electricite": {
            "dataset": "nrg_pc_204",
            "siec": "E7000",
            "nrg_cons": "KWH2500-4999",
        },
    }
    assert prix.COMMON == {"freq": "S", "currency": "EUR", "unit": "KWH"}
    assert prix.TAXES == {
        "I_TAX": "ttc",
        "X_TAX": "hors_taxes_et_prelevements",
    }
    assert prix.parametres("gaz") == {
        "freq": "S",
        "currency": "EUR",
        "unit": "KWH",
        "siec": "G3000",
        "nrg_cons": "GJ20-199",
        "tax": ["I_TAX", "X_TAX"],
    }


@pytest.mark.parametrize("energie", ["gaz", "electricite"])
def test_la_normalisation_lit_chaque_dimension_par_son_nom(energie):
    observations = prix.normaliser(charge_jsonstat(energie), energie)
    assert len(observations) == 8
    par_cle = {(o["pays"], o["periode"], o["traitement_fiscal"]): o for o in observations}

    # La valeur reste en EUR/kWh. Le facteur 100 eventuel appartient au rendu.
    hors_taxes = par_cle[("FR", "2024-S1", "hors_taxes_et_prelevements")]
    assert hors_taxes["valeur"] == pytest.approx(0.20)
    assert hors_taxes["unite"] == "EUR_per_kWh"
    assert {o["periode"] for o in observations} == {"2024-S1", "2024-S2"}
    assert {o["energie"] for o in observations} == {energie}


def test_ttc_et_hors_taxes_restent_deux_series_distinctes():
    observations = prix.normaliser(charge_jsonstat(), "gaz")
    indicateurs = {
        traitement: {o["indicateur"] for o in observations if o["traitement_fiscal"] == traitement}
        for traitement in prix.TAXES.values()
    }
    assert len(indicateurs["ttc"]) == 1
    assert len(indicateurs["hors_taxes_et_prelevements"]) == 1
    assert indicateurs["ttc"] != indicateurs["hors_taxes_et_prelevements"]


def test_les_drapeaux_eurostat_sont_conserves():
    observations = prix.normaliser(charge_jsonstat(), "gaz")
    par_cle = {(o["pays"], o["periode"], o["traitement_fiscal"]): o for o in observations}
    assert par_cle[("DE", "2024-S1", "ttc")]["quality_flags"] == ["provisional"]
    assert par_cle[("FR", "2024-S2", "hors_taxes_et_prelevements")]["quality_flags"] == [
        "break_in_series"
    ]


@pytest.mark.parametrize(
    ("energie", "dimension", "categories"),
    [
        ("gaz", "freq", ["A"]),
        ("gaz", "siec", ["G3100"]),
        ("electricite", "siec", ["E7100"]),
        ("gaz", "nrg_cons", ["GJ200-1999"]),
        ("electricite", "nrg_cons", ["KWH1000-2499"]),
        ("gaz", "unit", ["MWH"]),
        ("gaz", "currency", ["USD"]),
        ("gaz", "currency", ["EUR", "USD"]),
        ("gaz", "tax", ["X_VAT"]),
        ("gaz", "tax", ["I_TAX", "X_TAX", "X_VAT"]),
        ("gaz", "tax", ["I_TAX"]),
    ],
)
def test_toute_dimension_non_comparable_est_rejetee(energie, dimension, categories):
    charge = charge_jsonstat(energie, remplacements={dimension: categories})
    with pytest.raises(ValueError, match=dimension):
        prix.normaliser(charge, energie)


def test_une_dimension_manquante_ou_surnumeraire_est_rejetee():
    manquante = charge_jsonstat()
    position = manquante["id"].index("currency")
    manquante["id"].pop(position)
    manquante["size"].pop(position)
    manquante["dimension"].pop("currency")
    with pytest.raises(ValueError, match="dimensions"):
        prix.normaliser(manquante, "gaz")

    en_trop = charge_jsonstat()
    en_trop["id"].append("seasonal")
    en_trop["size"].append(1)
    en_trop["dimension"]["seasonal"] = {"category": {"index": {"NSA": 0}}}
    with pytest.raises(ValueError, match="dimensions"):
        prix.normaliser(en_trop, "gaz")


@pytest.mark.parametrize("periode", ["2024-Q1", "2024", "2024-M01", "S1-2024"])
def test_une_periode_non_semestrielle_est_rejetee(periode):
    with pytest.raises(ValueError, match="periode"):
        prix.normaliser(charge_jsonstat(periodes=[periode]), "gaz")


def test_une_energie_inconnue_est_rejetee():
    with pytest.raises(ValueError, match="energie"):
        prix.parametres("fioul")


def test_un_run_et_un_seul_actif_brut_sont_crees_par_dataset(monkeypatch):
    """Les deux taxes partagent le meme fichier source, pas deux extractions."""

    class FausseConnexion:
        def commit(self):
            pass

        def close(self):
            pass

    connexion = FausseConnexion()
    runs = []
    actifs = []
    fins = []
    ecritures = []

    monkeypatch.setattr(prix.entrepot, "connect", lambda: connexion)
    monkeypatch.setattr(prix, "make_store", lambda _spec: object())
    monkeypatch.setattr(prix, "declarer", lambda _conn: None)

    def demarrer(_conn, dataset_id, trigger):
        runs.append((dataset_id, trigger))
        return f"run-{dataset_id}"

    monkeypatch.setattr(prix.entrepot, "start_run", demarrer)

    def telecharger(url, timeout):
        energie = "electricite" if "nrg_pc_204" in url else "gaz"
        return json.dumps(charge_jsonstat(energie)).encode()

    monkeypatch.setattr(prix, "telecharger", telecharger)

    def archiver(_conn, _store, run_id, dataset_id, source_id, filename, *_reste):
        actifs.append((run_id, dataset_id, source_id, filename))

    monkeypatch.setattr(prix.entrepot, "record_asset", archiver)
    monkeypatch.setattr(prix, "enregistrer_pays", lambda _conn, codes: codes)

    def remplacer(_conn, run_id, indicateurs, colonnes, lignes, niveaux):
        lignes = list(lignes)
        ecritures.append((run_id, tuple(indicateurs), tuple(colonnes), lignes, tuple(niveaux)))
        return len(lignes), 0

    monkeypatch.setattr(prix.revisions, "remplacer", remplacer)
    monkeypatch.setattr(
        prix.entrepot,
        "finish_run",
        lambda _conn, run_id, status, **mesures: fins.append((run_id, status, mesures)),
    )

    assert prix.run("memoire") == 0
    assert runs == [
        ("eurostat-nrg-pc-202", "manual"),
        ("eurostat-nrg-pc-204", "manual"),
    ]
    assert [(a[1], a[2], a[3]) for a in actifs] == [
        ("eurostat-nrg-pc-202", "eurostat", "nrg_pc_202.json"),
        ("eurostat-nrg-pc-204", "eurostat", "nrg_pc_204.json"),
    ]
    assert len(ecritures) == 2
    assert all(ecriture[2:] and ecriture[2] == ("value", "quality_flags") for ecriture in ecritures)
    assert all(fin[1] == "success" for fin in fins)
