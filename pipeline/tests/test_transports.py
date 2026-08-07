"""Le parc automobile communal : deux prises sur un fichier large par années.

La fixture est un extrait **réel** de l'export CSV de l'API DiDo (séparateur
`;`, en-tête `withColumnName`, filtre serveur GROUPE=VP), découpé par un
filtre `COMMUNE_CODE=in:` et gardé octet pour octet : Bordeaux — le témoin
figé —, trois autres girondines, Paris entier (la commune-résidu et ses vingt
arrondissements), Lyon et Marseille avec deux arrondissements chacun, Bastia,
deux communes d'outre-mer, et les quatre codes fictifs que la source range
sous « département + 000 » (00000, 2B000, 75000, 97100). Relevé sur l'API le
7 août 2026, millésime 2026-06 du datafile.

Le piège du fichier est l'inverse de celui de la Dares : 75056 n'est **pas**
la somme de ses arrondissements, c'est un résidu de 6 521 voitures quand les
arrondissements en portent 596 643. Écarter les arrondissements publierait
Paris à 1 % de sa valeur ; ici tout se replie et s'additionne.
"""

from pathlib import Path

import pytest

from plateforme import couverture
from plateforme.normalize import transports as t

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def contenu() -> bytes:
    return (FIXTURES / "sdes_parc_vp_communal_sample.csv").read_bytes()


@pytest.fixture(scope="module")
def parc_et_fictifs(contenu):
    return t.lire(contenu)


@pytest.fixture(scope="module")
def parc(parc_et_fictifs):
    return parc_et_fictifs[0]


def test_le_temoin_bordeaux_se_relit_depuis_l_export_reel(parc):
    """Bordeaux, 1er janvier 2023 : 111 924 voitures particulières, relevées à
    la main sur l'API le 7 août 2026 — un millésime que le SDES dit définitif
    pour les véhicules légers. Et les seize millésimes 2011-2026 sont là."""
    assert parc[("33063", "2023")]["total"] == t.TEMOIN_BORDEAUX == 111_924
    assert sorted(annee for code, annee in parc if code == "33063") == [
        str(annee) for annee in range(2011, 2027)
    ]
    # La part est portée par les motorisations : à Bordeaux au 1er janvier
    # 2026, 7 000 voitures électriques ou hybrides rechargeables sur 111 057.
    assert parc[("33063", "2026")]["total"] == 111_057
    assert parc[("33063", "2026")]["rechargeable"] == 7_000


def test_les_codes_fictifs_sont_ecartes_nommement_avec_leur_masse(parc, parc_et_fictifs):
    """Les véhicules que la source ne sait pas localiser sont rangés sous
    « département + 000 » — 00000 quand même le département manque, 97100
    outre-mer. Écartés avec leur masse comptée, jamais répartis."""
    _, fictifs = parc_et_fictifs
    assert fictifs["codes_fictifs"] == ["00000", "2B000", "75000", "97100"]
    assert fictifs["lignes_fictives"] == 84
    assert fictifs["vehicules_fictifs"] == 61_432
    assert fictifs["lignes_lues"] == 1_350
    assert not any(t.CODE_FICTIF.fullmatch(code) for code, _ in parc)
    assert len({code for code, _ in parc}) == 34


def test_les_arrondissements_se_replient_et_s_additionnent_au_residu(parc):
    """L'inverse de la Dares : 75056 n'est pas la somme des arrondissements,
    c'est un résidu (6 521 voitures en 2026 contre 596 643 dans les vingt
    arrondissements, mesuré sur l'API). Le repli additionne tout — les écarter
    publierait Paris à 1 % de sa valeur."""
    assert parc[("75056", "2026")]["total"] == 6_521
    assert ("75101", "2026") in parc
    lignes = t.lignes_a_ecrire(parc)
    paris = {periode: valeur for ind, _, code, _, periode, valeur in lignes
             if code == "75056" and ind == t.INDICATEUR_PARC}
    assert paris["2026"] == 603_164.0  # 6 521 + les vingt arrondissements
    codes = {code for _, _, code, _, _, _ in lignes}
    assert {"75056", "69123", "13055"} <= codes
    assert not {code for code in codes if code.startswith(("751", "6938", "132"))}


