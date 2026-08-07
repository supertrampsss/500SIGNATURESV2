"""L'exécution du budget de l'État par mission : non plus « quoi », mais « pour quoi ».

Le site publiait le budget de l'État **par nature** — du personnel, de la dette,
des recettes. Il ne disait pas à quoi l'argent avait servi. Les annexes du
projet de loi relatif aux résultats de la gestion (PLRG), déposé chaque
printemps par la DGFiP, ventilent l'exécution par **mission**, c'est-à-dire par
politique publique : la Défense, l'Enseignement scolaire, la Justice. Ce module
les charge.

**Le voté et le consommé sont deux indicateurs, pas un seul.** Pour chaque
mission, la loi de finances initiale a prévu un montant, et l'État en a payé un
autre. Publier le seul consommé effacerait la décision ; publier le seul voté
effacerait ce qui s'est passé. Les deux sont donc distincts, et leur écart n'est
pas un dépassement : entre le vote et le paiement s'intercalent les lois
rectificatives, les reports de l'exercice précédent, les mouvements
réglementaires et les fonds de concours, qui forment ensemble les **crédits
ouverts** — 591,45 Md€ en 2025 pour 582,40 Md€ votés et 578,04 Md€ consommés.

**Brut, et le mot est dans la fiche.** La somme des 33 missions vaut
578,04 Md€ en 2025, dont 141,36 Md€ pour la seule mission « Remboursements et
dégrèvements », qui rend aux contribuables ce qu'ils ont trop payé. Net, l'État
a dépensé 436,67 Md€. Publier le brut sous le nom « dépenses de l'État »
gonflerait le chiffre d'un tiers. Le choix retenu est de publier **chaque
mission pour elle-même**, remboursements compris et signalés : c'est le seul
montant qui ait un sens à la maille de la mission. Le total net, lui, reste
publié par le connecteur de l'État sur sa propre source, et les deux ne se
substituent pas.

**Le contrôle qui bloque.** Le même exercice est ventilé trois fois par le même
producteur, avec trois cardinalités : 33 lignes de mission, 177 lignes de
mission × programme × titre, 855 lignes de mission × programme × titre ×
catégorie. Mission par mission, les trois doivent tomber au centime. Sur 2025
comme sur 2024, l'écart est nul sur les 33 missions. Aucune erreur de colonne,
de séparateur décimal ou de ligne oubliée ne satisfait cette égalité par hasard.

**L'exercice 2023 n'est pas publié.** Ses trois annexes sont des exports
tronqués : huit cellules y sont écrites en notation scientifique
(`1,44146E+11`), qui ne retient que six chiffres significatifs et perd jusqu'à
10⁵ €. La mission « Remboursements et dégrèvements » y diverge de 83 650,28 €
entre deux annexes, et vingt-six autres d'une fraction d'euro. Un exercice
dont une cellule a perdu ses chiffres est écarté, et le refus est tracé — plutôt
que de desserrer pour lui un contrôle qui, desserré, ne vérifierait plus rien.

**Ce que ce module ne lit pas, et pourquoi.** L'annexe 2 ne porte que les
comptes spéciaux (36 lignes) et non le budget général : la confondre avec
l'annexe 1 donnerait un budget de l'État réduit aux avances et aux pensions.
L'annexe des recettes n'est pas chargée non plus : elle mêle quatre catégories
dont les « Prélèvements sur les recettes de l'État », **en négatif**, si bien
qu'une somme sans séparation ne mesure rien ; son schéma change à chaque
exercice (trois en-têtes différents, deux séparateurs, une colonne de niveau
hiérarchique en 2024 qui ferait compter deux fois les lignes mères) ; et les
recettes de l'État sont déjà publiées, sur une source mensuelle stable, par
`plateforme.normalize.etat`.

Usage : python -m plateforme.normalize.execution_missions [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
import json
import re
from collections import defaultdict

from plateforme import entrepot, revisions
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, make_store

# Le registre des jeux (`infra/seed/dataset_registry.csv`) est un fichier
# partagé que ce connecteur ne modifie pas. Les annexes du PLRG décrivent le
# même objet que la situation mensuelle budgétaire — le budget de l'État, vu par
# sa destination plutôt que par sa nature — et se déclarent donc sous le jeu
# existant. Une entrée dédiée serait plus juste ; elle demande une modification
# du registre, hors du périmètre de ce module.
DATASET = "execution-budget-etat"
SOURCE = "data-economie"
BASE = "https://data.economie.gouv.fr/api/v2/catalog/datasets"

# Les identifiants de jeu sont irréguliers — deux portent le titre complet en
# slug, celui de 2024 non. Ils sont écrits ici plutôt que devinés : une règle
# qui marche sur deux cas sur trois est pire qu'une liste.
JEUX = {
    "2023": "projet-de-loi-relatif-aux-resultats-de-la-gestion-et-portant-approbation"
    "-des-comptes-de-lannee-plrg-2023",
    "2024": "plrg-2024",
    "2025": "projet-de-loi-relatif-aux-resultats-de-la-gestion-et-portant-approbation"
    "-des-comptes-de-lannee-plrg-2025",
}

# Les identifiants de pièce jointe, eux, changent de forme d'un exercice à
# l'autre (`annexe1_etat_cp_2024_csv` contre `annexe1_etat_cp_2025csv`). Ils sont
# donc résolus par le catalogue, sur le nom de fichier, qui est stable.
ANNEXES = {
    "missions": "Annexe1-Etat_AE_CP-",
    "programmes": "Annexe1-Etat_CP-",
    "categories": "Annexe1-Etat_Titre_Cat-",
}

THEME = "budget_etat"

# Le libellé de la mission « Travail et emploi » devient « Travail, emploi et
# administration des ministères sociaux » en 2025. C'est la même mission : sans
# cet alias, sa série se couperait en deux à mi-parcours sans que rien ne le
# dise.
ALIAS = {
    "Travail et emploi": "Travail, emploi et administration des ministères sociaux",
}

# Mission telle que la source l'écrit -> (identifiant court, ce que la mission
# paie). La seconde entrée sert à composer les deux fiches publiques : elle doit
# tenir en dix-huit mots, les fiches étant plafonnées à cinquante.
MISSIONS = {
    "Action extérieure de l'État": (
        "action_exterieure",
        "la diplomatie, les contributions aux organisations internationales et le réseau consulaire",
    ),
    "Administration générale et territoriale de l'État": (
        "administration_generale",
        "les préfectures, l'organisation des élections et la délivrance des titres d'identité",
    ),
    "Agriculture, alimentation, forêt et affaires rurales": (
        "agriculture",
        "les aides agricoles nationales, la sécurité sanitaire des aliments et la forêt",
    ),
    "Aide publique au développement": (
        "aide_developpement",
        "l'aide de la France aux pays en développement, en dons et en prêts",
    ),
    "Anciens combattants, mémoire et liens avec la Nation": (
        "anciens_combattants",
        "les pensions militaires d'invalidité, la retraite du combattant et la politique de mémoire",
    ),
    "Cohésion des territoires": (
        "cohesion_territoires",
        "les aides au logement, l'hébergement d'urgence et la politique de la ville",
    ),
    "Conseil et contrôle de l'État": (
        "conseil_controle",
        "le Conseil d'État, la Cour des comptes et les juridictions administratives et financières",
    ),
    "Crédits non répartis": (
        "credits_non_repartis",
        "les crédits mis en réserve, qu'aucun ministère ne porte au moment du vote",
    ),
    "Culture": (
        "culture",
        "les monuments, les musées, le spectacle vivant et la création artistique",
    ),
    "Direction de l'action du Gouvernement": (
        "direction_gouvernement",
        "les services du Premier ministre, les autorités indépendantes et la coordination"
        " interministérielle",
    ),
    "Défense": (
        "defense",
        "les armées : équipement, préparation opérationnelle, dissuasion et soutien",
    ),
    "Engagements financiers de l'État": (
        "engagements_financiers",
        "les intérêts de la dette de l'État et ses appels en garantie",
    ),
    "Enseignement scolaire": (
        "enseignement_scolaire",
        "les écoles, collèges et lycées, publics et privés sous contrat",
    ),
    "Gestion des finances publiques": (
        "gestion_finances_publiques",
        "l'administration fiscale et douanière et la tenue des comptes publics",
    ),
    "Immigration, asile et intégration": (
        "immigration_asile",
        "l'accueil des demandeurs d'asile, l'éloignement et l'intégration des étrangers",
    ),
    "Investir pour la France de 2030": (
        "investir_france_2030",
        "les investissements d'avenir : recherche, innovation et transition industrielle",
    ),
    "Justice": (
        "justice",
        "les tribunaux, les prisons, la protection judiciaire de la jeunesse et l'aide"
        " juridictionnelle",
    ),
    "Médias, livre et industries culturelles": (
        "medias_livre",
        "l'audiovisuel public, la presse, le livre et les industries culturelles",
    ),
    "Outre-Mer": (
        "outre_mer",
        "l'emploi, le logement et les collectivités des départements et territoires d'outre-mer",
    ),
    "Plan de relance": (
        "plan_relance",
        "les derniers crédits du plan de relance de 2020, en extinction",
    ),
    "Pouvoirs publics": (
        "pouvoirs_publics",
        "la Présidence de la République, l'Assemblée nationale, le Sénat et le Conseil"
        " constitutionnel",
    ),
    "Recherche et enseignement supérieur": (
        "recherche_enseignement_superieur",
        "les universités, la vie étudiante et les organismes de recherche",
    ),
    "Relations avec les collectivités territoriales": (
        "relations_collectivites",
        "les dotations d'investissement et les concours particuliers versés aux collectivités",
    ),
    "Remboursements et dégrèvements": (
        "remboursements_degrevements",
        "les sommes rendues aux contribuables : trop-perçus, crédits d'impôt, remboursements de TVA",
    ),
    "Régimes sociaux et de retraite": (
        "regimes_sociaux_retraite",
        "les subventions d'équilibre aux régimes spéciaux de retraite, dont ceux de la SNCF"
        " et de la RATP",
    ),
    "Santé": (
        "sante",
        "l'aide médicale de l'État, la prévention et la sécurité sanitaire",
    ),
    "Solidarité, insertion et égalité des chances": (
        "solidarite_insertion",
        "la prime d'activité, l'allocation aux adultes handicapés et l'égalité entre femmes"
        " et hommes",
    ),
    "Sport, jeunesse et vie associative": (
        "sport_jeunesse",
        "le sport, le service national universel et le soutien à la vie associative",
    ),
    "Sécurités": (
        "securites",
        "la police, la gendarmerie, la sécurité civile et la sécurité routière",
    ),
    "Transformation et fonction publiques": (
        "transformation_fonction_publiques",
        "la modernisation de l'administration, l'action sociale interministérielle et la"
        " formation des agents",
    ),
    "Travail, emploi et administration des ministères sociaux": (
        "travail_emploi",
        "l'apprentissage, la formation professionnelle, France Travail et les contrats aidés",
    ),
    "Écologie, développement et mobilité durables": (
        "ecologie_mobilite",
        "les transports, l'énergie, la rénovation des logements et la prévention des risques",
    ),
    "Économie": (
        "economie",
        "le soutien aux entreprises, la concurrence, la consommation et le commerce extérieur",
    ),
}

TECHNIQUE = (
    "Exécution du budget général de l'État par mission, en **crédits de"
    " paiement**, cadre de la comptabilité **budgétaire** — ni la comptabilité"
    " générale de l'État, ni la comptabilité nationale, dont les périmètres et"
    " les dates de rattachement diffèrent. Source : annexes 1 du projet de loi"
    " relatif aux résultats de la gestion (PLRG), DGFiP, exercices 2024 et 2025,"
    " en euros courants. Le « voté » est le montant inscrit en loi de finances"
    " initiale ; le « consommé » est ce qui a été payé. **Les deux ne se"
    " soustraient pas en un dépassement** : entre le vote et le paiement"
    " s'ajoutent les lois de finances rectificatives, les reports de l'exercice"
    " précédent, les mouvements réglementaires et les fonds de concours, qui"
    " forment les crédits ouverts — 591,45 Md€ en 2025 pour 582,40 Md€ votés."
    " Les montants sont **bruts** : la mission « Remboursements et dégrèvements »"
    " (141,36 Md€ consommés en 2025) rend aux contribuables ce qu'ils ont trop"
    " payé, si bien que la somme des 33 missions, 578,04 Md€, vaut 436,67 Md€"
    " nette de ces remboursements. Cette somme n'est pas la dépense nette du"
    " budget général publiée par ailleurs sur ce site, qui vient d'une autre"
    " source et d'un autre périmètre : les deux ne se substituent pas. Les"
    " autorisations d'engagement ne sont pas publiées, un engagement n'étant pas"
    " un paiement. Les comptes spéciaux, portés par l'annexe 2, sont hors"
    " périmètre. Chaque exercice est vérifié par un contrôle bloquant : ses trois"
    " annexes — 33 missions, 177 lignes de programme, 855 lignes de catégorie —"
    " doivent se refermer au centime, mission par mission."
)

# `revisions.remplacer` attend : cinq clés, puis ces colonnes-là.
COLONNES = ("value",)

# Un montant écrit `1,44146E+11` ne porte plus que six chiffres significatifs :
# la source a perdu, à l'export, jusqu'à 10⁵ € sur la cellule. Un exercice qui en
# contient une seule est écarté — c'est le défaut de 2023.
NOTATION_SCIENTIFIQUE = re.compile(r"\d[eE][+-]?\d")

# Le libellé de programme porte son numéro collé : « Action de la France en
# Europe et dans le monde - 105 ». Le prendre pour un nom ferait deux programmes
# d'un seul dès que la source renumérote.
NUMERO_PROGRAMME = re.compile(r"^(?P<libelle>.+?)\s+-\s+(?P<numero>\d+)$")

# Les deux annexes ne découpent pas les titres pareil : l'annexe des programmes
# ne distingue que « Titre 2 — dépenses de personnel » et « Autres titres »,
# celle des catégories numérote les sept titres. Leur seul point commun est le
# titre 2, et c'est justement ce qui en fait un contrôle.
TITRE_PERSONNEL = "Titre 2"


class MissionsDivergentes(RuntimeError):
    """Les trois ventilations du même exercice ne tombent pas au centime."""


def url_catalogue(jeu: str) -> str:
    return f"{BASE}/{jeu}/attachments"


def url_piece_jointe(jeu: str, identifiant: str) -> str:
    return f"{BASE}/{jeu}/attachments/{identifiant}"


def piece_jointe(catalogue: dict, prefixe: str) -> tuple[str, str]:
    """-> (identifiant, nom de fichier) de l'annexe dont le nom commence ainsi.

    Les vingt-sept pièces jointes d'un exercice portent des identifiants dont la
    forme change d'une année à l'autre ; leurs noms de fichier, non.
    """
    trouvees = [
        (piece["metas"]["id"], piece["metas"]["title"])
        for piece in catalogue.get("attachments", [])
        if piece["metas"]["title"].startswith(prefixe)
    ]
    if len(trouvees) != 1:
        raise ValueError(
            f"{len(trouvees)} pièce(s) jointe(s) nommée(s) « {prefixe}… » au lieu"
            " d'une seule : le catalogue de la source a changé."
        )
    return trouvees[0]


def lire(contenu: bytes) -> list[dict]:
    """Les rangs de l'annexe, cellules telles que la source les écrit.

    Rien n'est converti ici : c'est le texte brut qui dit si la source a gardé
    ses centimes, et cette information disparaîtrait à la conversion.
    """
    return list(csv.DictReader(io.StringIO(contenu.decode("utf-8-sig")), delimiter=";"))


def montant(texte: str | None) -> float | None:
    """-> le montant, ou None quand la source écrit qu'il n'y en a pas.

    Trois conventions cohabitent : la cellule vide, le zéro, et le tiret entouré
    d'espaces (`"   -   "`). Un `float()` naïf meurt sur le troisième, et un
    `or 0` y inventerait un montant nul là où la source dit « rien à déclarer ».
    """
    brut = (texte or "").replace("\u00a0", "").replace("\u202f", "").strip()
    if not brut or set(brut) <= {"-", " "}:
        return None
    return float(brut.replace(" ", "").replace(",", "."))


def decouper_programme(libelle: str) -> tuple[str, str]:
    """« Action de la France en Europe et dans le monde - 105 » -> (« … », « 105 »)."""
    trouve = NUMERO_PROGRAMME.match(libelle.strip())
    if not trouve:
        return libelle.strip(), ""
    return trouve.group("libelle"), trouve.group("numero")


def cellules_degradees(rangs: list[dict]) -> int:
    """Combien de cellules la source a écrites en notation scientifique."""
    return sum(
        1
        for rang in rangs
        for valeur in rang.values()
        # `csv.DictReader` range les colonnes en trop dans une liste : une ligne
        # mal formée ne doit pas faire tomber le comptage avant le contrôle.
        if isinstance(valeur, str) and NOTATION_SCIENTIFIQUE.search(valeur)
    )


def _cumuler(rangs: list[dict], colonne: str, filtre=None) -> dict[str, float]:
    """{mission: somme de la colonne}, à l'euro près de ce que la source écrit."""
    totaux: dict[str, float] = defaultdict(float)
    for rang in rangs:
        if filtre and not filtre(rang):
            continue
        mission = (rang.get("Mission") or "").strip()
        totaux[mission] += montant(rang.get(colonne)) or 0.0
    return dict(totaux)


