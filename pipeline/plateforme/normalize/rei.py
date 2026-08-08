"""Ma taxe foncière, qui la touche ? (REI, DGFiP republié par l'OFGL).

Le site savait déjà dire ce que la commune encaisse de taxe foncière et à quel
taux. Il ne savait pas dire **ce que paie le contribuable** : sur son avis, la
part communale n'est qu'une ligne parmi cinq. Ce module publie les quatre
autres, commune par commune : l'intercommunalité, les taxes annexes,
l'enlèvement des ordures ménagères et les frais que l'État retient. La part
communale, elle, est déjà publiée (`dgfip_produit_foncier_bati`, même source,
même variable) : la republier ferait compter deux fois le même euro. Les cinq
lignes réunies font l'avis, et le site en tire des pourcentages.

Sur les 54,9 Md€ de taxes foncières bâties émises en 2025 : 40,2 Md€ à la
commune (73 %), 3,0 Md€ à l'intercommunalité (5 %), 0,5 Md€ aux taxes annexes
(1 %), 9,2 Md€ aux ordures ménagères (17 %) et 2,1 Md€ à l'État (4 %).

**Les ordures ménagères ne sont pas la taxe foncière, et elles sont sur le même
avis.** La TEOM pèse un sixième de ce que paie le propriétaire ; la taire
laisserait un trou d'un sixième dans la ventilation. Mais son bénéficiaire, la
source ne le dit pas : commune, intercommunalité ou syndicat selon les cas, elle
la classe sous « Divers ». La fiche le dit plutôt que de deviner.

**La taxe GEMAPI est comptée avec l'intercommunalité.** Elle figure sur l'avis
en colonne séparée, mais c'est l'EPCI à fiscalité propre qui l'encaisse, et la
source la classe elle aussi au destinataire « GFP ». La question posée est
« qui touche », pas « quelle ligne de l'avis ».

**Le code commune de la source change de forme d'un millésime à l'autre.** En
2024, Bourg-en-Bresse est « 01053 » ; en 2025, la même commune est « 1053 »,
zéro de tête tombé. 3 135 communes des départements 01 à 09 sont concernées,
soit 5,5 % du produit communal du millésime 2025. Un code passé tel quel au
référentiel les écarte toutes en silence : la lecture reconstruit donc le code
Insee à partir du département et de la fin de l'identifiant, dans les deux
formes.

**Le contrôle qui bloque tient deux prises.** L'identité interne d'abord : la
source publie, sous « frais d'assiette, dégrèvement, non valeurs », ce que
l'État retient, et sa notice en donne la formule exacte — 3 % de la taxe
foncière et de la GEMAPI, 8 % de la part syndicale, des ordures ménagères et de
la taxe francilienne, 9 % des taxes spéciales d'équipement. Recalculer ces frais
depuis la ventilation et les confronter au montant publié vérifie que la
ventilation est **complète** : mesuré à 0,13 % d'écart en 2024 et 0,12 % en
2025, quand oublier les ordures ménagères en ferait 35 %, l'intercommunalité
4,1 %, les taxes spéciales d'équipement 1,1 %. Cette prise ne voit pas tout : la
part syndicale (0,6 %) et la taxe francilienne (0,1 %) resteraient sous le
seuil. Les témoins figés servent à cela, relevés à la main sur le fichier
original de la DGFiP : Paris, Lyon et Bourg-en-Bresse en 2025, quatre montants
chacun. Entre eux, les trois font apparaître chaque composante au moins une
fois — Paris porte les taxes spéciales et la francilienne sans
intercommunalité, Lyon la part syndicale, Bourg-en-Bresse le code à zéro de
tête.

Usage : python -m plateforme.normalize.rei [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
import json
import re
import urllib.parse
from collections import defaultdict

from plateforme import couverture, entrepot, revisions
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "ofgl-rei-ventilation"
SOURCE = "ofgl"
BASE = "https://data.ofgl.fr/api/explore/v2.1/catalog/datasets/rei"

THEME = "impots_locaux"

# Les quatre indicateurs et les variables du REI qui les composent. Les noms
# courts (colonne `var`) et non les libellés (`varlib`) : ce sont eux que la
# trace de variables de la DGFiP nomme, ils traversent les millésimes quand les
# libellés se reponctuent.
#
# E33 part intercommunale de la taxe foncière bâtie ; E53gGEMAPI taxe pour la
# gestion des milieux aquatiques, encaissée par le même EPCI.
# E23 part des syndicats de communes à contributions fiscalisées ; E53 taxes
# spéciales d'équipement des établissements publics fonciers ; E53A celles des
# EPF locaux de Guadeloupe et Martinique, de la Société du Grand Paris et de la
# Société Grand Projet Sud-Ouest ; E53TASA taxe additionnelle spéciale annuelle
# de la région Île-de-France.
# F13 montant total, toutes zones, de la taxe d'enlèvement des ordures ménagères.
# E00 frais d'assiette, de dégrèvement et de non valeurs retenus par l'État.
VENTILATION = {
    "dgfip_taxe_fonciere_intercommunalite": ("E33", "E53gGEMAPI"),
    "dgfip_taxe_fonciere_taxes_annexes": ("E23", "E53", "E53A", "E53TASA"),
    "dgfip_taxe_fonciere_ordures_menageres": ("F13",),
    "dgfip_taxe_fonciere_frais_etat": ("E00",),
}

# La part communale n'est pas publiée ici : `dgfip_produit_foncier_bati` la
# publie déjà, depuis cette variable exactement. Elle est lue quand même, parce
# que le contrôle des frais de gestion s'appuie dessus.
COMMUNE = "E13"

VARIABLES = (COMMUNE, *(v for composantes in VENTILATION.values() for v in composantes))

# Les taux que la notice du REI 2025 attribue aux frais de gestion de l'État,
# variable E00 : « 3 % de la TFB, de la taxe GEMAPI [...] ; 8 % du montant de la
# part syndicale, de la taxe d'enlèvement des ordures ménagères et de la taxe
# additionnelle spéciale annuelle de la région Île-de-France ; 9 % de la taxe
# spéciale d'équipement ». La part communale et la part intercommunale relèvent
# toutes deux de « la TFB ».
TAUX_FRAIS = (
    (0.03, ("E13", "E33", "E53gGEMAPI")),
    (0.08, ("E23", "F13", "E53TASA")),
    (0.09, ("E53", "E53A")),
)

# L'écart admis entre les frais recalculés et les frais publiés, sur la somme
# France d'un exercice. Mesuré le 8 août 2026 sur la parution entière :
# +0,135 % en 2024, +0,118 % en 2025 — l'impôt de chaque contribuable est
# arrondi à l'euro et les frais se calculent article par article, pas sur la
# masse communale. Un pour cent absorbe ce bruit et laisse le contrôle mordre :
# la même somme sans les ordures ménagères s'écarte de 35 %, sans la part
# intercommunale de 4,1 %, sans les taxes spéciales d'équipement de 1,1 %. La
# part syndicale (0,6 %) et la taxe francilienne (0,1 %) passeraient sous ce
# seuil : ce sont les témoins qui les tiennent, et c'est pourquoi il en faut.
ECART_FRAIS_MAXIMUM = 0.01

# Les témoins figés, relevés à la main le 8 août 2026 dans le fichier original
# de la DGFiP — REI_2025.csv, extrait de REI-2025-fichier-notice-trace.zip sur
# data.economie.gouv.fr —, c'est-à-dire chez le producteur et non chez le
# republieur que le pipeline interroge. Les quatre montants de chaque commune
# ont été retrouvés à l'euro près des deux côtés.
#
# Les trois ensemble couvrent chaque composante : Paris porte les taxes
# spéciales d'équipement (E53), celles de la Société du Grand Paris (E53A), la
# taxe francilienne (E53TASA) et la GEMAPI, sans un euro d'intercommunalité ;
# Lyon porte une part syndicale (E23) et une part intercommunale ;
# Bourg-en-Bresse, département 01, porte le code à zéro de tête que la source a
# cessé d'écrire en 2025.
TEMOIN_EXERCICE = "2025"
TEMOINS = {
    "75056": {
        "dgfip_taxe_fonciere_intercommunalite": 11_639_087.0,
        "dgfip_taxe_fonciere_taxes_annexes": 47_635_884.0,
        "dgfip_taxe_fonciere_ordures_menageres": 569_218_483.0,
        "dgfip_taxe_fonciere_frais_etat": 105_223_047.0,
    },
    "69123": {
        "dgfip_taxe_fonciere_intercommunalite": 8_878_761.0,
        "dgfip_taxe_fonciere_taxes_annexes": 1_352_691.0,
        "dgfip_taxe_fonciere_ordures_menageres": 60_156_548.0,
        "dgfip_taxe_fonciere_frais_etat": 15_890_115.0,
    },
    "01053": {
        "dgfip_taxe_fonciere_intercommunalite": 716_888.0,
        "dgfip_taxe_fonciere_taxes_annexes": 88_269.0,
        "dgfip_taxe_fonciere_ordures_menageres": 7_427_503.0,
        "dgfip_taxe_fonciere_frais_etat": 1_466_008.0,
    },
}
TEMOIN_TOLERANCE = 0.005

# Saint-Martin est recensé par la DGFiP sous son propre codage — département
# 978, identifiant « 9788 » — et n'est pas une commune du Code officiel
# géographique. Reconstruire un code Insee pour lui en fabriquerait un faux
# (« 97808 », qui n'existe pas) : la collectivité est écartée nommément, avec sa
# masse. Saint-Barthélemy, absent des deux millésimes lus, est nommé avec elle
# pour que son retour ne passe pas par un code inventé.
HORS_COG = {"977": "Saint-Barthélemy", "978": "Saint-Martin"}

# Le code Insee reconstruit : cinq caractères, ou la Corse (2A004, 2B033).
CODE_COMMUNE = re.compile(r"\d{5}|2[AB]\d{3}")

COLONNES_ATTENDUES = ("annee", "dep", "idcom", "var", "valeur", "secret_statistique")

PUBLIQUE = {
    "dgfip_taxe_fonciere_intercommunalite": (
        "Sur les taxes foncières payées dans la commune, la part qui revient à"
        " l'intercommunalité : sa propre taxe foncière, et s'il y en a une la taxe"
        " pour les milieux aquatiques et les inondations. Beaucoup n'en lèvent"
        " rien : zéro est une réponse, pas un trou."
    ),
    "dgfip_taxe_fonciere_taxes_annexes": (
        "Sur les taxes foncières payées dans la commune, la part qui revient aux"
        " taxes additionnelles : syndicats de communes, établissements publics"
        " fonciers, et en Île-de-France la taxe régionale pour les transports."
        " C'est la colonne « taxes spéciales » de l'avis d'imposition."
    ),
    "dgfip_taxe_fonciere_ordures_menageres": (
        "Ce que rapporte, dans la commune, la taxe d'enlèvement des ordures"
        " ménagères, payée sur le même avis que la taxe foncière et calculée sur"
        " la même valeur du logement. Elle revient à la commune, à"
        " l'intercommunalité ou à un syndicat : la source ne dit pas lequel."
    ),
    "dgfip_taxe_fonciere_frais_etat": (
        "Sur les taxes foncières payées dans la commune, ce que l'État retient"
        " pour calculer l'impôt, l'encaisser et couvrir les impayés. Ces frais"
        " s'ajoutent à ce que touchent les collectivités : 3 % de la taxe"
        " foncière, 8 % des ordures ménagères, 9 % des taxes spéciales."
    ),
}

LIBELLES = {
    "dgfip_taxe_fonciere_intercommunalite": "Taxe foncière : la part de l'intercommunalité",
    "dgfip_taxe_fonciere_taxes_annexes": "Taxe foncière : la part des taxes annexes",
    "dgfip_taxe_fonciere_ordures_menageres": "Taxe foncière : la part des ordures ménagères",
    "dgfip_taxe_fonciere_frais_etat": "Taxe foncière : la part que retient l'État",
}

FORMULES = {
    identifiant: "REI, variable" + ("s " if len(composantes) > 1 else " ")
    + " + ".join(composantes)
    for identifiant, composantes in VENTILATION.items()
}

TECHNIQUE = (
    "Recensement des éléments d'imposition à la fiscalité directe locale (REI),"
    " produit par la DGFiP et republié par l'Observatoire des finances et de la"
    " gestion publique locales, exercices 2024 et 2025. **Ce que ces montants"
    " décomposent, c'est l'impôt émis sur le territoire de la commune, pas le"
    " budget d'une collectivité** : la part intercommunale est ce que les"
    " contribuables de cette commune versent à leur EPCI, non le produit total de"
    " l'EPCI. Additionnés à la part communale, publiée à part sous « Produit de"
    " la taxe foncière » et lue dans la même source, les quatre montants font"
    " l'avis de taxe foncière sur les propriétés bâties. Les propriétés non"
    " bâties, la taxe d'habitation sur les résidences secondaires et la fiscalité"
    " économique n'y sont pas. **Un millésime décrit l'imposition de l'année"
    " qu'il porte et paraît l'année suivante** : le REI 2025 a été publié en"
    " 2026. **Rôles généraux uniquement** : les rôles supplémentaires, émis après"
    " coup, n'y figurent pas. Les montants portent sur des **bases nettes**,"
    " après abattements et exonérations ; les exonérations que l'État compense"
    " aux collectivités ne sont pas de l'impôt payé et n'entrent pas ici. La taxe"
    " GEMAPI est comptée avec l'intercommunalité, qui l'encaisse, alors que"
    " l'avis lui donne une colonne séparée. La part incitative de la taxe"
    " d'enlèvement des ordures ménagères (66 M€ en 2025, 0,12 % de l'avis) est"
    " laissée de côté : la source ne permet pas d'établir si elle est déjà dans"
    " le montant total, et l'y ajouter dégrade le rapprochement des frais de"
    " gestion de 0,12 % à 0,37 %. Le bénéficiaire de la taxe d'enlèvement des"
    " ordures ménagères n'est pas identifié par la source, qui le classe sous"
    " « Divers ». Les valeurs sous secret statistique sont absentes et non"
    " nulles ; une absence de ligne, elle, vaut zéro, la source retirant les"
    " montants nuls. Paris, Lyon et Marseille sont recensés en communes"
    " entières, sans arrondissements ; Paris ne verse rien à la Métropole du"
    " Grand Paris au titre du foncier bâti. Saint-Martin, codé par la DGFiP hors"
    " du Code officiel géographique, est écarté. Les communes nouvelles"
    " apparaissent au millésime où elles sont recensées, et un territoire absent"
    " du référentiel courant est écarté plutôt que rattaché de force."
)


class VentilationIncoherente(RuntimeError):
    """La ventilation ne retrouve plus les frais de l'État, ou un témoin figé."""


