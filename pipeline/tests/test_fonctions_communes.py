"""À quoi sert l'argent d'une commune, et ce qui sépare deux comptages.

Le grand livre de la DGFiP donne 385,9 M€ de charges pour Bordeaux 2023 là où
l'OFGL en publie 353,7. Les deux sont justes sur leur périmètre. Ces tests
fixent la seule chose qui rende la décomposition publiable : les onze lignes
doivent redonner exactement l'agrégat que le site publie déjà, l'écart compris
et nommé.
"""

import pytest

from plateforme.normalize import fonctions_communes as f

EXPORT = (
    b"ndept;insee;fonction;debit\n"
    b"033;063;020;118600000\n"
    b"033;063;01;0\n"
    b"033;063;311;100100000\n"
    b"033;063;4221;167175349.4\n"
    b"02A;247;020;1000000\n"
    b"101;101;020;2000000\n"
)


def test_le_code_insee_se_reconstruit_pour_la_corse_et_l_outre_mer():
    """Le département de la DGFiP est cadré sur trois caractères par un zéro de
    tête, que la Corse n'a pas et que l'outre-mer remplace par un code à lui."""
    assert f.code_insee("033", "063") == "33063"
    assert f.code_insee("001", "004") == "01004"
    assert f.code_insee("02A", "247") == "2A247"
    # 101 est le code DGFiP de la Guadeloupe ; le code officiel dit 971.
    assert f.code_insee("101", "101") == "97101"
    assert f.code_insee("033", "63") is None


def test_les_fonctions_se_replient_sur_leur_premier_caractere():
    lignes = f.lire(EXPORT)
    bordeaux = f.par_commune(lignes)["33063"]
    # 020 et 01 tombent tous deux dans les services généraux.
    assert bordeaux["0"] == 118_600_000
    assert bordeaux["3"] == 100_100_000
    assert bordeaux["4"] == 167_175_349.4


def test_une_fonction_inconnue_ne_disparait_pas():
    """Les écarter ferait manquer la somme au contrôle, et les compter ailleurs
    inventerait une destination que la source ne donne pas."""
    lignes = f.lire(b"ndept;insee;fonction;debit\n033;063;;5000\n033;063;ZZ;3000\n")
    assert f.par_commune(lignes)["33063"]["0"] == 8000


def test_les_onze_lignes_redonnent_l_agregat_de_l_ofgl():
    totaux = f.par_commune(f.lire(EXPORT))
    ofgl = {"33063": 353_700_000.0}
    sorties = f.candidates(totaux, ofgl)
    # Trois fonctions servies plus le résidu : les fonctions absentes ne sont
    # pas écrites à zéro, ce qui inventerait une dépense nulle.
    bordeaux = [s for s in sorties if s[2] == "33063"]
    assert len(bordeaux) == 4
    assert round(sum(valeur for *_r, valeur in bordeaux), 2) == 353_700_000.0
    residu = [s for s in bordeaux if s[0] == f.RESIDU][0]
    # Le grand livre est plus large que l'agrégat : le résidu retranche.
    assert residu[4] < 0
    f.controler(bordeaux, ofgl)


def test_une_commune_sans_agregat_de_reference_n_est_pas_ecrite():
    """Sans lui, le résidu ne se calcule pas, et publier dix fonctions dont la
    somme ne correspond à aucun total du site donnerait un second jeu de
    chiffres sur les mêmes lignes."""
    totaux = f.par_commune(f.lire(EXPORT))
    sorties = f.candidates(totaux, {"33063": 353_700_000.0})
    assert not [s for s in sorties if s[2] in ("2A247", "97101")]


def test_le_controle_refuse_une_decomposition_qui_ne_boucle_pas():
    ofgl = {"33063": 353_700_000.0}
    fausses = [("fonction_commune_culture", "commune", "33063", f.EXERCICE, 1000.0)]
    with pytest.raises(ValueError, match="ne redonne pas l'agrégat"):
        f.controler(fausses, ofgl)


def test_une_fiche_publique_tient_en_cinquante_mots(entrepot_seme):
    """La contrainte est celle du schéma, et elle a raison.

    Les réserves — imputation comptable, seuil de 3 500 habitants, écart avec
    l'OFGL — vivent dans la définition technique, que la fiche affiche juste en
    dessous. Écrites dans la définition publique, elles la faisaient passer de
    vingt-huit à cent quarante mots et le chargement échouait en production.
    """
    # Le jeu vient du registre semé, comme en production : c'est lui qui
    # garantit qu'aucune observation ne vient d'un jeu non déclaré.
    conn = entrepot_seme
    f.declarer(conn)
    lignes = conn.execute(
        "select i.indicator_id, d.public_definition from core.indicators i"
        " join core.indicator_definitions d on d.definition_id = i.definition_id"
        " where i.dataset_id = ?",
        (f.DATASET,),
    ).fetchall()
    assert len(lignes) == 11
    for identifiant, definition in lignes:
        assert len(definition.split()) <= 50, identifiant
    # Redéclarer ne duplique pas et ne laisse pas de définition orpheline.
    f.declarer(conn)
    (orphelines,) = conn.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0
