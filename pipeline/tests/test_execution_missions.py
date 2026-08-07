"""L'exécution par mission : le même exercice, ventilé trois fois.

La fixture archive les six annexes réelles de deux exercices — 33 missions,
177 lignes de programme et 855 lignes de catégorie pour 2025, autant pour 2023 —
parce que le contrôle central ne se simule pas : il vérifie que trois fichiers
produits séparément, aux cardinalités différentes, tombent au centime mission
par mission. Un échantillon fabriqué le satisferait par construction et ne
prouverait rien.

Les deux exercices ne sont pas là pour la même raison. 2025 montre le contrôle
qui passe : écart nul sur les 33 missions. 2023 montre celui qui refuse, et
pourquoi — ses annexes sont des exports où huit cellules ont basculé en notation
scientifique et perdu leurs chiffres.
"""

from pathlib import Path

import pytest

from plateforme.normalize import execution_missions as m

FIXTURE = Path(__file__).parent / "fixtures" / "plrg_execution_missions_sample.csv"

# La fixture empile les six fichiers, chacun précédé de son nom. Un seul fichier
# de test, six annexes brutes, aucune reformulation : ce que lit `m.lire` ici est
# exactement ce que la source envoie.
CORRESPONDANCE = {
    "missions": "Annexe1-Etat_AE_CP-{}.csv",
    "programmes": "Annexe1-Etat_CP-{}.csv",
    "categories": "Annexe1-Etat_Titre_Cat-{}.csv",
}


def _blocs() -> dict[str, bytes]:
    blocs: dict[str, list[str]] = {}
    courant = None
    for ligne in FIXTURE.read_text(encoding="utf-8").splitlines():
        if ligne.startswith("#### "):
            courant = ligne[5:].strip()
            blocs[courant] = []
        else:
            blocs[courant].append(ligne)
    return {nom: ("\n".join(lignes) + "\n").encode("utf-8") for nom, lignes in blocs.items()}


@pytest.fixture(scope="module")
def lus() -> dict[str, dict[str, list[dict]]]:
    blocs = _blocs()
    return {
        exercice: {
            annexe: m.lire(blocs[gabarit.format(exercice)])
            for annexe, gabarit in CORRESPONDANCE.items()
        }
        for exercice in ("2023", "2025")
    }


@pytest.fixture(scope="module")
def annexes2025(lus):
    return lus["2025"]


def test_les_trois_annexes_ont_bien_trois_cardinalites(annexes2025):
    assert len(annexes2025["missions"]) == 33
    assert len(annexes2025["programmes"]) == 177
    assert len(annexes2025["categories"]) == 855


def test_les_trois_annexes_se_referment_au_centime(annexes2025):
    """33 lignes, 177 lignes et 855 lignes produites séparément par le même
    producteur : l'égalité mission par mission ne s'obtient pas par hasard."""
    verifies = m.controler("2025", annexes2025)
    assert verifies["missions_verifiees"] == 33
    assert verifies["ecart_maximal_euros"] == 0.0
    assert verifies["credits_consommes_bruts"] == 578_038_661_317.33
    assert verifies["credits_ouverts"] == 591_452_148_618.10
    assert verifies["programmes"] == 129


def test_le_controle_bloque_sur_un_centime(annexes2025):
    """Un centime suffit : c'est ce qui rend ce contrôle utile."""
    faussee = [dict(rang) for rang in annexes2025["programmes"]]
    faussee[0]["Depenses_constatees"] = str(
        m.montant(faussee[0]["Depenses_constatees"]) + 0.01
    )
    with pytest.raises(m.MissionsDivergentes, match="divergent"):
        m.controler("2025", {**annexes2025, "programmes": faussee})


def test_le_controle_bloque_si_une_mission_diverge_entre_deux_annexes(annexes2025):
    """Une mission déplacée d'une annexe à l'autre laisse les totaux nationaux
    intacts : seule la comparaison mission par mission la voit."""
    deplacee = []
    for rang in annexes2025["categories"]:
        copie = dict(rang)
        if copie["Mission"] == "Défense":
            copie["Mission"] = "Justice"
        deplacee.append(copie)
    total_avant = sum(m.montant(r["Depenses"]) or 0 for r in annexes2025["categories"])
    total_apres = sum(m.montant(r["Depenses"]) or 0 for r in deplacee)
    assert round(total_avant, 2) == round(total_apres, 2), "le total national ne bouge pas"
    with pytest.raises(m.MissionsDivergentes, match="Défense"):
        m.controler("2025", {**annexes2025, "categories": deplacee})


def test_le_controle_bloque_si_une_annexe_est_vide(annexes2025):
    with pytest.raises(m.MissionsDivergentes, match="est vide"):
        m.controler("2025", {**annexes2025, "categories": []})


