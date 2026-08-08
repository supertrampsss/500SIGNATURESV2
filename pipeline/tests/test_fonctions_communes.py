"""À quoi sert l'argent d'une commune, et ce qui rend la série lisible.

Deux fixtures, réelles et gardées entières : `dgfip_balances_fonction_33_2020_sample.csv`
et `..._33_2021_sample.csv` sont les exports agrégés du grand livre de la DGFiP
pour la Gironde, exercices 2020 et 2021, téléchargés le 8 août 2026 avec la
requête exacte du module (80 Ko chacun, aucun octet fabriqué). Les cinq autres
exercices chargés en production pèseraient chacun autant par département : la
logique multi-exercices est testée sur ces deux-là et sur les témoins France
relevés à la main (`SERIE_FRANCE`).

**Ces deux exercices-là parce que Bordeaux bascule entre eux.** La commune passe
de la nomenclature M14 (2020) à M57 (2021), et M57 renumérote les fonctions. Sur
la tête de fonction brute — ce que le module publiait — la « culture » de
Bordeaux passe de 61,3 à 94,0 M€ (+53 %) et sa « famille » de 42,5 à 4,1 M€
(−90 %) sans qu'un euro ait changé de destination. Sur la grille commune aux
deux nomenclatures, le même poste culture-sport fait 94,35 puis 93,97 M€
(−0,4 %). Les fixtures portent cette bascule : c'est le seul témoin qui distingue
une lecture juste d'une lecture qui invente une politique publique.

Témoins relevés à la main sur le grand livre : Bordeaux (33063), poste
culture-sport, 94 350 537,13 € en 2020 et 93 969 537,80 € en 2021. Et 385,9 M€
de charges de classe 6 pour Bordeaux 2023 quand l'OFGL en publie 353,7 : les
sept lignes doivent redonner exactement l'agrégat que le site publie déjà,
l'écart compris et nommé.
"""

import csv
import io
from collections import Counter
from pathlib import Path

import pytest

from plateforme.normalize import fonctions_communes as f

FIXTURES = Path(__file__).parent / "fixtures"

# Le total France du grand livre par poste et par exercice, relevé le 8 août
# 2026 sur les sept exercices (communes, budget principal, classe 6) : la série
# que le contrôle de continuité doit accepter telle quelle. Plus forte variation
# du total +5,74 % (2021→2022) ; du poste le plus mobile +8,23 %
# (culture-sport, 2021→2022).
SERIE_FRANCE = {
    "2019": {"fonction_commune_services_generaux": 23_140_385_075.99,
             "fonction_commune_securite": 2_228_053_355.93,
             "fonction_commune_enseignement": 7_869_817_839.97,
             "fonction_commune_culture_sport": 9_175_376_180.87,
             "fonction_commune_social_famille": 5_180_292_717.40,
             "fonction_commune_amenagement_economie": 8_948_960_637.52},
    "2020": {"fonction_commune_services_generaux": 22_743_630_217.91,
             "fonction_commune_securite": 2_322_373_441.39,
             "fonction_commune_enseignement": 7_668_542_077.80,
             "fonction_commune_culture_sport": 8_718_729_392.95,
             "fonction_commune_social_famille": 5_241_463_970.77,
             "fonction_commune_amenagement_economie": 8_855_664_842.83},
    "2021": {"fonction_commune_services_generaux": 23_263_988_801.25,
             "fonction_commune_securite": 2_372_850_869.34,
             "fonction_commune_enseignement": 8_284_046_726.14,
             "fonction_commune_culture_sport": 9_029_432_106.11,
             "fonction_commune_social_famille": 5_339_082_540.81,
             "fonction_commune_amenagement_economie": 8_805_254_972.34},
    "2022": {"fonction_commune_services_generaux": 24_731_298_526.26,
             "fonction_commune_securite": 2_500_226_760.31,
             "fonction_commune_enseignement": 8_788_531_927.39,
             "fonction_commune_culture_sport": 9_772_346_889.70,
             "fonction_commune_social_famille": 5_576_841_412.46,
             "fonction_commune_amenagement_economie": 9_004_936_290.59},
    "2023": {"fonction_commune_services_generaux": 26_191_197_780.31,
             "fonction_commune_securite": 2_641_073_766.95,
             "fonction_commune_enseignement": 9_353_970_749.86,
             "fonction_commune_culture_sport": 10_285_741_795.41,
             "fonction_commune_social_famille": 5_759_693_603.70,
             "fonction_commune_amenagement_economie": 9_357_088_732.68},
    "2024": {"fonction_commune_services_generaux": 27_236_133_481.79,
             "fonction_commune_securite": 2_792_162_047.36,
             "fonction_commune_enseignement": 9_724_534_190.05,
             "fonction_commune_culture_sport": 10_580_228_951.92,
             "fonction_commune_social_famille": 5_866_429_709.98,
             "fonction_commune_amenagement_economie": 9_608_741_462.00},
    "2025": {"fonction_commune_services_generaux": 27_790_917_660.20,
             "fonction_commune_securite": 2_897_700_222.27,
             "fonction_commune_enseignement": 9_790_062_282.79,
             "fonction_commune_culture_sport": 10_786_281_161.48,
             "fonction_commune_social_famille": 5_979_723_154.23,
             "fonction_commune_amenagement_economie": 9_800_849_718.06},
}

