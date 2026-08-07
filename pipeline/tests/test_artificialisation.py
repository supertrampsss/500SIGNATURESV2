"""La consommation d'espaces NAF : identités exactes et témoin girondin.

La fixture est un extrait **réel** du fichier `conso_com.csv` du Cerema
(millésime 2025, révisé le 24 juillet 2026 sur data.gouv.fr), gardé octet pour
octet : la Gironde entière — les 534 communes dont la somme du flux 2023 fait
le témoin figé —, Paris, Lyon et Marseille en communes entières, quatre
communes d'outre-mer (971 à 974) et une commune rurale à flux nuls.

Les identités internes du fichier sont exactes — somme des flux = total
2011-2025, somme des destinations = flux —, si bien qu'une lecture tronquée
les laisse toutes parfaites. C'est le témoin girondin, relevé à la main, qui
mord — et ces tests le font mordre.
"""

from pathlib import Path

import pytest

from plateforme import couverture
from plateforme.normalize import artificialisation as a

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def contenu() -> bytes:
    return (FIXTURES / "cerema_conso_com_sample.csv").read_bytes()


@pytest.fixture(scope="module")
def conso(contenu):
    return a.lire(contenu)


def test_les_temoins_se_relisent_depuis_le_fichier_reel(conso):
    """Valeurs relevées à la main sur le fichier du 24 juillet 2026 (le
    7 août 2026) : Bordeaux a consommé 7 351 m² en 2023 — dont 0 pour
    l'habitat, la destination n'est jamais devinée — et Marseille 131 106 m²,
    dont 85 565 pour l'habitat. Tout est en mètres carrés : le total
    2011-2025 de Bordeaux, 82 097 m², fait 8,2 ha — une valeur en hectares
    ferait des flux mille fois trop petits."""
    bordeaux = conso["33063"]
    assert bordeaux["annees"][2023] == (7_351.0, 0.0, 7_351.0)
    assert bordeaux["total"] == 82_097.0
    assert conso["13055"]["annees"][2023][:2] == (131_106.0, 85_565.0)
    # Les quatorze flux annuels de la fenêtre 2011-2024, rien d'autre.
    assert sorted(bordeaux["annees"]) == list(range(2011, 2025))


def test_l_outre_mer_et_les_zeros_sont_dans_le_fichier(conso):
    """Guadeloupe, Martinique, Guyane et La Réunion sont servies par le
    fichier national — Mayotte non, hors fichiers fonciers. Et un flux nul
    est une mesure (rien n'a été consommé), pas un trou : L'Abergement-
    Clémenciat n'a rien consommé en 2011 et la ligne existe."""
    assert {"97101", "97209", "97302", "97411"} <= set(conso)
    assert conso["97101"]["annees"][2023][0] == 169_332.0
    assert conso["01001"]["annees"][2011][0] == 0.0


def test_deux_indicateurs_par_commune_et_par_annee_zeros_compris(conso):
    """Chaque flux annuel devient une période « N » (le portail dit « l'année
    2024 » pour naf24art25) ; le flux total et sa part habitat s'écrivent,
    zéros compris."""
    lignes = a.lignes_a_ecrire(conso)
    assert len(lignes) == len(conso) * 14 * 2
    bordeaux = {
        (ind, periode): valeur
        for ind, niveau, code, millesime, periode, valeur in lignes
        if code == "33063"
    }
    assert bordeaux[("cerema_espaces_consommes", "2023")] == 7_351.0
    assert bordeaux[("cerema_espaces_consommes_habitat", "2023")] == 0.0
    assert {periode for _, periode in bordeaux} == {
        str(annee) for annee in range(2011, 2025)
    }
    # Le zéro s'écrit : une commune sans consommation n'est pas une absente.
    zero = [v for (ind, n, code, m, p, v) in lignes if code == "01001" and p == "2011"]
    assert zero == [0.0, 0.0]


def test_les_identites_et_le_temoin_tiennent_sur_le_fichier_reel(conso):
    verifies = a.controler(conso)
    assert verifies["communes"] == 542  # 534 girondines + PLM + 4 DROM + 01001
    assert verifies["temoin_gironde_m2"] == a.TEMOIN_GIRONDE