def agreger(annexes: dict[str, list[dict]]) -> dict[str, dict[str, float]]:
    """-> {mission: {votes, ouverts, consommes, personnel}} pour un exercice.

    Le voté vient de la colonne `LFI` de l'annexe des programmes : c'est le seul
    endroit où la loi de finances initiale est ventilée par mission. Le consommé
    vient de la même annexe, pour que les deux montants partagent la ligne — les
    comparer entre deux fichiers y ajouterait un écart qui ne serait pas le leur.
    """
    programmes = annexes["programmes"]
    votes = _cumuler(programmes, "LFI")
    ouverts = _cumuler(programmes, "Total_CP_Ouverts")
    consommes = _cumuler(programmes, "Depenses_constatees")
    personnel = _cumuler(
        programmes,
        "Depenses_constatees",
        lambda rang: (rang.get("Titre") or "").startswith(TITRE_PERSONNEL),
    )
    return {
        mission: {
            "votes": votes.get(mission, 0.0),
            "ouverts": ouverts.get(mission, 0.0),
            "consommes": consommes.get(mission, 0.0),
            "personnel": personnel.get(mission, 0.0),
        }
        for mission in sorted(consommes)
    }


def _ecarts(gauche: dict[str, float], droite: dict[str, float]) -> dict[str, float]:
    """Les missions dont les deux ventilations ne tombent pas au centime."""
    return {
        mission: round(gauche.get(mission, 0.0) - droite.get(mission, 0.0), 2)
        for mission in set(gauche) | set(droite)
        if round(gauche.get(mission, 0.0) - droite.get(mission, 0.0), 2) != 0
    }


