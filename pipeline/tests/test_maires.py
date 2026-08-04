"""Un maire est une personne : ce qu'on charge de lui est un choix, pas un défaut."""

import pytest

from plateforme.normalize import maires as m

ENTETE = b"a;b;c;d;e;f;g;h;i;j;k;l;m;n;o;p\n"
LIGNE = (
    '1;"Ain";;;{code};"Commune";"{nom} ";"{prenom}";"F";1972-06-02;'
    '37;"Cadre";2026-03-15;"{fonction}";;"FR"'
)


def fichier(*lignes: str) -> bytes:
    return ENTETE + ("\n".join(lignes) + "\n").encode()


def test_le_zero_de_tete_est_rendu_au_code_commune():
    """La source écrit 1001 là où l'INSEE écrit 01001 : sans cela, aucun maire
    ne se rattache à sa commune."""
    assert m.code_commune("1001") == "01001"
    assert m.code_commune(" 1001 ") == "01001"


def test_les_codes_corses_et_ultramarins_traversent_intacts():
    assert m.code_commune("2A004") == "2A004"
    assert m.code_commune("97101") == "97101"


def test_seuls_les_maires_sont_retenus():
    contenu = fichier(
        LIGNE.format(code="1001", nom="EVALET", prenom="Line", fonction="Maire"),
        LIGNE.format(code="1001", nom="BEAUDET", prenom="Sylvie", fonction=""),
        LIGNE.format(code="1001", nom="BECHARD", prenom="Marc", fonction="1er adjoint au Maire"),
    )
    [maire] = m.maires(contenu)
    assert maire == {
        "geo_code": "01001",
        "surname": "EVALET",
        "given_name": "Line",
        "since": "2026-03-15",
    }


def test_aucune_donnee_personnelle_ne_traverse():
    """La source porte date de naissance, sexe et catégorie socio-professionnelle.
    Aucun de ces champs ne doit sortir du parseur."""
    [maire] = m.maires(fichier(LIGNE.format(code="1001", nom="X", prenom="Y", fonction="Maire")))
    assert set(maire) == {"geo_code", "surname", "given_name", "since"}
    assert "1972-06-02" not in str(maire)  # date de naissance
    assert "Cadre" not in str(maire)  # catégorie socio-professionnelle


def test_une_source_vide_echoue_au_lieu_de_vider_la_table():
    with pytest.raises(ValueError, match="format de la source"):
        m.controler([])


def test_deux_maires_pour_une_commune_echouent():
    """Deux mandats mélangés donneraient un nom faux sur la fiche."""
    doublons = [
        {"geo_code": "01001", "surname": "A", "given_name": "a", "since": None},
        {"geo_code": "01001", "surname": "B", "given_name": "b", "since": None},
    ]
    with pytest.raises(ValueError, match="plusieurs maires"):
        m.controler(doublons)


def test_le_registre_declare_la_donnee_personnelle():
    import csv
    from pathlib import Path

    registre = Path(m.__file__).parents[3] / "infra/seed/dataset_registry.csv"
    with registre.open(encoding="utf-8") as fichier_csv:
        jeux = {ligne["dataset_id"]: ligne for ligne in csv.DictReader(fichier_csv)}
    assert jeux[m.DATASET]["personal_data"] == "true"
    assert jeux[m.DATASET]["target_tables"] == "geo.commune_officials"
