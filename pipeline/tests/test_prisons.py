"""Population carcérale par établissement : la fixture est le vrai classeur.

`justice_ecroues_etablissements_sample.xlsx` est le fichier mensuel DGAP du
1er juillet 2026, téléchargé le 7 août 2026 et gardé entier (1,1 Mo) — aucun
octet fabriqué. `justice_page_mensuelle_sample.html` est la page de la rubrique
téléchargée le même jour, celle où le connecteur retrouve le lien du mois.

Témoins relevés à la main sur la publication : France entière 89 446 écroués
détenus pour 63 289 places opérationnelles ; CP de Bordeaux-Gradignan, quartier
maison d'arrêt, 1 133 détenus pour 551 places (205,6 %) ; MA de Rochefort,
122 détenus pour 52 places (234,6 %).

Le piège du fichier : les totaux publiés par direction interrégionale portent
des détenus que les lignes d'établissement n'ont pas — quartiers « NC » et
détenus non ventilés (34 à Rennes). La somme des lignes vaut 89 283, pas
89 446, et les contrôles doivent absorber cet écart-là sans laisser passer une
lecture amputée.
"""

import io
from pathlib import Path

import pytest

from plateforme import couverture
from plateforme.normalize import prisons as p

FIXTURES = Path(__file__).parent / "fixtures"

# Les sommes de la fixture, recalculées indépendamment à la construction du
# crosswalk : lignes lisibles France entière (hors 6 quartiers NC).
DETENUS_LUS = 89_283.0
PLACES_LUES = 63_146.0
COM_DETENUS = 1_455.0  # Polynésie, Nouvelle-Calédonie, Wallis, Saint-Pierre-et-Miquelon


@pytest.fixture(scope="module")
def contenu() -> bytes:
    return (FIXTURES / "justice_ecroues_etablissements_sample.xlsx").read_bytes()


@pytest.fixture(scope="module")
def lu(contenu):
    return p.lire(contenu)


@pytest.fixture(scope="module")
def crosswalk():
    return p.charger_crosswalk()


def test_la_fixture_reelle_porte_les_temoins(lu):
    assert lu["periode"] == "2026-07"
    assert len({q[1] for q in lu["quartiers"]}) == 186
    assert len(lu["quartiers"]) == 278
    gradignan = [q for q in lu["quartiers"] if q[1] == "CP BORDEAUX GRADIGNAN"]
    assert ("Tab14", "CP BORDEAUX GRADIGNAN", "MA/QMA", 551.0, 1_133.0, 205.6) in gradignan
    assert ("Tab14", "MA ROCHEFORT", "MA/QMA", 52.0, 122.0, 234.6) in lu["quartiers"]
    assert lu["france"] == {"detenus": 89_446.0, "places": 63_289.0}
    assert lu["totaux"]["DISP BORDEAUX"] == (5_447.0, 7_182.0)
    assert set(lu["totaux"]) == set(p.ONGLETS_DISP.values())
    # Les six quartiers « NC » gardent leur ligne, sans effectif : les compter
    # à zéro ferait baisser la densité là où la source ne dit rien.
    assert sum(1 for q in lu["quartiers"] if q[4] is None) == 6
    assert sum(q[4] for q in lu["quartiers"] if q[4] is not None) == DETENUS_LUS


def test_l_url_du_mois_se_retrouve_dans_la_page():
    """L'URL n'est pas constructible : le dossier est le mois de mise en ligne
    (le fichier de février 2026 vit dans /2026-03/). Seul le nom du fichier
    porte le mois des données, et c'est lui qui départage les parutions."""
    page = (FIXTURES / "justice_page_mensuelle_sample.html").read_text(encoding="utf-8")
    adresse, periode = p.trouver_url(page)
    assert adresse == (
        "https://www.justice.gouv.fr/sites/default/files/2026-07/"
        "statistique_etablissements_personnes_ecrouees_01072026.xlsx"
    )
    assert periode == "2026-07"
    with pytest.raises(ValueError, match="renommé"):
        p.trouver_url("<html>rien</html>")


def _classeur_remanie(contenu: bytes, retoucher) -> bytes:
    import warnings

    import openpyxl

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        livre = openpyxl.load_workbook(io.BytesIO(contenu))
    retoucher(livre)
    sortie = io.BytesIO()
    livre.save(sortie)
    return sortie.getvalue()


def test_la_lecture_refuse_un_classeur_remanie(contenu):
    """Un onglet disparu ou une colonne renommée n'est pas un cas à absorber :
    la publication a changé de forme, il faut regarder avant de recharger."""
    with pytest.raises(ValueError, match="Tab14"):
        p.lire(_classeur_remanie(contenu, lambda livre: livre.remove(livre["Tab14"])))
    with pytest.raises(ValueError, match="en-tête"):
        p.lire(_classeur_remanie(
            contenu, lambda livre: livre["Tab14"].cell(row=7, column=5, value="Détenus")
        ))


