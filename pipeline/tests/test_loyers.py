"""La carte des loyers : une valeur par commune, une commune sur sept mesurée.

Le fichier de l'ANIL est exhaustif en apparence — 34 900 lignes, 34 900 loyers —
et ne l'est pas en substance : 86 % des valeurs sont la prédiction d'une zone
voisine, recopiée. La seule colonne qui le dit est `TYPPRED`, et rien dans
`loypredm2` ne trahit une valeur recopiée. Ces tests tiennent la décision qui en
découle — ne publier que les communes mesurées chez elles — et le contrôle qui
la protège.

La fixture est un extrait réel du fichier maisons 2025 : 744 lignes, les trois
modalités de `TYPPRED`, les 45 arrondissements de Paris, Lyon et Marseille, et
Bar-sur-Aube, seule commune du fichier prédite chez elle que son R² écarte.
"""

from pathlib import Path

import pytest

from plateforme import couverture
from plateforme.normalize import loyers

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def lignes():
    return loyers.lire((FIXTURES / "anil_loyers_sample.csv").read_bytes())


def complet(lignes: list[dict]) -> list[dict]:
    """La fixture portée à 34 900 communes, codes réattribués.

    Le contrôle de périmètre porte sur un compte que seul le fichier entier
    atteint. Les valeurs et les modalités de `TYPPRED` sont celles de l'extrait
    réel ; seuls les codes changent, puisque c'est leur nombre qui est vérifié.
    """
    gonflees = [dict(ligne) for ligne in (lignes * 47)[: loyers.LIGNES_ATTENDUES]]
    for rang, ligne in enumerate(gonflees):
        ligne["code"] = f"{rang:05d}"
    return gonflees


def test_le_fichier_se_lit_en_latin1_et_a_la_virgule(lignes):
    """Décodé en UTF-8, le fichier ne s'ouvre même pas ; lu comme un CSV anglais,
    « 7,98 » devient une colonne de plus."""
    assert len(lignes) == 744
    bar_sur_aube = next(ligne for ligne in lignes if ligne["code"] == "10033")
    assert bar_sur_aube["nom"] == "Bar-sur-Aube"
    assert round(bar_sur_aube["loyer"], 2) == 7.99
    assert {ligne["nom"] for ligne in lignes} & {"Méaulte", "Le Ménil-Scelleur"}


def test_les_trois_modalites_de_typpred_coexistent(lignes):
    """Deux d'entre elles — `maille` et `EPCI` — désignent une valeur qui ne
    vient pas de la commune décrite."""
    modalites = {}
    for ligne in lignes:
        modalites[ligne["typpred"]] = modalites.get(ligne["typpred"], 0) + 1
    assert modalites == {"maille": 636, "commune": 99, "EPCI": 9}
    assert not any(loyers.mesuree(ligne) for ligne in lignes if ligne["typpred"] == "EPCI")


def test_c_est_typpred_qui_decide_pas_le_nombre_d_annonces(lignes):
    """Le piège du connecteur, en un test.

    154 communes de l'extrait portent au moins 30 annonces observées sans être
    prédites chez elles — 4 172 sur le fichier entier. Un filtre sur le seul
    nombre d'annonces les publierait toutes, avec le loyer d'une zone voisine.
    """
    dotees = [
        ligne for ligne in lignes
        if ligne["annonces"] >= loyers.ANNONCES_MINIMUM and ligne["typpred"] != "commune"
    ]
    assert len(dotees) == 154
    assert not any(loyers.mesuree(ligne) for ligne in dotees)


def test_le_r2_ecarte_une_commune_pourtant_predite_chez_elle(lignes):
    """Bar-sur-Aube : 140 annonces, `TYPPRED = commune`, R² à 0,49. Le critère
    ne retire presque rien — c'est la seule du fichier maisons — mais il tiendra
    si la source relâche `TYPPRED`."""
    bar_sur_aube = next(ligne for ligne in lignes if ligne["code"] == "10033")
    assert bar_sur_aube["typpred"] == "commune"
    assert bar_sur_aube["annonces"] >= loyers.ANNONCES_MINIMUM
    assert bar_sur_aube["r2"] < loyers.R2_MINIMUM
    assert not loyers.mesuree(bar_sur_aube)
    assert "10033" not in {code for _, _, code, _, _ in loyers.observations(lignes, "x")}


