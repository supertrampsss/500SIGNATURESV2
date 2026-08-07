"""Les prescriptions des médecins libéraux : le même argent, trois fois.

La fixture est un extrait réel de data.ameli, obtenu d'une seule requête :

    .../prescriptions/exports/csv?select=annee,profession_sante,region,
    departement,libelle_departement,poste_prescription,
    montant_total_prescription_integer
    &where=profession_sante="Ensemble des médecins"
           or (profession_sante="Allergologues" and year(annee)=2024)
    &delimiter=;

Elle porte donc tout ce que le connecteur charge — les quinze exercices de
l'agrégat « Ensemble des médecins », de quoi faire tourner le contrôle en
entier — plus deux choses que l'export du connecteur n'a pas et que ces tests
ont besoin de voir sur de vraies données : une profession voisine dont 468
lignes sont masquées par le secret statistique, et la colonne des libellés qui
montre le piège du code 999.
"""

import csv
import io
from pathlib import Path

import pytest

from plateforme import couverture
from plateforme.normalize import prescriptions as p

FIXTURES = Path(__file__).parent / "fixtures"
SAMPLE = FIXTURES / "cnam_prescriptions_sample.csv"


@pytest.fixture(scope="module")
def brut() -> bytes:
    return SAMPLE.read_bytes()


@pytest.fixture(scope="module")
def lignes(brut):
    return p.lire(brut)


def rangs(contenu: bytes) -> list[dict]:
    """La fixture telle quelle, pour observer ce que le connecteur écarte."""
    return list(csv.DictReader(io.StringIO(contenu.decode("utf-8-sig")), delimiter=";"))


def test_seul_l_agregat_des_medecins_est_lu(brut, lignes):
    """L'export filtre déjà la profession ; `lire` la refiltre. Si la modalité
    était renommée, le `where` ramènerait les vingt spécialités et chacune
    vérifierait séparément ses postes et ses départements : le contrôle
    passerait sur une masse cumulée plusieurs fois."""
    assert len(rangs(brut)) == 17_280
    assert len(lignes) == 16_200


def test_un_montant_masque_n_est_pas_un_montant_nul(brut):
    """468 des 1 080 lignes d'allergologues de 2024 sont masquées par le secret
    statistique (moins de cinq professionnels), et 320 autres valent zéro pour
    de bon — l'allergologue guyanais ne prescrit aucune kinésithérapie. La
    source écrit les deux différemment : colonne vide d'un côté, « 0 » de
    l'autre. Relabellisées en agrégat, ces lignes passent la garde de
    profession et prouvent que le connecteur ne les confond pas."""
    allergologues = [
        rang for rang in rangs(brut) if rang["profession_sante"] == "Allergologues"
    ]
    montants = [rang["montant_total_prescription_integer"].strip() for rang in allergologues]
    assert montants.count("") == 468 and montants.count("0") == 320
    relabellise = brut.replace(b"Allergologues", p.PROFESSION.encode("utf-8"))
    elargi = p.lire(relabellise)
    assert len(elargi) == 16_200 + (1_080 - 468), "les masquées sont absentes"
    assert sum(1 for *_, montant in elargi if montant == 0) == 320, "les zéros restent"


def test_le_code_999_porte_deux_libelles_et_double_la_masse(brut):
    """Une ligne « FRANCE » et dix-huit lignes régionales « Tout département »
    partagent le code 999. Le filtre ne tient que sur le couple région +
    département."""
    neuf_cent_quatre_vingt_dix_neuf = [
        rang for rang in rangs(brut)
        if rang["profession_sante"] == p.PROFESSION
        and rang["annee"][:4] == "2024"
        and rang["poste_prescription"] == "total"
        and rang["departement"] == "999"
    ]
    assert len(neuf_cent_quatre_vingt_dix_neuf) == 19
    libelles = {rang["libelle_departement"] for rang in neuf_cent_quatre_vingt_dix_neuf}
    assert libelles == {"FRANCE", "Tout département"}
    double = sum(
        int(rang["montant_total_prescription_integer"])
        for rang in neuf_cent_quatre_vingt_dix_neuf
    )
    assert double == 120_907_203_994, "deux fois la France, à deux euros près"


def test_les_trois_agregations_retrouvent_la_meme_masse(lignes):
    """60 453 601 998 € en 2024 : le total France, et la somme de ses huit
    postes, exactement."""
    verifies = p.controler(lignes)
    assert verifies["exercices"][0] == "2010" and verifies["exercices"][-1] == "2024"
    assert len(verifies["exercices"]) == 15
    assert verifies["france_dernier_exercice"] == 60_453_601_998
    assert set(verifies["departements_par_exercice"].values()) == {101}


def test_l_arrondi_de_la_source_passe_et_pas_une_erreur(lignes):
    """Les cent-un départements de 2024 font 60 453 602 004 € contre
    60 453 601 998 € pour la ligne France : six euros d'arrondi sur soixante
    milliards, trois ordres de grandeur sous le seuil. Dix mille euros, eux,
    bloquent."""
    departements = sum(
        montant for exercice, _, code, poste, montant in lignes
        if exercice == "2024" and poste == "total" and code != "999"
    )
    assert departements == 60_453_602_004
    assert departements - 60_453_601_998 == 6
    p.controler(lignes)

    def decale(cible: float) -> list[tuple]:
        for rang, (exercice, region, code, poste, montant) in enumerate(lignes):
            if exercice == "2024" and poste == "total" and code == "75":
                return [
                    *lignes[:rang],
                    (exercice, region, code, poste, montant + cible),
                    *lignes[rang + 1:],
                ]
        raise AssertionError("Paris introuvable en 2024")

    p.controler(decale(6.0))
    with pytest.raises(p.TotauxDivergents, match="départements"):
        p.controler(decale(10_000.0))


