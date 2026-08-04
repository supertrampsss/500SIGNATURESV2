"""La Sécu en comptabilité nationale : recettes − dépenses = solde, sur le
sous-secteur S1314 — et les fiches doivent dire que ce périmètre n'est pas
celui du « trou de la Sécu » parlementaire."""

import json
from pathlib import Path


from plateforme.connectors.jsonstat import decoder
from plateforme.normalize import secu

FIXTURE = json.loads(
    (Path(__file__).parent / "fixtures/eurostat_gov10a_main_sample.json").read_text()
)


def test_la_fixture_reelle_passe_le_controle_d_identite():
    points = decoder(FIXTURE)
    gardes, ecartes = secu.controler_identite(points)
    assert ecartes == {}
    assert len(gardes) == len(points) == 36  # 2 pays × 6 années × 3 agrégats


def test_la_france_2020_porte_le_choc_covid_connu():
    """Dépenses 28,5 % du PIB, recettes 26,5, solde −2,1 : les chiffres publiés
    par Eurostat pour l'année du confinement."""
    points = decoder(FIXTURE)
    fr = {p["na_item"]: p["valeur"] for p in points if p["geo"] == "FR" and p["time"] == "2020"}
    assert fr == {"TE": 28.5, "TR": 26.5, "B9": -2.1}


def test_un_solde_qui_ne_se_referme_pas_est_ecarte_et_compte():
    points = [
        {"geo": "XX", "time": "2024", "na_item": "TE", "valeur": 26.0},
        {"geo": "XX", "time": "2024", "na_item": "TR", "valeur": 26.0},
        {"geo": "XX", "time": "2024", "na_item": "B9", "valeur": -2.0},
    ]
    gardes, ecartes = secu.controler_identite(points)
    assert gardes == []
    assert ecartes == {"XX/2024": 2.0}


def test_l_arrondi_au_dixieme_ne_declenche_pas_de_fausse_quarantaine():
    # 26,65 − 26,5 arrondis : l'écart de 0,1 à 0,15 est du bruit d'arrondi.
    points = [
        {"geo": "FR", "time": "2021", "na_item": "TE", "valeur": 27.3},
        {"geo": "FR", "time": "2021", "na_item": "TR", "valeur": 26.6},
        {"geo": "FR", "time": "2021", "na_item": "B9", "valeur": -0.8},
    ]
    gardes, ecartes = secu.controler_identite(points)
    assert ecartes == {}
    assert len(gardes) == 3


def test_une_serie_incomplete_est_ecartee_plutot_que_publiee_a_trous():
    points = [
        {"geo": "YY", "time": "2024", "na_item": "TE", "valeur": 20.0},
        {"geo": "YY", "time": "2024", "na_item": "TR", "valeur": 20.0},
    ]
    gardes, ecartes = secu.controler_identite(points)
    assert gardes == []
    assert ecartes == {"YY/2024": "serie incomplete"}


def test_les_fiches_desamorcent_les_pieges_de_vocabulaire():
    """Deux confusions interdites par la doctrine : solde S1314 ≠ « trou de la
    Sécu » (autre périmètre), recettes ≠ cotisations seules (CSG, TVA)."""
    _, _, solde = secu.INDICATEURS["B9"]
    assert "trou de la Sécu" in solde
    assert "régime général" in solde
    _, _, recettes = secu.INDICATEURS["TR"]
    assert "cotisations" in recettes
    assert "CSG" in recettes


def test_les_fiches_tiennent_dans_la_charte_de_cinquante_mots():
    """Le schéma refuse toute définition publique de plus de 50 mots (0004) —
    c'est ce qui a fait échouer le premier chargement réel. Compté ici comme le
    SQL le compte : les segments séparés par des blancs, tirets et guillemets
    compris."""
    for na_item, (_, _, publique) in secu.INDICATEURS.items():
        mots = len(publique.split())
        assert mots <= 50, f"{na_item} : {mots} mots — la base refusera la fiche"


def test_les_parametres_demandent_exactement_les_trois_agregats_du_s1314():
    assert secu.PARAMS["sector"] == "S1314"
    assert set(secu.PARAMS["na_item"]) == set(secu.INDICATEURS) == {"TE", "TR", "B9"}


def test_le_jeu_est_au_registre():
    import csv

    registre = Path(secu.__file__).parents[3] / "infra/supabase/seed/dataset_registry.csv"
    with registre.open(encoding="utf-8") as fichier:
        jeux = {ligne["dataset_id"] for ligne in csv.DictReader(fichier)}
    assert secu.DATASET in jeux


def test_declarer_passe_les_contraintes_de_la_base(tmp_path):
    """`declarer()` exécuté pour de vrai, contre le schéma réel et son seed :
    c'est la contrainte des 50 mots — vérifiée par la base, pas par nous — qui
    a arrêté le premier chargement en production. Un test qui n'exerce pas le
    même chemin que la production ne prouve rien (leçon CORS, leçon d'ici)."""
    from plateforme import entrepot

    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    try:
        secu.declarer(conn)
        publies = {
            ligne[0]
            for ligne in conn.execute(
                "select indicator_id from core.indicators where dataset_id = ?",
                (secu.DATASET,),
            )
        }
        assert publies == {fiche[0] for fiche in secu.INDICATEURS.values()}
    finally:
        entrepot.annuler(conn)
        conn.execute("delete from core.indicators where dataset_id = ?", (secu.DATASET,))
        conn.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
        conn.commit()
        conn.close()