def apparier_programmes(annexes: dict[str, list[dict]]) -> dict[str, int]:
    """Les deux annexes détaillées décrivent-elles les mêmes programmes ?

    Le numéro du programme est collé à son libellé (« Action de la France en
    Europe et dans le monde - 105 ») : il est découpé, jamais pris pour un nom,
    faute de quoi un programme renommé en cours de série en ferait deux. Sur les
    trois exercices sondés, l'annexe des catégories couvre tous les programmes de
    l'annexe des crédits sauf quatre, qui n'ont **rien consommé** — un programme
    absent qui aurait consommé quelque chose signalerait, lui, une lecture fausse.
    """
    def cles(rangs: list[dict]) -> set[tuple[str, str]]:
        return {
            (
                (rang.get("Mission") or "").strip(),
                decouper_programme(rang.get("Programme") or "")[1],
            )
            for rang in rangs
        }

    credits, categories = cles(annexes["programmes"]), cles(annexes["categories"])
    sans_numero = sorted(mission for mission, numero in credits | categories if not numero)
    if sans_numero:
        raise MissionsDivergentes(
            f"{len(sans_numero)} programme(s) sans numéro dans leur libellé, par"
            f" exemple pour la mission « {sans_numero[0]} » : la source a changé"
            " de nomenclature."
        )
    orphelins = sorted(categories - credits)
    if orphelins:
        raise MissionsDivergentes(
            f"{len(orphelins)} programme(s) présents dans l'annexe des catégories"
            f" et absents de celle des crédits, par exemple {orphelins[0]}."
        )
    consommes: dict[tuple[str, str], float] = defaultdict(float)
    for rang in annexes["programmes"]:
        cle = (
            (rang.get("Mission") or "").strip(),
            decouper_programme(rang.get("Programme") or "")[1],
        )
        consommes[cle] += montant(rang.get("Depenses_constatees")) or 0.0
    depensiers = sorted(
        cle for cle in credits - categories if round(consommes[cle], 2) != 0
    )
    if depensiers:
        raise MissionsDivergentes(
            f"{len(depensiers)} programme(s) absents de l'annexe des catégories"
            f" alors qu'ils ont consommé des crédits, par exemple {depensiers[0]}"
            f" à {consommes[depensiers[0]]:,.2f} €."
        )
    return {
        "programmes": len(credits),
        "programmes_sans_categorie_et_sans_depense": len(credits - categories),
    }


