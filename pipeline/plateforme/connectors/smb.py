"""Situation mensuelle budgétaire de l'État (DGFiP) — lecture et contrôles.

Une seule source publie côte à côte, sur la **même nomenclature**, ce que la loi
de finances a voté et ce que l'État a réellement encaissé et décaissé. C'est
elle qui rend possible le « voté contre exécuté » sans rapprocher deux documents
qui ne se ressemblent pas.

Trois fichiers, trois rôles :

- l'API Explore donne les cumuls **mensuels** de l'exercice en cours et des deux
  précédents ;
- la pièce jointe « séries longues » donne les mêmes cumuls mensuels depuis 2013 ;
- les pièces jointes « textes législatifs » donnent, par exercice, les montants
  de la **loi de finances initiale** et de la **dernière loi de finances
  rectificative**.

Pièges de la source, traités ici plutôt que découverts en production :

1. **Cumuls, pas flux.** Une colonne datée du 31/05 porte le cumul depuis le
   1ᵉʳ janvier. Comparer mai à décembre n'a aucun sens ; seule la colonne de
   décembre d'un exercice clos vaut montant annuel.
2. **Fonds de concours.** L'identité du solde ajoute les fonds de concours dans
   l'exécution, mais pas dans les textes votés : depuis 2024 la loi de finances
   en publie une *évaluation* déjà comprise dans ses crédits, et l'ajouter
   compterait deux fois près de 7 Md€.
3. **Colonne « Exécution » des textes législatifs décalée.** Pour 2019, 2020 et
   2021 elle porte les dépenses nettes de l'exercice précédent, et l'identité du
   solde s'écarte alors de plusieurs dizaines de milliards. L'exécution est donc
   lue dans les séries mensuelles, jamais dans ce fichier — c'est le contrôle
   d'identité ci-dessous qui a permis de le voir.
4. **Libellés instables.** Apostrophe typographique, espaces finales : les
   libellés sont normalisés avant tout rapprochement.

Cadre comptable : **comptabilité budgétaire** (encaissements-décaissements),
État seul. Le solde budgétaire n'est ni le déficit public au sens de Maastricht
(toutes administrations, comptabilité nationale) ni la variation de la dette.
"""

import csv
import unicodedata
from dataclasses import dataclass

BASE = "https://data.economie.gouv.fr/api/explore/v2.1"
JEU = "situations-mensuelles-budgetaires-series-longues"

RECORDS_URL = f"{BASE}/catalog/datasets/{JEU}/records?limit=100"
PIECES_JOINTES = {
    "series_longues": "series_longues_smb_dgfip_2013_2023_csv",
    "textes_2013_2023": "textes_legislatifs_open_data_2013_2023_csv",
    "textes_courants": "textes_legislatifs_2024_xxcsv",
}


def url_piece_jointe(nom: str) -> str:
    return f"{BASE}/catalog/datasets/{JEU}/attachments/{PIECES_JOINTES[nom]}"


# Le producteur nomme les textes en français ; le modèle nomme les étapes en
# vocabulaire LOLF. La correspondance est explicite pour qu'un texte inconnu
# ne soit pas rangé par défaut dans une case qui ne lui va pas.
ETAPES = {
    "LFI": ("LFI", "vote"),
    "Dernière LFR/LFG": ("LFR", "rectifie"),
}

# Le fichier des textes législatifs contient aussi une colonne « Exécution ».
# Elle n'alimente rien : elle sert à recouper l'exécution lue dans les séries
# mensuelles, et c'est ce recoupement qui a révélé son décalage sur 2019-2021.
EXECUTION = "Exécution"


@dataclass(frozen=True)
class Ligne:
    """Une ligne d'information de la situation mensuelle.

    `feuille` distingue les montants qui s'additionnent sans doublon des totaux
    qui les récapitulent. Les deux sont publiés — certains textes budgétaires ne
    donnent que leurs totaux — mais un total porte le genre `agregat`, et une
    table de lignes budgétaires ne se somme qu'en l'excluant.
    """

    libelle: str
    rang: int
    cote: str | None  # 'depense', 'recette', ou None pour les soldes
    genre: str | None  # fin.public_budget_lines.line_kind
    feuille: bool
    titre: str | None  # titre LOLF, pour les dépenses du budget général
    indicateur: str | None  # indicateur national publié, le cas échéant


