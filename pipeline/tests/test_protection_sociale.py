"""La protection sociale : 932 milliards, et deux façons de les compter trois fois.

La source croise deux nomenclatures indépendantes — le risque et le secteur
institutionnel — dont chacune couvre la totalité de la masse. Le fichier entier
sert de fixture parce que c'est le seul moyen de mesurer, sur les vrais
chiffres, ce que coûterait l'oubli d'un filtre : 2 797 Md€ au lieu de 932.
"""

from pathlib import Path

import pytest

from plateforme.normalize import protection_sociale as ps

FIXTURES = Path(__file__).parent / "fixtures"

MD = 1_000_000_000


@pytest.fixture(scope="module")
def lignes():
    return ps.lire((FIXTURES / "drees_protection_sociale_sample.csv").read_bytes())


@pytest.fixture(scope="module")
def mesures(lignes):
    return ps.series(lignes)


def test_les_sept_series_sont_lues_sur_toute_la_profondeur(mesures):
    """Sept lignes par exercice avant 2020, mille sept cents après : la
    ventilation par régime n'existe que récemment, le total et ses six risques
    remontent à 1959."""
    assert set(mesures) == set(ps.RISQUES)
    exercices = set(mesures[ps.TOTAL])
    assert min(exercices) == "1959" and max(exercices) == "2024"
    assert len(exercices) == 66
    for code in ps.RISQUES:
        assert set(mesures[code]) == exercices, code


def test_le_total_est_en_euros_pas_en_millions(mesures):
    """La source publie en millions. Sans le facteur, 932 milliards
    s'afficheraient à 932 mille, sous la même unité EUR que le budget de
    l'État."""
    assert mesures[ps.TOTAL]["2024"] == 932_548_270_000.0


def test_la_ventilation_2024_est_celle_que_la_source_publie(mesures):
    attendu = {
        "drees_protection_sociale_vieillesse": 426_665.30,
        "drees_protection_sociale_sante": 338_880.82,
        "drees_protection_sociale_famille": 65_806.89,
        "drees_protection_sociale_emploi": 51_123.85,
        "drees_protection_sociale_pauvrete": 34_012.87,
        "drees_protection_sociale_logement": 16_058.54,
    }
    lus = {
        ps.RISQUES[code][0]: round(montants["2024"] / ps.MILLIONS, 2)
        for code, montants in mesures.items()
        if code != ps.TOTAL
    }
    assert lus == attendu
    # Et la protection sociale pèse deux fois le budget net de l'État (436,7 Md€).
    assert mesures[ps.TOTAL]["2024"] / MD == pytest.approx(932.55, abs=0.01)


def test_les_six_risques_font_le_total(mesures):
    verifies = ps.controler(mesures)
    assert verifies["les_six_risques_font_le_total"] == 66
    assert verifies["premier_exercice"] == "1959"
    assert verifies["dernier_exercice"] == "2024"
    assert verifies["total_dernier_exercice_millions"] == 932_548.27


def test_le_controle_bloque_sur_un_decalage(mesures):
    """Le plus petit des six risques, le logement, ramené à zéro : 16 Md€
    d'écart sur 932. La tolérance vaut un demi-million d'euros — un décalage
    d'un million bloquerait déjà."""
    tronquee = {code: dict(montants) for code, montants in mesures.items()}
    tronquee["E11-5"]["2024"] = 0.0
    with pytest.raises(ps.RisquesIncoherents, match="2024 : les six risques font"):
        ps.controler(tronquee)

    decalee = {code: dict(montants) for code, montants in mesures.items()}
    decalee["E11-4"]["2024"] += 1_000_000
    with pytest.raises(ps.RisquesIncoherents, match="manque, double"):
        ps.controler(decalee)