def test_les_densites_publiees_se_recalculent(lu):
    """Détenus / places retombe sur la densité publiée à ±0,1 pt, ligne à
    ligne : 269 vérifications (278 lignes moins 6 NC et 3 sans densité —
    capacité nulle). C'est le contrôle qui voit deux colonnes interverties."""
    assert p.controler_densites(lu["quartiers"]) == 269
    fausses = list(lu["quartiers"])
    onglet, etab, quartier, places, detenus, densite = fausses[0]
    fausses[0] = (onglet, etab, quartier, places, detenus + 50, densite)
    with pytest.raises(p.DonneesCarceralesIncoherentes, match="colonne a glissé"):
        p.controler_densites(fausses)
    with pytest.raises(p.DonneesCarceralesIncoherentes, match="rien n'a été lu"):
        p.controler_densites([])


def test_chaque_disp_retombe_sur_le_tableau_8(lu):
    """Places exactes ; détenus bornés par ce que les quartiers NC et les
    non-ventilés expliquent. Les manques mesurés sur juillet 2026 : 34 détenus
    à Rennes (non ventilés), 99 à Toulouse et 30 outre-mer (NC)."""
    manquants = p.controler_disp(lu["quartiers"], lu["totaux"])
    assert manquants["DISP RENNES"] == 34.0
    assert manquants["DISP TOULOUSE"] == 99.0
    assert manquants["DSPOM"] == 30.0
    assert sum(manquants.values()) == lu["france"]["detenus"] - DETENUS_LUS
    assert all(valeur == 0 for disp, valeur in manquants.items()
               if disp not in ("DISP RENNES", "DISP TOULOUSE", "DSPOM"))

    ampute = [q for q in lu["quartiers"] if q[1] != "CP BORDEAUX GRADIGNAN"]
    with pytest.raises(p.DonneesCarceralesIncoherentes, match="perdu"):
        p.controler_disp(ampute, lu["totaux"])
    with pytest.raises(p.DonneesCarceralesIncoherentes, match="aucune ligne"):
        p.controler_disp([q for q in lu["quartiers"] if q[0] != "Tab14"], lu["totaux"])
    gonfle = [
        (o, e, q, places, detenus + 500 if detenus is not None else None, d)
        for o, e, q, places, detenus, d in lu["quartiers"]
    ]
    with pytest.raises(p.DonneesCarceralesIncoherentes, match="hors de ce que"):
        p.controler_disp(gonfle, lu["totaux"])


def test_le_temoin_national_est_exige_sur_le_fichier_de_juillet_2026(lu):
    """Le fichier chargé est celui du témoin : le total publié doit être
    exactement 89 446 / 63 289, et la somme des lignes le retrouve à 0,5 %."""
    national = p.controler_national(lu["quartiers"], lu["france"], lu["periode"])
    assert national["detenus_publies"] == p.TEMOIN_DETENUS
    assert national["places_publiees"] == p.TEMOIN_PLACES
    assert national["detenus_lus"] == DETENUS_LUS
    assert national["ecart_relatif"] < p.TOLERANCE_NATIONALE / 2

    with pytest.raises(p.DonneesCarceralesIncoherentes, match="témoin"):
        p.controler_national(
            lu["quartiers"], {"detenus": 89_400.0, "places": 63_289.0}, "2026-07"
        )
    # Un fichier plus récent n'a pas de témoin figé : l'ordre de grandeur borne.
    with pytest.raises(p.DonneesCarceralesIncoherentes, match="bornes"):
        p.controler_national(
            lu["quartiers"], {"detenus": 50_000.0, "places": 63_289.0}, "2026-08"
        )
    # Une lecture tronquée d'onglets entiers laisse toutes les densités et
    # tous les DISP restants cohérents ; seule la somme France entière la voit.
    ampute = [q for q in lu["quartiers"] if q[0] not in ("Tab19", "Tab20")]
    with pytest.raises(p.DonneesCarceralesIncoherentes, match="tronquée"):
        p.controler_national(ampute, lu["france"], lu["periode"])


def test_chaque_etablissement_trouve_sa_commune_au_crosswalk(lu, crosswalk):
    """Le crosswalk versionné couvre le fichier entier — c'est la jointure
    faite une fois et figée. Un établissement nouveau bloque nommément :
    l'ajouter est une maintenance consciente, pas un rattrapage flou."""
    assert len(crosswalk) == 186
    assert p.controler_crosswalk(lu["quartiers"], crosswalk) == 186
    assert crosswalk["CP BORDEAUX GRADIGNAN"] == "33192"
    assert crosswalk["MA ROCHEFORT"] == "17299"
    # Marseille-Baumettes : l'annuaire code le 9e arrondissement (13209),
    # replié sur la commune à la construction du crosswalk.
    assert crosswalk["CP MARSEILLE"] == "13055"
    sans = {e: code for e, code in crosswalk.items() if e != "CP BORDEAUX GRADIGNAN"}
    with pytest.raises(p.EtablissementInconnu, match="CP BORDEAUX GRADIGNAN"):
        p.controler_crosswalk(lu["quartiers"], sans)


