"""Capacités touristiques : trois unités de compte qui ne s'additionnent pas.

Le piège de ce jeu n'est pas caché, il est offert : la source publie une colonne
`PLACE` qui vaut des chambres pour un hôtel et des emplacements pour un camping.
Lue sans regarder l'hébergement, elle fabrique un « total des capacités » qui ne
désigne rien — et que la source elle-même se garde bien de publier.
"""

from pathlib import Path

import pytest

from plateforme import couverture
from plateforme.normalize import tourisme

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def archive() -> bytes:
    return (FIXTURES / "insee_tourisme_sample.zip").read_bytes()


@pytest.fixture(scope="module")
def lignes(archive) -> list[dict]:
    return tourisme.lire(archive)


def test_seuls_les_territoires_du_site_sont_retenus(lignes):
    assert lignes
    assert {ligne["niveau"] for ligne in lignes} == {
        "commune", "departement", "region"
    }


def test_aucun_total_toutes_capacites_confondues_n_est_publie():
    """Une chambre, un emplacement et un lit ne sont pas la même chose. La
    source ne publie pas leur somme, et ce module ne la fabrique pas."""
    unites = {fiche["unite"] for fiche in tourisme.fiches().values()}
    assert unites == {"établissements", "chambres", "emplacements", "place-lits"}
    assert not any("total" in cle for cle in tourisme.fiches())


def test_la_meme_colonne_change_d_unite_selon_l_hebergement(lignes):
    """`PLACE` vaut des chambres pour un hôtel et des emplacements pour un
    camping : deux indicateurs distincts, jamais un seul."""
    assert tourisme.CAPACITES[("PLACE", "I551")][2] == "chambres"
    assert tourisme.CAPACITES[("PLACE", "I553")][2] == "emplacements"
    valeurs = {
        (cle, code): valeur
        for cle, _, code, _, valeur in tourisme.valeurs_publiees(lignes)
    }
    assert valeurs[("insee_hotels", "33063")] == 82
    assert valeurs[("insee_hotels_chambres", "33063")] == 5796
    assert valeurs[("insee_hebergements_collectifs_lits", "33063")] == 6369


def test_les_composantes_ne_sont_lues_que_pour_les_controles(lignes):
    """Les trois sortes d'hébergement collectif, les six classements et les deux
    durées de séjour sont lus — sans quoi rien ne vérifierait les filtres — mais
    publiés, ils compteraient chaque hôtel deux fois."""
    lus = {ligne["hebergement"] for ligne in lignes}
    assert set(tourisme.COLLECTIFS) <= lus
    publies = {cle for cle, _, _, _, _ in tourisme.valeurs_publiees(lignes)}
    assert publies == set(tourisme.fiches())
    vus = set()
    for cle, niveau, code, periode, _ in tourisme.valeurs_publiees(lignes):
        assert (cle, niveau, code, periode) not in vus, f"{cle} {code} publié deux fois"
        vus.add((cle, niveau, code, periode))


def test_les_quatre_identites_se_referment(lignes):
    verifies = tourisme.controler(lignes)
    assert set(verifies) == {
        "hebergements_collectifs", "classements", "durees_de_sejour"
    }
    assert all(compte > 0 for compte in verifies.values())


def _territoire_coherent(code: str = "x") -> list[dict]:
    """Les cinquante-quatre croisements d'un territoire, tous cohérents.

    Chaque classement vaut 1, d'où un total de 6 ; chaque sorte d'hébergement
    collectif vaut 1, d'où un total de 3 ; les emplacements se partagent en
    trois à l'année et trois de passage. Les quatre identités s'y referment, et
    un test n'a plus qu'à perturber la valeur qu'il veut éprouver.
    """
    valeurs: dict[tuple, float] = {}
    for mesure in ("UNIT_LOC", "PLACE", "BEDPLACE"):
        for sorte in tourisme.COLLECTIFS:
            valeurs[(mesure, sorte, "_T", "_T")] = 1.0
        valeurs[(mesure, "I552", "_T", "_T")] = 3.0
    for hebergement in ("I551", "I553"):
        for mesure in ("UNIT_LOC", "PLACE"):
            for rang in tourisme.CLASSEMENTS:
                valeurs[(mesure, hebergement, "_T", rang)] = 1.0
            valeurs[(mesure, hebergement, "_T", "_T")] = 6.0
    for duree in tourisme.SEJOURS:
        valeurs[("PLACE", "I553", duree, "_T")] = 3.0
        for rang in tourisme.CLASSEMENTS:
            valeurs[("PLACE", "I553", duree, rang)] = 0.5
    return [
        {"niveau": "commune", "code": code, "periode": "2026", "mesure": m,
         "hebergement": h, "sejour": s, "classement": c, "valeur": v}
        for (m, h, s, c), v in valeurs.items()
    ]


def test_le_territoire_temoin_referme_bien_les_quatre_identites():
    """Sans quoi les tests qui suivent lèveraient pour la mauvaise raison."""
    assert tourisme.controler(_territoire_coherent()) == {
        "hebergements_collectifs": 3, "classements": 4, "durees_de_sejour": 1
    }


def test_le_controle_bloque_si_un_classement_manque_a_la_somme():
    """Oublier les non classés ferait perdre 3 509 hôtels sans rien casser :
    c'est ce contrôle-là qui le verrait."""
    lignes = _territoire_coherent()
    for ligne in lignes:
        if (ligne["mesure"], ligne["hebergement"], ligne["classement"]) == (
            "UNIT_LOC", "I551", "NC"
        ):
            ligne["valeur"] = 0.0
    with pytest.raises(tourisme.IdentiteRompue, match="classements"):
        tourisme.controler(lignes)