def test_le_controle_bloque_quand_les_colonnes_ne_se_recoupent_plus(conso):
    """Une lecture recomposée casse l'une des deux identités exactes : la somme
    des flux ne retombe plus sur le total 2011-2025, ou les six destinations
    ne font plus le flux."""
    fausses = {code: {"total": ligne["total"], "annees": dict(ligne["annees"])}
               for code, ligne in conso.items()}
    flux, habitat, destinations = fausses["33063"]["annees"][2023]
    fausses["33063"]["annees"][2023] = (flux + 500.0, habitat, destinations + 500.0)
    with pytest.raises(a.ConsoIncoherente, match="somme des flux"):
        a.controler(fausses)
    fausses["33063"]["annees"][2023] = (flux, habitat + 500.0, destinations + 500.0)
    with pytest.raises(a.ConsoIncoherente, match="destinations"):
        a.controler(fausses)
    with pytest.raises(a.ConsoIncoherente, match="aucune commune"):
        a.controler({})


def test_le_temoin_gironde_mord_sur_une_lecture_amputee(conso):
    """Le défaut que les identités exactes ne peuvent pas voir : un fichier
    tronqué reste parfaitement cohérent ligne à ligne. Amputer Hourtin —
    265 067 m², 8,5 % du témoin — doit lever."""
    ampute = {code: ligne for code, ligne in conso.items() if code != "33203"}
    a.controler(conso)
    with pytest.raises(a.ConsoIncoherente, match="Gironde"):
        a.controler(ampute)


def test_un_fichier_qui_change_de_forme_arrete_la_lecture(contenu):
    """Un flux annuel hors fenêtre n'est pas une colonne de plus : c'est un
    nouveau millésime — la fenêtre a déjà glissé de 2009-2024 à 2011-2025 —
    et le témoin doit être relevé à nouveau avant de recharger. Même refus
    pour une colonne disparue, un flux ou un habitat négatif (la renaturation
    n'est pas déduite du flux) ou un code hors COG."""
    entete, corps = contenu.split(b"\n", 1)
    with pytest.raises(ValueError, match="fenêtre"):
        a.lire(entete.replace(b"naf11art21", b"naf25art26") + b"\n" + corps)
    with pytest.raises(ValueError, match="changé de format"):
        a.lire(entete.replace(b"naf23art24", b"naf23xxx24") + b"\n" + corps)
    # ,7351.0, : le flux 2023 de Bordeaux ; ,85565.0, : l'habitat 2023 de
    # Marseille — premières occurrences vérifiées sur les octets de la fixture.
    with pytest.raises(ValueError, match="négative"):
        a.lire(contenu.replace(b",7351.0,", b",-7351.0,", 1))
    with pytest.raises(ValueError, match="négative"):
        a.lire(contenu.replace(b",85565.0,", b",-85565.0,", 1))
    with pytest.raises(ValueError, match="code commune"):
        a.lire(contenu.replace(b"\n33063,", b"\nA3063,", 1))


def test_le_residu_d_arrondi_de_la_destination_inconnue_est_tolere(conso, contenu):
    """Découvert sur le fichier réel : 31 cellules de destination « inconnue »
    à −1 ou −2 m² — le résidu d'arrondi de la source quand elle solde le flux
    par différence. Saint-André-du-Bois (33367) en porte un en 2012, la
    fixture le garde : la lecture l'accepte et l'identité des destinations
    tient exactement. Au-delà du résidu, ce n'est plus de l'arrondi."""
    flux, habitat, destinations = conso["33367"]["annees"][2012]
    assert (flux, habitat, destinations) == (4_322.0, 2_581.0, 4_322.0)
    lignes = contenu.split(b"\n")
    rang = next(i for i, ligne in enumerate(lignes) if ligne.startswith(b"33367,"))
    lignes[rang] = lignes[rang].replace(b",-1.0,", b",-100.0,", 1)  # art12inc13
    with pytest.raises(ValueError, match="négative"):
        a.lire(b"\n".join(lignes))


def test_la_couverture_se_mesure_en_surface_consommee(conso):
    """La couverture compte des mètres carrés consommés, pas des communes : la
    Gironde, 534 codes sur 542, porte 91 % de la surface de la fixture — la
    perdre au référentiel doit lever. Et seul le flux total entre dans la
    masse — l'habitat en est une part, l'additionner compterait deux fois le
    même terrain."""
    lignes = a.lignes_a_ecrire(conso)
    masse = a.surface_par_maille(lignes)
    assert masse["commune"] == pytest.approx(
        sum(ligne["total"] for ligne in conso.values())
    )
    couverture.controler(masse, masse)
    sans_gironde = a.surface_par_maille(
        [ligne for ligne in lignes if not ligne[2].startswith("33")]
    )
    with pytest.raises(couverture.CouvertureInsuffisante):
        couverture.controler(masse, sans_gironde)


