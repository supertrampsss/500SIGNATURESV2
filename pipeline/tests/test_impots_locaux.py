"""Le REI : trois lignes de la source confrontées entre elles.

Ce jeu ne se contrôle pas comme les autres. Il n'a pas de total à retrouver —
il a une identité comptable, base × taux = produit, que la source vérifie mal
elle-même : trois cents communes s'en écartent de plus d'un pour cent pour des
corrections qu'elle n'expose pas. Le contrôle porte donc sur la distribution,
et c'est lui qui a attrapé le défaut le plus discret de cette source.

La fixture est un extrait **réel** de l'export CSV du REI de l'OFGL, relevé le
8 août 2026 avec la requête exacte du module, octets conservés : la Gironde,
l'Ain et la Haute-Corse en entier sur les deux exercices — l'Ain parce que ses
codes commune perdent leur zéro de tête au millésime 2025 (« 01053 » en 2024,
« 1053 » en 2025), le défaut qui écartait en silence 3 135 communes des
départements 01 à 09 ; la Haute-Corse pour les codes 2B et parce que ses
communes ont gardé un produit de CFE exploitable, celui de l'Ain et de la
Gironde étant entièrement sous secret statistique — plus Saint-Martin, que la
DGFiP code hors du Code officiel géographique.
"""

import urllib.parse
from pathlib import Path

import pytest

from plateforme import couverture
from plateforme.normalize import impots_locaux as il

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def contenu() -> bytes:
    return (FIXTURES / "ofgl_rei_sample.csv").read_bytes()


@pytest.fixture(scope="module")
def lignes(contenu) -> dict:
    return il.lire(contenu)


def test_le_bom_ne_mange_pas_l_exercice(lignes):
    """L'export de l'OFGL commence par un BOM, qui se colle au nom de la
    première colonne. Lu en `utf-8` simple, `annee` revient vide et les deux
    exercices s'écrasent sous la même clé — la base d'une année se retrouve
    comparée au produit de l'autre. C'est le contrôle base × taux qui l'a
    signalé ; aucun total ne l'aurait montré."""
    exercices = {annee for _, annee, _ in lignes}
    assert exercices == {"2024", "2025"}
    assert "" not in exercices


def test_une_valeur_sous_secret_est_absente_et_non_nulle():
    csv_ = (
        "﻿annee;dep;idcom;var;valeur;secret_statistique\n"
        "2025;33;33063;E13;;sec_stat\n"
        "2025;33;33063;B13;100;\n"
    ).encode()
    lus = il.lire(csv_)
    assert ("33063", "2025", il.PRODUIT_FB) not in lus
    assert lus[("33063", "2025", "B13")] == 100.0


def test_le_code_commune_se_reconstruit_dans_les_deux_formes_de_la_source(lignes):
    """La source écrit « 01053 » en 2024 et « 1053 » en 2025 pour la même
    commune. Le code brut passé au référentiel écartait en silence les 3 135
    communes des départements 01 à 09 du millésime 2025 : 5,5 % du produit
    communal de l'exercice, et une couverture tombée à 94,5 % que la mesure en
    bloc sur les deux exercices (97,2 %) laissait passer. Les deux formes
    doivent retomber sous le même code Insee."""
    assert ("01053", "2024", il.PRODUIT_FB) in lignes
    assert ("01053", "2025", il.PRODUIT_FB) in lignes
    assert lignes[("01053", "2025", il.PRODUIT_FB)] == 28_163_471.0
    # Plus aucun code court : tout ce qui est lu est un code Insee de bonne forme.
    assert not [code for code, _, _ in lignes if len(code) != 5]


def test_saint_martin_est_ecarte_plutot_que_publie_sur_un_code_invente(lignes):
    """La DGFiP code Saint-Martin « 9788 » sous un département 978 qui n'est
    pas du Code officiel géographique. Reconstruire un code Insee lui
    fabriquerait un faux (« 97808 ») : la collectivité est écartée nommément,
    comme dans le connecteur `rei` dont la règle est reprise."""
    assert not [code for code, _, _ in lignes if code.startswith(("977", "978"))]


