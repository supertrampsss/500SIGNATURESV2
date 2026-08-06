"""IRCOM : un fichier qui compte tout deux fois et masque le reste.

Chaque commune détaillée y figure neuf fois — huit tranches de revenu et un
total —, le territoire n'est pas codé en INSEE, 63 815 cellules d'une colonne
de nombres portent la chaîne « n.c. », et Paris, Lyon et Marseille sont publiés
par arrondissement. L'échantillon est un vrai extrait du classeur DGFiP :
2 379 lignes, 627 communes, dont Paris entier, les seize arrondissements de
Marseille, les neuf de Lyon, la Guadeloupe, la Corse-du-Sud, Monaco, trois
« pays » de la direction des non-résidents et les deux communes de Guyane que
la source publie hors format.
"""

from pathlib import Path

import pytest

from plateforme import couverture
from plateforme.normalize import impot_revenu as ir

FIXTURES = Path(__file__).parent / "fixtures"

# Mesuré sur le fichier complet (85 604 lignes) le 6 août 2026, et sur la
# feuille « Total » de `national/national.xls` de la même archive. Ces trois
# couples sont la matière du second contrôle : les garder ici documente à la
# fois ce qui a été vérifié et ce que le contrôle doit tolérer.
SOMME_DES_COMMUNES = {
    "foyers": 41_634_350.0,
    "rfr": 1_374_657_076.006,
    "impot": 91_678_599.659,
}
NATIONAL_PUBLIE = {
    "foyers": 41_635_259.0,
    "rfr": 1_375_058_914.454,
    "impot": 91_718_994.482,
}
# La même somme sans la direction des non-résidents : ce qu'on obtient en
# croyant qu'un fichier communal ne contient que des communes.
SANS_NON_RESIDENTS = {
    "foyers": 41_336_499.0,
    "rfr": 1_367_504_344.837,
    "impot": 90_725_825.467,
}


@pytest.fixture(scope="module")
def lignes():
    return ir.lire_csv((FIXTURES / "dgfip_ircom_sample.csv").read_bytes())


def groupe(lignes, direction, commune):
    return [ligne for ligne in lignes if ligne.direction == direction and ligne.commune == commune]


def test_la_source_se_lit_sans_perdre_ni_inventer_de_ligne(lignes):
    assert len(lignes) == 2379
    communes = {(ligne.direction, ligne.commune) for ligne in lignes}
    assert len(communes) == 627
    detaillees = [c for c in communes if len(groupe(lignes, *c)) == 9]
    # 217 communes détaillées, 408 réduites à leur ligne « Total » : sommer le
    # fichier brut compterait les premières deux fois.
    assert len(detaillees) == 217
    assert sum(1 for ligne in lignes if ligne.tranche == ir.TOTAL) == 627


def test_le_secret_statistique_est_une_absence_jamais_un_zero(lignes):
    """« n.c. » est une chaîne dans une colonne de nombres, 148 fois ici."""
    assert sum(1 for ligne in lignes for m in ir.MESURES if getattr(ligne, m) is None) == 148

    valeurs = {(o[0], o[2]): o[4] for o in ir.observations(lignes)}
    # La Chaise : le nombre de foyers est publié, le revenu et l'impôt sont
    # masqués. La commune existe donc dans une série et pas dans les deux
    # autres — elle n'y vaut pas zéro.
    assert valeurs[("dgfip_ircom_foyers_fiscaux", "10072")] == 15.0
    assert ("dgfip_ircom_revenu_fiscal_reference", "10072") not in valeurs
    # Bruys : les trois mesures sont masquées, la commune est absente partout.
    assert not [cle for cle in valeurs if cle[1] == "02129"]


def test_les_huit_tranches_font_la_ligne_total(lignes):
    """Le contrôle confronte les deux lectures du même fichier."""
    verifies = ir.controler_tranches(lignes)
    assert verifies["communes_detaillees"] == 217
    assert verifies["communes_verifiees"] == {"foyers": 210, "rfr": 191, "impot": 191}
    # Sur le fichier complet : 6 062, 5 874 et 5 874 communes, même écart nul.
    assert verifies["ecart_maximal"] == 0.0


