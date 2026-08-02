"""Deux taux, deux questions : ce que vote la commune, ce que paie le
propriétaire. Les confondre ferait accuser un conseil municipal de hausses
qu'il n'a pas votées."""


from plateforme.normalize import fiscalite

ENTETE = "exercice;dep;com;e12vote;taux_global_tfb\n"


def csv_de(*lignes: str) -> bytes:
    return (ENTETE + "\n".join(lignes) + "\n").encode("utf-8-sig")


def test_les_codes_communes_se_reconstituent_partout():
    assert fiscalite.code_commune("33", "318") == "33318"
    assert fiscalite.code_commune("2A", "004") == "2A004"
    assert fiscalite.code_commune("971", "01") == "97101"


def test_le_filtre_depuis_borne_l_historique():
    lignes, _ = fiscalite.lire(csv_de("2021;33;318;47.38;47.56", "2023;33;318;47.38;47.86"), 2022)
    assert [ligne["exercice"] for ligne in lignes] == ["2023"]


def test_un_global_inferieur_au_communal_est_ecarte_et_dit_pourquoi():
    """Le taux global contient le communal : l'inverse est une ligne fausse."""
    lignes, ecartees = fiscalite.lire(csv_de("2023;33;318;47.38;40.00"), 2022)
    assert lignes == []
    assert ecartees == {"33318/2023": "global 40.0 < communal 47.38"}


def test_une_valeur_vide_disparait_sans_devenir_zero():
    lignes, ecartees = fiscalite.lire(csv_de("2023;33;318;;47.86"), 2022)
    assert lignes == [] and ecartees == {}


def test_la_fixture_reelle_passe_les_controles():
    import json
    from pathlib import Path

    brut = json.loads(
        (Path(__file__).parent / "fixtures/fiscalite_particuliers_sample.json").read_text()
    )
    contenu = ENTETE + "\n".join(
        f"{r['exercice']};{r['dep']};{r['com']};{r['e12vote']};{r['taux_global_tfb']}"
        for r in brut["results"]
    )
    lignes, ecartees = fiscalite.lire(contenu.encode("utf-8-sig"), 2022)
    assert ecartees == {}
    pessac = [ligne for ligne in lignes if ligne["code"] == "33318"]
    # le taux communal de Pessac n'a pas bougé quand le global montait :
    # c'est exactement la distinction que les deux indicateurs portent
    assert {ligne["communal"] for ligne in pessac} == {47.38}
    assert max(ligne["total"] for ligne in pessac) > 48


def test_les_deux_indicateurs_disent_qui_decide_et_qui_paie():
    _, _, communal = fiscalite.INDICATEURS["dgfip_taux_tfb_commune"][1], None, \
        fiscalite.INDICATEURS["dgfip_taux_tfb_commune"][2]
    assert "conseil municipal" in communal
    globale = fiscalite.INDICATEURS["dgfip_taux_tfb_global"][2]
    assert "avis" in globale
    assert "ne signifie pas une facture" in globale


def test_le_jeu_est_au_registre():
    import csv as module_csv
    from pathlib import Path

    registre = Path(fiscalite.__file__).parents[3] / "infra/supabase/seed/dataset_registry.csv"
    with registre.open(encoding="utf-8") as fichier:
        jeux = {ligne["dataset_id"]: ligne for ligne in module_csv.DictReader(fichier)}
    assert fiscalite.DATASET in jeux
    assert jeux[fiscalite.DATASET]["target_tables"] == "core.observations"
