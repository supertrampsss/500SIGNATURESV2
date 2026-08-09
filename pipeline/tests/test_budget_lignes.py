"""Le budget de l'État ligne à ligne : la nomenclature, ses contrôles, son fichier.

Les fixtures sont les exports réels du portail, octet pour octet — l'export
2025 en entier (2 404 rangs, budgets annexes et comptes spéciaux compris, pour
que le filtre du budget général ait quelque chose à filtrer) et les deux annexes
de recettes en entier. Celui de 2024 est échantillonné sur deux missions
complètes, la Défense et le Travail, qui portent les deux témoins relevés à la
main ; sa forme diffère de celle de 2025 — codes d'action relatifs, colonnes
autrement nommées — et c'est précisément ce que sa présence ici vérifie.

Un échantillon fabriqué satisferait par construction le contrôle central : que
cinq sommes calculées séparément retombent à l'euro sur le même total. Sur la
matière réelle, il ne se satisfait pas tout seul.
"""

import json
import pathlib

import pytest

from plateforme import entrepot, publish, registry
from plateforme.normalize import budget_lignes as m

FIXTURES = pathlib.Path(__file__).parent / "fixtures"

# Les cadratins bannis du fichier publié. Le signe moins des nombres (U+2212) et
# le trait d'union des noms composés ne sont pas visés.
CADRATINS = {"—": "tiret cadratin", "–": "tiret demi-cadratin"}

FICHIERS = {
    "2024": (
        "plf_depenses_destination_2024_sample.json",
        "relatif",
        "plf_recettes_budget_general_2024.json",
    ),
    "2025": (
        "plf_depenses_destination_2025.json",
        "absolu",
        "plf_recettes_budget_general_2025.json",
    ),
}


@pytest.fixture(scope="module")
def lus() -> dict[str, dict]:
    return {
        exercice: {
            "depenses": m.lire((FIXTURES / depenses).read_bytes()),
            "recettes": m.lire((FIXTURES / recettes).read_bytes()),
            "forme": forme,
        }
        for exercice, (depenses, forme, recettes) in FICHIERS.items()
    }


@pytest.fixture(scope="module")
def postes(lus) -> dict[str, list[m.Poste]]:
    return {
        exercice: m.LECTEURS[annexes["forme"]](annexes["depenses"])
        for exercice, annexes in lus.items()
    }


@pytest.fixture(scope="module")
def missions(postes) -> dict[str, list[m.Noeud]]:
    return {exercice: m.construire(p) for exercice, p in postes.items()}


@pytest.fixture(scope="module")
def prepares(lus):
    return m.preparer(lus)


@pytest.fixture(scope="module")
def publie(prepares, tmp_path_factory) -> dict[str, dict]:
    """Le fichier tel que le site le recevra, écrit puis relu depuis l'entrepôt.

    Passer par la base plutôt que de rendre l'arbre directement n'est pas une
    précaution : c'est le chemin réel. Un `parent_code` mal écrit, une famille de
    recettes sans son signe, un montant tronqué à l'écriture ne se voient qu'ici.
    """
    conn = entrepot.connect(tmp_path_factory.mktemp("entrepot") / "entrepot.duckdb")
    registry.sync(conn)
    conn.execute(
        "insert or ignore into meta.dataset_registry (dataset_id, source_id, title,"
        " priority) values (?, 'data-economie', 'PLF, budget de l''État ligne à"
        " ligne', 'P1')",
        (m.DATASET,),
    )
    run_id = entrepot.start_run(conn, m.DATASET)
    arbres, _, _ = prepares
    m.ecrire(
        conn,
        run_id,
        [
            ligne
            for exercice, (noeuds, groupes) in sorted(arbres.items())
            for ligne in m.lignes_a_ecrire(exercice, noeuds, groupes)
        ],
    )
    conn.commit()
    fichiers = publish.simulateur(conn)
    yield fichiers
    conn.close()


# ---------------------------------------------------------------- la lecture