def test_la_colonne_du_departement_est_exigee():
    """Sans le département, le code Insee ne se reconstruit pas : la lecture
    refuse plutôt que d'écarter en silence les communes au code court."""
    entete = "﻿annee;idcom;var;valeur;secret_statistique\n"
    with pytest.raises(ValueError, match="dep"):
        il.lire((entete + "2025;33063;E13;100;\n").encode())


def test_un_code_irreconstructible_arrete_la_lecture():
    """Un identifiant qui ne se recompose pas depuis le département signifie
    que la source a encore changé son codage : refuser vaut mieux qu'écarter."""
    entete = "﻿annee;dep;idcom;var;valeur;secret_statistique\n"
    with pytest.raises(ValueError, match="ne se reconstruit pas"):
        il.lire((entete + "2025;33;9999999;E13;100;\n").encode())


def test_seuls_les_produits_communaux_sont_publies(lignes):
    """La même base décrit ce qui revient à l'intercommunalité, au département
    et aux chambres consulaires. La requête ne demande que la commune, et seuls
    les quatre produits sortent — la base, le taux et le lissage sont lus pour
    le contrôle, pas pour la publication."""
    publies = {cle for cle, _, _, _, _ in il.valeurs_publiees(lignes)}
    assert publies == {identifiant for identifiant, _ in il.PRODUITS.values()}
    adresse = il.url((il.PRODUIT_FB,))
    assert urllib.parse.quote("destinataire='Commune'") in adresse
    # Le département fait partie de la requête : sans lui le code Insee ne se
    # reconstruit pas, et la source a déjà changé la forme de ses identifiants.
    assert "select=annee,dep,idcom,var,valeur,secret_statistique" in adresse


def test_l_identite_tient_en_masse_et_au_total(lignes):
    verifies = il.controler(lignes)
    assert verifies["communes_verifiees"] > 500
    assert verifies["ecart_median"] <= il.ECART_MEDIAN_MAXIMUM
    assert verifies["part_sous_un_pourcent"] >= il.PART_MINIMALE_SOUS_UN_POURCENT
    assert verifies["ecart_agrege"] <= il.ECART_AGREGE_MAXIMUM


def test_le_controle_bloque_si_toutes_les_communes_decrochent(lignes):
    """Un taux lu sur la ligne du département, ou une base prise sur un autre
    impôt, décale toutes les communes à la fois : c'est cela que le contrôle
    cherche, pas la commune la plus atypique."""
    fausses = {
        cle: (valeur * 2 if cle[2] == il.TAUX_FB else valeur)
        for cle, valeur in lignes.items()
    }
    with pytest.raises(il.IdentiteRompue, match="écart médian"):
        il.controler(fausses)


def test_le_controle_bloque_si_la_somme_France_decroche(lignes):
    """Une poignée de communes très grosses peut décrocher sans bouger la
    médiane : la somme les rattrape."""
    plus_grosse = max(
        (cle for cle in lignes if cle[2] == il.PRODUIT_FB),
        key=lambda cle: lignes[cle],
    )
    fausses = dict(lignes)
    fausses[plus_grosse] = lignes[plus_grosse] * 3
    with pytest.raises(il.IdentiteRompue, match="somme France"):
        il.controler(fausses)


def test_le_controle_echoue_s_il_n_a_rien_a_verifier():
    with pytest.raises(il.IdentiteRompue, match="aucune commune"):
        il.controler({})


def test_le_temoin_de_bourg_en_bresse_est_la_seconde_prise(lignes):
    """L'identité base × taux reste parfaitement cohérente quand un code
    commune change de forme et sort de la lecture : c'est le témoin qui voit
    cela. Relevé à la main le 8 août 2026 sur l'API de l'OFGL (dataset `rei`,
    destinataire « Commune », dep « 01 », idcom « 1053 », millésime 2025)."""
    verifies = il.controler(lignes)
    assert verifies["temoin"][il.PRODUIT_FB] == 28_163_471.0
    assert verifies["temoin"]["H13THS"] == 433_910.0