def url() -> str:
    """L'export CSV du REI, restreint aux neuf variables du foncier bâti utiles.

    Le jeu compte 22,7 millions d'enregistrements pour vingt-cinq dispositifs
    fiscaux : la clause `where` appartient à la requête. Le département est
    demandé avec l'identifiant de commune parce qu'il faut les deux pour
    reconstruire un code Insee (voir `code_insee`).
    """
    liste = ", ".join(f"'{variable}'" for variable in VARIABLES)
    clause = f"var in ({liste})"
    return (
        f"{BASE}/exports/csv?where={urllib.parse.quote(clause)}"
        f"&select={','.join(COLONNES_ATTENDUES)}&delimiter=;"
    )


def code_insee(dep: str, idcom: str) -> str | None:
    """Reconstruit le code Insee de la commune. `None` si le codage est étranger.

    La source n'écrit pas l'identifiant de la même façon d'un millésime à
    l'autre : « 01053 » en 2024, « 1053 » en 2025 pour la même commune. Le code
    Insee, lui, est toujours le département suivi du rang de la commune complété
    à cinq caractères — trois chiffres en métropole et en Corse, deux en
    outre-mer. On retrouve donc le rang en retirant le département en tête, tel
    quel ou privé de son zéro, puis on le recompose.
    """
    for prefixe in (dep, dep.lstrip("0")):
        if prefixe and idcom.startswith(prefixe):
            rang = idcom[len(prefixe):]
            code = dep + rang.zfill(5 - len(dep))
            return code if CODE_COMMUNE.fullmatch(code) else None
    return None