# Un export fabriqué, réduit à ce qu'il faut pour montrer la lecture : la même
# tête de fonction 4 va au sport en M14 et au social en M57.
EXPORT = (
    b"ndept;insee;nomen;fonction;debit\n"
    b"033;063;M57;020;118600000\n"
    b"033;063;M57;01;0\n"
    b"033;063;M57;311;100100000\n"
    b"033;063;M57;4221;167175349.4\n"
    b"02A;247;M14;020;1000000\n"
    b"101;101;M14;020;2000000\n"
)


@pytest.fixture(scope="module")
def gironde() -> dict[str, dict[str, dict[str, float]]]:
    """{exercice: {commune: {poste: montant}}} depuis les vraies fixtures."""
    return {
        exercice: f.par_commune(
            f.lire((FIXTURES / f"dgfip_balances_fonction_33_{exercice}_sample.csv").read_bytes())
        )
        for exercice in ("2020", "2021")
    }


def _tetes_brutes(exercice: str, insee: str) -> dict[str, float]:
    """Ce que la lecture par tête de fonction brute aurait donné, pour comparer."""
    contenu = (FIXTURES / f"dgfip_balances_fonction_33_{exercice}_sample.csv").read_bytes()
    tetes: Counter = Counter()
    for rangee in csv.DictReader(io.StringIO(contenu.decode("utf-8-sig")), delimiter=";"):
        if rangee["insee"].strip() != insee:
            continue
        fonction = rangee["fonction"].strip()
        tetes[fonction[0] if fonction else "0"] += float(rangee["debit"] or 0)
    return dict(tetes)


def test_le_code_insee_se_reconstruit_pour_la_corse_et_l_outre_mer():
    """Le département de la DGFiP est cadré sur trois caractères par un zéro de
    tête, que la Corse n'a pas et que l'outre-mer remplace par un code à lui."""
    assert f.code_insee("033", "063") == "33063"
    assert f.code_insee("001", "004") == "01004"
    assert f.code_insee("02A", "247") == "2A247"
    # 101 est le code DGFiP de la Guadeloupe ; le code officiel dit 971.
    assert f.code_insee("101", "101") == "97101"
    assert f.code_insee("033", "63") is None


def test_la_grille_couvre_les_dix_tetes_de_chaque_nomenclature():
    """Chaque tête de 0 à 9 va dans un poste et un seul, dans les deux
    nomenclatures. Une tête oubliée serait rangée aux services généraux par
    défaut de lecture, sans que rien ne le dise."""
    for nomenclature, grille in f.GRILLE.items():
        assert sorted(grille) == list("0123456789"), nomenclature
        assert set(grille.values()) == set(f.POSTES), nomenclature
    # M14 découpe en dix, M57 en dix aussi, mais pas aux mêmes endroits : c'est
    # exactement ce qui rend la tête brute illisible en série.
    assert f.GRILLE["M14"]["4"] == "fonction_commune_culture_sport"
    assert f.GRILLE["M57"]["4"] == "fonction_commune_social_famille"
    assert f.GRILLE["M14"]["8"] == "fonction_commune_amenagement_economie"
    assert f.GRILLE["M57"]["8"] == "fonction_commune_amenagement_economie"


