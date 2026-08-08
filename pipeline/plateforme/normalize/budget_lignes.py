"""Le budget de l'État ligne à ligne : sa nomenclature par destination.

Le site publiait le budget de l'État par grandes masses — du personnel, de la
dette, des recettes — et son exécution par mission. Il ne descendait jamais
au-dessous. Or c'est en dessous que se prennent les décisions : une mission de
soixante milliards ne se règle pas, une sous-action de soixante-seize millions
si. Ce module charge la nomenclature entière du projet de loi de finances, des
trente-quatre missions aux deux cent quatre-vingt-trois sous-actions, et les
cent cinquante-six lignes de recettes qui leur font face.

**Ce qui est chargé, et ce qui ne l'est pas.** Le périmètre est le **budget
général** : ni les budgets annexes, ni les comptes d'affectation spéciale, ni
les comptes de concours financiers, que la source livre dans le même fichier et
qui porteraient le total de 594,0 à 823,0 Md€ en 2025. La mesure est le **crédit
de paiement**, ce que l'État prévoit de payer dans l'année ; les autorisations
d'engagement (618,6 Md€ en 2025) ne sont pas publiées, un engagement n'étant pas
un paiement — elles servent ici de témoin, parce qu'une colonne prise pour
l'autre se voit à l'euro près sur une sous-action d'équipement militaire.

**Deux exercices, pas trois.** Le catalogue porte bien une nomenclature par
destination pour 2023 (jeu `credits-ae-et-cp-votes-…-lfi-2023`, dont les
colonnes `cp_*_plf_2023` donnent 560,2 Md€), mais **aucune annexe de recettes du
budget général** avant 2024. Publier 2023 donnerait un exercice où le simulateur
afficherait des dépenses sans rien en face et un solde égal à leur opposé : un
budget amputé de sa moitié n'est pas un budget. L'exercice s'arrête donc là où
la source s'arrête, et le refus est écrit ici plutôt que deviné. (Les colonnes
`*_lfi_2023` du même jeu, elles, valent toutes 4,0 : cet export est cassé, ce
qui est une seconde raison de ne pas s'y fier.)

**Le PLF n'est pas la loi.** Ces montants sont ceux d'un *projet* déposé à
l'automne : le Parlement les amende, et l'exécution s'en écarte encore. Ils ne
se comparent donc ni aux crédits votés ni aux crédits consommés publiés par
ailleurs sur ce site, qui viennent d'autres sources et d'autres moments.

**Aucun indicateur déclaré, et c'est un choix.** Ce module n'écrit ni dans
`core.indicators` ni dans `core.observations`, et n'a donc pas de `declarer()`.
Déclarer les mille soixante-douze nœuds d'un exercice noierait le catalogue ;
n'en déclarer que les totaux mettrait à côté des dépenses de l'État *exécutées*
un chiffre de *projet de loi*, sous le même thème et dans la même unité, que
rien n'empêcherait de comparer à tort. La nomenclature est publiée comme ce
qu'elle est : une matière pour un outil, pas une série. Elle vit dans
`fin.state_budget_detail`, qui n'appartient qu'à elle — voir le commentaire de
la table pour les trois raisons de ne pas l'avoir logée dans
`fin.public_budget_lines`.

**Deux prises de contrôle, indépendantes l'une de l'autre.** La première est
interne : la somme des crédits par mission, celle par programme, celle par
action, celle des feuilles de l'arbre construit et celle des trente-quatre
montants publiés doivent toutes retomber sur le total lu ligne à ligne, à
l'euro. Cinq sommes calculées séparément sur la même matière ; une colonne mal
lue, une ligne perdue au filtrage, un nœud rattaché au mauvais parent en casse
au moins une. La seconde est externe : huit cellules
relevées à la main sur le portail le 8 août 2026, quatre par exercice, dont deux
recettes et deux couples (autorisation d'engagement, crédit de paiement) qui
diffèrent d'un facteur trente-sept — aucune erreur de colonne ne survit à ça.

Usage : python -m plateforme.normalize.budget_lignes [--store r2:plateforme-raw]
"""

import argparse
import json
import re
from collections import defaultdict
from dataclasses import dataclass, field

from plateforme import entrepot
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import make_store

DATASET = "plf-budget-lignes"
SOURCE = "data-economie"
BASE = "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets"

