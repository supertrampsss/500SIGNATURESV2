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


# ----------------------------------------------------------------------------
# Les maires sortants : la mandature 2020-2026.
# ----------------------------------------------------------------------------

ENTETE_SORTANTS = [
    "Code du département", "Libellé du département",
    "Code de la collectivité à statut particulier",
    "Libellé de la collectivité à statut particulier", "Code de la commune",
    "Libellé de la commune", "Nom de l'élu", "Prénom de l'élu", "Code sexe",
    "Date de naissance", "Code de la catégorie socio-professionnelle",
    "Libellé de la catégorie socio-professionnelle", "Date de début du mandat",
    "Date de début de la fonction",
]


def ligne_sortant(code: str, nom: str, prenom: str, fonction: str) -> list[str]:
    champs = [""] * len(ENTETE_SORTANTS)
    champs[4], champs[6], champs[7] = code, nom, prenom
    champs[12] = "18/05/20"
    champs[13] = fonction
    return champs


def test_les_dates_des_sortants_sont_en_jour_mois_annee():
    """**Deux formats chez un seul producteur.** Le RNE courant écrit
    `2026-03-15`, le fichier des sortants `18/05/20`. Lue telle quelle, cette
    seconde date serait entrée en base comme une date de l'an 20."""
    assert m.date_fr("18/05/20") == "2020-05-18"
    assert m.date_fr("03/07/20") == "2020-07-03"
    assert m.date_fr("21/10/20") == "2020-10-21"
    # Une date vide ou illisible ne devient pas une date fausse.
    assert m.date_fr("") is None
    assert m.date_fr("2020-05-18") is None


def test_le_sortant_est_lu_avec_sa_prise_de_fonction():
    """Un maire sortant sur trente a pris ses fonctions en cours de mandature,
    après une démission ou un décès. C'est la prise de fonction qui est
    publiée, jamais le début du mandat du conseil."""
    contenu = csv_bytes(ENTETE_SORTANTS, [
        ligne_sortant("33063", "HURMIC", "Pierre", "03/07/20"),
        ligne_sortant("13055", "PAYAN", "Benoît", "21/10/20"),
    ])
    lus = m.sortants(contenu)
    assert [x["geo_code"] for x in lus] == ["33063", "13055"]
    assert lus[0]["since"] == "2020-07-03"
    # Et non « 2020-05-18 », le début du mandat du conseil.
    assert lus[1]["since"] == "2020-10-21"


def test_le_code_commune_des_sortants_se_complete():
    """`1001` -> `01001` : le zéro de tête saute au passage par un tableur, et
    un code à quatre caractères ne joint aucun référentiel."""
    contenu = csv_bytes(ENTETE_SORTANTS, [ligne_sortant("1001", "A", "A", "18/05/20")])
    assert m.sortants(contenu)[0]["geo_code"] == "01001"


def test_une_commune_en_double_ne_fait_pas_echouer_le_chargement():
    """Mesuré : une commune apparaît deux fois dans le fichier réel. La
    première ligne est gardée — échouer ferait perdre 34 888 maires pour une
    seule ligne douteuse."""
    contenu = csv_bytes(ENTETE_SORTANTS, [
        ligne_sortant("33063", "HURMIC", "Pierre", "03/07/20"),
        ligne_sortant("33063", "AUTRE", "Quelqu'un", "04/07/20"),
    ])
    lus = m.sortants(contenu)
    assert len(lus) == 1 and lus[0]["surname"] == "HURMIC"


def test_le_sortant_a_son_propre_role():
    """Le maire en exercice et le maire sortant cohabitent sur la même commune :
    sans deux rôles distincts, le second écraserait le premier et la fiche
    afficherait un seul nom, sans qu'on sache lequel."""
    from plateforme.publish import ROLE_PRECEDENT_PAR_NIVEAU

    assert m.ROLE_SORTANT != ROLE_PAR_NIVEAU["commune"]
    assert ROLE_PRECEDENT_PAR_NIVEAU["commune"] == m.ROLE_SORTANT
    # Aucun équivalent pour les autres mailles : leur mandature court toujours.
    assert set(ROLE_PRECEDENT_PAR_NIVEAU) == {"commune"}


def test_le_module_garde_la_mesure_qui_a_corrige_l_erreur():
    """On avait conclu que les maires 2020-2026 n'étaient publiés nulle part,
    en lisant un seul jeu sans lister ceux du producteur. L'erreur et sa
    correction sont écrites dans le module pour que personne ne la refasse."""
    doc = m.__doc__ or ""
    assert "C'était faux" in doc
    assert "99,8" in doc
    assert "sortants" in doc.lower()
