"""« Combien pour la santé ? » se répond au niveau de toutes les administrations
publiques, pas du seul budget de l'État — et la somme des fonctions doit
redonner le total publié."""

import json
from pathlib import Path

from plateforme.connectors.jsonstat import decoder
from plateforme.normalize import cofog

FIXTURE = json.loads(
    (Path(__file__).parent / "fixtures/eurostat_gov10a_exp_sample.json").read_text()
)


def test_la_fixture_reelle_passe_le_controle_d_identite():
    points = decoder(FIXTURE)
    gardes, ecartes = cofog.controler_identite(points)
    assert ecartes == {}
    assert len(gardes) == len(points)


def test_la_france_2024_porte_les_chiffres_connus():
    """57,3 % du PIB de dépense publique, 8,9 en santé, 23,7 en protection
    sociale : les ordres de grandeur publiés par Eurostat."""
    points = decoder(FIXTURE)
    fr = {p["cofog99"]: p["valeur"] for p in points if p["geo"] == "FR" and p["time"] == "2024"}
    assert fr["TOTAL"] == 57.3
    assert fr["GF07"] == 8.9
    assert fr["GF10"] == 23.7


def test_un_total_qui_ne_se_referme_pas_est_ecarte_et_compte():
    points = [
        {"geo": "XX", "time": "2024", "cofog99": code, "valeur": 1.0}
        for code in cofog.FONCTIONS
    ] + [{"geo": "XX", "time": "2024", "cofog99": "TOTAL", "valeur": 20.0}]
    gardes, ecartes = cofog.controler_identite(points)
    assert gardes == []
    assert ecartes == {"XX/2024": 10.0}


def test_une_serie_incomplete_est_ecartee_plutot_que_publiee_a_trous():
    """Neuf fonctions sur dix : l'identité ne peut pas se vérifier, et publier
    un « par fonction » troué ferait croire que la fonction manquante est nulle."""
    points = [
        {"geo": "YY", "time": "2024", "cofog99": code, "valeur": 1.0}
        for code in list(cofog.FONCTIONS)[:9]
    ] + [{"geo": "YY", "time": "2024", "cofog99": "TOTAL", "valeur": 9.0}]
    gardes, ecartes = cofog.controler_identite(points)
    assert gardes == []
    assert ecartes == {"YY/2024": "serie incomplete"}


def test_chaque_fonction_a_un_indicateur_et_une_definition_publique():
    assert len(cofog.FONCTIONS) == 10
    identifiants = {fiche[0] for fiche in cofog.FONCTIONS.values()}
    assert len(identifiants) == 10
    for _, libelle, publique in cofog.FONCTIONS.values():
        assert libelle and len(publique) > 40


def test_la_sante_dit_qui_la_paie():
    _, _, publique = cofog.FONCTIONS["GF07"]
    assert "Sécurité sociale" in publique
    assert "pas par le budget de l'État" in publique


def test_le_jeu_est_au_registre():
    import csv

    registre = Path(cofog.__file__).parents[3] / "infra/supabase/seed/dataset_registry.csv"
    with registre.open(encoding="utf-8") as fichier:
        jeux = {ligne["dataset_id"] for ligne in csv.DictReader(fichier)}
    assert cofog.DATASET in jeux
