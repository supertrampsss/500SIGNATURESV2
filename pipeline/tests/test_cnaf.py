"""RSA et prime d'activité par commune : la fixture est le vrai export.

Extrait réel de l'export CSV de `s_ben_com_f` (data.caf.fr), téléchargé le
7 août 2026 et réduit à la Gironde, Paris, la Corse (2A et 2B) et les lignes à
code vide — 4 548 lignes, en-têtes et valeurs telles que la source les sert.
Les chiffres attestés ici ont été relus sur l'API au moment du téléchargement :
Bordeaux, décembre 2024 — 9 260 foyers RSA, 26 745 foyers prime d'activité.

Le contrôle national est exercé deux fois : sur les chiffres réels France
entière relevés le même jour (l'écart mesuré tient dans la tolérance), et sur la
fixture prise comme une France miniature (l'amputer fait lever l'exception —
c'est le seul contrôle qui voie une lecture tronquée, la somme d'un fichier lu à
moitié restant parfaitement cohérente avec elle-même).
"""

import math
from pathlib import Path

import pytest

from plateforme import couverture
from plateforme.normalize import cnaf as c

FIXTURES = Path(__file__).parent / "fixtures"

ENTETE = "dtreffre;numcomdo;nomcom;indfoy_rsa;indmtt_rsa;indfoy_ppa;indmtt_ppa"

# Décembres exacts du jeu national s_ben_nat et sommes France entière du jeu
# communal s_ben_com_f, relevés sur l'API le 7 août 2026. L'écart entre les
# deux est le bruit réel — arrondi au multiple de 5, à la centaine d'euros,
# et allocataires non localisés — que la tolérance doit absorber.
NATIONAL = {
    "2020": {"cnaf_foyers_rsa": 2_027_851, "cnaf_montants_rsa": 1_027_559_318.0,
             "cnaf_foyers_prime_activite": 4_421_063,
             "cnaf_montants_prime_activite": 803_201_825.0},
    "2021": {"cnaf_foyers_rsa": 1_903_553, "cnaf_montants_rsa": 960_386_472.0,
             "cnaf_foyers_prime_activite": 4_465_879,
             "cnaf_montants_prime_activite": 800_532_013.0},
    "2022": {"cnaf_foyers_rsa": 1_859_618, "cnaf_montants_rsa": 984_800_693.0,
             "cnaf_foyers_prime_activite": 4_636_652,
             "cnaf_montants_prime_activite": 876_892_052.0},
    "2023": {"cnaf_foyers_rsa": 1_823_760, "cnaf_montants_rsa": 977_311_509.0,
             "cnaf_foyers_prime_activite": 4_544_782,
             "cnaf_montants_prime_activite": 833_337_418.0},
    "2024": {"cnaf_foyers_rsa": 1_811_239, "cnaf_montants_rsa": 1_008_236_317.0,
             "cnaf_foyers_prime_activite": 4_675_469,
             "cnaf_montants_prime_activite": 924_136_696.0},
}

SOMMES_COMMUNALES = {
    "2020": {"cnaf_foyers_rsa": 2_022_840, "cnaf_montants_rsa": 1_022_378_600.0,
             "cnaf_foyers_prime_activite": 4_420_505,
             "cnaf_montants_prime_activite": 802_687_800.0},
    "2021": {"cnaf_foyers_rsa": 1_898_580, "cnaf_montants_rsa": 955_012_900.0,
             "cnaf_foyers_prime_activite": 4_465_265,
             "cnaf_montants_prime_activite": 800_027_100.0},
    "2022": {"cnaf_foyers_rsa": 1_854_475, "cnaf_montants_rsa": 979_158_200.0,
             "cnaf_foyers_prime_activite": 4_636_205,
             "cnaf_montants_prime_activite": 876_372_200.0},
    "2023": {"cnaf_foyers_rsa": 1_818_635, "cnaf_montants_rsa": 971_529_800.0,
             "cnaf_foyers_prime_activite": 4_544_605,
             "cnaf_montants_prime_activite": 832_781_600.0},
    "2024": {"cnaf_foyers_rsa": 1_805_575, "cnaf_montants_rsa": 1_002_135_400.0,
             "cnaf_foyers_prime_activite": 4_675_100,
             "cnaf_montants_prime_activite": 923_560_600.0},
}


@pytest.fixture(scope="module")
def lignes():
    return c.lire((FIXTURES / "cnaf_s_ben_com_sample.csv").read_bytes())


def test_la_fixture_reelle_porte_les_chiffres_attestes(lignes):
    assert len(lignes) == 4_548
    bordeaux = [
        ligne for ligne in lignes
        if ligne["commune"] == "33063" and ligne["annee"] == "2024"
    ]
    assert bordeaux == [{
        "annee": "2024",
        "commune": "33063",
        "cnaf_foyers_rsa": 9_260.0,
        "cnaf_montants_rsa": 4_996_200.0,
        "cnaf_foyers_prime_activite": 26_745.0,
        "cnaf_montants_prime_activite": 4_719_400.0,
    }]
    # La Corse reste en texte (2A004) : un connecteur qui la lirait en nombre
    # la perdrait, et elle est dans la fixture pour l'attraper.
    assert any(ligne["commune"] == "2A004" for ligne in lignes)
    assert {ligne["annee"] for ligne in lignes} == {"2020", "2021", "2022", "2023", "2024"}