LOI = "PLF"
# Le nom de la colonne de la source, gardé tel quel : c'est lui qui dit quelle
# grandeur est publiée, et il voyage jusque dans le fichier du site.
MESURE_DEPENSES = "credit_de_paiement"
MESURE_RECETTES = "montant_recettes_plf"

# Les identifiants de jeu ne suivent aucune règle d'un exercice à l'autre
# (`plf25-…` contre `plf-2024-…`) : ils sont écrits, pas devinés. Le second
# élément nomme la forme du fichier, qui change elle aussi — voir `LECTEURS`.
JEUX = {
    "2024": (
        "plf-2024-depenses-2024-selon-nomenclatures-destination-et-nature",
        "relatif",
        "plf-2024-recettes-du-budget-general",
    ),
    "2025": (
        "plf25-depenses-2025-selon-destination",
        "absolu",
        "plf25-recettes-du-budget-general",
    ),
}

# Le budget général, et lui seul. Les deux fichiers nomment la colonne
# différemment, mais la valeur est la même.
BUDGET_GENERAL = "BG"

# Les quatre familles de recettes, et leur signe. Les deux prélèvements sur
# recettes **se déduisent** : ce que l'État reverse aux collectivités et à
# l'Union européenne ne lui reste pas. Les additionner aux deux autres familles
# donnerait 588,4 Md€ de recettes en 2025 au lieu de 453,4 Md€, et un budget en
# quasi-équilibre qui n'a jamais existé. Une famille inconnue arrête le
# chargement : signée +1 par défaut, elle inventerait ce solde-là.
FAMILLES = {
    "Recettes fiscales": ("RF", 1),
    "Recettes non fiscales": ("RNF", 1),
    "Prélèvements sur les recettes de l'État au profit des collectivités territoriales": (
        "PSR-CT",
        -1,
    ),
    "Prélèvement sur les recettes de l'État au profit de l'Union européenne": (
        "PSR-UE",
        -1,
    ),
}

# Témoins relevés à la main sur data.economie.gouv.fr le 8 août 2026. Chacun est
# une **cellule** de la source, au croisement (sous-action, titre, catégorie) :
# la sous-action 146-09-63 en porte trois, et sa somme vaut 271 761 140 € en
# 2025. Comparer la cellule plutôt que la somme est ce qui rend le témoin
# indépendant de l'agrégation de ce module.
#
# Les deux colonnes sont relevées ensemble parce qu'elles ne se ressemblent pas :
# 2 869 662 536 € engagés pour 76 413 283 € payés sur la même ligne de
# porte-avions. Une lecture qui prendrait l'une pour l'autre passerait tous les
# contrôles de totaux — l'écart global n'est que de 4 % — et se casse ici.
# (sous-action, titre, catégorie) -> (autorisation d'engagement, crédit de paiement)
TEMOINS_DEPENSES = {
    "2024": {
        ("146-09-63", "5", "51"): (496_940_389.0, 67_259_030.0),
        ("103-01-02", "6", "62"): (3_905_951_502.0, 3_530_118_760.0),
    },
    "2025": {
        ("146-09-63", "5", "51"): (2_869_662_536.0, 76_413_283.0),
        ("103-01-02", "6", "62"): (3_243_144_901.0, 3_464_537_422.0),
    },
}

# Deux lignes de recettes par exercice, dont une de chaque signe : la 1705 est
# une recette fiscale ordinaire, la 3101 (dotation globale de fonctionnement)
# est un prélèvement qui se déduit. Relevées le 8 août 2026.
TEMOINS_RECETTES = {
    "2024": {"1705": 3_936_000_000.0, "3101": 27_145_046_362.0},
    "2025": {"1705": 4_133_191_843.0, "3101": 27_244_686_833.0},
}

