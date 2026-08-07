"""Les DEFM communales : deux prises indépendantes sur un fichier arrondi à 5.

La fixture est un extrait **réel** de l'export CSV de la Dares (BOM UTF-8,
séparateur `;`, intitulés `use_labels`), découpé par une clause `where` et
gardé octet pour octet : la Gironde entière au 2024-T4 — les 534 communes dont
la somme fait le témoin figé —, Bordeaux sur les dix quatrièmes trimestres, et
Paris, Lyon, Marseille avec un arrondissement chacun, parce que la source
publie les deux et que c'est le piège du fichier.

Aucun total interne ne voit une lecture tronquée : l'identité Hommes + Femmes
reste parfaite sur ce qui a survécu. C'est le témoin girondin, relevé hors du
pipeline, qui mord — et ces tests le font mordre.
"""

from pathlib import Path

import pytest

from plateforme import couverture
from plateforme.normalize import defm as d

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def contenu() -> bytes:
    return (FIXTURES / "dares_defm_communales_sample.csv").read_bytes()


@pytest.fixture(scope="module")
def defm(contenu):
    return d.lire(contenu)


def test_le_temoin_bordeaux_se_relit_depuis_l_export_reel(defm):
    """Bordeaux, 2024-T4, Total/Total : 29 190, vérifié sur l'API le 7 août
    2026. Les trois lignes de sexe sont là — le contrôle d'identité en vit —
    et tout est multiple de 5, comme la Dares publie."""
    bordeaux = defm[("33063", "2024-T4")]
    assert bordeaux["Total"] == 29_190
    assert bordeaux == {"Total": 29_190, "Hommes": 15_120, "Femmes": 14_070}
    assert all(
        valeur % 5 == 0 for sexes in defm.values() for valeur in sexes.values()
    )
    # Les dix quatrièmes trimestres de Bordeaux, et rien d'autre comme dates.
    assert sorted(date for code, date in defm if code == "33063") == [
        f"{annee}-T4" for annee in range(2015, 2025)
    ]


def test_seul_le_total_total_est_publie_a_la_periode_annee(defm):
    """Le filtre du connecteur : sexe Total, tranche Total, période « 2024 » —
    pas « 2024-T4 ». Publier un trimestre laisserait croire à une série
    trimestrielle ; la fiche dit ce que l'année recouvre."""
    lignes = d.lignes_a_ecrire(defm)
    assert all(ligne[0] == d.INDICATEUR and ligne[1] == "commune" for ligne in lignes)
    bordeaux = {periode: valeur for _, _, code, _, periode, valeur in lignes
                if code == "33063"}
    assert bordeaux["2024"] == 29_190.0
    assert len(bordeaux) == 10 and all(len(p) == 4 for p in bordeaux)


def test_les_arrondissements_sont_ecartes_pas_replies(defm):
    """La source publie Paris **deux fois** : 75056 et ses arrondissements, et
    75056 vaut déjà leur somme (196 995 au 2024-T4, vérifié sur l'API). Un
    repli par `commune_mere` — le réflexe des autres connecteurs — doublerait
    Paris ; ici c'est l'écart pur qui est juste."""
    assert ("75056", "2024-T4") in defm and ("75101", "2024-T4") in defm
    assert defm[("75056", "2024-T4")]["Total"] == 196_995
    codes = {code for _, _, code, _, _, _ in d.lignes_a_ecrire(defm)}
    assert {"75056", "69123", "13055"} <= codes
    assert not {code for code in codes if code.startswith(("751", "6938", "132"))}


def test_les_cumuls_au_code_total_sont_ecartes(contenu):
    """L'export complet porte des lignes au code commune « Total » — cinq
    caractères, elles passaient le contrôle de longueur — qui rangent sous un
    même code plusieurs cumuls distingués par le seul libellé (« Total France
    métropolitaine », « Non localisés en France métropolitaine »…). Clées sur
    (code, date), elles s'écrasaient entre elles et cassaient l'identité des
    sexes en production (écart 316 545 sur 2015-T4). Relevées sur l'API le
    7 août 2026, octets conformes à l'export."""
    cumuls = (
        "2015-T4;Total;Total;Total;Total;Total;Total France métropolitaine;"
        "Brutes;ABC;Total;Total;5537925\r\n"
        "2015-T4;Total;Total;Total;Total;Total;Non localisés en France "
        "métropolitaine;Brutes;ABC;Hommes;Total;3585\r\n"
        "2015-T4;Total;Total;Total;Total;Total;Non localisés en France "
        "métropolitaine;Brutes;ABC;Femmes;Total;2820\r\n"
    ).encode()
    complet = contenu + (b"" if contenu.endswith(b"\n") else b"\r\n") + cumuls
    defm = d.lire(complet)
    assert not any(code == d.CUMUL for code, _ in defm)
    d.controler(defm)


