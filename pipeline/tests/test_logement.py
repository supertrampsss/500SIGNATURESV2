"""Les logements du recensement : trois totaux à plat, et un piège par ligne.

Le jeu sert les agrégats *et* leurs composantes sur les mêmes lignes, croisés
sur neuf dimensions. Un filtre qui lâche ne fait pas planter le chargement : il
compte le nombre de pièces comme des logements, ou les trois-pièces comme le
parc entier. Ce sont les identités de la source qui l'attrapent, et rien d'autre.

La fixture est un extrait réel — Bordeaux, une commune girondine, Bordeaux
Métropole, la Gironde, la Nouvelle-Aquitaine, les deux France, un arrondissement
municipal et deux zonages d'étude à écarter, plus les deux pièges gardés exprès.
"""

from pathlib import Path

import pytest

from plateforme.normalize import logement

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def archive() -> bytes:
    return (FIXTURES / "insee_logement_sample.zip").read_bytes()


@pytest.fixture(scope="module")
def lignes(archive) -> list[dict]:
    return logement.lire(archive)


def test_seuls_les_territoires_du_site_sont_retenus(lignes):
    """Les aires d'attraction et zones d'emploi sont des zonages d'étude ; les
    arrondissements municipaux sont déjà comptés dans leur commune."""
    assert lignes
    assert {ligne["niveau"] for ligne in lignes} <= {
        "commune", "epci", "departement", "region"
    }


def test_le_nombre_de_pieces_n_est_pas_un_nombre_de_logements(lignes):
    """Le jeu publie quatre mesures au même format : logements, nombre de
    pièces, durée de séjour, population des ménages. La fixture porte des lignes
    « nombre de pièces » sur les mêmes territoires et les mêmes croisements —
    les charger gonflerait le parc de Bordeaux de trois cent mille pièces."""
    bordeaux = [
        ligne for ligne in lignes
        if ligne["code"] == "33063" and ligne["periode"] == "2023"
        and (ligne["categorie"], ligne["statut_occupation"]) == ("_T", "_T")
    ]
    assert len(bordeaux) == 1, "le total du parc doit être unique par millésime"
    assert round(bordeaux[0]["valeur"]) == 171777


def test_le_detail_par_pieces_ne_passe_pas(lignes):
    """Sept dimensions ventilent le même parc. La fixture porte les
    trois-pièces : additionnés au total, ils compteraient deux fois."""
    principales = [
        ligne for ligne in lignes
        if ligne["code"] == "33063" and ligne["periode"] == "2023"
        and (ligne["categorie"], ligne["statut_occupation"]) == ("DW_MAIN", "_T")
    ]
    assert len(principales) == 1
    assert round(principales[0]["valeur"]) == 148377


def test_les_trois_identites_de_la_source_se_referment(lignes):
    """Le contrôle qui compte. Résidences principales + secondaires + vacants =
    parc ; propriétaires + locataires + gratuits = résidences principales ; parc
    privé + parc social + meublé = locataires."""
    verifies = logement.controler(lignes)
    assert set(verifies) == {nom for nom, _, _ in logement.IDENTITES}
    assert all(compte > 0 for compte in verifies.values())


def test_le_controle_bloque_sur_un_total_qui_ne_fait_plus_sa_somme():
    """Un logement passé du bon sac au mauvais ne se verrait nulle part
    ailleurs : la carte l'afficherait sans broncher."""
    base = [
        ("_T", "_T", 1000.0),
        ("DW_MAIN", "_T", 800.0),
        ("DW_SEC_DW_OCC", "_T", 120.0),
        ("DW_VAC", "_T", 80.0),
        ("DW_MAIN", "100", 500.0),
        ("DW_MAIN", "200", 280.0),
        ("DW_MAIN", "300", 20.0),
        ("DW_MAIN", "211", 180.0),
        ("DW_MAIN", "221", 90.0),
        ("DW_MAIN", "212_222", 10.0),
    ]
    lignes = [
        {"niveau": "commune", "code": "33063", "periode": "2023",
         "categorie": categorie, "statut_occupation": statut, "valeur": valeur,
         "drapeaux": []}
        for categorie, statut, valeur in base
    ]
    assert logement.controler(lignes)["categories_egalent_le_parc"] == 1
    # Dix logements vacants qui s'évaporent : le parc annoncé reste à mille, ses
    # trois catégories n'en font plus que neuf cent quatre-vingt-dix.
    fausse = [dict(ligne) for ligne in lignes]
    fausse[3]["valeur"] = 70.0
    with pytest.raises(logement.IdentiteRompue) as erreur:
        logement.controler(fausse)
    assert "categories_egalent_le_parc" in str(erreur.value)
    assert "33063" in str(erreur.value)