# Variations mesurées du total des crédits de paiement du budget général d'un
# PLF au suivant, relevées le 8 août 2026 :
#     PLF 2023 -> PLF 2024 : 560,220 -> 581,088 Md€, soit +3,72 %
#     PLF 2024 -> PLF 2025 : 581,088 -> 594,036 Md€, soit +2,23 %
# et, côté recettes nettes des prélèvements, le seul écart disponible :
#     PLF 2024 -> PLF 2025 : 441,565 -> 453,388 Md€, soit +2,68 %
# Le seuil est le double de la plus forte de ces trois variations (3,72 %),
# arrondi au demi-point au-dessus. Il laisse passer un exercice réellement
# heurté — le plan de relance de 2021 en fut un — et arrête les fautes qui
# déplacent le total d'un ordre de grandeur : le périmètre entier au lieu du
# budget général (+38,5 % en 2025), un exercice à demi chargé, une unité changée.
# Il n'arrêterait pas une confusion AE/CP (+4,1 % en 2025) : c'est le travail des
# témoins, et c'est pourquoi il en faut deux sortes.
VARIATION_MAXIMALE = 0.075

# Les tirets cadratin et demi-cadratin des intitulés officiels. Les trois que la
# source porte introduisent tous une précision — « Assurer la mobilité –
# Hélicoptères de manœuvre » — et deviennent donc un deux-points. Le trait
# d'union ordinaire, lui, n'est pas visé : il sépare deux mots, il ne ponctue pas.
CADRATINS = re.compile(r"\s*[–—]\s*")


class BudgetIncoherent(RuntimeError):
    """Un contrôle bloquant a refusé l'exercice."""


@dataclass
class Poste:
    """Une ligne de la source, ramenée à la forme commune aux deux exercices."""

    mission: str
    libelle_mission: str
    programme: str
    libelle_programme: str
    action: str
    libelle_action: str
    sous_action: str | None
    libelle_sous_action: str | None
    montant: float


@dataclass
class Noeud:
    """Un nœud de la nomenclature. Sans enfant, c'est une feuille."""

    code: str
    libelle: str
    niveau: str
    montant: float = 0.0
    enfants: list["Noeud"] = field(default_factory=list)

    def total(self) -> float:
        return sum(e.total() for e in self.enfants) if self.enfants else self.montant


def net(texte: str | None) -> str:
    """L'intitulé tel qu'il sera publié : sans cadratin, sans espaces doubles.

    La source écrit « Personnel travaillant  pour le programme » avec deux
    espaces et des insécables : les laisser passer ferait deux libellés là où il
    n'y a qu'une ligne dès que la source corrige sa frappe.
    """
    return " ".join(CADRATINS.sub(" : ", texte or "").split())


def _texte(valeur) -> str:
    """Un code de la source, en texte. L'export JSON rend `224.0` là où l'autre
    rend `"224"` : sans cette conversion, le même programme porterait deux
    codes selon l'exercice, et sa série se couperait en deux."""
    if valeur is None:
        return ""
    if isinstance(valeur, float) and valeur.is_integer():
        return str(int(valeur))
    return str(valeur).strip()


def lire(contenu: bytes) -> list[dict]:
    """Les rangs de l'export, tels que la source les écrit."""
    return json.loads(contenu)


def postes_absolus(rangs: list[dict]) -> list[Poste]:
    """PLF 2025 : les codes d'action et de sous-action sont déjà hiérarchiques.

    `action` vaut « 103-01 » et `sous_action` « 103-01-02 » : rien à composer.
    Le contrôle qu'un code descende bien de son parent est fait plus loin, pour
    les deux exercices à la fois — c'est `controler_arborescence`.
    """
    postes = []
    for rang in rangs:
        if rang.get("typebudget") != BUDGET_GENERAL:
            continue
        postes.append(
            Poste(
                mission=_texte(rang["mission"]),
                libelle_mission=net(rang["libelle_mission"]),
                programme=_texte(rang["programme"]),
                libelle_programme=net(rang["libelle_programme"]),
                action=_texte(rang["action"]),
                libelle_action=net(rang["libelle_action"]),
                sous_action=_texte(rang["sous_action"]) or None,
                libelle_sous_action=net(rang["libelle_sous_action"]) or None,
                montant=float(rang["credit_de_paiement"] or 0.0),
            )
        )
    return postes