def test_le_controle_rejoue_le_bug_des_codes_courts(lignes):
    """Le bug d'origine : les codes 2025 sans zéro de tête passaient bruts au
    référentiel, et les communes des départements 01 à 09 disparaissaient du
    seul millésime 2025, l'identité base × taux restant saine sur ce qui
    restait. Rejoué en retirant l'Ain du millésime 2025 : le témoin manque et
    bloque, quand l'ancien contrôle ne voyait rien."""
    sans_ain_2025 = {
        (code, annee, variable): valeur
        for (code, annee, variable), valeur in lignes.items()
        if not (annee == "2025" and code.startswith("01"))
    }
    with pytest.raises(il.IdentiteRompue, match="témoin 01053"):
        il.controler(sans_ain_2025)


def test_le_controle_bloque_si_le_temoin_derive(lignes):
    decale = dict(lignes)
    decale[("01053", "2025", il.PRODUIT_FB)] = (
        lignes[("01053", "2025", il.PRODUIT_FB)] * 1.02
    )
    with pytest.raises(il.IdentiteRompue, match="témoin 01053"):
        il.controler(decale)


def test_le_controle_bloque_si_l_exercice_du_temoin_disparait(lignes):
    """Un nouveau millésime remplacera 2025 : le témoin devra être relevé à
    nouveau sur la source, pas contourné."""
    sans_2025 = {
        cle: valeur for cle, valeur in lignes.items() if cle[1] != il.TEMOIN_EXERCICE
    }
    with pytest.raises(il.IdentiteRompue, match="n'est plus dans la source"):
        il.controler(sans_2025)


def test_bordeaux_n_a_pas_de_produit_de_CFE(lignes):
    """Sa métropole la lève à sa place. Zéro ne veut pas dire aucune
    entreprise, et c'est la première chose que dit la fiche."""
    bordeaux = {
        variable: valeur
        for (code, annee, variable), valeur in lignes.items()
        if code == "33063" and annee == "2025"
    }
    assert bordeaux["E13"] == 248422691.0
    assert bordeaux["H13THS"] == 6334778.0
    assert "P13" not in bordeaux
    assert "intercommunalité" in il.PUBLIQUE["dgfip_produit_cfe"]


def test_les_fiches_disent_la_taxe_d_habitation_supprimee():
    assert "résidences secondaires" in il.PUBLIQUE[
        "dgfip_produit_th_residences_secondaires"
    ]
    assert "supprimée pour tous en 2023" in il.PUBLIQUE[
        "dgfip_produit_th_residences_secondaires"
    ]
    assert "supprimée" in il.TECHNIQUE
    assert "ne sont pas la décomposition" in il.TECHNIQUE
    for identifiant, publique in il.PUBLIQUE.items():
        assert len(publique.split()) <= 50, identifiant


