"""Les catégories sociales : quinze ans et plus, et une catégorie qui manque.

Deux pièges tiennent tout le module. Le jeu ne publie **aucun total tous âges**
— la catégorie sociale commence à quinze ans — et son indicateur de population
n'est donc pas celui du site : 56,5 millions contre 68. Et la nomenclature n'a
**pas de catégorie 8** ici : une somme écrite de un à huit manquerait son total
sans prévenir.
"""

from pathlib import Path

import pytest

from plateforme.normalize import professions

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def archive() -> bytes:
    return (FIXTURES / "insee_population_comp_sample.zip").read_bytes()


@pytest.fixture(scope="module")
def lignes(archive) -> list[dict]:
    return professions.lire(archive)


def test_seuls_les_territoires_du_site_sont_retenus(lignes):
    assert lignes
    assert {ligne["niveau"] for ligne in lignes} <= {
        "commune", "departement", "region"
    }


def test_la_nomenclature_de_ce_jeu_n_a_pas_de_categorie_huit():
    """La nomenclature complète en compte une — « autres sans activité
    professionnelle » — que la source fond dans les autres inactifs. Une somme
    de un à huit manquerait son total, et le contrôle le dirait ; une somme de
    un à sept aussi. Celle-ci est écrite depuis les codes eux-mêmes."""
    assert "8" not in professions.CATEGORIES
    assert set(professions.CATEGORIES) == {"1", "2", "3", "4", "5", "6", "7", "9"}
    composantes = dict(
        (nom, parts) for nom, parts, _ in professions.IDENTITES
    )["categories_egalent_le_total"]
    assert {code for code, _, _ in composantes} == set(professions.CATEGORIES)


def test_les_trois_identites_se_referment(lignes):
    """Les huit catégories font le total ; les trois tranches d'âge font les
    quinze ans et plus ; hommes plus femmes font le total."""
    verifies = professions.controler(lignes)
    assert set(verifies) == {nom for nom, _, _ in professions.IDENTITES}
    assert all(compte > 0 for compte in verifies.values())


def test_le_controle_bloque_sur_une_categorie_manquante():
    base = [
        ("_T", "_T", "Y_GE15", 1000.0),
        ("1", "_T", "Y_GE15", 10.0), ("2", "_T", "Y_GE15", 40.0),
        ("3", "_T", "Y_GE15", 200.0), ("4", "_T", "Y_GE15", 150.0),
        ("5", "_T", "Y_GE15", 160.0), ("6", "_T", "Y_GE15", 120.0),
        ("7", "_T", "Y_GE15", 250.0), ("9", "_T", "Y_GE15", 70.0),
        ("_T", "_T", "Y15T24", 150.0), ("_T", "_T", "Y25T54", 450.0),
        ("_T", "_T", "Y_GE55", 400.0),
        ("_T", "M", "Y_GE15", 480.0), ("_T", "F", "Y_GE15", 520.0),
    ]
    lignes = [
        {"niveau": "commune", "code": "33063", "periode": "2023", "categorie": pcs,
         "sexe": sexe, "age": age, "valeur": valeur, "drapeaux": []}
        for pcs, sexe, age, valeur in base
    ]
    assert professions.controler(lignes)["categories_egalent_le_total"] == 1
    # Les soixante-dix « autres inactifs » qui disparaissent : c'est exactement
    # ce qu'on verrait d'une catégorie oubliée dans la table.
    fausse = [ligne for ligne in lignes if ligne["categorie"] != "9"]
    with pytest.raises(professions.IdentiteRompue):
        professions.controler(fausse + [
            {"niveau": "commune", "code": "33063", "periode": "2023", "categorie": "9",
             "sexe": "_T", "age": "Y_GE15", "valeur": 0.0, "drapeaux": []}
        ])


def test_le_controle_echoue_si_rien_n_a_pu_etre_verifie():
    with pytest.raises(professions.IdentiteRompue) as erreur:
        professions.controler([])
    assert "aucun territoire" in str(erreur.value)


def test_seuls_les_croisements_tous_sexes_sont_publies(lignes):
    """La ventilation par sexe ferme une identité de contrôle. La publier
    doublerait le volume pour une lecture que la fiche ne propose pas."""
    publies = professions.indicateurs()
    assert all(sexe == "_T" for _, sexe, _ in publies)
    # Et le croisement PCS × tranche d'âge, présent dans la fixture, n'est même
    # pas lu : il compterait les cadres une seconde fois, et le garder en
    # mémoire coûterait onze millions de lignes sur le vrai fichier.
    assert ("3", "_T", "Y25T54") not in publies
    assert ("3", "_T", "Y25T54") not in professions.croisements_retenus()
    assert not [
        ligne for ligne in lignes
        if (ligne["categorie"], ligne["age"]) == ("3", "Y25T54")
    ]


