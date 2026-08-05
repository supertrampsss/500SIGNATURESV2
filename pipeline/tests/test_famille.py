"""Les familles du recensement : une hiérarchie servie à plat, et un mot piégé.

Le jeu publie le total, ses trois types et leurs sous-types sur les mêmes
lignes. Les charger tous compterait chaque famille trois fois — et rien ne le
signalerait, puisque le fichier est valide. Ce sont les identités de la source
qui l'attrapent.

Le mot piégé est « enfant » : au recensement il n'a pas d'âge, alors que la
ventilation par nombre d'enfants s'arrête à vingt-quatre ans. La fiche le dit,
et ce test le garde.
"""

from pathlib import Path

import pytest

from plateforme.normalize import famille

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def archive() -> bytes:
    return (FIXTURES / "insee_famille_sample.zip").read_bytes()


@pytest.fixture(scope="module")
def lignes(archive) -> list[dict]:
    return famille.lire(archive)


def test_seuls_les_territoires_du_site_sont_retenus(lignes):
    assert lignes
    assert {ligne["niveau"] for ligne in lignes} <= {
        "commune", "departement", "region"
    }


def test_la_ventilation_par_nombre_d_enfants_ne_passe_pas(lignes):
    """Les deux dimensions décrivent les mêmes familles. La fixture porte les
    familles de deux enfants : chargées en plus du total, elles les
    compteraient deux fois."""
    bordeaux = [
        ligne for ligne in lignes
        if ligne["code"] == "33063" and ligne["periode"] == "2023" and ligne["type"] == "_T"
    ]
    assert len(bordeaux) == 1
    assert round(bordeaux[0]["valeur"]) == 60949


def test_les_trois_identites_se_referment(lignes):
    """Monoparentales + couples sans enfant + couples avec enfant = total ;
    pères seuls + mères seules = monoparentales ; recomposées +
    traditionnelles = couples avec enfant."""
    verifies = famille.controler(lignes)
    assert set(verifies) == {nom for nom, _, _ in famille.IDENTITES}
    assert all(compte > 0 for compte in verifies.values())


def test_les_recomposees_n_existent_qu_en_2023(lignes):
    """La source ne publie la distinction que sur le dernier millésime. Le
    contrôle doit sauter les millésimes où elle manque, sans crier sur une
    donnée qui n'existe pas."""
    millesimes = {ligne["periode"] for ligne in lignes if ligne["type"] == "220"}
    assert millesimes == {"2023"}
    tous = {ligne["periode"] for ligne in lignes}
    assert tous == {"2012", "2017", "2023"}
    verifies = famille.controler(lignes)
    # La troisième identité ne porte donc que sur un millésime des trois.
    assert (
        verifies["recomposees_et_traditionnelles_egalent_les_couples"] * 3
        == verifies["types_egalent_le_total"]
    )


def test_le_controle_bloque_sur_un_type_compte_dans_le_mauvais_sac():
    base = [
        ("_T", 1000.0), ("1", 200.0), ("21", 400.0), ("22", 400.0),
        ("11", 40.0), ("12", 160.0), ("220", 50.0), ("223", 350.0),
    ]
    lignes = [
        {"niveau": "commune", "code": "33063", "periode": "2023", "type": type_,
         "valeur": valeur, "drapeaux": []}
        for type_, valeur in base
    ]
    assert famille.controler(lignes)["types_egalent_le_total"] == 1
    # Vingt familles monoparentales rangées chez les couples sans enfant : le
    # total ne bouge pas, mais les pères et mères seuls ne font plus le compte.
    fausse = [dict(ligne) for ligne in lignes]
    fausse[1]["valeur"] = 180.0
    fausse[2]["valeur"] = 420.0
    with pytest.raises(famille.IdentiteRompue) as erreur:
        famille.controler(fausse)
    assert "parents_seuls_egalent_les_monoparentales" in str(erreur.value)


def test_le_controle_echoue_si_rien_n_a_pu_etre_verifie():
    with pytest.raises(famille.IdentiteRompue) as erreur:
        famille.controler([])
    assert "aucun territoire" in str(erreur.value)


def test_seule_la_France_entiere_sert_de_total(archive):
    """`F` et `FM` cohabitent : 18,68 millions de familles contre 18,16."""
    totaux = famille.totaux_france(archive)
    assert sorted(totaux) == ["2012", "2017", "2023"]
    assert round(totaux["2023"]) == 18680253
    assert round(totaux["2012"]) == 17943446


def test_les_fiches_disent_ce_qu_est_une_famille_et_un_enfant():
    """Deux mots qui ne veulent pas dire ce qu'on croit. Une personne seule
    n'est pas une famille — le total des familles est donc plus bas que celui
    des logements. Et un « enfant » n'a pas d'âge : un adulte resté chez sa
    mère fait de ce foyer une famille monoparentale."""
    assert "vit seule ne compte pas" in famille.PUBLIQUE["insee_familles"]
    assert "quel que soit son âge" in famille.PUBLIQUE["insee_familles_monoparentales"]
    assert "2023" in famille.PUBLIQUE["insee_familles_recomposees"]
    for identifiant, texte in famille.PUBLIQUE.items():
        assert len(texte.split()) <= 50, f"{identifiant} : {len(texte.split())} mots"
    assert "n'est pas un ménage" in famille.TECHNIQUE
    assert "vingt-quatre ans" in famille.TECHNIQUE
    assert "hors Mayotte" in famille.TECHNIQUE


def test_les_types_de_controle_ne_sont_pas_publies():
    """Pères seuls, mères seules et familles traditionnelles ferment les
    identités ; les publier ferait huit lignes là où cinq répondent."""
    assert not set(famille.TYPES) & set(famille.TYPES_DE_CONTROLE)
    assert set(famille.PUBLIQUE) == {identifiant for identifiant, _ in famille.TYPES.values()}


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(tmp_path):
    from plateforme import entrepot, registry

    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    try:
        registry.sync(conn)
        famille.declarer(conn)
        famille.declarer(conn)
        (compte,) = conn.execute(
            "select count(*) from core.indicators where dataset_id = ?", (famille.DATASET,)
        ).fetchone()
        assert compte == len(famille.TYPES)
        (unite,) = conn.execute(
            "select distinct d.unit_notes from core.indicators i"
            " join core.indicator_definitions d using (definition_id)"
            " where i.dataset_id = ?", (famille.DATASET,)
        ).fetchone()
        assert unite == "familles"
    finally:
        conn.close()
