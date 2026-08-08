"""À quoi sert l'argent d'une commune, et comment cela bouge d'un exercice à l'autre.

Le site disait ce que la commune paie — 183 M€ de personnel, 86 M€ d'achats. Il ne
disait pas **à quoi ça sert**. « Achats et charges externes » ne se discute pas ;
« 23 M€ pour le sport, 32 M€ pour les écoles » se discute.

La source est le grand livre : les balances comptables des collectivités avec
présentation croisée nature-fonction, publiées par la DGFiP. Cinq millions de
lignes par exercice, une par compte et par fonction et par budget. On n'en charge
que les totaux de premier niveau, agrégés **côté serveur** : une commune pèse
quelques lignes, pas cent cinquante.

**La tête de fonction ne veut pas dire la même chose selon la nomenclature, et
c'est le piège central.** Les communes ont migré de M14 vers M57 — 0,4 % des
lignes en 2019, 54 % en 2023, 99,6 % en 2024 — et M57 **renumérote** les
fonctions. Mesuré sur les 1 575 communes qui ont basculé entre 2023 et 2024,
donc comparées à elles-mêmes : la tête 3 passe de 6,4 % à 16,2 % de leurs
charges, la tête 8 de 10,9 % à 2,2 %, la tête 6 de 5,0 % à 1,0 %. Le groupe
témoin — 1 750 communes déjà en M57 les deux années — ne bouge, lui, d'aucun
point. Publier la tête brute, c'était donc publier une révolution de la dépense
communale qui n'a jamais eu lieu : la culture qui double, la voirie qui
s'effondre. **Et ce n'était pas seulement faux en série : ça l'était déjà sur
l'exercice unique publié**, où 54 % des communes rangeaient sous « Sport et
jeunesse » ce que M57 appelle « Santé et action sociale ».

**Ce qui est publié est donc une grille commune aux deux nomenclatures.** Six
postes, chacun réunion de têtes que M14 et M57 découpent différemment mais
recouvrent identiquement (voir `POSTES`). Sur les mêmes communes basculantes,
les six postes ne bougent que de 0,01 à 0,25 point — soit le bruit du groupe
témoin. On perd la distinction culture/sport et social/famille ; on gagne une
série qui veut dire quelque chose. Une série qui change de sens en cours de
route est pire qu'une série courte.

**Où la série commence, et pourquoi pas avant.** Le grand livre existe depuis
2012, et le schéma du jeu ne bouge pas. Mais **Paris quitte le champ en 2019** :
jusqu'à l'exercice 2018 la capitale est publiée sous `categ='Commune'`
(4,85 Md€ de classe 6 en 2018), à partir de 2019 sous `categ='PARIS'` — la Ville
de Paris a absorbé les compétences départementales, et son périmètre n'est plus
celui d'une commune. Charger 2018 mettrait un trou de 4,85 Md€ dans le total
France entre 2018 et 2019, et une falaise dans la fiche de Paris. La série
commence donc à **2019**. Elle s'arrête à l'exercice le plus récent publié, et
seuls les exercices pour lesquels le site publie déjà l'agrégat de référence
(`PARENT`) sont chargés : sans lui le résidu ne se calcule pas.

**Tous les exercices dans le même run.** `revisions.remplacer` purge l'indicateur
entier avant de réécrire : charger un seul exercice effacerait les autres. Un
contrôle de série borne en plus le mouvement du total France et de chaque poste
d'un exercice au suivant — c'est le seul contrôle qu'une lecture cohérente avec
elle-même mais faite avec la mauvaise nomenclature ne passe pas.

**Le périmètre n'est pas celui de l'OFGL, et c'est tout l'enjeu.** Le grand livre
donne 385,9 M€ de charges de classe 6 pour Bordeaux 2023 quand l'OFGL en publie
353,7. J'ai essayé de reconstituer la formule de l'OFGL — classe 6 moins les
contributions au fonds de compensation des charges territoriales, moins les
valeurs comptables des immobilisations cédées — et **elle ne ferme pas** : il
reste 31,5 M€ que rien de publié n'explique. L'OFGL neutralise autre chose sans
en publier la règle.

Publier les deux totaux côte à côte sans le dire donnerait deux réponses à la
même question. La décomposition porte donc un **poste de plus**, négatif, qui
nomme l'écart : « retraitements de l'OFGL, non détaillés par la source ». Les
sept redonnent alors exactement l'agrégat que le site publie déjà, exercice par
exercice, et le lecteur voit à la fois où va l'argent et ce qui sépare les deux
comptages.

**Ce que la fonction dit et ne dit pas.** Elle décrit la destination de la
dépense telle que la commune la ventile dans ses comptes. Deux communes peuvent
ranger la même dépense sous deux fonctions différentes ; les « services
généraux » recouvrent l'administration et tout ce qui n'est pas ventilable. Ce
n'est pas une mesure de politique publique, c'est une imputation comptable.

**Une commune sur sept seulement, et ce n'est pas un trou de collecte.** La
ventilation fonctionnelle n'est obligatoire qu'à partir de 3 500 habitants
(art. L. 2312-3 du code général des collectivités territoriales). En Gironde,
78 communes la produisent : ce sont 78 des 83 communes de 3 500 habitants et
plus, et aucune en dessous. Mesurée sur les communes soumises à l'obligation, la
couverture est de 94 % ; mesurée sur toutes les communes, elle serait de 15 % et
ferait passer une règle de droit pour un raté de collecte. C'est donc sur les
premières qu'elle est contrôlée.

Usage : python -m plateforme.normalize.fonctions_communes [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
import json
from collections import defaultdict

from plateforme import couverture, entrepot, revisions
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "dgfip-balances-fonction"
SOURCE = "data-economie"
THEME = "finances_locales"

# Un jeu par exercice, et **le slug n'est pas constructible** : la DGFiP a
# renommé sa publication à peu près chaque année, en laissant derrière elle des
# identifiants tronqués (« …-avec6 » porte 2019, « …-avec8 » porte 2021) puis
# deux conventions successives. Le construire à partir du millésime marchait
# pour 2023 et pour rien d'autre. La table est donc écrite, vérifiée une fois
# contre le catalogue (8 août 2026) : un exercice nouveau est une ligne à
# ajouter ici après avoir relevé son slug, pas une chaîne à deviner.
#
# 2018 et avant existent aussi (jusqu'à 2012) et **ne sont pas chargeables** :
# Paris y est publié sous `categ='Commune'` et en sort à partir de 2019. Voir la
# docstring du module.
JEUX = {
    "2019": "balances-comptables-des-collectivites-et-des-etablissements-publics-locaux-avec6",
    "2020": "balances-comptables-des-collectivites-et-des-etablissements-publics-locaux-avec7",
    "2021": "balances-comptables-des-collectivites-et-des-etablissements-publics-locaux-avec8",
    "2022": "balances-comptables-des-collectivites-et-des-etablissements-publics-locaux-2022",
    "2023": "balances-comptables-des-collectivites-et-des-epl-avec-fonction-2023",
    "2024": "balances-comptables-des-collectivites-et-des-etablissements-publics-locaux"
            "-avec-la-presentation-croisee-nature-fonction-2024",
    "2025": "balances-comptables-des-collectivites-et-des-etablissements-publics-locaux"
            "-avec-la-presentation-croisee-nature-fonction-2025",
}

BASE = "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets"

# L'agrégat que cette décomposition explique. Les postes doivent le redonner :
# c'est le contrôle, et c'est aussi ce qui permet au site de les proposer comme
# second axe de lecture du même total. Un exercice sans lui n'est pas chargé.
PARENT = "ofgl_depenses_fonctionnement"

# Les six postes publiables : {têtes M14 du poste: (libellé, indicateur)}. La clé
# est la liste des têtes de fonction que M14 y range, et c'est elle qui nomme le
# poste. Une tête ne se lit jamais seule.
#
# M14 : 0 services généraux, 1 sécurité, 2 enseignement, 3 culture, 4 sport et
# jeunesse, 5 interventions sociales et santé, 6 famille, 7 logement,
# 8 aménagement et services urbains-environnement, 9 action économique.
# M57 : 0 services généraux, 1 sécurité, 2 enseignement et formation,
# 3 culture-vie sociale-jeunesse-sports-loisirs, 4 santé et action sociale,
# 5 aménagement des territoires et habitat, 6 action économique,
# 7 environnement, 8 transports, 9 en réserve.
#
# Les regroupements ne sont pas déduits d'un texte : ils sont **mesurés** sur
# les 1 575 communes qui basculent de M14 à M57 entre 2023 et 2024, comparées à
# elles-mêmes. Têtes brutes : +9,80 pt sur la 3, −8,64 pt sur la 8, −4,00 pt sur
# la 6. Sur cette grille : −0,11 pt, −0,01 pt, −0,25 pt, soit le bruit du groupe
# témoin déjà en M57 (jusqu'à 0,22 pt). C'est ce qui la rend publiable.
FONCTIONS = {
    "0": ("Services généraux et administration", "fonction_commune_services_generaux"),
    "1": ("Sécurité et salubrité publiques", "fonction_commune_securite"),
    "2": ("Enseignement et formation", "fonction_commune_enseignement"),
    "34": ("Culture, sport et jeunesse", "fonction_commune_culture_sport"),
    "56": ("Interventions sociales, santé et famille", "fonction_commune_social_famille"),
    "789": (
        "Aménagement, logement, environnement, économie",
        "fonction_commune_amenagement_economie",
    ),
}

# Les mêmes six postes vus par M57 : {tête M57: poste}. C'est la seule écriture
# du renumérotage, et elle couvre les dix têtes — une tête oubliée tomberait aux
# services généraux par défaut de lecture, sans que rien ne le dise.
M57_VERS_POSTE = {
    "0": "0", "1": "1", "2": "2", "3": "34", "4": "56",
    "5": "789", "6": "789", "7": "789", "8": "789", "9": "789",
}

# L'indicateur de chaque poste, dans l'ordre de FONCTIONS.
POSTES = {identifiant: libelle for libelle, identifiant in FONCTIONS.values()}

RESIDU = "fonction_commune_retraitements_ofgl"

# Les dix têtes brutes publiées jusqu'ici, une par tête de fonction M14. Elles
# mélangeaient deux nomenclatures sous un seul libellé : retirées du code, elles
# resteraient publiées avec leurs valeurs de 2023 pour toujours. Elles sont donc
# dépubliées par `declarer` et leurs observations purgées par le remplacement —
# la dépublication s'écrit, elle ne se déduit pas d'une absence.
RETIRES = (
    "fonction_commune_culture",
    "fonction_commune_sport",
    "fonction_commune_social",
    "fonction_commune_famille",
    "fonction_commune_logement",
    "fonction_commune_amenagement",
    "fonction_commune_economie",
)

# Tête de fonction -> indicateur, par nomenclature. Construit depuis FONCTIONS et
# M57_VERS_POSTE pour que chaque nomenclature n'ait qu'une seule écriture.
GRILLE = {
    "M14": {tete: FONCTIONS[cle][1] for cle in FONCTIONS for tete in cle},
    "M57": {tete: FONCTIONS[cle][1] for tete, cle in M57_VERS_POSTE.items()},
}

# Les têtes de chaque nomenclature qui font un poste, pour la formule de la
# fiche : {indicateur: (têtes M14, têtes M57)}.
TETES = {
    FONCTIONS[cle][1]: (
        cle,
        "".join(t for t, c in sorted(M57_VERS_POSTE.items()) if c == cle),
    )
    for cle in FONCTIONS
}

# Les codes de département de la DGFiP ne sont pas ceux de l'INSEE pour
# l'outre-mer : le grand livre range la Guadeloupe en 101 là où le code officiel
# géographique dit 971. Les traduire nommément, plutôt que de les laisser tomber
# au filtre du référentiel, est ce qui permet à la couverture de ne mesurer que
# les vrais ratés d'appariement.
OUTRE_MER = {"101": "971", "102": "972", "103": "973", "104": "974", "106": "976"}

# Variation du total France d'un exercice au suivant. Mesurée sur les sept
# exercices 2019-2025 du grand livre lui-même : −1,76 % (2019→2020) à +5,74 %
# (2021→2022). Le seuil laisse deux fois la plus forte variation observée. Ce
# contrôle-là ne voit pas la nomenclature — le total en est indépendant — il voit
# un changement de périmètre : c'est lui qui aurait crié sur le −6,97 % de
# 2018→2019, quand Paris a quitté le champ.
SEUIL_SERIE_TOTAL = 0.12

# Variation d'un poste de la grille d'un exercice au suivant. Mesurée sur les
# mêmes sept exercices : au plus +8,23 % (culture-sport, 2021→2022). Le seuil
# laisse deux fois et demie cela. C'est **le** contrôle de la nomenclature : la
# grille oubliée un exercice ferait bouger culture-sport de +60 % et
# aménagement de −40 %, très loin au-delà.
#
# Les deux seuils sont calibrés sur le champ **national** — les 101 départements
# du référentiel, comme en production. Sur un seul département la même série est
# beaucoup plus nerveuse (jusqu'à 14,9 % sur la sécurité en Gironde entre 2020 et
# 2021) : un run restreint les frôlerait sans qu'il y ait rien à voir.
SEUIL_SERIE_POSTE = 0.20

# Témoin par exercice, relevé à la main sur le grand livre le 8 août 2026 :
# Bordeaux (33063), poste culture-sport, charges de classe 6 du budget
# principal, en euros. Bordeaux bascule de M14 à M57 entre 2020 et 2021 : la
# série est continue *parce que* la grille est appliquée. Sur les têtes brutes,
# la même commune passerait de 39,3 M€ (tête 3 M14) à 94,0 M€ (tête 3 M57).
# 100,1 M€ en 2023 est le témoin qui existait déjà ; sa valeur ne change pas,
# seul son libellé était faux.
TEMOIN_COMMUNE = "33063"
TEMOIN_POSTE = "fonction_commune_culture_sport"
TEMOINS = {
    "2019": 93_436_435.26,
    "2020": 94_350_537.13,
    "2021": 93_969_537.80,
    "2022": 96_304_783.09,
    "2023": 100_116_842.34,
    "2024": 104_119_012.11,
    "2025": 107_268_197.30,
}

TECHNIQUE = (
    "Balances comptables des collectivités et des établissements publics locaux"
    " avec présentation croisée nature-fonction, publiées par la DGFiP, un jeu"
    " par exercice. Budget principal des communes seul (cbudg=1,"
    " categ='Commune'), opérations budgétaires nettes au débit des comptes de"
    " classe 6."
    " Le poste n'est pas une tête de fonction brute : les communes ont migré de"
    " la nomenclature M14 vers M57 (0,4 % des lignes en 2019, 99,6 % en 2024) et"
    " M57 renumérote les fonctions. Les têtes sont donc regroupées en six postes"
    " que les deux nomenclatures recouvrent identiquement : culture et sport"
    " ensemble, social et famille ensemble, aménagement, logement,"
    " environnement et action économique ensemble. Contrôlé sur les 1 575 communes qui"
    " basculent entre 2023 et 2024 : les têtes brutes bougent jusqu'à 9,8 points"
    " de leurs charges, ces six postes de 0,25 point au plus."
    " La série commence à l'exercice 2019 : jusqu'en 2018 Paris est publié comme"
    " une commune, à partir de 2019 sous une catégorie propre (la Ville de Paris"
    " a absorbé les compétences départementales), et le champ des exercices"
    " antérieurs n'est donc pas celui des suivants."
    " La fonction décrit la destination que la commune donne à la dépense dans"
    " ses propres comptes : deux communes peuvent ranger la même dépense sous"
    " deux fonctions différentes, et les services généraux recouvrent"
    " l'administration et tout ce qui n'est pas ventilable. C'est une imputation"
    " comptable, pas une mesure de politique publique. La ventilation n'est"
    " obligatoire qu'à partir de 3 500 habitants (art. L. 2312-3 du CGCT) : en"
    " dessous de ce seuil la commune n'en publie pas, et ce bloc est absent de sa"
    " fiche. Le total de ces lignes est celui du grand livre, plus large que"
    " l'agrégat de l'OFGL publié par ailleurs ; l'écart figure en clair sous"
    " « retraitements de l'OFGL »."
)


class SerieIncomparable(RuntimeError):
    """La série ne se tient plus d'un exercice au suivant, ou rate son témoin."""


