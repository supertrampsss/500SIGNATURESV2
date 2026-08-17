"""Les retraités, leur pension et leur âge de départ (DREES) vers core.observations.

Le site publiait ce que la vieillesse **coûte** — 426,7 Md€ de prestations, la
première dépense publique française — et rien de ce qu'elle **est** : combien de
retraités, quelle pension, à quel âge, et combien d'actifs cotisent pour eux.
Ce sont les quatre chiffres du débat, et aucun n'était dans l'entrepôt.

**Une série longue, pas un instantané.** Le portail de la DREES diffuse par API
des jeux d'un seul millésime (les neuf « Caractéristiques des retraités » sont
tous de 2016) et une poignée de graphiques. Les séries de 2004 à 2022 vivent
dans les classeurs attachés au jeu « Les effectifs de retraités, montants des
pensions et âges de départ à la retraite » : ce sont des téléchargements
officiels, versionnés par édition, et c'est la seule forme sous laquelle ce
producteur publie l'historique.

**Quatre familles, quatre onglets nommés dans le classeur** :

| Onglet | Ce qu'il porte | Fenêtre |
|---|---|---|
| `1.1-a` | nombre de retraités, tous régimes, par sexe | 2004-2022 |
| `2.1-a` | pension mensuelle moyenne, brute et nette | 2004-2022 |
| `3.1-b` | âge conjoncturel moyen de départ, par sexe | 2004-2022 |
| `Feuil1` | rapport cotisants / retraités | **2004-2016** |

Le rapport cotisants/retraités s'arrête en 2016 chez ce producteur, et le site
l'affiche avec son millésime comme il le fait de tout chiffre : ce n'est pas
une réserve, c'est une date.

**Les colonnes ne sont pas repérées par leur lettre seule.** Un classeur
republié chaque année déplace ses colonnes, et une lecture positionnelle
silencieuse publierait la pension des femmes sous l'intitulé de l'ensemble.
Chaque onglet est donc **contrôlé par une identité** que ses colonnes doivent
vérifier — l'ensemble entre les femmes et les hommes, la somme des sexes égale
à l'ensemble, un âge entre 55 et 70 ans — et le chargement lève plutôt que de
publier une colonne prise pour une autre.

**Deux pensions, et elles ne disent pas la même chose.** La brute est ce que les
régimes versent, la nette ce qui arrive sur le compte après CSG, CRDS et
cotisation maladie : 1 565 € contre 1 457 € en 2022. Les deux sont publiées,
jamais mélangées, et l'écart entre elles n'est pas un prélèvement de l'État
mais le financement de la protection sociale elle-même.

**L'âge est « conjoncturel », et ce mot compte.** Il ne dit pas l'âge auquel une
génération est partie — on ne le sait qu'une fois qu'elle est partie — mais
l'âge moyen qu'on observerait si les comportements d'une année donnée
duraient. C'est l'indicateur que la DREES publie pour suivre l'effet des
réformes sans attendre trente ans.

Usage : python -m plateforme.normalize.retraites [--store r2:plateforme-raw]
"""

import argparse
import io
import re

from plateforme import entrepot
from plateforme.http import telecharger
from plateforme.normalize.geo import MILLESIME, make_store

DATASET = "drees-retraites"
SOURCE = "data-drees"
BASE = (
    "https://data.drees.solidarites-sante.gouv.fr/api/explore/v2.1/catalog/datasets"
    "/1393_les-effectifs-et-montants-de-pension-des-retraites/attachments"
)
CLASSEUR = f"{BASE}/les_effectifs_de_retraites_montants_des_pensions_et_ages_de_depart_a_la_retraite_fin_2022_xlsx"
CLASSEUR_RATIO = f"{BASE}/rapport_des_effectifs_de_retraites_et_de_cotisants_de_2004_a_2016xlsx"

# Un millésime peut porter un appel de note : « 2018 1 », « 2020 2 ».
ANNEE = re.compile(r"^\s*(\d{4})")

# Les effectifs du classeur sont en milliers de personnes.
MILLE = 1000


def _annee(cellule) -> str | None:
    if cellule is None:
        return None
    trouve = ANNEE.match(str(cellule))
    return trouve.group(1) if trouve else None


def onglets(contenu: bytes, noms: list[str]) -> dict[str, list[tuple]]:
    """Les onglets demandés, le classeur ouvert une seule fois."""
    import openpyxl

    classeur = openpyxl.load_workbook(io.BytesIO(contenu), read_only=True, data_only=True)
    return {nom: list(classeur[nom].iter_rows(values_only=True)) for nom in noms}


