"""Le budget de la Sécurité sociale poste par poste : lecture, contrôles, refus.

Les fixtures sont les deux annexes chiffrées du PLFSS 2026, réduites aux quatre
onglets lus mais **cellule pour cellule** : les montants y sont ceux que la
Direction de la sécurité sociale publie, au millième de million. Un échantillon
fabriqué satisferait par construction le contrôle central — les postes font leur
total des deux côtés, et le résultat net est leur différence. Sur la matière
réelle, il ne se satisfait pas tout seul.

Ce que ces tests cherchent d'abord, ce n'est pas que la lecture marche : c'est
que chaque contrôle **refuse** ce qu'il prétend refuser. Un contrôle qu'aucun
test ne fait tomber est une décoration.
"""

import pathlib

import pytest

from plateforme import couverture
from plateforme.normalize import plfss as m

FIXTURES = pathlib.Path(__file__).parent / "fixtures"

# Relevés à l'écran sur les annexes du PLFSS 2026, en millions d'euros. Ce sont
# les quatre chiffres que ce module doit rendre : au-delà de la forme, c'est ce
# qu'ils valent qui compte.
CHARGES_NETTES = 676_925.28
PRODUITS_NETS = 659_464.63
RESULTAT_NET = -17_460.65
ONDAM = 270_400.0


@pytest.fixture(scope="module")
def classeurs() -> dict:
    return {
        "equilibre": m.classeur((FIXTURES / "plfss_2026_annexe3_tableaux.xlsx").read_bytes()),
        "ondam": m.classeur((FIXTURES / "plfss_2026_annexe5_tableaux.xlsx").read_bytes()),
    }


@pytest.fixture(scope="module")
def equilibre(classeurs):
    return m.lire_equilibre(classeurs["equilibre"][m.ONGLET_EQUILIBRE])


@pytest.fixture(scope="module")
def postes(equilibre):
    return m.montants(equilibre[0])


@pytest.fixture(scope="module")
def ondam(classeurs):
    return m.lire_ondam(classeurs["ondam"][m.ONGLET_ONDAM])[0]


@pytest.fixture(scope="module")
def taux(classeurs):
    return m.lire_taux(classeurs["ondam"][m.ONGLET_TAUX])


def millions(euros: float) -> float:
    return round(euros / m.MILLIONS, 2)


# ---------------------------------------------------------------- lecture


def test_les_quatre_chiffres_du_plfss_2026(equilibre, ondam):
    """Les grandeurs publiées, à l'écran de la source et à la sortie d'ici."""
    _, reperes, _ = equilibre
    assert millions(reperes[m.SECTION_CHARGES]["consolide"]) == CHARGES_NETTES
    assert millions(reperes[m.SECTION_PRODUITS]["consolide"]) == PRODUITS_NETS
    assert millions(reperes[m.LIGNE_RESULTAT]["consolide"]) == RESULTAT_NET
    assert millions(ondam["O-TOTAL"]["montant"]) == ONDAM


def test_la_colonne_consolidee_n_est_pas_la_somme_des_branches(equilibre):
    """Le piège principal, mesuré plutôt qu'affirmé.

    Additionner les cinq branches donne 19 Md€ de plus que la colonne consolidée
    — les transferts entre branches, comptés en charge chez l'une et en produit
    chez l'autre. Un connecteur qui publierait les branches inviterait cette
    addition ; celui-ci ne lit que le consolidé, et ce test dit pourquoi.
    """
    _, reperes, _ = equilibre
    charges = reperes[m.SECTION_CHARGES]
    branches = sum(charges[b] for b in m.BRANCHES_EQUILIBRE)
    assert millions(branches - charges["consolide"]) == pytest.approx(19_018.53, abs=0.01)


def test_les_deux_transferts_nets_ne_se_confondent_pas(postes):
    """Charges et produits portent tous deux une ligne « Transferts nets ».

    La clé de la nomenclature porte la section : sans elle, l'un des deux
    écraserait l'autre et 11,6 Md€ de transferts reçus disparaîtraient — ou
    prendraient la place de 20,3 Md€ de transferts versés.
    """
    assert millions(postes["D-TRF"]) == 20_277.08
    assert millions(postes["R-TRF"]) == 11_627.89


def test_le_non_recouvrement_reste_negatif(postes):
    """Une ligne de produit qui se déduit reste négative jusqu'au fichier publié.

    La ramener en valeur absolue « pour faire propre » ajouterait 4,3 Md€ de
    recettes à la Sécurité sociale, et le solde ne retomberait plus.
    """
    assert postes["R-COT-NRE"] < 0
    assert all(postes[c] <= 0 for c in ("R-COT-NRE-COT", "R-COT-NRE-CSG"))