def test_le_perimetre_est_le_budget_general(lus, postes):
    """La source livre quatre budgets dans un seul fichier. Les additionner
    porterait le total de 594,0 à 823,0 Md€ en 2025 sans qu'aucune ligne ne soit
    fausse : c'est le périmètre qui le serait."""
    assert len(lus["2025"]["depenses"]) == 2404
    assert len(postes["2025"]) == 2289
    hors_budget_general = {
        rang["typebudget"] for rang in lus["2025"]["depenses"]
    } - {"BG"}
    assert hors_budget_general == {"BA", "CAS", "CCF"}


def test_les_deux_exercices_se_lisent_dans_la_meme_forme(postes):
    """2024 écrit l'action « 07 » et la sous-action « 85 », relatives à leur
    parent ; 2025 écrit « 103-01 » et « 103-01-02 ». Sans recomposition, la même
    action porterait deux codes selon l'exercice et un lien partagé sur une ligne
    cesserait de désigner quoi que ce soit l'année suivante."""
    for exercice, lignes in postes.items():
        for poste in lignes:
            assert poste.action.startswith(f"{poste.programme}-"), (exercice, poste)
            if poste.sous_action:
                assert poste.sous_action.startswith(f"{poste.action}-"), (exercice, poste)
    codes_2024 = {poste.action for poste in postes["2024"]}
    assert "146-09" in codes_2024 and "103-01" in codes_2024
    # Le programme est un flottant dans l'export 2024 (`224.0`) et un texte dans
    # celui de 2025 : le code publié ne doit pas en garder la trace.
    assert all("." not in poste.programme for poste in postes["2024"])


def test_la_nomenclature_est_un_arbre(postes):
    for exercice, lignes in postes.items():
        assert m.controler_arborescence(exercice, lignes)["codes_distincts"] > 0


def test_un_code_a_deux_parents_arrete_le_chargement(postes):
    """Un programme sous deux missions serait rattaché à la première et
    emporterait les crédits de la seconde, sans qu'aucun total ne bouge."""
    trafiques = list(postes["2025"])
    trafiques[0] = m.Poste(
        **{**trafiques[0].__dict__, "mission": "ZZ", "libelle_mission": "Mission fantôme"}
    )
    with pytest.raises(m.BudgetIncoherent, match="parent"):
        m.controler_arborescence("2025", trafiques)


def test_un_code_qui_ne_descend_plus_de_son_parent_arrete_le_chargement(postes):
    trafiques = list(postes["2025"])
    trafiques[0] = m.Poste(**{**trafiques[0].__dict__, "action": "999-01"})
    with pytest.raises(m.BudgetIncoherent, match="ne descend pas"):
        m.controler_arborescence("2025", trafiques)


# ---------------------------------------------------------- première prise :
# l'identité interne


def test_les_cinq_sommes_retombent_sur_le_total(postes, missions):
    """Le total lu ligne à ligne, la somme par mission, celle par programme,
    celle par action et celle des feuilles de l'arbre : cinq calculs séparés sur
    la même matière, et l'écart doit être nul, pas petit — ce sont des euros
    entiers, donc exacts en flottant double."""
    verifie = m.controler_identite("2025", postes["2025"], missions["2025"])
    assert verifie["total_credits_paiement"] == 594_036_403_592.0
    assert verifie["ecart_maximal_euros"] == 0.0
    assert verifie["noeuds_mission"] == 34
    assert verifie["noeuds_programme"] == 135
    assert verifie["noeuds_action"] == 620
    assert verifie["noeuds_sous_action"] == 283
    assert verifie["feuilles"] == 833


def test_une_ligne_perdue_casse_l_identite(postes, missions):
    with pytest.raises(m.BudgetIncoherent, match="s'écarte de"):
        m.controler_identite("2025", postes["2025"][1:], missions["2025"])


def test_une_feuille_negative_arrete_le_chargement(postes):
    """Un crédit négatif ne se règle pas en pourcentage : le simulateur en ferait
    une économie quand l'utilisateur croit couper une dépense."""
    trafiques = list(postes["2025"])
    trafiques[0] = m.Poste(**{**trafiques[0].__dict__, "montant": -1.0})
    arbre = m.construire(trafiques)
    with pytest.raises(m.BudgetIncoherent, match="négative"):
        m.controler_identite("2025", trafiques, arbre)