def test_le_parc_et_la_part_sont_publies_a_la_commune_et_a_l_annee(parc):
    """Deux indicateurs par commune-millésime : le parc (compte, sommable) et
    la part rechargeable (pourcentage, calculée après repli, jamais sommée) —
    et pas de part quand il n'y a pas de parc."""
    lignes = t.lignes_a_ecrire(parc)
    assert all(ligne[1] == "commune" and ligne[3] == t.MILLESIME for ligne in lignes)
    bordeaux = {(ind, periode): valeur for ind, _, code, _, periode, valeur in lignes
                if code == "33063"}
    assert bordeaux[(t.INDICATEUR_PARC, "2023")] == 111_924.0
    assert bordeaux[(t.INDICATEUR_PART, "2026")] == 6.30  # 7 000 / 111 057
    paris = {(ind, periode): valeur for ind, _, code, _, periode, valeur in lignes
             if code == "75056"}
    assert paris[(t.INDICATEUR_PART, "2026")] == 13.71
    # 10 communes après repli × 16 millésimes × 2 indicateurs — aucune n'est
    # à parc nul dans l'extrait, chaque parc porte donc sa part.
    assert len(lignes) == 320
    # Un parc à zéro est publié comme un vrai zéro ; la part, elle, n'existe
    # pas — 0/0 n'est pas 0 %.
    vide = {("01001", "2011"): {"total": 0, "rechargeable": 0,
                                "electrique": 0, "electrique_hors_e": 0}}
    assert t.lignes_a_ecrire(vide) == [
        (t.INDICATEUR_PARC, "commune", "01001", t.MILLESIME, "2011", 0.0)
    ]


def test_l_identite_critair_tient_sur_tout_l_extrait(parc):
    verifies = t.controler(parc)
    assert verifies["communes"] == 34
    assert verifies["commune_annees"] == 544
    assert (verifies["premiere_annee"], verifies["derniere_annee"]) == ("2011", "2026")
    # L'extrait porte 4 voitures électriques hors Crit'Air E (2013-2016),
    # le bruit mesuré sur le fichier entier — loin de la tolérance.
    assert 0 < verifies["part_electrique_hors_critair_e_maximale"] <= t.TOLERANCE_IDENTITE
    assert verifies["temoin_bordeaux"] == t.TEMOIN_BORDEAUX


def test_le_controle_bloque_quand_motorisation_et_vignette_divergent(parc):
    """Un fichier recomposé réapparie motorisations et vignettes sans changer
    aucun total : seule l'identité Crit'Air E des électriques le voit."""
    fausses = {cle: dict(compte) for cle, compte in parc.items()}
    fausses[("33063", "2026")]["electrique_hors_e"] = fausses[("33063", "2026")][
        "electrique"
    ]
    with pytest.raises(t.ParcIncoherent, match="Crit'Air E"):
        t.controler(fausses)
    # Sans aucune électrique, l'identité ne vérifie plus rien — le dire vaut
    # mieux que passer vert sur un contrôle vide.
    with pytest.raises(t.ParcIncoherent, match="aucune voiture électrique"):
        t.controler({cle: {**compte, "electrique": 0, "electrique_hors_e": 0}
                     for cle, compte in parc.items()})


def test_le_temoin_bordelais_mord_sur_une_lecture_amputee_ou_decalee(parc):
    """Le défaut que l'identité ne voit pas : un fichier tronqué garde ses
    motorisations parfaitement appariées. Amputer Bordeaux doit lever, une
    valeur qui dérive au-delà des révisions aussi, un fichier vide aussi."""
    ampute = {cle: compte for cle, compte in parc.items() if cle[0] != "33063"}
    with pytest.raises(t.ParcIncoherent, match="absente du millésime"):
        t.controler(ampute)
    derive = {cle: dict(compte) for cle, compte in parc.items()}
    derive[("33063", "2023")]["total"] += int(0.01 * t.TEMOIN_BORDEAUX)
    with pytest.raises(t.ParcIncoherent, match="relevées à la main"):
        t.controler(derive)
    with pytest.raises(t.ParcIncoherent, match="aucune commune"):
        t.controler({})


def test_un_fichier_qui_change_de_forme_arrete_la_lecture(contenu):
    """Un groupe autre que VP compterait des camions dans le « parc de
    voitures » ; une motorisation nouvelle changerait la définition de la
    part ; un code hors COG et hors fictifs signale une colonne décalée ;
    des millésimes qui quittent les colonnes PARC_XXXX, une autre forme."""
    with pytest.raises(ValueError, match="voitures particulières"):
        t.lire(contenu.replace(b'"VP";"VP"', b'"VUL";"VP"'))
    with pytest.raises(ValueError, match="[Mm]otorisation"):
        t.lire(contenu.replace(b'"Electrique"', b'"Ethanol"'))
    with pytest.raises(ValueError, match="code commune"):
        t.lire(contenu.replace(b'"33063"', b'"3306A"'))
    with pytest.raises(ValueError, match="colonnes"):
        t.lire(contenu.replace(b'"COMMUNE_CODE"', b'"CODE_INSEE"'))
    with pytest.raises(ValueError, match="PARC_XXXX"):
        t.lire(contenu.replace(b"PARC_20", b"PARK_20"))