def test_le_controle_des_tranches_bloque_sur_un_decalage(lignes):
    faussees = [
        ligne._replace(foyers=ligne.foyers + 1) if (ligne.direction, ligne.commune, ligne.tranche)
        == ("010", "004", "20 001 à 30 000") else ligne
        for ligne in lignes
    ]
    with pytest.raises(ir.TranchesIncoherentes, match="Ambérieu-en-Bugey"):
        ir.controler_tranches(faussees)


def test_le_piege_du_n_c_traite_en_zero_ferait_echouer_le_controle(lignes):
    """Le filtre sur le secret statistique n'est pas une commodité.

    Remplacer « n.c. » par zéro — la lecture naïve d'une colonne numérique —
    fait manquer une tranche à la somme sans que rien ne soit faux. Sur le
    fichier complet, cela produit 1 099 faux échecs ; il suffit d'un ici.
    """
    # Les deux communes de Guyane hors format sont mises de côté : elles ont
    # leur propre échec, vérifié par le test précédent, et masqueraient celui-ci.
    en_zero = [
        ligne._replace(**{m: 0.0 for m in ir.MESURES if getattr(ligne, m) is None})
        for ligne in lignes
        if ligne.direction != "973"
    ]
    assert not [ligne for ligne in en_zero for m in ir.MESURES if getattr(ligne, m) is None]
    with pytest.raises(ir.TranchesIncoherentes, match="ne décrivent plus la même"):
        ir.controler_tranches(en_zero)


def test_les_communes_hors_format_sont_recensees_et_non_ignorees(lignes):
    """Maripasoula porte neuf tranches, Camopi sept. La source, pas la lecture."""
    verifies = ir.controler_tranches(lignes)
    assert verifies["communes_hors_forme"] == ["973/353 Maripasoula", "973/356 Camopi"]
    # Tant que leurs lignes surnuméraires sont sous secret, elles ne prouvent
    # rien et ne bloquent rien. Publiées, elles bloqueraient.
    publiees = [
        ligne._replace(foyers=1.0) if (ligne.direction, ligne.commune) == ("973", "353") else ligne
        for ligne in lignes
    ]
    with pytest.raises(ir.TranchesIncoherentes, match="au lieu de neuf"):
        ir.controler_tranches(publiees)


def test_le_code_de_direction_n_est_pas_un_code_departement():
    def code(direction, commune):
        return ir.code_insee(ir.Ligne(direction, commune, "", ir.TOTAL, None, None, None))

    assert code("010", "001") == "01001"  # zéro-padé à droite, pas à gauche
    assert code("2A0", "001") == "2A001"
    assert code("132", "001") == "13001"  # Aix, seconde direction des Bouches-du-Rhône
    assert code("592", "003") == "59003"
    assert code("922", "002") == "92002"
    assert code("971", "101") == "97101"  # outre-mer : le département tient sur trois
    assert code("976", "601") == "97601"
    # Les quarante-cinq arrondissements municipaux se replient sur leur commune.
    assert code("754", "101") == "75056"
    assert code("758", "114") == "75056"
    assert code("131", "201") == "13055"
    assert code("690", "381") == "69123"
    assert code("131", "002") == "13002"  # Allauch, même direction, vraie commune
    # Ni les pays des non-résidents ni Monaco ne sont des communes françaises.
    assert code(ir.NON_RESIDENTS, "101") is None
    assert code("060", "900") is None


def test_une_direction_inconnue_fait_echouer_plutot_que_deviner():
    inconnue = ir.Ligne("Z99", "001", "Nulle part", ir.TOTAL, 1.0, 1.0, 1.0)
    with pytest.raises(ir.DirectionInconnue, match="Z99"):
        ir.code_insee(inconnue)
    # La règle outre-mer ne s'applique pas au hasard : un code commune qui ne
    # répète pas le dernier chiffre du département est refusé, pas tronqué.
    with pytest.raises(ir.DirectionInconnue, match="ne commence pas par"):
        ir.code_insee(ir.Ligne("973", "101", "?", ir.TOTAL, 1.0, 1.0, 1.0))


def test_les_pays_des_non_residents_ne_sont_pas_publies(lignes):
    """La direction B31 code des pays dans une colonne « Commune »."""
    pays = [ligne for ligne in lignes if ligne.direction == ir.NON_RESIDENTS]
    assert {ligne.libelle for ligne in pays} == {"France", "Danemark", "Autres"}
    codes = {o[2] for o in ir.observations(lignes)}
    assert not codes & {"B31100", "75100", "31100"}
    assert len(codes) == 578