def url(exercice: str, departement: str) -> str:
    """L'export agrégé côté serveur, un exercice et un département à la fois.

    Cinq millions de lignes ne se rapatrient pas pour en garder quelques-unes
    par commune. Le `group_by` de l'API fait la somme avant l'envoi ; découper
    par département garde chaque requête sous la seconde et rend l'échec local
    plutôt que total. `nomen` est dans le regroupement parce que sans lui la
    tête de fonction est illisible.
    """
    from urllib.parse import urlencode

    return f"{BASE}/{JEUX[exercice]}/exports/csv?" + urlencode({
        "select": "ndept,insee,nomen,fonction,sum(obnetdeb) as debit",
        "group_by": "ndept,insee,nomen,fonction",
        "where": (
            f"categ='Commune' and cbudg='1' and startswith(compte,'6')"
            f" and ndept='{departement}'"
        ),
        "limit": -1,
    })


def code_insee(ndept: str, insee: str) -> str | None:
    """« 033 » + « 063 » -> « 33063 », « 02A » + « 247 » -> « 2A247 ».

    Le département de la DGFiP est cadré sur trois caractères par un zéro de
    tête, que la Corse n'a pas et que l'outre-mer remplace par un code à lui.
    """
    if len(insee) != 3 or not ndept:
        return None
    if ndept in OUTRE_MER:
        return f"{OUTRE_MER[ndept]}{insee[1:]}"
    departement = ndept[1:] if len(ndept) == 3 and ndept.startswith("0") else ndept
    return f"{departement}{insee}"