def test_la_couverture_se_mesure_en_vehicules(parc):
    """Perdre Paris au référentiel ne pèserait pas une commune sur dix :
    il pèserait six cent mille voitures. La couverture compte des véhicules,
    pas des codes — et les parts n'entrent pas dans la masse."""
    lignes = t.lignes_a_ecrire(parc)
    masse = t.vehicules_par_maille(lignes)
    assert masse["commune"] == sum(
        ligne[5] for ligne in lignes if ligne[0] == t.INDICATEUR_PARC
    )
    couverture.controler(masse, masse)
    sans_paris = t.vehicules_par_maille(
        [ligne for ligne in lignes if ligne[2] != "75056"]
    )
    with pytest.raises(couverture.CouvertureInsuffisante):
        couverture.controler(masse, sans_paris)


def test_les_fiches_disent_l_estimation_le_1er_janvier_et_les_reserves():
    """Ce qu'aucun nombre ne porte : un parc **estimé** et révisable, compté
    au 1er janvier à l'adresse du certificat d'immatriculation, et une part
    qui exclut l'hydrogène. Les fiches publiques tiennent en 50 mots — la
    contrainte CHECK de la base — et les réserves longues vivent dans la
    définition technique."""
    for _, publique, _, _, _, _ in t.INDICATEURS.values():
        assert len(publique.split()) <= 50
    parc_publique = t.INDICATEURS[t.INDICATEUR_PARC][1]
    assert "1er janvier" in parc_publique and "estimé" in parc_publique
    assert "certificat d'immatriculation" in parc_publique
    part_publique = t.INDICATEURS[t.INDICATEUR_PART][1]
    assert "hybride rechargeable" in part_publique
    assert "hydrogène" in part_publique
    assert "révis" in t.TECHNIQUE and "provisoire au 01/01/2026" in t.TECHNIQUE
    assert "département + 000" in t.TECHNIQUE
    assert "n'est pas la somme des" in t.TECHNIQUE
    assert "location longue durée" in t.TECHNIQUE


def _semer_le_jeu(conn) -> None:
    """L'entrepôt de test ne charge pas les CSV du registre versionné : le jeu
    et sa source sont semés ici, sans quoi la clé étrangère du run refuse de
    démarrer."""
    conn.execute(
        "insert or ignore into meta.source_registry (source_id, name, producer,"
        " access_category, license) values (?,"
        " 'data.statistiques.developpement-durable.gouv.fr', 'SDES', 'A',"
        " 'Licence Ouverte 2.0')",
        (t.SOURCE,),
    )
    conn.execute(
        "insert or ignore into meta.dataset_registry (dataset_id, source_id, title,"
        " priority) values (?, ?, 'SDES - Parc de vehicules routiers (communal)',"
        " 'P2')",
        (t.DATASET, t.SOURCE),
    )


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    _semer_le_jeu(entrepot_seme)
    t.declarer(entrepot_seme)
    t.declarer(entrepot_seme)
    declares = {
        indicateur: (unite, sommable, publie)
        for indicateur, unite, sommable, publie in entrepot_seme.execute(
            "select indicator_id, unit, additive, published from core.indicators"
            " where dataset_id = ?",
            (t.DATASET,),
        ).fetchall()
    }
    # Un parc se somme entre communes ; une part, jamais — additionner des
    # pourcentages est le genre d'erreur que le schéma doit interdire.
    assert declares[t.INDICATEUR_PARC] == ("count", True, True)
    assert declares[t.INDICATEUR_PART] == ("percent", False, True)
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, parc):
    from plateforme import entrepot, revisions
    from plateforme.normalize.ofgl import filtrer_territoires_connus

    _semer_le_jeu(entrepot_seme)
    t.declarer(entrepot_seme)
    for code, nom in (("33063", "Bordeaux"), ("75056", "Paris")):
        entrepot_seme.execute(
            "insert into geo.geography_reference (geo_level, geo_code, vintage,"
            " name, parent_level, parent_code, flags) values ('commune', ?, ?, ?,"
            " 'departement', ?, '{}')",
            (code, t.MILLESIME, nom, code[:2]),
        )
    run_id = entrepot.start_run(entrepot_seme, t.DATASET, "manual")
    gardees, ecartes = filtrer_territoires_connus(entrepot_seme, t.lignes_a_ecrire(parc))
    ecrites, revisees = revisions.remplacer(
        entrepot_seme, run_id, sorted(t.INDICATEURS), t.COLONNES, gardees
    )
    entrepot_seme.commit()
    assert ecrites == 64, "deux communes au référentiel, seize millésimes, deux indicateurs"
    assert revisees == 0
    assert len(ecartes) == 8, "les huit autres communes de l'extrait"
    (bordeaux,) = entrepot_seme.execute(
        "select value from core.observations where indicator_id = ?"
        " and geo_code = '33063' and period = '2023'",
        (t.INDICATEUR_PARC,),
    ).fetchone()
    assert bordeaux == 111_924.0
    (part_paris,) = entrepot_seme.execute(
        "select value from core.observations where indicator_id = ?"
        " and geo_code = '75056' and period = '2026'",
        (t.INDICATEUR_PART,),
    ).fetchone()
    assert part_paris == 13.71
