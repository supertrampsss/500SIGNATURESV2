"""Les dépenses fiscales : deux annexes du même projet de loi, confrontées.

Ce jeu n'a pas de somme interne à retrouver — la somme de ce qu'on a lu est
toujours égale à elle-même. Son contrôle est donc externe : le tableau par
impôt publié dans le tome 2 des Voies et moyens, recopié dans le code, doit se
retrouver dans les montants du budget vert. C'est ce qui distingue un
chargement complet d'un chargement amputé.
"""

import json
from pathlib import Path

import pytest

from plateforme.normalize import depenses_fiscales as df

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def contenu() -> bytes:
    return (FIXTURES / "plf2026_depenses_fiscales_sample.json").read_bytes()


@pytest.fixture(scope="module")
def lignes(contenu) -> list[dict]:
    return df.lire(contenu)


def test_le_tableau_du_tome_2_se_retrouve_impot_par_impot(lignes):
    """Le contrôle complet : dix-sept lignes publiées, neuf regroupements, trois
    exercices. Il passe à l'euro près, ce qui dit que le budget vert cote bien
    toutes les dépenses fiscales chiffrées et non une partie."""
    verifies = df.controler(lignes)
    assert verifies["totaux"] == {
        "2024": 89_406_000_000, "2025": 91_834_000_000, "2026": 88_269_000_000,
    }
    assert verifies["categories_verifiees"] == len(df.REGROUPEMENT)
    assert verifies["dispositifs"] == 457
    assert verifies["lignes_source"] == 483


def test_le_controle_bloque_si_le_perimetre_est_ampute(lignes):
    """Une annexe qui ne coterait plus qu'une partie des niches passerait
    inaperçue sur tout total interne : c'est exactement ce que le tome 2
    attrape."""
    amputees = [ligne for ligne in lignes if ligne["impot"] != "Taxe sur la valeur ajoutée"]
    with pytest.raises(df.ChiffrageRompu, match="Taxe sur la valeur ajoutée"):
        df.controler(amputees)


def test_le_controle_bloque_sur_une_categorie_d_impot_inconnue(lignes):
    """Si la source ajoute un impôt, la correspondance vers le tome 2 cesse
    d'être complète — et l'impôt manquerait au contrôle sans manquer au
    total."""
    inventee = [{**lignes[0], "impot": "Taxe sur les licornes"}, *lignes]
    with pytest.raises(df.ChiffrageRompu, match="licornes"):
        df.controler(inventee)


def test_un_dispositif_scinde_est_recolle(lignes):
    """Le budget vert scinde une dépense fiscale quand sa cotation
    environnementale diffère d'une part à l'autre. Sommer sans recoller
    afficherait le dispositif au tiers de son coût."""
    parts = [ligne for ligne in lignes if ligne["code"] == "730210"]
    assert len(parts) == 2
    dispositifs = df.par_dispositif(lignes)
    assert len(dispositifs) < len(lignes)
    montant, _ = dispositifs["730210"]["montants"]["2026"]
    assert montant == sum(part["montants"]["2026"][0] for part in parts)
    assert montant == 620_000_000.0


def test_les_montants_non_chiffres_sont_absents_et_non_nuls():
    """« ε » (moins de 0,5 M€) et « nc » (non calculé) sont des conventions de
    la source. Écrire zéro à leur place inventerait une niche gratuite."""
    brut = json.dumps([{
        "code_depense": "999999", "libelle": "Niche non chiffrée",
        "impot_si_depense_fiscale": "Autres droits", "mission": "M", "programme": "P",
        "numero_programme": 1, "execution_2024_cp": None,
        "lfi_2025_cp_ou_prevision_2025_si_depense_fiscale": None,
        "plf_2026_cp_ou_prevision_2026_si_depense_fiscale": None,
    }]).encode()
    lues = df.lire(brut)
    assert lues[0]["montants"] == {}
    assert not df.lignes_a_ecrire(lues)


def test_le_realise_et_les_previsions_ne_portent_pas_le_meme_statut(lignes):
    """Le document publie un réalisé 2024 et deux prévisions. Les confondre
    ferait lire une prévision comme un constat."""
    statuts = {
        periode: statut
        for _, _, _, _, periode, _, statut in df.lignes_a_ecrire(lignes)
    }
    assert statuts == {"2024": "normal", "2025": "provisional", "2026": "provisional"}


