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
    attendus = {l["agregat"] for l in ofgl.catalogue() if l["charge"] == "oui"}
    assert set(retenus) == attendus
    assert len(retenus) >= 5


def test_une_maille_ne_demande_que_ses_propres_agregats():
    # Les allocations RSA, APA et les DMTO n'existent qu'au département et à la
    # région : les demander à l'export communal ferait porter à la requête un
    # filtre qui n'y correspond à rien.
    for niveau in NIVEAUX:
        for agregat in ofgl.agregats_du_niveau(niveau):
            ligne = next(l for l in ofgl.catalogue() if l["agregat"] == agregat)
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
        ecrivain.writerow({
            "agregat": "Fonds de roulement", "indicateur": "ofgl_fonds_de_roulement",
            "niveaux": "commune", "lignes": "1", "charge": "oui",
            "chemin": "", "definition_ofgl": "", "formule_ofgl": "R + D",
        })
    lignes = ofgl.catalogue(chemin)
    assert lignes[0]["definition_ofgl"] == ""
    with pytest.raises(normalisation.DefinitionManquante, match="Fonds de roulement"):
        normalisation.fiches_depuis(lignes)


def test_les_trois_agregats_sans_definition_ne_sont_pas_charges():
    muets = [l for l in ofgl.catalogue() if not l["definition_ofgl"]]
    assert {l["agregat"] for l in muets} == {
        "Crédits de trésorerie",
        "Fonds de roulement",
        "Produit des cessions d'immobilisations",
    }
    assert all(l["charge"] == "non" for l in muets)