def test_le_controle_bloque_si_une_sorte_d_hebergement_collectif_derive():
    lignes = _territoire_coherent()
    for ligne in lignes:
        if (ligne["mesure"], ligne["hebergement"]) == ("BEDPLACE", "I552C"):
            ligne["valeur"] = 9.0
    with pytest.raises(tourisme.IdentiteRompue, match="hebergements_collectifs"):
        tourisme.controler(lignes)


def test_le_controle_bloque_si_les_deux_durees_ne_font_plus_les_emplacements():
    lignes = _territoire_coherent()
    for ligne in lignes:
        if (ligne["hebergement"], ligne["sejour"], ligne["classement"]) == (
            "I553", "LONG", "_T"
        ):
            ligne["valeur"] = 1.0
    with pytest.raises(tourisme.IdentiteRompue, match="durees_de_sejour"):
        tourisme.controler(lignes)


def test_un_croisement_absent_rompt_l_identite(lignes):
    """La source sert ses cinquante-quatre lignes pour chaque territoire qu'elle
    publie. Un croisement qui disparaîtrait publierait une capacité amputée, et
    le contrôle des mailles, qui ne somme que les totaux, ne le verrait pas."""
    ampute = [
        ligne for ligne in lignes
        if not (ligne["hebergement"] == "I552C" and ligne["mesure"] == "BEDPLACE")
    ]
    with pytest.raises(tourisme.IdentiteRompue, match="croisement absent"):
        tourisme.controler(ampute)


def test_la_France_hors_Mayotte_sert_de_total_pas_la_metropole(archive):
    """Le fichier publie deux France sous le même zonage. La métropole vaut
    649 158 chambres contre 660 489 : la prendre pour total laisserait les
    communes d'outre-mer hors du contrôle de somme."""
    totaux = tourisme.totaux_france(archive)
    assert totaux[("PLACE", "I551")] == 660489.0
    assert totaux[("UNIT_LOC", "I551")] == 16291.0
    assert totaux[("PLACE", "I553")] == 848302.0
    assert totaux[("BEDPLACE", "I552")] == 889623.0


def test_les_sommes_sont_tenues_par_maille_et_par_capacite(lignes):
    """La fixture ne porte qu'une part du pays : ce qui se vérifie ici est que
    les six capacités publiées ont chacune leur somme, sans mélange."""
    sommes = tourisme.controler_totaux(lignes, {})
    assert set(sommes) == {
        "UNIT_LOC:I551", "UNIT_LOC:I552", "UNIT_LOC:I553",
        "PLACE:I551", "PLACE:I553", "BEDPLACE:I552",
    }


def _pays(par_niveau: dict[str, float]) -> list[dict]:
    return [
        {"niveau": niveau, "code": "x", "periode": "2026", "mesure": "UNIT_LOC",
         "hebergement": "I551", "sejour": "_T", "classement": "_T", "valeur": valeur}
        for niveau, valeur in par_niveau.items()
    ]


def test_chaque_maille_doit_faire_la_France():
    sommes = tourisme.controler_totaux(
        _pays({"commune": 100.0, "departement": 100.0, "region": 100.0}),
        {("UNIT_LOC", "I551"): 100.0},
    )
    assert sommes["UNIT_LOC:I551"]["region"] == 100.0


def test_le_controle_bloque_si_une_seule_maille_decroche():
    """Un département tombé du référentiel laisse les deux autres mailles
    justes : aucun total pris isolément ne le montrerait."""
    with pytest.raises(tourisme.TotalIncoherent, match="departements"):
        tourisme.controler_totaux(
            _pays({"commune": 100.0, "departement": 90.0, "region": 100.0}),
            {("UNIT_LOC", "I551"): 100.0},
        )


def test_la_couverture_se_mesure_en_hotels(lignes):
    candidates = tourisme.valeurs_publiees(lignes)
    lus = tourisme.hotels_par_maille(candidates)
    sommes = tourisme.controler_totaux(lignes, {})
    assert lus == sommes["UNIT_LOC:I551"]
    couverture.controler(lus, lus)
    with pytest.raises(couverture.CouvertureInsuffisante):
        couverture.controler(lus, {**lus, "commune": lus["commune"] * 0.5})


def test_les_fiches_disent_les_trois_unites_et_la_capacite():
    fiches = tourisme.fiches()
    assert len(fiches) == 6
    assert "n'est pas un lit" in fiches["insee_hotels_chambres"]["public"]
    assert "à l'année" in fiches["insee_campings_emplacements"]["public"]
    assert "capacités offertes, pas une fréquentation" in tourisme.TECHNIQUE
    assert "hors Mayotte" in tourisme.TECHNIQUE
    assert "aucun total" in tourisme.TECHNIQUE
    for cle, fiche in fiches.items():
        assert len(fiche["public"].split()) <= 50, cle


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    tourisme.declarer(entrepot_seme)
    tourisme.declarer(entrepot_seme)
    themes = dict(entrepot_seme.execute(
        "select indicator_id, theme from core.indicators where dataset_id = ?",
        (tourisme.DATASET,),
    ).fetchall())
    assert set(themes) == set(tourisme.fiches())
    assert set(themes.values()) == {"tourisme"}
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0
