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


def test_les_composantes_se_publient_une_par_une():
    """La DGF totale disait combien l'État verse, jamais au titre de quoi.
    Les trois péréquations étaient déjà lues, et jetées."""
    montants = dgcl.par_composante(dgcl.lire(CSV))
    assert montants[("forfaitaire", "33318", "2025")] == 5000000.0
    assert montants[("dsr", "33318", "2025")] == 250000.0
    assert montants[("dsu", "33063", "2025")] == 3000000.0
    # Bordeaux n'a pas de ligne DSR : non éligible, pas zéro euro.
    assert ("dsr", "33063", "2025") not in montants


def test_le_controle_bloque_une_perequation_sans_part_forfaitaire():
    """Le format est long : la variable est une chaîne, et la lire de travers
    ne fait rien planter. Une composante rattachée aux mauvaises communes se
    verrait ici, alors qu'un total resterait juste."""
    import pytest

    from plateforme.normalize import dotations

    montants = dgcl.par_composante(dgcl.lire(CSV))
    assert dotations.controler_perequation(montants)["forfaitaire"] == 2
    decalees = {**montants, ("dsr", "99999", "2025"): 1000.0}
    with pytest.raises(dotations.PerequationRompue, match="sans part"):
        dotations.controler_perequation(decalees)


def test_le_controle_bloque_une_dsu_trop_repandue():
    """Moins de mille communes touchent la DSU. Si elle en touchait autant que
    la part forfaitaire, c'est que deux variables ont été confondues."""
    import pytest

    from plateforme.normalize import dotations

    partout = {
        ("forfaitaire", "33318", "2025"): 1.0,
        ("dsu", "33318", "2025"): 1.0,
    }
    with pytest.raises(dotations.PerequationRompue, match="proportion est impossible"):
        dotations.controler_perequation(partout)


def test_les_fiches_disent_que_l_absence_n_est_pas_un_zero():
    from plateforme.normalize import dotations

    for _, (_, _, publique, technique) in dotations.COMPOSANTES_PUBLIEES.items():
        assert len(publique.split()) <= 50
        assert "éligib" in technique
        # Le site publie déjà un agrégat OFGL « péréquations et compensations
        # fiscales », qui porte les compensations d'exonérations et non la DGF.
        # Sans cet avertissement, le lecteur prendrait l'un pour la
        # décomposition de l'autre — le piège déjà rencontré sur le REI.
        assert "ne se décomposent" in technique
