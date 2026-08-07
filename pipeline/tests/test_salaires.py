"""Les salaires : un lieu de travail, un secret, et deux France.

Ce module publie un montant qui se lit de travers plus facilement qu'aucun
autre : il décrit les emplois d'un territoire, pas les revenus de ses habitants,
et la source y ajoute deux pièges — les zones blanchies par le secret, et deux
codes nationaux dont le plus visible n'est pas le bon. Ces tests tiennent les
trois bouts, plus l'égalité Paris commune / Paris département sur laquelle tout
le chargement s'arrête.

La fixture est un extrait réel de l'API Melodi : 234 territoires — la France
sous ses deux codes, les 17 régions, les 100 départements, 101 communes dont
Paris, vingt zones blanchies et l'une des onze communes que la source sert en
double, et sept zonages sans équivalent institutionnel.
"""

import json
from pathlib import Path

import pytest

from plateforme import couverture
from plateforme.normalize import salaires as s

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def brut() -> dict:
    return json.loads((FIXTURES / "insee_salaires_sample.json").read_text("utf-8"))


@pytest.fixture(scope="module")
def lus(brut) -> dict:
    return {sexe: s.lire(brut[sexe]["observations"], sexe) for sexe in s.SEXES}


@pytest.fixture(scope="module")
def gaps(lus) -> dict:
    return s.ecarts(lus[s.FEMMES], lus[s.HOMMES])


def test_les_quatre_niveaux_du_referentiel_sont_lus(lus):
    assert {cle[0] for cle in lus[s.TOUS]} == {"commune", "departement", "region", "pays"}


def test_paris_commune_egale_paris_departement(lus):
    """Le contrôle qui bloque. Paris est à la fois une commune et un département :
    deux mailles, un seul territoire, une seule valeur. Rien d'interne à la
    source ne verrait un millésime géographique qui glisse."""
    verifies = s.controler_paris(lus[s.TOUS])
    assert verifies["periodes_verifiees"] == 2
    assert verifies["paris"] == {"2022": 3727.266536, "2023": 3863.197226}


def test_le_controle_bloque_si_les_deux_mailles_divergent():
    cles = {
        (*s.PARIS_COMMUNE, "2023"): (3863.197226, "normal"),
        (*s.PARIS_DEPARTEMENT, "2023"): (3863.20, "normal"),
    }
    with pytest.raises(s.MailleGeographiqueIncoherente, match="deux valeurs"):
        s.controler_paris(cles)


def test_le_controle_bloque_s_il_n_a_rien_a_comparer():
    with pytest.raises(s.MailleGeographiqueIncoherente, match="ne contrôle rien"):
        s.controler_paris({})
    with pytest.raises(s.MailleGeographiqueIncoherente, match="est absent"):
        s.controler_paris({(*s.PARIS_COMMUNE, "2023"): (3863.197226, "normal")})


def test_la_France_publiee_est_hors_Mayotte_et_non_la_metropole(lus, brut):
    """La source publie deux totaux nationaux. `FM` est la France métropolitaine,
    `F` la France hors Mayotte — le champ du jeu, et le seul agrégat cohérent
    avec les départements d'outre-mer publiés à la maille départementale. Les
    confondre écrirait deux valeurs différentes sous le même pays."""
    pays = {cle[2]: valeur for cle, valeur in lus[s.TOUS].items() if cle[0] == "pays"}
    assert pays == {"2022": (2628.626752, "normal"), "2023": (2734.75785, "normal")}
    metropole = [
        observation
        for observation in brut[s.TOUS]["observations"]
        if observation["dimensions"]["GEO"] == f"2025-FRANCE-{s.FRANCE_METROPOLE}"
    ]
    assert {o["measures"]["OBS_VALUE_NIVEAU"]["value"] for o in metropole} == {
        2635.621679, 2742.427474,
    }, "la métropole est bien servie par la source"
    assert s.territoire("2025-FRANCE-FM") is None
    assert s.territoire("2025-FRANCE-F") == ("pays", "FR")


def test_une_zone_blanchie_est_une_ligne_sans_valeur(lus):
    """Le secret statistique est un fait publiable : la zone dépasse le seuil de
    diffusion, la source refuse la valeur, et l'observation le dit."""
    blanchies = {cle: valeur for cle, valeur in lus[s.TOUS].items() if valeur[1] != "normal"}
    assert len(blanchies) == 40
    assert set(blanchies.values()) == {(None, "confidential")}
    assert lus[s.TOUS][("commune", "01103", "2023")] == (None, "confidential")


