"""La ventilation fonctionnelle des départements : un total, quatre étages.

La source sert les quatre niveaux de sa hiérarchie dans la même colonne
`montant`. Les niveaux 1 et 2 ventilent le même total ; les lire ensemble le
double. C'est le piège que ces tests existent pour rendre impossible, avec
celui des deux nomenclatures dont les codes se contredisent.

La fixture porte neuf entités — dont Paris, la Métropole de Lyon, l'Alsace et
Mayotte — sur les exercices publiés, avec les deux nomenclatures, les deux
types de budget et les deux niveaux : c'est ce qu'il faut pour que les
contrôles aient quelque chose à mordre.
"""

from pathlib import Path

import pytest

from plateforme import couverture
from plateforme.normalize import departements_fonctionnel as f

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def lignes():
    return f.lire((FIXTURES / "ofgl_departements_fonctionnel_sample.csv").read_bytes())


def test_les_deux_niveaux_ventilent_le_meme_total(lignes):
    """Cardinalités différentes — 1 724 lignes contre 4 652 — pour le même
    argent : le niveau 2 découpe plus fin ce que le niveau 1 découpe en dix."""
    publiees = [ligne for ligne in lignes if ligne[5] == f.NIVEAU_PUBLIE]
    controle = [ligne for ligne in lignes if ligne[5] == f.NIVEAU_CONTROLE]
    assert len(publiees) == 1724 and len(controle) == 4652
    verifies = f.controler_niveaux(lignes)
    assert verifies["couples_verifies"] == 32  # 8 exercices × 4 agrégats
    assert verifies["ecart_relatif_maximum"] < f.TOLERANCE


def test_sommer_les_deux_niveaux_double_le_total(lignes):
    """Le piège que le contrôle existe pour attraper : additionner deux étages
    qui décrivent déjà le même argent."""
    def masse(niveau):
        return sum(
            ligne[6] for ligne in lignes
            if ligne[5] == niveau and ligne[4] == f.TOTAL and ligne[0] == "2024"
        )
    publie, controle = masse(f.NIVEAU_PUBLIE), masse(f.NIVEAU_CONTROLE)
    assert (publie + controle) / publie == pytest.approx(2.0, abs=1e-6)


def test_le_controle_bloque_sur_un_niveau_decale(lignes):
    """Un pour cent suffit — et lire les deux niveaux ensemble en donnerait
    cent."""
    faussees = [
        (*ligne[:6], ligne[6] * 1.01) if ligne[5] == f.NIVEAU_CONTROLE else ligne
        for ligne in lignes
    ]
    with pytest.raises(f.NiveauxDivergents, match="divergents"):
        f.controler_niveaux(faussees)
    empilees = [(*ligne[:5], f.NIVEAU_PUBLIE, ligne[6]) for ligne in lignes]
    with pytest.raises(f.NiveauxDivergents, match="est vide"):
        f.controler_niveaux(empilees)
    ampute = [ligne for ligne in lignes if not (
        ligne[5] == f.NIVEAU_CONTROLE and ligne[4] == "Allocations PCH"
    )]
    with pytest.raises(f.NiveauxDivergents, match="un seul niveau"):
        f.controler_niveaux(ampute)


def test_les_deux_nomenclatures_ne_fusionnent_pas_leurs_codes(lignes):
    """« 5 » vaut l'action sociale en M52 et l'aménagement en M57, « 6 » les
    réseaux en M52 et l'action économique en M57 ; « 0 » s'écrit avec et sans
    majuscules pour le même sens. Grouper par code, ou par libellé, ferait deux
    erreurs opposées."""
    assert f.FONCTIONS[("M52", "5")] == "ofgl_fonction_social"
    assert f.FONCTIONS[("M57", "5")] == "ofgl_fonction_territoire"
    assert f.FONCTIONS[("M52", "6")] == "ofgl_fonction_territoire"
    assert f.FONCTIONS[("M57", "6")] == "ofgl_fonction_economie"
    assert f.FONCTIONS[("M52", "0")] == f.FONCTIONS[("M57", "0")]
    # Les vingt couples du niveau 1 sont tous connus : ni orphelin, ni deviné.
    couples = {
        (ligne[2], ligne[3]) for ligne in lignes
        if ligne[5] == f.NIVEAU_PUBLIE and ligne[4] == f.TOTAL
    }
    assert couples <= set(f.FONCTIONS) | f.SANS_FONCTION


def test_une_fonction_inconnue_bloque_le_chargement(lignes):
    inedite = [("2024", "33", "M99", "3", f.TOTAL, f.NIVEAU_PUBLIE, 1.0), *lignes]
    with pytest.raises(f.FonctionInconnue, match="M99"):
        f.par_departement(inedite)