def test_seules_les_communes_mesurees_sont_publiees(lignes):
    publiees = loyers.observations(lignes, "anil_loyer_maison")
    assert len(publiees) == 98
    assert len(publiees) / len(lignes) < 0.15
    assert {identifiant for identifiant, _, _, _, _ in publiees} == {"anil_loyer_maison"}
    assert {periode for _, _, _, periode, _ in publiees} == {"2025"}
    # Un loyer au m² : quelques euros, jamais un montant.
    assert all(4 < valeur < 60 for _, _, _, _, valeur in publiees)


def test_les_arrondissements_sont_publies_a_leur_niveau(lignes):
    """Paris, Lyon et Marseille ne figurent dans la source que par
    arrondissement. Les rattacher à leur commune demanderait une pondération que
    la source ne publie pas : la moyenne de vingt arrondissements ne serait le
    loyer de personne."""
    codes = {ligne["code"] for ligne in lignes}
    assert not codes & {"75056", "69123", "13055"}
    arrondissements = {code for code in codes if loyers.niveau(code) == "arrondissement_municipal"}
    assert len(arrondissements) == 45
    publiees = loyers.observations(lignes, "anil_loyer_maison")
    par_maille = {}
    for _, maille, code, _, _ in publiees:
        par_maille.setdefault(maille, set()).add(code)
    assert len(par_maille["arrondissement_municipal"]) == 12
    assert par_maille["arrondissement_municipal"] <= arrondissements
    assert not par_maille["commune"] & arrondissements


def test_le_controle_passe_sur_un_fichier_complet(lignes):
    verifie = loyers.controler(complet(lignes), "anil_loyer_maison")
    assert verifie["communes_lues"] == 34_900
    assert 0.05 < verifie["part_mesuree"] < 0.30
    assert set(verifie["typpred"]) == {"EPCI", "commune", "maille"}
    # L'intervalle de prédiction fait environ la moitié de la valeur : ±23 %
    # autour du loyer affiché. La fiche technique le dit, faute de le publier.
    assert 0.4 < verifie["largeur_relative_mediane"] < 0.7


def test_le_controle_bloque_si_le_perimetre_bouge(lignes):
    entier = complet(lignes)
    with pytest.raises(loyers.SourceInattendue, match="34899 communes lues"):
        loyers.controler(entier[:-1], "anil_loyer_maison")
    doublon = [*entier[:-1], {**entier[-1], "code": entier[0]["code"]}]
    with pytest.raises(loyers.SourceInattendue, match="décrite deux fois"):
        loyers.controler(doublon, "anil_loyer_maison")


def test_le_controle_bloque_si_typpred_change_de_sens(lignes):
    """Une part mesurée à 100 % ne serait pas une bonne nouvelle : ce serait le
    signe que la colonne ne distingue plus rien, et le connecteur publierait
    trente mille prédictions de zone comme des loyers communaux."""
    toutes = [
        {**ligne, "typpred": "commune", "annonces": 200, "r2": 0.9}
        for ligne in complet(lignes)
    ]
    with pytest.raises(loyers.SourceInattendue, match="TYPPRED a changé de sens"):
        loyers.controler(toutes, "anil_loyer_maison")
    aucune = [{**ligne, "typpred": "maille"} for ligne in complet(lignes)]
    with pytest.raises(loyers.SourceInattendue, match="hors de la plage attendue"):
        loyers.controler(aucune, "anil_loyer_maison")