def test_les_nomenclatures_abregees_suivent_leur_famille_les_autres_arretent():
    """M14A et M57A sont les versions abrégées et partagent la fonctionnelle de
    leur famille. Un référentiel inconnu ne se devine pas : il renumérote."""
    assert f.famille("M14") == "M14"
    assert f.famille("M14A") == "M14"
    assert f.famille("M57A") == "M57"
    with pytest.raises(f.SerieIncomparable, match="inconnue"):
        f.famille("M4")
    with pytest.raises(f.SerieIncomparable, match="inconnue"):
        f.famille("")


def test_la_tete_de_fonction_se_lit_avec_la_nomenclature_de_sa_ligne():
    bordeaux = f.par_commune(f.lire(EXPORT))["33063"]
    # 020 et 01 tombent tous deux dans les services généraux.
    assert bordeaux["fonction_commune_services_generaux"] == 118_600_000
    # 311 : culture en M14 comme en M57.
    assert bordeaux["fonction_commune_culture_sport"] == 100_100_000
    # 4221 en M57 : santé et action sociale. La même tête en M14 serait du sport.
    assert bordeaux["fonction_commune_social_famille"] == 167_175_349.4
    en_m14 = EXPORT.replace(b"M57;4221", b"M14;4221")
    assert f.par_commune(f.lire(en_m14))["33063"]["fonction_commune_culture_sport"] == (
        100_100_000 + 167_175_349.4
    )


def test_une_fonction_inconnue_ne_disparait_pas():
    """Les écarter ferait manquer la somme au contrôle, et les compter ailleurs
    inventerait une destination que la source ne donne pas."""
    lignes = f.lire(
        b"ndept;insee;nomen;fonction;debit\n033;063;M14;;5000\n033;063;M14;ZZ;3000\n"
    )
    assert f.par_commune(lignes)["33063"]["fonction_commune_services_generaux"] == 8000


def test_la_fixture_reelle_porte_les_temoins_de_ses_deux_exercices(gironde):
    """Les deux témoins relevés à la main, à l'euro près, sur les vrais octets."""
    assert len(gironde["2020"]) == 76
    assert len(gironde["2021"]) == 76
    for exercice in ("2020", "2021"):
        lu = f.controler_temoin(exercice, gironde[exercice])
        assert abs(lu - f.TEMOINS[exercice]) < 0.01, exercice
    # Un exercice dont le témoin n'est pas relevé n'est pas contrôlé ici ; un
    # exercice dont le témoin ne tombe pas arrête tout.
    assert f.controler_temoin("2012", gironde["2020"]) is None
    fausse = {**gironde["2020"], "33063": {"fonction_commune_culture_sport": 1.0}}
    with pytest.raises(f.SerieIncomparable, match="témoin relevé à la main"):
        f.controler_temoin("2020", fausse)


def test_bordeaux_change_de_nomenclature_sans_changer_de_dépense(gironde):
    """La preuve, sur les vraies données : entre 2020 et 2021 Bordeaux passe de
    M14 à M57. Lue par tête brute, sa culture bondit de 53 % et sa famille perd
    90 % ; lue sur la grille, le poste culture-sport ne bouge que de 0,4 %.
    C'est ce test qui sépare une série d'une illusion."""
    brut_2020, brut_2021 = _tetes_brutes("2020", "063"), _tetes_brutes("2021", "063")
    assert brut_2021["3"] / brut_2020["3"] > 1.5, "la tête 3 brute explose"
    assert brut_2021["6"] / brut_2020["6"] < 0.15, "la tête 6 brute s'effondre"

    grille_2020 = gironde["2020"]["33063"]
    grille_2021 = gironde["2021"]["33063"]
    for poste in f.POSTES:
        variation = abs(grille_2021[poste] - grille_2020[poste]) / grille_2020[poste]
        assert variation < f.SEUIL_SERIE_POSTE, poste
    culture = grille_2021["fonction_commune_culture_sport"]
    assert abs(culture / grille_2020["fonction_commune_culture_sport"] - 1) < 0.01