def test_le_controle_bloque_sur_une_mission_inconnue(annexes2025):
    """Une mission créée par une loi de finances doit obtenir sa fiche avant
    d'être publiée : l'écarter en silence amputerait le total sans le dire."""
    renommee = [dict(rang) for rang in annexes2025["missions"]]
    renommee[0]["Mission"] = "Mission nouvelle"
    programmes = [
        dict(rang, Mission="Mission nouvelle")
        if rang["Mission"] == annexes2025["missions"][0]["Mission"]
        else rang
        for rang in annexes2025["programmes"]
    ]
    categories = [
        dict(rang, Mission="Mission nouvelle")
        if rang["Mission"] == annexes2025["missions"][0]["Mission"]
        else rang
        for rang in annexes2025["categories"]
    ]
    with pytest.raises(m.MissionsDivergentes, match="ne connaît pas"):
        m.controler(
            "2025",
            {"missions": renommee, "programmes": programmes, "categories": categories},
        )


def test_2023_est_ecarte_parce_que_sa_source_a_perdu_des_chiffres(lus):
    """`1,44146E+11` ne retient que six chiffres significatifs : la cellule a
    perdu jusqu'à 10⁵ €, et aucun contrôle au centime ne peut plus rien en dire.
    """
    retenus, ecartes = m.trier(lus)
    assert set(retenus) == {"2025"}
    assert set(ecartes) == {"2023"}
    degradees = ecartes["2023"]["cellules_en_notation_scientifique"]
    assert sum(degradees.values()) == 8
    assert m.cellules_degradees(lus["2025"]["missions"]) == 0
    # Ce que le contrôle aurait vu si l'exercice avait été retenu : vingt-sept
    # missions divergentes entre l'annexe des missions et celle des programmes.
    with pytest.raises(m.MissionsDivergentes, match="27 mission"):
        m.controler("2023", lus["2023"])
    # Vingt-six d'entre elles ne divergent que d'une fraction d'euro — l'annexe
    # des missions ne porte que dix chiffres significatifs. La vingt-septième est
    # celle dont la cellule a basculé en notation scientifique : elle manque
    # 83 650,28 €, soit cinq ordres de grandeur de plus.
    mission = "Remboursements et dégrèvements"
    grossier = next(
        rang for rang in lus["2023"]["missions"] if rang["Mission"] == mission
    )
    detaille = sum(
        m.montant(rang["Depenses_constatees"]) or 0.0
        for rang in lus["2023"]["programmes"]
        if rang["Mission"] == mission
    )
    assert grossier["CP_Consommes"] == "1,42445E+11"
    assert round(m.montant(grossier["CP_Consommes"]) - detaille, 2) == -83_650.28


def test_les_valeurs_manquantes_ne_deviennent_pas_des_zeros():
    """L'annexe des recettes écrit l'absence `"   -   "`, avec des espaces. Un
    `float()` naïf y meurt et un `or 0` y inventerait un montant nul."""
    assert m.montant("   -   ") is None
    assert m.montant("") is None
    assert m.montant(None) is None
    assert m.montant("0") == 0.0
    assert m.montant("-98077468") == -98_077_468.0
    assert m.montant("1 342 021 138,52") == 1_342_021_138.52
    assert m.montant("1,44146E+11") == 1.44146e11


def test_le_numero_du_programme_est_decoupe_de_son_libelle():
    """« Action de la France en Europe et dans le monde - 105 » n'est pas un nom
    de programme : c'est un nom suivi d'un numéro."""
    libelle, numero = m.decouper_programme(
        "Action de la France en Europe et dans le monde - 105"
    )
    assert (libelle, numero) == ("Action de la France en Europe et dans le monde", "105")
    assert m.decouper_programme("Programme sans numéro") == ("Programme sans numéro", "")


def test_les_programmes_des_deux_annexes_detaillees_se_correspondent(annexes2025):
    """Quatre programmes ne figurent que dans l'annexe des crédits — et n'ont
    rien consommé. Un cinquième, doté, signalerait une lecture fausse."""
    assert m.apparier_programmes(annexes2025) == {
        "programmes": 129,
        "programmes_sans_categorie_et_sans_depense": 4,
    }
    dote = [
        dict(rang, Depenses_constatees="1000000")
        if m.decouper_programme(rang["Programme"])[1] == "551"
        else rang
        for rang in annexes2025["programmes"]
    ]
    with pytest.raises(m.MissionsDivergentes, match="consommé des crédits"):
        m.apparier_programmes({**annexes2025, "programmes": dote})