def test_la_lecture_compte_les_lignes_sans_consulter_la_nomenclature(equilibre, postes):
    """Le dénominateur de la couverture ne doit rien savoir de ce qu'on écrit.

    Trente-trois lignes chiffrées dans le tableau, dont trois totaux que le site
    recalcule : trente postes écrits. Si ce compte était tiré de la nomenclature,
    la couverture vaudrait 1 quoi qu'il arrive.
    """
    _, _, lues = equilibre
    assert lues == 33
    assert len(postes) == 30


# ---------------------------------------------------------------- contrôles


def test_les_postes_font_leur_total(equilibre, postes):
    _, reperes, _ = equilibre
    resultat = m.controler_sommes(postes, reperes)
    assert resultat["ecart_maximal_euros"] == 0.0
    assert resultat["postes_verifies"] == 10


def test_un_poste_deplace_casse_la_somme(equilibre, postes):
    """Le contrôle refuse ce qu'il prétend refuser."""
    fausses = dict(postes)
    fausses["D-PRE-LEG"] += 5 * m.MILLIONS
    with pytest.raises(m.BudgetSocialIncoherent, match="D-PRE"):
        m.controler_sommes(fausses, equilibre[1])


def test_un_resultat_net_qui_ne_suit_pas_ses_totaux_est_refuse(equilibre, postes):
    _, reperes, _ = equilibre
    fausses = {nom: dict(valeurs) for nom, valeurs in reperes.items()}
    fausses[m.LIGNE_RESULTAT]["consolide"] += 1 * m.MILLIONS
    with pytest.raises(m.BudgetSocialIncoherent, match="RESULTAT NET"):
        m.controler_sommes(postes, fausses)


def test_les_deux_tableaux_donnent_le_meme_solde(classeurs, equilibre):
    """Le contrôle qui ne partage aucun calcul avec le reste du module.

    Le tableau 4 construit le solde comme un tendanciel corrigé de quarante-huit
    mesures ; le tableau 5 comme des produits moins des charges. Six branches,
    écart nul.
    """
    soldes = m.lire_soldes(classeurs["equilibre"][m.ONGLET_SOLDES])
    resultat = m.controler_deux_calculs_du_solde(equilibre[1], soldes)
    assert resultat["ecart_maximal_euros"] == 0.0
    assert len(resultat["branches_verifiees"]) == 6


def test_un_solde_de_branche_qui_diverge_est_refuse(classeurs, equilibre):
    soldes = m.lire_soldes(classeurs["equilibre"][m.ONGLET_SOLDES])
    soldes["Maladie"] += 20 * m.MILLIONS
    with pytest.raises(m.BudgetSocialIncoherent, match="Maladie"):
        m.controler_deux_calculs_du_solde(equilibre[1], soldes)


def test_les_six_sous_objectifs_font_l_ondam(ondam, taux):
    resultat = m.controler_ondam(ondam, taux)
    assert resultat["somme_des_sous_objectifs_euros"] == resultat["ondam_total_euros"]
    assert millions(resultat["ondam_total_euros"]) == ONDAM


def test_le_regroupement_medico_social_couvre_ses_deux_composantes(ondam):
    """Les personnes âgées et les personnes handicapées font le médico-social.

    Ce sont ces deux-là qui sont votées, pas leur somme : si le regroupement
    cessait de les couvrir, publier les trois ferait compter deux fois 34 Md€.
    """
    assert ondam["O-MS-PA"]["montant"] + ondam["O-MS-PH"]["montant"] == pytest.approx(
        ondam["O-MS"]["montant"], abs=m.TOLERANCE_ONDAM
    )


def test_un_sous_objectif_gonfle_ne_fait_plus_l_ondam(ondam, taux):
    fausses = {code: dict(v) for code, v in ondam.items()}
    fausses["O-SDV"]["montant"] += 2 * m.MILLIARDS
    with pytest.raises(m.BudgetSocialIncoherent, match="sous-objectifs"):
        m.controler_ondam(fausses, taux)


def test_un_taux_de_la_synthese_qui_ne_correspond_plus_est_refuse(ondam, taux):
    """Le rapprochement entre onglets se fait par position, donc il se vérifie.

    Les intitulés diffèrent d'un onglet à l'autre — « Établissement de santé »
    au singulier ici, « Etablissements de santé » là. Seul l'ordre les relie, et
    un ordre qui change doit arrêter le chargement plutôt que d'attribuer à un
    sous-objectif le taux du voisin.
    """
    decale = [*taux[1:], taux[0]]
    with pytest.raises(m.BudgetSocialIncoherent, match="taux"):
        m.controler_ondam(ondam, decale)


def test_une_ligne_de_taux_en_moins_arrete_le_rapprochement(ondam, taux):
    with pytest.raises(m.BudgetSocialIncoherent, match="par position"):
        m.controler_ondam(ondam, taux[:-1])


