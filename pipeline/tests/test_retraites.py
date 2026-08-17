"""Les séries des retraités : les quatre pièges des classeurs de la DREES.

Un classeur republié chaque année déplace ses colonnes, transpose un onglet,
marque un millésime d'un appel de note et écrit « nd » là où la mesure n'existe
pas encore. Chacun de ces quatre cas produit, sans contrôle, une série de la
bonne longueur et du mauvais contenu — la faute la plus dure à voir.

Les grilles ci-dessous reproduisent la disposition réelle des onglets, valeurs
publiées comprises : elles sont copiées du classeur « fin 2022 ».
"""

from pathlib import Path

import pytest

from plateforme import entrepot, registry
from plateforme.normalize import retraites

# Onglet 1.1-a, tel qu'il est : trois lignes d'en-tête, douze colonnes, et les
# millésimes 2018 et 2020 marqués d'un appel de note.
EFFECTIFS = [
    (None, "Tableau 1.1-a : Nombre de retraités", None, None),
    (None, "(en milliers de personnes)", None, None),
    (None, "Ensemble", "Femmes", "Hommes"),
    ("2021", 17733.859, 9777.435, 7956.424),
    ("2022", 17889.187, 9884.319, 8004.868),
    ("Note > Des ruptures de série", None, None, None),
]

# Onglet 2.1-a : les colonnes utiles sont les huitième à onzième — droit direct
# y compris majoration, brute puis nette. Les quatre premières sont la même
# chose **hors** majoration, et se lisent pareil.
PENSIONS = [
    (None, "Tableau 2.1-a", None, None, None, None, None, None, None, None, None),
    (None, "hors majo", None, None, None, None, None, "y c. majo", None, None, None),
    (None, "brute", "brute", "brute", "nette", "nette", "nette", "brute", "brute",
     "brute", "nette"),
    ("2004", 1029, 730, 1338, "nd", "nd", "nd", 1066, 753, 1389, "nd"),
    ("2022", 1522, 1209, 1876, 1416, 1127, 1743, 1565, 1241, 1933, 1457),
]

# Onglet 3.1-b : **transposé**, une colonne par millésime.
AGES = [
    ("Tableau 3.1-b : Âge conjoncturel", None, None, None),
    (None, None, None, None),
    (None, "2020", "2021", "2022"),
    ("Ensemble", 62.36, 62.44, 62.68),
    ("Femmes", 62.68, 62.75, 63.0),
    ("Hommes", 62.03, 62.11, 62.33),
    ("Note > En général", None, None, None),
]

RATIO = [
    ("Nombre de pensionnés et nombre de cotisants", None, None, None, None, None),
    (None, None, None, None, None, None),
    (None, "Effectifs", None, "Emploi intérieur", "Rapport (France+étranger)",
     "Rapport (France)"),
    ("2015", 15980.4, 14872.5, 27525.5, 1.7224508904339328, 1.8507591660695268),
    ("2016", 16129.0, 15027.9, 27754.6, 1.7207910324685676, 1.8468757806043816),
]


@pytest.fixture
def entrepot_neuf(tmp_path):
    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    registry.sync(conn)
    yield conn
    conn.close()


def test_les_effectifs_sortent_en_personnes_pas_en_milliers():
    """Le classeur compte en milliers. Publier 17 889 retraités au lieu de
    17,9 millions est une faute d'un facteur mille, et elle a l'air d'un
    nombre plausible : c'est ce qui la rend dangereuse."""
    series = retraites.effectifs(EFFECTIFS)
    assert series["drees_retraites_effectif"]["2022"] == 17_889_187
    assert series["drees_retraites_effectif_femmes"]["2022"] == 9_884_319


def test_un_millesime_marque_d_un_appel_de_note_reste_un_millesime():
    """« 2018 1 » et « 2020 2 » sont des années suivies d'un renvoi. Lues
    telles quelles, elles feraient deux périodes fantômes et perdraient deux
    exercices de la série."""
    marque = [*EFFECTIFS[:3], ("2020 2", 17641.294, 9704.787, 7936.507)]
    series = retraites.effectifs(marque)
    assert list(series["drees_retraites_effectif"]) == ["2020"]


def test_une_colonne_deplacee_fait_tomber_le_chargement():
    """Le contrôle d'identité : femmes + hommes = ensemble. Sans lui, une
    colonne de plus dans une édition suivante publierait les retraités de droit
    dérivé sous l'intitulé de l'ensemble, et rien ne le dirait."""
    decale = [*EFFECTIFS[:3], ("2022", 17889.187, 9884.319, 4375.560)]
    with pytest.raises(ValueError, match="colonnes déplacées"):
        retraites.effectifs(decale)


