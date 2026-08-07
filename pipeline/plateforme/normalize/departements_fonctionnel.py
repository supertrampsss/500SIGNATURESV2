"""À quoi sert l'argent des départements (OFGL, ventilation fonctionnelle).

Le site sait dire **combien** un département dépense. Il ne savait pas dire **à
quoi**. Cette base répartit les 91 milliards d'euros de dépenses
départementales entre les missions qu'elles financent — l'action sociale, les
collèges, les routes, les pompiers — et isole les trois allocations que les
départements versent sans les décider : le RSA, l'APA et la PCH.

**La hiérarchie est servie à plat, et il faut en choisir un étage.** La colonne
`niveau_hierarchique` vaut 1, 2, 3 ou 4 dans la même colonne `montant`. Les
niveaux 1 et 2 ventilent **le même total** ; les lire ensemble le double, et
sommer les quatre triplerait le budget des départements. Le niveau 1 est
retenu : c'est le seul qui soit à la fois exhaustif — les niveaux 3 et 4 ne
couvrent que 79,5 et 15,5 Md€ sur 91 — et assez court pour tenir en une poignée
d'indicateurs lisibles. Le niveau 2 n'est pas jeté : il sert de contrôle.

**Deux nomenclatures coexistent et leurs codes se contredisent.** Les
départements sont passés de la M52 à la M57, mais pas la même année : de 2014
pour les premiers à 2024 pour la plupart. Or le code `5` vaut « Aménagement des
territoires » en M57 et « Action sociale » en M52 ; le code `6` vaut « Action
économique » en M57 et « Réseaux et infrastructures » en M52 ; le code `0`
s'écrit « Services généraux » d'un côté et « SERVICES GÉNÉRAUX » de l'autre —
même sens, deux libellés. Grouper par `fonction` fusionnerait deux sens, grouper
par `nom_fonction` laisserait dix libellés orphelins. Les vingt couples
(nomenclature, code) sont donc mis à la main sur un jeu commun de fonctions.

**Une frontière ne se laisse pas harmoniser : celle des routes.** Mesuré sur
les 93 bascules de nomenclature observées depuis 2018, l'écart médian de part
budgétaire l'année du changement vaut le double de celui d'une année ordinaire
pour les transports (1,43 point contre 0,65) et le quadruple pour l'aménagement
(1,24 contre 0,29) : la M52 range dans « Réseaux et infrastructures » ce que la
M57 partage entre « Transports », « Aménagement » et « Environnement ». Réunis,
ces postes retrouvent une série lisse (0,80 point contre 0,81). Ils sont donc
publiés ensemble. Les six autres fonctions ne bougent pas plus l'année de la
bascule qu'une autre année, et restent séparées.

**Le total fonctionnel n'est pas le budget total.** Confrontée à la base
consolidée du même producteur, sur le même agrégat et le même exercice, la
ventilation fonctionnelle 2024 pèse 90 970 604 845 € contre 92 214 917 974 € :
1,244 Md€ de moins, soit 1,35 %. Une part du budget n'est rattachée à aucune
fonction. Publier « la part de l'action sociale dans le budget » avec le total
consolidé au dénominateur serait donc faux, et c'est pour cela que le total
fonctionnel est publié comme indicateur à part entière.

Usage : python -m plateforme.normalize.departements_fonctionnel
            [--depuis 2018] [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
import json
from collections import defaultdict
from urllib.parse import quote

from plateforme import couverture, entrepot, revisions
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

# Le jeu est tracé sous `ofgl-departements` : c'est l'entrée du registre qui
# décrit la base départementale de l'OFGL, dont la ventilation fonctionnelle
# est la seconde publication — même producteur, même maille, même exercice.
DATASET = "ofgl-departements"
SOURCE = "ofgl"
BASE = "https://data.ofgl.fr/api/explore/v2.1/catalog/datasets"
JEU = "ofgl-base-departements-fonctionnelle"

# Le niveau publié et celui qui le contrôle. Voir la docstring : ce sont deux
# ventilations du même total, pas deux étages à additionner.
NIVEAU_PUBLIE = "1"
NIVEAU_CONTROLE = "2"

# L'agrégat qui porte la dépense ventilée, et les trois allocations isolées.
TOTAL = "Dépenses totales hors remb"
ALLOCATIONS = {
    "Allocations RSA": "ofgl_allocation_rsa",
    "Allocations APA": "ofgl_allocation_apa",
    "Allocations PCH": "ofgl_allocation_pch",
}

# Exercice à partir duquel on publie : celui du connecteur `ofgl`, qui charge
# les agrégats départementaux depuis 2018. Une fonction ne se lit qu'à côté du
# budget dont elle est une part ; les deux séries doivent commencer ensemble.
DEPUIS = 2018

# Les vingt couples (nomenclature, code de fonction) du niveau 1, mis sur un
# jeu commun. Rien n'est déduit du code : la M52 et la M57 le numérotent
# autrement, et « 5 » ne veut pas dire la même chose dans les deux.
FONCTIONS = {
    ("M52", "0"): "ofgl_fonction_services_generaux",  # SERVICES GÉNÉRAUX
    ("M57", "0"): "ofgl_fonction_services_generaux",  # Services généraux
    ("M52", "1"): "ofgl_fonction_securite",
    ("M57", "1"): "ofgl_fonction_securite",
    ("M52", "2"): "ofgl_fonction_enseignement",  # Enseignement
    ("M57", "2"): "ofgl_fonction_enseignement",  # Enseignement, formation, apprentissage
    ("M52", "3"): "ofgl_fonction_culture",
    ("M57", "3"): "ofgl_fonction_culture",
    ("M52", "4"): "ofgl_fonction_social",  # Prévention médico-sociale
    ("M52", "5"): "ofgl_fonction_social",  # Action sociale
    ("M57", "4"): "ofgl_fonction_social",  # Santé et action sociale
    ("M52", "6"): "ofgl_fonction_territoire",  # Réseaux et infrastructures
    ("M52", "7"): "ofgl_fonction_territoire",  # Aménagement et environnement
    ("M52", "8"): "ofgl_fonction_territoire",  # Transports
    ("M57", "5"): "ofgl_fonction_territoire",  # Aménagement des territoires et habitat
    ("M57", "7"): "ofgl_fonction_territoire",  # Environnement
    ("M57", "8"): "ofgl_fonction_territoire",  # Transports
    ("M52", "9"): "ofgl_fonction_economie",  # Développement économique
    ("M57", "6"): "ofgl_fonction_economie",  # Action économique
}

# La M57 réserve un code sans lui donner de sens. Il porte une seule ligne dans
# les 865 735 de la base : 50,26 € au budget annexe des Bouches-du-Rhône en
# 2024. Elle est écartée, et le montant écarté est compté puis publié dans le
# contrôle qualité — un résidu qu'on ne mesure pas est un résidu qui grossit.
SANS_FONCTION = {("M57", "9")}  # « fonction en réserve »

TOTAL_FONCTIONNEL = "ofgl_fonction_total"

INDICATEURS = {
    TOTAL_FONCTIONNEL: (
        "Dépenses ventilées par fonction",
        "Ce que le département dépense dans l'année, réparti entre ses grandes"
        " missions. Ce total est un peu inférieur à son budget : une part des"
        " dépenses n'est rattachée à aucune fonction. C'est lui, et non le"
        " budget, qui sert de dénominateur aux parts.",
    ),
    "ofgl_fonction_social": (
        "Santé et action sociale",
        "Ce que le département consacre à l'aide sociale : RSA, aide aux"
        " personnes âgées et handicapées, protection de l'enfance, prévention"
        " santé. C'est de loin sa première mission — environ la moitié de ses"
        " dépenses.",
    ),
    "ofgl_fonction_territoire": (
        "Transports, réseaux et aménagement",
        "Routes, transports, réseaux, aménagement du territoire, habitat et"
        " environnement. Ces missions sont réunies parce que les deux"
        " nomenclatures comptables des départements ne tracent pas la"
        " frontière entre elles au même endroit.",
    ),
    "ofgl_fonction_enseignement": (
        "Enseignement et formation",
        "Ce que le département consacre aux collèges — construction,"
        " entretien, personnels techniques, restauration — et à la formation."
        " Il ne paie pas les enseignants, qui relèvent de l'État.",
    ),
    "ofgl_fonction_services_generaux": (
        "Services généraux",
        "L'administration du département lui-même : assemblée départementale,"
        " services centraux, gestion des ressources humaines et des finances."
        " Y figurent aussi les dépenses qui ne se rattachent à aucune autre"
        " mission.",
    ),
    "ofgl_fonction_securite": (
        "Sécurité",
        "Presque uniquement la contribution du département au service"
        " départemental d'incendie et de secours, qui emploie les"
        " sapeurs-pompiers. Le département ne finance ni la police ni la"
        " gendarmerie.",
    ),
    "ofgl_fonction_culture": (
        "Culture, jeunesse et sports",
        "Bibliothèques et archives départementales, musées, subventions aux"
        " clubs et aux associations, équipements sportifs. Un poste modeste :"
        " de l'ordre de 3 % des dépenses du département.",
    ),
    "ofgl_fonction_economie": (
        "Action économique",
        "Ce que le département consacre au développement économique, à"
        " l'agriculture et au tourisme. La loi NOTRe de 2015 a transféré"
        " l'essentiel de cette compétence aux régions.",
    ),
    "ofgl_allocation_rsa": (
        "Allocations de RSA versées",
        "Le revenu de solidarité active versé aux allocataires par le"
        " département, qui en assume la charge. Ce n'est pas une dépense qu'il"
        " décide : le barème est fixé par l'État. Compris dans la santé et"
        " l'action sociale.",
    ),
    "ofgl_allocation_apa": (
        "Allocations personnalisées d'autonomie versées",
        "L'allocation personnalisée d'autonomie, versée aux personnes âgées en"
        " perte d'autonomie, à domicile ou en établissement. Barème national,"
        " charge départementale. Comprise dans la santé et l'action sociale.",
    ),
    "ofgl_allocation_pch": (
        "Prestations de compensation du handicap versées",
        "La prestation de compensation du handicap, qui finance l'aide humaine"
        " et technique dont une personne handicapée a besoin. Barème national,"
        " charge départementale. Comprise dans la santé et l'action sociale.",
    ),
}

THEME = "fonctions"

TECHNIQUE = (
    "Ventilation fonctionnelle des dépenses départementales publiée par"
    " l'Observatoire des finances et de la gestion publique locales, agrégat"
    " « Dépenses totales hors remb », **niveau hiérarchique 1**, budget"
    " principal et budgets annexes réunis. Les niveaux 1 et 2 ventilent le même"
    " total : les additionner le doublerait, et le contrôle de chargement"
    " vérifie qu'ils coïncident. Deux nomenclatures coexistent, la M52 et la"
    " M57 : chaque département a basculé de l'une à l'autre entre 2014 et 2024,"
    " et leurs codes de fonction ne portent pas le même sens — les vingt"
    " couples (nomenclature, code) sont remis à la main sur un jeu commun de"
    " sept fonctions. Transports, réseaux, aménagement et environnement sont"
    " réunis parce que c'est la seule frontière que la bascule déplace"
    " nettement. Les allocations de RSA, d'APA et de PCH sont des sous-postes"
    " de la santé et de l'action sociale : elles ne s'ajoutent pas aux"
    " fonctions. Le total fonctionnel est inférieur au total de la base"
    " consolidée du même producteur — 90 970 604 845 € contre"
    " 92 214 917 974 € en 2024, soit 1,244 Md€ et 1,35 % d'écart sur 91 des 97"
    " entités : une part du budget n'est rattachée à aucune fonction. Toute"
    " part de fonction doit donc se calculer sur le total fonctionnel publié"
    " ici, jamais sur le budget consolidé. Périmètre : les 97 entités"
    " départementales de l'OFGL, Paris et la Métropole de Lyon compris ;"
    " la Corse, la Martinique et la Guyane, collectivités uniques, n'y"
    " figurent pas."
)

COLONNES = ("value",)

# Tolérance du contrôle niveau 1 / niveau 2, en écart relatif par exercice et
# par agrégat. Mesurée depuis 2018 : le pire écart observé vaut 7,2e-6, sur des
# centimes de rattrapage de la source. Lire les deux niveaux ensemble donnerait
# 1,0 — quatre ordres de grandeur au-dessus du seuil.
TOLERANCE = 1e-4


class NiveauxDivergents(RuntimeError):
    """Les deux ventilations du même total ne coïncident plus."""


class FonctionInconnue(RuntimeError):
    """Un couple (nomenclature, code de fonction) que la table ne connaît pas.

    La source peut ajouter une nomenclature ou rouvrir un code réservé. Ranger
    le montant au hasard reviendrait à déplacer silencieusement des milliards
    d'une mission à une autre : le chargement s'arrête, et la table se complète.
    """


def url() -> str:
    """Export CSV filtré sur les deux niveaux utiles et les quatre agrégats.

    Sans filtre, la base fait 865 735 lignes pour dix-sept agrégats et quatre
    niveaux. Le filtre la ramène à 85 000 lignes, dont la moitié ne sert qu'au
    contrôle.
    """
    agregats = ", ".join(f'"{a}"' for a in (TOTAL, *ALLOCATIONS))
    where = (
        f"niveau_hierarchique in ({NIVEAU_PUBLIE}, {NIVEAU_CONTROLE})"
        f" and agregat in ({agregats})"
    )
    colonnes = (
        "exer,dep_code,dep_name,categ,nomen,fonction,nom_fonction,agregat,"
        "niveau_hierarchique,type_de_budget,montant"
    )
    return (
        f"{BASE}/{JEU}/exports/csv?select={quote(colonnes)}"
        f"&where={quote(where)}&limit=-1"
    )


def lire(contenu: bytes) -> list[tuple[str, str, str, str, str, str, float]]:
    """-> [(exercice, code département, nomenclature, fonction, agrégat, niveau, montant)]."""
    lecteur = csv.DictReader(io.StringIO(contenu.decode("utf-8-sig")), delimiter=";")
    lignes = []
    for rang in lecteur:
        montant = (rang.get("montant") or "").strip()
        code = (rang.get("dep_code") or "").strip()
        if not montant or not code:
            continue
        lignes.append((
            (rang.get("exer") or "").strip(),
            code,
            (rang.get("nomen") or "").strip(),
            (rang.get("fonction") or "").strip(),
            (rang.get("agregat") or "").strip(),
            (rang.get("niveau_hierarchique") or "").strip(),
            float(montant),
        ))
    return lignes


def _par_niveau(lignes, niveau: str) -> dict[tuple[str, str], float]:
    """{(exercice, agrégat): montant} pour un étage de la hiérarchie."""
    totaux: dict[tuple[str, str], float] = defaultdict(float)
    for exercice, _, _, _, agregat, etage, montant in lignes:
        if etage == niveau:
            totaux[(exercice, agregat)] += montant
    return dict(totaux)


def controler_niveaux(lignes, depuis: int = DEPUIS) -> dict:
    """Les niveaux 1 et 2 ventilent le même total : ils doivent coïncider.

    C'est le contrôle qui rend le connecteur lisible plutôt que crédible : il
    prouve que l'étage publié n'est pas un sous-ensemble d'un autre, et qu'on
    ne l'a donc ni doublé ni amputé. Une lecture qui empilerait les deux
    niveaux rendrait un écart de 100 %, contre 0,0007 % toléré.
    """
    retenues = [ligne for ligne in lignes if int(ligne[0]) >= depuis]
    publie = _par_niveau(retenues, NIVEAU_PUBLIE)
    controle = _par_niveau(retenues, NIVEAU_CONTROLE)
    if not publie or not controle:
        raise NiveauxDivergents(
            f"l'un des deux niveaux est vide : {len(publie)} couples au niveau"
            f" {NIVEAU_PUBLIE}, {len(controle)} au niveau {NIVEAU_CONTROLE}"
        )
    manquants = sorted(set(publie) ^ set(controle))
    if manquants:
        raise NiveauxDivergents(
            f"{len(manquants)} couples (exercice, agrégat) présents à un seul"
            f" niveau, par exemple {manquants[0]}. Les deux étages ne décrivent"
            " plus le même total."
        )
    ecarts = {
        cle: abs(publie[cle] - controle[cle]) / abs(publie[cle])
        for cle in publie
        if publie[cle]
    }
    pire, relatif = max(ecarts.items(), key=lambda item: item[1])
    if relatif > TOLERANCE:
        raise NiveauxDivergents(
            f"niveaux {NIVEAU_PUBLIE} et {NIVEAU_CONTROLE} divergents sur"
            f" {pire} : {100 * relatif:.4f} % d'écart"
            f" ({publie[pire]:,.2f} € contre {controle[pire]:,.2f} €)."
            " Les deux étages ne ventilent plus le même total, ou l'un a été"
            " lu à la place de l'autre."
        )
    return {
        "couples_verifies": len(publie),
        "ecart_relatif_maximum": relatif,
        "couple_le_plus_ecarte": list(pire),
        "masse_publiee": round(sum(publie.values()), 2),
    }


def par_departement(lignes, depuis: int = DEPUIS) -> tuple[list[tuple], float]:
    """-> (observations, montant écarté faute de fonction).

    Seul le niveau publié est lu. Les fonctions et le total se calculent sur
    l'agrégat `TOTAL` ; les allocations sont sommées sur toutes les fonctions,
    puisque la source en range une part hors de l'action sociale.
    """
    totaux: dict[tuple[str, str, str], float] = defaultdict(float)
    residu = 0.0
    for exercice, code, nomen, fonction, agregat, etage, montant in lignes:
        if etage != NIVEAU_PUBLIE or int(exercice) < depuis:
            continue
        if agregat in ALLOCATIONS:
            totaux[(ALLOCATIONS[agregat], code, exercice)] += montant
            continue
        if agregat != TOTAL:
            continue
        if (nomen, fonction) in SANS_FONCTION:
            residu += montant
            continue
        indicateur = FONCTIONS.get((nomen, fonction))
        if indicateur is None:
            raise FonctionInconnue(
                f"nomenclature {nomen}, fonction « {fonction} » : couple absent"
                " de FONCTIONS. Le compléter avant de charger — un montant rangé"
                " au hasard déplace des milliards d'une mission à une autre."
            )
        totaux[(indicateur, code, exercice)] += montant
        totaux[(TOTAL_FONCTIONNEL, code, exercice)] += montant
    observations = [
        (indicateur, "departement", code, exercice, montant)
        for (indicateur, code, exercice), montant in sorted(totaux.items())
    ]
    return observations, residu


def masse_par_maille(candidates) -> dict[str, float]:
    """La dépense ventilée, pour les deux côtés de la couverture."""
    par_maille: dict[str, float] = defaultdict(float)
    for indicateur, niveau, _, _, montant in candidates:
        if indicateur == TOTAL_FONCTIONNEL:
            par_maille[niveau] += montant
    return dict(par_maille)


# Les trois allocations font doublon avec les indicateurs OFGL du thème
# finances locales (« Allocations RSA », APA, PCH), qui portent un parent et
# alimentent donc le pont : deux lignes pour le même versement sur la même
# fiche. Elles restent lues et écrites — la ventilation fonctionnelle en a
# besoin pour ses identités — mais ne sont plus affichées.
NON_PUBLIES = {"ofgl_allocation_rsa", "ofgl_allocation_apa", "ofgl_allocation_pch"}


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for identifiant, (libelle, publique) in sorted(INDICATEURS.items()):
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, ?, 'euros courants', 'observed',
                        array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (
                    publique,
                    TECHNIQUE,
                    "Somme des montants OFGL de niveau hiérarchique 1,"
                    " budgets principal et annexes",
                ),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, price_basis, accounting_frame, geo_levels,
                     time_granularity, published)
                values (?, ?, ?, ?, ?, 'EUR', true, 'current', 'budgetaire',
                        array['departement'], 'annuelle', ?)
                on conflict (indicator_id) do update set unit = excluded.unit,
                    definition_id = excluded.definition_id,
                    label_fr = excluded.label_fr,
                    theme = excluded.theme, published = excluded.published
                """,
                (identifiant, DATASET, definition, THEME, libelle,
                 identifiant not in NON_PUBLIES),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def run(depuis: int, store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        garde_fou_volume(conn)
        adresse = url()
        contenu = telecharger(adresse, timeout=600)
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE,
            "departements-fonctionnelle.csv", contenu, adresse, "text/csv",
        )
        lignes = lire(contenu)
        entrepot.etape(f"{len(lignes)} lignes lues")
        verifies = controler_niveaux(lignes, depuis)
        entrepot.etape(
            f"niveaux {NIVEAU_PUBLIE} et {NIVEAU_CONTROLE} :"
            f" {verifies['couples_verifies']} couples, écart maximum"
            f" {100 * verifies['ecart_relatif_maximum']:.6f} %"
        )
        candidates, residu = par_departement(lignes, depuis)
        gardees, ecartes = filtrer_territoires_connus(conn, candidates)
        ecrites, revisees = revisions.remplacer(
            conn, run_id, sorted(INDICATEURS), COLONNES,
            [
                (indicateur, niveau, code, MILLESIME, exercice, montant)
                for indicateur, niveau, code, exercice, montant in gardees
            ],
        )
        parts = couverture.controler(
            masse_par_maille(candidates), masse_par_maille(gardees)
        )
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'niveaux_1_et_2_ventilent_le_meme_total',
                    'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "residu_sans_fonction": round(residu, 2),
                "hors_referentiel": sorted(ecartes),
                "couverture": {n: round(p, 4) for n, p in sorted(parts.items())},
            })),
        )
        conn.commit()
        entrepot.finish_run(
            conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites,
        )
        exercices = sorted({ligne[3] for ligne in gardees})
        print(
            f"dépenses par fonction des départements : {ecrites} observations,"
            f" exercices {exercices[0]}-{exercices[-1]},"
            f" {verifies['masse_publiee'] / 1e9:.1f} Md€ ventilés,"
            f" {residu:.2f} € sans fonction, {revisees} révisées"
        )
        return 0
    except Exception as error:  # noqa: BLE001 — tout échec finit tracé dans le lineage
        entrepot.finish_run(conn, run_id, "failed", error=str(error))
        raise
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--depuis", type=int, default=DEPUIS)
    parser.add_argument("--store", default=".snapshots")
    args = parser.parse_args()
    return run(args.depuis, args.store)


if __name__ == "__main__":
    raise SystemExit(main())