def test_les_fiches_disent_que_ce_n_est_pas_une_depense():
    assert "pas une dépense" in df.PUBLIQUE[df.TOTAL]
    assert "moindre recette" in df.TECHNIQUE
    assert "ne s'additionne donc pas aux crédits budgétaires" in df.TECHNIQUE
    assert "absents et non nuls" in df.TECHNIQUE
    for identifiant, publique in df.PUBLIQUE.items():
        assert len(publique.split()) <= 50, identifiant


def test_aucun_indicateur_pour_une_categorie_toujours_nulle(lignes):
    """La taxe d'archéologie préventive ne pèse rien sur les trois exercices :
    publier une série de zéros donnerait à croire qu'un dispositif s'est
    éteint. Elle reste comptée dans le total."""
    categories = {ligne["impot"] for ligne in lignes}
    assert set(df.SANS_INDICATEUR) <= categories
    assert set(df.SANS_INDICATEUR).isdisjoint(df.INDICATEURS)
    lus = df.par_impot(lignes)
    for nom in df.SANS_INDICATEUR:
        assert all(lus.get((nom, an), 0.0) == 0.0 for an in ("2024", "2025", "2026"))


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    df.declarer(entrepot_seme)
    df.declarer(entrepot_seme)
    publies = dict(entrepot_seme.execute(
        "select indicator_id, unit from core.indicators where dataset_id = ?",
        (df.DATASET,),
    ).fetchall())
    assert set(publies) == {df.TOTAL, *(i for i, _ in df.INDICATEURS.values())}
    assert set(publies.values()) == {"EUR"}
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, lignes):
    from plateforme import entrepot, revisions

    df.declarer(entrepot_seme)
    run_id = entrepot.start_run(entrepot_seme, df.DATASET, "manual")
    ecrites, _ = revisions.remplacer(
        entrepot_seme, run_id,
        [df.TOTAL, *(i for i, _ in df.INDICATEURS.values())],
        df.COLONNES, df.lignes_a_ecrire(lignes),
    )
    detaillees = df.ecrire_dispositifs(entrepot_seme, run_id, lignes)
    entrepot_seme.commit()
    assert ecrites == 30, "un total et neuf catégories, sur trois exercices"
    assert detaillees > 900
    (total,) = entrepot_seme.execute(
        "select value from core.observations where indicator_id = ?"
        " and period = '2024'", (df.TOTAL,),
    ).fetchone()
    assert total == 89_406_000_000
    (statut,) = entrepot_seme.execute(
        "select value_status from core.observations where indicator_id = ?"
        " and period = '2026'", (df.TOTAL,),
    ).fetchone()
    assert statut == "provisional"


def test_le_detail_ne_se_melange_pas_au_budget_de_l_etat(entrepot_seme, lignes):
    """Le connecteur de l'État n'écrit que des `LFI` et des `LFR`, et il efface
    ses propres budgets à chaque rechargement. Ceux-ci sont des `PLF` : deux
    connecteurs, deux périmètres, aucune ligne partagée."""
    from plateforme import entrepot

    run_id = entrepot.start_run(entrepot_seme, df.DATASET, "manual")
    df.ecrire_dispositifs(entrepot_seme, run_id, lignes)
    df.ecrire_dispositifs(entrepot_seme, run_id, lignes)
    entrepot_seme.commit()
    types = {t for (t,) in entrepot_seme.execute(
        "select distinct budget_type from fin.public_budgets where dataset_id = ?",
        (df.DATASET,),
    ).fetchall()}
    assert types == {"PLF"}
    genres = {g for (g,) in entrepot_seme.execute(
        "select distinct line_kind from fin.public_budget_lines l"
        " join fin.public_budgets b using (budget_id) where b.dataset_id = ?",
        (df.DATASET,),
    ).fetchall()}
    assert genres == {"depense_fiscale"}
    (budgets,) = entrepot_seme.execute(
        "select count(*) from fin.public_budgets where dataset_id = ?", (df.DATASET,),
    ).fetchone()
    assert budgets == 3, "le rechargement reconstruit, il n'empile pas"


def test_le_crif_est_bien_le_plus_gros_dispositif(lignes):
    """Le crédit d'impôt recherche, 8,0 Md€ en 2026 : c'est le chiffre que la
    page doit montrer en premier, et il vaut d'être tenu par un test."""
    dispositifs = df.par_dispositif(lignes)
    plus_gros = sorted(
        dispositifs.values(), key=lambda d: -d["montants"].get("2026", (0.0, ""))[0]
    )[0]
    assert plus_gros["code"] == "200302"
    assert "recherche" in plus_gros["libelle"].lower()
    assert plus_gros["montants"]["2026"][0] == 8_041_000_000.0
