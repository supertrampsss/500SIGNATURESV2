"""Deux indices annuels, sans les transformer en cout de rentree scolaire."""

import xml.etree.ElementTree as ET

import pytest

from plateforme.normalize import fournitures_scolaires as fournitures
from plateforme.store import LocalStore


def _valeurs(debut: float, fin: float) -> dict[str, float]:
    pas = (fin - debut) / (2025 - 1990)
    return {
        str(annee): round(debut + (annee - 1990) * pas, 2)
        for annee in range(1990, 2026)
    }


VALEURS_FOURNITURES = _valeurs(64.70, 113.02) | {
    "1990": 64.70,
    "2015": 100.0,
    "2025": 113.02,
}
VALEURS_ENSEMBLE = _valeurs(62.10, 119.37) | {"2015": 100.0}

TITRES = {
    "fournitures": (
        "Indice annuel des prix a la consommation - Base 2015 - Ensemble des menages - "
        "France - 09.5.4.9.2 - Autres fournitures scolaires et de bureau - Series arretees"
    ),
    "ensemble": (
        "Indice annuel des prix a la consommation - Base 2015 - Ensemble des menages - "
        "France - Ensemble - Series arretees"
    ),
}


def _fixture(
    cle: str,
    valeurs: dict[str, float] | None = None,
    *,
    statuts: dict[str, str] | None = None,
    attributs: dict[str, str] | None = None,
    doublon: str | None = None,
    serie_supplementaire: bool = False,
) -> bytes:
    racine = ET.Element("StructureSpecificData")
    donnees = ET.SubElement(racine, "DataSet")
    attrs = {
        "IDBANK": fournitures.SERIES[cle],
        "FREQ": "A",
        "TITLE_FR": TITRES[cle],
        "UNIT_MEASURE": "SO",
        "UNIT_MULT": "0",
        "REF_AREA": "FE",
        "TPH_CPI": "_T",
        "BASE_PER": "2015",
        "SERIE_ARRETEE": "TRUE",
    }
    attrs.update(attributs or {})
    serie = ET.SubElement(donnees, "Series", attrs)
    for periode, valeur in (valeurs or VALEURS_FOURNITURES).items():
        ET.SubElement(
            serie,
            "Obs",
            {
                "TIME_PERIOD": periode,
                "OBS_VALUE": str(valeur),
                "OBS_STATUS": (statuts or {}).get(periode, "A"),
            },
        )
    if doublon is not None:
        ET.SubElement(
            serie,
            "Obs",
            {
                "TIME_PERIOD": doublon,
                "OBS_VALUE": str((valeurs or VALEURS_FOURNITURES)[doublon]),
                "OBS_STATUS": "A",
            },
        )
    if serie_supplementaire:
        ET.SubElement(donnees, "Series", attrs)
    return ET.tostring(racine, encoding="utf-8", xml_declaration=True)


@pytest.fixture
def series_officielles():
    return {
        "fournitures": fournitures.lire(
            "fournitures",
            _fixture(
                "fournitures",
                VALEURS_FOURNITURES,
                statuts={"2025": "P"},
            ),
        ),
        "ensemble": fournitures.lire(
            "ensemble",
            _fixture("ensemble", VALEURS_ENSEMBLE),
        ),
    }


def test_series_exactes_et_ancrages_officiels(series_officielles):
    communes = fournitures.intersection(series_officielles)
    points = {point.periode: point for point in communes["fournitures"]}

    assert fournitures.SERIES == {
        "fournitures": "001765036",
        "ensemble": "001764363",
    }
    assert list(points) == [str(annee) for annee in range(1990, 2026)]
    assert points["1990"].valeur == 64.70
    assert points["2015"].valeur == 100.0
    assert points["2025"].valeur == 113.02
    assert points["2025"].statut == "P"
    assert points["2025"].value_status == "provisional"
    assert points["2025"].drapeaux == ("insee_obs_status:P",)
    assert fournitures.UNITE == "index_2015_100"


def test_intersection_garde_seulement_les_annees_communes_sans_interpolation():
    fourniture = fournitures.lire(
        "fournitures",
        _fixture("fournitures", {"1990": 64.70, "2015": 100.0, "2025": 113.02}),
    )
    ensemble = fournitures.lire(
        "ensemble",
        _fixture(
            "ensemble",
            {"1991": 63.0, "2015": 100.0, "2024": 117.0, "2025": 119.37},
        ),
    )

    communes = fournitures.intersection({"fournitures": fourniture, "ensemble": ensemble})
    assert [point.periode for point in communes["fournitures"]] == ["2015", "2025"]
    assert [point.periode for point in communes["ensemble"]] == ["2015", "2025"]