def lire(contenu: bytes) -> tuple[dict[tuple[str, str], dict[str, float | None]], dict]:
    """-> ({(exercice, code commune): {variable: montant}}, ce qui est écarté).

    Un montant sous secret statistique vaut `None` : la source le masque, et
    écrire zéro à sa place inventerait une commune qui ne paierait rien. Une
    variable **absente** de la commune, elle, vaut bien zéro : la source retire
    les lignes nulles pour tenir la volumétrie, et le dit.

    `utf-8-sig` et non `utf-8` : l'export de l'OFGL commence par un BOM, qui se
    collerait au nom de la première colonne et écraserait les deux exercices
    sous la même clé.
    """
    lecteur = csv.DictReader(io.StringIO(contenu.decode("utf-8-sig")), delimiter=";")
    absentes = [nom for nom in COLONNES_ATTENDUES if nom not in (lecteur.fieldnames or [])]
    if absentes:
        raise ValueError(
            f"colonnes {absentes} absentes de l'export : sans le département il"
            " est impossible de reconstruire un code Insee, et la source a déjà"
            " changé la forme de ses identifiants une fois"
        )

    lignes: dict[tuple[str, str], dict[str, float | None]] = defaultdict(dict)
    ecartes: dict[str, dict] = {}
    for rang in lecteur:
        variable = (rang.get("var") or "").strip()
        if variable not in VARIABLES:
            raise ValueError(
                f"variable « {variable} » inattendue dans l'export : la clause de"
                " sélection n'a pas été appliquée, les montants lus ne sont plus"
                " ceux du foncier bâti"
            )
        dep = (rang.get("dep") or "").strip()
        brut = (rang.get("valeur") or "").strip()
        masque = bool((rang.get("secret_statistique") or "").strip())
        if dep in HORS_COG:
            part = ecartes.setdefault(
                f"hors_cog_{HORS_COG[dep].lower().replace('-', '_')}",
                {"lignes": 0, "montant": 0.0},
            )
            part["lignes"] += 1
            part["montant"] += 0.0 if masque or not brut else float(brut)
            continue
        code = code_insee(dep, (rang.get("idcom") or "").strip())
        if code is None:
            raise ValueError(
                f"département « {dep} », identifiant « {rang.get('idcom')} » : le"
                " code Insee ne se reconstruit pas. La source a changé le codage"
                " de ses territoires, il faut le regarder avant de recharger"
            )
        if masque:
            lignes[((rang.get("annee") or "").strip(), code)][variable] = None
            continue
        if not brut:
            continue
        montant = float(brut)
        if montant < 0:
            raise ValueError(
                f"commune {code}, variable {variable} : montant négatif"
                f" ({montant:.0f} €). Un produit émis et des frais retenus ne"
                " sont jamais négatifs ; la mesure a changé de sens"
            )
        lignes[((rang.get("annee") or "").strip(), code)][variable] = montant

    manquantes = set(VARIABLES) - {
        variable for montants in lignes.values() for variable in montants
    }
    if manquantes:
        raise ValueError(
            f"variables {sorted(manquantes)} absentes de tout l'export : une"
            " composante entière de la ventilation vaudrait zéro partout"
        )
    return dict(lignes), ecartes


