"""Les comparaisons européennes : ce qui les rend chargeables, pas leur contenu.

Le contenu vient d'Eurostat et se vérifie contre Eurostat. Ce qui se vérifie
ici est la tuyauterie qui décide si un chargement démarre ou meurt à la
première ligne : un indicateur dont le jeu n'est pas déclaré au registre
échoue en production sur une clé étrangère, et **les contrôles existants ne le
voient pas** — `test_declarations` compte les indicateurs dont le jeu figure au
registre, si bien qu'un jeu manquant les rend simplement invisibles au lieu de
les faire tomber.
"""

from pathlib import Path

import pytest

from plateforme import entrepot, registry
from plateforme.connectors import eurostat
from plateforme.normalize import europe


@pytest.fixture
def entrepot_neuf(tmp_path):
    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    registry.sync(conn)
    yield conn
    conn.close()


def test_chaque_indicateur_pointe_un_jeu_declare():
    for indicateur, fiche in europe.INDICATEURS.items():
        assert fiche["jeu"] in europe.DATASET_PAR_JEU, indicateur


def test_chaque_jeu_est_au_registre_des_sources(entrepot_neuf):
    """Sans sa ligne dans `infra/seed/dataset_registry.csv`, le run ne démarre
    pas : `start_run` insère un run qui pend au jeu."""
    seed = Path(europe.__file__).parents[3] / "infra/seed/dataset_registry.csv"
    texte = seed.read_text(encoding="utf-8")
    for jeu in europe.DATASET_PAR_JEU.values():
        assert f"\n{jeu}," in texte, f"{jeu} absent du seed"
        connu = entrepot_neuf.execute(
            "select count(*) from meta.dataset_registry where dataset_id = ?", (jeu,)
        ).fetchone()[0]
        assert connu == 1, jeu


def test_tous_les_indicateurs_sont_declares_et_publies(entrepot_neuf):
    europe.declarer(entrepot_neuf)
    publies = {
        identifiant
        for (identifiant,) in entrepot_neuf.execute(
            "select indicator_id from core.indicators where published"
            " and dataset_id in (select dataset_id from meta.dataset_registry)"
        ).fetchall()
    }
    assert set(europe.INDICATEURS) <= publies, set(europe.INDICATEURS) - publies


def test_chaque_serie_filtre_une_seule_valeur_par_pays_et_par_annee():
    """Un filtre incomplet ramène plusieurs dimensions superposées.

    Le décodeur JSON-stat ne rend qu'un point par combinaison ; si un jeu porte
    une dimension non filtrée — le type de pension, la classe d'âge, l'unité —
    plusieurs valeurs se rangent sous la même clé (pays, année) et la dernière
    écrase les autres, en silence. Chaque série déclare donc la fréquence
    annuelle et une unité.
    """
    for indicateur, fiche in europe.INDICATEURS.items():
        params = fiche["params"]
        assert params.get("freq") == "A", indicateur
        # `ilc_di12` n'a pas de dimension `unit` mais un `statinfo` qui joue le
        # même rôle : c'est lui qui choisit entre les variantes de l'indice.
        assert "unit" in params or "statinfo" in params, indicateur


def test_l_unite_publiee_dit_le_denominateur():
    """Un taux pour cent mille habitants ne se range pas sous `percent`.

    Le site publie déjà des taux de délinquance **pour mille** (SSMSI) ; les
    séries européennes comptent **pour cent mille**. Confondre les deux unités
    multiplierait un chiffre par cent sans que rien ne le dise, et c'est
    précisément le genre de faute que ce dépôt refuse.
    """
    for indicateur, fiche in europe.INDICATEURS.items():
        if fiche["params"].get("unit") == "P_HTHAB":
            assert fiche["unite"] == "pour_100000_habitants", indicateur
        if fiche["params"].get("unit") == "PC_GDP":
            assert fiche["unite"] == "percent", indicateur