def test_le_controle_echoue_si_rien_n_a_pu_etre_verifie():
    """Un contrôle qui ne contrôle rien passerait en silence, et c'est exactement
    ce qu'on verrait si le filtre de lecture devenait trop serré."""
    with pytest.raises(logement.IdentiteRompue) as erreur:
        logement.controler([])
    assert "aucun territoire" in str(erreur.value)


def test_le_parc_social_reste_une_part_des_locataires(lignes):
    """L'identité qui garde l'indicateur le plus regardé à sa place : le parc
    social affiché doit être une composante des locataires, pas un total voisin
    ramassé par erreur."""
    bordeaux = {
        (ligne["categorie"], ligne["statut_occupation"]): ligne["valeur"]
        for ligne in lignes
        if ligne["code"] == "33063" and ligne["periode"] == "2023"
    }
    assert bordeaux[("DW_MAIN", "221")] < bordeaux[("DW_MAIN", "200")]
    assert round(bordeaux[("DW_MAIN", "221")]) == 20552


def test_seule_la_France_entiere_sert_de_total(archive):
    """La source publie deux périmètres, `F` et `FM`. Le parc de France entière
    compte 37,9 millions de logements en 2023, la métropole 36,9."""
    totaux = logement.total_france(archive)
    assert sorted(totaux) == ["2012", "2017", "2023"]
    assert round(totaux["2023"]) == 37878249
    assert round(totaux["2012"]) == 34037824


def test_les_fiches_disent_le_vacant_le_social_et_le_recensement():
    """Trois confusions coûteuses, et elles sont toutes dans les fiches.

    Le vacant du recensement n'est pas celui de la DGFiP ; le parc social
    déclaré au recensement n'est pas le répertoire qui fait foi pour la loi ; et
    un millésime du recensement n'est pas une photographie."""
    assert "DGFiP" in logement.PUBLIQUE["insee_logements_vacants"]
    assert "répertoire" in logement.PUBLIQUE["insee_residences_principales_parc_social"]
    assert "obligations légales" in logement.PUBLIQUE[
        "insee_residences_principales_parc_social"
    ]
    for identifiant, texte in logement.PUBLIQUE.items():
        assert len(texte.split()) <= 50, f"{identifiant} : {len(texte.split())} mots"
    assert "hors Mayotte" in logement.TECHNIQUE
    assert "cinq années d'enquêtes" in logement.TECHNIQUE
    assert "décimales" in logement.TECHNIQUE


def test_chaque_indicateur_publie_a_sa_fiche_et_son_unite_de_compte():
    """Les catégories dénombrent des logements, les statuts d'occupation des
    résidences principales. Additionner « vacants » et « propriétaires
    occupants » n'aurait aucun sens ; c'est cette mention qui le dit."""
    publies = logement.indicateurs()
    assert len(publies) == len(logement.CATEGORIES) + len(logement.STATUTS)
    for (categorie, statut), (identifiant, libelle, unite) in publies.items():
        assert identifiant in logement.PUBLIQUE, identifiant
        assert libelle
        assert unite == ("logements" if statut == "_T" else "résidences principales")
        # Un statut d'occupation ne s'applique qu'aux résidences principales :
        # « propriétaire occupant d'un logement vacant » ne veut rien dire.
        if statut != "_T":
            assert categorie == "DW_MAIN", identifiant


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(tmp_path):
    from plateforme import entrepot, registry

    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    try:
        registry.sync(conn)
        logement.declarer(conn)
        logement.declarer(conn)
        (compte,) = conn.execute(
            "select count(*) from core.indicators where dataset_id = ?", (logement.DATASET,)
        ).fetchone()
        assert compte == len(logement.indicateurs())
        (fiches,) = conn.execute(
            "select count(*) from core.indicator_definitions"
        ).fetchone()
        assert fiches == compte
        unites = dict(conn.execute(
            "select i.indicator_id, d.unit_notes from core.indicators i"
            " join core.indicator_definitions d using (definition_id)"
            " where i.dataset_id = ?", (logement.DATASET,)
        ).fetchall())
        assert unites["insee_logements_vacants"] == "logements"
        assert unites["insee_residences_principales_proprietaire"] == "résidences principales"
    finally:
        conn.close()