def composante(montants: dict[str, float | None], variables) -> float | None:
    """La somme des variables d'un indicateur, ou `None` si l'une est masquée.

    Une composante à moitié connue n'est pas une composante : publier la part
    lisible d'un total masqué sous-estimerait ce que paie le contribuable sans
    le dire.
    """
    total = 0.0
    for variable in variables:
        valeur = montants.get(variable, 0.0)
        if valeur is None:
            return None
        total += valeur
    return total


def frais_recalcules(montants: dict[str, float | None]) -> float | None:
    """Les frais de l'État refaits depuis la ventilation, selon la notice du REI."""
    total = 0.0
    for taux, variables in TAUX_FRAIS:
        part = composante(montants, variables)
        if part is None:
            return None
        total += taux * part
    return total


def ecarts_frais(lignes: dict) -> dict[str, dict[str, float]]:
    """-> {exercice: {recalcules, publies, ecart_relatif, communes}}.

    C'est la première prise du contrôle, et elle porte sur la **complétude** :
    les frais que l'État retient sont, dans la source elle-même, une fonction
    linéaire de toutes les lignes de l'avis. Les recalculer depuis la
    ventilation et les confronter au montant publié dit si une part a été
    oubliée. L'écart se mesure sur la somme France d'un exercice et non commune
    par commune : les frais se calculent article par article, chaque cotisation
    étant arrondie à l'euro, si bien qu'une petite commune s'en écarte
    légitimement de quelques pour cent.
    """
    par_exercice: dict[str, dict[str, float]] = {}
    for (exercice, _), montants in lignes.items():
        publies = montants.get("E00")
        recalcules = frais_recalcules(montants)
        if publies is None or recalcules is None:
            continue
        cumul = par_exercice.setdefault(
            exercice, {"recalcules": 0.0, "publies": 0.0, "communes": 0}
        )
        cumul["recalcules"] += recalcules
        cumul["publies"] += publies
        cumul["communes"] += 1
    for cumul in par_exercice.values():
        if not cumul["publies"]:
            cumul["ecart_relatif"] = 1.0
            continue
        ecart = abs(cumul["recalcules"] - cumul["publies"]) / cumul["publies"]
        cumul["ecart_relatif"] = round(ecart, 6)
    return par_exercice