def postes_relatifs(rangs: list[dict]) -> list[Poste]:
    """PLF 2024 : l'action vaut « 07 », la sous-action « 85 », toutes deux
    relatives à leur parent. Les codes sont composés ici, dans la forme du
    PLF 2025 (« 224-07-85 »), pour que les deux exercices se lisent pareil et
    qu'un lien partagé sur une action reste ouvrable d'un exercice à l'autre."""
    postes = []
    for rang in rangs:
        if rang.get("type_mission") != BUDGET_GENERAL:
            continue
        programme = _texte(rang["programme"])
        action = f"{programme}-{_texte(rang['action'])}"
        sous_action = _texte(rang["sous_action"])
        postes.append(
            Poste(
                mission=_texte(rang["code_mission"]),
                libelle_mission=net(rang["mission"]),
                programme=programme,
                libelle_programme=net(rang["libelle_programme"]),
                action=action,
                libelle_action=net(rang["libelle_action"]),
                sous_action=f"{action}-{sous_action}" if sous_action else None,
                libelle_sous_action=net(rang["libelle_sousaction"]) or None,
                montant=float(rang["cp_plf"] or 0.0),
            )
        )
    return postes


LECTEURS = {"absolu": postes_absolus, "relatif": postes_relatifs}


def controler_arborescence(exercice: str, postes: list[Poste]) -> dict:
    """La nomenclature est-elle encore un arbre, et ses codes en portent-ils la trace ?

    Trois propriétés, qu'aucune ne se déduit des autres et que la construction de
    l'arbre suppose sans jamais les vérifier :

    - **un code, un parent.** L'arbre est indexé par code ; un programme qui
      apparaîtrait sous deux missions serait rattaché à la première et emporterait
      les crédits de la seconde avec lui, sans qu'aucun total ne bouge.
    - **un code, un libellé.** Deux intitulés pour un même code, et le nœud
      publié porterait celui du premier rang lu, c'est-à-dire le hasard de l'ordre
      de l'export.
    - **un code descend du code de son parent.** C'est ce qui fait qu'une action
      « 103-01 » se relit sans son programme, et que les liens partagés d'un
      exercice à l'autre désignent la même ligne. Le jour où la source renumérote,
      il vaut mieux s'arrêter que publier une hiérarchie qui n'en est plus une.
    """
    parents: dict[str, set[str]] = defaultdict(set)
    libelles: dict[str, set[str]] = defaultdict(set)
    for poste in postes:
        parents[poste.programme].add(poste.mission)
        parents[poste.action].add(poste.programme)
        libelles[poste.mission].add(poste.libelle_mission)
        libelles[poste.programme].add(poste.libelle_programme)
        libelles[poste.action].add(poste.libelle_action)
        if poste.sous_action:
            parents[poste.sous_action].add(poste.action)
            libelles[poste.sous_action].add(poste.libelle_sous_action)
        if not poste.action.startswith(f"{poste.programme}-") or (
            poste.sous_action and not poste.sous_action.startswith(f"{poste.action}-")
        ):
            raise BudgetIncoherent(
                f"exercice {exercice} : le code « {poste.sous_action or poste.action} »"
                f" ne descend pas de « {poste.action if poste.sous_action else poste.programme} »."
                " La nomenclature a changé de forme : les codes publiés ne"
                " désigneraient plus les mêmes lignes d'un exercice à l'autre."
            )
    sans_intitule = sorted(code for code, valeurs in libelles.items() if not all(valeurs))
    if sans_intitule:
        raise BudgetIncoherent(
            f"exercice {exercice} : {len(sans_intitule)} code(s) sans intitulé, par"
            f" exemple « {sans_intitule[0]} ». Une ligne réglable qui ne se nomme"
            " pas ne se règle pas."
        )
    for nom, table in (("parent", parents), ("libellé", libelles)):
        multiples = sorted(code for code, valeurs in table.items() if len(valeurs) > 1)
        if multiples:
            raise BudgetIncoherent(
                f"exercice {exercice} : {len(multiples)} code(s) portent plusieurs"
                f" fois un {nom}, par exemple « {multiples[0]} » ->"
                f" {sorted(table[multiples[0]])}. Une nomenclature qui n'est plus un"
                " arbre ne se somme pas."
            )
    return {"codes_distincts": len(parents) + len({poste.mission for poste in postes})}


