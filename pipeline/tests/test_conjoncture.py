"""La conjoncture est le terrain le plus exposé du site : une inflation ou une
croissance fausse serait citée, reprise, moquée. Les fixtures sont de vraies
réponses Eurostat (janvier 2024 →) ; les contrôles doivent laisser passer les
extrêmes réels (Turquie à 85 % d'inflation, Irlande à +20 % de PIB) et arrêter
les artefacts (niveau d'indice lu comme un taux)."""

import json
import os
from pathlib import Path

import pytest

from plateforme.connectors.jsonstat import decoder
from plateforme.normalize import conjoncture

FIXTURES = Path(__file__).parent / "fixtures"


def charger_fixture(nom: str) -> dict:
    return json.loads((FIXTURES / nom).read_text(encoding="utf-8"))


def test_la_fixture_inflation_se_decode_avec_la_france():
    charge = charger_fixture("eurostat_hicp_sample.json")
    conjoncture.controler_unite(charge, "RCH_A")
    points = decoder(charge)
    par_cle = {(p["geo"], p["time"]): p["valeur"] for p in points}
    # Valeurs publiées par Eurostat pour janvier 2024, vérifiées à la capture.
    assert par_cle[("DE", "2024-01")] == 3.1
    assert ("FR", "2024-01") in par_cle
    assert all(p["coicop"] == "CP00" for p in points)


def test_la_fixture_pib_se_decode_avec_la_france():
    charge = charger_fixture("eurostat_pib_trim_sample.json")
    conjoncture.controler_unite(charge, "CLV_PCH_SM")
    points = decoder(charge)
    assert any(p["geo"] == "FR" and p["time"].startswith("2024-Q") for p in points)
    assert all(p["s_adj"] == "SCA" for p in points)


def test_une_autre_unite_sous_la_meme_url_bloque_le_chargement():
    """Un niveau d'indice (~120) chargé comme un taux ferait dire au site que
    les prix montent de 120 % par an. Le refus est structurel, pas statistique."""
    charge = charger_fixture("eurostat_hicp_sample.json")
    charge["dimension"]["unit"]["category"]["index"] = {"I15": 0}
    with pytest.raises(ValueError, match="unité servie"):
        conjoncture.controler_unite(charge, "RCH_A")


def test_la_france_absente_bloque_le_chargement():
    with pytest.raises(ValueError, match="France est absente"):
        conjoncture.exiger_france(
            [{"geo": "DE", "time": "2024-01", "valeur": 3.1}], "eurostat_inflation_ipch"
        )


def test_les_bornes_gardent_les_extremes_reels_et_ecartent_les_artefacts():
    bornes = conjoncture.INDICATEURS["eurostat_inflation_ipch"]["bornes"]
    gardes, ecartes = conjoncture.controler_plausibilite(
        [
            {"geo": "TR", "time": "2022-10", "valeur": 85.5},   # vraie hyperinflation
            {"geo": "FR", "time": "2024-01", "valeur": 3.4},
            {"geo": "XX", "time": "2024-01", "valeur": 121.9},  # niveau d'indice
            {"geo": "YY", "time": "2024-01", "valeur": -50.0},  # virgule perdue
        ],
        bornes,
    )
    assert {p["geo"] for p in gardes} == {"TR", "FR"}
    assert set(ecartes) == {"XX/2024-01", "YY/2024-01"}
    assert ecartes["XX/2024-01"] == 121.9


def test_les_bornes_pib_couvrent_le_covid_et_l_irlande():
    basse, haute = conjoncture.INDICATEURS["eurostat_croissance_pib"]["bornes"]
    assert basse <= -21.0    # Espagne, 2020-T2, en glissement annuel
    assert haute >= 21.0     # Irlande, 2021, relocalisations comptables
    assert haute < 100.0     # un niveau d'indice ne passe pas


def test_les_fiches_tiennent_la_charte_et_le_vocabulaire():
    for indicateur, fiche in conjoncture.INDICATEURS.items():
        assert len(fiche["public"].split()) <= 50, f"{indicateur} : fiche trop longue"
    inflation = conjoncture.INDICATEURS["eurostat_inflation_ipch"]["public"]
    assert "harmonisé" in inflation and "INSEE" in inflation
    croissance = conjoncture.INDICATEURS["eurostat_croissance_pib"]["public"]
    assert "même trimestre" in croissance and "hors effet des prix" in croissance


def test_les_jeux_sont_au_registre():
    import csv

    registre = Path(conjoncture.__file__).parents[3] / "infra/supabase/seed/dataset_registry.csv"
    with registre.open(encoding="utf-8") as fichier:
        jeux = {r["dataset_id"]: r["source_id"] for r in csv.DictReader(fichier)}
    for fiche in conjoncture.INDICATEURS.values():
        assert jeux.get(fiche["dataset"]) == "eurostat"


@pytest.mark.skipif(
    not os.environ.get("PLATEFORME_TEST_DB"), reason="PLATEFORME_TEST_DB non défini"
)
def test_declarer_passe_les_contraintes_de_la_base():
    from plateforme import db

    conn = db.connect(os.environ["PLATEFORME_TEST_DB"])
    try:
        conjoncture.declarer(conn)
        lignes = conn.execute(
            "select indicator_id, unit, theme, time_granularity from core.indicators"
            " where indicator_id = any(%s) order by indicator_id",
            (list(conjoncture.INDICATEURS),),
        ).fetchall()
        assert lignes == [
            ("eurostat_croissance_pib", "percent", "macro", "trimestrielle"),
            ("eurostat_inflation_ipch", "percent", "macro", "mensuelle"),
        ]
    finally:
        conn.rollback()
        conn.execute(
            "delete from core.indicators where dataset_id = any(%s)",
            ([f["dataset"] for f in conjoncture.INDICATEURS.values()],),
        )
        conn.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
        conn.commit()
        conn.close()