def normaliser(libelle: str) -> str:
    """Apostrophe droite, espaces réduites : les libellés de la source ne
    varient d'un fichier à l'autre que sur ces deux points."""
    return " ".join(unicodedata.normalize("NFC", libelle).replace("’", "'").split())


# Les 26 lignes de la situation mensuelle, dans l'ordre de lecture du produit.
# Les titres sont ceux de l'article 5 de la LOLF : la source ne les numérote
# pas, mais ses sous-totaux de niveau 2 en sont la reprise exacte.
_LIGNES = [
    Ligne("Solde budgétaire", 0, None, None, False, None, "etat_solde_budgetaire"),
    Ligne("Total recettes nettes du budget général", 10, "recette", "agregat", False, None,
          "etat_recettes_nettes_bg"),
    Ligne("Total recettes fiscales", 11, "recette", "agregat", False, None,
          "etat_recettes_fiscales"),
    Ligne("Impôt sur le revenu", 12, "recette", "recette_fiscale", True, None,
          "etat_impot_revenu"),
    Ligne("Impôt sur les sociétés", 13, "recette", "recette_fiscale", True, None,
          "etat_impot_societes"),
    Ligne("Taxe sur la valeur ajoutée", 14, "recette", "recette_fiscale", True, None,
          "etat_tva"),
    Ligne("Taxe intérieure de consommation sur les produits énergétiques", 15, "recette",
          "recette_fiscale", True, None, "etat_ticpe"),
    Ligne("Autres recettes fiscales", 16, "recette", "recette_fiscale", True, None, None),
    Ligne("Total recettes non fiscales", 17, "recette", "recette_non_fiscale", True, None,
          "etat_recettes_non_fiscales"),
    Ligne("Fonds de concours et attribution de produits", 18, "recette", "recette_affectee",
          True, None, "etat_fonds_de_concours"),
    Ligne("Total dépenses nettes du budget général", 20, "depense", "agregat", False, None,
          "etat_depenses_nettes_bg"),
    Ligne("Dotation des pouvoirs publics", 21, "depense", "credit", True, "1", None),
    Ligne("Dépenses de personnel", 22, "depense", "credit", True, "2",
          "etat_depenses_personnel"),
    Ligne("Dépenses de fonctionnement", 23, "depense", "credit", True, "3", None),
    Ligne("Charges de la dette de l'Etat", 24, "depense", "credit", True, "4",
          "etat_charge_dette"),
    Ligne("Dépenses d'investissement", 25, "depense", "credit", True, "5", None),
    Ligne("Dépenses d'intervention", 26, "depense", "credit", True, "6", None),
    Ligne("Dépenses d'opérations financières", 27, "depense", "credit", True, "7", None),
    Ligne("Total prélèvements sur recettes", 30, "depense", "agregat", False, None, None),
    Ligne("PSR au profit des collectivités territoriales", 31, "depense", "credit", True, None,
          "etat_psr_collectivites"),
    Ligne("PSR au profit de l'Union européenne", 32, "depense", "credit", True, None,
          "etat_psr_union_europeenne"),
    # Les remboursements et dégrèvements sont déjà retranchés des recettes et
    # des dépenses « nettes » : ils recouvrent donc d'autres lignes et ne
    # s'additionnent jamais au reste.
    Ligne("Remboursements et dégrèvements d'impôts d'Etat", 40, "depense", "agregat", False,
          None, "etat_remboursements_impots_etat"),
    Ligne("Remboursements et dégrèvements d'impôts locaux", 41, "depense", "agregat", False,
          None, None),
    Ligne("Solde des comptes spéciaux", 50, None, None, False, None,
          "etat_solde_comptes_speciaux"),
    Ligne("CCF Avances aux collectivités territoriales", 51, None, None, False, None, None),
    Ligne("Solde des Budgets annexes", 52, None, None, False, None,
          "etat_solde_budgets_annexes"),
]

LIGNES = {normaliser(ligne.libelle): ligne for ligne in _LIGNES}

