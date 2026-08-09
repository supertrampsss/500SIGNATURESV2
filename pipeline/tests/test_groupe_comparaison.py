"""Le groupe de comparaison : ce qui se divise par la population, et le reste.

Le 5 août, les quartiles publiés du niveau de vie médian donnaient « médiane
31,76 € » pour les communes rurales de trois à cinq mille habitants : un niveau
de vie médian divisé par un nombre d'habitants. La règle était l'unité —
`unit = 'EUR'` — et elle laissait entrer une médiane tout en écartant le
logement vacant, le chômage et les diplômes, c'est-à-dire les questions où le
repère manque le plus.

C'est l'additivité qui tranche, pas l'unité.
"""

import pytest

from plateforme import entrepot, publish, registry
from plateforme.normalize.geo import MILLESIME

# Vingt-cinq communes de la même strate : le calcul en exige vingt.
COMMUNES = [(f"330{n:02d}", f"Commune {n}", 3000 + n * 10) for n in range(25)]


@pytest.fixture
def entrepot_peuple(tmp_path):
    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    registry.sync(conn)
    conn.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code, flags) values ('pays', 'FR', ?, 'France',"
        " null, null, '{}')",
        (MILLESIME,),
    )
    for code, nom, _ in COMMUNES:
        conn.execute(
            "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
            " parent_level, parent_code, flags) values ('commune', ?, ?, ?, 'pays',"
            " 'FR', ?)",
            (code, MILLESIME, nom,
             '{"tranche_population": "3", "rural": "Oui", "outre_mer": "Non"}'),
        )
    conn.execute(
        "insert into core.indicator_definitions (definition_id, public_definition,"
        " confidence_level)"
        " values (1, 'x', 'observed')"
    )
    for identifiant, unite, additif, jeu in (
        ("ofgl_population_reference", "count", True, "ofgl-communes"),
        ("depense", "EUR", True, "ofgl-communes"),
        ("niveau_de_vie", "EUR", False, "ofgl-communes"),
        ("logements_vacants", "count", True, "ofgl-communes"),
        ("taux_de_pauvrete", "percent", False, "ofgl-communes"),
        # Un effectif compté au lieu de travail : additif comme les logements
        # vacants, mais sans les résidents pour dénominateur.
        ("postes_salaries", "count", True, "melodi-flores-a5"),
    ):
        conn.execute(
            "insert into core.indicators (indicator_id, dataset_id, definition_id,"
            " theme, label_fr, unit, additive, geo_levels, time_granularity, published)"
            " values (?, ?, 1, 't', ?, ?, ?, array['commune'],"
            " 'annuelle', true)",
            (identifiant, jeu, identifiant, unite, additif),
        )
    run_id = entrepot.start_run(conn, "ofgl-communes", "manual")
    for rang, (code, _, habitants) in enumerate(COMMUNES):
        for identifiant, valeur in (
            ("ofgl_population_reference", habitants),
            ("depense", habitants * (500 + rang)),
            ("niveau_de_vie", 20000 + rang * 100),
            ("logements_vacants", 100 + rang),
            ("taux_de_pauvrete", 10 + rang * 0.1),
            ("postes_salaries", 2000 + rang * 100),
        ):
            conn.execute(
                "insert into core.observations (indicator_id, geo_level, geo_code,"
                " geo_vintage, period, value, run_id) values (?, 'commune', ?, ?,"
                " '2023', ?, ?)",
                (identifiant, code, MILLESIME, valeur, run_id),
            )
    conn.commit()
    yield conn
    conn.close()


def test_une_mediane_n_est_pas_divisee_par_la_population(entrepot_peuple):
    """Le défaut du 5 août. Un niveau de vie médian de vingt mille euros divisé
    par trois mille habitants donnait sept euros, publiés comme repère."""
    sortie = publish.comparaisons(entrepot_peuple)
    groupe = "1:3|Oui|Non"
    quartiles = sortie["groupes"]["niveau_de_vie"]["2023"][groupe]
    assert 20000 <= quartiles["mediane"] <= 22400, quartiles
    assert sortie["bases"]["niveau_de_vie"]["base"] == "valeur"