def test_seuls_quatorze_croisements_sont_lus():
    """Le jeu en croise trois cent vingt-quatre. Tout garder faisait 11,7
    millions de dictionnaires en mémoire — de quoi tuer un runner qui tient
    déjà l'entrepôt ouvert. Les douze publiés et les deux sexes du contrôle
    suffisent."""
    retenus = professions.croisements_retenus()
    assert len(retenus) == len(professions.indicateurs()) + 2
    assert (professions.TOTAL, "M", professions.QUINZE_ET_PLUS) in retenus
    assert (professions.TOTAL, "F", professions.QUINZE_ET_PLUS) in retenus
    # Ce qui est lu doit suffire à fermer les trois identités : un croisement
    # oublié ici ferait passer un contrôle qui ne contrôle rien.
    for _, composantes, total in professions.IDENTITES:
        assert set(composantes) <= retenus
        assert total in retenus


def test_bordeaux_a_ses_categories_et_ses_tranches(lignes):
    publies = professions.indicateurs()
    bordeaux = {
        publies[(ligne["categorie"], ligne["sexe"], ligne["age"])][0]: ligne["valeur"]
        for ligne in lignes
        if ligne["code"] == "33063" and ligne["periode"] == "2023"
        and (ligne["categorie"], ligne["sexe"], ligne["age"]) in publies
    }
    assert len(bordeaux) == len(publies)
    assert round(bordeaux["insee_population_15_ans_et_plus"]) == 232326
    assert round(bordeaux["insee_pcs_cadres"]) == 50661
    # Ville universitaire : les « autres inactifs » y pèsent plus que les
    # retraités, et c'est la fiche qui explique pourquoi.
    assert bordeaux["insee_pcs_autres_inactifs"] > bordeaux["insee_pcs_retraites"]


def test_seule_la_France_entiere_sert_de_total(archive):
    totaux = professions.totaux_france(archive)
    assert sorted(totaux) == ["2012", "2017", "2023"]
    assert round(totaux["2023"]) == 56529157


def test_les_fiches_disent_les_quinze_ans_et_le_piege_des_retraites():
    """Deux confusions coûteuses. Cette population n'est pas celle du site — la
    prendre pour dénominateur décalerait tous les ratios de dix-sept pour cent.
    Et « retraité » est une catégorie sociale, pas un âge."""
    assert "pas la population du territoire" in professions.PUBLIQUE[
        "insee_population_15_ans_et_plus"
    ]
    assert "catégorie sociale et non une tranche d'âge" in professions.PUBLIQUE[
        "insee_pcs_retraites"
    ]
    assert "étudiants" in professions.PUBLIQUE["insee_pcs_autres_inactifs"]
    for identifiant, texte in professions.PUBLIQUE.items():
        assert len(texte.split()) <= 50, f"{identifiant} : {len(texte.split())} mots"
    assert "population municipale" in professions.TECHNIQUE
    assert "quinze ans" in professions.TECHNIQUE
    assert "huitième" in professions.TECHNIQUE


def test_les_categories_et_les_ages_ne_sont_pas_dans_le_meme_theme():
    """« Combien sommes-nous » et « qui sommes-nous » ne sont pas la même
    question : les mélanger ferait un thème de quinze lignes où l'on cherche
    une réponse."""
    publies = professions.indicateurs()
    themes = {identifiant: theme for identifiant, _, theme in publies.values()}
    assert themes["insee_pcs_cadres"] == professions.THEME_CATEGORIES
    assert themes["insee_population_55_ans_et_plus"] == professions.THEME_AGES
    assert themes["insee_population_15_ans_et_plus"] == professions.THEME_AGES


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(tmp_path):
    from plateforme import entrepot, registry

    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    try:
        registry.sync(conn)
        professions.declarer(conn)
        professions.declarer(conn)
        (compte,) = conn.execute(
            "select count(*) from core.indicators where dataset_id = ?",
            (professions.DATASET,),
        ).fetchone()
        assert compte == len(professions.indicateurs())
        themes = dict(conn.execute(
            "select indicator_id, theme from core.indicators where dataset_id = ?",
            (professions.DATASET,),
        ).fetchall())
        assert themes["insee_pcs_ouvriers"] == "professions"
        assert themes["insee_population_15_24_ans"] == "population"
    finally:
        conn.close()