# Identité comptable du solde budgétaire, telle que la publie la DGFiP.
IDENTITE = {
    "Total recettes nettes du budget général": 1,
    "Total dépenses nettes du budget général": -1,
    "Total prélèvements sur recettes": -1,
    "Solde des comptes spéciaux": 1,
    "Solde des Budgets annexes": 1,
}
FONDS_DE_CONCOURS = "Fonds de concours et attribution de produits"
SOLDE = "Solde budgétaire"

# Chaque total doit être la somme exacte de ses composantes. Ces contrôles
# valident aussi la découpe en feuilles : si un total ne se reconstitue plus,
# c'est que la source a changé de nomenclature et que la somme des lignes
# publiées ne vaudrait plus rien.
SOUS_TOTAUX = {
    "Total recettes nettes du budget général": [
        "Total recettes fiscales",
        "Total recettes non fiscales",
    ],
    "Total recettes fiscales": [
        "Impôt sur le revenu",
        "Impôt sur les sociétés",
        "Taxe sur la valeur ajoutée",
        "Taxe intérieure de consommation sur les produits énergétiques",
        "Autres recettes fiscales",
    ],
    "Total dépenses nettes du budget général": [
        "Dotation des pouvoirs publics",
        "Dépenses de personnel",
        "Dépenses de fonctionnement",
        "Charges de la dette de l'Etat",
        "Dépenses d'investissement",
        "Dépenses d'intervention",
        "Dépenses d'opérations financières",
    ],
    "Total prélèvements sur recettes": [
        "PSR au profit des collectivités territoriales",
        "PSR au profit de l'Union européenne",
    ],
}

# Les lois de finances antérieures à 2016 arrondissent certaines lignes au
# million : sur treize exercices, l'écart constaté n'a jamais dépassé 16 M€.
# Au-delà, ce n'est plus un arrondi, c'est une erreur de lecture.
TOLERANCE_EUR = 20_000_000


def nombre(texte: str | None) -> float | None:
    """Décimale française, séparateurs de milliers ordinaires ou insécables."""
    if texte is None:
        return None
    nettoye = texte.strip().replace(" ", "").replace(" ", "").replace(",", ".")
    return float(nettoye) if nettoye else None


def lire_csv(contenu: bytes) -> tuple[list[str], list[list[str]]]:
    """Les pièces jointes sont exportées en UTF-16 avec BOM et séparateur `;`."""
    texte = contenu.decode("utf-16")
    lignes = list(csv.reader(texte.splitlines(), delimiter=";"))
    return lignes[0], [ligne for ligne in lignes[1:] if len(ligne) > 4 and ligne[4].strip()]


def _colonnes_datees(entete: list[str], motif: str) -> dict[str, int]:
    """{période: index de colonne}. Les colonnes mensuelles sont datées
    `JJ/MM/AAAA`, les colonnes annuelles portent l'année seule."""
    colonnes = {}
    for index, titre in enumerate(entete):
        brut = titre.strip()
        if motif == "mois" and brut.count("/") == 2:
            _, mois, annee = brut.split("/")
            colonnes[f"{annee}-{mois}"] = index
        elif motif == "annee" and brut.isdigit() and len(brut) == 4:
            colonnes[brut] = index
    return colonnes


def _valeurs(lignes: list[list[str]], colonnes: dict[str, int], filtre=None) -> dict:
    resultat: dict[str, dict[str, float]] = {}
    for ligne in lignes:
        if filtre is not None and not filtre(ligne):
            continue
        libelle = normaliser(ligne[4])
        for periode, index in colonnes.items():
            valeur = nombre(ligne[index]) if index < len(ligne) else None
            if valeur is not None:
                resultat.setdefault(periode, {})[libelle] = valeur
    return resultat


def series_mensuelles(contenu: bytes) -> dict[str, dict[str, float]]:
    """Pièce jointe « séries longues » -> {période AAAA-MM: {ligne: montant}}."""
    entete, lignes = lire_csv(contenu)
    return _valeurs(lignes, _colonnes_datees(entete, "mois"))