def controler(exercice: str, annexes: dict[str, list[dict]]) -> dict:
    """Le même exercice, ventilé trois fois : les trois doivent tomber au centime.

    Les trois annexes ont trois cardinalités — 33 missions, 177 lignes de
    programme, 855 lignes de catégorie — et sont produites séparément. Une
    colonne mal choisie, un séparateur décimal mal lu, une ligne écartée par
    erreur : aucune de ces fautes ne laisse les trois totaux égaux. Quatre
    comparaisons, mission par mission : les crédits consommés contre chacune des
    deux annexes détaillées, les crédits ouverts, et les dépenses de personnel —
    seul titre que les deux annexes découpent pareil, l'une ne distinguant que
    « Titre 2 » et « Autres titres » là où l'autre numérote les sept titres.
    """
    missions = {
        (rang.get("Mission") or "").strip(): rang for rang in annexes["missions"]
    }
    if not missions or not annexes["programmes"] or not annexes["categories"]:
        raise MissionsDivergentes(f"exercice {exercice} : une annexe est vide")

    consommes_missions = {
        mission: montant(rang.get("CP_Consommes")) or 0.0
        for mission, rang in missions.items()
    }
    ouverts_missions = {
        mission: montant(rang.get("CP_Ouverts")) or 0.0 for mission, rang in missions.items()
    }
    agregats = agreger(annexes)
    consommes_categories = _cumuler(annexes["categories"], "Depenses")
    personnel_categories = _cumuler(
        annexes["categories"],
        "Depenses",
        lambda rang: (rang.get("Titre") or "").strip() == TITRE_PERSONNEL,
    )

    controles = (
        (
            "crédits consommés, annexe des missions contre annexe des programmes",
            consommes_missions,
            {mission: valeurs["consommes"] for mission, valeurs in agregats.items()},
        ),
        (
            "crédits consommés, annexe des missions contre annexe des catégories",
            consommes_missions,
            consommes_categories,
        ),
        (
            "crédits ouverts, annexe des missions contre annexe des programmes",
            ouverts_missions,
            {mission: valeurs["ouverts"] for mission, valeurs in agregats.items()},
        ),
        (
            "dépenses de personnel, annexe des programmes contre annexe des catégories",
            {mission: valeurs["personnel"] for mission, valeurs in agregats.items()},
            personnel_categories,
        ),
    )
    # L'écart maximal est mesuré et tracé, y compris quand il est nul : un
    # contrôle qui ne peut qu'être vrai ne dit rien de la qualité de la source.
    # Il est arrondi au centime comme la comparaison elle-même : cumuler 855
    # flottants laisse un résidu de l'ordre de 10⁻⁵ €, qui est notre arithmétique
    # binaire et non un écart du producteur.
    ecart_maximal = 0.0
    for intitule, gauche, droite in controles:
        ecart_maximal = max(
            ecart_maximal,
            max(
                abs(gauche.get(mission, 0.0) - droite.get(mission, 0.0))
                for mission in set(gauche) | set(droite)
            ),
        )
        ecarts = _ecarts(gauche, droite)
        if ecarts:
            mission, ecart = next(iter(sorted(ecarts.items())))
            raise MissionsDivergentes(
                f"exercice {exercice}, {intitule} : {len(ecarts)} mission(s)"
                f" divergent(s), par exemple « {mission} » à {ecart:+,.2f} €."
                " Les trois annexes du même producteur ne décrivent plus le même"
                " exercice."
            )

    programmes = apparier_programmes(annexes)
    inconnues = sorted(set(consommes_missions) - set(MISSIONS) - set(ALIAS))
    if inconnues:
        raise MissionsDivergentes(
            f"exercice {exercice} : mission(s) que ce connecteur ne connaît pas —"
            f" {', '.join(inconnues)}. Publier une mission sans fiche la"
            " laisserait sans définition, et l'écarter en silence amputerait le"
            " total sans que rien ne le dise."
        )
    total = round(sum(consommes_missions.values()), 2)
    remboursements = consommes_missions.get("Remboursements et dégrèvements", 0.0)
    return {
        "missions_verifiees": len(consommes_missions),
        "lignes_programme": len(annexes["programmes"]),
        "lignes_categorie": len(annexes["categories"]),
        **programmes,
        "ecart_maximal_euros": round(ecart_maximal, 2),
        "credits_votes": round(sum(v["votes"] for v in agregats.values()), 2),
        "credits_ouverts": round(sum(ouverts_missions.values()), 2),
        "credits_consommes_bruts": total,
        "remboursements_et_degrevements": round(remboursements, 2),
        "credits_consommes_nets": round(total - remboursements, 2),
    }


