"""Le catalogue des agrégats OFGL est une donnée, pas un filtre caché.

Cinq agrégats sur soixante-douze étaient chargés, et ce choix vivait dans un
dictionnaire Python sans la liste de ce qu'il écartait ni le motif : en lisant le
code, on ne pouvait pas savoir que « Frais de personnel » existait et n'était pas
pris. Ces tests vérifient que le catalogue reste complet, que la sélection s'y lit,
et qu'un agrégat sans définition arrête le chargement au lieu d'être publié muet.
"""

import csv

import pytest

from plateforme.connectors import ofgl
from plateforme.normalize import ofgl as normalisation

NIVEAUX = ("commune", "epci", "departement", "region")


def test_le_catalogue_liste_tous_les_agregats_publies():
    lignes = ofgl.catalogue()
    assert len(lignes) == 72
    # Chaque ligne dit ce qu'elle coûte et si elle est prise : sans ces deux
    # colonnes, la sélection redeviendrait un choix invisible.
    for ligne in lignes:
        assert ligne["charge"] in {"oui", "non"}, ligne["agregat"]
        assert int(ligne["lignes"]) > 0, ligne["agregat"]
        assert ligne["niveaux"], ligne["agregat"]
        assert set(ligne["niveaux"].split(",")) <= set(NIVEAUX), ligne["agregat"]


def test_les_identifiants_sont_uniques_et_prefixes():
    identifiants = [ligne["indicateur"] for ligne in ofgl.catalogue()]
    assert len(set(identifiants)) == len(identifiants)
    assert all(i.startswith("ofgl_") for i in identifiants)


def test_seuls_les_agregats_marques_oui_sont_charges():
    retenus = ofgl.agregats()
    attendus = {ligne_cat["agregat"] for ligne_cat in ofgl.catalogue() if ligne_cat["charge"] == "oui"}
    assert set(retenus) == attendus
    assert len(retenus) >= 5


def test_une_maille_ne_demande_que_ses_propres_agregats():
    # Les allocations RSA, APA et les DMTO n'existent qu'au département et à la
    # région : les demander à l'export communal ferait porter à la requête un
    # filtre qui n'y correspond à rien.
    for niveau in NIVEAUX:
        for agregat in ofgl.agregats_du_niveau(niveau):
            ligne = next(c for c in ofgl.catalogue() if c["agregat"] == agregat)
            assert niveau in ligne["niveaux"].split(","), (niveau, agregat)


def test_chaque_agregat_charge_a_une_fiche_et_un_libelle():
    fiches, noms = normalisation.fiches(), normalisation.libelles()
    for identifiant in ofgl.agregats().values():
        grand_public, technique, formule = fiches[identifiant]
        assert len(grand_public) > 40, identifiant
        assert len(technique) > 40, identifiant
        assert formule, identifiant
        assert noms[identifiant], identifiant


def test_un_agregat_sans_definition_arrete_le_chargement(tmp_path):
    # L'OFGL publie trois agrégats sans les commenter. Les charger reviendrait à
    # afficher un montant que personne, nous compris, ne saurait expliquer.
    chemin = tmp_path / "agregats.csv"
    with open(chemin, "w", newline="", encoding="utf-8") as fichier:
        ecrivain = csv.DictWriter(
            fichier,
            fieldnames=[
                "agregat", "indicateur", "niveaux", "lignes",
                "charge", "chemin", "definition_ofgl", "formule_ofgl",
            ],
        )
        ecrivain.writeheader()
        # Un agrégat que l'OFGL ajouterait demain sans le commenter, et pour
        # lequel personne n'aurait encore écrit de fiche.
        ecrivain.writerow({
            "agregat": "Agrégat inédit", "indicateur": "ofgl_agregat_inedit",
            "niveaux": "commune", "lignes": "1", "charge": "oui",
            "chemin": "", "definition_ofgl": "", "formule_ofgl": "R + D",
        })
    lignes = ofgl.catalogue(chemin)
    assert lignes[0]["definition_ofgl"] == ""
    with pytest.raises(normalisation.DefinitionManquante, match="Agrégat inédit"):
        normalisation.fiches_depuis(lignes)


def test_les_agregats_non_commentes_par_l_ofgl_disent_qui_les_definit():
    # L'OFGL publie trois agrégats sans commentaire. Leur définition est écrite
    # ici, à partir de la formule comptable qu'il publie bien — ce n'est donc pas
    # une supposition, mais ce n'est pas non plus sa documentation. La fiche doit
    # le dire, sans quoi le lecteur croirait lire le producteur.
    muets = [ligne_cat["agregat"] for ligne_cat in ofgl.catalogue() if not ligne_cat["definition_ofgl"]]
    assert set(muets) == {
        "Crédits de trésorerie",
        "Fonds de roulement",
        "Produit des cessions d'immobilisations",
    }
    fiches = normalisation.fiches()
    retenus = ofgl.agregats()
    for agregat in muets:
        _, technique, formule = fiches[retenus[agregat]]
        assert "rédigée par ce site" in technique, agregat
        assert formule, agregat