def controler(lignes: dict) -> dict:
    """Le contrôle qui bloque : les frais de l'État, puis les témoins figés.

    Les deux prises ne voient pas la même chose. Les frais recalculés voient une
    composante manquante ou lue dans la mauvaise unité, sur toute la France à la
    fois, mais ils ne distinguent pas une part de 0,15 % du bruit d'arrondi. Les
    témoins, relevés à la main chez le producteur, épinglent chaque composante
    sur trois communes nommées : une variable lue sur la mauvaise ligne s'y voit
    quand aucun total ne la montrerait.
    """
    if not lignes:
        raise VentilationIncoherente("aucune commune lue")

    ecarts = ecarts_frais(lignes)
    if not ecarts:
        raise VentilationIncoherente(
            "aucun exercice n'a pu être vérifié : les frais de gestion de l'État"
            " manquent, la complétude de la ventilation n'est plus démontrable"
        )
    for exercice, cumul in sorted(ecarts.items()):
        if cumul["ecart_relatif"] > ECART_FRAIS_MAXIMUM:
            raise VentilationIncoherente(
                f"exercice {exercice} : les frais retenus par l'État refaits"
                f" depuis la ventilation font {cumul['recalcules']:.0f} € contre"
                f" {cumul['publies']:.0f} € publiés, soit"
                f" {100 * cumul['ecart_relatif']:.2f} % d'écart pour"
                f" {100 * ECART_FRAIS_MAXIMUM:.0f} % tolérés. Une part de l'avis"
                " manque, ou une variable est lue dans la mauvaise unité."
            )

    if TEMOIN_EXERCICE not in ecarts:
        raise VentilationIncoherente(
            f"l'exercice {TEMOIN_EXERCICE} des témoins n'est plus dans la source :"
            " la fenêtre des millésimes a bougé, il faut relever de nouveaux"
            " témoins chez la DGFiP avant de recharger"
        )
    releves: dict[str, dict[str, float]] = {}
    for code, attendus in sorted(TEMOINS.items()):
        montants = lignes.get((TEMOIN_EXERCICE, code))
        if montants is None:
            raise VentilationIncoherente(
                f"commune témoin {code} absente de l'exercice {TEMOIN_EXERCICE} :"
                " la lecture a perdu des territoires, ou leur codage a changé"
            )
        releves[code] = {}
        for identifiant, attendu in sorted(attendus.items()):
            lu = composante(montants, VENTILATION[identifiant])
            releves[code][identifiant] = lu
            if lu is None or abs(lu - attendu) > TEMOIN_TOLERANCE * attendu:
                raise VentilationIncoherente(
                    f"témoin {code} en {TEMOIN_EXERCICE}, {identifiant} : {lu} €"
                    f" lus contre {attendu:.0f} € relevés à la main chez la DGFiP"
                    f" (±{100 * TEMOIN_TOLERANCE:.1f} %). Le rapprochement des"
                    " frais ne voit pas une composante lue sur la mauvaise"
                    " variable ; ce témoin, si."
                )

    return {
        "exercices": sorted(ecarts),
        "frais": {
            exercice: {
                "communes": cumul["communes"],
                "ecart_relatif": cumul["ecart_relatif"],
            }
            for exercice, cumul in sorted(ecarts.items())
        },
        "temoins": releves,
    }