def test_les_fonctions_somment_exactement_le_total(lignes):
    """Le total publié est la somme des fonctions publiées, par construction :
    c'est lui, et non le budget consolidé, qui sert de dénominateur."""
    observations, residu = f.par_departement(lignes)
    fonctions = set(f.FONCTIONS.values())
    par_cle = {}
    for indicateur, _, code, exercice, montant in observations:
        par_cle.setdefault((code, exercice), {})[indicateur] = montant
    for (code, exercice), valeurs in par_cle.items():
        somme = sum(v for i, v in valeurs.items() if i in fonctions)
        assert somme == pytest.approx(valeurs[f.TOTAL_FONCTIONNEL], rel=1e-12), (
            code, exercice
        )
    # La « fonction en réserve » de la M57 : une ligne dans toute la base.
    assert residu == pytest.approx(50.26)


def test_les_allocations_sont_comprises_dans_l_action_sociale(lignes):
    """RSA, APA et PCH sont des sous-postes : les ajouter aux fonctions
    compterait deux fois la même dépense."""
    observations, _ = f.par_departement(lignes)
    total = {}
    for indicateur, _, _, exercice, montant in observations:
        total[(indicateur, exercice)] = total.get((indicateur, exercice), 0.0) + montant
    social = total[("ofgl_fonction_social", "2024")]
    allocations = sum(
        total[(identifiant, "2024")] for identifiant in f.ALLOCATIONS.values()
    )
    assert allocations < social
    # Chiffres 2024 de la fixture (neuf entités) : le RSA y pèse le double de l'APA.
    assert round(total[("ofgl_allocation_rsa", "2024")]) == 2_437_891_060
    assert round(total[("ofgl_allocation_apa", "2024")]) == 1_290_187_539
    assert round(total[("ofgl_allocation_pch", "2024")]) == 777_980_355


def test_le_social_est_la_premiere_mission_du_departement(lignes):
    """Ce que ce jeu existe pour montrer : la moitié du budget d'un département
    part dans l'aide sociale."""
    observations, _ = f.par_departement(lignes)
    total = {}
    for indicateur, _, _, exercice, montant in observations:
        total[(indicateur, exercice)] = total.get((indicateur, exercice), 0.0) + montant
    part = total[("ofgl_fonction_social", "2024")] / total[(f.TOTAL_FONCTIONNEL, "2024")]
    assert 0.45 < part < 0.60
    classement = sorted(
        (total[(i, "2024")], i) for i in set(f.FONCTIONS.values())
    )
    assert classement[-1][1] == "ofgl_fonction_social"


def test_les_fiches_disent_le_niveau_la_nomenclature_et_l_ecart():
    assert "niveau hiérarchique 1" in f.TECHNIQUE
    assert "M52" in f.TECHNIQUE and "M57" in f.TECHNIQUE
    assert "budget principal et budgets annexes" in f.TECHNIQUE
    assert "1,35 %" in f.TECHNIQUE
    assert "jamais sur le budget consolidé" in f.TECHNIQUE
    assert "ne s'ajoutent pas" in f.TECHNIQUE
    assert "sert de dénominateur" in f.INDICATEURS[f.TOTAL_FONCTIONNEL][1]
    for identifiant, (_, publique) in f.INDICATEURS.items():
        assert len(publique.split()) <= 50, identifiant


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    f.declarer(entrepot_seme)
    f.declarer(entrepot_seme)
    publies = dict(entrepot_seme.execute(
        "select indicator_id, unit from core.indicators where theme = ?",
        (f.THEME,),
    ).fetchall())
    assert set(publies) == set(f.INDICATEURS)
    assert set(publies.values()) == {"EUR"}
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, lignes):
    from plateforme import entrepot, revisions

    f.declarer(entrepot_seme)
    entrepot_seme.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code, flags) values ('departement', '33', ?,"
        " 'Gironde', null, null, '{}')",
        (f.MILLESIME,),
    )
    run_id = entrepot.start_run(entrepot_seme, f.DATASET, "manual")
    candidates, _ = f.par_departement(lignes)
    gardees, ecartes = f.filtrer_territoires_connus(entrepot_seme, candidates)
    ecrites, _ = revisions.remplacer(
        entrepot_seme, run_id, sorted(f.INDICATEURS), f.COLONNES,
        [
            (indicateur, niveau, code, f.MILLESIME, exercice, montant)
            for indicateur, niveau, code, exercice, montant in gardees
        ],
    )
    entrepot_seme.commit()
    assert ecrites == 88, "onze indicateurs sur huit exercices, un département"
    assert "departement:691" in ecartes, "les autres entités ne sont pas au référentiel"
    (valeur,) = entrepot_seme.execute(
        "select value from core.observations"
        " where indicator_id = 'ofgl_allocation_rsa' and geo_code = '33'"
        " and period = '2024'"
    ).fetchone()
    assert valeur > 0


def test_la_couverture_se_mesure_en_euros(lignes):
    candidates, _ = f.par_departement(lignes)
    lus = f.masse_par_maille(candidates)
    assert lus["departement"] > 0
    couverture.controler(lus, lus)
    with pytest.raises(couverture.CouvertureInsuffisante):
        couverture.controler(lus, {"departement": lus["departement"] * 0.5})