def test_la_lecture_refuse_un_autre_mois_que_decembre():
    """La période publiée est l'année parce que la photo est celle de décembre.
    Un fichier qui porterait un autre mois casserait cette équivalence — la
    lecture s'arrête au lieu de publier un chiffre daté de travers."""
    contenu = f"{ENTETE}\n2024-06;33063;BORDEAUX;9000;4800000;26000;4600000\n"
    with pytest.raises(ValueError, match="décembre"):
        c.lire(contenu.encode("utf-8"))


def test_les_arrondissements_se_replient_sur_paris(lignes):
    """La source ne code Paris que par arrondissement : le laisser tel quel
    publierait Paris à zéro. Les sommes attendues sont celles des vingt
    arrondissements de décembre 2024, relues sur la fixture brute."""
    candidates, _ = c.par_commune(lignes)
    codes = {code for _, _, code, _, _ in candidates}
    assert "75056" in codes
    assert not {code for code in codes if c.commune_mere(code)}
    paris = {
        ind: valeur
        for ind, _, code, annee, valeur in candidates
        if code == "75056" and annee == "2024"
    }
    assert paris == {
        "cnaf_foyers_rsa": 63_210.0,
        "cnaf_montants_rsa": 34_724_700.0,
        "cnaf_foyers_prime_activite": 106_110.0,
        "cnaf_montants_prime_activite": 19_980_000.0,
    }


def test_les_codes_masques_sont_ecartes_nommement_avec_leur_masse(lignes):
    """Les allocataires que la CAF ne localise pas arrivent sous un code vide.
    Les écarter en le disant, avec leur masse, plutôt que les répartir — et
    rien ne se perd : candidates plus écartés redonnent la somme lue."""
    candidates, ecartes = c.par_commune(lignes)
    assert ecartes == {"code_masque_ou_vide": {
        "lignes": 5,
        "cnaf_foyers_rsa": 33_605.0,
        "cnaf_montants_rsa": 13_016_300.0,
        "cnaf_foyers_prime_activite": 15_055.0,
        "cnaf_montants_prime_activite": 2_846_100.0,
    }}
    assert all(code for _, _, code, _, _ in candidates)
    total = math.fsum(
        valeur for ind, _, _, _, valeur in candidates if ind == "cnaf_foyers_rsa"
    ) + ecartes["code_masque_ou_vide"]["cnaf_foyers_rsa"]
    assert total == math.fsum(
        somme["cnaf_foyers_rsa"] for somme in c.sommes_france(lignes).values()
    )


def test_l_ecart_national_reel_tient_dans_la_tolerance():
    """Le bruit réel — arrondis et non-localisés — mesuré sur les cinq
    millésimes : entre 0,01 % et 0,61 %. La tolérance de 1,5 % l'absorbe
    sans approcher ce qu'une lecture tronquée produirait."""
    ecarts = c.controler_national(SOMMES_COMMUNALES, NATIONAL)
    pire = max(e for par_ind in ecarts.values() for e in par_ind.values())
    assert 0.005 < pire < 0.007
    assert pire < c.ECART_MAXIMAL / 2


def test_l_ecart_national_bloque_une_lecture_amputee(lignes):
    """La fixture prise comme une France miniature : complète, elle égale son
    propre national ; amputée d'un département, la somme reste parfaitement
    cohérente avec elle-même et seul le rapprochement externe le voit."""
    national = c.sommes_france(lignes)
    c.controler_national(c.sommes_france(lignes), national)
    amputees = [ligne for ligne in lignes if not ligne["commune"].startswith("33")]
    with pytest.raises(c.EcartNationalExcessif, match="tronquée"):
        c.controler_national(c.sommes_france(amputees), national)
    with pytest.raises(c.EcartNationalExcessif, match="rien n'a été lu"):
        c.controler_national({}, national)
    with pytest.raises(c.EcartNationalExcessif, match="2024"):
        c.controler_national(
            c.sommes_france(lignes),
            {annee: v for annee, v in national.items() if annee != "2024"},
        )


def test_la_couverture_se_mesure_en_foyers(lignes):
    """Une commune perdue pèse ses allocataires, pas un trente-quatre-millième
    du total. Les montants n'entrent pas dans la mesure : mélanger des foyers
    et des euros ferait une part que rien ne mesure."""
    candidates, _ = c.par_commune(lignes)
    lus = c.foyers_par_maille(candidates)
    assert set(lus) == {"commune"}
    couverture.controler(lus, lus)
    with pytest.raises(couverture.CouvertureInsuffisante):
        couverture.controler(lus, {"commune": lus["commune"] * 0.5})