def test_une_colonne_qui_bouge_arrete_la_lecture(classeurs):
    """La colonne consolidée est reconnue par son intitulé, pas par son rang.

    Une branche de plus dans le tableau la décalerait, et la lecture prendrait
    une branche pour l'ensemble sans qu'aucune somme ne bronche : les postes
    d'une branche font bien le total de cette branche.
    """
    feuille = classeurs["equilibre"][m.ONGLET_EQUILIBRE]
    rang = (None,) * 12
    with pytest.raises(m.BudgetSocialIncoherent, match="Régimes de base"):
        m.controler_entete(rang, m.COLONNE_CONSOLIDE, m.ENTETE_CONSOLIDE, m.ONGLET_EQUILIBRE)
    # Et la lecture réelle, elle, trouve bien son en-tête.
    assert m.lire_equilibre(feuille)[2] == 33


# ------------------------------------------------- ordre de grandeur, couverture


class _Faux:
    """Une connexion qui rend ce qu'on lui donne, comme DuckDB."""

    def __init__(self, lignes):
        self.lignes = lignes

    def execute(self, *_args):
        return self

    def fetchall(self):
        return self.lignes


def test_l_ordre_de_grandeur_se_confronte_a_la_drees(equilibre):
    """Le seul contrôle qu'un changement d'unité ne peut pas satisfaire.

    Le titre du tableau dit « en milliards » et ses cellules sont en millions.
    Tous les contrôles internes resteraient verts si on le croyait ; celui-ci
    compare la DSS à la DREES et tombe.
    """
    charges = equilibre[1][m.SECTION_CHARGES]["consolide"]
    conn = _Faux([("2024", 932_548.27 * m.MILLIONS)])
    resultat = m.controler_ordre_de_grandeur(conn, charges)
    assert resultat["tenu"] and 0.7 < resultat["rapport"] < 0.75
    with pytest.raises(m.BudgetSocialIncoherent, match="rapport"):
        m.controler_ordre_de_grandeur(conn, charges / 1000)


def test_la_drees_absente_vaut_controle_non_tenu_et_non_controle_reussi(equilibre):
    charges = equilibre[1][m.SECTION_CHARGES]["consolide"]
    resultat = m.controler_ordre_de_grandeur(_Faux([]), charges)
    assert resultat == {
        "tenu": False,
        "raison": "drees_protection_sociale_total absent de l'entrepôt",
    }


def test_une_ligne_ajoutee_par_la_source_fait_tomber_la_couverture():
    """Ce qui est écrit contre ce qui est lu, et ce que ça attrape.

    Une ligne de détail que la DSS ajouterait ne serait pas dans la nomenclature,
    donc pas écrite — et aucun contrôle de somme ne le verrait, un détail
    supplémentaire ne changeant aucun total. C'est la couverture qui le voit.
    """
    assert couverture.controler({"equilibre": 30}, {"equilibre": 30}) == {"equilibre": 1.0}
    with pytest.raises(couverture.CouvertureInsuffisante):
        couverture.controler({"equilibre": 34}, {"equilibre": 30})


# ---------------------------------------------------------------- écriture


def test_les_lignes_a_ecrire_portent_l_arbre_et_les_trois_cotes(postes, ondam):
    lignes = m.lignes_a_ecrire("2026", postes, ondam)
    par_code = {ligne[4]: ligne for ligne in lignes}
    assert len(lignes) == len(postes) + len(ondam)
    assert {ligne[2] for ligne in lignes} == {"depense", "recette", "objectif"}
    # L'arbre est porté par le parent, pas par la profondeur.
    assert par_code["D-PRE-LEG"][5] == "D-PRE"
    assert par_code["D-PRE"][5] is None
    assert par_code["O-MS-PA"][5] == "O-MS"
    # L'ONDAM ne porte pas la même mesure que les charges : c'est un objectif.
    assert par_code["O-TOTAL"][9] == m.MESURE_OBJECTIF
    assert par_code["D-PRE"][9] == m.MESURE_EQUILIBRE
    # Tout parent déclaré existe : un orphelin ferait un nœud invisible.
    codes = set(par_code)
    assert all(ligne[5] is None or ligne[5] in codes for ligne in lignes)


def test_chaque_poste_publie_porte_un_intitule_en_francais(postes, ondam):
    """Une ligne réglable qui ne se nomme pas ne se règle pas."""
    assert set(postes) <= set(m.LIBELLES)
    assert set(ondam) <= set(m.LIBELLES_OBJECTIF)
    assert all(m.LIBELLES[c].strip() for c in postes)
    assert all("nettes" not in m.LIBELLES[c] for c in postes)