def valeurs_publiees(lignes: dict) -> list[tuple]:
    """-> [(indicateur, niveau, code, exercice, montant)], zéros compris.

    Un zéro s'écrit : l'intercommunalité de Bordeaux ne lève pas un euro de
    foncier bâti, et c'est une réponse à « qui touche ma taxe foncière », pas une
    donnée manquante. Une composante masquée par le secret statistique, elle, ne
    s'écrit pas.
    """
    return [
        (identifiant, "commune", code, exercice, valeur)
        for (exercice, code), montants in sorted(lignes.items())
        for identifiant, variables in sorted(VENTILATION.items())
        if (valeur := composante(montants, variables)) is not None
    ]


def montant_par_maille(candidates: list[tuple]) -> dict[str, float]:
    """La ventilation par maille, pour les deux côtés de la couverture.

    La couverture se mesure en euros et non en codes : trois communes perdues ne
    pèsent rien si elles portent trois mille euros, et tout si elles portent
    Paris. Les quatre indicateurs entrent ensemble — ce sont quatre parts
    disjointes du même avis, les additionner ne compte aucun euro deux fois.
    """
    par_maille: dict[str, float] = defaultdict(float)
    for _, niveau, _, _, valeur in candidates:
        par_maille[niveau] += valeur
    return dict(par_maille)


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for identifiant in sorted(VENTILATION):
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, ?,
                        'euros courants, impôt émis sur les rôles généraux de'
                        ' l''année d''imposition',
                        'observed', array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (PUBLIQUE[identifiant], TECHNIQUE, FORMULES[identifiant]),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, price_basis, accounting_frame, geo_levels,
                     time_granularity, published)
                values (?, ?, ?, ?, ?, 'EUR', true, 'current', 'budgetaire',
                        array['commune'], 'annuelle', true)
                on conflict (indicator_id) do update set unit = excluded.unit,
                    definition_id = excluded.definition_id,
                    label_fr = excluded.label_fr,
                    theme = excluded.theme, published = true
                """,
                (identifiant, DATASET, definition, THEME, LIBELLES[identifiant]),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


# `revisions.remplacer` attend : cinq clés, puis ces colonnes-là.
COLONNES = ("value",)


def ecrire(conn, run_id: str, lignes: dict) -> tuple[int, set[str], int, dict, dict]:
    """Remplace la ventilation en archivant ce qui a bougé.

    L'OFGL republie le REI d'un exercice à l'autre, corrections comprises. Un
    lecteur qui a lu « 5 % de ma taxe foncière va à l'intercommunalité » doit
    pouvoir constater que le chiffre a été rectifié, pas le voir disparaître
    sous le suivant.
    """
    candidates = valeurs_publiees(lignes)
    gardees, ecartes = filtrer_territoires_connus(conn, candidates)
    ecrites, revisees = revisions.remplacer(
        conn,
        run_id,
        sorted(VENTILATION),
        COLONNES,
        (
            (identifiant, niveau, code, MILLESIME, exercice, valeur)
            for identifiant, niveau, code, exercice, valeur in gardees
        ),
    )
    return (
        ecrites,
        ecartes,
        revisees,
        montant_par_maille(candidates),
        montant_par_maille(gardees),
    )


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        garde_fou_volume(conn)
        adresse = url()
        contenu = telecharger(adresse, timeout=900)
        entrepot.etape(f"{len(contenu) // 1024} Ko reçus")
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "rei-ventilation-foncier.csv",
            contenu, adresse, "text/csv",
        )
        lignes, hors_cog = lire(contenu)
        entrepot.etape(f"{len(lignes)} couples commune-exercice lus")
        verifies = controler(lignes)
        entrepot.etape(
            "frais de l'État retrouvés depuis la ventilation sur"
            f" {len(verifies['exercices'])} exercices, {len(TEMOINS)} témoins tenus"
        )
        ecrites, ecartes, revisees, lus, reconnus = ecrire(conn, run_id, lignes)
        entrepot.etape(f"{ecrites} observations écrites")
        parts = couverture.controler(lus, reconnus)
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'frais_de_l_etat_et_temoins_dgfip', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "ecrites": ecrites,
                "hors_cog": hors_cog,
                "hors_referentiel": len(ecartes),
                "couverture": {n: round(p, 4) for n, p in sorted(parts.items())},
            })),
        )
        conn.commit()
        entrepot.finish_run(
            conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites
        )
        exercices = verifies["exercices"]
        print(
            f"ventilation de la taxe foncière : {ecrites} observations,"
            f" exercices {', '.join(exercices)}, {len(VENTILATION)} indicateurs ;"
            f" frais de l'État retrouvés à"
            f" {100 * max(v['ecart_relatif'] for v in verifies['frais'].values()):.2f} %"
            f" près, {len(TEMOINS)} témoins DGFiP tenus,"
            f" {len(ecartes)} territoires hors référentiel,"
            f" {revisees} valeurs révisées"
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
