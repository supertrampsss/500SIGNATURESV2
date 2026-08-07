"""Logements autorisés et commencés par commune (Sitadel, SDES).

« Combien de logements construit-on chez moi ? » — la question a deux réponses,
et les confondre est l'erreur la plus courante sur ce jeu. Un **logement
autorisé** est un permis délivré ; un **logement commencé** est un chantier
ouvert. Entre les deux il y a le financement, le recours du voisin, la faillite
du promoteur : en 2025, 370 546 logements ont été autorisés et 239 618
commencés. Les additionner compterait deux fois les mêmes logements, et prendre
l'autorisation pour de la construction en surestimerait le tiers.

**Ce fichier ne se compare pas aux séries en date réelle.** Sitadel est publié
sous deux dates. Ici, la **date de prise en compte** : le mois où le centre
instructeur a saisi le mouvement dans l'application. Ailleurs, la **date
réelle** estimée : le mois où l'autorisation a été délivrée, corrigée des
saisies tardives. Les deux ne coïncident pas — 370 546 logements autorisés en
2025 en date de prise en compte contre 355 169 dans la série annuelle
départementale en date réelle, soit 4,3 % d'écart. Ce sont deux concepts, pas
une erreur de l'un des deux ; rapprocher les deux séries fabriquerait une
révision qui n'existe pas.

**Les surfaces ne sont pas chargées.** Elles existent dans ce fichier (SDP_AUT,
SDP_COM) et le connecteur ne les demande même pas : la question posée est un
nombre de logements. La retenue vaut aussi avertissement — la colonne de
surface du fichier **annuel départemental** de la même source est corrompue,
1 782 m² par logement au niveau national contre 75,9 m² dans ce fichier-ci. Une
seule des deux valeurs peut être vraie.

**Le contrôle qui bloque.** La source publie cinq types de logement, dont un
total : « Tous Logements » doit être exactement la somme de « Individuel pur »,
« Individuel groupe », « Collectif » et « Residence ». Le contrôle porte sur le
couple (mois, commune), la maille la plus fine du fichier — 419 340 couples pour
le seul exercice 2025 — et couvre donc toutes les mailles au-dessus. Une
modalité nouvelle, un libellé qui bouge, une colonne décalée : rien de tout cela
ne passe.

**Paris, Lyon et Marseille ne sont pas éclatés** dans cette source, à la
différence du répertoire des logements sociaux : la ligne porte 75056, pas
75101. Rien n'est donc rattaché, et le contrôle de couverture le vérifie.

Usage : python -m plateforme.normalize.construction [--store r2:plateforme-raw]
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

DATASET = "sitadel-construction"
SOURCE = "sdes"
BASE = "https://data.statistiques.developpement-durable.gouv.fr/dido/api/v1"
FICHIER = "577a8a66-4157-4787-b00a-031b61afea61"

# Les six colonnes demandées sur les huit servies. Les deux surfaces restent chez
# le producteur : elles ne sont pas publiées, et un exercice pèse déjà 92 Mo.
COLONNES_SOURCE = ("ANNEE", "MOIS", "CODE_INSEE", "TYPE_LGT", "LOG_AUT", "LOG_COM")

# La source couvre 2013-01 -> aujourd'hui, un fichier de 85 Mo par exercice.
# Charger les treize demande une heure de runner et 1,2 Go de transfert ; le
# quota d'ingestion a déjà sauté une fois aujourd'hui pour moins que ça. On
# entre sur sept exercices, ce qui suffit à voir un cycle du bâtiment, et
# remonter dans le temps est un changement d'une ligne.
PREMIERE_ANNEE = 2019

TOUS = "Tous Logements"
TYPES = ("Individuel pur", "Individuel groupe", "Collectif", "Residence")

# Le rang dit quelle colonne du fichier porte l'indicateur : LOG_AUT puis LOG_COM.
INDICATEURS = {
    "sitadel_logements_autorises": (
        "Logements autorisés",
        "Le nombre de logements dont la construction a été autorisée dans la"
        " commune pendant l'année. Une autorisation n'est pas un chantier : le"
        " permis peut n'être jamais suivi de travaux. Ne s'ajoute pas aux"
        " logements commencés, qui décrivent les mêmes projets plus tard.",
        0,
    ),
    "sitadel_logements_commences": (
        "Logements commencés",
        "Le nombre de logements dont le chantier a été ouvert dans la commune"
        " pendant l'année. C'est la construction réelle, plus basse que les"
        " autorisations : en 2025, 239 618 logements commencés pour 370 546"
        " autorisés.",
        1,
    ),
}

THEME = "logement"

TECHNIQUE = (
    "Base Sitadel (SDES), fichier communal mensuel des logements autorisés et"
    " commencés **en date de prise en compte** administrative, type « Tous"
    " Logements », agrégé par ce site aux douze mois de l'exercice. Les données"
    " en date de prise en compte ne sont pas comparables aux séries estimées en"
    " date réelle diffusées par ailleurs : le producteur l'écrit, et l'écart"
    " mesuré sur 2025 est de 4,3 % (370 546 logements autorisés contre"
    " 355 169). Autorisé et commencé sont deux moments d'un même projet et deux"
    " indicateurs distincts : ils ne s'additionnent pas. Seuls les exercices"
    " dont les douze mois sont servis sont publiés. Les surfaces de plancher de"
    " la source ne sont pas chargées. La géographie est celle de la source, qui"
    " code chaque commune telle qu'elle existait au moment du mouvement : les"
    " communes fusionnées depuis gardent leur code d'époque et sortent du"
    " référentiel courant — 1,5 % des logements autorisés de 2013 — et une"
    " commune nouvelle ne porte, avant sa création, que le territoire de la"
    " commune qui lui a laissé son code."
)


class TypesDivergents(RuntimeError):
    """« Tous Logements » n'est pas la somme des quatre types de logement."""