def test_l_agregation_fait_des_ratios_de_sommes(lu, crosswalk):
    """La densité de chaque niveau rapporte des sommes — jamais une moyenne de
    densités — et n'existe pas sans place opérationnelle. Le pays somme la
    France entière, collectivités d'outre-mer comprises."""
    communes = p.par_commune(lu["quartiers"], crosswalk)
    assert communes["33192"] == [1_222.0, 633.0]  # MA + SAS du CP de Gradignan
    # MA de Belfort (0 détenu, 0 place) et CP de Vendin-le-Vieil (104 détenus,
    # 0 place au 1er juillet 2026) : des détenus sans places, pas de densité.
    assert communes["90010"] == [0.0, 0.0]
    assert communes["62842"][1] == 0.0

    regions = {
        departement: "region-test"
        for departement in map(p._departement, communes)
        if departement
    }
    candidates = p.aggreger(communes, regions, lu["periode"])
    valeurs = {(ind, niveau, code): valeur
               for ind, niveau, code, periode, valeur in candidates}
    assert all(periode == "2026-07" for _, _, _, periode, _ in candidates)
    assert valeurs[(p.DETENUS, "commune", "33192")] == 1_222.0
    assert valeurs[(p.DENSITE, "commune", "33192")] == 193.0
    assert (p.DENSITE, "commune", "90010") not in valeurs
    assert (p.DENSITE, "commune", "62842") not in valeurs
    assert valeurs[(p.DETENUS, "departement", "33")] == 1_222.0
    assert valeurs[(p.DETENUS, "pays", "FR")] == DETENUS_LUS
    assert valeurs[(p.DENSITE, "pays", "FR")] == round(100 * DETENUS_LUS / PLACES_LUES, 1)
    assert valeurs[(p.DETENUS, "region", "region-test")] == DETENUS_LUS - COM_DETENUS
    # Nouméa est une commune candidate mais n'alimente aucun département.
    assert (p.DETENUS, "commune", "98818") in valeurs
    assert not any(niveau == "departement" and code.startswith("98")
                   for _, niveau, code, _, _ in candidates)

    with pytest.raises(p.DonneesCarceralesIncoherentes, match="sans région"):
        p.aggreger(communes, {}, lu["periode"])


def test_la_couverture_se_mesure_en_detenus(lu, crosswalk):
    """Les communes des collectivités d'outre-mer sortent au référentiel —
    1 455 détenus, 1,6 % : la couverture les absorbe. Perdre une vraie part du
    parc, non."""
    candidates = p.aggreger(
        p.par_commune(lu["quartiers"], crosswalk),
        {d: "r" for d in map(p._departement, crosswalk.values()) if d},
        lu["periode"],
    )
    lus = p.detenus_par_maille(candidates)
    assert lus["pays"] == DETENUS_LUS
    gardees = [c for c in candidates
               if not (c[1] == "commune" and c[2][:2] == "98" and c[2] != "98")]
    sans_com = p.detenus_par_maille(
        [c for c in gardees if not (c[1] == "commune" and c[2].startswith(("98", "975")))]
    )
    parts = couverture.controler(lus, sans_com)
    assert 0.98 < parts["commune"] < 1.0
    with pytest.raises(couverture.CouvertureInsuffisante):
        couverture.controler(lus, {**lus, "commune": lus["commune"] * 0.5})


def test_les_fiches_portent_les_reserves():
    for identifiant, fiche in p.INDICATEURS.items():
        assert len(fiche["public"].split()) <= 50, identifiant
    # La commune d'implantation, pas l'origine des détenus — sans quoi le
    # lecteur croit à une carte de la délinquance résidentielle.
    assert "commune où" in p.INDICATEURS[p.DETENUS]["public"]
    assert "écroués non détenus" in p.INDICATEURS[p.DETENUS]["public"]
    assert "moyenne" in p.INDICATEURS[p.DENSITE]["public"]
    assert "commune d'implantation" in p.TECHNIQUE
    assert "écroués détenus" in p.TECHNIQUE
    assert "capacité opérationnelle" in p.TECHNIQUE
    # Ce que mesure NOTRE densité, contre celles publiées ailleurs.
    assert "moyenne des densités" in p.TECHNIQUE
    assert "densité nationale publiée par ailleurs" in p.TECHNIQUE
    # La licence n'est écrite nulle part sur le fichier : la fiche dit d'où
    # elle vient. Et l'URL introuvable autrement que par la page.
    assert "licence ouverte 2.0" in p.TECHNIQUE
    assert "pas constructible" in p.TECHNIQUE
    assert "NC" in p.TECHNIQUE and "jamais répartis" in p.TECHNIQUE