def test_l_url_porte_les_filtres_de_la_serie():
    """Le contrat avec la source : ce que le module demande est ce qu'il croit
    demander."""
    url = eurostat.data_url("spr_exp_pens", europe.INDICATEURS["eurostat_retraites_pib"]["params"])
    for morceau in ("spdepb=TOTAL", "spdepm=TOTAL", "unit=PC_GDP", "freq=A"):
        assert morceau in url, url


def test_les_comptes_des_apu_sont_publies_en_euros_et_non_en_millions():
    """La source publie en millions ; le site publie en euros, comme la dette et
    le budget de l'État. Sans facteur, 1 503 590 s'afficherait « 1 503 590 € »
    au lieu de « 1 503,59 milliards d'euros » — une faute d'un facteur million
    sur un chiffre qui reste plausible."""
    apu = {i: f for i, f in europe.INDICATEURS.items() if i.startswith("eurostat_apu_")}
    assert len(apu) == 22, sorted(apu)
    for indicateur, fiche in apu.items():
        assert fiche["unite"] == "EUR", indicateur
        assert fiche.get("facteur") == europe.MILLION, indicateur
        assert fiche["params"]["unit"] == "MIO_EUR", indicateur


def test_la_decomposition_a_ses_deux_totaux():
    """Une part se calcule sur un total. Sans les recettes ET les dépenses, le
    site ne pourrait ni composer les 100 €, ni nommer le reste non détaillé."""
    for total in ("eurostat_apu_recettes", "eurostat_apu_depenses"):
        assert total in europe.INDICATEURS
    postes = [i for i in europe.INDICATEURS if i.startswith("eurostat_apu_")]
    # Deux totaux, trois recettes nommées, neuf dépenses nommées, et les huit
    # de la ventilation du premier poste.
    assert len(postes) - 2 == 20, postes


def test_le_secteur_est_filtre_sur_les_administrations_publiques():
    """Les deux jeux des APU publient aussi les sous-secteurs — État seul,
    collectivités, Sécurité sociale. Sans le filtre, chaque année reviendrait
    quatre fois et la dernière lue écraserait les autres."""
    for indicateur, fiche in europe.INDICATEURS.items():
        if fiche["jeu"] in ("gov_10a_main", "gov_10a_exp"):
            assert fiche["params"]["sector"] == "S13", indicateur


def test_la_ventilation_du_premier_poste_nomme_sa_transaction_et_sa_fonction():
    """Deux pièges du jeu par fonction, un test chacun.

    1. **La transaction ne s'y nomme pas pareil.** `gov_10a_main` écrit
       `D62PAY` ; `gov_10a_exp` écrit `D62`. Demander `D62PAY` à ce jeu-là rend
       **zéro valeur sans lever** — pas une erreur, pas un 404 : une série vide,
       donc un tableau qui se tait pour une raison qu'on ne voit pas.

    2. **Sans `cofog99`, la fonction n'est pas filtrée** et les quatre-vingts
       fonctions se rangent sous la même clé (pays, année) : la dernière lue
       écrase les autres, en silence.
    """
    ventilation = {
        i: f for i, f in europe.INDICATEURS.items() if f["jeu"] == "gov_10a_exp"
    }
    # Sept fonctions et leur total : sans cette borne, un test qui parcourt un
    # dictionnaire vide passerait au vert.
    assert len(ventilation) == 8, sorted(ventilation)
    fonctions = set()
    for indicateur, fiche in ventilation.items():
        assert fiche["params"]["na_item"] == "D62", indicateur
        cofog = fiche["params"].get("cofog99")
        assert cofog, f"{indicateur} : aucune fonction filtrée"
        assert cofog not in fonctions, f"{cofog} déclarée deux fois"
        fonctions.add(cofog)
    assert "TOTAL" in fonctions, "le dénominateur de la ventilation manque"
    # Les sept fonctions sont des sous-fonctions de la protection sociale, sauf
    # le total : une fonction de premier niveau (GF10) mêlée aux sous-fonctions
    # compterait deux fois la même dépense.
    assert all(len(f) == 6 for f in fonctions - {"TOTAL"}), sorted(fonctions)