def series_records(records: list[dict]) -> dict[str, dict[str, float]]:
    """Records de l'API Explore -> {période AAAA-MM: {ligne: montant}}.

    Les colonnes mensuelles y deviennent des champs nommés `JJ_MM_AAAA`."""
    resultat: dict[str, dict[str, float]] = {}
    for record in records:
        libelle = normaliser(record.get("ligne_d_information") or "")
        if not libelle:
            continue
        for champ, valeur in record.items():
            morceaux = champ.split("_")
            if len(morceaux) != 3 or not all(m.isdigit() for m in morceaux) or valeur is None:
                continue
            _, mois, annee = morceaux
            resultat.setdefault(f"{annee}-{mois}", {})[libelle] = float(valeur)
    return resultat


def textes_legislatifs(contenu: bytes) -> dict[tuple[str, str], dict[str, float]]:
    """Pièce jointe « textes législatifs » -> {(texte, exercice): {ligne: montant}}.

    Tous les textes présents sont rendus, y compris ceux que le connecteur
    n'écrit pas : un texte inconnu doit se voir, pas disparaître dans un filtre.
    """
    entete, lignes = lire_csv(contenu)
    colonnes = _colonnes_datees(entete, "annee")
    textes = {ligne[5].strip() for ligne in lignes if len(ligne) > 5 and ligne[5].strip()}
    resultat: dict[tuple[str, str], dict[str, float]] = {}
    for texte in textes:
        par_annee = _valeurs(
            lignes,
            colonnes,
            lambda ligne, attendu=texte: len(ligne) > 5 and ligne[5].strip() == attendu,
        )
        for annee, valeurs in par_annee.items():
            resultat[(texte, annee)] = valeurs
    return resultat


def controles(valeurs: dict[str, float], fonds_de_concours: bool) -> dict[str, float]:
    """{nom du contrôle: écart en euros}. Un écart nul signifie que la
    décomposition publiée se referme exactement.

    `fonds_de_concours` distingue les deux régimes documentés en tête de module :
    l'exécution les ajoute au solde, les textes votés les comptent déjà dans
    leurs crédits.
    """
    ecarts: dict[str, float] = {}
    solde = valeurs.get(normaliser(SOLDE))
    if solde is not None:
        recalcule = sum(
            signe * valeurs.get(normaliser(libelle), 0.0) for libelle, signe in IDENTITE.items()
        )
        if fonds_de_concours:
            recalcule += valeurs.get(normaliser(FONDS_DE_CONCOURS), 0.0)
        ecarts["solde_budgetaire"] = solde - recalcule
    for total, composantes in SOUS_TOTAUX.items():
        publie = valeurs.get(normaliser(total))
        presentes = [c for c in composantes if normaliser(c) in valeurs]
        # Les textes votés ne détaillent pas tous le même niveau : une loi de
        # finances rectificative peut ne publier que ses totaux. Absence
        # complète du détail = contrôle sans objet, pas contrôle en échec.
        if publie is None or not presentes:
            continue
        somme = sum(valeurs.get(normaliser(c), 0.0) for c in composantes)
        ecarts[normaliser(total)] = publie - somme
    return ecarts


def parents() -> dict[str, str]:
    """{ligne: total qui la contient}. La hiérarchie est déduite de SOUS_TOTAUX
    plutôt que redéclarée : deux descriptions de la même arborescence finiraient
    par diverger, et c'est l'affichage qui mentirait."""
    return {
        normaliser(composante): normaliser(total)
        for total, composantes in SOUS_TOTAUX.items()
        for composante in composantes
    }


def ordre_de_lecture() -> list[dict]:
    """Métadonnées d'affichage des lignes, dans l'ordre du produit : recettes,
    puis dépenses, puis soldes. L'ordre du fichier source suit la présentation
    de la DGFiP, qui n'est pas celle d'un pont recettes → dépenses → solde."""
    hierarchie = parents()
    return [
        {
            "libelle": ligne.libelle,
            "cote": ligne.cote,
            "titre": ligne.titre,
            "agregat": ligne.genre == "agregat",
            "parent": hierarchie.get(normaliser(ligne.libelle)),
            "indicateur": ligne.indicateur,
        }
        for ligne in sorted(_LIGNES, key=lambda ligne: ligne.rang)
    ]


def lignes_inconnues(valeurs: dict[str, float]) -> list[str]:
    """Une ligne que le connecteur ne sait pas classer ne doit pas être rangée
    au hasard : elle interrompt le run et attend une décision humaine."""
    return sorted(libelle for libelle in valeurs if libelle not in LIGNES)