def test_une_action_a_sous_action_unique_de_meme_libelle_est_aplatie(missions):
    """Seize actions de 2025 n'ont qu'une sous-action ; six seulement lui donnent
    leur propre intitulé, et sont aplaties. Les dix autres nomment autre chose —
    « Recherche dans le domaine des risques » ouvre sur l'INERIS — et gardent un
    enfant qui informe."""
    par_code = {noeud.code: noeud for noeud, _ in m.parcourir(missions["2025"])}
    # « Taxes foncières » ouvrait sur « Taxes foncières » : le niveau disparaît,
    # le montant reste.
    assert par_code["201-02"].enfants == []
    assert "201-02-01" not in par_code
    assert par_code["201-02"].montant == par_code["201-02"].total()
    # « Recherche dans le domaine des risques » garde son unique enfant.
    assert [e.code for e in par_code["190-11"].enfants] == ["190-11-01"]
    aplaties = [
        noeud
        for noeud, _ in m.parcourir(missions["2025"])
        if noeud.niveau == "action" and not noeud.enfants
    ]
    # 620 actions, dont 70 seulement gardent des sous-actions après
    # aplatissement : les 550 autres sont des feuilles, et 283 sous-actions
    # pendent sous les 70 restantes.
    assert len(aplaties) == 550


def test_les_recettes_se_repartissent_en_quatre_familles_signees(lus):
    groupes = m.grouper_recettes(lus["2025"]["recettes"])
    assert [(code, signe, len(lignes)) for code, _, signe, lignes in groupes] == [
        ("RF", 1, 67),
        ("RNF", 1, 56),
        ("PSR-CT", -1, 32),
        ("PSR-UE", -1, 1),
    ]
    # 500,3 + 20,5 - 44,2 - 23,3 : les prélèvements se déduisent. Les additionner
    # donnerait 588,4 Md€ et un budget presque à l'équilibre qui n'existe pas.
    assert m.recettes_nettes(groupes) == 453_388_248_678.0


def test_une_famille_de_recettes_inconnue_arrete_le_chargement(lus):
    trafiques = [dict(rang) for rang in lus["2025"]["recettes"]]
    trafiques[0]["type_de_recettes"] = "Recettes exceptionnelles"
    with pytest.raises(m.BudgetIncoherent, match="famille de recettes inconnue"):
        m.grouper_recettes(trafiques)


# ---------------------------------------------------------- deuxième prise :
# les témoins relevés à la main


def test_les_temoins_releves_a_la_main_se_retrouvent(lus):
    """Huit cellules lues sur data.economie.gouv.fr le 8 août 2026, quatre par
    exercice. Elles ne partagent aucun calcul avec le reste du module."""
    for exercice, annexes in lus.items():
        releves = m.controler_temoins(
            exercice, annexes["depenses"], annexes["forme"], annexes["recettes"]
        )["temoins"]
        assert len(releves) == 4
    porte_avions = m.TEMOINS_DEPENSES["2025"][("146-09-63", "5", "51")]
    # 2,87 Md€ engagés pour 76 M€ payés sur la même ligne : un facteur trente-sept
    # entre les deux colonnes, quand leurs totaux ne diffèrent que de 4 %.
    assert porte_avions == (2_869_662_536.0, 76_413_283.0)


def test_un_temoin_qui_bouge_arrete_le_chargement(lus):
    trafiques = [dict(rang) for rang in lus["2025"]["depenses"]]
    for rang in trafiques:
        if rang["sous_action"] == "146-09-63" and rang["titre"] == "5":
            rang["credit_de_paiement"] = 76_413_284.0
    with pytest.raises(m.BudgetIncoherent, match="146-09-63"):
        m.controler_temoins("2025", trafiques, "absolu", lus["2025"]["recettes"])