def test_une_zone_sous_le_seuil_n_a_pas_de_ligne_du_tout(lus):
    """Les zones de moins de 2 000 habitants sont absentes, pas nulles : 5 472
    communes servies sur les ~34 800 du pays. La couverture se mesure sur ce que
    la source sert, jamais sur le référentiel entier."""
    communes = {cle[1] for cle in lus[s.TOUS] if cle[0] == "commune"}
    assert "01001" not in communes


def test_les_zonages_sans_equivalent_institutionnel_sont_ecartes(brut, lus):
    """Le jeu publie huit découpages de plus : aires d'attraction, bassins de
    vie, unités urbaines, zones d'emploi, EPCI, arrondissements, arrondissements
    municipaux."""
    prefixes = {
        observation["dimensions"]["GEO"].split("-")[1]
        for observation in brut[s.TOUS]["observations"]
    }
    assert {"UU2020", "ZE2020", "EPCI", "ARM", "BV2022", "AAV2020", "ARR"} <= prefixes
    for brut_geo in ("2025-UU2020-00758", "2025-ARM-75101", "2025-EPCI-200054781"):
        assert s.territoire(brut_geo) is None
    # Paris passe par sa commune, pas par ses arrondissements municipaux.
    assert ("commune", "75056", "2023") in lus[s.TOUS]


def test_le_sexe_et_le_statut_de_confidentialite_partagent_la_lettre_F(lus, brut):
    """`SEX = F` et `CONF_STATUS = F` : deux dimensions, un même code. Les
    confondre publierait le salaire des femmes sous le nom de tout le monde."""
    assert s.lire(brut[s.TOUS]["observations"], s.FEMMES) == {}
    femmes = lus[s.FEMMES][("pays", "FR", "2023")]
    hommes = lus[s.HOMMES][("pays", "FR", "2023")]
    assert femmes == (2507.671335, "normal")
    assert hommes == (2898.353297, "normal")
    assert lus[s.TOUS][("pays", "FR", "2023")] == (2734.75785, "normal")


def test_seule_la_moyenne_existe():
    """La source ne diffuse pas de médiane à ces mailles — la demander renvoie
    400. Rien ne la remplace, et surtout pas le niveau de vie de Filosofi, qui
    est un revenu disponible par unité de consommation."""
    assert "MOYENNE" in s.MESURE
    autre = [{
        "attributes": {"CONF_STATUS": "F"},
        "dimensions": {"GEO": "2025-DEP-75", "SEX": "_T", "AGE": "_T",
                       "TIME_PERIOD": "2023",
                       "DERA_MEASURE": "SALAIRE_NET_EQTP_MENSUEL_MEDIANE"},
        "measures": {"OBS_VALUE_NIVEAU": {"value": 2500.0}},
    }]
    assert s.lire(autre, s.TOUS) == {}


def test_une_tranche_d_age_n_est_pas_le_total():
    """Le jeu croise six tranches d'âge : lire la mauvaise publierait le salaire
    des moins de 26 ans sous le nom de tous."""
    jeunes = [{
        "attributes": {"CONF_STATUS": "F"},
        "dimensions": {"GEO": "2025-DEP-75", "SEX": "_T", "AGE": "Y_LT26",
                       "TIME_PERIOD": "2023", "DERA_MEASURE": s.MESURE},
        "measures": {"OBS_VALUE_NIVEAU": {"value": 2100.0}},
    }]
    assert s.lire(jeunes, s.TOUS) == {}


def test_l_ecart_femmes_hommes_se_calcule_sur_les_deux_moyennes(gaps):
    valeur, statut = gaps[("pays", "FR", "2023")]
    assert statut == "normal"
    assert round(valeur, 6) == 13.479446
    assert round(gaps[("commune", "75056", "2023")][0], 6) == 16.844883


def test_l_ecart_d_une_zone_blanchie_reste_sans_valeur(gaps):
    assert gaps[("commune", "01103", "2023")] == (None, "confidential")


def test_une_commune_servie_deux_fois_ne_fabrique_pas_de_revision(brut, lus):
    """Onze communes sont diffusées en double, la même valeur à deux précisions
    — 2 038,779062 et 2 038,77906173258. Sans arrondi, laquelle l'emporte dépend
    de l'ordre des pages, et chaque rechargement archiverait une révision qui
    n'en est pas une."""
    doublons = [
        observation["measures"]["OBS_VALUE_NIVEAU"]["value"]
        for observation in brut[s.TOUS]["observations"]
        if observation["dimensions"]["GEO"] == "2025-COM-83016"
        and observation["dimensions"]["TIME_PERIOD"] == "2022"
    ]
    assert doublons == [2038.77906173258, 2038.779062], "la source sert bien deux lignes"
    assert lus[s.TOUS][("commune", "83016", "2022")] == (2038.779062, "normal")