def famille(nomen: str) -> str:
    """« M57A » -> « M57 », « M14A » -> « M14 ». Lève sur tout le reste.

    Les nomenclatures abrégées suivent la fonctionnelle de leur famille. Une
    famille inconnue — un référentiel qui succéderait à M57 — arrête le
    chargement : la grille de regroupement est vérifiée nomenclature par
    nomenclature, en deviner une nouvelle ferait exactement la faute que ce
    module existe pour corriger.
    """
    for connue in GRILLE:
        if nomen.startswith(connue):
            return connue
    raise SerieIncomparable(
        f"nomenclature « {nomen} » inconnue : les têtes de fonction n'ont pas de"
        f" regroupement vérifié pour elle (connues : {sorted(GRILLE)}). Un"
        " référentiel nouveau renumérote les fonctions — il faut mesurer son"
        " regroupement avant de charger, pas le supposer."
    )


def lire(contenu: bytes) -> list[dict]:
    """L'export agrégé -> [{commune, poste, montant}].

    Le poste dépend de la tête de fonction **et** de la nomenclature de la
    ligne. Les lignes sans fonction sont gardées et rangées sous les services
    généraux : les écarter ferait manquer la somme au contrôle, et les compter
    ailleurs inventerait une destination que la source ne donne pas.
    """
    lignes = []
    for rangee in csv.DictReader(io.StringIO(contenu.decode("utf-8-sig")), delimiter=";"):
        code = code_insee((rangee.get("ndept") or "").strip(), (rangee.get("insee") or "").strip())
        montant = rangee.get("debit")
        if code is None or not montant:
            continue
        grille = GRILLE[famille((rangee.get("nomen") or "").strip())]
        fonction = (rangee.get("fonction") or "").strip()
        tete = fonction[0] if fonction and fonction[0] in grille else "0"
        lignes.append({
            "commune": code,
            "poste": grille[tete],
            "montant": round(float(montant), 2),
        })
    return lignes