def test_le_controle_saute_un_exercice_dont_une_composante_manque(mesures):
    """Une composante absente n'est pas un décalage : l'exercice est sauté, les
    soixante-cinq autres restent vérifiés."""
    ampute = {code: dict(montants) for code, montants in mesures.items()}
    del ampute["E11-5"]["2024"]
    assert ps.controler(ampute)["les_six_risques_font_le_total"] == 65


def test_le_controle_exige_un_total_et_un_exercice_verifie(mesures):
    with pytest.raises(ps.RisquesIncoherents, match="aucun total"):
        ps.controler({code: m for code, m in mesures.items() if code != ps.TOTAL})
    with pytest.raises(ps.RisquesIncoherents, match="aucun exercice"):
        ps.controler({ps.TOTAL: {"2024": 1.0}})


def test_oublier_le_filtre_de_secteur_compte_le_total_trois_fois(lignes):
    """Le piège central. Les deux nomenclatures sont indépendantes et chacune
    complète : à ps_niveau=0, le secteur agrégé donne 932,55 Md€ sur une ligne,
    les neuf secteurs de niveau 1 les redisent, et les trente-quatre du niveau 2
    encore. Sommer sans filtrer si_niveau donne 2 797 Md€ — un chiffre
    qu'aucun contrôle interne à la nomenclature de risque n'attraperait."""
    par_secteur = {}
    for niveau in ("0", "1", "2"):
        retenues = [
            ligne for ligne in lignes
            if ligne[0] == "2024" and ligne[1] == ps.NIVEAU_TOTAL and ligne[3] == niveau
        ]
        par_secteur[niveau] = (len(retenues), round(sum(r[4] for r in retenues), 2))
    assert par_secteur == {
        "0": (1, 932_548.27),
        "1": (9, 932_548.27),
        "2": (34, 932_548.27),
    }
    sans_filtre = sum(
        ligne[4] for ligne in lignes
        if ligne[0] == "2024" and ligne[1] == ps.NIVEAU_TOTAL
    )
    assert round(sans_filtre, 2) == 2_797_644.81
    assert sans_filtre == pytest.approx(3 * 932_548.27, abs=0.02)
    # Le module, lui, ne garde que le secteur agrégé.
    assert ps.SECTEUR_AGREGE == "0"
    assert ps.series(lignes)[ps.TOTAL]["2024"] == 932_548.27 * ps.MILLIONS


def test_oublier_le_filtre_de_risque_compte_la_masse_quatre_fois_de_plus(lignes):
    """La symétrique : la nomenclature de risque redit elle aussi la totalité à
    chacun de ses niveaux, sauf le dernier."""
    par_niveau = {}
    for niveau in ("0", "1", "2", "3", "4"):
        retenues = [
            ligne for ligne in lignes
            if ligne[0] == "2024" and ligne[3] == ps.SECTEUR_AGREGE and ligne[1] == niveau
        ]
        par_niveau[niveau] = round(sum(r[4] for r in retenues), 2)
    assert par_niveau["0"] == par_niveau["1"] == par_niveau["2"] == par_niveau["3"]
    assert par_niveau["0"] == 932_548.27
    # Et le plus fin est incomplet : 30 Md€ manquent, sans qu'aucune ligne ne
    # manque visiblement. Publier depuis les feuilles perdrait cette masse.
    assert par_niveau["4"] == 902_365.50
    vieillesse = {
        niveau: round(sum(
            r[4] for r in lignes
            if r[0] == "2024" and r[3] == ps.SECTEUR_AGREGE and r[1] == niveau
            and r[2].startswith("E11-2")
        ), 2)
        for niveau in ("1", "4")
    }
    assert vieillesse == {"1": 426_665.30, "4": 419_193.27}
    assert ps.NIVEAU_RISQUES == "1"