def test_les_sept_lignes_redonnent_l_agregat_de_l_ofgl():
    totaux = f.par_commune(f.lire(EXPORT))
    ofgl = {"33063": 353_700_000.0}
    sorties = f.candidates(totaux, ofgl, "2023")
    # Trois postes servis plus le résidu : les postes absents ne sont pas écrits
    # à zéro, ce qui inventerait une dépense nulle.
    bordeaux = [s for s in sorties if s[2] == "33063"]
    assert len(bordeaux) == 4
    assert {s[3] for s in bordeaux} == {"2023"}
    assert round(sum(valeur for *_r, valeur in bordeaux), 2) == 353_700_000.0
    residu = [s for s in bordeaux if s[0] == f.RESIDU][0]
    # Le grand livre est plus large que l'agrégat : le résidu retranche.
    assert residu[4] < 0
    f.controler(bordeaux, ofgl)


def test_une_commune_sans_agregat_de_reference_n_est_pas_ecrite():
    """Sans lui, le résidu ne se calcule pas, et publier des postes dont la
    somme ne correspond à aucun total du site donnerait un second jeu de
    chiffres sur les mêmes lignes."""
    totaux = f.par_commune(f.lire(EXPORT))
    sorties = f.candidates(totaux, {"33063": 353_700_000.0}, "2023")
    assert not [s for s in sorties if s[2] in ("2A247", "97101")]


def test_le_controle_refuse_une_decomposition_qui_ne_boucle_pas():
    ofgl = {"33063": 353_700_000.0}
    fausses = [("fonction_commune_culture_sport", "commune", "33063", "2023", 1000.0)]
    with pytest.raises(ValueError, match="ne redonne pas l'agrégat"):
        f.controler(fausses, ofgl)


def test_la_serie_se_tient_sans_trou_ni_saut():
    """Les sept totaux France relevés à la main passent tels quels. Chaque
    contrôle par exercice compare un exercice à lui-même : un exercice lu avec
    la nomenclature de l'autre année les passerait tous. Seule la série le
    voit — et à deux endroits, le total France qui ne dépend pas de la
    nomenclature, chaque poste qui n'en dépend que d'elle."""
    continuite = f.controler_serie(SERIE_FRANCE)
    assert continuite["exercices"] == ["2019", "2020", "2021", "2022", "2023", "2024", "2025"]
    assert continuite["entre"] == "2021 -> 2022"
    assert 0.057 < continuite["variation_maximale_total"] < 0.058
    assert continuite["poste_le_plus_mobile"] == "fonction_commune_culture_sport"
    assert 0.082 < continuite["variation_maximale_poste"] < 0.083
    assert f.controler_serie({"2025": SERIE_FRANCE["2025"]})["exercices"] == ["2025"]

    troue = {e: v for e, v in SERIE_FRANCE.items() if e != "2022"}
    with pytest.raises(f.SerieIncomparable, match="trou dans la série"):
        f.controler_serie(troue)


def test_la_serie_refuse_un_exercice_lu_avec_la_mauvaise_nomenclature():
    """Le cas réel : la grille oubliée sur le dernier exercice. Le total France
    ne bouge pas d'un euro — il ne dépend pas de la nomenclature — et c'est le
    contrôle par poste qui arrête."""
    # 2025 est à 99,9 % en M57 : lu comme du M14, la tête 4 (santé et action
    # sociale) irait au sport et la tête 8 (transports) à l'aménagement.
    de_travers = dict(SERIE_FRANCE)
    juste = SERIE_FRANCE["2025"]
    deplace = juste["fonction_commune_social_famille"]
    de_travers["2025"] = {
        **juste,
        "fonction_commune_culture_sport": juste["fonction_commune_culture_sport"] + deplace,
        "fonction_commune_social_famille": 1.0,
    }
    assert round(sum(de_travers["2025"].values())) == round(sum(juste.values()) + 1)
    with pytest.raises(f.SerieIncomparable, match="nomenclature de l'autre année"):
        f.controler_serie(de_travers)
    # Un changement de champ, lui, se voit sur le total : Paris qui sort du
    # champ en 2019 valait −6,97 % sur l'exercice précédent.
    ampute = {**SERIE_FRANCE, "2019": {
        poste: valeur * 0.8 for poste, valeur in SERIE_FRANCE["2019"].items()
    }}
    with pytest.raises(f.SerieIncomparable, match="le champ a changé"):
        f.controler_serie(ampute)


