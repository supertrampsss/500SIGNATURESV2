"""L'indemnisation du chômage : 117 lignes par mois dont 14 qui n'en sont pas.

La source mélange 103 départements et 14 agrégats régionaux dans le même
fichier, sans autre marqueur qu'une valeur `"Total"` dans la colonne du code
département. Les additionner donne exactement le double de la vérité, et un
total parfaitement crédible. La fixture est donc l'export entier : c'est la
seule façon de faire tourner ici le contrôle qui bloque en production — somme
des départements égale somme des agrégats, au centime, exercice par exercice.
"""

from pathlib import Path

import pytest

from plateforme import couverture
from plateforme.normalize import chomage_indemnisation as m

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def lignes():
    return m.lire((FIXTURES / "unedic_indemnisation_sample.csv").read_bytes())


@pytest.fixture
def entrepot_unedic(entrepot_seme):
    """L'entrepôt de production, plus deux départements.

    Le jeu et sa source viennent du registre semé — `infra/seed/` les porte.
    Les deux départements suffisent à prouver que les codes de la source
    joignent le référentiel, dont `2A` que la Corse écrit à sa façon.
    """
    (connu,) = entrepot_seme.execute(
        "select count(*) from meta.dataset_registry where dataset_id = ?",
        (m.DATASET,),
    ).fetchone()
    assert connu == 1, "le jeu doit être déclaré dans infra/seed/dataset_registry.csv"
    for code, nom in (("33", "Gironde"), ("2A", "Corse-du-Sud")):
        entrepot_seme.execute(
            "insert into geo.geography_reference (geo_level, geo_code, vintage,"
            " name, parent_level, parent_code, flags) values ('departement', ?, ?,"
            " ?, null, null, '{}')",
            (code, m.MILLESIME, nom),
        )
    entrepot_seme.commit()
    return entrepot_seme


def test_departements_et_agregats_tombent_au_centime(lignes):
    """Le contrôle qui bloque : 36 639 599 911,50 € des deux côtés en 2024."""
    verifies = m.controler(lignes)
    assert verifies["territoires"] == 103
    assert verifies["agregats_regionaux"] == 14
    assert verifies["exercices_verifies"] == 6
    assert verifies["mois_couverts"] == 72
    territoires, agregats = m.masses(lignes)
    assert round(territoires["2024"], 2) == 36_639_599_911.50
    assert round(agregats["2024"], 2) == 36_639_599_911.50


def test_le_controle_bloque_sur_un_centime(lignes):
    """Un centime suffit : c'est ce qui rend ce contrôle utile."""
    mois, code, region, depense = lignes[0]
    fausses = [(mois, code, region, depense + 0.01), *lignes[1:]]
    with pytest.raises(m.AgregatsDivergents, match="divergent"):
        m.controler(fausses)


def test_le_controle_bloque_si_les_agregats_disparaissent(lignes):
    """Si la source cesse de marquer ses agrégats, les prendre pour des
    départements doublerait la masse sans qu'aucun total ne bronche."""
    sans_agregats = [ligne for ligne in lignes if ligne[1] != m.AGREGAT]
    with pytest.raises(m.AgregatsDivergents, match="aucun agrégat"):
        m.controler(sans_agregats)
    un_exercice_perdu = [
        ligne for ligne in lignes
        if not (ligne[1] == m.AGREGAT and ligne[0].startswith("2020"))
    ]
    with pytest.raises(m.AgregatsDivergents, match="d'un seul côté"):
        m.controler(un_exercice_perdu)


def test_sommer_sans_ecarter_les_agregats_double_exactement_la_masse(lignes):
    """L'erreur que ce connecteur existe pour ne pas commettre : 73 milliards
    au lieu de 36, sur un chiffre que rien dans le fichier ne signale."""
    naif = sum(depense for mois, _, _, depense in lignes if mois.startswith("2024"))
    assert round(naif, 2) == 73_279_199_823.00
    assert round(naif, 2) == 2 * 36_639_599_911.50


def test_l_exercice_partiel_n_est_pas_publie(lignes):
    """Décembre retiré, 2025 sort de la publication : onze mois posés à côté de
    douze montreraient une chute qui n'est que le calendrier."""
    assert m.exercices_complets(lignes) == {
        "2020", "2021", "2022", "2023", "2024", "2025"
    }
    tronquees = [ligne for ligne in lignes if ligne[0] != "2025-12"]
    complets = m.exercices_complets(tronquees)
    assert complets == {"2020", "2021", "2022", "2023", "2024"}
    assert "2025" in {ligne[0][:4] for ligne in tronquees}
    assert not [obs for obs in m.par_departement(tronquees, complets) if obs[3] == "2025"]


def test_la_couverture_reelle_dement_la_description_de_la_source(lignes):
    """La source annonce « depuis janvier 2018 » ; elle commence en 2020."""
    mois = sorted({ligne[0] for ligne in lignes})
    assert mois[0] == "2020-01"
    assert mois[-1] == "2025-12"