def _nombre(cellule) -> float | None:
    """Une cellule « nd » n'est pas un zéro : la pension nette n'est publiée
    qu'à partir de 2008, et publier zéro pour 2004 inventerait un effondrement."""
    if isinstance(cellule, int | float):
        return float(cellule)
    return None


def lignes_par_annee(feuille: list[tuple]) -> list[tuple[str, tuple]]:
    """Les rangées dont la première cellule est un millésime, dans l'ordre."""
    return [
        (annee, rangee)
        for rangee in feuille
        if rangee and (annee := _annee(rangee[0])) is not None
    ]


def effectifs(feuille: list[tuple]) -> dict[str, dict[str, float]]:
    """Onglet 1.1-a : nombre de retraités, tous régimes, par sexe.

    Contrôle d'identité : les femmes et les hommes doivent redonner l'ensemble.
    C'est ce qui distingue les trois bonnes colonnes de trois colonnes voisines
    — le classeur en aligne douze, dont les retraités de droit direct et ceux
    de droit dérivé, qui ne s'additionnent pas de la même façon.
    """
    series: dict[str, dict[str, float]] = {
        "drees_retraites_effectif": {},
        "drees_retraites_effectif_femmes": {},
        "drees_retraites_effectif_hommes": {},
    }
    for annee, rangee in lignes_par_annee(feuille):
        ensemble, femmes, hommes = (_nombre(rangee[i]) for i in (1, 2, 3))
        if None in (ensemble, femmes, hommes):
            continue
        if abs(femmes + hommes - ensemble) > 0.5:
            raise ValueError(
                f"1.1-a {annee} : {femmes} + {hommes} != {ensemble} — colonnes déplacées"
            )
        series["drees_retraites_effectif"][annee] = ensemble * MILLE
        series["drees_retraites_effectif_femmes"][annee] = femmes * MILLE
        series["drees_retraites_effectif_hommes"][annee] = hommes * MILLE
    return series


def pensions(feuille: list[tuple]) -> dict[str, dict[str, float]]:
    """Onglet 2.1-a : pension mensuelle moyenne, y compris majoration pour trois
    enfants — le chiffre que la DREES met en avant, et celui du débat.

    Contrôle d'identité : la pension moyenne des femmes est inférieure à celle
    de l'ensemble, elle-même inférieure à celle des hommes, chaque année depuis
    2004. Ce n'est pas une hypothèse de lecture : c'est un fait de la série, et
    il tombe dès qu'une colonne glisse.
    """
    series: dict[str, dict[str, float]] = {
        "drees_pension_moyenne_brute": {},
        "drees_pension_moyenne_brute_femmes": {},
        "drees_pension_moyenne_brute_hommes": {},
        "drees_pension_moyenne_nette": {},
    }
    for annee, rangee in lignes_par_annee(feuille):
        brute, femmes, hommes = (_nombre(rangee[i]) for i in (7, 8, 9))
        nette = _nombre(rangee[10])
        if None in (brute, femmes, hommes):
            continue
        if not femmes < brute < hommes:
            raise ValueError(
                f"2.1-a {annee} : {femmes} / {brute} / {hommes} ne s'ordonnent pas"
                " — colonnes déplacées"
            )
        series["drees_pension_moyenne_brute"][annee] = brute
        series["drees_pension_moyenne_brute_femmes"][annee] = femmes
        series["drees_pension_moyenne_brute_hommes"][annee] = hommes
        if nette is not None:
            if not nette < brute:
                raise ValueError(f"2.1-a {annee} : nette {nette} >= brute {brute}")
            series["drees_pension_moyenne_nette"][annee] = nette
    return series


# L'onglet des âges est **transposé** : une colonne par millésime, une ligne par
# sexe. Le lire comme les autres rendrait zéro ligne, sans erreur.
LIGNES_AGE = {
    "Ensemble": "drees_age_depart",
    "Femmes": "drees_age_depart_femmes",
    "Hommes": "drees_age_depart_hommes",
}