def test_les_lignes_suivent_les_colonnes_declarees(lus, gaps):
    from plateforme import revisions

    lignes = s.lignes_a_ecrire(s.candidates(lus[s.TOUS], gaps))
    attendue = len(revisions.CLES) + len(s.COLONNES)
    assert lignes and all(len(ligne) == attendue for ligne in lignes)
    assert {ligne[0] for ligne in lignes} == set(s.INDICATEURS)


def test_la_couverture_se_compte_en_observations_servies(lus, gaps):
    """Un salaire moyen ne s'additionne pas : la couverture ne peut pas se
    mesurer en euros. Elle compte les observations que la source sert et que le
    référentiel reconnaît."""
    proposees = s.candidates(lus[s.TOUS], gaps)
    par_maille = s.par_maille(proposees)
    assert par_maille == {"commune": 202, "departement": 200, "region": 34, "pays": 2}
    couverture.controler(par_maille, par_maille)
    with pytest.raises(couverture.CouvertureInsuffisante):
        couverture.controler(par_maille, {**par_maille, "commune": 101})


def test_les_fiches_disent_le_lieu_de_travail_le_champ_et_le_secret():
    assert "lieu de travail" in s.TECHNIQUE
    assert "secteur privé" in s.TECHNIQUE
    assert "hors apprentis, stagiaires, salariés" in s.TECHNIQUE
    assert "2 000 habitants" in s.TECHNIQUE
    assert "blanchies" in s.TECHNIQUE
    assert "euros courants" in s.TECHNIQUE
    assert "méthode constante" in s.TECHNIQUE
    assert "France hors Mayotte" in s.TECHNIQUE
    assert "à poste égal" in s.TECHNIQUE
    for identifiant, fiche in s.INDICATEURS.items():
        assert len(fiche["public"].split()) <= 50, identifiant
    assert "là où il travaille" in s.INDICATEURS[s.SALAIRE]["public"]
    assert "à poste égal" in s.INDICATEURS[s.ECART]["public"]


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    s.declarer(entrepot_seme)
    s.declarer(entrepot_seme)
    publies = {
        identifiant: (unite, sommable, theme)
        for identifiant, unite, sommable, theme in entrepot_seme.execute(
            "select indicator_id, unit, additive, theme from core.indicators"
            " where dataset_id = ?",
            (s.DATASET,),
        ).fetchall()
    }
    assert publies == {
        s.SALAIRE: ("EUR", False, "emploi"),
        s.ECART: ("percent", False, "emploi"),
    }, "un salaire moyen ne s'additionne pas et ne se rapporte pas à l'habitant"
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, lus, gaps):
    from plateforme import entrepot, revisions
    from plateforme.normalize.ofgl import filtrer_territoires_connus

    s.declarer(entrepot_seme)
    for niveau, code in (
        ("pays", "FR"), ("region", "11"), ("departement", "75"),
        ("commune", "75056"), ("commune", "01103"),
    ):
        entrepot_seme.execute(
            "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
            " parent_level, parent_code, flags) values (?, ?, ?, ?, null, null, '{}')",
            (niveau, code, s.MILLESIME, f"{niveau} {code}"),
        )
    run_id = entrepot.start_run(entrepot_seme, s.DATASET, "manual")
    proposees = s.candidates(lus[s.TOUS], gaps)
    gardees, ecartes = filtrer_territoires_connus(entrepot_seme, proposees)
    ecrites, _ = revisions.remplacer(
        entrepot_seme, run_id, sorted(s.INDICATEURS), s.COLONNES,
        s.lignes_a_ecrire(gardees),
    )
    entrepot_seme.commit()
    assert ecrites == 20, "cinq territoires, deux années, deux indicateurs"
    assert ecartes, "les autres territoires de la fixture ne sont pas au référentiel"

    (valeur,) = entrepot_seme.execute(
        "select value from core.observations where indicator_id = ?"
        " and geo_level = 'commune' and geo_code = '75056' and period = '2023'",
        (s.SALAIRE,),
    ).fetchone()
    assert valeur == 3863.197226
    # La même valeur au département : c'est le contrôle bloquant, vérifié cette
    # fois sur ce qui est réellement écrit.
    (au_departement,) = entrepot_seme.execute(
        "select value from core.observations where indicator_id = ?"
        " and geo_level = 'departement' and geo_code = '75' and period = '2023'",
        (s.SALAIRE,),
    ).fetchone()
    assert au_departement == valeur
    # Une zone blanchie existe en base, sans valeur, et se dit confidentielle.
    assert entrepot_seme.execute(
        "select value, value_status from core.observations where indicator_id = ?"
        " and geo_code = '01103' and period = '2023'",
        (s.SALAIRE,),
    ).fetchone() == (None, "confidential")