def _semer_le_jeu(conn) -> None:
    """L'entrepôt de test ne connaît ni la source ni le jeu : semés ici, sans
    quoi la clé étrangère du run refuse de démarrer."""
    conn.execute(
        "insert or ignore into meta.source_registry (source_id, name, producer,"
        " access_category, license) values (?, 'justice.gouv.fr — SDSE/DGAP',"
        " 'Ministère de la Justice', 'A', 'Licence Ouverte 2.0')",
        (p.SOURCE,),
    )
    conn.execute(
        "insert or ignore into meta.dataset_registry (dataset_id, source_id, title,"
        " priority) values (?, ?, 'Statistique des établissements pénitentiaires"
        " - personnes écrouées', 'P2')",
        (p.DATASET, p.SOURCE),
    )


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    _semer_le_jeu(entrepot_seme)
    p.declarer(entrepot_seme)
    p.declarer(entrepot_seme)
    lignes = {
        identifiant: (unite, sommable, granularite)
        for identifiant, unite, sommable, granularite in entrepot_seme.execute(
            "select indicator_id, unit, additive, time_granularity"
            " from core.indicators where dataset_id = ?", (p.DATASET,),
        ).fetchall()
    }
    # Des personnes s'additionnent entre territoires ; un taux d'occupation
    # jamais — sa valeur agrégée se recalcule sur les sommes.
    assert lignes == {
        p.DETENUS: ("count", True, "mensuelle"),
        p.DENSITE: ("percent", False, "mensuelle"),
    }
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, lu, crosswalk):
    """La DISP de Bordeaux entière, écrite aux quatre niveaux contre le vrai
    schéma : la région retrouve le total publié de la DISP (7 182 détenus,
    131,9 % de densité — le chiffre du tableau 8)."""
    from plateforme import entrepot, revisions
    from plateforme.normalize.geo import MILLESIME
    from plateforme.normalize.ofgl import filtrer_territoires_connus

    _semer_le_jeu(entrepot_seme)
    p.declarer(entrepot_seme)
    for niveau, code, nom, parent_niveau, parent in (
        ("pays", "FR", "France", None, None),
        ("region", "75", "Nouvelle-Aquitaine", "pays", "FR"),
        ("departement", "33", "Gironde", "region", "75"),
        ("commune", "33192", "Gradignan", "departement", "33"),
    ):
        entrepot_seme.execute(
            "insert or ignore into geo.geography_reference (geo_level, geo_code,"
            " vintage, name, parent_level, parent_code, flags)"
            " values (?, ?, ?, ?, ?, ?, '{}')",
            (niveau, code, MILLESIME, nom, parent_niveau, parent),
        )

    bordeaux = [q for q in lu["quartiers"] if q[0] == "Tab14"]
    communes = p.par_commune(bordeaux, crosswalk)
    regions = {d: "75" for d in map(p._departement, communes) if d}
    candidates = p.aggreger(communes, regions, lu["periode"])
    gardees, ecartes = filtrer_territoires_connus(entrepot_seme, candidates)
    run_id = entrepot.start_run(entrepot_seme, p.DATASET, "manual")
    ecrites, revisees = revisions.remplacer(
        entrepot_seme, run_id, sorted(p.INDICATEURS), p.COLONNES,
        [
            (indicateur, niveau, code, MILLESIME, periode, valeur)
            for indicateur, niveau, code, periode, valeur in gardees
        ],
    )
    entrepot_seme.commit()
    assert ecrites == 8, "détenus et densité aux quatre niveaux"
    assert revisees == 0
    assert len(ecartes) > 0, "les autres communes de la DISP ne sont pas au référentiel"
    observations = {
        (indicateur, niveau, code): valeur
        for indicateur, niveau, code, valeur in entrepot_seme.execute(
            "select indicator_id, geo_level, geo_code, value from core.observations"
            " where indicator_id in (select indicator_id from core.indicators"
            " where dataset_id = ?) and period = '2026-07'", (p.DATASET,),
        ).fetchall()
    }
    assert observations[(p.DETENUS, "commune", "33192")] == 1_222.0
    assert observations[(p.DETENUS, "region", "75")] == 7_182.0
    assert observations[(p.DENSITE, "region", "75")] == 131.9
    assert observations[(p.DETENUS, "pays", "FR")] == 7_182.0
