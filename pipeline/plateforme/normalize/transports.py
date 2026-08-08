"""Parc de voitures particulières par commune (SDES, API DiDo).

Combien de voitures roulent dans ma commune, et combien sont électriques :
le parc roulant au 1er janvier de chaque année, 2011 à 2026, estimé par le
SDES à partir du répertoire statistique des véhicules routiers. Seul le
groupe VP — les voitures particulières — est chargé ; les utilitaires, poids
lourds et transports en commun du même fichier ne répondent pas à la question
que le site pose.

**Un parc estimé, pas un comptage, et révisable pendant des années.** Le SDES
recale son estimation au fil des contrôles techniques reçus : provisoire au
01/01/2026, définitive au 01/01/2023 et avant pour les véhicules légers. Le
témoin figé est pris sur un millésime définitif pour cette raison.

**La voiture est comptée à l'adresse du certificat d'immatriculation** —
celle du locataire pour une location longue durée ou un crédit-bail. Quand la
commune n'est pas identifiée, la source range le véhicule sous un code fictif
« département + 000 » (documenté par elle, vérifié sur l'API : 96 codes de
00000 à 95000, plus 2B000 et 97100-97600 pour l'outre-mer). Ces véhicules —
12 138 au 1er janvier 2026, sur 39 millions — sont écartés nommément, jamais
répartis.

**Paris, Lyon et Marseille : l'inverse de la Dares.** La source publie les
arrondissements *et* la commune entière, mais la commune n'est **pas** la
somme des arrondissements — c'est un résidu (75056 porte 6 521 voitures en
2026 quand ses vingt arrondissements en portent 596 643 ; mesuré sur l'API le
7 août 2026). Écarter les arrondissements publierait Paris à 1 % de sa
valeur : ici tout se replie et s'additionne sur la commune.

**Le contrôle qui bloque** tient deux prises. L'identité interne d'abord :
une voiture électrique porte la vignette Crit'Air E — vérifié sur le fichier
entier, 4 à 12 véhicules déviants par an sur des dizaines de milliers ; un
fichier recomposé ou des colonnes réappariées cassent cette identité en
masse. Le témoin figé ensuite, relevé à la main sur l'API le 7 août 2026 :
Bordeaux comptait 111 924 voitures particulières au 1er janvier 2023 — un
millésime définitif, que les révisions du SDES ne bougent plus.

Usage : python -m plateforme.normalize.transports [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
import json
import re
from collections import defaultdict

from plateforme import couverture, entrepot, revisions
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, commune_mere, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "sdes-parc-auto-communal"
SOURCE = "sdes-dido"
BASE = "https://data.statistiques.developpement-durable.gouv.fr/dido/api/v1"

# Le datafile « Données sur le parc de véhicules au niveau communal » du jeu
# « Parc de véhicules routiers » (682c33e7d455a8571c7d00ff). L'API DiDo sert
# le dernier millésime du fichier quand aucun paramètre `millesime` n'est
# passé — c'est voulu : chaque parution annuelle remplace la précédente, avec
# ses révisions. Le filtre serveur ne rapatrie que les voitures particulières
# (~787 000 lignes sur 2,1 millions, ~90 Mo) ; `withColumnName` donne une
# ligne d'en-tête aux noms techniques, le format figé dans la fixture.
RID = "1582861b-e042-4490-9161-6429d8229703"
URL = f"{BASE}/datafiles/{RID}/csv?withColumnName=true&GROUPE=eq:VP"

# Les colonnes fixes lues, par leur nom exact. Le libellé de commune, le
# statut de l'utilisateur et la catégorie fine sont redondants ou hors sujet ;
# les années arrivent en colonnes PARC_XXXX découvertes sur l'en-tête, pour
# que la parution qui ajoutera PARC_2027 soit chargée sans retoucher le code.
COLONNES_LUES = ("COMMUNE_CODE", "CARBURANT", "CRIT_AIR", "GROUPE")
COLONNE_PARC = re.compile(r"PARC_(\d{4})")

# Le seul groupe attendu après filtre serveur. En voir un autre n'est pas un
# cas à absorber : le filtre de l'URL n'a pas été appliqué, ou les colonnes
# sont décalées, et le « parc de voitures » compterait des camions.
GROUPE = "VP"

# Les douze motorisations du fichier, relevées sur l'API le 7 août 2026 en
# sommant les comptes par valeur (786 703 lignes VP retrouvées exactement).
# HR = hybride rechargeable, HNR = non rechargeable. Une valeur nouvelle
# changerait la définition de la part électrique : on regarde avant de charger.
CARBURANTS = frozenset({
    "Diesel", "Diesel HR", "Diesel HNR", "Essence", "Essence HR",
    "Essence HNR", "Electrique", "Gaz", "Gaz HR", "Gaz HNR",
    "Hydrogène et autre ZE", "Inconnu",
})

# Ce qui compte dans la part : l'électrique et les hybrides rechargeables.
# L'hydrogène et autres zéro émission (162 lignes, quelques centaines de
# véhicules) n'y sont pas — la fiche technique le dit.
RECHARGEABLES = frozenset({"Electrique", "Diesel HR", "Essence HR", "Gaz HR"})

CRIT_AIRS = frozenset({
    "Crit'Air 1", "Crit'Air 2", "Crit'Air 3", "Crit'Air 4", "Crit'Air 5",
    "Crit'Air E", "Non classé", "Inconnu",
})
CRITAIR_ZE = "Crit'Air E"

# Ce qu'un code commune de la source a le droit d'être : cinq chiffres ou la
# Corse. Les codes fictifs des véhicules non localisés — « département + 000 »,
# 00000 quand le département manque, 97100 à 97600 outre-mer — sont écartés
# nommément avec leur masse, jamais répartis. Tout autre motif arrête la
# lecture : colonne décalée.
CODE_COMMUNE = re.compile(r"\d{5}|2[AB]\d{3}")
CODE_FICTIF = re.compile(r"(\d{2}|2[AB])000|97[1-6]00")

INDICATEUR_PARC = "sdes_parc_voitures"
INDICATEUR_PART = "sdes_part_voitures_electriques"
THEME = "transports"

# L'identité interne : les voitures électriques portent la vignette Crit'Air E.
# Mesuré sur le fichier entier au 7 août 2026 : 27 lignes déviantes sur 49 596,
# 4 à 12 véhicules par an, zéro en 2026. Un demi pour cent laisse ce bruit
# passer ; des colonnes réappariées ou un fichier recomposé explosent au-dessus.
TOLERANCE_IDENTITE = 0.005

# Le témoin figé, relevé à la main sur l'API le 7 août 2026 : Bordeaux comptait
# 111 924 voitures particulières au 1er janvier 2023 — un millésime que le
# SDES dit définitif pour les véhicules légers, que les parutions suivantes ne
# révisent donc plus. Une lecture tronquée ou une colonne d'année décalée ne
# peuvent pas le reproduire.
TEMOIN_COMMUNE = "33063"
TEMOIN_ANNEE = "2023"
TEMOIN_BORDEAUX = 111_924
TEMOIN_TOLERANCE = 0.005

INDICATEURS = {
    INDICATEUR_PARC: (
        "Voitures particulières en circulation",
        "Le nombre de voitures particulières en circulation dans la commune au"
        " 1er janvier — le parc roulant estimé par le SDES d'après les"
        " immatriculations, particuliers et professionnels confondus. La"
        " voiture est comptée à l'adresse du certificat d'immatriculation,"
        " celle du locataire en cas de location longue durée.",
        "count",
        True,
        "Voitures particulières (groupe VP) en circulation au 1er janvier",
        "véhicules estimés, révisables plusieurs années après publication",
    ),
    INDICATEUR_PART: (
        "Part des voitures électriques ou hybrides rechargeables",
        "Sur cent voitures particulières en circulation dans la commune au"
        " 1er janvier, celles qui roulent en électrique ou en hybride"
        " rechargeable. Le parc est estimé par le SDES d'après les"
        " immatriculations ; l'hydrogène, marginal, n'est pas compté dans"
        " cette part.",
        "percent",
        False,
        "100 × (Electrique + Essence HR + Diesel HR + Gaz HR) / parc VP total",
        "part du parc communal, non sommable entre territoires",
    ),
}

TECHNIQUE = (
    "Fichier « Données sur le parc de véhicules au niveau communal » du SDES"
    " (API DiDo, jeu « Parc de véhicules routiers »), restreint au groupe VP —"
    " les voitures particulières ; utilitaires légers, poids lourds et"
    " transports en commun du même fichier ne sont pas chargés. Parc roulant"
    " **estimé** au 1er janvier de chaque année depuis 2011, révisé plusieurs"
    " années au fil des contrôles techniques reçus : provisoire au 01/01/2026,"
    " définitif au 01/01/2023 et avant pour les véhicules légers — les"
    " millésimes récents bougeront aux parutions suivantes. Le véhicule est"
    " localisé à l'adresse du certificat d'immatriculation : celle du"
    " locataire pour une location longue durée ou un crédit-bail, ce qui"
    " rattache une partie des flottes au siège du locataire. Particuliers et"
    " professionnels confondus. Les véhicules sans commune identifiée sont"
    " rangés par la source sous un code fictif « département + 000 »"
    " (12 138 voitures au 01/01/2026) : écartés nommément, jamais répartis."
    " Paris, Lyon et Marseille sont publiés par arrondissement plus un résidu"
    " sous le code de la commune entière — qui n'est pas la somme des"
    " arrondissements — et tout est additionné sur la commune. La part"
    " électrique rapporte les motorisations Electrique, Essence HR, Diesel HR"
    " et Gaz HR (hybrides rechargeables) au parc total, motorisation inconnue"
    " comprise au dénominateur ; l'hydrogène et autres zéro émission, quelques"
    " centaines de véhicules, n'y sont pas comptés. Le total recalculé peut"
    " différer légèrement des totaux nationaux publiés par le SDES pour des"
    " raisons d'arrondis (avertissement de la source)."
)


class ParcIncoherent(RuntimeError):
    """Le parc lu ne se recoupe plus — Crit'Air E, ou le témoin bordelais."""