def test_la_couverture_se_mesure_en_euros_et_par_exercice(lignes):
    """En euros : trois communes perdues ne pèsent rien si elles portent trois
    mille euros, et tout si elles portent Bordeaux. Et **par exercice** :
    mesurée sur les deux exercices ensemble, la perte des départements 01 à 09
    du seul millésime 2025 laissait la couverture à 97,2 %, au-dessus du seuil
    de 95 %, quand l'exercice seul était tombé à 94,5 %. La falaise d'un
    millésime doit sonner seule."""
    candidates = il.valeurs_publiees(lignes)
    lus = il.foncier_par_maille(candidates)
    assert set(lus) == {"commune 2024", "commune 2025"}
    assert all(total > 0 for total in lus.values())
    couverture.controler(lus, lus)
    # Le bug rejoué côté couverture : l'Ain disparaît du seul millésime 2025,
    # comme quand ses codes courts tombaient au filtre du référentiel. C'est la
    # maille « commune 2025 » qui sonne, l'exercice 2024 n'y change rien.
    sans_ain_2025 = il.foncier_par_maille([
        ligne for ligne in candidates
        if not (ligne[3] == "2025" and ligne[2].startswith("01"))
    ])
    assert sans_ain_2025["commune 2024"] == lus["commune 2024"]
    with pytest.raises(couverture.CouvertureInsuffisante, match="commune 2025"):
        couverture.controler(lus, sans_ain_2025)


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    il.declarer(entrepot_seme)
    il.declarer(entrepot_seme)
    publies = dict(entrepot_seme.execute(
        "select indicator_id, unit from core.indicators where dataset_id = ?",
        (il.DATASET,),
    ).fetchall())
    assert set(publies) == {identifiant for identifiant, _ in il.PRODUITS.values()}
    assert set(publies.values()) == {"EUR"}
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, lignes):
    from plateforme import entrepot

    il.declarer(entrepot_seme)
    for code, nom in (("33063", "Bordeaux"), ("01053", "Bourg-en-Bresse")):
        entrepot_seme.execute(
            "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
            " parent_level, parent_code, flags) values ('commune', ?, ?, ?,"
            " null, null, '{}')",
            (code, il.MILLESIME, nom),
        )
    run_id = entrepot.start_run(entrepot_seme, il.DATASET, "manual")
    ecrites, ecartes, revisees, reconnus = il.ecrire(entrepot_seme, run_id, lignes)
    entrepot_seme.commit()
    assert ecrites > 0 and ecartes > 0, "les communes hors référentiel sont écartées"
    assert revisees == 0, "rien à réviser au premier chargement"
    (valeur,) = entrepot_seme.execute(
        "select value from core.observations"
        " where indicator_id = 'dgfip_produit_foncier_bati' and geo_code = '33063'"
        " and period = '2025'"
    ).fetchone()
    assert valeur == 248422691.0
    # Bourg-en-Bresse est « 1053 » dans la source 2025 : le code reconstruit,
    # elle est écrite sur les deux exercices et non plus écartée en silence.
    (bourg,) = entrepot_seme.execute(
        "select value from core.observations"
        " where indicator_id = 'dgfip_produit_foncier_bati' and geo_code = '01053'"
        " and period = '2025'"
    ).fetchone()
    assert bourg == 28163471.0
    assert reconnus["commune 2024"] > 0 and reconnus["commune 2025"] > 0


def test_un_produit_corrige_est_archive_et_non_ecrase(entrepot_seme, lignes):
    """L'OFGL republie le REI corrections comprises. Un montant rectifié après
    coup doit rester lisible comme une révision : ce jeu se lit d'une année à
    l'autre, et un lecteur qui a cité un produit doit pouvoir constater qu'il a
    bougé."""
    from plateforme import entrepot

    il.declarer(entrepot_seme)
    entrepot_seme.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code, flags) values ('commune', '33063', ?, 'Bordeaux',"
        " null, null, '{}')",
        (il.MILLESIME,),
    )
    premier = entrepot.start_run(entrepot_seme, il.DATASET, "manual")
    il.ecrire(entrepot_seme, premier, lignes)
    corrigees = dict(lignes)
    corrigees[("33063", "2025", il.PRODUIT_FB)] = 250000000.0
    second = entrepot.start_run(entrepot_seme, il.DATASET, "manual")
    _, _, revisees, _ = il.ecrire(entrepot_seme, second, corrigees)
    entrepot_seme.commit()
    assert revisees == 1
    (ancienne,) = entrepot_seme.execute(
        "select old_value from core.observations_revisions"
        " where indicator_id = 'dgfip_produit_foncier_bati' and geo_code = '33063'"
        " and period = '2025'"
    ).fetchone()
    assert ancienne == 248422691.0
    (courante,) = entrepot_seme.execute(
        "select value from core.observations"
        " where indicator_id = 'dgfip_produit_foncier_bati' and geo_code = '33063'"
        " and period = '2025'"
    ).fetchone()
    assert courante == 250000000.0
