"""Les décès domiciliés : ce qu'on charge, et surtout ce qu'on ne charge pas.

La fixture est un extrait réel du fichier de l'INSEE — quelques communes, un
département, une région, les trois France, et — à écarter — une
intercommunalité, des aires d'attraction, un exemple de chaque statut
d'observation.
"""

from pathlib import Path

import pytest

from plateforme.normalize import deces

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def archive() -> bytes:
    return (FIXTURES / "insee_deces_sample.zip").read_bytes()


def test_seuls_les_territoires_du_site_sont_retenus(archive):
    """Le jeu couvre onze découpages. Les aires d'attraction, bassins de vie,
    unités urbaines et zones d'emploi sont des zonages d'étude : ils n'ont ni
    fiche ni budget ici, et les charger remplirait l'entrepôt sans rien
    éclairer."""
    lignes = deces.lire(archive)
    assert {ligne["niveau"] for ligne in lignes} <= {
        "commune", "departement", "region"
    }
    assert lignes, "la fixture ne rend aucune ligne"
    # L'extrait contient deux cents aires d'attraction : aucune ne doit passer.
    assert len(lignes) < 40


def test_une_commune_qui_recoit_les_deces_d_une_autre_est_chargee_et_signalee(archive):
    """Le piège de ce jeu, et il ne se voit qu'en comparant les totaux.

    `K` marque une commune dont les décès sont comptés ailleurs — commune
    déléguée d'une commune nouvelle : sa ligne est vide, il n'y a rien à
    charger. `W` marque celle qui les reçoit. Un premier jet écartait `W` en
    croyant à un doublon ; la somme des communes tombait alors sous le total
    France de exactement ce que ces lignes portaient — 140 décès en 2017, 98 en
    2023. Elles sont donc chargées, et signalées : leur valeur couvre plus de
    territoire que la commune seule, alors que sa population ne couvre qu'elle,
    et un taux par habitant calculé dessus serait surévalué."""
    lignes = deces.lire(archive)
    regroupees = [
        ligne for ligne in lignes if deces.DRAPEAU_REGROUPEMENT in ligne["drapeaux"]
    ]
    assert regroupees, "la fixture ne porte aucune commune de regroupement"
    assert all(ligne["valeur"] > 0 for ligne in regroupees)
    # Les lignes vides — statut K — ne produisent rien.
    assert all(ligne["valeur"] > 0 for ligne in lignes)


def test_une_seule_France_est_retenue_comme_total(archive):
    """La source publie trois périmètres — France entière, métropolitaine, hors
    Mayotte. Les confondre ferait trois France dans une carte qui n'en veut
    qu'une."""
    totaux = deces.totaux_france(archive)
    assert set(totaux) == {"2024", "2025"}
    assert totaux["2025"] == 645662.0
    assert totaux["2024"] == 641023.0


def test_le_controle_bloque_si_la_somme_des_communes_derive():
    """Le contrôle qui compte. Un écart signifierait qu'une part des décès n'est
    plus rattachée à une commune, et la carte montrerait un pays qui perd moins
    d'habitants qu'il n'en perd."""
    lignes = [
        {"niveau": "commune", "code": "33063", "periode": "2025", "valeur": 1000.0},
        {"niveau": "commune", "code": "33281", "periode": "2025", "valeur": 500.0},
    ]
    assert deces.controler(lignes, {"2025": 1500.0}) == {}
    with pytest.raises(deces.TotalIncoherent) as erreur:
        deces.controler(lignes, {"2025": 1600.0})
    assert "2025" in str(erreur.value)


def test_le_controle_ignore_les_exercices_absents_du_chargement():
    """La source publie dix-huit exercices ; un chargement borné n'en couvre pas
    forcément autant. Comparer un exercice qu'on n'a pas chargé à son total
    France déclencherait une fausse alerte."""
    lignes = [{"niveau": "commune", "code": "33063", "periode": "2025", "valeur": 3.0}]
    assert deces.controler(lignes, {"2025": 3.0, "2019": 999.0}) == {}


def test_la_fiche_dit_domicilies_et_pas_survenus():
    """La distinction est le fond du sujet : les décès *survenus* gonflent les
    communes qui ont un hôpital et ne disent rien du territoire."""
    assert "domiciliée" in deces.FICHE["public"] or "domiciliées" in deces.FICHE["public"]
    assert "hôpital" in deces.FICHE["public"]
    assert "domicile du défunt" in deces.FICHE["technique"]
    # Et la fiche prévient que ce n'est pas un indicateur de santé.
    assert "structure par âge" in deces.FICHE["technique"]
    assert len(deces.FICHE["public"].split()) <= 50


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(tmp_path):
    from plateforme import entrepot, registry

    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    try:
        registry.sync(conn)
        deces.declarer(conn)
        deces.declarer(conn)
        (compte,) = conn.execute(
            "select count(*) from core.indicators where indicator_id = ?",
            (deces.INDICATEUR,),
        ).fetchone()
        assert compte == 1
        (unite,) = conn.execute(
            "select d.unit_notes from core.indicators i"
            " join core.indicator_definitions d using (definition_id)"
            " where i.indicator_id = ?",
            (deces.INDICATEUR,),
        ).fetchone()
        assert unite == "personnes domiciliées"
    finally:
        conn.close()