def construire(postes: list[Poste]) -> list[Noeud]:
    """L'arbre mission -> programme -> action -> sous-action.

    Deux règles, et elles ne sont pas cosmétiques.

    **Une action dont l'unique sous-action porte son propre libellé est
    aplatie.** La source décrit ainsi seize actions en 2025 (« Taxes foncières »
    ouvrant sur « Taxes foncières ») : le niveau supplémentaire ne dit rien, et
    l'interface y ferait cliquer pour retrouver le même intitulé et le même
    montant. Six seulement ont le libellé strictement identique et sont
    aplaties ; les dix autres nomment autre chose (« Recherche dans le domaine
    des risques » ouvrant sur « INERIS ») et gardent leur enfant, qui informe.

    **Un montant ne remonte jamais d'un niveau à l'autre.** Chaque poste tombe
    sur sa feuille, et les nœuds ne portent que la somme de leurs enfants. Une
    action qui aurait à la fois des lignes avec sous-action et des lignes sans
    perdrait la moitié de son montant à la construction : le contrôle d'identité
    ne pardonne pas ce cas, qui n'existe dans aucun des deux exercices.
    """
    missions: dict[str, Noeud] = {}
    programmes: dict[str, Noeud] = {}
    actions: dict[str, Noeud] = {}
    sous_actions: dict[str, Noeud] = {}
    for poste in postes:
        mission = missions.get(poste.mission)
        if mission is None:
            mission = missions[poste.mission] = Noeud(
                poste.mission, poste.libelle_mission, "mission"
            )
        programme = programmes.get(poste.programme)
        if programme is None:
            programme = programmes[poste.programme] = Noeud(
                poste.programme, poste.libelle_programme, "programme"
            )
            mission.enfants.append(programme)
        action = actions.get(poste.action)
        if action is None:
            action = actions[poste.action] = Noeud(
                poste.action, poste.libelle_action, "action"
            )
            programme.enfants.append(action)
        if poste.sous_action is None:
            action.montant += poste.montant
            continue
        sous_action = sous_actions.get(poste.sous_action)
        if sous_action is None:
            sous_action = sous_actions[poste.sous_action] = Noeud(
                poste.sous_action, poste.libelle_sous_action, "sous_action"
            )
            action.enfants.append(sous_action)
        sous_action.montant += poste.montant

    for action in actions.values():
        if len(action.enfants) == 1 and action.enfants[0].libelle == action.libelle:
            action.montant = action.enfants[0].montant
            action.enfants = []
    for noeud in (*missions.values(), *programmes.values(), *actions.values()):
        if noeud.enfants:
            noeud.montant = round(noeud.total(), 2)
    return sorted(missions.values(), key=lambda n: -n.montant)


def parcourir(noeuds: list[Noeud], parent: str | None = None):
    """(nœud, code du parent) pour tout l'arbre, parents avant enfants."""
    for noeud in noeuds:
        yield noeud, parent
        yield from parcourir(noeud.enfants, noeud.code)


def feuilles(noeuds: list[Noeud]) -> list[Noeud]:
    return [noeud for noeud, _ in parcourir(noeuds) if not noeud.enfants]


def grouper_recettes(rangs: list[dict]) -> list[tuple[str, str, int, list[dict]]]:
    """-> [(code de famille, intitulé, signe, lignes)], familles dans l'ordre du
    barème : les deux qui s'ajoutent, puis les deux qui se retranchent."""
    par_famille: dict[str, list[dict]] = defaultdict(list)
    for rang in rangs:
        famille = (rang.get("type_de_recettes") or "").strip()
        if famille not in FAMILLES:
            raise BudgetIncoherent(
                f"famille de recettes inconnue : « {famille} ». Son signe déciderait"
                " si elle s'ajoute aux recettes de l'État ou s'en déduit, et aucune"
                " valeur par défaut ne peut en décider à sa place."
            )
        par_famille[famille].append(
            {
                "code": _texte(rang["code_ligne_recettes"]),
                "libelle": net(rang["libelle"]),
                "montant": float(rang["montant_recettes_plf"] or 0.0),
            }
        )
    return [
        (code, net(famille), signe, par_famille.get(famille, []))
        for famille, (code, signe) in FAMILLES.items()
    ]


def recettes_nettes(groupes) -> float:
    return round(
        sum(signe * sum(x["montant"] for x in lignes) for _, _, signe, lignes in groupes), 2
    )