def test_le_controle_bloque_si_un_poste_ou_la_france_disparait(lignes):
    sans_kine = [ligne for ligne in lignes if ligne[3] != "5"]
    with pytest.raises(p.TotauxDivergents, match="postes 5 absents"):
        p.controler(sans_kine)
    sans_france = [
        ligne for ligne in lignes if (ligne[1], ligne[2]) != p.FRANCE
    ]
    with pytest.raises(p.TotauxDivergents, match="aucune ligne France"):
        p.controler(sans_france)


def test_les_agregats_ne_sont_pas_publies_comme_des_departements(lignes):
    observations = p.par_departement(lignes)
    codes = {code for _, _, code, _, _ in observations}
    assert "999" not in codes
    assert len(codes) == 101
    assert len(observations) == 101 * 15
    somme = sum(
        montant for _, _, _, exercice, montant in observations if exercice == "2024"
    )
    assert somme == 60_453_602_004


def test_la_fiche_nomme_le_perimetre_et_refuse_la_lecture_departementale():
    assert len(p.PUBLIQUE.split()) <= 50
    assert "pas la dépense de santé de ses habitants" in p.PUBLIQUE
    # Ville, libéraux, tous régimes : les trois mots sans lesquels le chiffre
    # se lit comme une dépense d'assurance maladie.
    for mot in ("exécutés en ville", "libéraux (hors hôpital)", "tous régimes"):
        assert mot in p.TECHNIQUE
    assert "ni comme la consommation de soins" in p.TECHNIQUE
    assert "département d'exercice du prescripteur" in p.TECHNIQUE
    # Les deux jeux voisins qu'on prend pour celui-ci.
    assert "`honoraires`" in p.TECHNIQUE and "n'est pas de l'argent public" in p.TECHNIQUE
    assert "`depenses`" in p.TECHNIQUE and "dep_niv_1" in p.TECHNIQUE


def test_l_export_ne_demande_que_les_colonnes_entieres():
    """Les colonnes sans suffixe `_integer` sont de type texte et portent « NS »
    et « NC » ; `annee` est de type date, un `where=annee=2024` y échoue."""
    adresse = p.url()
    assert "montant_total_prescription_integer" in adresse
    assert "montant_total_prescription%2C" not in adresse
    assert "annee%3D" not in adresse
    assert "Ensemble%20des%20m%C3%A9decins" in adresse


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    p.declarer(entrepot_seme)
    p.declarer(entrepot_seme)
    publies = entrepot_seme.execute(
        "select indicator_id, unit, additive, theme from core.indicators"
        " where dataset_id = ?",
        (p.DATASET,),
    ).fetchall()
    assert publies == [(p.INDICATEUR, "EUR", True, "sante")]
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, lignes):
    from plateforme import entrepot, revisions
    from plateforme.normalize.ofgl import filtrer_territoires_connus

    p.declarer(entrepot_seme)
    # Le registre versionné (infra/seed/dataset_registry.csv) fait foi en
    # production ; il est semé ici pour que le run tracé cite un jeu déclaré.
    entrepot_seme.execute(
        "insert into meta.dataset_registry (dataset_id, source_id, title, priority)"
        " values (?, ?, 'Prescriptions des médecins libéraux', 'P2')"
        " on conflict (dataset_id) do nothing",
        (p.DATASET, p.SOURCE),
    )
    entrepot_seme.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code, flags) values ('departement', '19', ?,"
        " 'Corrèze', null, null, '{}')",
        (p.MILLESIME,),
    )
    run_id = entrepot.start_run(entrepot_seme, p.DATASET, "manual")
    candidates = p.par_departement(lignes)
    gardees, ecartes = filtrer_territoires_connus(entrepot_seme, candidates)
    ecrites, _ = revisions.remplacer(
        entrepot_seme, run_id, [p.INDICATEUR], p.COLONNES,
        [
            (identifiant, niveau, code, p.MILLESIME, exercice, montant)
            for identifiant, niveau, code, exercice, montant in gardees
        ],
    )
    entrepot_seme.commit()
    assert ecrites == 15, "un département, quinze exercices"
    assert len(ecartes) == 100, "les autres départements ne sont pas au référentiel"
    (valeur,) = entrepot_seme.execute(
        "select value from core.observations"
        " where indicator_id = ? and geo_code = '19' and period = '2024'",
        (p.INDICATEUR,),
    ).fetchone()
    assert valeur > 0


def test_la_couverture_se_mesure_en_euros(lignes):
    """Un code de département qui ne serait pas celui du référentiel — « 019 »
    au lieu de « 19 » — laisserait les trois agrégations d'accord entre elles
    et publierait une carte vide. Seule la couverture le voit."""
    lus = p.masse_par_maille(p.par_departement(lignes))
    assert lus["departement"] > 0
    couverture.controler(lus, lus)
    with pytest.raises(couverture.CouvertureInsuffisante):
        couverture.controler(lus, {"departement": lus["departement"] * 0.5})