def test_le_rapprochement_national_admet_un_millieme_pas_zero():
    """L'écart mesuré vient du secret statistique, que le national ne subit pas."""
    verifies = ir.controler_national(SOMME_DES_COMMUNES, NATIONAL_PUBLIE)
    assert verifies["ecarts_relatifs"] == {
        "foyers": -0.000022,
        "impot": -0.00044,
        "rfr": -0.000292,
    }
    with pytest.raises(ir.TotalNationalDivergent):
        ir.controler_national(SOMME_DES_COMMUNES, NATIONAL_PUBLIE, seuil=0.0)


def test_ecarter_les_non_residents_fait_echouer_le_rapprochement():
    """Le total national comprend les non-résidents : 298 023 foyers.

    C'est ce qui interdit de « nettoyer » B31 avant de contrôler. La direction
    est exclue de la publication, jamais du rapprochement.
    """
    with pytest.raises(ir.TotalNationalDivergent, match="foyers"):
        ir.controler_national(SANS_NON_RESIDENTS, NATIONAL_PUBLIE)


def test_le_rapprochement_bloque_sur_un_demi_pourcent(lignes):
    sommes = ir.sommes_nationales(lignes)
    assert sommes["foyers"] == 3_323_098.0
    ir.controler_national(sommes, sommes)
    decale = {**sommes, "rfr": sommes["rfr"] * 1.005}
    with pytest.raises(ir.TotalNationalDivergent, match="rfr"):
        ir.controler_national(sommes, decale)


def test_les_montants_passent_des_milliers_d_euros_aux_euros(lignes):
    valeurs = {(o[0], o[2]): o[4] for o in ir.observations(lignes)}
    # L'Abergement-Clémenciat : 480 foyers, 22 419,175 k€ de revenu de
    # référence, 1 542,261 k€ d'impôt net.
    assert valeurs[("dgfip_ircom_foyers_fiscaux", "01001")] == 480.0
    assert valeurs[("dgfip_ircom_revenu_fiscal_reference", "01001")] == 22_419_175.0
    assert valeurs[("dgfip_ircom_impot_net", "01001")] == 1_542_261.0


def test_l_impot_net_peut_etre_negatif(lignes):
    """Les crédits d'impôt dépassent l'impôt dû : un contrôle « ≥ 0 » mentirait."""
    basse = [
        ligne for ligne in lignes
        if (ligne.direction, ligne.commune) == ("010", "004") and ligne.tranche == "0 à 10 000"
    ]
    assert basse[0].libelle == "Ambérieu-en-Bugey"
    assert basse[0].impot == -59.932


def test_paris_lyon_et_marseille_sont_agreges_a_leur_commune(lignes):
    """Sans ce rabattement, les trois plus grandes villes sortiraient vides."""
    valeurs = {(o[0], o[2]): o[4] for o in ir.observations(lignes)}
    assert valeurs[("dgfip_ircom_foyers_fiscaux", "75056")] == 1_508_724.0
    assert valeurs[("dgfip_ircom_foyers_fiscaux", "13055")] == 564_717.0
    assert valeurs[("dgfip_ircom_foyers_fiscaux", "69123")] == 330_640.0
    assert valeurs[("dgfip_ircom_revenu_fiscal_reference", "75056")] == 88_934_550_086.0
    # Paris est servi par cinq directions ; aucune n'est publiée pour elle-même.
    assert not [cle for cle in valeurs if cle[1].startswith("751")]