def lire(contenu: bytes) -> tuple[dict[tuple[str, str], dict[str, int]], dict]:
    """-> ({(code commune, année): {total, rechargeable, electrique,
    electrique_hors_e}}, écartés).

    Les lignes sont agrégées par commune brute et année — arrondissements
    municipaux non repliés, le contrôle et le témoin travaillent sur ce que la
    source publie. Les codes fictifs des véhicules non localisés sont écartés
    ici, avec leur masse comptée dans `ecartes`.
    """
    lecteur = csv.DictReader(io.StringIO(contenu.decode("utf-8")), delimiter=";")
    entete = lecteur.fieldnames or []
    absentes = [nom for nom in COLONNES_LUES if nom not in entete]
    if absentes:
        raise ValueError(
            f"colonnes {absentes} absentes de l'export {entete} : la source a"
            " changé de structure, il faut regarder avant de recharger"
        )
    annees = {nom: m.group(1) for nom in entete if (m := COLONNE_PARC.fullmatch(nom))}
    if not annees:
        raise ValueError(
            f"aucune colonne PARC_XXXX dans l'en-tête {entete} : les millésimes"
            " ne sont plus en colonnes, la forme du fichier a changé"
        )

    parc: dict[tuple[str, str], dict[str, int]] = defaultdict(
        lambda: {"total": 0, "rechargeable": 0, "electrique": 0, "electrique_hors_e": 0}
    )
    ecartes = {"lignes_lues": 0, "lignes_fictives": 0, "vehicules_fictifs": 0,
               "codes_fictifs": set()}
    for rangee in lecteur:
        ecartes["lignes_lues"] += 1
        code = (rangee["COMMUNE_CODE"] or "").strip()
        carburant = (rangee["CARBURANT"] or "").strip()
        crit_air = (rangee["CRIT_AIR"] or "").strip()
        if (rangee["GROUPE"] or "").strip() != GROUPE:
            raise ValueError(
                f"groupe « {rangee['GROUPE']} » : le filtre de l'URL ne devait"
                " servir que des voitures particulières (VP) — filtre ignoré"
                " ou colonne décalée"
            )
        if carburant not in CARBURANTS:
            raise ValueError(
                f"motorisation « {carburant} » inconnue : une nouvelle valeur"
                " changerait la définition de la part électrique, il faut"
                " regarder avant de recharger"
            )
        if crit_air not in CRIT_AIRS:
            raise ValueError(f"vignette « {crit_air} » inconnue : colonne décalée ?")
        if CODE_FICTIF.fullmatch(code):
            ecartes["lignes_fictives"] += 1
            ecartes["codes_fictifs"].add(code)
            ecartes["vehicules_fictifs"] += sum(
                int(rangee[colonne]) for colonne in annees
            )
            continue
        if not CODE_COMMUNE.fullmatch(code):
            raise ValueError(
                f"code commune « {code} » : ni un code du COG ni un code"
                " fictif « département + 000 » de la source"
            )
        for colonne, annee in annees.items():
            valeur = int(rangee[colonne])
            compte = parc[(code, annee)]
            compte["total"] += valeur
            if carburant in RECHARGEABLES:
                compte["rechargeable"] += valeur
            if carburant == "Electrique":
                compte["electrique"] += valeur
                if crit_air != CRITAIR_ZE:
                    compte["electrique_hors_e"] += valeur
    ecartes["codes_fictifs"] = sorted(ecartes["codes_fictifs"])
    return dict(parc), ecartes