def controler_identite(exercice: str, postes: list[Poste], missions: list[Noeud]) -> dict:
    """Cinq sommes de la même matière, calculées séparément, à l'euro près.

    Le total lu ligne à ligne ne connaît pas l'arbre ; les sommes par mission,
    par programme et par action ne connaissent que leur clé ; la somme des
    feuilles ne connaît que l'arbre construit, aplatissement compris. Aucune de
    ces cinq-là ne se déduit des autres, et une ligne perdue au filtrage du
    budget général, un parent mal rattaché ou une action à moitié détaillée en
    sépare au moins deux.

    Les montants sont des euros entiers, donc exacts en flottant double jusqu'à
    9·10¹⁵ : l'écart attendu est nul, pas « petit ». Il est mesuré et tracé
    quand même — un contrôle qui ne peut qu'être vrai n'apprend rien.
    """
    total = round(sum(poste.montant for poste in postes), 2)
    par_cle: dict[str, dict[str, float]] = {
        "mission": defaultdict(float),
        "programme": defaultdict(float),
        "action": defaultdict(float),
    }
    for poste in postes:
        par_cle["mission"][poste.mission] += poste.montant
        par_cle["programme"][poste.programme] += poste.montant
        par_cle["action"][poste.action] += poste.montant

    sommes = {niveau: round(sum(v.values()), 2) for niveau, v in par_cle.items()}
    sommes["feuilles"] = round(sum(f.montant for f in feuilles(missions)), 2)
    sommes["missions_publiees"] = round(sum(m.montant for m in missions), 2)
    ecarts = {niveau: round(somme - total, 2) for niveau, somme in sommes.items()}
    fautives = {niveau: ecart for niveau, ecart in ecarts.items() if ecart}
    if fautives:
        niveau, ecart = next(iter(sorted(fautives.items())))
        raise BudgetIncoherent(
            f"exercice {exercice} : la somme par {niveau} s'écarte de {ecart:+,.2f} €"
            f" du total du budget général ({total:,.2f} €). Les deux décrivent la"
            " même matière : l'arbre publié ne serait pas le budget lu."
        )

    negatives = [f for f in feuilles(missions) if f.montant < 0]
    if negatives:
        raise BudgetIncoherent(
            f"exercice {exercice} : {len(negatives)} feuille(s) de crédit négative(s),"
            f" par exemple {negatives[0].code} à {negatives[0].montant:,.2f} €. Un"
            " crédit de paiement négatif ne se règle pas en pourcentage."
        )

    denombrement = defaultdict(int)
    for noeud, _ in parcourir(missions):
        denombrement[noeud.niveau] += 1
    return {
        "lignes_lues": len(postes),
        "total_credits_paiement": total,
        "ecart_maximal_euros": max(abs(e) for e in ecarts.values()),
        **{f"noeuds_{niveau}": nombre for niveau, nombre in sorted(denombrement.items())},
        "feuilles": len(feuilles(missions)),
    }


def _cle_temoin(rang: dict, forme: str) -> tuple[str, str, str]:
    if forme == "absolu":
        return (
            _texte(rang.get("sous_action")),
            _texte(rang.get("titre")),
            _texte(rang.get("categorie")),
        )
    programme, action = _texte(rang["programme"]), _texte(rang["action"])
    sous_action = _texte(rang.get("sous_action"))
    return (
        f"{programme}-{action}-{sous_action}" if sous_action else "",
        _texte(rang.get("code_titre")),
        _texte(rang.get("categorie")),
    )


def controler_temoins(
    exercice: str, rangs_depenses: list[dict], forme: str, rangs_recettes: list[dict]
) -> dict:
    """Les cellules relevées à la main sur le portail, à l'euro.

    Ce contrôle ne regarde ni l'arbre ni les totaux : il rouvre les rangs bruts
    et compare quatre valeurs qu'un humain a lues sur le site le 8 août 2026.
    C'est la seule prise qui ne partage aucun calcul avec le reste du module —
    une erreur systématique de lecture les satisferait toutes sauf celle-ci.
    """
    releves = []
    lues = {}
    for rang in rangs_depenses:
        cle = _cle_temoin(rang, forme)
        if cle in TEMOINS_DEPENSES[exercice]:
            colonnes = ("autorisation_engagement", "credit_de_paiement")
            if forme == "relatif":
                colonnes = ("ae_plf", "cp_plf")
            lues[cle] = tuple(float(rang[colonne] or 0.0) for colonne in colonnes)
    for cle, attendu in TEMOINS_DEPENSES[exercice].items():
        obtenu = lues.get(cle)
        if obtenu != attendu:
            raise BudgetIncoherent(
                f"exercice {exercice}, témoin {cle[0]} (titre {cle[1]}, catégorie"
                f" {cle[2]}) : (AE, CP) lus {obtenu}, relevés à la main {attendu}."
                " La source a changé, ou ce module ne lit pas la colonne qu'il croit."
            )
        releves.append({"cellule": "-".join(cle), "ae": attendu[0], "cp": attendu[1]})

    recettes = {
        _texte(rang["code_ligne_recettes"]): float(rang["montant_recettes_plf"] or 0.0)
        for rang in rangs_recettes
    }
    for code, attendu in TEMOINS_RECETTES[exercice].items():
        obtenu = recettes.get(code)
        if obtenu != attendu:
            raise BudgetIncoherent(
                f"exercice {exercice}, ligne de recette {code} : {obtenu} lu,"
                f" {attendu} relevé à la main le 8 août 2026."
            )
        releves.append({"cellule": f"recette {code}", "montant": attendu})
    return {"temoins": releves}


