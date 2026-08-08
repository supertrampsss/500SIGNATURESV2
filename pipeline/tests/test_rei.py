"""La ventilation de la taxe foncière : frais de l'État et témoins DGFiP.

La fixture est un extrait **réel** de l'export CSV du REI de l'OFGL (relevé le
8 août 2026), gardé octet pour octet : le département de l'Ain en entier sur les
deux exercices (392 communes en 2024, 391 en 2025, dont les codes perdent leur
zéro de tête), Paris, Lyon, Marseille et Bordeaux, la Corse, quatre communes
d'outre-mer dont Mayotte, Saint-Martin que la DGFiP code hors du Code officiel
géographique, une commune entièrement sous secret statistique, une commune
nouvelle apparue en 2025 et une commune fusionnée disparue après 2024.

Les trois témoins figés dans le module ont été relevés à la main dans le fichier
original de la DGFiP (REI_2025.csv), chez le producteur et non chez le
republieur : ces tests vérifient que les deux côtés disent la même chose, et
qu'ils mordent quand la lecture se décale.
"""

import urllib.parse
from pathlib import Path

import pytest

from plateforme import couverture
from plateforme.normalize import rei

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def contenu() -> bytes:
    return (FIXTURES / "ofgl_rei_ventilation_sample.csv").read_bytes()


@pytest.fixture(scope="module")
def lu(contenu):
    return rei.lire(contenu)


@pytest.fixture(scope="module")
def lignes(lu):
    return lu[0]


def test_les_temoins_dgfip_se_relisent_depuis_le_fichier_reel(lignes):
    """Les quatre montants de chacun des trois témoins, relevés à la main le
    8 août 2026 dans REI_2025.csv chez la DGFiP, se retrouvent à l'euro près
    dans l'export de l'OFGL. Paris ne verse rien à la Métropole du Grand Paris
    au titre du foncier bâti : sa part « intercommunalité » est faite de la
    seule taxe GEMAPI."""
    verifies = rei.controler(lignes)
    for code, attendus in rei.TEMOINS.items():
        assert verifies["temoins"][code] == attendus, code
    paris = lignes[("2025", "75056")]
    assert "E33" not in paris
    assert paris["E53gGEMAPI"] == 11_639_087.0
    # Les quatre parts, plus la part communale déjà publiée ailleurs, font l'avis.
    parts = [
        rei.composante(paris, variables) for variables in rei.VENTILATION.values()
    ]
    assert paris["E13"] + sum(parts) == pytest.approx(2_574_612_540.0)


def test_le_code_insee_se_reconstruit_dans_les_deux_formes_de_la_source(lignes):
    """La source écrit « 01053 » en 2024 et « 1053 » en 2025 pour la même
    commune : 3 135 communes des départements 01 à 09 sont concernées, 5,5 % du
    produit communal du millésime 2025. Passé tel quel au référentiel, le code
    court les écarte toutes en silence."""
    assert rei.code_insee("01", "01053") == "01053"
    assert rei.code_insee("01", "1053") == "01053"
    assert rei.code_insee("2A", "2A004") == "2A004"
    assert rei.code_insee("976", "97611") == "97611"
    # Saint-Martin est la limite de la règle : « 9788 » se recompose en un
    # « 97808 » de bonne forme et qui n'existe pas. C'est pour cela que le
    # département 978 est écarté nommément en amont, jamais recomposé.
    assert rei.code_insee("978", "9788") == "97808"
    assert "978" in rei.HORS_COG
    # Les deux exercices de Bourg-en-Bresse tombent bien sous le même code.
    assert ("2024", "01053") in lignes
    assert ("2025", "01053") in lignes
    assert {code for _, code in lignes if code.startswith("01")}


def test_l_outre_mer_la_corse_et_les_grandes_villes_sont_recensees(lignes):
    """Paris, Lyon et Marseille sont recensés en communes entières, sans
    arrondissements. La Corse garde ses codes 2A et 2B, et Mayotte est servie."""
    codes = {code for _, code in lignes}
    assert {"75056", "69123", "13055", "2A004", "2B033", "97611"} <= codes
    arrondissements = (
        [f"751{rang:02d}" for rang in range(1, 21)]
        + [f"693{rang:02d}" for rang in range(81, 90)]
        + [f"132{rang:02d}" for rang in range(1, 17)]
    )
    assert not [code for code in arrondissements if code in codes]