def test_les_lignes_suivent_les_colonnes_declarees(mesures):
    from plateforme import revisions

    a_ecrire = ps.lignes_a_ecrire(mesures)
    assert len(a_ecrire) == 7 * 66
    attendue = len(revisions.CLES) + len(ps.COLONNES)
    assert all(len(ligne) == attendue for ligne in a_ecrire)
    assert {ligne[1] for ligne in a_ecrire} == {"pays"}
    assert {ligne[2] for ligne in a_ecrire} == {"FR"}


def test_la_fiche_refuse_les_confusions_de_referentiel():
    assert "comptabilité nationale" in ps.TECHNIQUE
    assert "ne sont pas des crédits" in ps.TECHNIQUE
    assert "ne se soustraient pas" in ps.TECHNIQUE
    assert "solde des" in ps.TECHNIQUE and "% du PIB" in ps.TECHNIQUE
    assert "compte le total trois fois" in ps.TECHNIQUE
    assert "profondeur de la source varie" in ps.TECHNIQUE
    assert "millions d'euros courants" in ps.TECHNIQUE
    for identifiant, _, publique in ps.RISQUES.values():
        assert len(publique.split()) <= 50, identifiant
        assert "crédits budgétaires de l'État" in publique


def test_le_nom_de_regime_n_est_pas_une_liste_de_regimes():
    """La colonne mêle des régimes réels et des libellés de total. Le module ne
    la lit pas : `lire` n'en rend rien."""
    import csv
    import io

    contenu = (FIXTURES / "drees_protection_sociale_sample.csv").read_bytes()
    rangs = list(csv.DictReader(io.StringIO(contenu.decode("utf-8-sig")), delimiter=";"))
    noms = {r["nom_regime"] for r in rangs if r["annee"] == "2024"}
    assert "Total tous régimes" in noms
    assert "Total S13141" in noms
    assert "Caisse nationale d’assurance vieillesse" in noms
    assert "nom_regime" not in ps.lire.__doc__
    assert all(len(ligne) == 5 for ligne in ps.lire(contenu[:400]))


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    ps.declarer(entrepot_seme)
    ps.declarer(entrepot_seme)
    publies = dict(entrepot_seme.execute(
        "select indicator_id, unit from core.indicators where dataset_id = ?",
        (ps.DATASET,),
    ).fetchall())
    assert set(publies) == {i for i, _, _ in ps.RISQUES.values()}
    assert set(publies.values()) == {"EUR"}
    themes = {t for (t,) in entrepot_seme.execute(
        "select distinct theme from core.indicators where dataset_id = ?",
        (ps.DATASET,),
    ).fetchall()}
    assert themes == {"securite_sociale"}
    additifs = {a for (a,) in entrepot_seme.execute(
        "select distinct additive from core.indicators where dataset_id = ?",
        (ps.DATASET,),
    ).fetchall()}
    assert additifs == {False}, "un agrégat national ne s'additionne pas entre territoires"
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, mesures):
    from plateforme import entrepot, revisions

    ps.declarer(entrepot_seme)
    entrepot_seme.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code, flags) values ('pays', 'FR', ?, 'France',"
        " null, null, '{}')",
        (ps.MILLESIME,),
    )
    run_id = entrepot.start_run(entrepot_seme, ps.DATASET, "manual")
    a_ecrire = ps.lignes_a_ecrire(mesures)
    ecrites, _ = revisions.remplacer(
        entrepot_seme, run_id,
        [i for i, _, _ in ps.RISQUES.values()], ps.COLONNES, a_ecrire,
    )
    entrepot_seme.commit()
    assert ecrites == 462, "sept séries sur soixante-six exercices"
    (valeur,) = entrepot_seme.execute(
        "select value from core.observations"
        " where indicator_id = 'drees_protection_sociale_total' and period = '2024'"
    ).fetchone()
    assert valeur == 932_548_270_000.0
    (somme,) = entrepot_seme.execute(
        "select sum(value) from core.observations where period = '2024'"
        " and indicator_id <> 'drees_protection_sociale_total'"
    ).fetchone()
    assert somme == pytest.approx(valeur, abs=1_000)