def test_l_identite_hommes_femmes_tient_sur_tout_le_fichier(defm):
    verifies = d.controler(defm)
    assert verifies["communes"] == 540  # 534 girondines + Paris, Lyon, Marseille
    assert verifies["identites_verifiees"] > 500
    assert verifies["ecart_identite_maximal"] <= d.TOLERANCE_IDENTITE
    assert verifies["temoin_gironde"] == d.TEMOIN_GIRONDE


def test_le_controle_bloque_quand_les_sexes_ne_se_recoupent_plus(defm):
    """Une colonne décalée ou un fichier recomposé ne change aucun total par
    sexe : seule l'identité par commune-date le voit."""
    fausses = {cle: dict(sexes) for cle, sexes in defm.items()}
    fausses[("33318", "2024-T4")]["Hommes"] += 100
    with pytest.raises(d.DefmIncoherentes, match="Hommes \\+ Femmes"):
        d.controler(fausses)
    # Marseille cumule l'arrondi de seize arrondissements : son écart de 20
    # est de l'arrondi, pas une incohérence, et il ne doit pas bloquer.
    assert abs(
        defm[("13055", "2017-T4")]["Hommes"] + defm[("13055", "2017-T4")]["Femmes"]
        - defm[("13055", "2017-T4")]["Total"]
    ) > d.TOLERANCE_IDENTITE
    d.controler(defm)


def test_le_temoin_gironde_mord_sur_une_lecture_amputee(defm):
    """Le défaut que l'identité ne peut pas voir : un fichier tronqué garde
    toutes ses lignes cohérentes entre elles. Amputer Bordeaux — 20 % du
    témoin — doit lever, et un fichier vide aussi."""
    ampute = {cle: sexes for cle, sexes in defm.items() if cle[0] != "33063"}
    with pytest.raises(d.DefmIncoherentes, match="Gironde"):
        d.controler(ampute)
    with pytest.raises(d.DefmIncoherentes, match="aucun compte"):
        d.controler({})
    # Sans les lignes Hommes/Femmes, l'identité ne vérifie plus rien — et le
    # dire vaut mieux que passer vert sur un contrôle vide.
    with pytest.raises(d.DefmIncoherentes, match="trois lignes"):
        d.controler({cle: {"Total": sexes["Total"]}
                     for cle, sexes in defm.items() if "Total" in sexes})


def test_une_serie_qui_change_de_forme_arrete_la_lecture(contenu):
    """Un T1 qui apparaît n'est pas une ligne de plus : une moyenne annuelle ou
    un stock n'est plus la même mesure. Même refus pour une catégorie seule,
    des données CVS ou des intitulés remaniés."""
    with pytest.raises(ValueError, match="quatrièmes trimestres"):
        d.lire(contenu.replace(b"2024-T4", b"2024-T1"))
    with pytest.raises(ValueError, match="définition a changé"):
        d.lire(contenu.replace(b";Brutes;", b";CVS;"))
    with pytest.raises(ValueError, match="intitulés"):
        d.lire(contenu.replace(b"Code commune", b"Commune code"))


def test_la_couverture_se_mesure_en_inscrits(defm):
    """Perdre Paris au référentiel ne pèserait pas une commune sur 35 000 :
    il pèserait deux cents mille inscrits. La couverture compte des personnes,
    pas des codes."""
    lignes = d.lignes_a_ecrire(defm)
    masse = {"commune": sum(ligne[5] for ligne in lignes)}
    couverture.controler(masse, masse)
    sans_paris = sum(ligne[5] for ligne in lignes if ligne[2] != "75056")
    with pytest.raises(couverture.CouvertureInsuffisante):
        couverture.controler(masse, {"commune": sans_paris})