def test_les_fiches_disent_les_metres_carres_le_provisoire_et_le_bon_mot():
    """Les réserves qu'aucun nombre ne porte : l'unité est le mètre carré, la
    dernière année est provisoire, et « consommation d'espaces » n'est pas
    « l'artificialisation » au sens strict de la loi — la fiche du flux total
    porte la distinction, sans jargon."""
    for identifiant, (_libelle, publique, _formule) in a.INDICATEURS.items():
        assert len(publique.split()) <= 50, identifiant
        assert "mètres carrés" in publique
        assert "provisoire" in publique
    assert "artificialisation" in a.INDICATEURS["cerema_espaces_consommes"][1]
    assert "logements" in a.INDICATEURS["cerema_espaces_consommes_habitat"][1]
    assert "OCSGE" in a.TECHNIQUE and "renaturation" in a.TECHNIQUE
    assert "provisoire" in a.TECHNIQUE and "COG 2025" in a.TECHNIQUE
    assert "Mayotte" in a.TECHNIQUE


def _semer_le_jeu(conn) -> None:
    """L'entrepôt de test ne charge pas les CSV du registre versionné : le jeu
    et sa source sont semés ici, sans quoi la clé étrangère du run refuse de
    démarrer."""
    conn.execute(
        "insert or ignore into meta.source_registry (source_id, name, producer,"
        " access_category, license) values (?,"
        " 'artificialisation.developpement-durable.gouv.fr', 'Cerema', 'A',"
        " 'Licence Ouverte 2.0')",
        (a.SOURCE,),
    )
    conn.execute(
        "insert or ignore into meta.dataset_registry (dataset_id, source_id, title,"
        " priority) values (?, ?,"
        " 'Cerema - Consommation d''espaces NAF par commune', 'P2')",
        (a.DATASET, a.SOURCE),
    )


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    _semer_le_jeu(entrepot_seme)
    a.declarer(entrepot_seme)
    a.declarer(entrepot_seme)
    for identifiant in a.INDICATEURS:
        unite, sommable, publie, theme = entrepot_seme.execute(
            "select unit, additive, published, theme from core.indicators"
            " where indicator_id = ?",
            (identifiant,),
        ).fetchone()
        # Des mètres carrés s'additionnent entre communes — c'est même ce que
        # fait le témoin girondin.
        assert unite == "m2"
        assert sommable is True and publie is True
        assert theme == "environnement"
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, conso):
    from plateforme import entrepot, revisions
    from plateforme.normalize.ofgl import filtrer_territoires_connus

    _semer_le_jeu(entrepot_seme)
    a.declarer(entrepot_seme)
    for code, nom in (("33063", "Bordeaux"), ("13055", "Marseille")):
        entrepot_seme.execute(
            "insert into geo.geography_reference (geo_level, geo_code, vintage,"
            " name, parent_level, parent_code, flags) values ('commune', ?, ?, ?,"
            " 'departement', ?, '{}')",
            (code, a.MILLESIME, nom, code[:2]),
        )
    run_id = entrepot.start_run(entrepot_seme, a.DATASET, "manual")
    gardees, ecartes = filtrer_territoires_connus(
        entrepot_seme, a.lignes_a_ecrire(conso)
    )
    ecrites, revisees = revisions.remplacer(
        entrepot_seme, run_id, sorted(a.INDICATEURS), a.COLONNES, gardees
    )
    entrepot_seme.commit()
    assert ecrites == 56, "deux communes, quatorze flux, deux indicateurs"
    assert revisees == 0
    assert len(ecartes) == 540, "les 533 autres girondines, PLM restants, DROM, 01001"
    (bordeaux,) = entrepot_seme.execute(
        "select value from core.observations where indicator_id ="
        " 'cerema_espaces_consommes' and geo_code = '33063' and period = '2023'"
    ).fetchone()
    assert bordeaux == 7_351.0
    (habitat,) = entrepot_seme.execute(
        "select value from core.observations where indicator_id ="
        " 'cerema_espaces_consommes_habitat' and geo_code = '13055'"
        " and period = '2023'"
    ).fetchone()
    assert habitat == 85_565.0
