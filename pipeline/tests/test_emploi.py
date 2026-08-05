"""Activité et diplômes : deux chômages, trois populations, une somme déclarée.

Le risque de ce jeu n'est pas de mal lire un fichier, c'est de publier un
chiffre qui en contredit un autre déjà en ligne. Le site porte déjà un taux de
chômage — celui du BIT, au département — et deux populations de référence. Ce
module en ajoute une troisième et un second chômage : chacun doit dire lequel il
est, sous peine de rendre les deux illisibles.
"""

from pathlib import Path

import pytest

from plateforme.normalize import emploi

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def archive() -> bytes:
    return (FIXTURES / "insee_emploi_sample.zip").read_bytes()


@pytest.fixture(scope="module")
def lignes(archive) -> list[dict]:
    return emploi.lire(archive)


def test_seuls_les_territoires_du_site_sont_retenus(lignes):
    assert lignes
    assert {ligne["niveau"] for ligne in lignes} <= {
        "commune", "epci", "departement", "region"
    }


def test_une_seule_tranche_d_age_et_un_seul_sexe(lignes):
    """Le jeu croise cinq tranches d'âge et trois sexes. La fixture porte les
    25-54 ans et les femmes : chargés en plus, ils compteraient deux fois les
    mêmes personnes sous le même identifiant."""
    valeurs = emploi.valeurs_publiees(lignes)
    par_cle = {}
    for identifiant, niveau, code, periode, valeur, _ in valeurs:
        cle = (identifiant, niveau, code, periode)
        assert cle not in par_cle, f"{cle} publié deux fois"
        par_cle[cle] = valeur
    assert round(par_cle[("insee_population_15_64_ans", "commune", "33063", "2023")]) == 191928


def test_les_trois_identites_se_referment(lignes):
    """Actifs occupés + chômeurs = actifs ; actifs + inactifs = 15-64 ans ; les
    sept niveaux de diplôme = la même population."""
    verifies = emploi.controler(lignes)
    assert set(verifies) == {nom for nom, _, _ in emploi.IDENTITES}
    assert all(compte > 0 for compte in verifies.values())


def test_les_diplomes_n_existent_qu_en_2023(lignes):
    """La source ne ventile par diplôme que le dernier millésime. Le contrôle
    saute les autres plutôt que de crier sur une donnée qui n'existe pas."""
    millesimes = {ligne["periode"] for ligne in lignes if ligne["diplome"] != "_T"}
    assert millesimes == {"2023"}
    verifies = emploi.controler(lignes)
    assert (
        verifies["les_diplomes_font_la_meme_population"] * 3
        == verifies["actifs_et_inactifs_font_les_quinze_soixante_quatre"]
    )


def test_le_controle_bloque_si_les_actifs_ne_se_somment_plus():
    # Les trois identités doivent toutes trouver de quoi se vérifier : un
    # contrôle qui ne contrôle rien lève, et c'est voulu.
    base = [
        ("_T", "_T", 1000.0), ("1T2", "_T", 700.0), ("1", "_T", 620.0),
        ("2", "_T", 80.0), ("3", "_T", 300.0),
        ("_T", "001T100_RP", 150.0), ("_T", "200_RP", 100.0),
        ("_T", "300_RP", 200.0), ("_T", "350T351_RP", 250.0),
        ("_T", "500_RP", 120.0), ("_T", "600_RP", 100.0), ("_T", "700_RP", 80.0),
    ]
    lignes = [
        {"niveau": "commune", "code": "33063", "periode": "2023", "statut": s,
         "diplome": d, "valeur": v, "drapeaux": []}
        for s, d, v in base
    ]
    assert emploi.controler(lignes)["actifs_occupes_et_chomeurs_font_les_actifs"] == 1
    fausse = [dict(ligne) for ligne in lignes]
    fausse[3]["valeur"] = 60.0
    with pytest.raises(emploi.IdentiteRompue) as erreur:
        emploi.controler(fausse)
    assert "actifs_occupes_et_chomeurs" in str(erreur.value)


def test_le_controle_echoue_si_rien_n_a_pu_etre_verifie():
    with pytest.raises(emploi.IdentiteRompue):
        emploi.controler([])