def ages(feuille: list[tuple]) -> dict[str, dict[str, float]]:
    """Onglet 3.1-b : âge conjoncturel moyen de départ à la retraite.

    Contrôle d'identité : un âge de départ vit entre 55 et 70 ans. En dehors,
    ce n'est pas un âge — c'est une autre colonne du classeur.
    """
    entete = next((r for r in feuille if r and _annee(r[1]) is not None), None)
    if entete is None:
        raise ValueError("3.1-b : aucune ligne de millésimes")
    annees = [_annee(cellule) for cellule in entete]
    series: dict[str, dict[str, float]] = {clef: {} for clef in LIGNES_AGE.values()}
    for rangee in feuille:
        intitule = str(rangee[0]).strip() if rangee and rangee[0] else ""
        if intitule not in LIGNES_AGE:
            continue
        for colonne, annee in enumerate(annees):
            valeur = _nombre(rangee[colonne]) if annee and colonne < len(rangee) else None
            if valeur is None:
                continue
            if not 55 <= valeur <= 70:
                raise ValueError(f"3.1-b {intitule} {annee} : {valeur} n'est pas un âge")
            series[LIGNES_AGE[intitule]][annee] = valeur
    return series


def cotisants(feuille: list[tuple]) -> dict[str, dict[str, float]]:
    """Le rapport cotisants / retraités, 2004-2016.

    Contrôle d'identité : le rapport tient entre 1 et 3. Les deux colonnes de
    rapport diffèrent par le champ — résidents en France seuls, ou France et
    étranger. C'est la seconde qui est publiée ici : elle compte tous les
    retraités que les régimes français paient, y compris ceux partis vivre
    ailleurs, et c'est le périmètre des effectifs publiés au-dessus.
    """
    series: dict[str, dict[str, float]] = {"drees_cotisants_par_retraite": {}}
    for annee, rangee in lignes_par_annee(feuille):
        valeur = _nombre(rangee[4])
        if valeur is None:
            continue
        if not 1 <= valeur <= 3:
            raise ValueError(f"cotisants {annee} : {valeur} n'est pas un rapport plausible")
        series["drees_cotisants_par_retraite"][annee] = round(valeur, 3)
    return series