def _semer_agregat(conn, exercices, communes) -> str:
    """L'agrégat de référence du site, exercice par exercice, comme en production."""
    from plateforme import entrepot
    from plateforme.normalize.geo import MILLESIME

    run_ofgl = entrepot.start_run(conn, "ofgl-communes", "manual")
    conn.execute(
        """
        insert into core.indicator_definitions
            (public_definition, technical_definition, formula, unit_notes,
             confidence_level, badges)
        values ('Dépenses de fonctionnement', 'OFGL', 'OFGL', 'euros', 'observed',
                array['Officiel'])
        """
    )
    conn.execute(
        """
        insert or ignore into core.indicators
            (indicator_id, dataset_id, definition_id, theme, label_fr, unit, additive,
             geo_levels, time_granularity, published)
        select ?, 'ofgl-communes', max(definition_id), 'finances_locales',
               'Dépenses de fonctionnement', 'EUR', true, array['commune'],
               'annuelle', true
          from core.indicator_definitions
        """,
        (f.PARENT,),
    )
    for exercice in exercices:
        for code, valeur in communes.items():
            conn.execute(
                "insert into core.observations (indicator_id, geo_level, geo_code,"
                " geo_vintage, period, value, run_id) values (?, 'commune', ?, ?, ?, ?, ?)",
                (f.PARENT, code, MILLESIME, exercice, valeur, run_ofgl),
            )
    conn.commit()
    return run_ofgl


def test_les_exercices_charges_sont_ceux_qui_ont_un_agregat_de_reference(entrepot_seme):
    """Un exercice sans l'agrégat du site n'écrirait aucune commune : le
    télécharger serait payer un export pour le jeter. L'intersection est faite
    avant de charger."""
    assert f.exercices_publiables(entrepot_seme) == []
    _semer_agregat(entrepot_seme, ("2021", "2022", "2023"), {"33063": 353_700_000.0})
    # 2012 n'est pas dans JEUX : un exercice que la source ne publie pas sous
    # cette forme ne devient pas chargeable parce que l'OFGL le connaît.
    _semer_agregat(entrepot_seme, ("2012",), {"33063": 1.0})
    assert f.exercices_publiables(entrepot_seme) == ["2021", "2022", "2023"]


def test_une_fiche_publique_tient_en_cinquante_mots(entrepot_seme):
    """La contrainte est celle du schéma, et elle a raison.

    Les réserves — imputation comptable, seuil de 3 500 habitants, regroupement
    des têtes M14/M57, écart avec l'OFGL — vivent dans la définition technique,
    que la fiche affiche juste en dessous.
    """
    conn = entrepot_seme
    f.declarer(conn)
    lignes = conn.execute(
        "select i.indicator_id, d.public_definition, d.formula, i.published"
        " from core.indicators i"
        " join core.indicator_definitions d on d.definition_id = i.definition_id"
        " where i.dataset_id = ?",
        (f.DATASET,),
    ).fetchall()
    assert len(lignes) == 7
    for identifiant, definition, formule, publie in lignes:
        assert len(definition.split()) <= 50, identifiant
        assert publie is True, identifiant
        if identifiant != f.RESIDU:
            # La formule nomme les deux nomenclatures : sans elle, la fiche
            # laisserait croire qu'une tête de fonction se lit seule.
            assert "M14" in formule and "M57" in formule, identifiant
    # Redéclarer ne duplique pas et ne laisse pas de définition orpheline.
    f.declarer(conn)
    (orphelines,) = conn.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_les_dix_tetes_brutes_sont_depubliees(entrepot_seme):
    """Retirer un indicateur du code ne le dépublie pas : les cinq têtes qui
    mélangeaient deux nomenclatures resteraient affichées avec leurs valeurs de
    2023. La dépublication s'écrit."""
    conn = entrepot_seme
    conn.execute(
        """
        insert into core.indicator_definitions
            (public_definition, technical_definition, formula, unit_notes,
             confidence_level, badges)
        values ('ancienne', 'ancienne', 'ancienne', 'euros', 'observed', array['Officiel'])
        """
    )
    for identifiant in f.RETIRES:
        conn.execute(
            """
            insert into core.indicators
                (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                 additive, geo_levels, time_granularity, published)
            select ?, ?, max(definition_id), ?, 'Ancienne tête', 'EUR', true,
                   array['commune'], 'annuelle', true
              from core.indicator_definitions
            """,
            (identifiant, f.DATASET, f.THEME),
        )
    conn.commit()
    f.declarer(conn)
    restants = dict(conn.execute(
        "select indicator_id, published from core.indicators where indicator_id in"
        f" ({', '.join('?' * len(f.RETIRES))})", f.RETIRES,
    ).fetchall())
    assert restants and all(publie is False for publie in restants.values()), restants
    assert set(restants) == set(f.RETIRES)


