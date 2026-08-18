"""Les déciles avant et après redistribution : les trois pièges du jeu.

Le champ, la mesure et les croisements. Chacun, laissé ouvert, produit une
série qui a l'air juste : la bonne longueur, des montants plausibles, et des
valeurs qui viennent d'ailleurs — d'un zonage d'étude, d'une autre mesure, ou
d'une tranche d'âge.
"""

from pathlib import Path

import pytest

from plateforme import entrepot, registry
from plateforme.normalize import redistribution


def observation(mesure, periode, valeur, geo="2026-FRANCE-FM", **croisements):
    dimensions = {
        "GEO": geo,
        "ERFS_MEASURE": mesure,
        "TIME_PERIOD": periode,
        **{cle: croisements.get(cle, valeur_totale)
           for cle, valeur_totale in redistribution.TOTAUX.items()},
    }
    return {"dimensions": dimensions, "measures": {"OBS_VALUE_NIVEAU": {"value": valeur}}}


@pytest.fixture
def entrepot_neuf(tmp_path):
    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    registry.sync(conn)
    yield conn
    conn.close()


def test_le_cinquieme_decile_est_la_mediane_de_la_source():
    """L'INSEE ne publie pas de `D5_SL` : il publie `MED_SL`.

    Chercher `D5_SL` ne lèverait pas — la mesure serait simplement absente — et
    ferait un trou au milieu du tableau, à l'endroit où le lecteur se place
    lui-même.
    """
    assert redistribution.INDICATEURS["insee_niveau_vie_d5"]["mesure"] == "MED_SL"
    assert (
        redistribution.INDICATEURS["insee_niveau_vie_d5_avant_redistribution"]["mesure"]
        == "MED_SL_BR"
    )
    assert redistribution.INDICATEURS["insee_niveau_vie_d1"]["mesure"] == "D1_SL"
    assert (
        redistribution.INDICATEURS["insee_niveau_vie_d9_avant_redistribution"]["mesure"]
        == "D9_SL_BR"
    )


def test_les_dix_huit_deciles_et_les_deux_rapports_sont_declares():
    deciles = [i for i in redistribution.INDICATEURS if "niveau_vie_d" in i]
    assert len(deciles) == 18, deciles
    # Le compte des séries « avant » n'est pas figé : il grandit avec chaque
    # mesure dont la paire avant/après apprend quelque chose. Ce qui se vérifie
    # est donc l'APPARIEMENT — une série « avant » sans son « après » mesurerait
    # un état sans mesurer ce que la redistribution en fait, qui est le sujet.
    avant = [i for i in redistribution.INDICATEURS if i.endswith("_avant_redistribution")]
    assert len(avant) >= 10, avant
    for identifiant in avant:
        apres = identifiant.removesuffix("_avant_redistribution")
        assert apres in redistribution.INDICATEURS, f"{identifiant} n'a pas son après"


def test_un_autre_zonage_du_meme_jeu_n_entre_pas():
    """Melodi range plusieurs zonages dans un seul jeu. Sans le filtre de champ,
    une valeur régionale entrerait dans la série nationale."""
    lignes = redistribution.valeurs_nationales(
        [
            observation("D1_SL", "2024", 13970.0),
            observation("D1_SL", "2023", 9000.0, geo="2026-REG-75"),
        ],
        "D1_SL",
    )
    assert lignes == [("2024", 13970.0)]


def test_les_croisements_par_age_n_entrent_pas():
    """La médiane arrive soixante-dix-sept fois dans ce jeu — une par tranche
    d'âge et par statut d'emploi. Sans le filtre des totaux, la dernière lue
    écraserait la bonne, et la série resterait de la bonne longueur."""
    lignes = redistribution.valeurs_nationales(
        [
            observation("MED_SL", "2024", 33890.0),
            observation("MED_SL", "2024", 21000.0, AGE="Y_GE18"),
        ],
        "MED_SL",
    )
    assert lignes == [("2024", 33890.0)]


def test_une_autre_mesure_ne_se_glisse_pas_dans_la_serie():
    lignes = redistribution.valeurs_nationales(
        [
            observation("D1_SL", "2024", 13970.0),
            observation("D1_SL_BR", "2024", 9970.0),
        ],
        "D1_SL",
    )
    assert lignes == [("2024", 13970.0)]