@pytest.mark.parametrize(
    ("attributs", "message"),
    [
        ({"IDBANK": "011817559"}, "identifiant"),
        ({"FREQ": "M"}, "frequence"),
        ({"UNIT_MEASURE": "IX"}, "unite"),
        ({"UNIT_MULT": "2"}, "valeurs brutes"),
        ({"REF_AREA": "FM"}, "France"),
        ({"TPH_CPI": "OUV"}, "menages"),
        ({"BASE_PER": "2025"}, "base 2015"),
        ({"TITLE_FR": TITRES["fournitures"].replace("Base 2015", "Base 2025")}, "base 2015"),
        ({"TITLE_FR": TITRES["fournitures"].replace("09.5.4.9.2 - ", "")}, "09.5.4.9.2"),
    ],
)
def test_identite_inattendue_bloque_le_chargement(attributs, message):
    with pytest.raises(fournitures.SourceInattendue, match=message):
        fournitures.lire("fournitures", _fixture("fournitures", attributs=attributs))


def test_periode_mensuelle_doublon_et_plusieurs_series_sont_rejetes():
    with pytest.raises(fournitures.SourceInattendue, match="periode annuelle"):
        fournitures.lire(
            "fournitures",
            _fixture("fournitures", {"2015": 100.0, "2025-01": 113.02}),
        )
    with pytest.raises(fournitures.SourceInattendue, match="doublon"):
        fournitures.lire("fournitures", _fixture("fournitures", doublon="2015"))
    with pytest.raises(fournitures.SourceInattendue, match="une seule serie"):
        fournitures.lire(
            "fournitures",
            _fixture("fournitures", serie_supplementaire=True),
        )


def test_indice_2015_doit_valoir_100():
    valeurs = VALEURS_FOURNITURES | {"2015": 99.9}
    with pytest.raises(fournitures.SourceInattendue, match="2015 doit valoir 100"):
        fournitures.lire("fournitures", _fixture("fournitures", valeurs))


def test_declaration_separe_les_deux_indices_sans_cout_de_rentree(entrepot_seme):
    fournitures.declarer(entrepot_seme)
    fournitures.declarer(entrepot_seme)

    lignes = entrepot_seme.execute(
        """
        select indicator_id, dataset_id, unit, additive, time_granularity
        from core.indicators
        where dataset_id in ('bdm-fournitures-001765036', 'bdm-ipc-ensemble-001764363')
        order by indicator_id
        """
    ).fetchall()
    assert lignes == [
        (
            "insee_ipc_ensemble_annuel_base_2015",
            "bdm-ipc-ensemble-001764363",
            "index_2015_100",
            False,
            "annuelle",
        ),
        (
            "insee_ipc_fournitures_scolaires_base_2015",
            "bdm-fournitures-001765036",
            "index_2015_100",
            False,
            "annuelle",
        ),
    ]
    assert all("cout_rentree" not in ligne[0] for ligne in lignes)


def test_ingestion_locale_cree_un_run_et_un_asset_par_dataset(
    entrepot_seme, tmp_path, monkeypatch
):
    appels = []
    contenus = {
        "SERIES_BDM/001765036": _fixture(
            "fournitures", VALEURS_FOURNITURES, statuts={"2025": "P"}
        ),
        "SERIES_BDM/001764363": _fixture("ensemble", VALEURS_ENSEMBLE),
    }

    def telecharger(identifiant):
        appels.append(identifiant)
        return contenus[identifiant]

    monkeypatch.setattr(fournitures.insee, "bdm_sdmx", telecharger)
    total = fournitures.ingester(entrepot_seme, LocalStore(tmp_path / "raw"))

    assert appels == ["SERIES_BDM/001765036", "SERIES_BDM/001764363"]
    assert total == 72
    jeux = tuple(fournitures.DATASETS.values())
    assert entrepot_seme.execute(
        """
        select dataset_id, count(*), min(status)
        from meta.ingestion_runs
        where dataset_id in (?, ?)
        group by dataset_id
        order by dataset_id
        """,
        jeux,
    ).fetchall() == [
        ("bdm-fournitures-001765036", 1, "success"),
        ("bdm-ipc-ensemble-001764363", 1, "success"),
    ]
    assert entrepot_seme.execute(
        """
        select dataset_id, count(*)
        from meta.raw_assets
        where dataset_id in (?, ?)
        group by dataset_id
        order by dataset_id
        """,
        jeux,
    ).fetchall() == [
        ("bdm-fournitures-001765036", 1),
        ("bdm-ipc-ensemble-001764363", 1),
    ]
    valeur, statut, drapeaux = entrepot_seme.execute(
        """
        select value, value_status, quality_flags
        from core.observations
        where indicator_id = 'insee_ipc_fournitures_scolaires_base_2015'
          and period = '2025'
        """
    ).fetchone()
    assert valeur == 113.02
    assert statut == "provisional"
    assert drapeaux == ["insee_obs_status:P"]
