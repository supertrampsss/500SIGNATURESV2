"""Consommation d'espaces naturels, agricoles et forestiers par commune (Cerema).

Combien de terres naturelles, agricoles ou forestières la commune a transformées
en zones urbanisées chaque année, et combien pour y construire des logements :
les flux annuels 2011 → 2024 du fichier national du Cerema (portail de
l'artificialisation, suivi de l'objectif ZAN), mesurés sur les fichiers
fonciers, en **mètres carrés**.

**« Consommation d'espaces NAF » n'est pas « artificialisation ».** La loi
Climat et résilience distingue les deux : la consommation d'ENAF — la création
ou l'extension effective d'espaces urbanisés — sert de mesure jusqu'en 2031 ;
l'artificialisation au sens strict se mesurera ensuite sur l'occupation des
sols (OCSGE). Les fiches publiques disent la première sans la faire passer pour
la seconde.

**La dernière année est provisoire.** Le Cerema le publie lui-même : le flux le
plus récent (2024, du 1er janvier 2024 au 1er janvier 2025) est sous-estimé —
les fichiers fonciers enregistrent les constructions avec retard — et sera
révisé au millésime suivant. La fiche le dit ; le pipeline archive les
révisions.

**Pas de flux négatifs — mais un résidu d'arrondi.** Aucun flux annuel ni
aucune surface d'habitat n'est négatif (vérifié sur tout le millésime 2025) :
la consommation est un flux brut, la renaturation n'en est pas déduite, et un
négatif sur ce qui est publié changerait la définition — la lecture le refuse.
La destination « inconnue », elle, porte 31 cellules à −1 ou −2 m² : le résidu
d'arrondi de la source quand elle solde le flux par différence. Toléré jusqu'à
−10 m², refusé au-delà.

**La fenêtre bouge avec les millésimes.** Le millésime 2024 couvrait
2009-2024 ; le millésime 2025 couvre 2011-2025 — les deux premières années ont
été retirées. Les colonnes sont donc figées sur la fenêtre relevée : un flux
annuel inattendu (naf25art26, naf09art10…) arrête la lecture, c'est un nouveau
millésime qu'il faut regarder — nouvelle URL, nouveau témoin — avant de
recharger.

**Toutes les communes sauf dix-neuf.** Le fichier est exactement au COG 2025
(zéro code hors référentiel, vérifié sur les 34 856 communes) ; Paris, Lyon et
Marseille y sont en communes entières, sans arrondissements. Manquent Mayotte
(17 communes, hors fichiers fonciers) et deux îles du Finistère sans cadastre,
Île-de-Sein et Île-Molène. Les zéros sont significatifs : 730 communes n'ont
rien consommé en quatorze ans.

**Le contrôle qui bloque** tient deux prises. Les identités internes d'abord,
exactes sur tout le fichier (vérifié : écart nul) : la somme des quatorze flux
annuels doit retomber sur le total 2011-2025 publié dans la même ligne, et
chaque flux sur la somme de ses six destinations (habitat, activité, mixte,
routier, ferroviaire, inconnue) — une colonne recomposée casse l'une ou l'autre
partout à la fois. Le témoin figé ensuite, relevé à la main : la somme des
534 communes de la Gironde sur le flux 2023. Et le fichier entier a été
rapproché du chiffre que le portail publie — 15 119 ha consommés en 2024
(actualité du 30 juin 2026, relevée le 7 août 2026) : la somme nationale du
fichier fait 151 186 579 m², soit 15 118,7 ha.

Usage : python -m plateforme.normalize.artificialisation [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
import json
import re

from plateforme import couverture, entrepot, revisions
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "cerema-conso-espaces-communal"
SOURCE = "cerema-artificialisation"

# L'URL stable de la ressource `conso_com.csv` sur data.gouv.fr (jeu Cerema
# « Consommation d'espaces naturels, agricoles et forestiers du 1er janvier
# 2011 au 1er janvier 2025 », licence Ouverte 2.0). Elle redirige vers le
# fichier courant ; le Cerema révise la ressource en place au sein d'un
# millésime (créée le 11 mai 2026, révisée le 24 juillet 2026) et publie un
# nouveau jeu — nouvelle URL — à chaque millésime.
RESSOURCE = "b258feec-f8ff-4e0a-93b3-baf1fe46ef66"
URL = f"https://www.data.gouv.fr/fr/datasets/r/{RESSOURCE}"

THEME = "environnement"

# La fenêtre du millésime 2025 : quatorze flux annuels, chacun du 1er janvier N
# au 1er janvier N+1 — le portail dit « l'année 2024 » pour naf24art25, la
# période publiée est donc l'année N. Figée exprès : la fenêtre a déjà bougé
# (le millésime précédent couvrait 2009-2024) et bougera encore.
PREMIERE, DERNIERE = 2011, 2024
ANNEES = range(PREMIERE, DERNIERE + 1)

# Les six destinations que la source ventile ; leur somme fait exactement le
# flux. « inc » est la destination inconnue — elle existe, l'habitat n'est
# jamais deviné.
DESTINATIONS = ("hab", "act", "mix", "rou", "fer", "inc")

# Le total 2011-2025 publié dans la même ligne : la première prise du contrôle.
TOTAL = "naf11art25"

CODE_COMMUNE = re.compile(r"\d{5}|2[AB]\d{3}")

# Un flux annuel : nafNNartMM avec MM = NN + 1. Les agrégats pluriannuels du
# fichier (naf11art21, naf21art25…) n'en sont pas et sont ignorés ; un flux
# annuel hors fenêtre est un changement de millésime, pas une colonne de plus.
FLUX_ANNUEL = re.compile(r"naf(\d{2})art(\d{2})")

# Le témoin figé, relevé à la main sur le fichier du 24 juillet 2026 (relevé le
# 7 août 2026) : la somme des 534 communes de la Gironde sur le flux 2023 — la
# dernière année consolidée, pas la provisoire. Les identités internes ne
# voient pas un fichier tronqué ; cette somme, si. Le même jour, la somme
# nationale du flux 2024 (151 186 579 m²) a été rapprochée du chiffre publié
# par le portail : 15 119 ha (actualité du 30 juin 2026).
TEMOIN_DEPARTEMENT = "33"
TEMOIN_ANNEE = 2023
TEMOIN_GIRONDE = 3_117_494.0
TEMOIN_TOLERANCE = 0.005

# Les identités internes sont exactes (écart maximal mesuré : 0 m² sur tout le
# fichier) ; 1 m² absorbe un éventuel arrondi futur sans rien laisser passer.
TOLERANCE_IDENTITE = 1.0

# La destination « inconnue » du millésime 2025 porte 31 cellules à −1 ou
# −2 m² : le résidu d'arrondi de la source quand elle solde le flux par
# différence des autres destinations. Ce n'est pas une renaturation — au-delà
# de ce bruit, un négatif change la mesure et la lecture s'arrête.
RESIDU_DESTINATION = 10.0

INDICATEURS = {
    "cerema_espaces_consommes": (
        "Espaces naturels, agricoles et forestiers consommés",
        "Les terrains naturels, agricoles ou forestiers de la commune devenus"
        " des espaces urbanisés dans l'année : logements, entreprises, routes."
        " En mètres carrés, mesurés sur les fichiers fonciers. La dernière"
        " année est provisoire. Ce n'est pas l'« artificialisation » au sens"
        " strict de la loi, qui se mesurera autrement.",
        "Flux annuel de consommation d'ENAF du 1er janvier N au 1er janvier"
        " N+1, fichiers fonciers",
    ),
    "cerema_espaces_consommes_habitat": (
        "Espaces consommés pour l'habitat",
        "Les terrains naturels, agricoles ou forestiers de la commune devenus"
        " des espaces urbanisés dans l'année pour y construire des logements."
        " En mètres carrés, mesurés sur les fichiers fonciers. C'est la"
        " première destination : près de deux tiers du total national. La"
        " dernière année est provisoire.",
        "Flux annuel de consommation d'ENAF à destination d'habitat, du"
        " 1er janvier N au 1er janvier N+1, fichiers fonciers",
    ),
}

TECHNIQUE = (
    "Consommation d'espaces naturels, agricoles et forestiers (ENAF) au sens"
    " de l'article 194 de la loi Climat et résilience — création ou extension"
    " effective d'espaces urbanisés —, mesurée par le Cerema sur les fichiers"
    " fonciers pour le portail de l'artificialisation. **Ce n'est pas"
    " l'artificialisation nette** au sens de la nomenclature OCSGE, qui prendra"
    " le relais après 2031 ; la renaturation n'est pas déduite, le flux est"
    " brut et jamais négatif. Unité : le mètre carré. Flux annuels du"
    " 1er janvier N au 1er janvier N+1, publiés sous l'année N ; fenêtre"
    " 2011-2024 du millésime 2025 (le millésime précédent couvrait 2009-2024 :"
    " la fenêtre glisse). **Le flux de la dernière année est provisoire** —"
    " sous-estimé par le retard d'enregistrement des fichiers fonciers — et"
    " révisé au millésime suivant. La destination (habitat, activité, mixte,"
    " routier, ferroviaire) est parfois inconnue : l'habitat n'est jamais"
    " deviné, la somme des destinations fait exactement le flux. Codes au"
    " COG 2025, Paris, Lyon et Marseille en communes entières ; absents :"
    " Mayotte et deux îles du Finistère sans cadastre (Île-de-Sein,"
    " Île-Molène). Un zéro est significatif : rien n'a été consommé."
    " Objectif national : réduire de moitié la consommation 2021-2031 par"
    " rapport à 2011-2021."
)


class ConsoIncoherente(RuntimeError):
    """Les surfaces lues ne se recoupent plus — entre colonnes, ou avec le témoin figé."""


def _flux(annee: int) -> str:
    return f"naf{annee % 100}art{(annee + 1) % 100}"


def _destination(annee: int, dest: str) -> str:
    return f"art{annee % 100}{dest}{(annee + 1) % 100}"


def lire(contenu: bytes) -> dict[str, dict]:
    """-> {code commune: {"total": m², "annees": {année: (flux, habitat, somme
    des six destinations)}}}.

    Les colonnes sont figées sur la fenêtre 2011-2024 : une colonne attendue
    absente ou un flux annuel inattendu (naf25art26 : nouveau millésime,
    naf09art10 : fenêtre recomposée) arrête la lecture — il faut regarder la
    nouvelle parution avant de la recharger. Une surface négative aussi : la
    consommation est un flux brut, un négatif changerait la mesure.
    """
    lecteur = csv.DictReader(io.StringIO(contenu.decode("utf-8-sig")))
    colonnes = lecteur.fieldnames or []
    attendues = (
        ["idcom", TOTAL]
        + [_flux(annee) for annee in ANNEES]
        + [_destination(annee, dest) for annee in ANNEES for dest in DESTINATIONS]
    )
    absentes = [nom for nom in attendues if nom not in colonnes]
    if absentes:
        raise ValueError(
            f"colonnes {absentes[:6]} absentes du fichier : la source a changé"
            " de format, il faut regarder avant de recharger"
        )
    connues = {_flux(annee) for annee in ANNEES}
    inattendus = [
        nom for nom in colonnes
        if (paire := FLUX_ANNUEL.fullmatch(nom))
        and int(paire.group(2)) == int(paire.group(1)) + 1
        and nom not in connues
    ]
    if inattendus:
        raise ValueError(
            f"flux annuels inattendus {inattendus} : la fenêtre du fichier a"
            " bougé — nouveau millésime, nouveau témoin à relever avant de"
            " recharger"
        )

    conso: dict[str, dict] = {}
    for rangee in lecteur:
        code = (rangee["idcom"] or "").strip()
        if not CODE_COMMUNE.fullmatch(code):
            raise ValueError(
                f"code commune « {code} » : cinq caractères du COG attendus,"
                " le fichier ne porte ni cumul ni code masqué"
            )
        annees = {}
        for annee in ANNEES:
            flux = float(rangee[_flux(annee)])
            parts = [float(rangee[_destination(annee, d)]) for d in DESTINATIONS]
            if flux < 0 or parts[0] < 0 or any(p < -RESIDU_DESTINATION for p in parts):
                raise ValueError(
                    f"commune {code}, flux {annee} : surface négative — la"
                    " consommation d'ENAF est un flux brut, la renaturation"
                    " n'en est pas déduite ; la mesure a changé de définition"
                    " (seul le résidu d'arrondi de la destination inconnue,"
                    f" jusqu'à −{RESIDU_DESTINATION:.0f} m², est toléré)"
                )
            annees[annee] = (flux, parts[0], sum(parts))
        conso[code] = {"total": float(rangee[TOTAL]), "annees": annees}
    return conso


def controler(conso: dict[str, dict]) -> dict:
    """Le contrôle qui bloque : identités internes, puis témoin girondin.

    Les identités sont exactes dans la source : la somme des quatorze flux
    retombe sur le total 2011-2025 de la même ligne, chaque flux sur la somme
    de ses six destinations. Le témoin, lui, est une somme relevée à la main :
    la seule chose qu'une lecture tronquée ne peut pas laisser en place.
    """
    if not conso:
        raise ConsoIncoherente("aucune commune lue")
    for code, ligne in conso.items():
        somme = sum(flux for flux, _, _ in ligne["annees"].values())
        if abs(somme - ligne["total"]) > TOLERANCE_IDENTITE:
            raise ConsoIncoherente(
                f"commune {code} : la somme des flux annuels fait {somme:.0f} m²"
                f" pour un total 2011-2025 de {ligne['total']:.0f} m². L'identité"
                " est exacte dans la source — colonne recomposée ou fenêtre"
                " décalée."
            )
        for annee, (flux, _, destinations) in ligne["annees"].items():
            if abs(destinations - flux) > TOLERANCE_IDENTITE:
                raise ConsoIncoherente(
                    f"commune {code}, flux {annee} : les six destinations"
                    f" somment à {destinations:.0f} m² pour un flux de"
                    f" {flux:.0f} m². L'habitat ne décrit plus le même terrain"
                    " que le total — colonne recomposée."
                )

    temoin = sum(
        ligne["annees"][TEMOIN_ANNEE][0]
        for code, ligne in conso.items()
        if code.startswith(TEMOIN_DEPARTEMENT)
    )
    if abs(temoin - TEMOIN_GIRONDE) > TEMOIN_TOLERANCE * TEMOIN_GIRONDE:
        raise ConsoIncoherente(
            f"somme de la Gironde sur le flux {TEMOIN_ANNEE} :"
            f" {temoin:.0f} m² contre {TEMOIN_GIRONDE:.0f} attendus"
            f" (±{100 * TEMOIN_TOLERANCE:.1f} %). Les identités internes ne"
            " voient pas un fichier tronqué ; ce témoin, relevé à la main, si."
        )

    return {
        "communes": len(conso),
        "premiere_annee": PREMIERE,
        "derniere_annee": DERNIERE,
        "temoin_gironde_m2": temoin,
        "surface_totale_ha": round(
            sum(ligne["total"] for ligne in conso.values()) / 10_000, 1
        ),
    }


COLONNES = ("value",)


def lignes_a_ecrire(conso: dict[str, dict]) -> list[tuple]:
    """Deux indicateurs par commune et par année, zéros compris.

    Un zéro est une information — rien n'a été consommé — pas une absence.
    Rien à replier : la source publie Paris, Lyon et Marseille en communes
    entières, sans arrondissements (vérifié sur le millésime 2025).
    """
    lignes = []
    for code, ligne in sorted(conso.items()):
        for annee, (flux, habitat, _) in sorted(ligne["annees"].items()):
            lignes.append(
                ("cerema_espaces_consommes", "commune", code, MILLESIME,
                 str(annee), flux)
            )
            lignes.append(
                ("cerema_espaces_consommes_habitat", "commune", code, MILLESIME,
                 str(annee), habitat)
            )
    return lignes


def surface_par_maille(lignes: list[tuple]) -> dict[str, float]:
    """La surface consommée par maille, pour les deux côtés de la couverture.

    La couverture se mesure en mètres carrés consommés, pas en communes : une
    commune perdue pèse sa surface, pas un trente-cinq millième du compte.
    Seul le flux total entre — l'habitat en est une part, l'additionner
    compterait deux fois le même terrain.
    """
    par_maille: dict[str, float] = {}
    for ind, niveau, _, _, _, valeur in lignes:
        if ind == "cerema_espaces_consommes":
            par_maille[niveau] = par_maille.get(niveau, 0.0) + valeur
    return par_maille


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for identifiant, (libelle, publique, formule) in sorted(INDICATEURS.items()):
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, ?,
                        'mètres carrés ; le flux de la dernière année est provisoire',
                        'observed', array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (publique, TECHNIQUE, formule),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, geo_levels, time_granularity, published)
                values (?, ?, ?, ?, ?, 'm2', true, array['commune'], 'annuelle', true)
                on conflict (indicator_id) do update set unit = excluded.unit,
                    definition_id = excluded.definition_id,
                    label_fr = excluded.label_fr,
                    theme = excluded.theme, published = true
                """,
                (identifiant, DATASET, definition, THEME, libelle),
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
        entrepot.etape(f"{len(contenu) // 1024 // 1024} Mo reçus")
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "conso-espaces-communal.csv",
            contenu, URL, "text/csv",
        )
        conso = lire(contenu)
        entrepot.etape(f"{len(conso)} communes lues, flux {PREMIERE}-{DERNIERE}")
        verifies = controler(conso)
        candidates = lignes_a_ecrire(conso)
        gardees, ecartes = filtrer_territoires_connus(conn, candidates)
        ecrites, revisees = revisions.remplacer(
            conn, run_id, sorted(INDICATEURS), COLONNES, gardees
        )
        parts = couverture.controler(
            surface_par_maille(candidates), surface_par_maille(gardees)
        )
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'identites_flux_et_temoin_gironde', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "ecrites": ecrites,
                "hors_referentiel": len(ecartes),
                "couverture": {n: round(p, 4) for n, p in sorted(parts.items())},
            })),
        )
        conn.commit()
        entrepot.finish_run(
            conn, run_id, "success", rows_read=len(conso), rows_written=ecrites
        )
        print(
            f"conso ENAF : {ecrites} observations sur {verifies['communes']}"
            f" communes, flux {PREMIERE}-{DERNIERE},"
            f" témoin Gironde {verifies['temoin_gironde_m2']:.0f} m²,"
            f" {revisees} valeurs révisées, {len(ecartes)} codes hors référentiel"
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