def test_les_fiches_disent_ce_qui_manque():
    for identifiant, (_, publique, _) in loyers.INDICATEURS.items():
        assert len(publique.split()) <= 50, identifiant
    assert "**annonce**" in loyers.TECHNIQUE
    assert "**charges comprises**" in loyers.TECHNIQUE
    assert "**vide**" in loyers.TECHNIQUE
    assert "52 m²" in loyers.TECHNIQUE and "92 m²" in loyers.TECHNIQUE
    assert "14 % des 34 900 communes" in loyers.TECHNIQUE
    assert "Mayotte est absente" in loyers.TECHNIQUE
    assert "millésime à l'autre" in loyers.TECHNIQUE
    # Le lecteur de la carte doit savoir, sans ouvrir la fiche technique, que la
    # commune voisine peut n'avoir aucune valeur parce qu'elle n'est pas mesurée.
    assert all("mesur" in publique for _, publique, _ in loyers.INDICATEURS.values())


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    loyers.declarer(entrepot_seme)
    loyers.declarer(entrepot_seme)
    publies = dict(entrepot_seme.execute(
        "select indicator_id, unit from core.indicators where dataset_id = ?",
        (loyers.DATASET,),
    ).fetchall())
    assert set(publies) == set(loyers.INDICATEURS)
    # Ni EUR — le site en ferait un montant sommable — ni percent.
    assert set(publies.values()) == {"€/m²/mois"}
    sommables = entrepot_seme.execute(
        "select count(*) from core.indicators where dataset_id = ? and additive",
        (loyers.DATASET,),
    ).fetchone()[0]
    assert sommables == 0
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, lignes):
    from plateforme import entrepot, revisions
    from plateforme.normalize.ofgl import filtrer_territoires_connus

    # Le jeu vient du registre versionné : sans sa ligne dans
    # `infra/seed/dataset_registry.csv`, le run serait compté comme orphelin.
    (connu,) = entrepot_seme.execute(
        "select count(*) from meta.dataset_registry where dataset_id = ?",
        (loyers.DATASET,),
    ).fetchone()
    assert connu == 1, "le jeu doit être déclaré dans infra/seed/dataset_registry.csv"
    loyers.declarer(entrepot_seme)
    for maille, code, nom in (
        ("commune", "95018", "Argenteuil"),
        ("arrondissement_municipal", "69383", "Lyon 3e Arrondissement"),
    ):
        entrepot_seme.execute(
            "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
            " parent_level, parent_code, flags) values (?, ?, ?, ?, null, null, '{}')",
            (maille, code, loyers.MILLESIME, nom),
        )
    run_id = entrepot.start_run(entrepot_seme, loyers.DATASET, "manual")
    candidates = loyers.observations(lignes, "anil_loyer_maison")
    gardees, hors_referentiel = filtrer_territoires_connus(entrepot_seme, candidates)
    ecrites, _ = revisions.remplacer(
        entrepot_seme, run_id, sorted(loyers.INDICATEURS), loyers.COLONNES,
        [
            (identifiant, maille, code, loyers.MILLESIME, periode, valeur)
            for identifiant, maille, code, periode, valeur in gardees
        ],
    )
    entrepot_seme.commit()
    assert ecrites == 2, "les deux seuls territoires du référentiel de ce test"
    assert len(hors_referentiel) == 96
    valeurs = dict(entrepot_seme.execute(
        "select geo_level, value from core.observations"
        " where indicator_id = 'anil_loyer_maison' and period = '2025'"
    ).fetchall())
    # L'arrondissement est écrit à son niveau : sous « commune », le référentiel
    # ne l'aurait pas reconnu et Lyon serait sorti vide, sans une ligne d'erreur.
    assert set(valeurs) == {"commune", "arrondissement_municipal"}
    assert all(5 < valeur < 40 for valeur in valeurs.values())


def test_la_couverture_se_mesure_sur_ce_qui_est_publie(lignes):
    """Les 30 000 communes non mesurées ne sont pas une couverture manquante :
    c'est une décision. Ce que la couverture surveille, ce sont les codes des
    communes publiées — et les arrondissements, qui se perdent à la moindre
    erreur de niveau."""
    publiees = loyers.observations(lignes, "anil_loyer_maison")
    lus = loyers.compter_par_maille(publiees)
    assert lus == {"commune": 86, "arrondissement_municipal": 12}
    couverture.controler(lus, lus)
    # Douze arrondissements rattachés au mauvais niveau, et la maille disparaît.
    with pytest.raises(couverture.CouvertureInsuffisante, match="arrondissement_municipal"):
        couverture.controler(lus, {"commune": 86})
