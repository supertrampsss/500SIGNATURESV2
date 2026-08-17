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