def url(annee: int) -> str:
    """L'export CSV d'un exercice, colonnes utiles seulement.

    La syntaxe de filtre de l'API DiDo est `champ=eq:valeur` : sans le préfixe
    `eq:`, le serveur répond 400 et le connecteur ne charge rien.
    """
    return (
        f"{BASE}/datafiles/{FICHIER}/csv?ANNEE=eq:{annee}"
        f"&columns={','.join(COLONNES_SOURCE)}&withColumnName=true"
    )


def url_fiche() -> str:
    return f"{BASE}/datafiles/{FICHIER}"


def derniere_annee(fiche: bytes) -> int:
    """Le dernier exercice servi, lu sur la fiche du fichier.

    Le figer dans le code arrêterait la série sans rien dire le jour où la
    source avance d'un an.
    """
    return int(json.loads(fiche)["temporal_coverage"]["end"][:4])


def lire(contenu: bytes):
    """-> (année, mois, code commune, type, autorisés, commencés), ligne à ligne.

    Un générateur, et non une liste : un exercice pèse 2,1 millions de lignes et
    le connecteur en charge quatorze. Aucune n'a besoin d'être gardée après avoir
    été comptée.
    """
    lecteur = csv.DictReader(io.StringIO(contenu.decode("utf-8-sig")), delimiter=";")
    for rang in lecteur:
        yield (
            rang["ANNEE"].strip(),
            rang["MOIS"].strip(),
            rang["CODE_INSEE"].strip(),
            rang["TYPE_LGT"].strip(),
            int(rang["LOG_AUT"]),
            int(rang["LOG_COM"]),
        )


def compter(lignes) -> tuple[dict, dict, int]:
    """-> (annuels, mensuels, lignes lues).

    `annuels[(année, commune)] = [autorisés, commencés]` : ce qui sera publié,
    pris sur les seules lignes « Tous Logements ».

    `mensuels[(année, mois, commune)] = [total_aut, total_com, somme_aut,
    somme_com]` : les deux côtés du contrôle bloquant, à la maille la plus fine
    du fichier. Tout libellé qui n'est pas le total tombe dans la somme — une
    sixième modalité, ou un total renommé, fait diverger le contrôle au lieu de
    passer inaperçu.
    """
    annuels: dict[tuple[str, str], list[int]] = defaultdict(lambda: [0, 0])
    mensuels: dict[tuple[str, str, str], list[int]] = defaultdict(lambda: [0, 0, 0, 0])
    lues = 0
    for annee, mois, code, type_logement, autorises, commences in lignes:
        lues += 1
        cellule = mensuels[(annee, mois, code)]
        if type_logement == TOUS:
            annuel = annuels[(annee, code)]
            annuel[0] += autorises
            annuel[1] += commences
            cellule[0] += autorises
            cellule[1] += commences
        else:
            cellule[2] += autorises
            cellule[3] += commences
    return dict(annuels), dict(mensuels), lues


def controler(mensuels: dict) -> dict:
    """Contrôle bloquant : le total est la somme des quatre types de logement.

    Vérifié commune par commune et mois par mois, c'est-à-dire à la maille la
    plus fine que la source publie : ce qui tient là tient à toutes les mailles
    au-dessus, alors qu'un contrôle national laisserait deux communes se
    compenser.
    """
    if not mensuels:
        raise TypesDivergents("aucune ligne lue")
    ecarts = {
        cle: (valeurs[0] - valeurs[2], valeurs[1] - valeurs[3])
        for cle, valeurs in mensuels.items()
        if valeurs[0] != valeurs[2] or valeurs[1] != valeurs[3]
    }
    if ecarts:
        cle, (autorises, commences) = next(iter(sorted(ecarts.items())))
        raise TypesDivergents(
            f"{len(ecarts)} couples (mois, commune) où « {TOUS} » n'est pas la"
            f" somme des quatre types de logement, par exemple {cle} :"
            f" {autorises:+d} autorisé(s), {commences:+d} commencé(s) d'écart."
        )
    return {
        "couples_verifies": len(mensuels),
        "logements_autorises": sum(valeurs[0] for valeurs in mensuels.values()),
        "logements_commences": sum(valeurs[1] for valeurs in mensuels.values()),
    }