def test_un_montant_additif_reste_ramene_par_habitant(entrepot_peuple):
    """La dépense d'une commune de trois mille habitants et celle d'une de cinq
    mille ne se comparent qu'à l'habitant."""
    sortie = publish.comparaisons(entrepot_peuple)
    quartiles = sortie["groupes"]["depense"]["2023"]["1:3|Oui|Non"]
    assert 500 <= quartiles["mediane"] <= 525, quartiles
    assert sortie["bases"]["depense"]["base"] == "par_habitant"


def test_les_effectifs_ont_desormais_un_groupe(entrepot_peuple):
    """C'est le manque que la règle précédente créait : « ma commune a-t-elle
    beaucoup de logements vacants ? » n'avait pas de repère, parce que les
    logements ne sont pas des euros."""
    sortie = publish.comparaisons(entrepot_peuple)
    assert "logements_vacants" in sortie["groupes"]
    # Un effectif se rapporte à mille habitants, pas à un seul : « 36 logements
    # vacants pour mille habitants » se lit, « 0,036 par habitant » ne se lit pas.
    assert sortie["bases"]["logements_vacants"]["base"] == "pour_mille"
    quartiles = sortie["groupes"]["logements_vacants"]["2023"]["1:3|Oui|Non"]
    assert 30 <= quartiles["mediane"] <= 40, quartiles


def test_un_taux_se_compare_tel_qu_il_est_publie(entrepot_peuple):
    """Diviser un taux de pauvreté par la population donnerait un nombre sans
    nom. Il se compare tel quel, et sa base le dit."""
    sortie = publish.comparaisons(entrepot_peuple)
    assert sortie["bases"]["taux_de_pauvrete"] == {"base": "valeur", "unite": "percent"}
    quartiles = sortie["groupes"]["taux_de_pauvrete"]["2023"]["1:3|Oui|Non"]
    assert 11.0 <= quartiles["mediane"] <= 11.5, quartiles


def test_un_effectif_au_lieu_de_travail_ne_se_divise_pas_par_les_residents(entrepot_peuple):
    """Un poste salarié est là où l'on travaille, pas là où l'on dort. Le
    rapporter aux habitants de la commune mesurerait la distance
    domicile-travail en la présentant comme une intensité d'emploi — et une
    commune de bureaux afficherait plus de postes que d'habitants.

    Il reste additif : c'est le dénominateur qui n'existe pas, pas l'additivité.
    """
    sortie = publish.comparaisons(entrepot_peuple)
    assert sortie["bases"]["postes_salaries"]["base"] == "valeur"
    quartiles = sortie["groupes"]["postes_salaries"]["2023"]["1:3|Oui|Non"]
    # La médiane est celle des valeurs brutes — 2 000 à 4 400 postes —, pas
    # celle des postes pour mille habitants, qui vaudrait autour de 700.
    assert 3000 <= quartiles["mediane"] <= 3400, quartiles


def test_les_deux_expressions_de_la_regle_disent_la_meme_chose(entrepot_peuple):
    """La base est décidée deux fois : en SQL pour calculer les quartiles, en
    Python pour les étiqueter. Si elles divergeaient, les nombres seraient
    calculés sur une base et formatés sur une autre — sans que rien n'échoue."""
    sortie = publish.comparaisons(entrepot_peuple)
    attendus = {
        "depense": "par_habitant",
        "logements_vacants": "pour_mille",
        "niveau_de_vie": "valeur",
        "postes_salaries": "valeur",
        "taux_de_pauvrete": "valeur",
    }
    for identifiant, base in attendus.items():
        assert sortie["bases"][identifiant]["base"] == base, identifiant
    # Le SQL a bien appliqué la même règle : une base « valeur » laisse des
    # quartiles à l'échelle des valeurs publiées, pas divisés par trois mille.
    assert sortie["groupes"]["postes_salaries"]["2023"]["1:3|Oui|Non"]["mediane"] > 1000