def test_les_pensions_prennent_la_colonne_qui_comprend_la_majoration():
    """Deux blocs de colonnes disent « pension moyenne brute » dans le même
    onglet : hors majoration pour trois enfants (1 522 € en 2022) et y compris
    (1 565 €). C'est le second que la DREES met en avant, et l'écart de 43 €
    passerait inaperçu."""
    series = retraites.pensions(PENSIONS)
    assert series["drees_pension_moyenne_brute"]["2022"] == 1565
    assert series["drees_pension_moyenne_brute_femmes"]["2022"] == 1241
    assert series["drees_pension_moyenne_brute_hommes"]["2022"] == 1933
    assert series["drees_pension_moyenne_nette"]["2022"] == 1457


def test_une_pension_non_diffusee_n_est_pas_un_zero():
    """La pension nette n'est publiée qu'à partir de 2008 : « nd » avant. Un
    zéro y inventerait un effondrement suivi d'un quadruplement."""
    series = retraites.pensions(PENSIONS)
    assert "2004" not in series["drees_pension_moyenne_nette"]
    assert series["drees_pension_moyenne_brute"]["2004"] == 1066


def test_l_ordre_des_pensions_par_sexe_garde_les_colonnes_en_place():
    faussee = [*PENSIONS[:3], ("2022", 1522, 1209, 1876, 1416, 1127, 1743, 1565, 1933, 1241, 1457)]
    with pytest.raises(ValueError, match="ne s'ordonnent pas"):
        retraites.pensions(faussee)


def test_l_onglet_des_ages_est_transpose():
    """Une colonne par millésime, une ligne par sexe. Lu comme les autres, il
    rendrait zéro ligne — sans erreur, donc sans que rien ne le signale."""
    series = retraites.ages(AGES)
    assert series["drees_age_depart"]["2022"] == 62.68
    assert series["drees_age_depart_femmes"]["2022"] == 63.0
    assert list(series["drees_age_depart_hommes"]) == ["2020", "2021", "2022"]


def test_une_valeur_qui_n_est_pas_un_age_fait_tomber_le_chargement():
    faussee = [*AGES[:3], ("Ensemble", 62.36, 62.44, 1565.0)]
    with pytest.raises(ValueError, match="n'est pas un âge"):
        retraites.ages(faussee)


def test_le_rapport_cotisants_prend_le_champ_des_effectifs_publies():
    """Deux colonnes de rapport : France seule (1,85) et France et étranger
    (1,72). C'est la seconde qui correspond au périmètre des effectifs publiés
    à côté ; prendre l'autre ferait deux chiffres qui ne parlent pas du même
    ensemble sur la même page."""
    series = retraites.cotisants(RATIO)
    assert series["drees_cotisants_par_retraite"]["2016"] == 1.721


def test_un_rapport_invraisemblable_fait_tomber_le_chargement():
    faussee = [*RATIO[:3], ("2016", 16129.0, 15027.9, 27754.6, 27754.6, 1.84)]
    with pytest.raises(ValueError, match="rapport plausible"):
        retraites.cotisants(faussee)


def test_le_jeu_est_au_registre_et_les_fiches_se_declarent(entrepot_neuf):
    seed = Path(retraites.__file__).parents[3] / "infra/seed/dataset_registry.csv"
    assert f"\n{retraites.DATASET}," in seed.read_text(encoding="utf-8")
    retraites.declarer(entrepot_neuf)
    publies = {
        identifiant
        for (identifiant,) in entrepot_neuf.execute(
            "select indicator_id from core.indicators where published"
            " and dataset_id in (select dataset_id from meta.dataset_registry)"
        ).fetchall()
    }
    assert set(retraites.INDICATEURS) <= publies, set(retraites.INDICATEURS) - publies


def test_aucune_serie_n_est_declaree_sommable(entrepot_neuf):
    """Une pension moyenne, un âge et un rapport ne s'additionnent pas d'un
    territoire à l'autre — et un effectif national n'a personne à qui
    s'additionner. Déclaré sommable, l'un d'eux se retrouverait divisé par la
    population dans une carte."""
    retraites.declarer(entrepot_neuf)
    sommables = entrepot_neuf.execute(
        "select indicator_id from core.indicators where additive and indicator_id like 'drees_%'"
    ).fetchall()
    assert sommables == []