def test_le_vote_et_le_consomme_sont_deux_series_distinctes(annexes2025):
    """C'est tout l'intérêt du jeu : la décision d'un côté, le paiement de
    l'autre. Les confondre effacerait l'un des deux."""
    agregats = m.agreger(annexes2025)
    defense = agregats["Défense"]
    assert round(defense["votes"] / 1e9, 2) == 59.95
    assert round(defense["ouverts"] / 1e9, 2) == 62.61
    assert round(defense["consommes"] / 1e9, 2) == 62.12
    # Les crédits ouverts s'intercalent entre les deux : l'écart entre voté et
    # consommé n'est donc pas un dépassement.
    assert defense["votes"] < defense["consommes"] < defense["ouverts"]
    assert round(agregats["Enseignement scolaire"]["consommes"] / 1e9, 2) == 87.75


def test_le_brut_et_le_net_sont_dits(annexes2025):
    """578,04 Md€ consommés, dont 141,36 Md€ rendus aux contribuables : publier
    le brut sous le nom « dépenses de l'État » gonflerait le chiffre d'un tiers.
    """
    verifies = m.controler("2025", annexes2025)
    assert round(verifies["credits_consommes_bruts"] / 1e9, 2) == 578.04
    assert round(verifies["remboursements_et_degrevements"] / 1e9, 2) == 141.36
    assert round(verifies["credits_consommes_nets"] / 1e9, 2) == 436.67
    for mot in ("budgétaire", "bruts", "436,67", "ne se substituent pas"):
        assert mot in m.TECHNIQUE, mot


def test_les_fiches_publiques_tiennent_en_cinquante_mots():
    for mission in m.MISSIONS:
        for identifiant, libelle, publique in m.fiches(mission):
            assert len(publique.split()) <= 50, identifiant
            assert mission in libelle
    assert len(m.indicateurs()) == 66
    assert len(set(m.indicateurs())) == 66


def test_une_mission_renommee_garde_sa_serie():
    """« Travail et emploi » devient « Travail, emploi et administration des
    ministères sociaux » en 2025 : sans alias, la série se couperait en deux."""
    ancien = "Travail et emploi"
    assert ancien not in m.MISSIONS
    assert m.MISSIONS[m.ALIAS[ancien]][0] == "travail_emploi"


def test_la_piece_jointe_se_retrouve_par_son_nom_de_fichier():
    """Les identifiants changent de forme d'un exercice à l'autre ; les noms de
    fichier, non."""
    catalogue = {
        "attachments": [
            {"metas": {"id": "annexe1_etat_ae_cp_2024_csv", "title": "Annexe1-Etat_AE_CP-2024.csv"}},
            {"metas": {"id": "annexe1_etat_cp_2024_csv", "title": "Annexe1-Etat_CP-2024.csv"}},
            {"metas": {"id": "annexe2_etat_cp_2024_csv", "title": "Annexe2-Etat_CP-2024.csv"}},
        ]
    }
    assert m.piece_jointe(catalogue, m.ANNEXES["missions"])[0] == "annexe1_etat_ae_cp_2024_csv"
    # L'annexe 2 ne porte que les comptes spéciaux : le préfixe de l'annexe 1 ne
    # doit pas l'attraper.
    assert m.piece_jointe(catalogue, m.ANNEXES["programmes"])[0] == "annexe1_etat_cp_2024_csv"
    with pytest.raises(ValueError, match="au lieu"):
        m.piece_jointe(catalogue, m.ANNEXES["categories"])


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    m.declarer(entrepot_seme)
    m.declarer(entrepot_seme)
    publies = dict(entrepot_seme.execute(
        "select indicator_id, unit from core.indicators"
        " where indicator_id like 'etat_mission_%'",
    ).fetchall())
    assert set(publies) == set(m.indicateurs())
    assert set(publies.values()) == {"EUR"}
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, lus):
    from plateforme import entrepot, revisions

    m.declarer(entrepot_seme)
    run_id = entrepot.start_run(entrepot_seme, m.DATASET, "manual")
    retenus, _ = m.trier(lus)
    ecrites, _ = revisions.remplacer(
        entrepot_seme, run_id, m.indicateurs(), m.COLONNES, m.lignes_a_ecrire(retenus)
    )
    entrepot_seme.commit()
    assert ecrites == 66, "trente-trois missions, deux séries, un exercice retenu"
    (voté,) = entrepot_seme.execute(
        "select value from core.observations where indicator_id ="
        " 'etat_mission_defense_credits_votes' and period = '2025'"
    ).fetchone()
    (consommé,) = entrepot_seme.execute(
        "select value from core.observations where indicator_id ="
        " 'etat_mission_defense_credits_consommes' and period = '2025'"
    ).fetchone()
    assert round(voté / 1e9, 2) == 59.95
    assert round(consommé / 1e9, 2) == 62.12
    # Rien n'est écrit dans les budgets de l'État : `plateforme.normalize.etat`
    # les reconstruit en entier à chaque passage, et une ligne posée là serait
    # effacée — après avoir fait échouer sa suppression sur la clé étrangère.
    (budgets,) = entrepot_seme.execute(
        "select count(*) from fin.public_budgets"
    ).fetchone()
    assert budgets == 0
