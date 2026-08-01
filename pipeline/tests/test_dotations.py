"""Lecture des dotations, hors réseau.

Le format est long et mélange les montants avec les critères de calcul : une
lecture trop permissive additionnerait un potentiel fiscal à une dotation.
"""

from plateforme.connectors import dgcl

CSV = (
    "﻿exercice;code_insee;variable;valeur;unite\n"
    "2025-01-01;33318;Montant Dotation forfaitaire;5000000.0;euros\n"
    "2025-01-01;33318;Montant Dotation DSR;250000.0;euros\n"
    # Critère de calcul, pas un montant : doit être ignoré
    "2025-01-01;33318;Potentiel fiscal par habitant;1234.5;euros par habitant\n"
    # Une commune non éligible à la DSU n'a pas de ligne DSU
    "2025-01-01;33063;Montant Dotation forfaitaire;40000000.0;euros\n"
    "2025-01-01;33063;Montant Dotation DSU;3000000.0;euros\n"
    # Ligne sans montant : écartée, un vide n'est pas un zéro
    "2025-01-01;33999;Montant Dotation forfaitaire;;euros\n"
).encode()


def test_le_filtre_sur_l_exercice_utilise_une_fonction_de_date():
    """`exercice` est de type date dans la source : un filtre texte est rejeté."""
    url = dgcl.url_export(2025)
    assert "year%28exercice%29%3D2025" in url
    assert "limit=-1" in url  # export complet, jamais la pagination de /records
    assert "Montant%20Dotation%20forfaitaire" in url


def test_seules_les_variables_de_montant_sont_lues():
    lignes = dgcl.lire(CSV)
    assert len(lignes) == 4  # le potentiel fiscal et la ligne vide sont écartés
    assert {ligne["composante"] for ligne in lignes} == {"forfaitaire", "dsr", "dsu"}
    assert all(ligne["exercice"] == "2025" for ligne in lignes)


def test_une_unite_inattendue_ecarte_la_ligne_plutot_que_de_la_convertir():
    autre = CSV.replace(b"Montant Dotation DSR;250000.0;euros", b"Montant Dotation DSR;25.0;kilo")
    composantes = {ligne["composante"] for ligne in dgcl.lire(autre)}
    assert "dsr" not in composantes


def test_la_dgf_somme_les_composantes_presentes():
    totaux = dgcl.dgf(dgcl.lire(CSV))
    assert totaux[("33318", "2025")] == 5_250_000.0
    # Bordeaux : forfaitaire + DSU, sans DSR — l'absence n'est pas un zéro manquant
    assert totaux[("33063", "2025")] == 43_000_000.0
    assert ("33999", "2025") not in totaux