def test_saint_martin_est_ecarte_nommement_avec_sa_masse(lu):
    """La DGFiP code Saint-Martin « 9788 » sous un département 978 qui n'est pas
    du Code officiel géographique. Lui reconstruire un code Insee en
    fabriquerait un faux : la collectivité est écartée avec sa masse plutôt que
    publiée sur un territoire inventé."""
    lignes, ecartes = lu
    assert not [code for _, code in lignes if code.startswith(("977", "978"))]
    assert ecartes["hors_cog_saint_martin"]["lignes"] == 4
    assert ecartes["hors_cog_saint_martin"]["montant"] > 0


def test_une_composante_masquee_n_est_pas_publiee_un_zero_l_est(lignes):
    """Le secret statistique est une absence, pas un zéro : Soulaines-Dhuys est
    masquée sur toutes ses variables et ne produit aucune observation. À
    l'inverse, la source retire ses lignes nulles pour tenir la volumétrie : une
    variable absente vaut zéro, et ce zéro se publie — une commune sans taxe
    d'ordures ménagères n'est pas une commune sans donnée."""
    masquee = lignes[("2025", "10372")]
    assert set(masquee.values()) == {None}
    for variables in rei.VENTILATION.values():
        assert rei.composante(masquee, variables) is None

    publiees = rei.valeurs_publiees(lignes)
    assert not [ligne for ligne in publiees if ligne[2] == "10372"]
    zeros = [
        ligne for ligne in publiees
        if ligne[0] == "dgfip_taxe_fonciere_ordures_menageres" and ligne[4] == 0.0
    ]
    assert len(zeros) > 100
    # Bordeaux : la métropole ne lève pas un euro de foncier bâti (E33 absent),
    # la part intercommunale n'est faite que de la taxe GEMAPI.
    bordeaux = lignes[("2025", "33063")]
    assert "E33" not in bordeaux
    assert rei.composante(
        bordeaux, rei.VENTILATION["dgfip_taxe_fonciere_intercommunalite"]
    ) == 2_537_198.0


def test_la_part_communale_est_lue_pour_le_controle_et_non_republiee(lignes):
    """`dgfip_produit_foncier_bati` publie déjà la part communale, depuis cette
    variable exactement. Elle est lue parce que les frais de l'État se
    recalculent dessus, jamais écrite : la republier compterait deux fois le
    même euro."""
    assert rei.COMMUNE in rei.VARIABLES
    assert lignes[("2025", "69123")][rei.COMMUNE] == 356_796_260.0
    publies = {ligne[0] for ligne in rei.valeurs_publiees(lignes)}
    assert publies == set(rei.VENTILATION)
    assert len(publies) == 4


def test_les_frais_de_l_etat_se_retrouvent_depuis_la_ventilation(lignes):
    """La notice du REI donne la formule des frais que l'État retient : 3 % de
    la taxe foncière et de la GEMAPI, 8 % de la part syndicale, des ordures
    ménagères et de la taxe francilienne, 9 % des taxes spéciales d'équipement.
    Les recalculer depuis la ventilation vérifie qu'aucune part de l'avis ne
    manque. Mesuré sur la parution entière le 8 août 2026 : 0,13 % en 2024,
    0,12 % en 2025."""
    ecarts = rei.ecarts_frais(lignes)
    assert sorted(ecarts) == ["2024", "2025"]
    for exercice, cumul in ecarts.items():
        assert cumul["ecart_relatif"] < rei.ECART_FRAIS_MAXIMUM, exercice
        assert cumul["communes"] > 350


@pytest.mark.parametrize(
    "variables", [("F13",), ("E33", "E53gGEMAPI"), ("E53", "E53A")]
)
def test_le_controle_bloque_quand_une_part_de_l_avis_manque(lignes, variables):
    """C'est ce que le rapprochement des frais est là pour voir : une composante
    oubliée laisse la ventilation parfaitement cohérente avec elle-même, et
    fausse. Sur la parution entière, oublier les ordures ménagères écarte les
    frais de 35 %, l'intercommunalité de 4,1 %, les taxes spéciales
    d'équipement de 1,1 %, pour un pour cent toléré."""
    ampute = {
        cle: {v: m for v, m in montants.items() if v not in variables}
        for cle, montants in lignes.items()
    }
    ecarts = rei.ecarts_frais(ampute)
    assert min(c["ecart_relatif"] for c in ecarts.values()) > rei.ECART_FRAIS_MAXIMUM
    with pytest.raises(rei.VentilationIncoherente, match="frais retenus par l'État"):
        rei.controler(ampute)