def trier(lus: dict[str, dict[str, list[dict]]]) -> tuple[dict, dict]:
    """-> (exercices retenus, exercices écartés pour précision perdue).

    La règle est mécanique et se relit sur le fichier : un exercice dont une
    cellule est écrite en notation scientifique a perdu des chiffres à l'export,
    et aucun contrôle au centime ne peut plus rien en dire.
    """
    retenus, ecartes = {}, {}
    for exercice, annexes in sorted(lus.items()):
        degradees = {nom: cellules_degradees(rangs) for nom, rangs in annexes.items()}
        if sum(degradees.values()):
            ecartes[exercice] = {
                "cellules_en_notation_scientifique": {
                    nom: nombre for nom, nombre in sorted(degradees.items()) if nombre
                }
            }
        else:
            retenus[exercice] = annexes
    return retenus, ecartes


def identifiants(slug: str) -> tuple[str, str]:
    """-> (indicateur du voté, indicateur du consommé) pour une mission."""
    return f"etat_mission_{slug}_credits_votes", f"etat_mission_{slug}_credits_consommes"


def indicateurs() -> list[str]:
    return sorted(
        identifiant
        for slug, _ in MISSIONS.values()
        for identifiant in identifiants(slug)
    )


def fiches(mission: str) -> list[tuple[str, str, str]]:
    """-> [(identifiant, libellé publié, fiche publique)] pour une mission.

    Les deux fiches sont composées plutôt que recopiées soixante-six fois : ce
    qui les distingue tient en une phrase, et la répéter à la main les ferait
    diverger au premier ajout de mission.
    """
    slug, objet = MISSIONS[mission]
    vote, consomme = identifiants(slug)
    return [
        (
            vote,
            f"{mission} (crédits votés)",
            f"Ce que la loi de finances initiale a prévu pour {objet}. C'est une"
            " décision, pas une dépense : les reports et les mouvements de l'année"
            " s'y ajoutent, et tout n'est pas consommé.",
        ),
        (
            consomme,
            f"{mission} (crédits consommés)",
            f"Ce que l'État a réellement payé en un an pour {objet}. Montant brut :"
            " les remboursements d'impôts n'en sont pas déduits, ils forment une"
            " mission à part.",
        ),
    ]