INDICATEURS = {
    "drees_retraites_effectif": {
        "libelle": "Nombre de retraités",
        "unite": "count",
        "public": "Le nombre de personnes qui perçoivent une pension de retraite,"
        " tous régimes confondus, qu'elles vivent en France ou à l'étranger.",
        "technique": "Effectifs de retraités percevant un droit direct ou dérivé,"
        " tous régimes, au 31 décembre, en personnes (source en milliers).",
    },
    "drees_retraites_effectif_femmes": {
        "libelle": "Nombre de retraitées",
        "unite": "count",
        "public": "Les femmes parmi les personnes qui perçoivent une pension de"
        " retraite, tous régimes confondus.",
        "technique": "Effectifs de retraitées, tous régimes, au 31 décembre.",
    },
    "drees_retraites_effectif_hommes": {
        "libelle": "Nombre de retraités hommes",
        "unite": "count",
        "public": "Les hommes parmi les personnes qui perçoivent une pension de"
        " retraite, tous régimes confondus.",
        "technique": "Effectifs de retraités hommes, tous régimes, au 31 décembre.",
    },
    "drees_pension_moyenne_brute": {
        "libelle": "Pension mensuelle brute moyenne",
        "unite": "EUR",
        "public": "Ce que touche en moyenne un retraité chaque mois avant"
        " prélèvements sociaux, majoration pour trois enfants comprise.",
        "technique": "Montant mensuel moyen brut de la pension de droit direct, y"
        " compris majoration pour trois enfants, tous régimes, en euros courants.",
    },
    "drees_pension_moyenne_brute_femmes": {
        "libelle": "Pension mensuelle brute moyenne des femmes",
        "unite": "EUR",
        "public": "La pension mensuelle moyenne des femmes avant prélèvements"
        " sociaux. L'écart avec celle des hommes vient des carrières, pas du barème.",
        "technique": "Montant mensuel moyen brut de la pension de droit direct des"
        " femmes, y compris majoration pour trois enfants, tous régimes.",
    },
    "drees_pension_moyenne_brute_hommes": {
        "libelle": "Pension mensuelle brute moyenne des hommes",
        "unite": "EUR",
        "public": "La pension mensuelle moyenne des hommes avant prélèvements sociaux.",
        "technique": "Montant mensuel moyen brut de la pension de droit direct des"
        " hommes, y compris majoration pour trois enfants, tous régimes.",
    },
    "drees_pension_moyenne_nette": {
        "libelle": "Pension mensuelle nette moyenne",
        "unite": "EUR",
        "public": "Ce qui arrive sur le compte du retraité, après CSG, CRDS et"
        " cotisation maladie. Ces prélèvements financent la protection sociale,"
        " ils ne sont pas un impôt sur le revenu.",
        "technique": "Montant mensuel moyen net de la pension de droit direct, y"
        " compris majoration pour trois enfants, tous régimes. Publié depuis 2008.",
    },
    "drees_age_depart": {
        "libelle": "Âge conjoncturel moyen de départ à la retraite",
        "unite": "annees",
        "public": "L'âge moyen auquel on partirait à la retraite si les"
        " comportements de l'année observée duraient. Il ne dit pas l'âge auquel une"
        " génération est effectivement partie, qui ne se connaît qu'après coup.",
        "technique": "Âge conjoncturel moyen de départ à la retraite, tous régimes,"
        " personnes résidant en France, en années.",
    },
    "drees_age_depart_femmes": {
        "libelle": "Âge conjoncturel moyen de départ des femmes",
        "unite": "annees",
        "public": "Le même âge, pour les femmes. Il est plus élevé que celui des"
        " hommes : des carrières plus souvent interrompues demandent plus"
        " d'années pour atteindre le taux plein.",
        "technique": "Âge conjoncturel moyen de départ des femmes, tous régimes,"
        " personnes résidant en France.",
    },
    "drees_age_depart_hommes": {
        "libelle": "Âge conjoncturel moyen de départ des hommes",
        "unite": "annees",
        "public": "Le même âge, pour les hommes.",
        "technique": "Âge conjoncturel moyen de départ des hommes, tous régimes,"
        " personnes résidant en France.",
    },
    "drees_cotisants_par_retraite": {
        "libelle": "Cotisants par retraité",
        "unite": "ratio",
        "public": "Combien de personnes cotisent pour un retraité. C'est le rapport"
        " qui commande l'équilibre d'un régime par répartition, où les pensions"
        " d'aujourd'hui sont payées par les cotisations d'aujourd'hui.",
        "technique": "Rapport entre l'emploi intérieur et les effectifs de retraités"
        " de droit direct, tous régimes, résidant en France ou à l'étranger.",
    },
}


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for indicateur, fiche in INDICATEURS.items():
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, confidence_level, badges)
                values (?, ?, 'observed', array['Officiel'])
                returning definition_id
                """,
                (fiche["public"], fiche["technique"]),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, price_basis, geo_levels, time_granularity, published)
                values (?, ?, ?, 'retraites', ?, ?, false, ?, array['pays'],
                        'annuelle', true)
                on conflict (indicator_id) do update set unit = excluded.unit,
                    definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                    theme = excluded.theme, additive = false, published = true
                """,
                (
                    indicateur, DATASET, definition, fiche["libelle"], fiche["unite"],
                    "current" if fiche["unite"] == "EUR" else None,
                ),
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
        classeur = telecharger(CLASSEUR, timeout=300)
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "retraites-fin-2022.xlsx",
            classeur, CLASSEUR,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        ratio = telecharger(CLASSEUR_RATIO, timeout=300)
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "cotisants-2004-2016.xlsx",
            ratio, CLASSEUR_RATIO,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        feuilles = onglets(classeur, ["1.1-a", "2.1-a", "3.1-b"])
        series: dict[str, dict[str, float]] = {}
        series.update(effectifs(feuilles["1.1-a"]))
        series.update(pensions(feuilles["2.1-a"]))
        series.update(ages(feuilles["3.1-b"]))
        series.update(cotisants(onglets(ratio, ["Feuil1"])["Feuil1"]))
        manquants = set(INDICATEURS) - set(series)
        if manquants:
            raise ValueError(f"séries absentes du classeur : {sorted(manquants)}")

        total = 0
        for indicateur, valeurs in series.items():
            with conn.cursor() as curseur:
                curseur.execute(
                    "delete from core.observations where indicator_id = ?", (indicateur,)
                )
                entrepot.copier(
                    conn,
                    "core.observations",
                    ["indicator_id", "geo_level", "geo_code", "geo_vintage", "period",
                     "value", "run_id"],
                    (
                        (indicateur, "pays", "FR", MILLESIME, periode, valeur, run_id)
                        for periode, valeur in sorted(valeurs.items())
                    ),
                )
            conn.commit()
            total += len(valeurs)
            bornes = sorted(valeurs) or ["—"]
            print(f"{indicateur} : {len(valeurs)} exercices ({bornes[0]}-{bornes[-1]})")
        entrepot.finish_run(conn, run_id, "success", rows_written=total)
        print(f"Retraites : {total} observations")
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