def test_une_colonne_prise_pour_l_autre_arrete_le_chargement(lus):
    """Confondre AE et CP ne déplace le total que de 4 % : aucun contrôle de
    volume ne le verrait. Le témoin, lui, le voit à l'euro."""
    trafiques = [dict(rang) for rang in lus["2025"]["depenses"]]
    for rang in trafiques:
        rang["credit_de_paiement"] = rang["autorisation_engagement"]
    with pytest.raises(m.BudgetIncoherent, match="relevés à la main"):
        m.controler_temoins("2025", trafiques, "absolu", lus["2025"]["recettes"])


def test_une_recette_temoin_qui_bouge_arrete_le_chargement(lus):
    trafiques = [dict(rang) for rang in lus["2025"]["recettes"]]
    for rang in trafiques:
        if m._texte(rang["code_ligne_recettes"]) == "1705":
            rang["montant_recettes_plf"] = 4_133_191_844.0
    with pytest.raises(m.BudgetIncoherent, match="1705"):
        m.controler_temoins("2025", lus["2025"]["depenses"], "absolu", trafiques)


# ------------------------------------------------------------ la série


# Les totaux réellement mesurés le 8 août 2026 : PLF 2023 lu dans les colonnes
# `cp_*_plf_2023` du jeu de la LFI 2023, PLF 2024 et PLF 2025 dans les jeux
# chargés ici. Ce sont eux qui fixent le seuil de `VARIATION_MAXIMALE`.
TOTAUX_MESURES = {
    "2023": {"depenses": 560_220_187_786.0, "recettes_nettes": 430_000_000_000.0},
    "2024": {"depenses": 581_088_341_408.0, "recettes_nettes": 441_565_216_623.0},
    "2025": {"depenses": 594_036_403_592.0, "recettes_nettes": 453_388_248_678.0},
}


def test_le_seuil_de_serie_couvre_les_variations_mesurees():
    mesures = m.controler_serie(TOTAUX_MESURES)["variations"]
    depenses = {(v["de"], v["a"]): v["variation"] for v in mesures if v["grandeur"] == "depenses"}
    assert depenses[("2023", "2024")] == 0.0372
    assert depenses[("2024", "2025")] == 0.0223
    # Le seuil est le double de la plus forte variation mesurée, arrondi au
    # demi-point au-dessus : il laisse de la marge sans cesser de mordre.
    assert m.VARIATION_MAXIMALE == 0.075
    assert max(abs(v["variation"]) for v in mesures) < m.VARIATION_MAXIMALE


def test_un_perimetre_elargi_arrete_le_chargement():
    """Charger les quatre budgets au lieu du seul budget général porterait 2025 à
    823,0 Md€ : +38,5 %, et la série le refuse."""
    faux = {
        **TOTAUX_MESURES,
        "2025": {"depenses": 823_034_000_000.0, "recettes_nettes": 453_388_248_678.0},
    }
    with pytest.raises(m.BudgetIncoherent, match="au-delà des"):
        m.controler_serie(faux)


# ------------------------------------------------------------ le fichier publié


def test_le_fichier_publie_suit_le_contrat_du_site(publie):
    budget = publie["2025"]
    assert budget["exercice"] == "2025"
    assert budget["loi"] == "PLF"
    assert budget["mesure"] == "credit_de_paiement"
    assert budget["unite"] == "EUR"
    assert len(budget["depenses"]) == 34
    assert [groupe["signe"] for groupe in budget["recettes"]] == [1, 1, -1, -1]
    assert sum(len(groupe["lignes"]) for groupe in budget["recettes"]) == 156
    assert sorted(publie) == ["2024", "2025"]


def test_le_montant_d_un_noeud_est_la_somme_de_ses_enfants(publie):
    """Le module du site ne lit jamais le `v` d'un nœud intermédiaire : il
    redescend aux feuilles. Les deux doivent dire la même chose, sans quoi le
    total affiché contredirait le détail qu'on ouvre sous lui."""

    def verifier(noeud: dict) -> float:
        if "enfants" not in noeud:
            return noeud["v"]
        somme = sum(verifier(enfant) for enfant in noeud["enfants"])
        assert somme == noeud["v"], f"{noeud['c']} : {somme} contre {noeud['v']}"
        return somme

    for exercice, budget in publie.items():
        total = sum(verifier(noeud) for noeud in budget["depenses"])
        assert total > 0, exercice
    assert sum(n["v"] for n in publie["2025"]["depenses"]) == 594_036_403_592