def test_les_fiches_refusent_la_confusion_avec_le_budget_de_l_etat():
    for identifiant, fiche in ir.INDICATEURS.items():
        assert len(fiche["public"].split()) <= 50, identifiant
    assert "n'en perçoit rien" in ir.INDICATEURS["dgfip_ircom_impot_net"]["public"]
    assert "ni le revenu disponible" in (
        ir.INDICATEURS["dgfip_ircom_revenu_fiscal_reference"]["public"]
    )
    assert "émis par voie de rôle" in ir.TECHNIQUE
    assert "pas** la recette" in ir.TECHNIQUE
    assert "secret statistique" in ir.TECHNIQUE
    assert "milliers d'euros" in ir.TECHNIQUE
    # Un impôt d'État n'a rien à faire dans la liste des impôts locaux.
    assert ir.THEME == "revenus"


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    ir.declarer(entrepot_seme)
    ir.declarer(entrepot_seme)
    publies = dict(entrepot_seme.execute(
        "select indicator_id, unit from core.indicators where dataset_id = ?",
        (ir.DATASET,),
    ).fetchall())
    assert publies == {
        "dgfip_ircom_foyers_fiscaux": "count",
        "dgfip_ircom_revenu_fiscal_reference": "EUR",
        "dgfip_ircom_impot_net": "EUR",
    }
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0
    (sommables,) = entrepot_seme.execute(
        "select count(*) from core.indicators where dataset_id = ? and additive",
        (ir.DATASET,),
    ).fetchone()
    assert sommables == 3, "des effectifs et des masses, tous sommables"


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, lignes):
    from plateforme import entrepot

    ir.declarer(entrepot_seme)
    for code, nom in (("01001", "L'Abergement-Clémenciat"), ("75056", "Paris")):
        entrepot_seme.execute(
            "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
            " parent_level, parent_code, flags) values ('commune', ?, ?, ?, null, null, '{}')",
            (code, ir.MILLESIME, nom),
        )
    run_id = entrepot.start_run(entrepot_seme, ir.DATASET, "manual")
    ecrites, ecartes, revisees, lus, reconnus = ir.ecrire(entrepot_seme, run_id, lignes)
    entrepot_seme.commit()

    assert ecrites == 6, "trois indicateurs sur deux communes du référentiel"
    assert ecartes > 500, "les autres communes ne sont pas au référentiel de ce test"
    assert revisees == 0
    (valeur,) = entrepot_seme.execute(
        "select value from core.observations where indicator_id ="
        " 'dgfip_ircom_revenu_fiscal_reference' and geo_code = '75056' and period = ?",
        (ir.PERIODE,),
    ).fetchone()
    assert valeur == 88_934_550_086.0
    assert lus["commune"] > reconnus["commune"] > 0


def test_un_montant_corrige_est_archive_et_non_ecrase(entrepot_seme, lignes):
    """La DGFiP rectifie les millésimes antérieurs : une révision se voit."""
    from plateforme import entrepot

    ir.declarer(entrepot_seme)
    entrepot_seme.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code, flags) values ('commune', '01001', ?, 'x',"
        " null, null, '{}')",
        (ir.MILLESIME,),
    )
    premier = entrepot.start_run(entrepot_seme, ir.DATASET, "manual")
    ir.ecrire(entrepot_seme, premier, lignes)
    corrigees = [
        ligne._replace(rfr=ligne.rfr + 1.0)
        if (ligne.direction, ligne.commune, ligne.tranche) == ("010", "001", ir.TOTAL) else ligne
        for ligne in lignes
    ]
    second = entrepot.start_run(entrepot_seme, ir.DATASET, "manual")
    _, _, revisees, _, _ = ir.ecrire(entrepot_seme, second, corrigees)
    entrepot_seme.commit()

    assert revisees == 1
    (ancienne,) = entrepot_seme.execute(
        "select old_value from core.observations_revisions where geo_code = '01001'"
        " and indicator_id = 'dgfip_ircom_revenu_fiscal_reference'"
    ).fetchone()
    assert ancienne == 22_419_175.0
    (courante,) = entrepot_seme.execute(
        "select value from core.observations where geo_code = '01001'"
        " and indicator_id = 'dgfip_ircom_revenu_fiscal_reference'"
    ).fetchone()
    assert courante == 22_420_175.0


def test_la_couverture_se_mesure_en_foyers_fiscaux(lignes):
    """Trois codes perdus ne pèsent rien ; trois codes qui portent Paris, tout."""
    candidates = ir.observations(lignes)
    lus = ir.foyers_par_maille(candidates)
    assert lus == {"commune": 3_313_954.0}
    couverture.controler(lus, lus)
    sans_paris = ir.foyers_par_maille([o for o in candidates if o[2] != "75056"])
    with pytest.raises(couverture.CouvertureInsuffisante, match="commune"):
        couverture.controler(lus, sans_paris)
