"""Sitadel : cinq types de logement dont un total, et deux moments d'un projet.

La fixture est un extrait réel de la source — tout le Territoire de Belfort,
plus Paris, Lyon et Marseille, de janvier 2025 à juin 2026, cinq types de
logement chacun. Elle suffit à faire tourner le contrôle bloquant, qui vaut
commune par commune et mois par mois : « Tous Logements » est exactement la
somme d'« Individuel pur », « Individuel groupe », « Collectif » et
« Residence ».

Les chiffres cités ici viennent de la source, pas d'un calcul du dépôt : Lyon,
exercice 2025, 61 + 98 + 771 + 975 = 1 905 logements autorisés.
"""

from pathlib import Path

import pytest

from plateforme import couverture
from plateforme.normalize import construction as c

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def lignes():
    return list(c.lire((FIXTURES / "sitadel_logements_sample.csv").read_bytes()))


@pytest.fixture(scope="module")
def comptes(lignes):
    annuels, mensuels, _ = c.compter(lignes)
    return annuels, mensuels


def test_le_total_est_la_somme_des_quatre_types(comptes):
    """Le contrôle porte sur le couple (mois, commune), la maille la plus fine
    de la source : ce qui tient là tient à toutes les mailles au-dessus."""
    _, mensuels = comptes
    verifies = c.controler(mensuels)
    assert verifies["couples_verifies"] == 1872  # 104 communes × 18 mois
    assert verifies["logements_autorises"] == 9888
    assert verifies["logements_commences"] == 9085


def test_lyon_2025_type_par_type(lignes):
    """Les quatre types tels que la source les publie, et leur somme."""
    par_type = {}
    for annee, _, code, type_logement, autorises, _ in lignes:
        if (annee, code) == ("2025", "69123"):
            par_type[type_logement] = par_type.get(type_logement, 0) + autorises
    assert par_type == {
        "Tous Logements": 1905,
        "Individuel pur": 61,
        "Individuel groupe": 98,
        "Collectif": 771,
        "Residence": 975,
    }
    assert sum(par_type[type_logement] for type_logement in c.TYPES) == 1905


def test_le_controle_bloque_sur_un_logement(lignes):
    """Un logement suffit : c'est ce qui rend ce contrôle utile."""
    decalees = []
    decale = False
    for ligne in lignes:
        if not decale and ligne[3] == "Collectif":
            ligne = (*ligne[:4], ligne[4] + 1, ligne[5])
            decale = True
        decalees.append(ligne)
    _, mensuels, _ = c.compter(decalees)
    with pytest.raises(c.TypesDivergents, match="n'est pas la"):
        c.controler(mensuels)
    with pytest.raises(c.TypesDivergents, match="aucune ligne"):
        c.controler({})


def test_une_modalite_qui_change_de_nom_ne_passe_pas_inapercue(lignes):
    """Le connecteur reconnaît le total par son libellé exact. Si la source le
    renomme, tout bascule du côté de la somme et le contrôle le dit — plutôt que
    de publier deux indicateurs vides."""
    renommees = [(*ligne[:3], ligne[3].lower(), *ligne[4:]) for ligne in lignes]
    _, mensuels, _ = c.compter(renommees)
    with pytest.raises(c.TypesDivergents, match="n'est pas la"):
        c.controler(mensuels)


def test_l_exercice_en_cours_n_est_pas_publie(comptes):
    """La source va jusqu'au mois dernier — juin 2026 dans cet extrait. Publier
    un exercice à six mois à côté des exercices entiers montrerait un
    effondrement de la construction qui n'est que le calendrier."""
    annuels, mensuels = comptes
    complets = c.exercices_complets(mensuels)
    assert complets == {"2025"}
    assert ("2026", "69123") in annuels
    observations = c.par_commune(annuels, complets)
    assert {annee for _, _, _, annee, _ in observations} == {"2025"}
    assert len(observations) == 208  # 104 communes × deux indicateurs


def test_autoriser_n_est_pas_commencer(comptes):
    """Deux indicateurs, jamais une somme : un permis délivré n'est pas un
    chantier ouvert, et les deux décrivent les mêmes projets à deux moments."""
    annuels, mensuels = comptes
    observations = c.par_commune(annuels, c.exercices_complets(mensuels))
    valeurs = {
        (identifiant, code): valeur
        for identifiant, _, code, _, valeur in observations
    }
    assert valeurs[("sitadel_logements_autorises", "69123")] == 1905
    assert valeurs[("sitadel_logements_commences", "69123")] == 1269
    assert valeurs[("sitadel_logements_autorises", "13055")] == 2830
    assert valeurs[("sitadel_logements_commences", "13055")] == 2197


