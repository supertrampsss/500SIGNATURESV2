"""Les présidents de conseil départemental et régional, lus du RNE.

Ces tests portent surtout sur ce que la source NE permet pas. Le RNE national
est une ressource écrasée à chaque publication : elle donne l'exécutif en
exercice et jamais ses prédécesseurs. Un module qui l'oublierait publierait
« le président qui a présidé à ces comptes » sur des exercices qu'il n'a pas
présidés.
"""

import pytest

from plateforme.normalize import maires as m
from plateforme.publish import ROLE_PAR_NIVEAU


def csv_bytes(entete: list[str], lignes: list[list[str]]) -> bytes:
    corps = [";".join(entete)] + [";".join(ligne) for ligne in lignes]
    return "\n".join(corps).encode("utf-8")


DEP = m.EXECUTIFS[0]
REG = m.EXECUTIFS[1]

#: L'en-tête réel du fichier des conseillers départementaux, relevé le 17 août
#: 2026. Les indices de `EXECUTIFS` s'y rapportent.
ENTETE_DEP = [
    "Code du département", "Libellé du département", "Code du canton",
    "Libellé du canton", "Nom de l'élu", "Prénom de l'élu", "Code sexe",
    "Date de naissance", "Code de la catégorie socio-professionnelle",
    "Libellé de la catégorie socio-professionnelle", "Date de début du mandat",
    "Libellé de la fonction", "Date de début de la fonction",
]


def ligne_dep(code: str, nom: str, prenom: str, fonction: str, depuis: str) -> list[str]:
    champs = [""] * len(ENTETE_DEP)
    champs[0], champs[4], champs[5] = code, nom, prenom
    champs[10] = "2021-06-27"
    champs[11], champs[12] = fonction, depuis
    return champs


def test_seule_la_presidence_est_retenue():
    """Un conseil départemental compte des dizaines d'élus ; un seul préside."""
    contenu = csv_bytes(ENTETE_DEP, [
        ligne_dep("33", "PHILIPPE", "Jean-Luc", "Président du conseil départemental", "2021-07-01"),
        ligne_dep("33", "MARTIN", "Claire", "4ème Vice-président du conseil départemental", "2021-07-01"),
        ligne_dep("33", "DURAND", "Paul", "", ""),
        ligne_dep("01", "DEGUERRY", "Jean", "Président du conseil départemental", "2021-07-01"),
    ])
    lus = m.presidents(contenu, DEP)
    assert [x["geo_code"] for x in lus] == ["33", "01"]
    assert lus[0]["surname"] == "PHILIPPE" and lus[0]["given_name"] == "Jean-Luc"


def test_un_vice_president_n_est_pas_un_president():
    """« 4ème Vice-président » contient « Président » : une comparaison lâche
    aurait retenu neuf vice-présidents par département, et le contrôle de
    doublons aurait fait échouer le run sans dire pourquoi."""
    contenu = csv_bytes(ENTETE_DEP, [
        ligne_dep("33", "A", "A", "1er Vice-président du conseil départemental", "2021-07-01"),
        ligne_dep("33", "B", "B", "Président de commission du conseil départemental", "2021-07-01"),
    ])
    assert m.presidents(contenu, DEP) == []


def test_c_est_la_prise_de_fonction_qui_est_publiee():
    """Un président est d'abord élu conseiller, puis porté à la présidence par
    son assemblée — parfois des mois plus tard. Publier le début du mandat de
    conseiller daterait sa présidence d'avant qu'elle existe."""
    contenu = csv_bytes(ENTETE_DEP, [
        ligne_dep("33", "PHILIPPE", "Jean-Luc", "Président du conseil départemental", "2021-07-01"),
    ])
    lu = m.presidents(contenu, DEP)[0]
    assert lu["since"] == "2021-07-01"  # et non « 2021-06-27 », le début de mandat


def test_le_code_n_est_pas_complete_a_cinq_caracteres():
    """Un code commune se complète (`1001` -> `01001`) ; un département s'écrit
    « 01 » ou « 971 » et une région « 75 » dans le référentiel. Les compléter
    les rendrait introuvables."""
    contenu = csv_bytes(ENTETE_DEP, [
        ligne_dep("01", "A", "A", "Président du conseil départemental", "2021-07-01"),
        ligne_dep("971", "B", "B", "Président du conseil départemental", "2021-07-02"),
    ])
    assert [x["geo_code"] for x in m.presidents(contenu, DEP)] == ["01", "971"]


def test_un_entete_deplace_fait_echouer_le_chargement():
    """Les colonnes sont désignées par leur rang, et un rang est muet : si la
    source insère une colonne, on lirait un prénom là où on attend une
    fonction, et rien ne le signalerait."""
    entete = list(ENTETE_DEP)
    entete[11] = "Fonction exercée"  # renommée par la source
    with pytest.raises(ValueError, match="colonnes absentes"):
        m.presidents(csv_bytes(entete, []), DEP)


def test_departement_et_region_ne_partagent_pas_une_cle():
    """**Le département de Paris et la région Île-de-France portent tous deux
    le code « 75 ».** Le rôle fait partie de la clé primaire ; sans lui, le
    second écraserait le premier en silence, et une fiche afficherait l'exécutif
    de l'autre."""
    assert DEP["role"] != REG["role"]
    assert ROLE_PAR_NIVEAU["departement"] != ROLE_PAR_NIVEAU["region"]
    assert set(ROLE_PAR_NIVEAU) == {"commune", "departement", "region"}


def test_le_module_dit_que_la_source_n_a_pas_d_historique():
    """La garde de fond, écrite dans le module et vérifiée ici : le RNE est
    écrasé à chaque publication. Un lecteur de ce fichier doit apprendre en
    trois lignes pourquoi le site ne nomme pas le maire de la mandature
    précédente, sans avoir à refaire la mesure.
    """
    doc = m.__doc__ or ""
    assert "écrasée" in doc
    assert "2019 ni 2020" in doc or "jamais 2019" in doc
    assert "juillet 2021" in doc
