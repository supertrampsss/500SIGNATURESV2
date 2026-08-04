"""Revenus et pauvreté (INSEE, Filosofi) vers core.observations.

Deux chiffres que tout le monde cherche sur sa commune : le niveau de vie
médian et la part d'habitants sous le seuil de pauvreté. Ils viennent du même
dispositif, Filosofi, qui croise les déclarations fiscales et les prestations
sociales — et ils obéissent à des règles que le produit doit respecter.

**Une médiane ne s'additionne pas et ne se divise pas.** Additionner les
médianes de deux communes ne donne rien ; diviser une médiane par la population
donne un nombre sans signification. Ces deux indicateurs sont donc déclarés non
sommables, et le site s'appuie sur cette propriété plutôt que sur l'unité.

**Le secret statistique n'est pas un zéro.** L'INSEE ne diffuse pas ces chiffres
pour les communes trop petites : l'observation existe, sa valeur est vide. Ces
territoires sont absents de la série, jamais présents à zéro, et la couverture
réelle est publiée avec le run.

**Rupture méthodologique.** Filosofi a changé de source et de méthode pour les
millésimes récents ; les séries d'avant et d'après ne se comparent pas. Un seul
millésime est chargé pour l'instant, ce qui écarte le problème plutôt que de le
masquer — l'ajouter supposera de porter le drapeau de rupture (docs/06).

Usage : python -m plateforme.normalize.revenus [--store r2:plateforme-raw]
"""

import argparse
import json


from plateforme import entrepot
from plateforme.connectors import insee, melodi
from plateforme.normalize.geo import MILLESIME, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "melodi-filosofi-cc"
SOURCE = "insee-melodi"
JEU = "DS_FILOSOFI_CC"

INDICATEURS = {
    "insee_niveau_vie_median": {
        "mesure": "MED_SL",
        "libelle": "Niveau de vie médian",
        "unite": "EUR",
        "public": "Le revenu disponible, après impôts et prestations, qui partage les"
        " habitants en deux moitiés : la moitié vit avec moins, l'autre avec plus. Il"
        " est compté par unité de consommation, pour tenir compte de la taille du foyer.",
        "technique": "Médiane du niveau de vie annuel des ménages fiscaux, dispositif"
        " Filosofi, en euros par unité de consommation.",
        "formule": "Médiane du revenu disponible par unité de consommation",
    },
    "insee_taux_pauvrete": {
        "mesure": "PR_MD60",
        "libelle": "Taux de pauvreté",
        "unite": "percent",
        "public": "La part des habitants vivant avec moins de 60 % du niveau de vie"
        " médian de la France. C'est une mesure relative : elle dit l'écart au reste"
        " du pays, pas un seuil de subsistance.",
        "technique": "Part de la population dont le niveau de vie est inférieur à 60 %"
        " de la médiane nationale, dispositif Filosofi.",
        "formule": "Population sous le seuil de 60 % de la médiane / population totale",
    },
}


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for indicateur, fiche in INDICATEURS.items():
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, confidence_level, badges)
                values (?, ?, ?, 'observed',
                        array['Officiel','Donnée retraitée','Comparabilité limitée'])
                returning definition_id
                """,
                (fiche["public"], fiche["technique"], fiche["formule"]),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, price_basis, geo_levels, time_granularity, published)
                values (?, ?, ?, 'revenus', ?, ?, false, ?,
                        array['commune','epci','departement','region'], 'annuelle', true)
                on conflict (indicator_id) do update set
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


def ecrire(conn, run_id: str, indicateur: str, lignes: list[dict]) -> tuple[int, int]:
    """-> (écrites, écartées faute de territoire connu)."""
    candidates = [
        (indicateur, ligne["niveau"], ligne["code"], ligne["periode"], ligne["valeur"])
        for ligne in lignes
    ]
    gardees, ecartes = filtrer_territoires_connus(conn, candidates)
    with conn.cursor() as curseur:
        curseur.execute("delete from core.observations where indicator_id = ?", (indicateur,))
        entrepot.copier(
            conn,
            "core.observations",
            ["indicator_id", "geo_level", "geo_code", "geo_vintage", "period", "value", "run_id"],
            ((cle, niveau, code, MILLESIME, periode, valeur, run_id) for cle, niveau, code, periode, valeur in gardees),
        )
    conn.commit()
    return len(gardees), len(ecartes)


def couverture(conn, run_id: str, constat: dict) -> None:
    """Publier la couverture réelle : sur un indicateur soumis au secret
    statistique, savoir combien de communes manquent fait partie du chiffre."""
    conn.execute(
        """
        insert into meta.data_quality_checks
            (run_id, dataset_id, check_name, severity, passed, observed)
        values (?, ?, 'couverture_communale', 'info', true, ?)
        """,
        (run_id, DATASET, json.dumps(constat)),
    )
    conn.commit()


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        communes = conn.execute(
            "select count(*) from geo.geography_reference"
            " where geo_level = 'commune' and vintage = ?",
            (MILLESIME,),
        ).fetchone()[0]
        constat: dict = {"communes_du_referentiel": communes}
        total = 0
        for indicateur, fiche in INDICATEURS.items():
            observations = melodi.pages(JEU, {"FILOSOFI_MEASURE": fiche["mesure"]})
            url = f"{insee.MELODI_BASE}/data/{JEU}?FILOSOFI_MEASURE={fiche['mesure']}"
            entrepot.record_asset(
                conn, store, run_id, DATASET, SOURCE, f"{fiche['mesure']}.json",
                json.dumps({"observations": observations}).encode(), url, "application/json",
            )
            lignes = melodi.valeurs(observations)
            ecrites, ecartes = ecrire(conn, run_id, indicateur, lignes)
            total += ecrites
            couvertes = sum(1 for ligne in lignes if ligne["niveau"] == "commune")
            constat[indicateur] = {
                "observations_diffusees": len(lignes),
                "communes_couvertes": couvertes,
                "part_communes": round(couvertes / communes * 100, 1) if communes else None,
                "territoires_hors_referentiel": ecartes,
            }
            print(
                f"{indicateur} : {ecrites} observations, "
                f"{constat[indicateur]['part_communes']} % des communes"
            )
        couverture(conn, run_id, constat)
        entrepot.finish_run(conn, run_id, "success", rows_written=total)
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