def controler(parc: dict[tuple[str, str], dict[str, int]]) -> dict:
    """Le contrôle qui bloque : Crit'Air E des électriques, puis témoin bordelais.

    L'identité couvre le fichier entier, année par année : une voiture
    électrique porte la vignette Crit'Air E, à 4-12 véhicules déviants près
    par an sur le fichier complet. Des colonnes réappariées ou un fichier
    recomposé la cassent en masse. Le témoin, lui, est un chiffre relevé hors
    du pipeline : la seule chose qu'une lecture tronquée ne reproduit pas.
    """
    if not parc:
        raise ParcIncoherent("aucune commune lue")
    par_annee: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for (_, annee), compte in parc.items():
        par_annee[annee][0] += compte["electrique"]
        par_annee[annee][1] += compte["electrique_hors_e"]
    if not sum(electrique for electrique, _ in par_annee.values()):
        raise ParcIncoherent(
            "aucune voiture électrique dans le fichier : l'identité Crit'Air E"
            " ne vérifie plus rien"
        )
    part_maximale = 0.0
    for annee, (electrique, hors_e) in sorted(par_annee.items()):
        part = hors_e / electrique if electrique else 0.0
        if part > TOLERANCE_IDENTITE:
            raise ParcIncoherent(
                f"{hors_e} voitures électriques sans vignette Crit'Air E sur"
                f" {electrique} en {annee} ({100 * part:.2f} % pour"
                f" {100 * TOLERANCE_IDENTITE:.1f} % tolérés). Motorisations et"
                " vignettes ne se correspondent plus — colonnes réappariées ou"
                " fichier recomposé."
            )
        part_maximale = max(part_maximale, part)

    cle = (TEMOIN_COMMUNE, TEMOIN_ANNEE)
    if cle not in parc:
        raise ParcIncoherent(
            f"Bordeaux ({TEMOIN_COMMUNE}) absente du millésime {TEMOIN_ANNEE} :"
            " le témoin figé n'a rien à mordre, lecture amputée"
        )
    temoin = parc[cle]["total"]
    if abs(temoin - TEMOIN_BORDEAUX) > TEMOIN_TOLERANCE * TEMOIN_BORDEAUX:
        raise ParcIncoherent(
            f"Bordeaux au 1er janvier {TEMOIN_ANNEE} : {temoin} voitures"
            f" particulières contre {TEMOIN_BORDEAUX} relevées à la main sur"
            f" l'API (±{100 * TEMOIN_TOLERANCE:.1f} %) — un millésime définitif"
            " que les révisions du SDES ne bougent plus. L'identité Crit'Air ne"
            " voit pas un fichier tronqué ; ce témoin, si."
        )

    annees = sorted({annee for _, annee in parc})
    return {
        "communes": len({code for code, _ in parc}),
        "commune_annees": len(parc),
        "premiere_annee": annees[0],
        "derniere_annee": annees[-1],
        "part_electrique_hors_critair_e_maximale": round(part_maximale, 5),
        "temoin_bordeaux": temoin,
    }


