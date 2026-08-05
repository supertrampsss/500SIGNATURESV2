"""La base permanente des équipements : agréger au bon niveau, ne pas compter
deux fois, et ne pas laisser croire qu'un nombre mesure un niveau de service.

La fixture est un extrait réel — Bordeaux et deux voisines avec leurs totaux
*et* quarante lignes de détail, un département, une région, une
intercommunalité et vingt aires d'attraction qui ne doivent pas être chargées.
"""

from pathlib import Path

import pytest

from plateforme.normalize import equipements

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def archive() -> bytes:
    return (FIXTURES / "insee_bpe_sample.zip").read_bytes()


def test_seules_les_lignes_agregees_sont_lues(archive):
    """La base descend à deux cent trente-six types, et chaque type porte le
    code de son domaine. Lire le détail *et* le total compterait chaque
    équipement deux fois — c'est le piège de toute nomenclature hiérarchique
    servie à plat."""
    lignes = equipements.lire(archive)
    # La fixture compte 105 lignes : 40 de détail, 20 aires d'attraction, et
    # 37 agrégats sur les mailles qu'on charge — commune, département, région.
    # Une commune rurale n'a pas les huit domaines — pas de tourisme, pas de
    # transport — d'où 21 lignes communales pour trois communes et non 24.
    assert len(lignes) == 37
    assert {ligne["domaine"] for ligne in lignes} == set(equipements.DOMAINES)
    # Bordeaux, elle, les a tous.
    bordeaux = [
        ligne for ligne in lignes
        if ligne["niveau"] == "commune" and ligne["code"] == "33063"
    ]
    assert len(bordeaux) == len(equipements.DOMAINES)


def test_les_zonages_d_etude_sont_ecartes(archive):
    """Aires d'attraction, bassins de vie, unités urbaines : des zonages
    d'étude, pas des collectivités. Ils n'ont ni fiche ni budget ici."""
    lignes = equipements.lire(archive)
    assert {ligne["niveau"] for ligne in lignes} <= {
        "commune", "departement", "region"
    }


def test_la_somme_des_domaines_fait_le_total(archive):
    """Le contrôle bloquant, sur données réelles : Bordeaux, 14 857 équipements,
    et sept domaines qui les recomposent exactement."""
    lignes = equipements.lire(archive)
    assert equipements.controler(lignes) == {}
    bordeaux = {
        ligne["domaine"]: ligne["valeur"]
        for ligne in lignes
        if ligne["niveau"] == "commune" and ligne["code"] == "33063"
    }
    assert bordeaux["_T"] == 14857.0
    assert sum(v for d, v in bordeaux.items() if d != "_T") == 14857.0


def test_un_domaine_manquant_arrete_le_chargement():
    """Un domaine perdu en route ne se verrait nulle part ailleurs : le total
    resterait juste, la carte d'un domaine serait creuse."""
    lignes = [
        {"domaine": "_T", "niveau": "commune", "code": "33063", "periode": "2025",
         "valeur": 100.0},
        {"domaine": "A", "niveau": "commune", "code": "33063", "periode": "2025",
         "valeur": 60.0},
    ]
    with pytest.raises(equipements.TotalIncoherent) as erreur:
        equipements.controler(lignes)
    assert "33063" in str(erreur.value)


def test_les_fiches_disent_ce_que_le_nombre_n_est_pas():
    """Un hypermarché compte pour un, une supérette aussi. Le dénombrement dit
    ce qui existe, pas ce que ça pèse — et la fiche doit le dire, sans quoi le
    lecteur y verra un niveau de service."""
    assert "taille" in equipements.PUBLIQUE["_T"]
    assert "surfaces" in equipements.PUBLIQUE["B"]
    assert "compte pour un" in equipements.PUBLIQUE["D"]
    assert "lits" in equipements.PUBLIQUE["G"]
    # L'enseignement de cette base n'est pas celui de l'annuaire du ministère.
    assert "annuaire du ministère" in equipements.PUBLIQUE["C"]
    # Et toutes tiennent dans la limite de la fiche publique.
    for domaine, texte in equipements.PUBLIQUE.items():
        assert len(texte.split()) <= 50, domaine


def test_le_libelle_du_producteur_est_repris_tel_quel():
    """« Services pour les particuliers » mêle la poste et le coiffeur. Le
    renommer « services publics » ferait dire à la donnée autre chose."""
    libelles = {libelle for _, libelle in equipements.DOMAINES.values()}
    assert "Services pour les particuliers" in libelles
    assert not any("service public" in x.lower() for x in libelles)


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(tmp_path):
    from plateforme import entrepot, registry

    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    try:
        registry.sync(conn)
        equipements.declarer(conn)
        equipements.declarer(conn)
        (compte,) = conn.execute(
            "select count(*) from core.indicators where indicator_id like"
            " 'insee_equipements%'"
        ).fetchone()
        assert compte == len(equipements.DOMAINES)
        (fiches,) = conn.execute(
            "select count(*) from core.indicator_definitions"
        ).fetchone()
        assert fiches == len(equipements.DOMAINES)
    finally:
        conn.close()