def controler_serie(totaux: dict[str, dict[str, float]]) -> dict:
    """Deux exercices successifs ne bougent pas d'un ordre de grandeur.

    Voir `VARIATION_MAXIMALE` pour la mesure et le seuil qui en découle.
    """
    mesures = []
    for grandeur in ("depenses", "recettes_nettes"):
        exercices = sorted(totaux)
        for precedent, courant in zip(exercices, exercices[1:], strict=False):
            avant, apres = totaux[precedent][grandeur], totaux[courant][grandeur]
            variation = (apres - avant) / avant
            mesures.append(
                {
                    "grandeur": grandeur,
                    "de": precedent,
                    "a": courant,
                    "variation": round(variation, 4),
                }
            )
            if abs(variation) > VARIATION_MAXIMALE:
                raise BudgetIncoherent(
                    f"{grandeur} : {variation:+.1%} entre {precedent} et {courant}"
                    f" ({avant / 1e9:.1f} puis {apres / 1e9:.1f} Md€), au-delà des"
                    f" {VARIATION_MAXIMALE:.1%} mesurés sur les exercices connus. Un"
                    " périmètre, une mesure ou un exercice a changé sans le dire."
                )
    return {"variations": mesures, "seuil": VARIATION_MAXIMALE}


def lignes_a_ecrire(exercice: str, missions: list[Noeud], groupes) -> list[tuple]:
    """-> les lignes de `fin.state_budget_detail` pour un exercice.

    L'arbre y est porté par `parent_code`, pas par la profondeur : c'est ce qui
    permet à une action aplatie d'être une feuille sans cesser d'être une action.
    """
    annee = int(exercice)
    lignes = [
        (annee, LOI, "depense", noeud.niveau, noeud.code, parent, noeud.libelle,
         noeud.montant, 1, MESURE_DEPENSES)
        for noeud, parent in parcourir(missions)
    ]
    for code, famille, signe, contenu in groupes:
        lignes.append(
            (annee, LOI, "recette", "famille", code, None, famille,
             round(sum(x["montant"] for x in contenu), 2), signe, MESURE_RECETTES)
        )
        lignes.extend(
            (annee, LOI, "recette", "ligne", ligne["code"], code, ligne["libelle"],
             ligne["montant"], signe, MESURE_RECETTES)
            for ligne in contenu
        )
    return lignes