def test_une_feuille_n_a_pas_de_cle_enfants(publie):
    """C'est l'absence de la clé qui fait la feuille, pas la profondeur : une
    action sans sous-action en est une, comme une sous-action."""
    feuilles = 0
    for budget in publie.values():
        pile = list(budget["depenses"])
        while pile:
            noeud = pile.pop()
            if "enfants" in noeud:
                assert noeud["enfants"], f"{noeud['c']} porte une liste d'enfants vide"
                pile.extend(noeud["enfants"])
            else:
                feuilles += 1
    assert feuilles == 833 + 210


def test_chaque_niveau_est_trie_par_montant_decroissant(publie):
    for budget in publie.values():
        pile = list(budget["depenses"])
        assert [n["v"] for n in pile] == sorted((n["v"] for n in pile), reverse=True)
        while pile:
            noeud = pile.pop()
            enfants = noeud.get("enfants", [])
            valeurs = [enfant["v"] for enfant in enfants]
            assert valeurs == sorted(valeurs, reverse=True), noeud["c"]
            pile.extend(enfants)
        for groupe in budget["recettes"]:
            valeurs = [ligne["v"] for ligne in groupe["lignes"]]
            assert valeurs == sorted(valeurs, reverse=True), groupe["t"]


def test_aucun_cadratin_dans_le_fichier_publie(publie):
    """La règle produit tient à l'entrée dans le fichier, pas à chaque rendu :
    trois intitulés officiels portent un demi-cadratin, et ils deviennent des
    deux-points parce que le tiret y introduit une précision."""
    fautes = []
    for exercice, budget in publie.items():
        texte = json.dumps(budget, ensure_ascii=False)
        for signe, nom in CADRATINS.items():
            if signe in texte:
                extrait = texte[max(0, texte.index(signe) - 70):][:140]
                fautes.append(f"{exercice} : {nom} dans « …{extrait}… »")
    assert not fautes, "\n".join(fautes)

    libelles = {
        noeud["l"]
        for budget in publie.values()
        for noeud in _tous_les_noeuds(budget["depenses"])
    }
    assert "Assurer la crédibilité technique de la dissuasion : SNLE 3G" in libelles
    # Le trait d'union ordinaire, lui, reste : il ne ponctue pas.
    assert "Frapper à distance - Porte-avions" in libelles


def _tous_les_noeuds(noeuds: list[dict]):
    for noeud in noeuds:
        yield noeud
        yield from _tous_les_noeuds(noeud.get("enfants", []))


def test_le_fichier_reste_lisible_sur_un_telephone(publie):
    """105 Ko compacts pour 2025. Le contrat en annonçait 114 : la marge est
    étroite, et un champ ajouté par nœud la mangerait."""
    octets = len(json.dumps(publie["2025"], ensure_ascii=False, separators=(",", ":")))
    assert octets < 130_000, f"{octets} octets"


def test_les_codes_sont_uniques_dans_le_fichier(publie):
    """Le site indexe les lignes par code et compose les réglages dessus : deux
    nœuds de même code, et régler l'un réglerait l'autre."""
    for exercice, budget in publie.items():
        codes = [noeud["c"] for noeud in _tous_les_noeuds(budget["depenses"])]
        assert len(codes) == len(set(codes)), exercice
        recettes = [
            ligne["c"] for groupe in budget["recettes"] for ligne in groupe["lignes"]
        ]
        assert len(recettes) == len(set(recettes)), exercice


def test_une_ligne_sans_intitule_arrete_le_chargement(postes):
    """Une ligne réglable qui ne se nomme pas ne se règle pas : elle
    apparaîtrait dans l'arbre comme un montant sans objet."""
    trafiques = list(postes["2025"])
    trafiques[0] = m.Poste(**{**trafiques[0].__dict__, "libelle_action": ""})
    with pytest.raises(m.BudgetIncoherent, match="sans intitulé"):
        m.controler_arborescence("2025", trafiques)