def par_commune(lignes: list[dict]) -> dict[str, dict[str, float]]:
    """-> {commune: {poste: montant}}, les six postes sommés."""
    totaux: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for ligne in lignes:
        totaux[ligne["commune"]][ligne["poste"]] += ligne["montant"]
    return {code: dict(postes) for code, postes in totaux.items()}


def exercices_publiables(conn) -> list[str]:
    """Les exercices de `JEUX` pour lesquels le site publie déjà `PARENT`.

    Sans l'agrégat de référence, le résidu ne se calcule pas et aucune commune
    n'est écrite : télécharger l'exercice serait payer un export pour le jeter.
    L'intersection est donc faite avant de charger, pas après.
    """
    periodes = {
        periode for (periode,) in conn.execute(
            "select distinct period from core.observations"
            " where indicator_id = ? and geo_level = 'commune'"
            "   and value_status = 'normal' and variant = 'total'",
            (PARENT,),
        ).fetchall()
    }
    return sorted(set(JEUX) & periodes)


def agregats_ofgl(conn, exercice: str, communes) -> dict[str, float]:
    """Ce que le site publie déjà pour le même exercice et le même agrégat."""
    lignes = conn.execute(
        """
        select geo_code, value from core.observations
         where indicator_id = ? and geo_level = 'commune' and period = ?
           and value_status = 'normal' and variant = 'total'
        """,
        (PARENT, exercice),
    ).fetchall()
    connues = set(communes)
    return {code: float(valeur) for code, valeur in lignes if code in connues}