def test_la_fiche_dit_la_moyenne_l_arrondi_et_les_trois_chomages():
    """Trois réserves qu'aucun nombre ne porte : c'est une moyenne du T4 et non
    un stock au 31 décembre, A+B+C inclut l'activité réduite, tout est arrondi
    à 5. Et la phrase qui sépare les trois mesures du chômage du site."""
    assert len(d.PUBLIQUE.split()) <= 50
    assert "quatrième trimestre" in d.PUBLIQUE and "31 décembre" in d.PUBLIQUE
    assert "activité réduite" in d.PUBLIQUE
    assert "cinq" in d.PUBLIQUE
    assert "BIT" in d.PUBLIQUE and "recensement" in d.PUBLIQUE


def test_la_rupture_de_2025_est_ecrite_dans_la_definition_technique():
    """Non négociable : le jour où 2025-T4 paraît, la série casse — inscription
    automatique des bénéficiaires du RSA, loi pour le plein emploi. La
    définition technique est l'endroit durable où le lecteur de 2026 le
    trouvera, pas un commentaire de code."""
    assert "Rupture attendue en 2025" in d.TECHNIQUE
    assert "RSA" in d.TECHNIQUE and "plein emploi" in d.TECHNIQUE
    assert "pas comparable" in d.TECHNIQUE
    # Le reste de la charge technique : brut non CVS, COG 2024, arrondi.
    assert "non corrigées des variations saisonnières" in d.TECHNIQUE
    assert "COG 2024" in d.TECHNIQUE
    assert "multiple de 5" in d.TECHNIQUE


def _semer_le_jeu(conn) -> None:
    """L'entrepôt de test ne charge pas les CSV du registre versionné : le jeu
    et sa source sont semés ici, sans quoi la clé étrangère du run refuse de
    démarrer et `verifier_integrite` compterait le jeu comme orphelin."""
    conn.execute(
        "insert or ignore into meta.source_registry (source_id, name, producer,"
        " access_category, license) values (?,"
        " 'data.dares.travail-emploi.gouv.fr', 'Dares', 'A', 'Licence Ouverte 2.0')",
        (d.SOURCE,),
    )
    conn.execute(
        "insert or ignore into meta.dataset_registry (dataset_id, source_id, title,"
        " priority) values (?, ?, 'Dares - DEFM par commune (donnees brutes)', 'P2')",
        (d.DATASET, d.SOURCE),
    )


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    _semer_le_jeu(entrepot_seme)
    d.declarer(entrepot_seme)
    d.declarer(entrepot_seme)
    (unite, sommable, publie) = entrepot_seme.execute(
        "select unit, additive, published from core.indicators where indicator_id = ?",
        (d.INDICATEUR,),
    ).fetchone()
    # Un compte d'inscrits s'additionne entre communes — c'est même ce que fait
    # le témoin girondin — à l'arrondi à 5 près.
    assert unite == "count"
    assert sommable is True and publie is True
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, defm):
    from plateforme import entrepot, revisions
    from plateforme.normalize.ofgl import filtrer_territoires_connus

    _semer_le_jeu(entrepot_seme)
    d.declarer(entrepot_seme)
    for code, nom in (("33063", "Bordeaux"), ("75056", "Paris")):
        entrepot_seme.execute(
            "insert into geo.geography_reference (geo_level, geo_code, vintage,"
            " name, parent_level, parent_code, flags) values ('commune', ?, ?, ?,"
            " 'departement', ?, '{}')",
            (code, d.MILLESIME, nom, code[:2]),
        )
    run_id = entrepot.start_run(entrepot_seme, d.DATASET, "manual")
    gardees, ecartes = filtrer_territoires_connus(entrepot_seme, d.lignes_a_ecrire(defm))
    ecrites, revisees = revisions.remplacer(
        entrepot_seme, run_id, [d.INDICATEUR], d.COLONNES, gardees
    )
    entrepot_seme.commit()
    assert ecrites == 20, "deux communes au référentiel, dix quatrièmes trimestres"
    assert revisees == 0
    assert len(ecartes) == 535, "les 533 autres girondines, Lyon et Marseille"
    (bordeaux,) = entrepot_seme.execute(
        "select value from core.observations where indicator_id = ?"
        " and geo_code = '33063' and period = '2024'",
        (d.INDICATEUR,),
    ).fetchone()
    assert bordeaux == 29_190.0