def test_les_agregats_ne_sont_jamais_publies_comme_departements(lignes):
    observations = m.par_departement(lignes, m.exercices_complets(lignes))
    assert len(observations) == 618, "103 départements sur six exercices"
    assert m.AGREGAT not in {code for _, _, code, _, _ in observations}
    assert {identifiant for identifiant, _, _, _, _ in observations} == {m.INDICATEUR}


def test_les_codes_qui_ne_joignent_sur_rien_sont_ecartes_et_mesures(
    lignes, entrepot_unedic
):
    """« Saint » est une troncature à cinq caractères de Saint-Martin et
    Saint-Barthélemy, « 975 » une collectivité d'outre-mer : 0,09 % de la masse,
    écartée par le référentiel et non par une liste écrite à la main."""
    from plateforme.normalize.ofgl import filtrer_territoires_connus

    candidates = m.par_departement(lignes, m.exercices_complets(lignes))
    codes = {code for _, _, code, _, _ in candidates}
    assert {"Saint", "975"} <= codes
    hors = sum(
        montant for _, _, code, _, montant in candidates if code in ("Saint", "975")
    )
    total = sum(montant for _, _, _, _, montant in candidates)
    assert 0.0005 < hors / total < 0.001
    _, ecartes = filtrer_territoires_connus(entrepot_unedic, candidates)
    assert "departement:Saint" in ecartes and "departement:975" in ecartes


def test_la_region_de_la_source_n_est_pas_la_nomenclature_insee(lignes):
    """14 modalités dont « DROM-COM » : la colonne sert à lire les agrégats, pas
    à porter un niveau géographique."""
    regions = {ligne[2] for ligne in lignes}
    assert len(regions) == 14
    assert "DROM-COM" in regions
    observations = m.par_departement(lignes, m.exercices_complets(lignes))
    assert {niveau for _, niveau, _, _, _ in observations} == {"departement"}


def test_les_fiches_nomment_le_perimetre_et_ses_reserves():
    """La fiche publique tient en cinquante mots — le schéma le vérifie aussi —
    et dit déjà ce que ce chiffre n'est pas."""
    assert len(m.FICHE["public"].split()) <= 50
    for exclu in ("solidarité spécifique", "RSA"):
        assert exclu in m.FICHE["public"]
    for reserve in (
        "ARE", "AREF", "ASP", "n'est pas le coût total du chômage",
        "France Travail", "DROM-COM", "janvier 2018", "0,030 %",
    ):
        assert reserve in m.FICHE["technique"], reserve


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    m.declarer(entrepot_seme)
    m.declarer(entrepot_seme)
    publies = entrepot_seme.execute(
        "select indicator_id, unit, additive, theme, time_granularity"
        " from core.indicators where dataset_id = ?",
        (m.DATASET,),
    ).fetchall()
    assert publies == [(m.INDICATEUR, "EUR", True, "emploi", "annuelle")]
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_unedic, lignes):
    from plateforme import entrepot, revisions
    from plateforme.normalize.ofgl import filtrer_territoires_connus

    m.declarer(entrepot_unedic)
    run_id = entrepot.start_run(entrepot_unedic, m.DATASET, "manual")
    candidates = m.par_departement(lignes, m.exercices_complets(lignes))
    gardees, ecartes = filtrer_territoires_connus(entrepot_unedic, candidates)
    ecrites, revisees = revisions.remplacer(
        entrepot_unedic, run_id, [m.INDICATEUR], m.COLONNES,
        [
            (identifiant, niveau, code, m.MILLESIME, annee, montant)
            for identifiant, niveau, code, annee, montant in gardees
        ],
    )
    entrepot_unedic.commit()
    assert ecrites == 12, "deux départements sur six exercices"
    assert revisees == 0, "premier chargement : rien à réviser"
    assert len(ecartes) == 101, "les autres départements ne sont pas au référentiel"
    (valeur,) = entrepot_unedic.execute(
        "select value from core.observations"
        " where indicator_id = ? and geo_code = '33' and period = '2024'",
        (m.INDICATEUR,),
    ).fetchone()
    assert round(valeur, 2) == 1_024_641_481.72


def test_la_couverture_se_mesure_en_euros(lignes, entrepot_unedic):
    """Deux départements sur cent trois : la couverture s'effondre et le
    chargement s'arrête. C'est ce qui rattrape un référentiel qui a glissé."""
    from plateforme.normalize.ofgl import filtrer_territoires_connus

    candidates = m.par_departement(lignes, m.exercices_complets(lignes))
    gardees, _ = filtrer_territoires_connus(entrepot_unedic, candidates)
    lus = m.masse_par_maille(candidates)
    assert lus["departement"] > 0
    couverture.controler(lus, lus)
    with pytest.raises(couverture.CouvertureInsuffisante):
        couverture.controler(lus, m.masse_par_maille(gardees))
