"""Dotation globale de fonctionnement des communes vers core.observations.

Ce connecteur ferme une boucle du produit : le budget de l'État inscrit un
prélèvement sur recettes au profit des collectivités, et cette série dit ce que
chaque commune en reçoit. Les deux chiffres viennent de deux administrations
différentes et se contrôlent l'un l'autre.

**Contrôle bloquant, entre sources.** La DGF versée aux communes doit rester
inférieure au prélèvement sur recettes au profit des collectivités territoriales
du même exercice : le prélèvement finance aussi les départements, les régions,
le FCTVA et des compensations d'exonérations. Si la somme des DGF communales
dépassait ce prélèvement, l'un des deux chiffres serait faux — le run échoue
plutôt que de publier.

**Quatre indicateurs, pas un.** La DGF totale répondait « combien l'État verse »
sans dire « au titre de quoi ». Les trois dotations de péréquation — DSU pour
les charges urbaines, DSR pour la ruralité, DNP pour les écarts de ressources —
étaient déjà téléchargées pour calculer la somme, et jetées. Elles sont publiées
telles quelles : c'est là que se lit la redistribution, et une commune peut voir
sa DGF baisser pendant que sa péréquation monte.

**Une absence n'est pas un zéro.** Moins de mille communes touchent la DSU. Une
commune sans ligne n'est pas une commune à zéro euro : elle n'est pas éligible,
et le contrôle vérifie qu'aucune péréquation n'est versée hors de la population
qui reçoit une part forfaitaire.

Usage : python -m plateforme.normalize.dotations [--exercice 2025] [--store …]
"""

import json
import argparse


from plateforme import entrepot
from plateforme.connectors import dgcl
from plateforme.http import telecharger
from plateforme.normalize.geo import MILLESIME, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "ofgl-dotations-communes"
SOURCE = "ofgl"
INDICATEUR = "dgcl_dotation_globale_fonctionnement"

# Les trois dotations de péréquation, déjà téléchargées pour calculer la DGF et
# jusqu'ici jetées. Publier leur somme sans elles répondait « combien l'État
# verse » sans jamais dire « au titre de quoi » — et c'est là que se lit la
# redistribution : la part forfaitaire suit la population, celles-ci corrigent.
COMPOSANTES_PUBLIEES = {
    "dsu": (
        "dgcl_dotation_solidarite_urbaine", "Dotation de solidarité urbaine reçue",
        "Ce que la commune reçoit de l'État au titre de la solidarité urbaine :"
        " une dotation réservée aux villes qui cumulent charges de centre et"
        " population défavorisée. Moins de mille communes en bénéficient.",
        "Montant notifié de dotation de solidarité urbaine et de cohésion sociale"
        " (DSU-CS), source DGCL diffusée par l'OFGL. Une commune sans montant"
        " n'est pas une commune à zéro euro : elle n'est pas éligible."
        " Cette dotation n'est pas incluse dans l'agrégat « péréquations"
        " et compensations fiscales » publié par ailleurs sur ce site :"
        " celui-ci porte les compensations d'exonérations décidées par le"
        " législateur, un autre poste des concours de l'État. Les deux ne"
        " s'additionnent ni ne se décomposent l'un l'autre.",
    ),
    "dsr": (
        "dgcl_dotation_solidarite_rurale", "Dotation de solidarité rurale reçue",
        "Ce que la commune reçoit de l'État au titre de la solidarité rurale."
        " Elle vise les communes peu peuplées et celles qui font bourg-centre"
        " pour leur canton. Une commune urbaine n'y a pas droit.",
        "Montant notifié de dotation de solidarité rurale, toutes fractions"
        " confondues — bourg-centre, péréquation, cible. Source DGCL diffusée"
        " par l'OFGL. L'absence de montant vaut non-éligibilité, pas zéro."
        " Cette dotation n'est pas incluse dans l'agrégat « péréquations"
        " et compensations fiscales » publié par ailleurs sur ce site :"
        " celui-ci porte les compensations d'exonérations décidées par le"
        " législateur, un autre poste des concours de l'État. Les deux ne"
        " s'additionnent ni ne se décomposent l'un l'autre.",
    ),
    "dnp": (
        "dgcl_dotation_nationale_perequation", "Dotation nationale de péréquation reçue",
        "Ce que la commune reçoit au titre de la dotation nationale de"
        " péréquation, qui corrige les écarts de ressources fiscales entre"
        " communes plutôt que leurs charges.",
        "Montant notifié de dotation nationale de péréquation, parts principale"
        " et majoration confondues. Source DGCL diffusée par l'OFGL. L'absence"
        " de montant vaut non-éligibilité, pas zéro."
        " Cette dotation n'est pas incluse dans l'agrégat « péréquations"
        " et compensations fiscales » publié par ailleurs sur ce site :"
        " celui-ci porte les compensations d'exonérations décidées par le"
        " législateur, un autre poste des concours de l'État. Les deux ne"
        " s'additionnent ni ne se décomposent l'un l'autre.",
    ),
}