def ecrire(conn, run_id: str, lignes: list[tuple]) -> int:
    """Remplace la nomenclature entière : un seul connecteur écrit ces lignes.

    La purge porte sur le jeu, pas sur l'exercice : charger un exercice sans
    l'autre laisserait le site proposer un millésime dont plus rien ne garantit
    qu'il vient du même passage. C'est aussi pourquoi tous les exercices sont
    lus dans un seul run.
    """
    conn.execute("delete from fin.state_budget_detail where dataset_id = ?", (DATASET,))
    for ligne in lignes:
        conn.execute(
            """
            insert into fin.state_budget_detail
                (fiscal_year, law, side, node_level, code, parent_code, label,
                 amount, sign, measure, dataset_id, run_id)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (*ligne, DATASET, run_id),
        )
    return len(lignes)


def collecter(conn, store, run_id: str) -> dict[str, dict]:
    """Les deux annexes de chaque exercice, archivées avant lecture.

    Les exports sont téléchargés **entiers**, sans filtre côté serveur : le
    périmètre du budget général est appliqué ici, où il se relit et se teste. Un
    `where=` dans l'URL ferait dépendre le total d'un paramètre invisible dans
    le fichier archivé.
    """
    lus: dict[str, dict] = {}
    for exercice, (jeu_depenses, forme, jeu_recettes) in sorted(JEUX.items()):
        annexes = {}
        for nature, jeu in (("depenses", jeu_depenses), ("recettes", jeu_recettes)):
            adresse = f"{BASE}/{jeu}/exports/json"
            contenu = telecharger(adresse, timeout=300)
            entrepot.record_asset(
                conn, store, run_id, DATASET, SOURCE, f"{jeu}.json", contenu,
                adresse, "application/json",
            )
            annexes[nature] = lire(contenu)
        annexes["forme"] = forme
        lus[exercice] = annexes
        entrepot.etape(
            f"{exercice} : {len(annexes['depenses'])} rangs de dépenses,"
            f" {len(annexes['recettes'])} lignes de recettes"
        )
    return lus


def preparer(lus: dict[str, dict]) -> tuple[dict, dict, dict]:
    """-> (arbres et groupes par exercice, contrôles, totaux)."""
    prepares, verifies, totaux = {}, {}, {}
    for exercice, annexes in sorted(lus.items()):
        postes = LECTEURS[annexes["forme"]](annexes["depenses"])
        arborescence = controler_arborescence(exercice, postes)
        missions = construire(postes)
        groupes = grouper_recettes(annexes["recettes"])
        identite = controler_identite(exercice, postes, missions)
        temoins = controler_temoins(
            exercice, annexes["depenses"], annexes["forme"], annexes["recettes"]
        )
        prepares[exercice] = (missions, groupes)
        nettes = recettes_nettes(groupes)
        verifies[exercice] = {
            **arborescence,
            **identite,
            **temoins,
            "lignes_recettes": sum(len(lignes) for *_, lignes in groupes),
            "recettes_nettes": nettes,
            "solde": round(nettes - identite["total_credits_paiement"], 2),
        }
        totaux[exercice] = {
            "depenses": identite["total_credits_paiement"],
            "recettes_nettes": nettes,
        }
    return prepares, verifies, totaux


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        garde_fou_volume(conn)
        lus = collecter(conn, store, run_id)
        prepares, verifies, totaux = preparer(lus)
        serie = controler_serie(totaux)
        lignes = [
            ligne
            for exercice, (missions, groupes) in sorted(prepares.items())
            for ligne in lignes_a_ecrire(exercice, missions, groupes)
        ]
        ecrites = ecrire(conn, run_id, lignes)
        entrepot.etape(f"{ecrites} nœuds écrits")
        for nom, severite, observe in (
            ("les_cinq_sommes_retombent_sur_le_total", "blocker", verifies),
            ("temoins_releves_a_la_main", "blocker",
             {e: v["temoins"] for e, v in verifies.items()}),
            ("variation_entre_exercices", "blocker", serie),
        ):
            conn.execute(
                """
                insert into meta.data_quality_checks
                    (run_id, dataset_id, check_name, severity, passed, observed)
                values (?, ?, ?, ?, true, ?)
                """,
                (run_id, DATASET, nom, severite, json.dumps(observe)),
            )
        conn.commit()
        entrepot.finish_run(
            conn, run_id, "success",
            rows_read=sum(len(a["depenses"]) + len(a["recettes"]) for a in lus.values()),
            rows_written=ecrites,
        )
        dernier = max(verifies)
        resume = verifies[dernier]
        print(
            f"budget de l'État ligne à ligne : {ecrites} nœuds sur"
            f" {len(prepares)} exercice(s) ({', '.join(sorted(prepares))}) ;"
            f" en {dernier}, {resume['noeuds_mission']} missions,"
            f" {resume['noeuds_programme']} programmes, {resume['noeuds_action']} actions,"
            f" {resume['noeuds_sous_action']} sous-actions pour"
            f" {resume['total_credits_paiement'] / 1e9:.1f} Md€ de crédits de paiement,"
            f" {resume['lignes_recettes']} lignes de recettes pour"
            f" {resume['recettes_nettes'] / 1e9:.1f} Md€ nets,"
            f" solde {resume['solde'] / 1e9:+.1f} Md€"
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