@pytest.mark.parametrize("variables", [("E23",), ("E53TASA",)])
def test_les_petites_parts_echappent_aux_frais_et_c_est_le_temoin_qui_mord(lignes, variables):
    """La part syndicale (0,6 % des frais) et la taxe francilienne (0,1 %)
    passent sous le seuil du rapprochement : le dire est la raison d'être des
    témoins. Lyon porte la première, Paris la seconde, et l'oubli les casse."""
    ampute = {
        cle: {v: m for v, m in montants.items() if v not in variables}
        for cle, montants in lignes.items()
    }
    ecarts = rei.ecarts_frais(ampute)
    assert max(c["ecart_relatif"] for c in ecarts.values()) < rei.ECART_FRAIS_MAXIMUM
    with pytest.raises(rei.VentilationIncoherente, match="relevés à la main chez la DGFiP"):
        rei.controler(ampute)


def test_le_controle_bloque_quand_un_temoin_ne_tient_plus(lignes):
    """Le rapprochement des frais ne distingue pas une part de 0,15 % du bruit
    d'arrondi : la taxe francilienne pourrait être lue sur la mauvaise variable
    sans qu'il bronche. Le témoin parisien, lui, la porte nommément."""
    decale = dict(lignes)
    paris = dict(decale[("2025", "75056")])
    paris["E53TASA"] = paris["E53TASA"] * 2
    decale[("2025", "75056")] = paris
    with pytest.raises(rei.VentilationIncoherente, match="témoin 75056"):
        rei.controler(decale)


def test_le_controle_bloque_quand_l_exercice_des_temoins_disparait(lignes):
    """Un nouveau millésime remplacera 2025 : les témoins doivent alors être
    relevés à nouveau chez la DGFiP, pas contournés."""
    sans_2025 = {
        cle: montants for cle, montants in lignes.items() if cle[0] != rei.TEMOIN_EXERCICE
    }
    with pytest.raises(rei.VentilationIncoherente, match="témoins n'est plus dans la source"):
        rei.controler(sans_2025)


def test_les_fusions_de_communes_suivent_le_millesime(lignes):
    """Le REI recense les communes de l'exercice qu'il décrit : une commune
    nouvelle apparaît à son millésime, une commune fusionnée cesse d'y figurer.
    C'est le référentiel courant qui tranche ensuite, à l'écriture."""
    assert ("2025", "12218") in lignes and ("2024", "12218") not in lignes
    assert ("2024", "01330") in lignes and ("2025", "01330") not in lignes


def test_un_montant_negatif_arrete_la_lecture():
    """Un produit émis et des frais retenus ne sont jamais négatifs. Un négatif
    signifierait que la variable ne mesure plus la même chose."""
    entete = "﻿annee;dep;idcom;var;valeur;secret_statistique\n"
    with pytest.raises(ValueError, match="montant négatif"):
        rei.lire((entete + "2025;33;33063;E33;-100.0;\n").encode())


def test_une_variable_inattendue_arrete_la_lecture():
    """Si la clause de sélection n'est plus appliquée, l'export ramène les
    vingt-cinq dispositifs fiscaux du REI : les montants lus ne seraient plus
    ceux du foncier bâti."""
    entete = "﻿annee;dep;idcom;var;valeur;secret_statistique\n"
    with pytest.raises(ValueError, match="inattendue"):
        rei.lire((entete + "2025;33;33063;P53TSC;100.0;\n").encode())


def test_une_composante_absente_de_tout_l_export_arrete_la_lecture():
    """Une variable qui disparaît de la source ferait valoir zéro à une
    composante entière, sans un mot."""
    entete = "﻿annee;dep;idcom;var;valeur;secret_statistique\n"
    with pytest.raises(ValueError, match="absentes de tout l'export"):
        rei.lire((entete + "2025;33;33063;E33;100.0;\n").encode())


def test_le_departement_est_exige_dans_l_export():
    """Sans le département, le code Insee ne se reconstruit pas : la lecture
    refuse plutôt que d'écarter en silence les communes au code court."""
    entete = "﻿annee;idcom;var;valeur;secret_statistique\n"
    with pytest.raises(ValueError, match="dep"):
        rei.lire((entete + "2025;33063;E33;100.0;\n").encode())


def test_l_url_restreint_la_requete_aux_neuf_variables_du_foncier_bati():
    """Le jeu compte 22,7 millions d'enregistrements : la clause `where`
    appartient à la requête, et le département doit être demandé."""
    adresse = rei.url()
    assert urllib.parse.quote("var in ('E13'") in adresse
    for variable in rei.VARIABLES:
        assert urllib.parse.quote(f"'{variable}'") in adresse
    assert "select=annee,dep,idcom,var,valeur,secret_statistique" in adresse