def test_chaque_indicateur_du_groupe_declare_sa_base(entrepot_peuple):
    """Sans la base, l'affichage ne peut pas formater les quartiles sans se
    tromper d'unité — c'est ainsi qu'un taux s'afficherait en euros."""
    sortie = publish.comparaisons(entrepot_peuple)
    assert set(sortie["groupes"]) <= set(sortie["bases"])
    for identifiant, base in sortie["bases"].items():
        assert base["base"] in ("par_habitant", "pour_mille", "valeur"), identifiant
        assert base["unite"], identifiant


def test_les_departements_ont_aussi_un_groupe(tmp_path):
    """« Où se situe ce territoire » n'existait qu'à la maille commune.

    Un département ne ressemble pas à un autre par sa tranche de population :
    il n'y a pas de strate à définir. Mais il y a un ensemble — les cent un
    départements —, et la moitié d'entre eux sont en dessous d'une médiane.
    Sans cette ligne, la fiche d'un département était une fiche amputée d'une
    de ses questions, quand la règle du projet dit l'inverse : ce que porte la
    vue commune, les autres mailles le portent aussi.
    """
    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    registry.sync(conn)
    conn.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code, flags) values ('pays', 'FR', ?, 'France',"
        " null, null, '{}')",
        (MILLESIME,),
    )
    conn.execute(
        "insert into core.indicator_definitions (definition_id, public_definition,"
        " confidence_level) values (1, 'x', 'observed')"
    )
    for identifiant, unite, additif in (
        ("ofgl_population_reference", "count", True),
        ("depense", "EUR", True),
    ):
        conn.execute(
            "insert into core.indicators (indicator_id, dataset_id, definition_id,"
            " theme, label_fr, unit, additive, published) values (?, 'ofgl-departements',"
            " 1, 'finances_locales', ?, ?, ?, true)",
            (identifiant, identifiant, unite, additif),
        )
    run = entrepot.start_run(conn, "ofgl-departements", "manual")
    for n in range(25):
        code = f"{n + 10:02d}"
        conn.execute(
            "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
            " parent_level, parent_code, flags) values ('departement', ?, ?, ?,"
            " 'pays', 'FR', '{}')",
            (code, MILLESIME, f"Département {code}"),
        )
        for identifiant, valeur in (
            ("ofgl_population_reference", 100_000.0),
            ("depense", 100_000.0 * (100 + n)),
        ):
            conn.execute(
                "insert into core.observations (indicator_id, geo_level, geo_code,"
                " geo_vintage, period, value, run_id) values (?, 'departement', ?, ?,"
                " '2025', ?, ?)",
                (identifiant, code, MILLESIME, valeur, run),
            )
    entrepot.finish_run(conn, run, "success")
    conn.commit()

    sortie = publish.comparaisons(conn)
    groupe = sortie["groupes"]["depense"]["2025"]["departement:tous"]
    assert groupe["n"] == 25
    # Les dépenses vont de 100 à 124 € par habitant : la médiane est à 112.
    assert groupe["mediane"] == 112.0
    # Et le groupe s'appelle « tous » : il n'y a pas de critère à afficher, et
    # en inventer un ferait passer un ensemble pour une strate.
    assert all(":" in cle for cle in sortie["groupes"]["depense"]["2025"])
    conn.close()


def test_dix_huit_regions_suffisent_a_faire_un_ensemble():
    """Le seuil des strates ne s'applique pas à une maille entière.

    Vingt communes tirées d'une strate sont un échantillon, et un quartile
    calculé sur moins que ça n'apprend rien. Les dix-huit régions, elles, sont
    **toutes** les régions : leur médiane est un fait. Le seuil commun les
    écartait, et la fiche d'une région restait la seule sans groupe.
    """
    assert publish.MAILLE_MINIMALE < 18 <= publish.GROUPE_MINIMAL
