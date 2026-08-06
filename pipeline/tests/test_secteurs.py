"""Secteurs d'activité : deux comptages d'établissements qui ne disent pas la
même chose, et un « salarié » qui n'est pas une personne.

Le risque de ce jeu n'est pas de mal lire un fichier — sa hiérarchie est simple
— mais de publier des chiffres qui contredisent ceux déjà en ligne. Le site
porte déjà des établissements, comptés autrement, et des actifs, comptés
ailleurs. Chaque fiche doit dire lequel elle est.
"""

from pathlib import Path

import pytest

from plateforme import couverture
from plateforme.normalize import secteurs

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def archive() -> bytes:
    return (FIXTURES / "insee_flores_sample.zip").read_bytes()


@pytest.fixture(scope="module")
def lignes(archive) -> list[dict]:
    return secteurs.lire(archive)


def test_seuls_les_territoires_du_site_sont_retenus(lignes):
    """La fixture porte un arrondissement municipal, un EPCI et une unité
    urbaine : chargés, ils compteraient une seconde fois des établissements
    déjà comptés dans leur commune."""
    assert lignes
    assert {ligne["niveau"] for ligne in lignes} == {
        "commune", "departement", "region"
    }


def test_seul_le_total_des_tranches_d_effectifs_est_lu(lignes):
    """Les neuf tranches sont servies avec leur total sur la même dimension.
    Les lire toutes doublerait chaque territoire."""
    valeurs = secteurs.valeurs_publiees(lignes)
    vus = set()
    for cle, niveau, code, periode, _, _ in valeurs:
        assert (cle, niveau, code, periode) not in vus, f"{cle} {code} publié deux fois"
        vus.add((cle, niveau, code, periode))
    par_cle = {
        (cle, code): valeur for cle, _, code, _, valeur, _ in valeurs
    }
    assert par_cle[("insee_etablissements_employeurs", "33063")] == 14432
    assert par_cle[("insee_effectifs_salaries", "33063")] == 201045


def test_les_cinq_secteurs_font_le_total(lignes):
    verifies = secteurs.controler(lignes)
    assert verifies["les_cinq_secteurs_font_le_total"] > 0


def test_le_controle_bloque_si_un_secteur_derive():
    """Un détail lu comme un total, ou l'inverse : la somme des parts décroche
    du total publié, et le chargement s'arrête."""
    base = [
        {"niveau": "commune", "code": "33063", "periode": "2024",
         "mesure": "UNIT_LOC", "secteur": secteur, "valeur": 10.0, "drapeaux": []}
        for secteur in secteurs.SECTEURS
    ]
    assert secteurs.controler([
        *base,
        {"niveau": "commune", "code": "33063", "periode": "2024",
         "mesure": "UNIT_LOC", "secteur": "_T", "valeur": 50.0, "drapeaux": []},
    ]) == {"les_cinq_secteurs_font_le_total": 1}
    with pytest.raises(secteurs.IdentiteRompue):
        secteurs.controler([
            *base,
            {"niveau": "commune", "code": "33063", "periode": "2024",
             "mesure": "UNIT_LOC", "secteur": "_T", "valeur": 100.0, "drapeaux": []},
        ])


def test_le_controle_echoue_si_rien_n_a_pu_etre_verifie():
    """Un filtre qui ne laisserait passer que des totaux passerait le contrôle
    sans rien contrôler."""
    with pytest.raises(secteurs.IdentiteRompue):
        secteurs.controler([
            {"niveau": "commune", "code": "33063", "periode": "2024",
             "mesure": "UNIT_LOC", "secteur": "_T", "valeur": 50.0, "drapeaux": []},
        ])


def _lignes_de_pays(par_niveau: dict[str, float]) -> list[dict]:
    """Un pays miniature : une entrée par maille, sur le seul total de secteur."""
    return [
        {"niveau": niveau, "code": "x", "periode": "2024", "mesure": "UNIT_LOC",
         "secteur": "_T", "valeur": valeur, "drapeaux": []}
        for niveau, valeur in par_niveau.items()
    ]


def test_les_sommes_sont_tenues_par_maille_et_par_mesure(lignes):
    """La fixture ne porte qu'une part du pays : ce qui se vérifie ici est que
    chaque maille et chaque mesure ont leur somme, sans mélange."""
    sommes = secteurs.controler_totaux(lignes, {})
    assert set(sommes) == set(secteurs.MESURES)
    assert set(sommes["UNIT_LOC"]) == {"commune", "departement", "region"}
    assert sommes["UNIT_LOC"]["departement"] != sommes["EMPL3112"]["departement"]


def test_chaque_maille_doit_faire_la_France():
    sommes = secteurs.controler_totaux(
        _lignes_de_pays({"commune": 100.0, "departement": 100.0, "region": 100.0}),
        {"UNIT_LOC": 100.0},
    )
    assert sommes["UNIT_LOC"] == {"commune": 100.0, "departement": 100.0, "region": 100.0}


