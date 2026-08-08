"""Demandeurs d'emploi inscrits à France Travail, commune par commune (Dares).

Le site portait déjà deux chiffres du chômage, aucun à la commune : le taux
localisé (BIT, départemental) et les chômeurs du recensement (déclaratif).
Celui-ci est le troisième monde : les **inscrits** à France Travail en
catégories A, B, C. Trois définitions, trois chiffres, et aucun ne se substitue
aux autres — la fiche le dit, sans quoi le lecteur prendrait l'un pour l'autre.

**Une moyenne du quatrième trimestre, pas un stock au 31 décembre.** La série
ne publie que les T4 (2015-T4 → 2024-T4) ; chaque valeur est la moyenne des
trois fins de mois d'octobre à décembre. La période publiée est l'année, et la
fiche dit ce que « 2024 » recouvre vraiment.

**Paris, Lyon et Marseille sont publiés deux fois par la source** : la commune
entière *et* ses arrondissements. Vérifié sur 2024-T4 : Paris 75056 vaut
196 995, exactement la somme de ses vingt arrondissements. Il n'y a donc rien à
replier via `commune_mere` — replier *ajouterait* les arrondissements à une
commune déjà servie et doublerait Paris. Les arrondissements sont écartés.

**Rupture attendue en 2025.** La loi pour le plein emploi inscrit
automatiquement les bénéficiaires du RSA à France Travail depuis le
1er janvier 2025 : les inscriptions gonflent sans que le marché du travail ait
bougé. Le jour où la source publiera 2025-T4, la série cassera — c'est écrit
dans la définition technique pour que le lecteur de 2026 le trouve encore.

**Le contrôle qui bloque** ne compare pas la source à elle-même : il tient deux
prises indépendantes. L'identité interne d'abord — Hommes + Femmes doit
retomber sur Total pour chaque commune-date, à l'arrondi près (la Dares
arrondit chaque compte au multiple de 5) : une colonne décalée ou un fichier
amputé d'un sexe la casse partout à la fois. Le témoin figé ensuite — la somme
des communes de la Gironde au 2024-T4 vaut 142 570, relevée à la main sur
l'API : une lecture tronquée laisse l'identité parfaite et fait fondre cette
somme.

Usage : python -m plateforme.normalize.defm [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
import json
import re

from plateforme import couverture, entrepot, revisions
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, commune_mere, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "dares-defm-communal"
SOURCE = "data-dares"
JEU = "dares_defm_communales-brutes"
BASE = f"https://data.dares.travail-emploi.gouv.fr/api/explore/v2.1/catalog/datasets/{JEU}"

# `use_labels` : l'export sert les intitulés humains (« Code commune ») plutôt
# que les noms techniques. C'est le format relevé et figé dans la fixture ; un
# changement d'intitulé arrête la lecture au lieu de servir des colonnes vides.
URL = f"{BASE}/exports/csv?use_labels=true"

# Les colonnes lues sur les douze du fichier, par leur intitulé exact. Région,
# département et libellés sont redondants avec le référentiel géographique.
COLONNES_LUES = {
    "date": "Date",
    "commune": "Code commune",
    "type": "Type de données",
    "categorie": "Catégorie",
    "sexe": "Sexe",
    "tranche": "Tranche d'âge",
    "valeur": "Nombre de demandeurs d'emploi",
}

# Les seules valeurs que le fichier connaît. En voir une autre n'est pas un cas
# à absorber : une catégorie « A » seule ou des données CVS changeraient la
# définition de l'indicateur, il faut regarder avant de recharger.
CATEGORIE = "ABC"
TYPE = "Brutes"
SEXES = ("Total", "Hommes", "Femmes")
TRANCHE_TOTALE = "Total"

# Le code commune des lignes de cumul du fichier (France métropolitaine,
# non-localisés…) : pas une commune, écarté à la lecture.
CUMUL = "Total"

# La source ne publie que les quatrièmes trimestres : la valeur est une moyenne
# d'octobre à décembre, et la période publiée est l'année. Un « 2026-T1 » qui
# apparaîtrait serait une autre série — moyenne annuelle ? stock ? — pas une
# ligne de plus.
DATE = re.compile(r"(\d{4})-T4")

INDICATEUR = "dares_defm_abc"
THEME = "emploi"
UNITE = "count"

# Chaque compte est arrondi au multiple de 5 par la Dares. Hommes + Femmes ne
# retombe donc pas exactement sur Total : trois arrondis indépendants laissent
# jusqu'à 7,5 d'écart. Au-delà de 10, ce n'est plus de l'arrondi.
TOLERANCE_IDENTITE = 5 + 5

# … sauf pour Paris, Lyon et Marseille : leurs valeurs communales sont des
# sommes d'arrondissements chacun arrondi à 5, et l'écart cumulé atteint 20 sur
# Marseille (relevé sur le fichier). Leurs arrondissements, eux, passent le
# contrôle strict — la cohérence des trois communes est portée par eux.
PLM = ("75056", "69123", "13055")

# Le témoin figé, relevé à la main sur l'API le 7 août 2026 : la somme des
# 534 communes de la Gironde au 2024-T4. Une lecture tronquée laisse toutes les
# identités internes parfaites ; elle ne peut pas laisser cette somme en place.
TEMOIN_DEPARTEMENT = "33"
TEMOIN_DATE = "2024-T4"
TEMOIN_GIRONDE = 142_570
TEMOIN_TOLERANCE = 0.005

PUBLIQUE = (
    "Le nombre d'inscrits à France Travail en catégories A, B et C — sans"
    " emploi ou en activité réduite —, en moyenne sur le quatrième trimestre,"
    " pas au 31 décembre. Arrondi à cinq près. Ce n'est ni le chômage au sens"
    " du BIT, ni celui déclaré au recensement."
)

TECHNIQUE = (
    "Demandeurs d'emploi en fin de mois (DEFM) inscrits à France Travail en"
    " catégories A, B et C (tenus à des actes positifs de recherche d'emploi,"
    " sans emploi ou en activité réduite), moyenne du quatrième trimestre —"
    " et non stock au 31 décembre. Données brutes, non corrigées des"
    " variations saisonnières ; chaque valeur est arrondie par la Dares au"
    " multiple de 5. Codes communes au COG 2024 ; la source publie Paris,"
    " Lyon et Marseille à la fois en commune entière et par arrondissement —"
    " seule la commune est chargée, les additionner la doublerait."
    " **Rupture attendue en 2025** : la loi pour le plein emploi inscrit"
    " automatiquement les bénéficiaires du RSA à France Travail depuis le"
    " 1er janvier 2025, ce qui gonfle les inscriptions à marché du travail"
    " inchangé — le millésime 2025 ne sera pas comparable aux précédents."
    " Ne pas confondre avec le taux de chômage localisé (chômeurs au sens du"
    " BIT, maille départementale) ni avec les chômeurs déclarés au"
    " recensement : les trois populations diffèrent de plusieurs centaines de"
    " milliers de personnes. Série 2015-2024, quatrièmes trimestres seulement."
)

FORMULE = "Moyenne des trois fins de mois du T4 des inscrits en catégories A, B, C"


class DefmIncoherentes(RuntimeError):
    """Les comptes lus ne se recoupent plus — entre sexes, ou avec le témoin figé."""


def lire(contenu: bytes) -> dict[tuple[str, str], dict[str, int]]:
    """-> {(code commune, date): {sexe: inscrits}}, tranche d'âge Total.

    Le détail par âge n'est pas publié — la source ne le croise pas avec le
    sexe, et un indicateur par tranche multiplierait les fiches sans réponse à
    une question que le site pose. Les trois lignes de sexe sont gardées parce
    que le contrôle d'identité en vit ; seul le Total est écrit.
    """
    lecteur = csv.reader(io.StringIO(contenu.decode("utf-8-sig")), delimiter=";")
    entete = {nom.strip(): rang for rang, nom in enumerate(next(lecteur, []))}
    absentes = [nom for nom in COLONNES_LUES.values() if nom not in entete]
    if absentes:
        raise ValueError(
            f"colonnes {absentes} absentes de l'export {sorted(entete)} :"
            " la source a changé d'intitulés, il faut regarder avant de recharger"
        )
    rangs = {cle: entete[nom] for cle, nom in COLONNES_LUES.items()}

    defm: dict[tuple[str, str], dict[str, int]] = {}
    for rangee in lecteur:
        brut = {cle: rangee[rang].strip() for cle, rang in rangs.items()}
        # « Total » — cinq caractères, il passait le contrôle de longueur —
        # n'est pas une commune : le fichier range sous ce même code plusieurs
        # cumuls distingués par le seul libellé (« Total France
        # métropolitaine », « Non localisés en France métropolitaine »…), qui
        # s'écraseraient entre eux dans le dictionnaire et casseraient
        # l'identité des sexes. Relevé sur l'API le 7 août 2026.
        if brut["commune"] == CUMUL:
            continue
        if brut["categorie"] != CATEGORIE or brut["type"] != TYPE:
            raise ValueError(
                f"catégorie « {brut['categorie']} », type « {brut['type']} » :"
                f" le fichier ne devait porter que {CATEGORIE}/{TYPE}, sa"
                " définition a changé"
            )
        if not DATE.fullmatch(brut["date"]):
            raise ValueError(
                f"date « {brut['date']} » : la série ne publiait que des"
                " quatrièmes trimestres, et une autre période n'est pas une"
                " moyenne de T4"
            )
        if brut["sexe"] not in SEXES:
            raise ValueError(f"sexe « {brut['sexe']} » inconnu : colonne décalée ?")
        if len(brut["commune"]) != 5:
            raise ValueError(
                f"code commune « {brut['commune']} » : cinq caractères attendus"
            )
        if brut["tranche"] != TRANCHE_TOTALE or not brut["valeur"]:
            continue
        defm.setdefault((brut["commune"], brut["date"]), {})[brut["sexe"]] = int(
            brut["valeur"]
        )
    return defm


def controler(defm: dict[tuple[str, str], dict[str, int]]) -> dict:
    """Le contrôle qui bloque : identité des sexes, puis témoin girondin.

    L'identité couvre toutes les communes-dates du fichier — hors Paris, Lyon
    et Marseille, dont les valeurs cumulent l'arrondi de leurs arrondissements
    (voir `PLM`). Le témoin, lui, est un chiffre relevé hors du pipeline : la
    seule chose qu'une lecture amputée ne peut pas reproduire.
    """
    if not defm:
        raise DefmIncoherentes("aucun compte lu")
    ecart_maximal, verifiees = 0, 0
    for (code, date), sexes in defm.items():
        if code in PLM or any(sexe not in sexes for sexe in SEXES):
            continue
        ecart = abs(sexes["Hommes"] + sexes["Femmes"] - sexes["Total"])
        if ecart > TOLERANCE_IDENTITE:
            raise DefmIncoherentes(
                f"commune {code}, {date} : Hommes + Femmes ="
                f" {sexes['Hommes'] + sexes['Femmes']} pour un Total de"
                f" {sexes['Total']}, écart {ecart} au-delà de l'arrondi à 5."
                " Les trois lignes ne décrivent plus la même commune —"
                " colonne décalée ou fichier recomposé."
            )
        ecart_maximal, verifiees = max(ecart_maximal, ecart), verifiees + 1
    if not verifiees:
        raise DefmIncoherentes(
            "aucune commune-date ne porte ses trois lignes Total/Hommes/Femmes :"
            " l'identité ne vérifie plus rien"
        )

    temoin = sum(
        sexes["Total"]
        for (code, date), sexes in defm.items()
        if code.startswith(TEMOIN_DEPARTEMENT) and date == TEMOIN_DATE
        and "Total" in sexes
    )
    if abs(temoin - TEMOIN_GIRONDE) > TEMOIN_TOLERANCE * TEMOIN_GIRONDE:
        raise DefmIncoherentes(
            f"somme de la Gironde au {TEMOIN_DATE} : {temoin} inscrits contre"
            f" {TEMOIN_GIRONDE} attendus (±{100 * TEMOIN_TOLERANCE:.1f} %)."
            " L'identité interne ne voit pas un fichier tronqué ; ce témoin,"
            " relevé hors du pipeline, si."
        )

    dates = sorted({date for _, date in defm})
    return {
        "communes": len({code for code, _ in defm}),
        "commune_dates": len(defm),
        "premiere_date": dates[0],
        "derniere_date": dates[-1],
        "identites_verifiees": verifiees,
        "ecart_identite_maximal": ecart_maximal,
        "temoin_gironde": temoin,
    }


COLONNES = ("value",)


def lignes_a_ecrire(defm: dict[tuple[str, str], dict[str, int]]) -> list[tuple]:
    """Seul le Total/Total est publié, à la période « année ».

    Les arrondissements municipaux sont écartés, pas repliés : la source sert
    déjà Paris, Lyon et Marseille en communes entières (75056 vaut exactement
    la somme des vingt arrondissements), et `commune_mere` les y *ajouterait*.
    """
    return [
        (INDICATEUR, "commune", code, MILLESIME, DATE.fullmatch(date).group(1),
         float(sexes["Total"]))
        for (code, date), sexes in sorted(defm.items())
        if "Total" in sexes and commune_mere(code) is None
    ]


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        definition = curseur.execute(
            """
            insert into core.indicator_definitions
                (public_definition, technical_definition, formula, unit_notes,
                 confidence_level, badges)
            values (?, ?, ?, 'demandeurs d''emploi, arrondi au multiple de 5',
                    'observed', array['Officiel','Donnée brute'])
            returning definition_id
            """,
            (PUBLIQUE, TECHNIQUE, FORMULE),
        ).fetchone()[0]
        curseur.execute(
            """
            insert into core.indicators
                (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                 additive, geo_levels, time_granularity, published)
            values (?, ?, ?, ?, 'Inscrits à France Travail (catégories A, B, C)', ?,
                    true, array['commune'], 'annuelle', true)
            on conflict (indicator_id) do update set unit = excluded.unit,
                definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                theme = excluded.theme, published = true
            """,
            (INDICATEUR, DATASET, definition, THEME, UNITE),
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
            conn, store, run_id, DATASET, SOURCE, "defm-communales-brutes.csv",
            contenu, URL, "text/csv",
        )
        defm = lire(contenu)
        entrepot.etape(f"{len(defm)} communes-dates lues, tranche d'âge Total")
        verifies = controler(defm)
        candidates = lignes_a_ecrire(defm)
        gardees, ecartes = filtrer_territoires_connus(conn, candidates)
        ecrites, revisees = revisions.remplacer(
            conn, run_id, [INDICATEUR], COLONNES, gardees
        )
        # La couverture se mesure en inscrits, pas en communes : perdre Paris
        # au référentiel ne pèserait pas un trente-cinq millième du compte,
        # il en pèserait deux cents mille.
        parts = couverture.controler(
            {"commune": sum(ligne[5] for ligne in candidates)},
            {"commune": sum(ligne[5] for ligne in gardees)},
        )
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'identite_sexes_et_temoin_gironde', 'blocker', true, ?)
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
            conn, run_id, "success",
            rows_read=sum(len(sexes) for sexes in defm.values()),
            rows_written=ecrites,
        )
        print(
            f"DEFM ABC : {ecrites} observations sur {verifies['communes']}"
            f" communes, {verifies['premiere_date']} → {verifies['derniere_date']},"
            f" témoin Gironde {verifies['temoin_gironde']} inscrits,"
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