def exercices_complets(mensuels: dict) -> set[str]:
    """Les années dont les douze mois sont servis.

    La source va jusqu'au mois dernier : publier l'année en cours à côté des
    précédentes montrerait un effondrement de la construction qui n'est que le
    calendrier.
    """
    mois_par_an: dict[str, set[str]] = defaultdict(set)
    for annee, mois, _ in mensuels:
        mois_par_an[annee].add(mois)
    return {annee for annee, mois in mois_par_an.items() if len(mois) == 12}


def par_commune(annuels: dict, complets: set[str]) -> list[tuple]:
    """-> les observations annuelles, par indicateur et par commune."""
    return [
        (identifiant, "commune", code, annee, float(valeurs[rang]))
        for (annee, code), valeurs in sorted(annuels.items())
        if annee in complets
        for identifiant, (_, _, rang) in sorted(INDICATEURS.items())
    ]


def masse_par_maille(candidates) -> dict[str, float]:
    """Les logements autorisés écrits, pour les deux côtés de la couverture.

    La couverture se mesure en logements et non en codes : trois communes
    perdues ne pèsent rien si elles n'ont rien construit, et tout si l'une
    d'elles est Paris.
    """
    par_maille: dict[str, float] = defaultdict(float)
    for identifiant, niveau, _, _, valeur in candidates:
        if identifiant == "sitadel_logements_autorises":
            par_maille[niveau] += valeur
    return dict(par_maille)


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for identifiant, (libelle, publique, _) in sorted(INDICATEURS.items()):
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, 'Somme des douze mois de l''exercice, type « Tous Logements »',
                        'logements', 'observed', array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (publique, TECHNIQUE),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, geo_levels, time_granularity, published)
                values (?, ?, ?, ?, ?, 'count', true, array['commune'], 'annuelle', true)
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


COLONNES = ("value",)


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        garde_fou_volume(conn)
        fiche = telecharger(url_fiche(), timeout=120)
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "sitadel-fiche.json", fiche,
            url_fiche(), "application/json",
        )
        derniere = derniere_annee(fiche)
        entrepot.etape(f"exercices {PREMIERE_ANNEE} à {derniere}, un fichier chacun")

        annuels: dict[tuple[str, str], list[int]] = {}
        complets: set[str] = set()
        verifies = {"couples_verifies": 0, "logements_autorises": 0, "logements_commences": 0}
        lus = 0
        # Un exercice à la fois : le contrôle mensuel porte sur 419 340 couples
        # par année, et rien n'oblige à garder ceux de l'année précédente pour
        # vérifier celle-ci.
        for annee in range(PREMIERE_ANNEE, derniere + 1):
            adresse = url(annee)
            contenu = telecharger(adresse, timeout=900)
            entrepot.record_asset(
                conn, store, run_id, DATASET, SOURCE, f"sitadel-{annee}.csv", contenu,
                adresse, "text/csv",
            )
            annuels_annee, mensuels, lues = compter(lire(contenu))
            controles = controler(mensuels)
            annuels.update(annuels_annee)
            complets |= exercices_complets(mensuels)
            lus += lues
            for cle, valeur in controles.items():
                verifies[cle] += valeur
            entrepot.etape(
                f"{annee} : {lues} lignes, {controles['couples_verifies']} couples"
                f" (mois × commune) vérifiés"
            )

        candidates = par_commune(annuels, complets)
        gardees, ecartes = filtrer_territoires_connus(conn, candidates)
        lignes = [
            (identifiant, niveau, code, MILLESIME, annee, valeur)
            for identifiant, niveau, code, annee, valeur in gardees
        ]
        ecrites, revisees = revisions.remplacer(
            conn, run_id, sorted(INDICATEURS), COLONNES, lignes
        )
        # Après l'écriture, avant la validation : un refus laisse l'entrepôt
        # intact. Les communes fusionnées depuis 2013 gardent leur code d'époque
        # et sortent ici — c'est ce que ce contrôle chiffre.
        parts = couverture.controler(
            masse_par_maille(candidates), masse_par_maille(gardees)
        )
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'tous_logements_est_la_somme_des_quatre_types',
                    'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "exercices_complets": sorted(complets),
                "hors_referentiel": len(ecartes),
                "couverture": {n: round(p, 4) for n, p in sorted(parts.items())},
            })),
        )
        conn.commit()
        entrepot.finish_run(conn, run_id, "success", rows_read=lus, rows_written=ecrites)
        annees = sorted(complets)
        print(
            f"construction : {ecrites} observations, exercices {annees[0]}-{annees[-1]},"
            f" {verifies['couples_verifies']} couples (mois × commune) où le total"
            f" est la somme des quatre types, {verifies['logements_autorises']}"
            f" logements autorisés et {verifies['logements_commences']} commencés"
            f" sur la période, {revisees} révisées"
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