COLONNES = ("value",)


def lignes_a_ecrire(parc: dict[tuple[str, str], dict[str, int]]) -> list[tuple]:
    """Le parc total, et la part rechargeable quand il y a un parc.

    Les arrondissements de Paris, Lyon et Marseille se replient sur leur
    commune **et s'additionnent au résidu** que la source publie sous le code
    de la commune entière : 75056 ne vaut pas la somme de ses arrondissements
    (6 521 voitures contre 596 643 en 2026), l'écarter comme chez la Dares
    publierait Paris à 1 % de sa valeur. La part est calculée après repli,
    jamais sommée : une part ne s'additionne pas.
    """
    sommes: dict[tuple[str, str], list[int]] = defaultdict(lambda: [0, 0])
    for (code, annee), compte in parc.items():
        cible = sommes[(commune_mere(code) or code, annee)]
        cible[0] += compte["total"]
        cible[1] += compte["rechargeable"]

    lignes = []
    for (code, annee), (total, rechargeable) in sorted(sommes.items()):
        lignes.append(
            (INDICATEUR_PARC, "commune", code, MILLESIME, annee, float(total))
        )
        if total:
            lignes.append(
                (INDICATEUR_PART, "commune", code, MILLESIME, annee,
                 round(100 * rechargeable / total, 2))
            )
    return lignes