def test_tous_les_exercices_passent_par_un_seul_remplacement(entrepot_seme, gironde):
    """`revisions.remplacer` purge l'indicateur entier : deux exercices écrits
    dans le même appel coexistent, un appel qui n'en apporte qu'un purge
    l'autre. C'est exactement pourquoi `run()` boucle sur les exercices avant
    d'écrire, et jamais l'inverse."""
    from plateforme import entrepot, revisions
    from plateforme.normalize.geo import MILLESIME
    from plateforme.normalize.ofgl import filtrer_territoires_connus

    conn = entrepot_seme
    f.declarer(conn)
    for niveau, code, nom, parent in (
        ("departement", "33", "Gironde", None),
        ("commune", "33063", "Bordeaux", "33"),
    ):
        conn.execute(
            "insert or ignore into geo.geography_reference (geo_level, geo_code,"
            " vintage, name, parent_level, parent_code, flags)"
            " values (?, ?, ?, ?, ?, ?, '{}')",
            (niveau, code, MILLESIME, nom, "departement" if parent else None, parent),
        )
    # L'agrégat de l'OFGL pour Bordeaux, plus étroit que le grand livre aux deux
    # exercices : le résidu retranche, et les sept lignes bouclent.
    agregats = {"2020": 315_000_000.0, "2021": 320_000_000.0}
    run_ofgl = _semer_agregat(conn, ("2020",), {"33063": agregats["2020"]})
    conn.execute(
        "insert into core.observations (indicator_id, geo_level, geo_code,"
        " geo_vintage, period, value, run_id)"
        " values (?, 'commune', '33063', ?, '2021', ?, ?)",
        (f.PARENT, MILLESIME, agregats["2021"], run_ofgl),
    )
    conn.commit()
    assert f.exercices_publiables(conn) == ["2020", "2021"]

    tous, par_exercice = [], {}
    for exercice in ("2020", "2021"):
        totaux = {"33063": gironde[exercice]["33063"]}
        ofgl = f.agregats_ofgl(conn, exercice, totaux)
        assert ofgl == {"33063": agregats[exercice]}
        gardees, ecartes = filtrer_territoires_connus(
            conn, f.candidates(totaux, ofgl, exercice)
        )
        assert not ecartes
        f.controler(gardees, ofgl)
        par_exercice[exercice] = gardees
        tous += gardees

    def ecrire(lignes):
        run_id = entrepot.start_run(conn, f.DATASET, "manual")
        ecrites, revisees = revisions.remplacer(
            conn, run_id, sorted({*f.POSTES, f.RESIDU, *f.RETIRES}), f.COLONNES,
            [
                (identifiant, niveau, code, MILLESIME, periode, valeur)
                for identifiant, niveau, code, periode, valeur in lignes
            ],
        )
        conn.commit()
        return ecrites, revisees

    ecrites, revisees = ecrire(tous)
    assert ecrites == 14, "six postes plus le résidu, aux deux exercices"
    assert revisees == 0
    periodes = {
        periode for (periode,) in conn.execute(
            "select distinct period from core.observations where indicator_id in"
            " (select indicator_id from core.indicators where dataset_id = ?)",
            (f.DATASET,),
        ).fetchall()
    }
    assert periodes == {"2020", "2021"}
    culture = conn.execute(
        "select value from core.observations where indicator_id = ?"
        " and geo_code = '33063' and period = '2021'",
        ("fonction_commune_culture_sport",),
    ).fetchone()[0]
    assert abs(float(culture) - f.TEMOINS["2021"]) < 0.01

    # Un run qui n'apporte qu'un exercice efface l'autre : la démonstration.
    ecrire(par_exercice["2021"])
    periodes = {
        periode for (periode,) in conn.execute(
            "select distinct period from core.observations where indicator_id in"
            " (select indicator_id from core.indicators where dataset_id = ?)",
            (f.DATASET,),
        ).fetchall()
    }
    assert periodes == {"2021"}, "2020 a disparu — d'où le chargement en un seul run"
