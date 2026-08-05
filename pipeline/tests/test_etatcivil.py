"""Mariages, pacs et divorces : domiciliés, annuels, et une France sur trois.

Trois filtres décident de tout ici, et chacun laisserait passer un chiffre faux.
Les mariages *enregistrés* comptent là où la cérémonie a eu lieu et non là où les
époux habitent. Les séries mensuelles nationales cohabitent avec les annuelles
dans le même fichier. Et la source publie trois « France » dont deux sont des
périmètres plus étroits qui passeraient pour le chiffre national.
"""

from pathlib import Path

import pytest

from plateforme.normalize import etatcivil

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def archive() -> bytes:
    return (FIXTURES / "insee_etat_civil_unions_sample.zip").read_bytes()


@pytest.fixture(scope="module")
def lignes(archive) -> list[dict]:
    return etatcivil.lire(archive)


def test_les_mariages_charges_sont_les_domicilies(lignes):
    """Le piège des décès, à l'identique. En Gironde en 2016, la source publie
    5 709 mariages domiciliés et 5 587 enregistrés : ce n'est pas le même
    chiffre, et seul le premier décrit le territoire."""
    gironde = {
        (ligne["serie"], ligne["periode"]): ligne["valeur"]
        for ligne in lignes
        if ligne["niveau"] == "departement" and ligne["code"] == "33"
    }
    assert gironde[(("MAR_DOM", "MAR"), "2016")] == 5709.0
    assert not [ligne for ligne in lignes if ligne["serie"][0] == "MAR_REG"]


def test_les_series_mensuelles_ne_passent_pas(lignes):
    """La source mêle mensuel et annuel dans le même fichier. Chargés ensemble,
    les douze mois d'une année s'ajouteraient à cette même année."""
    assert all("-" not in ligne["periode"] for ligne in lignes)
    assert all(len(ligne["periode"]) == 4 for ligne in lignes)


def test_une_seule_France_est_retenue(lignes):
    """`F` est la France entière. `FM` (métropolitaine) et `FM_X_R11` (métropole
    hors Île-de-France) sont deux périmètres plus étroits du même comptage."""
    pays = {ligne["code"] for ligne in lignes if ligne["niveau"] == "pays"}
    assert pays == {"FR"}
    # Et les agrégats d'outre-mer du découpage « autre » ne sont pas des
    # territoires du site.
    assert {ligne["niveau"] for ligne in lignes} <= {"departement", "region", "pays"}


def test_l_identite_des_mariages_par_sexe_se_referme(lignes):
    """Mariages de sexe opposé + de même sexe = mariages."""
    assert etatcivil.controler(lignes) > 0


def test_le_controle_saute_les_annees_sans_mariage_de_meme_sexe():
    """Avant mai 2013, il n'y a pas de donnée manquante : il n'y a pas de
    mariage possible. Crier sur cette absence ferait échouer tout chargement
    qui remonte avant 2013 — c'est-à-dire tous."""
    lignes = [
        {"niveau": "departement", "code": "33", "periode": "2010",
         "serie": ("MAR_DOM", "MAR"), "valeur": 5000.0, "drapeaux": []},
        {"niveau": "departement", "code": "33", "periode": "2010",
         "serie": ("MAR_DOM", "MARO"), "valeur": 5000.0, "drapeaux": []},
        {"niveau": "departement", "code": "33", "periode": "2016",
         "serie": ("MAR_DOM", "MAR"), "valeur": 5709.0, "drapeaux": []},
        {"niveau": "departement", "code": "33", "periode": "2016",
         "serie": ("MAR_DOM", "MARO"), "valeur": 5484.0, "drapeaux": []},
        {"niveau": "departement", "code": "33", "periode": "2016",
         "serie": ("MAR_DOM", "MARS"), "valeur": 225.0, "drapeaux": []},
    ]
    assert etatcivil.controler(lignes) == 1


def test_le_controle_bloque_si_les_mariages_ne_se_somment_plus():
    lignes = [
        {"niveau": "departement", "code": "33", "periode": "2016",
         "serie": ("MAR_DOM", "MAR"), "valeur": 5709.0, "drapeaux": []},
        {"niveau": "departement", "code": "33", "periode": "2016",
         "serie": ("MAR_DOM", "MARO"), "valeur": 5484.0, "drapeaux": []},
        {"niveau": "departement", "code": "33", "periode": "2016",
         "serie": ("MAR_DOM", "MARS"), "valeur": 300.0, "drapeaux": []},
    ]
    with pytest.raises(etatcivil.IdentiteRompue) as erreur:
        etatcivil.controler(lignes)
    assert "2016" in str(erreur.value)


def test_le_controle_echoue_si_rien_n_a_pu_etre_verifie():
    with pytest.raises(etatcivil.IdentiteRompue):
        etatcivil.controler([])


def test_les_valeurs_provisoires_sont_signalees(lignes):
    """Le taux de nuptialité 2024 est provisoire. Une valeur qui peut bouger à
    la prochaine parution doit se présenter comme telle."""
    provisoires = [ligne for ligne in lignes if "provisional" in ligne["drapeaux"]]
    assert provisoires, "la fixture ne porte aucune valeur provisoire"
    assert all(ligne["periode"] >= "2023" for ligne in provisoires)


def test_le_taux_de_nuptialite_n_est_pas_un_effectif():
    """Un taux pour mille et un nombre de mariages ne s'additionnent pas. C'est
    l'unité qui l'interdit, et elle est déclarée avec l'indicateur."""
    _, _, unite, compte = etatcivil.SERIES[("MARRT", "_Z")]
    assert unite == "pour_1000_habitants"
    assert "pour mille" in compte
    assert etatcivil.SERIES[("MAR_DOM", "MAR")][2] == "count"


def test_les_fiches_disent_les_series_arretees():
    """Un pacs de 2016 affiché à côté d'un mariage de 2024 se lit mal si l'on
    ne sait pas pourquoi. Les deux fiches concernées le disent."""
    assert "2016" in etatcivil.PUBLIQUE["insee_pacs"]
    assert "2016" in etatcivil.PUBLIQUE["insee_divorces"]
    assert "2013" in etatcivil.PUBLIQUE["insee_mariages_meme_sexe"]
    assert "cérémonie" in etatcivil.PUBLIQUE["insee_mariages"]
    for identifiant, texte in etatcivil.PUBLIQUE.items():
        assert len(texte.split()) <= 50, f"{identifiant} : {len(texte.split())} mots"
    assert "domiciliés" in etatcivil.TECHNIQUE
    assert "mensuelles" in etatcivil.TECHNIQUE


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(tmp_path):
    from plateforme import entrepot, registry

    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    try:
        registry.sync(conn)
        etatcivil.declarer(conn)
        etatcivil.declarer(conn)
        lignes = dict(conn.execute(
            "select indicator_id, additive from core.indicators where dataset_id = ?",
            (etatcivil.DATASET,),
        ).fetchall())
        assert len(lignes) == len(etatcivil.SERIES)
        # Un taux ne s'additionne pas : c'est cette colonne qui empêche le site
        # d'en faire une somme de territoires.
        assert lignes["insee_mariages"] is True
        assert lignes["insee_taux_nuptialite"] is False
    finally:
        conn.close()