def lignes_a_ecrire(retenus: dict[str, dict[str, list[dict]]]) -> list[tuple]:
    """-> les observations nationales : deux par mission et par exercice.

    Le choix d'écrire dans `core.observations` plutôt que dans
    `fin.public_budget_lines` n'est pas de convenance. `plateforme.normalize.etat`
    reconstruit le budget de l'État par un `delete from fin.public_budgets where
    entity_kind = 'etat'` ; des lignes de mission écrites là seraient effacées à
    son prochain passage, et — la clé étrangère de `fin.public_budget_lines`
    interdisant de supprimer un budget encore référencé — elles feraient d'abord
    **échouer** ce connecteur-là. Deux connecteurs ne peuvent pas se partager une
    table que l'un reconstruit en entier. Les observations, elles, sont
    remplacées indicateur par indicateur (`revisions.remplacer`), ce qui donne à
    ce module un périmètre qui lui appartient, et l'archive des révisions par
    surcroît. La page « budget de l'État » du site ne lit que les budgets de type
    LFI et LFR : elle est donc inchangée, comme elle l'est déjà des dépenses
    fiscales, qui écrivent sous le type PLF.
    """
    lignes = []
    for exercice, annexes in sorted(retenus.items()):
        for mission, valeurs in sorted(agreger(annexes).items()):
            slug, _ = MISSIONS[ALIAS.get(mission, mission)]
            vote, consomme = identifiants(slug)
            lignes.append((vote, "pays", "FR", MILLESIME, exercice, valeurs["votes"]))
            lignes.append(
                (consomme, "pays", "FR", MILLESIME, exercice, valeurs["consommes"])
            )
    return lignes


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for mission in sorted(MISSIONS):
            for identifiant, libelle, publique in fiches(mission):
                definition = curseur.execute(
                    """
                    insert into core.indicator_definitions
                        (public_definition, technical_definition, formula, unit_notes,
                         confidence_level, badges)
                    values (?, ?, 'Annexes 1 du projet de loi relatif aux résultats de'
                            ' la gestion (PLRG), crédits de paiement par mission',
                            'euros courants', 'observed',
                            array['Officiel','Donnée brute'])
                    returning definition_id
                    """,
                    (publique, TECHNIQUE),
                ).fetchone()[0]
                curseur.execute(
                    """
                    insert into core.indicators
                        (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                         additive, price_basis, accounting_frame, geo_levels,
                         time_granularity, published)
                    values (?, ?, ?, ?, ?, 'EUR', false, 'current', 'budgetaire',
                            array['pays'], 'annuelle', true)
                    on conflict (indicator_id) do update set unit = excluded.unit,
                        definition_id = excluded.definition_id,
                        label_fr = excluded.label_fr, theme = excluded.theme,
                        accounting_frame = excluded.accounting_frame, published = true
                    """,
                    (identifiant, DATASET, definition, THEME, libelle),
                )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def collecter(conn, store, run_id: str) -> dict[str, dict[str, list[dict]]]:
    """Les trois annexes de chaque exercice, archivées avant lecture."""
    lus: dict[str, dict[str, list[dict]]] = {}
    for exercice, jeu in sorted(JEUX.items()):
        catalogue = json.loads(telecharger(url_catalogue(jeu), timeout=120))
        for annexe, prefixe in ANNEXES.items():
            identifiant, fichier = piece_jointe(catalogue, prefixe)
            adresse = url_piece_jointe(jeu, identifiant)
            contenu = telecharger(adresse, timeout=300)
            entrepot.record_asset(
                conn, store, run_id, DATASET, SOURCE, fichier, contenu, adresse, "text/csv"
            )
            lus.setdefault(exercice, {})[annexe] = lire(contenu)
        entrepot.etape(
            f"{exercice} : "
            + ", ".join(f"{len(lus[exercice][a])} lignes {a}" for a in sorted(ANNEXES))
        )
    return lus


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        garde_fou_volume(conn)
        lus = collecter(conn, store, run_id)
        retenus, ecartes = trier(lus)
        if not retenus:
            raise MissionsDivergentes(
                "aucun exercice exploitable : toutes les annexes ont perdu des"
                " chiffres à l'export."
            )
        verifies = {
            exercice: controler(exercice, annexes) for exercice, annexes in retenus.items()
        }
        ecrites, revisees = revisions.remplacer(
            conn, run_id, indicateurs(), COLONNES, lignes_a_ecrire(retenus)
        )
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'les_trois_annexes_se_referment_au_centime', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps(verifies)),
        )
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'exercices_ecartes_pour_precision_perdue', 'warning', ?, ?)
            """,
            (run_id, DATASET, not ecartes, json.dumps(ecartes)),
        )
        conn.commit()
        entrepot.finish_run(
            conn, run_id, "success",
            rows_read=sum(len(r) for a in lus.values() for r in a.values()),
            rows_written=ecrites,
        )
        dernier = max(verifies)
        resume = verifies[dernier]
        print(
            f"exécution par mission : {ecrites} observations sur"
            f" {len(retenus)} exercice(s) ({', '.join(sorted(retenus))}),"
            f" {resume['missions_verifiees']} missions vérifiées au centime en"
            f" {dernier} sur trois annexes, {revisees} valeurs révisées ;"
            f" {resume['credits_votes'] / 1e9:.2f} Md€ votés,"
            f" {resume['credits_consommes_bruts'] / 1e9:.2f} Md€ consommés bruts,"
            f" {resume['credits_consommes_nets'] / 1e9:.2f} Md€ nets des"
            " remboursements et dégrèvements"
        )
        for exercice, motif in sorted(ecartes.items()):
            print(
                f"exercice {exercice} écarté : {motif} — des montants en notation"
                " scientifique ont perdu leurs chiffres à l'export, aucun contrôle"
                " au centime n'est possible"
            )
        return 0
    except Exception as error:  # noqa: BLE001 — tout échec finit tracé dans le lineage
        entrepot.finish_run(conn, run_id, "failed", error=str(error))
        raise
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--store", default=".snapshots")
    return run(parser.parse_args().store)


if __name__ == "__main__":
    raise SystemExit(main())