def vehicules_par_maille(candidates: list[tuple]) -> dict[str, float]:
    """Les véhicules par maille, pour les deux côtés de la couverture.

    La couverture se mesure en voitures, pas en codes : perdre Paris au
    référentiel ne pèserait pas une commune sur 35 000, il pèserait 600 000
    véhicules. Les parts n'entrent pas dans la masse — additionner des
    pourcentages à des véhicules ne mesurerait rien.
    """
    par_maille: dict[str, float] = defaultdict(float)
    for indicateur, niveau, _, _, _, valeur in candidates:
        if indicateur == INDICATEUR_PARC:
            par_maille[niveau] += valeur
    return dict(par_maille)


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for identifiant, (libelle, publique, unite, sommable, formule,
                          note) in sorted(INDICATEURS.items()):
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, ?, ?, 'observed', array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (publique, TECHNIQUE, formule, note),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, geo_levels, time_granularity, published)
                values (?, ?, ?, ?, ?, ?, ?, array['commune'], 'annuelle', true)
                on conflict (indicator_id) do update set unit = excluded.unit,
                    definition_id = excluded.definition_id,
                    label_fr = excluded.label_fr, additive = excluded.additive,
                    theme = excluded.theme, published = true
                """,
                (identifiant, DATASET, definition, THEME, libelle, unite, sommable),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        garde_fou_volume(conn)
        contenu = telecharger(URL, timeout=1800)
        entrepot.etape(f"{len(contenu) // 1024 // 1024} Mo reçus (groupe VP)")
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "parc-vp-communal.csv",
            contenu, URL, "text/csv",
        )
        parc, fictifs = lire(contenu)
        entrepot.etape(
            f"{len(parc)} communes-millésimes lues,"
            f" {fictifs['lignes_fictives']} lignes non localisées écartées"
        )
        verifies = controler(parc)
        candidates = lignes_a_ecrire(parc)
        gardees, ecartes = filtrer_territoires_connus(conn, candidates)
        ecrites, revisees = revisions.remplacer(
            conn, run_id, sorted(INDICATEURS), COLONNES, gardees
        )
        parts = couverture.controler(
            vehicules_par_maille(candidates), vehicules_par_maille(gardees)
        )
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'identite_critair_e_et_temoin_bordeaux', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "ecrites": ecrites,
                "non_localises": {cle: valeur for cle, valeur in fictifs.items()
                                  if cle != "lignes_lues"},
                "hors_referentiel": len(ecartes),
                "couverture": {n: round(p, 4) for n, p in sorted(parts.items())},
            })),
        )
        conn.commit()
        entrepot.finish_run(
            conn, run_id, "success",
            rows_read=fictifs["lignes_lues"], rows_written=ecrites,
        )
        print(
            f"parc automobile : {ecrites} observations sur {verifies['communes']}"
            f" communes, {verifies['premiere_annee']} →"
            f" {verifies['derniere_annee']}, témoin Bordeaux"
            f" {verifies['temoin_bordeaux']} voitures, {revisees} valeurs"
            f" révisées, {len(ecartes)} codes hors référentiel"
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