def test_le_controle_bloque_si_une_seule_maille_decroche():
    """Un département tombé du référentiel laisse les deux autres mailles
    justes : aucun total pris isolément ne le montrerait."""
    with pytest.raises(secteurs.TotalIncoherent, match="departements"):
        secteurs.controler_totaux(
            _lignes_de_pays({"commune": 100.0, "departement": 90.0, "region": 100.0}),
            {"UNIT_LOC": 100.0},
        )


def test_la_France_entiere_sert_de_total_pas_la_metropole(archive):
    """Le fichier publie deux France sous le même `GEO_OBJECT`. La métropole
    ignore les communes d'outre-mer, qui sont chargées : la prendre pour total
    ferait échouer le contrôle de somme sans dire pourquoi."""
    totaux = secteurs.totaux_france(archive)
    assert totaux == {"UNIT_LOC": 2411570.0, "EMPL3112": 26604745.0}


def test_une_commune_qui_recoit_les_etablissements_d_une_autre_est_signalee(lignes):
    """Le statut `W` marque une commune nouvelle dont le chiffre couvre plus de
    territoire qu'elle : elle est chargée, et le drapeau le dit."""
    marquees = {
        ligne["code"] for ligne in lignes if secteurs.DRAPEAU_REGROUPEMENT in ligne["drapeaux"]
    }
    assert marquees == {"15141"}


def test_une_commune_comptee_ailleurs_n_apparait_pas(lignes):
    """Le statut `K` marque une commune déléguée dont les établissements sont
    comptés dans sa commune nouvelle : la source ne lui donne aucune valeur, et
    un zéro écrit à sa place lui inventerait une absence d'activité."""
    assert not {ligne["code"] for ligne in lignes} & {"15031", "15171"}


def test_la_couverture_se_mesure_en_etablissements_pas_en_codes(lignes):
    """Les deux incidents du 6 août — codes zéro-padés, arrondissements non
    rattachés — passaient les contrôles d'identité, qui comparent la source à
    elle-même. Celui-ci compare ce qui est lu à ce qui est reconnu, et il ne
    peut le faire que sur la même grandeur des deux côtés."""
    candidates = [
        (cle, niveau, code, periode, valeur)
        for cle, niveau, code, periode, valeur, _ in secteurs.valeurs_publiees(lignes)
    ]
    lus = secteurs.etablissements_par_maille(candidates)
    sommes = secteurs.controler_totaux(lignes, {})
    assert lus == sommes["UNIT_LOC"], "les deux côtés du contrôle doivent compter pareil"
    couverture.controler(lus, lus)
    with pytest.raises(couverture.CouvertureInsuffisante):
        couverture.controler(lus, {**lus, "commune": lus["commune"] * 0.9})


def test_les_fiches_distinguent_les_deux_comptages_et_le_poste():
    fiches = secteurs.fiches()
    assert len(fiches) == 12
    employeurs = fiches["insee_etablissements_employeurs"]["public"]
    assert "actifs" in employeurs, "la fiche doit nommer l'autre comptage publié"
    salaries = fiches["insee_effectifs_salaries"]["public"]
    assert "deux fois" in salaries, "un poste n'est pas une personne"
    assert "poste" in secteurs.TECHNIQUE and "équivalent temps plein" in secteurs.TECHNIQUE
    assert "lieu de travail" in secteurs.TECHNIQUE
    assert "Mayotte" in secteurs.TECHNIQUE
    for cle, fiche in fiches.items():
        assert len(fiche["public"].split()) <= 50, cle


def test_les_deux_mesures_ont_leur_jeu_complet_de_secteurs():
    """Un secteur oublié dans une mesure laisserait un thème amputé sans que
    rien n'échoue."""
    attendus = {
        f"{racine}{suffixe}"
        for racine, _, _, _, _ in secteurs.MESURES.values()
        for suffixe in ["", *(f"_{s[0]}" for s in secteurs.SECTEURS.values())]
    }
    assert set(secteurs.fiches()) == attendus


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    """`declarer` est rejoué à chaque run : la seconde passe ne doit ni
    dupliquer les indicateurs ni laisser de fiche orpheline. C'est aussi le
    seul endroit où la contrainte des cinquante mots du schéma est éprouvée."""
    secteurs.declarer(entrepot_seme)
    secteurs.declarer(entrepot_seme)
    themes = dict(entrepot_seme.execute(
        "select indicator_id, theme from core.indicators where dataset_id = ?",
        (secteurs.DATASET,),
    ).fetchall())
    assert set(themes) == set(secteurs.fiches())
    assert themes["insee_etablissements_employeurs"] == "entreprises"
    assert themes["insee_effectifs_salaries_industrie"] == "secteurs_salaries"
    assert themes["insee_etablissements_employeurs_industrie"] == "secteurs_etablissements"
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0