class PerequationRompue(RuntimeError):
    """Une péréquation versée à une commune qui n'a pas de part forfaitaire."""


FICHE = {
    "libelle": "Dotation globale de fonctionnement reçue",
    "public": "Ce que l'État verse chaque année à la commune pour son"
    " fonctionnement : une part forfaitaire, calculée surtout sur la population,"
    " et des parts de péréquation qui tiennent compte des ressources et des"
    " charges de la commune.",
    "technique": "Somme des montants notifiés de dotation forfaitaire, DSU, DSR"
    " et DNP pour l'exercice, source DGCL diffusée par l'OFGL.",
    "formule": "Dotation forfaitaire + DSU + DSR + DNP",
}


def declarer(conn) -> None:
    fiches = [
        (INDICATEUR, FICHE["libelle"], FICHE["public"], FICHE["technique"],
         FICHE["formule"]),
        *(
            (identifiant, libelle, publique, technique,
             f"Montant notifié, composante « {composante.upper()} »")
            for composante, (identifiant, libelle, publique, technique)
            in sorted(COMPOSANTES_PUBLIEES.items())
        ),
    ]
    with conn.cursor() as curseur:
        for identifiant, libelle, publique, technique, formule in fiches:
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula,
                     confidence_level, badges)
                values (?, ?, ?, 'observed', array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (publique, technique, formule),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, price_basis, accounting_frame, geo_levels,
                     time_granularity, published)
                values (?, ?, ?, 'finances_locales', ?, 'EUR', true, 'current',
                        'budgetaire', array['commune'], 'annuelle', true)
                on conflict (indicator_id) do update set unit = excluded.unit,
                    definition_id = excluded.definition_id,
                    label_fr = excluded.label_fr,
                    theme = excluded.theme, published = true
                """,
                (identifiant, DATASET, definition, libelle),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def controler_contre_l_etat(conn, run_id: str, exercice: str, total: float) -> tuple[bool, dict]:
    """La DGF communale doit tenir dans le prélèvement sur recettes de l'État.

    Deux administrations, deux chaînes de production : si l'inégalité tombe,
    c'est que l'une des deux est mal lue.
    """
    ligne = conn.execute(
        """
        select value from core.observations
        where indicator_id = 'etat_psr_collectivites' and period = ? and geo_level = 'pays'
        """,
        (exercice,),
    ).fetchone()
    prelevement = float(ligne[0]) if ligne else None
    passe = prelevement is None or total < prelevement
    constat = {
        "dgf_communes": round(total, 2),
        "psr_collectivites": round(prelevement, 2) if prelevement is not None else None,
        "part": round(total / prelevement * 100, 1) if prelevement else None,
    }
    conn.execute(
        """
        insert into meta.data_quality_checks
            (run_id, dataset_id, check_name, severity, passed, observed)
        values (?, ?, 'dgf_inferieure_au_prelevement_sur_recettes', 'blocker', ?, ?)
        """,
        (run_id, DATASET, passe, json.dumps(constat)),
    )
    conn.commit()
    return passe, constat


def controler_perequation(montants: dict[tuple[str, str, str], float]) -> dict:
    """Aucune péréquation sans part forfaitaire, et pas plus de DSU que de DGF.

    Ce jeu est en format long : la variable est une chaîne, et la lire de
    travers ne fait rien planter. Ces deux inégalités attrapent le décalage —
    une composante rattachée aux mauvaises communes se verrait aussitôt, alors
    qu'un total resterait juste.
    """
    forfaitaires = {
        (code, exercice) for (composante, code, exercice) in montants
        if composante == "forfaitaire"
    }
    if not forfaitaires:
        raise PerequationRompue("aucune part forfaitaire lue")
    orphelines = sorted(
        (code, exercice) for (composante, code, exercice) in montants
        if composante != "forfaitaire" and (code, exercice) not in forfaitaires
    )
    if orphelines:
        exemples = ", ".join(f"{code} en {an}" for code, an in orphelines[:3])
        raise PerequationRompue(
            f"{len(orphelines)} communes reçoivent une péréquation sans part"
            f" forfaitaire ({exemples}). La DGF se construit sur la part"
            " forfaitaire : une composante est rattachée aux mauvaises communes."
        )
    beneficiaires = {
        composante: len({
            (code, exercice) for (c, code, exercice) in montants if c == composante
        })
        for composante in dgcl.COMPOSANTES.values()
    }
    if beneficiaires["dsu"] >= beneficiaires["forfaitaire"]:
        raise PerequationRompue(
            f"{beneficiaires['dsu']} communes touchent la DSU pour"
            f" {beneficiaires['forfaitaire']} parts forfaitaires : la DSU est"
            " réservée à une minorité de villes, cette proportion est impossible."
        )
    return beneficiaires


def ecrire_composantes(
    conn, run_id: str, montants: dict[tuple[str, str, str], float]
) -> int:
    lignes = [
        (COMPOSANTES_PUBLIEES[composante][0], "commune", code, periode, montant)
        for (composante, code, periode), montant in sorted(montants.items())
        if composante in COMPOSANTES_PUBLIEES
    ]
    gardees, _ = filtrer_territoires_connus(conn, lignes)
    noms = [identifiant for identifiant, *_ in COMPOSANTES_PUBLIEES.values()]
    with conn.cursor() as curseur:
        curseur.execute(
            "delete from core.observations where indicator_id = any(?)", (noms,)
        )
        entrepot.copier(
            conn,
            "core.observations",
            ["indicator_id", "geo_level", "geo_code", "geo_vintage", "period",
             "value", "run_id"],
            (
                (indicateur, niveau, code, MILLESIME, periode, valeur, run_id)
                for indicateur, niveau, code, periode, valeur in gardees
            ),
        )
    conn.commit()
    return len(gardees)


def ecrire(conn, run_id: str, totaux: dict[tuple[str, str], float]) -> tuple[int, set[str]]:
    lignes = [
        (INDICATEUR, "commune", code, periode, montant)
        for (code, periode), montant in sorted(totaux.items())
    ]
    gardees, ecartes = filtrer_territoires_connus(conn, lignes)
    with conn.cursor() as curseur:
        curseur.execute("delete from core.observations where indicator_id = ?", (INDICATEUR,))
        entrepot.copier(
            conn,
            "core.observations",
            ["indicator_id", "geo_level", "geo_code", "geo_vintage", "period", "value", "run_id"],
            ((indicateur, niveau, code, MILLESIME, periode, valeur, run_id) for indicateur, niveau, code, periode, valeur in gardees),
        )
    conn.commit()
    return len(gardees), ecartes


def run(exercice: int, store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        url = dgcl.url_export(exercice)
        contenu = telecharger(url, timeout=600)
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, f"dotations-{exercice}.csv", contenu,
            url, "text/csv",
        )
        brutes = dgcl.lire(contenu)
        if not brutes:
            raise ValueError(f"exercice {exercice} : aucune ligne de montant lue")
        totaux = dgcl.dgf(brutes)
        montants = dgcl.par_composante(brutes)
        beneficiaires = controler_perequation(montants)
        ecrites, ecartes = ecrire(conn, run_id, totaux)
        detaillees = ecrire_composantes(conn, run_id, montants)
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'perequation_adossee_a_la_part_forfaitaire', 'blocker',
                    true, ?)
            """,
            (run_id, DATASET, json.dumps(beneficiaires)),
        )
        conn.commit()
        total = sum(totaux.values())
        passe, constat = controler_contre_l_etat(conn, run_id, str(exercice), total)
        if not passe:
            raise ValueError(
                f"exercice {exercice} : la DGF communale ({constat['dgf_communes']:,.0f} €)"
                f" dépasse le prélèvement sur recettes de l'État"
                f" ({constat['psr_collectivites']:,.0f} €)"
            )
        entrepot.finish_run(conn, run_id, "success", rows_read=len(brutes), rows_written=ecrites)
        print(
            f"dotations {exercice} : {ecrites} communes, "
            f"{total / 1e9:.2f} Md€ de DGF, {detaillees} montants de péréquation"
            f" ({beneficiaires['dsu']} DSU, {beneficiaires['dsr']} DSR,"
            f" {beneficiaires['dnp']} DNP)"
            + (f", {constat['part']} % du prélèvement sur recettes" if constat["part"] else "")
        )
        if ecartes:
            print(f"{len(ecartes)} territoires absents du référentiel, écartés")
        return 0
    except Exception as error:  # noqa: BLE001 — tout échec finit tracé dans le lineage
        entrepot.finish_run(conn, run_id, "failed", error=str(error))
        raise
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--exercice", type=int, default=2025)
    parser.add_argument("--store", default=".snapshots")
    args = parser.parse_args()
    return run(args.exercice, args.store)


if __name__ == "__main__":
    raise SystemExit(main())
