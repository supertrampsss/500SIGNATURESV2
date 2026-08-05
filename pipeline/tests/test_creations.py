"""Les créations d'entreprises : le piège du siège, et celui du double compte.

La fixture est un extrait réel du fichier de l'INSEE — Bordeaux, Paris, une
commune nouvelle de statut W, une petite commune girondine, Bordeaux Métropole,
la Gironde, la Nouvelle-Aquitaine, les deux France, et un exemple de chaque
zonage à écarter, dont un bassin de vie qui porte le même code que Bordeaux.
"""

from pathlib import Path

import pytest

from plateforme.normalize import creations

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def archive() -> bytes:
    return (FIXTURES / "insee_creations_sample.zip").read_bytes()


def test_seuls_les_territoires_du_site_sont_retenus(archive):
    """Le jeu croise onze découpages. Les aires d'attraction, bassins de vie,
    unités urbaines et zones d'emploi sont des zonages d'étude ; les
    arrondissements municipaux de Paris, Lyon et Marseille sont déjà comptés
    dans leur commune, et les charger la compterait deux fois."""
    lignes = creations.lire(archive)
    assert {ligne["niveau"] for ligne in lignes} <= {
        "commune", "departement", "region"
    }
    assert lignes, "la fixture ne rend aucune ligne"
    # Le bassin de vie 33063 porte le même code que Bordeaux : c'est le
    # découpage, pas le code, qui décide.
    bordeaux = [ligne for ligne in lignes if ligne["code"] == "33063"]
    assert {ligne["niveau"] for ligne in bordeaux} == {"commune"}
    assert {ligne["valeur"] for ligne in bordeaux} == {8468.0, 11215.0, 11404.0}


def test_seul_le_croisement_total_est_charge(archive):
    """Le jeu ventile par secteur A10 *et* par forme légale. Charger une ligne
    de détail en plus du total compterait deux fois la même immatriculation."""
    lignes = creations.lire(archive)
    par_cle = {}
    for ligne in lignes:
        cle = (ligne["niveau"], ligne["code"], ligne["periode"])
        assert cle not in par_cle, f"{cle} chargé deux fois"
        par_cle[cle] = ligne["valeur"]
    # La fixture porte, pour chaque territoire, le total et deux lignes de
    # détail du secteur GI : seul le total doit passer.
    assert par_cle[("commune", "75056", "2024")] == 100973.0


def test_une_commune_qui_recoit_les_creations_d_une_autre_est_signalee(archive):
    """`W` marque une commune nouvelle qui a absorbé une déléguée et reçoit ses
    immatriculations. Ces lignes comptent dans le total France — les écarter
    ferait tomber la somme des communes sous ce total. Elles sont donc chargées
    et signalées : leur valeur couvre plus de territoire que la commune seule,
    alors que sa population ne couvre qu'elle."""
    lignes = creations.lire(archive)
    regroupees = [
        ligne
        for ligne in lignes
        if creations.DRAPEAU_REGROUPEMENT in ligne["drapeaux"]
    ]
    assert regroupees, "la fixture ne porte aucune commune de regroupement"
    assert all(ligne["valeur"] > 0 for ligne in regroupees)
    assert {(ligne["code"], ligne["periode"]) for ligne in regroupees} == {
        ("85084", "2023")
    }


def test_une_seule_France_sert_de_total(archive):
    """La source publie deux périmètres — France entière et métropolitaine. Les
    communes chargées incluent les départements d'outre-mer : c'est donc la
    France entière qui doit servir de total, et la métropole ferait un contrôle
    faux de trente mille créations."""
    totaux = creations.totaux_france(archive)
    assert set(totaux) == {"2023", "2024", "2025"}
    assert totaux["2024"] == 1111238.0
    assert totaux["2025"] == 1165795.0
    # Le périmètre métropolitain, lui, est plus bas — et n'est pas retenu.
    assert totaux["2024"] != 1077587.0


def test_le_controle_bloque_si_la_somme_des_communes_derive():
    """Le contrôle qui compte. Un écart signifierait qu'une part des
    immatriculations n'est plus rattachée à une commune."""
    lignes = [
        {"niveau": "commune", "code": "33063", "periode": "2025", "valeur": 11404.0},
        {"niveau": "commune", "code": "33281", "periode": "2025", "valeur": 1483.0},
        # Les mailles supra ne comptent pas dans la somme : elles reprennent
        # les mêmes créations.
        {"niveau": "departement", "code": "33", "periode": "2025", "valeur": 35443.0},
    ]
    assert creations.controler(lignes, {"2025": 12887.0}) == {}
    with pytest.raises(creations.TotalIncoherent) as erreur:
        creations.controler(lignes, {"2025": 12900.0})
    assert "2025" in str(erreur.value)


def test_le_controle_ignore_les_exercices_absents_du_chargement():
    """La source publie quatorze exercices ; un chargement borné n'en couvre pas
    forcément autant. Comparer un exercice qu'on n'a pas chargé à son total
    France déclencherait une fausse alerte."""
    lignes = [{"niveau": "commune", "code": "33063", "periode": "2025", "valeur": 3.0}]
    assert creations.controler(lignes, {"2025": 3.0, "2012": 546983.0}) == {}


def test_la_fiche_dit_le_siege_le_flux_et_l_agriculture():
    """Les trois confusions que ce jeu invite à faire : le lieu d'activité, le
    stock d'entreprises, et un champ qu'on croirait complet."""
    publique = creations.FICHE["public"]
    assert "siège" in publique
    assert "flux" in publique
    assert "agriculture" in publique.lower()
    assert len(publique.split()) <= 50
    technique = creations.FICHE["technique"]
    assert "unités légales" in technique
    assert "domiciliation" in technique
    assert "Établissements actifs" in technique


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(tmp_path):
    from plateforme import entrepot, registry

    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    try:
        registry.sync(conn)
        creations.declarer(conn)
        creations.declarer(conn)
        (compte,) = conn.execute(
            "select count(*) from core.indicators where indicator_id = ?",
            (creations.INDICATEUR,),
        ).fetchone()
        assert compte == 1
        (unite,) = conn.execute(
            "select d.unit_notes from core.indicators i"
            " join core.indicator_definitions d using (definition_id)"
            " where i.indicator_id = ?",
            (creations.INDICATEUR,),
        ).fetchone()
        assert unite == "unités légales enregistrées"
    finally:
        conn.close()
