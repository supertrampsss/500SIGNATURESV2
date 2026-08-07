"""Les naissances domiciliées : les deux pièges nommés par le producteur.

La fixture est un extrait réel du fichier de l'INSEE : les trois totaux France,
quelques communes — dont une de Mayotte, une commune déléguée au statut `K` et
la commune nouvelle au statut `W` qui la reçoit —, **tous** les arrondissements
municipaux de Paris, Lyon et Marseille avec leurs codes « arrondissement non
connu », et — à écarter — une aire d'attraction, un EPCI, une unité urbaine,
une zone d'emploi, un bassin de vie et un arrondissement départemental.

Tous les arrondissements plutôt qu'un échantillon : c'est la seule façon que
l'identité « somme des arrondissements + non connu = commune entière » soit
vraie dans la fixture comme dans le fichier complet.
"""

from pathlib import Path

import pytest

from plateforme import couverture
from plateforme.normalize import naissances as nais

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def archive() -> bytes:
    return (FIXTURES / "insee_naissances_sample.zip").read_bytes()


@pytest.fixture(scope="module")
def lignes(archive) -> list[dict]:
    return nais.lire(archive)


def test_seuls_les_territoires_du_site_sont_retenus(lignes):
    """Le jeu couvre onze découpages. Les aires d'attraction, bassins de vie,
    unités urbaines, zones d'emploi et arrondissements départementaux sont des
    zonages d'étude : ils n'ont ni fiche ni budget ici."""
    assert {ligne["niveau"] for ligne in lignes} == {
        "commune", "arrondissement_municipal", "departement", "region"
    }
    assert lignes


def test_mayotte_est_absente_avant_2014_et_non_nulle(archive, lignes):
    """Le premier piège nommé par le producteur. Lire ces valeurs comme des
    zéros ferait apparaître une natalité mahoraise surgie de nulle part en 2014,
    et un saut de dix mille naissances sur le total national."""
    mayotte = {
        ligne["periode"]
        for ligne in lignes
        if ligne["niveau"] == "departement" and ligne["code"] == "976"
    }
    assert mayotte == {str(an) for an in range(2014, 2026)}
    assert not mayotte & {str(an) for an in range(2008, 2014)}
    # Le total France entière manque aux mêmes exercices : c'est le total hors
    # Mayotte qui sert alors de référence au contrôle.
    totaux = nais.totaux_france(archive)
    hors_mayotte = sorted(
        periode for periode, (_, geo) in totaux.items()
        if geo == nais.FRANCE_HORS_MAYOTTE
    )
    assert hors_mayotte == [str(an) for an in range(2008, 2014)]
    assert totaux["2024"] == (659731.0, nais.FRANCE)
    assert totaux["2025"] == (642905.0, nais.FRANCE)


def test_l_arrondissement_non_connu_est_porte_par_la_commune_entiere(archive, lignes):
    """Le second piège, et le plus dangereux : `693XX` et `132XX` n'existent
    dans aucun référentiel géographique. Chargés tels quels ils seraient
    écartés, et leurs naissances disparaîtraient sans un mot de Lyon et de
    Marseille. La somme des arrondissements plus le non-connu redonne la commune
    entière, exercice par exercice — c'est la preuve qu'elle les porte déjà."""
    inconnus = nais.arrondissements_inconnus(archive)
    assert set(nais.ARRONDISSEMENT_INCONNU.values()) == {"69123", "13055", "75056"}
    verifie = nais.controler_arrondissements(lignes, inconnus)
    assert verifie["couples_verifies"] == 54, "trois communes, dix-huit exercices"
    assert verifie["naissances_sans_arrondissement"] == 444
    # Aucun code « XX » n'est écrit comme observation.
    assert not {ligne["code"] for ligne in lignes} & set(nais.ARRONDISSEMENT_INCONNU)


def test_le_controle_bloque_si_l_arrondissement_non_connu_est_oublie(archive, lignes):
    """Sans le terme « non connu », l'égalité tombe de exactement ce que ce code
    portait. C'est ainsi qu'on sait qu'il ne doit pas être écarté sans être
    compté."""
    with pytest.raises(nais.RattachementIncoherent, match="13055"):
        nais.controler_arrondissements(lignes, {})


def test_le_controle_bloque_si_la_somme_des_communes_derive():
    """Le contrôle qui compte. Un écart signifierait qu'une part des naissances
    n'est plus rattachée à une commune."""
    lignes = [
        {"niveau": "commune", "code": "33063", "periode": "2025", "valeur": 1000.0},
        {"niveau": "commune", "code": "33281", "periode": "2025", "valeur": 500.0},
    ]
    assert nais.controler(lignes, {"2025": (1500.0, nais.FRANCE)}) == {}
    with pytest.raises(nais.TotalIncoherent) as erreur:
        nais.controler(lignes, {"2025": (1600.0, nais.FRANCE)})
    assert "2025" in str(erreur.value)
    # Un exercice non chargé ne déclenche pas de fausse alerte.
    assert nais.controler(
        lignes, {"2025": (1500.0, nais.FRANCE), "2019": (999.0, nais.FRANCE)}
    ) == {}