def test_les_fiches_portent_les_reserves():
    for identifiant, (_, publique, _, _) in c.INDICATEURS.items():
        assert len(publique.split()) <= 50, identifiant
        # Régime CAF seul : sans la MSA, une commune agricole se lit de travers.
        assert "MSA" in publique, identifiant
    for identifiant in ("cnaf_foyers_rsa", "cnaf_foyers_prime_activite"):
        publique = c.INDICATEURS[identifiant][1]
        assert "31 décembre" in publique
        assert "personnes couvertes" in publique
    for identifiant in ("cnaf_montants_rsa", "cnaf_montants_prime_activite"):
        publique = c.INDICATEURS[identifiant][1]
        # Le montant est celui d'un mois : lu comme un budget annuel, il se
        # tromperait d'un facteur douze. Non négociable.
        assert "au titre du mois de décembre" in publique
        assert "mensuel" in publique and "pas un montant annuel" in publique
    assert "multiple de 5" in c.TECHNIQUE
    assert "centaine d'euros" in c.TECHNIQUE
    assert "régime des CAF seul" in c.TECHNIQUE
    assert "personne couverte" in c.TECHNIQUE
    assert "seul mois de décembre" in c.TECHNIQUE


def _semer_le_jeu(conn) -> None:
    """Le jeu au registre : sans lui, la clé étrangère du run refuse de démarrer
    et `entrepot.verifier_integrite` compterait l'indicateur comme orphelin."""
    conn.execute(
        "insert or ignore into meta.dataset_registry (dataset_id, source_id, title,"
        " priority) values (?, ?, 'CNAF - Toutes prestations [Communal]', 'P2')",
        (c.DATASET, c.SOURCE),
    )


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    _semer_le_jeu(entrepot_seme)
    c.declarer(entrepot_seme)
    c.declarer(entrepot_seme)
    publies = dict(entrepot_seme.execute(
        "select indicator_id, unit from core.indicators where dataset_id = ?",
        (c.DATASET,),
    ).fetchall())
    assert publies == {
        "cnaf_foyers_rsa": "count",
        "cnaf_montants_rsa": "EUR",
        "cnaf_foyers_prime_activite": "count",
        "cnaf_montants_prime_activite": "EUR",
    }
    # Sommable malgré l'arrondi au multiple de 5 : bruit sans biais, mesuré
    # sous 0,7 % France entière — refuser l'addition coûterait les mailles
    # département et région pour un défaut cent fois plus petit que ça.
    assert all(
        additive for (additive,) in entrepot_seme.execute(
            "select additive from core.indicators where dataset_id = ?", (c.DATASET,)
        ).fetchall()
    )
    # Un dénombrement de foyers n'est pas en euros courants : la colonne reste
    # nulle plutôt que de recopier celle des montants.
    bases = dict(entrepot_seme.execute(
        "select indicator_id, price_basis from core.indicators where dataset_id = ?",
        (c.DATASET,),
    ).fetchall())
    assert bases["cnaf_montants_rsa"] == "current"
    assert bases["cnaf_foyers_rsa"] is None
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, lignes):
    from plateforme import entrepot, revisions
    from plateforme.normalize.ofgl import filtrer_territoires_connus

    _semer_le_jeu(entrepot_seme)
    c.declarer(entrepot_seme)
    for code, nom in (("33063", "Bordeaux"), ("75056", "Paris")):
        entrepot_seme.execute(
            "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
            " parent_level, parent_code, flags) values ('commune', ?, ?, ?,"
            " 'departement', ?, '{}')",
            (code, c.MILLESIME, nom, code[:2]),
        )
    run_id = entrepot.start_run(entrepot_seme, c.DATASET, "manual")
    candidates, _ = c.par_commune(lignes)
    gardees, ecartes = filtrer_territoires_connus(entrepot_seme, candidates)
    ecrites, _ = revisions.remplacer(
        entrepot_seme, run_id, sorted(c.INDICATEURS), c.COLONNES,
        [
            (ind, niveau, code, c.MILLESIME, annee, valeur)
            for ind, niveau, code, annee, valeur in gardees
        ],
    )
    entrepot_seme.commit()
    assert ecrites == 40, "quatre indicateurs, deux communes, cinq millésimes"
    assert len(ecartes) > 0, "les autres communes de la fixture ne sont pas au référentiel"
    (foyers,) = entrepot_seme.execute(
        "select value from core.observations where indicator_id = 'cnaf_foyers_rsa'"
        " and geo_code = '33063' and period = '2024'"
    ).fetchone()
    assert foyers == 9_260
    (montant,) = entrepot_seme.execute(
        "select value from core.observations"
        " where indicator_id = 'cnaf_montants_prime_activite'"
        " and geo_code = '75056' and period = '2024'"
    ).fetchone()
    assert montant == 19_980_000