def candidates(
    totaux: dict[str, dict[str, float]], ofgl: dict[str, float], exercice: str
) -> list[tuple]:
    """Les observations à écrire pour un exercice, résidu de rapprochement compris.

    Une commune dont l'agrégat OFGL n'est pas publié n'est pas écrite du tout :
    sans lui, le résidu ne se calcule pas, et publier des postes dont la somme
    ne correspond à aucun total du site donnerait un second jeu de chiffres sur
    les mêmes lignes — exactement ce que ce site refuse.
    """
    sorties = []
    for code, postes in sorted(totaux.items()):
        total_ofgl = ofgl.get(code)
        if total_ofgl is None:
            continue
        grand_livre = sum(postes.values())
        for identifiant in POSTES:
            montant = postes.get(identifiant)
            if montant is None:
                continue
            sorties.append((identifiant, "commune", code, exercice, round(montant, 2)))
        sorties.append(
            (RESIDU, "commune", code, exercice, round(total_ofgl - grand_livre, 2))
        )
    return sorties


def controler(sorties: list[tuple], ofgl: dict[str, float]) -> dict:
    """Les postes doivent redonner l'agrégat que le site publie déjà.

    Il ne vérifie pas notre arithmétique — le résidu la ferme par construction —
    mais que chaque commune écrite a bien un agrégat de référence, et il mesure
    l'ampleur du retraitement. Un résidu qui dépasserait la moitié de l'agrégat
    signalerait un changement de périmètre à la source, pas un retraitement.
    """
    par_code: dict[str, float] = defaultdict(float)
    for _identifiant, _niveau, code, _periode, valeur in sorties:
        par_code[code] += valeur
    ecarts = [
        abs(somme - ofgl[code]) for code, somme in par_code.items() if code in ofgl
    ]
    residus = [
        abs(valeur) / abs(ofgl[code])
        for identifiant, _n, code, _p, valeur in sorties
        if identifiant == RESIDU and ofgl.get(code)
    ]
    residus.sort()
    if ecarts and max(ecarts) > 1.0:
        raise ValueError(
            f"la décomposition ne redonne pas l'agrégat de l'OFGL : écart maximal"
            f" de {max(ecarts):.2f} € sur {len(ecarts)} communes"
        )
    return {
        "communes": len(par_code),
        "residu_median": round(residus[len(residus) // 2], 4) if residus else None,
        "residu_maximal": round(residus[-1], 4) if residus else None,
    }


def controler_temoin(exercice: str, totaux: dict[str, dict[str, float]]) -> float | None:
    """Le témoin de l'exercice, relevé à la main, doit se retrouver à l'euro près.

    Un exercice dont le témoin n'a pas été relevé n'est pas contrôlé ici : il
    reste tenu par le contrôle de série. Mais un exercice dont le témoin existe
    et ne tombe pas arrête tout — c'est le seul contrôle qui compare la lecture
    à quelque chose d'extérieur au fichier.
    """
    attendu = TEMOINS.get(exercice)
    if attendu is None:
        return None
    lu = totaux.get(TEMOIN_COMMUNE, {}).get(TEMOIN_POSTE)
    if lu is None or abs(lu - attendu) > 1.0:
        raise SerieIncomparable(
            f"exercice {exercice} : {TEMOIN_POSTE} de {TEMOIN_COMMUNE} lu à"
            f" {lu if lu is None else round(lu, 2)} €, témoin relevé à la main"
            f" {attendu:.2f} €. Le jeu, le filtre ou la grille de regroupement"
            " a changé de sens."
        )
    return lu


def controler_serie(serie: dict[str, dict[str, float]]) -> dict:
    """La série se tient : aucun exercice manquant, aucun saut de total ni de poste.

    Chaque contrôle par exercice compare un exercice à lui-même : un exercice lu
    avec la mauvaise nomenclature mais cohérent avec lui-même les passerait
    tous. C'est ici qu'il se voit, et à deux endroits différents — le total
    France ne dépend pas de la nomenclature et voit les changements de
    périmètre ; chaque poste ne voit qu'elle. Et un exercice manquant n'est pas
    un cas à absorber : le remplacement couvrant l'indicateur entier, un exercice
    disparu disparaîtrait de l'entrepôt en silence.
    -> {exercices, variation maximale du total, du poste le plus mobile} .
    """
    exercices = sorted(serie)
    for avant, apres in zip(exercices, exercices[1:], strict=False):
        if int(apres) != int(avant) + 1:
            raise SerieIncomparable(
                f"trou dans la série : rien entre {avant} et {apres}. Un exercice"
                " a quitté le catalogue de la source ou son agrégat de référence"
                " n'est plus publié — recharger sans lui l'effacerait de"
                " l'entrepôt."
            )
    variation_totale, entre_totaux = 0.0, None
    variation_poste, poste_mobile, entre_postes = 0.0, None, None
    for avant, apres in zip(exercices, exercices[1:], strict=False):
        totaux = (sum(serie[avant].values()), sum(serie[apres].values()))
        variation = abs(totaux[1] - totaux[0]) / totaux[0]
        if variation > SEUIL_SERIE_TOTAL:
            raise SerieIncomparable(
                f"de {avant} à {apres}, le total France du grand livre passe de"
                f" {totaux[0] / 1e9:.2f} à {totaux[1] / 1e9:.2f} Md€"
                f" ({100 * variation:.1f} % pour"
                f" {100 * SEUIL_SERIE_TOTAL:.0f} % tolérés) : le champ a changé,"
                " pas la dépense."
            )
        if variation > variation_totale:
            variation_totale, entre_totaux = variation, f"{avant} -> {apres}"
        for poste in POSTES:
            precedent = serie[avant].get(poste)
            suivant = serie[apres].get(poste)
            if not precedent or suivant is None:
                continue
            bouge = abs(suivant - precedent) / precedent
            if bouge > SEUIL_SERIE_POSTE:
                raise SerieIncomparable(
                    f"de {avant} à {apres}, {poste} passe de"
                    f" {precedent / 1e9:.2f} à {suivant / 1e9:.2f} Md€"
                    f" ({100 * bouge:.1f} % pour"
                    f" {100 * SEUIL_SERIE_POSTE:.0f} % tolérés). Une dépense"
                    " communale ne se déplace pas de cet ordre en un exercice :"
                    " c'est une tête de fonction lue avec la nomenclature de"
                    " l'autre année."
                )
            if bouge > variation_poste:
                variation_poste, poste_mobile, entre_postes = bouge, poste, f"{avant} -> {apres}"
    return {
        "exercices": exercices,
        "variation_maximale_total": round(variation_totale, 4),
        "entre": entre_totaux,
        "variation_maximale_poste": round(variation_poste, 4),
        "poste_le_plus_mobile": poste_mobile,
        "entre_postes": entre_postes,
    }


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for identifiant, libelle in sorted(POSTES.items()):
            m14, m57 = TETES[identifiant]
            # Cinquante mots maximum : c'est une contrainte du schéma, et elle a
            # raison. Les réserves — imputation comptable, seuil de 3 500
            # habitants, regroupement des têtes M14/M57, écart avec l'OFGL —
            # vivent dans la définition technique, que la fiche affiche juste en
            # dessous.
            publique = (
                f"Ce que la commune dépense au titre de « {libelle.lower()} » dans son"
                " budget principal, hors investissement, tel qu'elle le ventile"
                " elle-même dans ses comptes."
            )
            formule = (
                "Somme des opérations budgétaires nettes au débit des comptes de"
                f" classe 6 dont le code fonction commence par {_tetes(m14)} en"
                f" nomenclature M14, par {_tetes(m57)} en M57"
            )
            _ecrire_indicateur(curseur, identifiant, libelle, publique, formule, "observed")
        _ecrire_indicateur(
            curseur, RESIDU, "Retraitements de l'OFGL",
            "L'écart entre les charges du grand livre et l'agrégat de dépenses de"
            " fonctionnement que l'Observatoire des finances locales publie pour la"
            " même commune. L'OFGL neutralise certaines écritures sans publier sa"
            " règle : cette ligne nomme l'écart plutôt que de le répartir sur les"
            " fonctions, ce qui l'aurait rendu invisible.",
            "Agrégat OFGL des dépenses de fonctionnement − somme des six postes",
            "computed",
        )
        # Retirer un indicateur du code ne le dépublie pas : sa ligne garde
        # published = true pour toujours, et les dix têtes brutes resteraient
        # affichées avec leurs valeurs de 2023 — dont cinq mélangeaient deux
        # nomenclatures sous un seul libellé. La dépublication s'écrit.
        curseur.execute(
            "update core.indicators set published = false where indicator_id in"
            f" ({', '.join('?' * len(RETIRES))})",
            RETIRES,
        )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def _tetes(codes: str) -> str:
    """« 789 » -> « 7, 8 ou 9 » ; « 0 » -> « 0 »."""
    if len(codes) == 1:
        return codes
    return ", ".join(codes[:-1]) + f" ou {codes[-1]}"


def _ecrire_indicateur(curseur, identifiant, libelle, publique, formule, confiance) -> None:
    definition = curseur.execute(
        """
        insert into core.indicator_definitions
            (public_definition, technical_definition, formula, unit_notes,
             confidence_level, badges)
        values (?, ?, ?, 'euros courants', ?, array['Officiel','Donnée brute'])
        returning definition_id
        """,
        (publique, TECHNIQUE, formule, confiance),
    ).fetchone()[0]
    curseur.execute(
        """
        insert into core.indicators
            (indicator_id, dataset_id, definition_id, theme, label_fr, unit, additive,
             price_basis, accounting_frame, geo_levels, time_granularity, published)
        values (?, ?, ?, ?, ?, 'EUR', true, 'current', 'budgetaire',
                array['commune'], 'annuelle', true)
        on conflict (indicator_id) do update set
            definition_id = excluded.definition_id, label_fr = excluded.label_fr,
            theme = excluded.theme, unit = excluded.unit, published = true
        """,
        (identifiant, DATASET, definition, THEME, libelle),
    )


COLONNES = ("value",)


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        garde_fou_volume(conn)
        exercices = exercices_publiables(conn)
        if not exercices:
            raise SerieIncomparable(
                f"aucun exercice de {sorted(JEUX)} n'a d'agrégat"
                f" « {PARENT} » au niveau commune dans l'entrepôt : la"
                " décomposition n'a rien à expliquer. Charger l'OFGL communal"
                " d'abord."
            )
        departements = [
            code for (code,) in conn.execute(
                "select distinct geo_code from geo.geography_reference"
                " where geo_level = 'departement' and vintage = ?",
                (MILLESIME,),
            ).fetchall()
        ]
        # Le département de la DGFiP, pas celui de l'INSEE : le cadrage sur trois
        # caractères et les codes d'outre-mer sont les siens.
        inverse = {insee: dgfip for dgfip, insee in OUTRE_MER.items()}

        # Tous les exercices dans le même run : `revisions.remplacer` purge
        # l'indicateur entier, un chargement partiel effacerait le reste.
        gardees: list[tuple] = []
        ecartes: set[str] = set()
        serie: dict[str, dict[str, float]] = {}
        par_exercice: dict[str, dict] = {}
        lignes_lues = 0
        dernier_ecrites: set[str] = set()
        for exercice in exercices:
            lignes: list[dict] = []
            for departement in sorted(departements):
                dgfip = inverse.get(departement) or departement.rjust(3, "0")
                adresse = url(exercice, dgfip)
                contenu = telecharger(adresse, timeout=300)
                entrepot.record_asset(
                    conn, store, run_id, DATASET, SOURCE,
                    f"balances-fonction-{exercice}-{dgfip}.csv", contenu, adresse, "text/csv",
                )
                lignes.extend(lire(contenu))
            lignes_lues += len(lignes)

            totaux = par_commune(lignes)
            temoin = controler_temoin(exercice, totaux)
            serie[exercice] = {
                poste: sum(t.get(poste, 0.0) for t in totaux.values()) for poste in POSTES
            }
            ofgl = agregats_ofgl(conn, exercice, totaux)
            gardees_exercice, ecartes_exercice = filtrer_territoires_connus(
                conn, candidates(totaux, ofgl, exercice)
            )
            verifies = controler(gardees_exercice, ofgl)
            gardees += gardees_exercice
            ecartes |= ecartes_exercice
            dernier_ecrites = {code for _i, _n, code, _p, _v in gardees_exercice}
            par_exercice[exercice] = {
                **verifies,
                "communes_grand_livre": len(totaux),
                "communes_avec_agregat_ofgl": len(ofgl),
                "temoin_bordeaux_culture_sport": temoin,
                "total_grand_livre": round(sum(serie[exercice].values()), 2),
            }
            entrepot.etape(
                f"exercice {exercice} : {len(lignes)} lignes agrégées,"
                f" {len(totaux)} communes au grand livre, {len(ofgl)} avec un"
                f" agrégat OFGL, {verifies['communes']} écrites"
            )
        continuite = controler_serie(serie)

        ecrites, revisees = revisions.remplacer(
            conn, run_id, sorted({*POSTES, RESIDU, *RETIRES}), COLONNES,
            [
                (identifiant, niveau, code, MILLESIME, periode, valeur)
                for identifiant, niveau, code, periode, valeur in gardees
            ],
        )
        # La couverture se mesure sur les communes **soumises à l'obligation** de
        # ventilation, pas sur toutes : rapportée aux 34 772, elle dirait 15 % et
        # ferait passer une règle de droit pour un raté de collecte. Et sur le
        # **dernier** exercice seul : le seuil de 3 500 habitants est celui de la
        # population la plus récente, l'appliquer à 2019 compterait comme
        # manquantes des communes qui n'y étaient pas soumises.
        soumises = {
            code for (code,) in conn.execute(
                """
                select o.geo_code from core.observations o
                 where o.indicator_id = 'insee_population_municipale'
                   and o.geo_level = 'commune' and o.variant = 'total'
                   and o.value >= 3500
                   and o.period = (select max(period) from core.observations
                                    where indicator_id = 'insee_population_municipale')
                """
            ).fetchall()
        }
        parts = (
            couverture.controler(
                {"commune": float(len(soumises))},
                {"commune": float(len(soumises & dernier_ecrites))},
            )
            if soumises
            else {}
        )
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'agregat_ofgl_temoins_et_serie_par_exercice',
                    'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                "serie": continuite,
                "par_exercice": {e: par_exercice[e] for e in sorted(par_exercice)},
                "seuil_obligation_habitants": 3500,
                "communes_soumises": len(soumises),
                "exercice_de_reference_couverture": exercices[-1],
                "hors_referentiel": len(ecartes),
                "indicateurs_depublies": sorted(RETIRES),
                "couverture": {n: round(p, 6) for n, p in sorted(parts.items())},
            }, ensure_ascii=False)),
        )
        conn.commit()
        entrepot.finish_run(
            conn, run_id, "success", rows_read=lignes_lues, rows_written=ecrites
        )
        dernier = par_exercice[exercices[-1]]
        print(
            f"fonctions communales : {ecrites} observations sur"
            f" {len(exercices)} exercices ({exercices[0]} -> {exercices[-1]}),"
            f" variation maximale du total France"
            f" {100 * continuite['variation_maximale_total']:.2f} %, du poste le"
            f" plus mobile {100 * continuite['variation_maximale_poste']:.2f} %"
            f" ({continuite['poste_le_plus_mobile']},"
            f" {continuite['entre_postes']}) ; en {exercices[-1]},"
            f" {dernier['communes']} communes, retraitement OFGL médian"
            f" {100 * (dernier['residu_median'] or 0):.1f} % de l'agrégat,"
            f" maximal {100 * (dernier['residu_maximal'] or 0):.1f} % ;"
            f" {revisees} révisées, {len(ecartes)} hors référentiel"
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