def test_deux_valeurs_pour_un_exercice_levent_plutot_que_d_en_perdre_une():
    """C'est le piège du jeu **non** rétropolé, que ce module n'emploie pas :
    1996, 2010, 2012 et 2020 y portent deux valeurs, de part et d'autre d'une
    rupture de méthode. Si l'INSEE en ajoutait une au jeu rétropolé, la série
    cesserait d'être continue sans que rien ne le dise."""
    with pytest.raises(ValueError, match="deux valeurs"):
        redistribution.valeurs_nationales(
            [observation("D1_SL", "2020", 11000.0), observation("D1_SL", "2020", 11500.0)],
            "D1_SL",
        )


def test_une_mesure_non_diffusee_n_est_pas_un_zero():
    lignes = redistribution.valeurs_nationales(
        [
            {"dimensions": {"GEO": "2026-FRANCE-FM", "ERFS_MEASURE": "D1_SL",
                            "TIME_PERIOD": "2024", **redistribution.TOTAUX},
             "measures": {"OBS_VALUE_NIVEAU": {}}},
        ],
        "D1_SL",
    )
    assert lignes == []


def test_le_jeu_est_au_registre_des_sources(entrepot_neuf):
    seed = Path(redistribution.__file__).parents[3] / "infra/seed/dataset_registry.csv"
    assert f"\n{redistribution.DATASET}," in seed.read_text(encoding="utf-8")
    connu = entrepot_neuf.execute(
        "select count(*) from meta.dataset_registry where dataset_id = ?",
        (redistribution.DATASET,),
    ).fetchone()[0]
    assert connu == 1


def test_la_definition_nomme_le_champ_metropolitain(entrepot_neuf):
    """Une série nationale qui exclut deux millions de personnes sans le dire
    est une comparaison dont on ne contrôle pas le périmètre."""
    redistribution.declarer(entrepot_neuf)
    definitions = entrepot_neuf.execute(
        "select technical_definition from core.indicator_definitions"
    ).fetchall()
    assert definitions
    for (technique,) in definitions:
        assert "métropolitaine" in technique, technique


def test_un_gini_publie_ici_dit_ce_qui_le_separe_de_l_europeen():
    """Le refus d'origine est levé, et remplacé par ce qu'il protégeait.

    Il disait : « le site porte déjà un Gini européen, sur l'échelle 0-100
    d'EU-SILC et sur un autre champ ; deux indices du même nom se liraient comme
    un seul ». Le risque est réel et il n'a pas disparu. Ce qui a changé est la
    VALEUR de l'autre série : `eurostat_gini` ne mesure QU'APRÈS redistribution,
    donc il ne peut pas dire ce que la redistribution FAIT. La paire avant/après
    le dit, et c'est la seule mesure du jeu qui le dise en un nombre.

    Un refus général est donc remplacé par une obligation précise : tout Gini
    publié ici nomme son champ dans son libellé, et nomme la série européenne
    dans sa définition technique. Le lecteur qui croise les deux sait alors
    laquelle il lit — ce que le refus obtenait en n'en publiant qu'une.
    """
    ginis = {
        identifiant: fiche
        for identifiant, fiche in redistribution.INDICATEURS.items()
        if fiche["mesure"].startswith("GI_")
    }
    # Sans cette borne, la garde passerait au vert sur un dictionnaire vide le
    # jour où quelqu'un retirerait les deux séries.
    assert len(ginis) == 2, sorted(ginis)
    for identifiant, fiche in ginis.items():
        assert "métropolitaine" in fiche["libelle"], identifiant
        assert "eurostat_gini" in fiche["technique"], identifiant
        # L'échelle est dite, parce que c'est elle qui trompe : 0-1 ici, 0-100
        # là-bas. Un « 0,30 » et un « 30 » sont le même chiffre et ne se lisent
        # pas pareil.
        assert "0-1" in fiche["technique"], identifiant
        assert fiche["unite"] == "ratio", identifiant
    # Et la paire est complète : publier l'après sans l'avant redonnerait
    # exactement la série européenne, sans rien apprendre de plus.
    assert {f["mesure"] for f in ginis.values()} == {"GI_SL", "GI_SL_BR"}