def test_la_couverture_se_mesure_en_euros_et_non_en_codes(lignes):
    """Trois communes perdues ne pèsent rien si elles portent trois mille
    euros, et tout si elles portent Paris. Les quatre indicateurs entrent
    ensemble : quatre parts disjointes du même avis."""
    candidates = rei.valeurs_publiees(lignes)
    lus = rei.montant_par_maille(candidates)
    assert lus["commune"] > 0
    assert couverture.controler(lus, lus) == {"commune": 1.0}
    sans_paris = rei.montant_par_maille(
        [ligne for ligne in candidates if ligne[2] != "75056"]
    )
    with pytest.raises(couverture.CouvertureInsuffisante):
        couverture.controler(lus, sans_paris)


def _semer_le_jeu(conn) -> None:
    """L'entrepôt de test ne charge pas les CSV du registre versionné : le jeu
    est semé ici, sans quoi la clé étrangère du run refuse de démarrer. La
    source `ofgl` existe déjà au registre, le jeu est à ajouter."""
    conn.execute(
        "insert or ignore into meta.source_registry (source_id, name, producer,"
        " access_category, license) values (?, 'data.ofgl.fr', 'OFGL', 'A',"
        " 'Licence Ouverte 2.0')",
        (rei.SOURCE,),
    )
    conn.execute(
        "insert or ignore into meta.dataset_registry (dataset_id, source_id, title,"
        " priority) values (?, ?, 'REI - Ventilation de la taxe fonciere par"
        " beneficiaire', 'P1')",
        (rei.DATASET, rei.SOURCE),
    )


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    _semer_le_jeu(entrepot_seme)
    rei.declarer(entrepot_seme)
    rei.declarer(entrepot_seme)
    for identifiant in rei.VENTILATION:
        unite, sommable, publie, theme, base = entrepot_seme.execute(
            "select unit, additive, published, theme, price_basis from core.indicators"
            " where indicator_id = ?",
            (identifiant,),
        ).fetchone()
        # Des euros d'impôt émis s'additionnent entre communes : c'est ce qui
        # permet au site de lire la ventilation d'une intercommunalité entière.
        assert unite == "EUR"
        assert sommable is True and publie is True
        assert theme == "impots_locaux" and base == "current"
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, lignes):
    """Le code court des départements 01 à 09 est ce qui se joue ici :
    Bourg-en-Bresse est écrite sous « 01053 » alors que la source de 2025 l'écrit
    « 1053 ». Sans la reconstruction, elle serait écartée avec les 3 135 autres."""
    from plateforme import entrepot

    _semer_le_jeu(entrepot_seme)
    rei.declarer(entrepot_seme)
    for code, nom in (("01053", "Bourg-en-Bresse"), ("75056", "Paris")):
        entrepot_seme.execute(
            "insert into geo.geography_reference (geo_level, geo_code, vintage,"
            " name, parent_level, parent_code, flags) values ('commune', ?, ?, ?,"
            " 'departement', ?, '{}')",
            (code, rei.MILLESIME, nom, code[:2]),
        )
    run_id = entrepot.start_run(entrepot_seme, rei.DATASET, "manual")
    ecrites, ecartes, revisees, lus, reconnus = rei.ecrire(
        entrepot_seme, run_id, lignes
    )
    entrepot_seme.commit()
    assert ecrites == 16, "deux communes, deux exercices, quatre indicateurs"
    assert revisees == 0
    assert "commune:01001" in ecartes
    parts = couverture.controler(reconnus, reconnus)
    assert parts == {"commune": 1.0}
    (interco,) = entrepot_seme.execute(
        "select value from core.observations where indicator_id ="
        " 'dgfip_taxe_fonciere_intercommunalite' and geo_code = '01053'"
        " and period = '2025'"
    ).fetchone()
    assert interco == rei.TEMOINS["01053"]["dgfip_taxe_fonciere_intercommunalite"]
    (teom,) = entrepot_seme.execute(
        "select value from core.observations where indicator_id ="
        " 'dgfip_taxe_fonciere_ordures_menageres' and geo_code = '75056'"
        " and period = '2025'"
    ).fetchone()
    assert teom == 569_218_483.0
    assert lus["commune"] > reconnus["commune"], "deux communes sur 803 reconnues"


def test_les_definitions_publiques_tiennent_en_cinquante_mots():
    """La base refuse au-delà : la fiche publique doit rester lisible d'un coup
    d'œil, réserves techniques mises à part."""
    for identifiant, texte in rei.PUBLIQUE.items():
        assert len(texte.split()) <= 50, (identifiant, len(texte.split()))
    assert set(rei.PUBLIQUE) == set(rei.VENTILATION) == set(rei.LIBELLES)
    assert set(rei.FORMULES) == set(rei.VENTILATION)