def test_paris_lyon_et_marseille_ne_sont_pas_eclates(comptes):
    """Le piège du répertoire des logements sociaux, qui n'existe pas ici : la
    source porte la commune entière, jamais l'arrondissement municipal."""
    annuels, _ = comptes
    codes = {code for _, code in annuels}
    assert {"75056", "69123", "13055"} <= codes
    assert not {code for code in codes if "75101" <= code <= "75120"}
    assert annuels[("2025", "75056")] == [1482, 2323]


def test_l_url_demande_le_prefixe_eq_et_laisse_les_surfaces():
    """`champ=eq:valeur` est la syntaxe de filtre de l'API DiDo ; sans le
    préfixe, le serveur répond 400 et le connecteur ne charge rien."""
    adresse = c.url(2025)
    assert "ANNEE=eq:2025" in adresse
    assert "SDP_AUT" not in adresse and "SDP_COM" not in adresse
    assert c.derniere_annee(b'{"temporal_coverage": {"end": "2026-06-30"}}') == 2026


def test_les_fiches_refusent_la_confusion_des_deux_dates():
    assert "n'est pas un chantier" in c.INDICATEURS["sitadel_logements_autorises"][1]
    assert "date de prise en compte" in c.TECHNIQUE
    assert "date réelle" in c.TECHNIQUE
    assert "ne s'additionnent pas" in c.TECHNIQUE
    assert "douze mois" in c.TECHNIQUE
    for identifiant, (_, publique, _) in c.INDICATEURS.items():
        assert len(publique.split()) <= 50, identifiant


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    _semer_le_jeu(entrepot_seme)
    c.declarer(entrepot_seme)
    c.declarer(entrepot_seme)
    publies = dict(entrepot_seme.execute(
        "select indicator_id, unit from core.indicators where dataset_id = ?",
        (c.DATASET,),
    ).fetchall())
    assert set(publies) == set(c.INDICATEURS)
    assert set(publies.values()) == {"count"}
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, comptes):
    from plateforme import entrepot, revisions
    from plateforme.normalize.ofgl import filtrer_territoires_connus

    _semer_le_jeu(entrepot_seme)
    c.declarer(entrepot_seme)
    entrepot_seme.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code, flags) values ('commune', '69123', ?, 'Lyon',"
        " null, null, '{}')",
        (c.MILLESIME,),
    )
    run_id = entrepot.start_run(entrepot_seme, c.DATASET, "manual")
    annuels, mensuels = comptes
    candidates = c.par_commune(annuels, c.exercices_complets(mensuels))
    gardees, ecartes = filtrer_territoires_connus(entrepot_seme, candidates)
    ecrites, _ = revisions.remplacer(
        entrepot_seme, run_id, sorted(c.INDICATEURS), c.COLONNES,
        [
            (identifiant, niveau, code, c.MILLESIME, annee, valeur)
            for identifiant, niveau, code, annee, valeur in gardees
        ],
    )
    entrepot_seme.commit()
    assert ecrites == 2, "deux indicateurs sur un exercice, une commune"
    assert len(ecartes) == 103, "les autres communes ne sont pas au référentiel"
    (valeur,) = entrepot_seme.execute(
        "select value from core.observations"
        " where indicator_id = 'sitadel_logements_autorises' and geo_code = '69123'"
        " and period = '2025'"
    ).fetchone()
    assert valeur == 1905
    assert entrepot.verifier_integrite(entrepot_seme) == []


def test_la_couverture_se_mesure_en_logements(comptes):
    """Les communes fusionnées depuis 2013 gardent leur code d'époque dans la
    source : ce contrôle chiffre ce qu'elles emportent, en logements et non en
    codes perdus."""
    annuels, mensuels = comptes
    candidates = c.par_commune(annuels, c.exercices_complets(mensuels))
    lus = c.masse_par_maille(candidates)
    assert lus == {"commune": 6584.0}
    couverture.controler(lus, lus)
    with pytest.raises(couverture.CouvertureInsuffisante):
        couverture.controler(lus, {"commune": lus["commune"] * 0.5})


def _semer_le_jeu(conn) -> None:
    """Le jeu au registre : sans lui, l'indicateur pend à un `dataset_id` que
    `entrepot.verifier_integrite` compte comme orphelin."""
    conn.execute(
        "insert or ignore into meta.dataset_registry (dataset_id, source_id, title,"
        " priority) values (?, ?, 'Sitadel - logements autorises et commences', 'P1')",
        (c.DATASET, c.SOURCE),
    )