def test_le_superieur_est_la_somme_des_trois_niveaux(lignes):
    """La seule valeur calculée du module. Bordeaux 2023 : 21 598 + 33 861 +
    57 207, soit 58,7 % d'une population de 191 928."""
    valeurs = {
        (identifiant, code, periode): valeur
        for identifiant, _, code, periode, valeur, _ in emploi.valeurs_publiees(lignes)
    }
    superieur = valeurs[("insee_diplome_superieur", "33063", "2023")]
    assert round(superieur) == 112666
    total = valeurs[("insee_population_15_64_ans", "33063", "2023")]
    assert round(100 * superieur / total, 1) == 58.7
    # Les cinq indicateurs de diplôme somment à la population : c'est ce qui
    # rend leurs parts lisibles ensemble sur la fiche.
    cinq = superieur + sum(
        valeurs[(identifiant, "33063", "2023")]
        for identifiant, _ in emploi.DIPLOMES.values()
    )
    assert abs(cinq - total) < 0.01


def test_un_superieur_ampute_d_un_niveau_n_est_pas_publie():
    """Un sous-comptage présenté comme une mesure. Si un des trois niveaux
    manque, la somme ne sort pas."""
    lignes = [
        {"niveau": "commune", "code": "33063", "periode": "2023", "statut": "_T",
         "diplome": code, "valeur": 100.0, "drapeaux": []}
        for code in ("500_RP", "600_RP")
    ]
    valeurs = emploi.valeurs_publiees(lignes)
    assert not [v for v in valeurs if v[0] == "insee_diplome_superieur"]
    lignes.append(
        {"niveau": "commune", "code": "33063", "periode": "2023", "statut": "_T",
         "diplome": "700_RP", "valeur": 50.0, "drapeaux": []}
    )
    valeurs = emploi.valeurs_publiees(lignes)
    superieur = [v for v in valeurs if v[0] == "insee_diplome_superieur"]
    assert len(superieur) == 1 and superieur[0][4] == 250.0


def test_les_croisements_lus_couvrent_les_controles():
    """Un croisement oublié à la lecture ferait passer un contrôle qui ne
    contrôle rien."""
    retenus = emploi.croisements_retenus()
    for _, composantes, total in emploi.IDENTITES:
        assert set(composantes) <= retenus
        assert total in retenus


def test_la_fiche_distingue_les_deux_chomages_et_les_trois_populations():
    """C'est tout l'enjeu du module. Le chômage du recensement est déclaratif et
    plus élevé que celui du BIT, déjà publié ici ; et cette population de
    référence n'est ni la population municipale ni les quinze ans et plus."""
    chomeurs = emploi.PUBLIQUE["insee_chomeurs_rp"]
    assert "Bureau international du travail" in chomeurs
    assert "Taux de chômage" in chomeurs
    population = emploi.PUBLIQUE["insee_population_15_64_ans"]
    assert "ni la population du territoire" in population
    assert "quinze ans et plus" in population
    assert "n'existe que pour 2023" in emploi.PUBLIQUE["insee_diplome_superieur"]
    for identifiant, texte in emploi.PUBLIQUE.items():
        assert len(texte.split()) <= 50, f"{identifiant} : {len(texte.split())} mots"
    assert "déclaratif" in emploi.TECHNIQUE
    assert "lieu de résidence" in emploi.TECHNIQUE
    assert "hors Mayotte" in emploi.TECHNIQUE


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(tmp_path):
    from plateforme import entrepot, registry

    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    try:
        registry.sync(conn)
        emploi.declarer(conn)
        emploi.declarer(conn)
        themes = dict(conn.execute(
            "select indicator_id, theme from core.indicators where dataset_id = ?",
            (emploi.DATASET,),
        ).fetchall())
        assert len(themes) == len(emploi.indicateurs())
        assert themes["insee_chomeurs_rp"] == "emploi"
        assert themes["insee_diplome_superieur"] == "diplomes"
        (formule,) = conn.execute(
            "select d.formula from core.indicators i"
            " join core.indicator_definitions d using (definition_id)"
            " where i.indicator_id = 'insee_diplome_superieur'"
        ).fetchone()
        assert "Somme des trois niveaux" in formule
    finally:
        conn.close()