def test_une_commune_qui_recoit_les_naissances_d_une_autre_est_signalee(lignes):
    """`K` marque une commune déléguée dont les naissances sont comptées
    ailleurs : sa ligne est vide, il n'y a rien à charger. `W` marque celle qui
    les reçoit — 1 684 naissances dans le fichier complet, dont l'écart ferait
    tomber la somme des communes sous le total France. Elles sont chargées et
    signalées : leur valeur couvre plus de territoire que la commune seule,
    alors que sa population ne couvre qu'elle."""
    regroupees = [
        ligne for ligne in lignes if nais.DRAPEAU_REGROUPEMENT in ligne["drapeaux"]
    ]
    assert regroupees, "la fixture ne porte aucune commune de regroupement"
    assert all(ligne["valeur"] > 0 for ligne in regroupees)
    # La commune déléguée `14666` porte trois lignes vides : rien n'est chargé
    # pour elle. Un zéro serait faux — ses naissances existent, ailleurs.
    exercices = {
        ligne["periode"] for ligne in lignes
        if ligne["niveau"] == "commune" and ligne["code"] == "14666"
    }
    assert not exercices & {"2017", "2018", "2019"}
    # Un zéro reste possible ailleurs : une petite commune peut n'avoir aucune
    # naissance dans l'année, ce qui n'est pas une valeur manquante.
    assert any(ligne["valeur"] == 0 for ligne in lignes)


def test_la_fiche_dit_domiciliees_et_refuse_la_lecture_en_fecondite():
    """La distinction est le fond du sujet, et un décompte brut n'est ni un taux
    de natalité ni une fécondité."""
    assert "domiciliée" in nais.FICHE["public"]
    assert "maternité" in nais.FICHE["public"]
    assert "domicile de la mère" in nais.FICHE["technique"]
    assert "manquantes et non nulles" in nais.FICHE["technique"]
    assert "693XX" in nais.FICHE["technique"]
    assert "indicateur de fécondité" in nais.FICHE["technique"]
    assert len(nais.FICHE["public"].split()) <= 50


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    nais.declarer(entrepot_seme)
    nais.declarer(entrepot_seme)
    (compte,) = entrepot_seme.execute(
        "select count(*) from core.indicators where indicator_id = ?",
        (nais.INDICATEUR,),
    ).fetchone()
    assert compte == 1
    (unite, niveaux) = entrepot_seme.execute(
        "select d.unit_notes, i.geo_levels from core.indicators i"
        " join core.indicator_definitions d using (definition_id)"
        " where i.indicator_id = ?",
        (nais.INDICATEUR,),
    ).fetchone()
    assert unite == "naissances vivantes domiciliées"
    assert "arrondissement_municipal" in niveaux
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, lignes):
    """Marseille et son deuxième arrondissement, tous deux au référentiel : le
    reste de la fixture n'y est pas, et se retrouve dans les écartés."""
    from plateforme import entrepot

    nais.declarer(entrepot_seme)
    for niveau, code, nom in (
        ("commune", "13055", "Marseille"),
        ("arrondissement_municipal", "13202", "Marseille 2e Arrondissement"),
    ):
        entrepot_seme.execute(
            "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
            " parent_level, parent_code, flags) values (?, ?, ?, ?, null, null, '{}')",
            (niveau, code, nais.MILLESIME, nom),
        )
    run_id = entrepot.start_run(entrepot_seme, nais.DATASET, "manual")
    # La couverture se mesure en naissances, et la fixture n'en reconnaît qu'une
    # poignée : le contrôle qui protège la production ferait échouer ce test.
    with pytest.raises(couverture.CouvertureInsuffisante, match="commune"):
        nais.ecrire(entrepot_seme, run_id, lignes)
    entrepot.annuler(entrepot_seme)

    marseille = [
        ligne for ligne in lignes
        if (ligne["niveau"], ligne["code"]) in {
            ("commune", "13055"), ("arrondissement_municipal", "13202")
        }
    ]
    run_id = entrepot.start_run(entrepot_seme, nais.DATASET, "manual")
    ecrites, revisees, ecartes, parts = nais.ecrire(entrepot_seme, run_id, marseille)
    entrepot_seme.commit()
    assert ecrites == 36, "deux territoires, dix-huit exercices"
    assert revisees == 0 and not ecartes
    assert parts == {"commune": 1.0, "arrondissement_municipal": 1.0}
    (valeur,) = entrepot_seme.execute(
        "select value from core.observations where indicator_id = ?"
        " and geo_level = 'commune' and geo_code = '13055' and period = '2024'",
        (nais.INDICATEUR,),
    ).fetchone()
    assert valeur == 11271.0
    assert not entrepot.verifier_integrite(entrepot_seme)


def test_la_couverture_se_mesure_en_naissances(lignes):
    """Trois codes perdus ne pèsent rien s'ils portent trois naissances, et tout
    s'ils portent Marseille."""
    masses = nais.masse_par_maille(lignes)
    assert masses["commune"] > masses["arrondissement_municipal"] > 0
    couverture.controler(masses, masses)
    with pytest.raises(couverture.CouvertureInsuffisante):
        couverture.controler(masses, {**masses, "commune": masses["commune"] * 0.5})
