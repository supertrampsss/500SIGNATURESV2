"""T-12 — Finances locales OFGL vers core.indicators / core.observations.

Usage : python -m plateforme.normalize.ofgl [--niveaux commune,epci,departement,region]
                                            [--depuis 2018] [--store r2:plateforme-raw]
"""

import argparse

from psycopg.types.json import Jsonb

from plateforme import db
from plateforme.limites import garde_fou_volume
from plateforme.connectors import ofgl
from plateforme.http import fetch
from plateforme.normalize.geo import MILLESIME, make_store

JEUX = {
    "commune": "ofgl-communes",
    "epci": "ofgl-gfp",
    "departement": "ofgl-departements",
    "region": "ofgl-regions",
}

POPULATION = "ofgl_population_reference"

# Fiche de chaque indicateur (docs/06 : définition grand public ≤ 50 mots,
# définition technique, formule, unité, niveau de confiance).
FICHES = {
    "ofgl_depenses_fonctionnement": (
        "Ce que la collectivité dépense chaque année pour faire tourner ses services :"
        " personnel, achats, subventions versées, intérêts de sa dette."
        " N'inclut pas les investissements.",
        "Dépenses réelles de fonctionnement de l'exercice, budget principal et budgets"
        " annexes consolidés (agrégat OFGL « Dépenses de fonctionnement »).",
        "Dépenses de fonctionnement",
    ),
    "ofgl_recettes_fonctionnement": (
        "Ce que la collectivité encaisse chaque année pour financer son fonctionnement :"
        " impôts locaux, dotations de l'État, produits des services rendus."
        " N'inclut pas les emprunts.",
        "Recettes réelles de fonctionnement de l'exercice, budget principal et budgets"
        " annexes consolidés (agrégat OFGL « Recettes de fonctionnement »).",
        "Recettes de fonctionnement",
    ),
    "ofgl_depenses_investissement": (
        "Ce que la collectivité consacre chaque année à ses équipements durables —"
        " bâtiments, voirie, matériel — et au remboursement du capital de sa dette.",
        "Dépenses réelles d'investissement de l'exercice, remboursements d'emprunts"
        " compris (agrégat OFGL « Dépenses d'investissement »).",
        "Dépenses d'investissement",
    ),
    "ofgl_epargne_brute": (
        "Ce qui reste des recettes de fonctionnement une fois payées les dépenses de"
        " fonctionnement. Cette somme finance les investissements et le remboursement"
        " de la dette.",
        "Recettes réelles de fonctionnement moins dépenses réelles de fonctionnement"
        " (agrégat OFGL « Epargne brute »). Peut être négative.",
        "Recettes de fonctionnement − Dépenses de fonctionnement",
    ),
    "ofgl_encours_dette": (
        "Capital que la collectivité doit encore rembourser à ses prêteurs au"
        " 31 décembre. Ne comprend pas les intérêts restant à payer.",
        "Encours de dette au 31 décembre de l'exercice, budget principal et budgets"
        " annexes consolidés (agrégat OFGL « Encours de dette »).",
        "Encours de dette au 31/12",
    ),
    "ofgl_frais_personnel": (
        "Ce que la collectivité paie chaque année à ses agents : salaires, primes"
        " et cotisations. C'est presque toujours le premier poste de son budget de"
        " fonctionnement.",
        "Frais de personnel de l'exercice, budget principal et budgets annexes"
        " consolidés (agrégat OFGL « Frais de personnel »). Rémunérations et"
        " charges sociales comprises ; ne comprend pas le personnel des"
        " satellites — associations subventionnées, délégataires — dont la"
        " dépense apparaît ailleurs.",
        "Frais de personnel",
    ),
    "ofgl_charges_financieres": (
        "Les intérêts que la collectivité paie sur sa dette. Ce n'est pas le"
        " remboursement de la dette elle-même, qui figure dans les dépenses"
        " d'investissement : c'est le prix de l'emprunt.",
        "Charges financières de l'exercice, budget principal et budgets annexes"
        " consolidés (agrégat OFGL « Charges financières »). Intérêts payés, à ne"
        " pas additionner avec le remboursement du capital : les deux relèvent de"
        " sections comptables différentes.",
        "Charges financières",
    ),
    "ofgl_epargne_nette": (
        "Ce qui reste à la collectivité une fois payés le fonctionnement et le"
        " remboursement de sa dette. C'est ce qu'elle peut réellement consacrer à"
        " de nouveaux équipements sans emprunter.",
        "Épargne brute moins le remboursement du capital de la dette (agrégat"
        " OFGL « Epargne nette »). Peut être négative : la collectivité emprunte"
        " alors pour rembourser.",
        "Épargne brute − Remboursement du capital",
    ),
    POPULATION: (
        "Population utilisée par l'Observatoire des finances locales pour calculer ses"
        " montants par habitant. La reprendre garantit que nos ratios par habitant"
        " reproduisent exactement les siens.",
        "Population totale (colonne ptot) associée par l'OFGL à chaque territoire et"
        " exercice.",
        "Population totale retenue par l'OFGL",
    ),
}

LIBELLES = {
    "ofgl_depenses_fonctionnement": "Dépenses de fonctionnement",
    "ofgl_recettes_fonctionnement": "Recettes de fonctionnement",
    "ofgl_depenses_investissement": "Dépenses d'investissement",
    "ofgl_epargne_brute": "Épargne brute",
    "ofgl_encours_dette": "Encours de dette",
    "ofgl_frais_personnel": "Frais de personnel",
    "ofgl_charges_financieres": "Charges financières (intérêts de la dette)",
    "ofgl_epargne_nette": "Épargne nette",
    POPULATION: "Population de référence OFGL",
}


def declarer_indicateurs(conn, niveaux: list[str]) -> None:
    """Crée ou met à jour les fiches. Sans fiche complète, le schéma refuse la
    publication (docs/02 §C) — la définition précède donc toujours la donnée."""
    with conn.cursor() as cur:
        for indicateur, (grand_public, technique, formule) in FICHES.items():
            population = indicateur == POPULATION
            definition = cur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, confidence_level, badges)
                values (%s, %s, %s, 'observed', array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (grand_public, technique, formule),
            ).fetchone()[0]
            cur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, price_basis, accounting_frame, geo_levels,
                     time_granularity, published)
                values (%s, 'ofgl-communes', %s, %s, %s, %s, true, %s, %s, %s, 'annuelle', true)
                on conflict (indicator_id) do update set
                    definition_id = excluded.definition_id,
                    -- Union et non remplacement : un chargement portant sur les
                    -- seules communes ne doit pas faire disparaître du catalogue
                    -- les départements déjà chargés. Le niveau réel est de toute
                    -- façon recalculé depuis les données à la publication.
                    geo_levels = (
                        select array_agg(distinct n order by n)
                        from unnest(core.indicators.geo_levels || excluded.geo_levels) as n
                    ),
                    published = true
                """,
                (
                    indicateur,
                    definition,
                    "population" if population else "finances_locales",
                    LIBELLES[indicateur],
                    "count" if population else "EUR",
                    None if population else "current",
                    None if population else "budgetaire",
                    niveaux,
                ),
            )
        # Une fiche remplacée ne doit pas survivre en orphelin.
        cur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def observations(lignes: list[dict], depuis: int) -> tuple[list[tuple], list[tuple]]:
    """-> (montants, populations) prêts pour COPY.

    Les montants sont sommés par territoire et exercice : une commune nouvelle
    porte encore une ligne par commune d'origine (cf. connectors/ofgl.py). La
    population l'est aussi, mais sur les budgets distincts — OFGL la répète sur
    chaque agrégat, la sommer telle quelle la multiplierait par cinq.
    """
    montants: dict[tuple, float] = {}
    populations: dict[tuple, dict[str, int]] = {}
    for ligne in lignes:
        if int(ligne["period"]) < depuis:
            continue
        cle = (ligne["geo_level"], ligne["geo_code"], ligne["period"])
        montant_cle = (ligne["indicator_id"], *cle)
        montants[montant_cle] = montants.get(montant_cle, 0.0) + ligne["value"]
        if ligne["population"] is not None:
            populations.setdefault(cle, {})[ligne["budget"]] = ligne["population"]
    return (
        [(*cle, valeur) for cle, valeur in montants.items()],
        [(POPULATION, *cle, sum(budgets.values())) for cle, budgets in populations.items()],
    )


def enregistrer_criteres(conn, lignes: list[dict]) -> int:
    """Range les critères de comparaison de l'OFGL dans le référentiel.

    Ils décrivent le territoire, pas une mesure : leur place est dans
    `geography_reference.flags`, d'où le comparateur les lira pour constituer
    un groupe de communes semblables (docs/01 §3).
    """
    derniers: dict[str, dict] = {}
    for ligne in lignes:
        if ligne["criteres"]:
            # On garde l'exercice le plus récent : les critères évoluent.
            precedent = derniers.get(ligne["geo_code"])
            if precedent is None or ligne["period"] >= precedent["periode"]:
                derniers[ligne["geo_code"]] = {
                    "periode": ligne["period"],
                    "criteres": ligne["criteres"],
                }
    if not derniers:
        return 0
    # Une seule instruction plutôt que 34 875 : autant d'allers-retours
    # dépassaient le délai maximum d'une requête.
    with conn.cursor() as curseur:
        curseur.execute("create temp table _criteres (code text primary key, flags jsonb)")
        with curseur.copy("copy _criteres (code, flags) from stdin") as copie:
            for code, valeur in derniers.items():
                copie.write_row(
                    (code, Jsonb({**valeur["criteres"], "criteres_source": "OFGL"}))
                )
        curseur.execute(
            """
            update geo.geography_reference g set flags = g.flags || c.flags
            from _criteres c
            where g.geo_level = 'commune' and g.geo_code = c.code and g.vintage = %s
            """,
            (MILLESIME,),
        )
        curseur.execute("drop table _criteres")
    conn.commit()
    return len(derniers)


def filtrer_territoires_connus(conn, lignes: list[tuple]) -> tuple[list[tuple], set[str]]:
    """Écarte les territoires absents du référentiel plutôt que de faire échouer le
    run entier. Les codes écartés sont renvoyés : une couverture incomplète est une
    information à publier, pas à taire (docs/03 §6)."""
    niveaux = sorted({ligne[1] for ligne in lignes})
    connus = {
        (niveau, code)
        for niveau, code in conn.execute(
            "select geo_level, geo_code from geo.geography_reference"
            " where geo_level = any(%s) and vintage = %s",
            (niveaux, MILLESIME),
        ).fetchall()
    }
    gardees = [ligne for ligne in lignes if (ligne[1], ligne[2]) in connus]
    ecartes = {f"{ligne[1]}:{ligne[2]}" for ligne in lignes if (ligne[1], ligne[2]) not in connus}
    return gardees, ecartes


def ecrire(conn, run_id: str, lignes: list[tuple]) -> int:
    """Remplace les observations des indicateurs et territoires concernés."""
    with conn.cursor() as cur:
        indicateurs = sorted({ligne[0] for ligne in lignes})
        niveaux = sorted({ligne[1] for ligne in lignes})
        cur.execute(
            "delete from core.observations where indicator_id = any(%s) and geo_level = any(%s)",
            (indicateurs, niveaux),
        )
        # Écriture par lots : une seule instruction pour 420 000 lignes dépasse
        # le délai maximum, chaque vérification de clé étrangère prenant un verrou.
        LOT = 100_000
        for debut in range(0, len(lignes), LOT):
            with cur.copy(
                "copy core.observations"
                " (indicator_id, geo_level, geo_code, geo_vintage, period, value, run_id)"
                " from stdin"
            ) as copie:
                for indicateur, niveau, code, periode, valeur in lignes[debut : debut + LOT]:
                    copie.write_row(
                        (indicateur, niveau, code, MILLESIME, periode, valeur, run_id)
                    )
    conn.commit()
    return len(lignes)


def controler_coherence(conn, run_id: str, niveau: str) -> bool:
    """Épargne brute = recettes − dépenses de fonctionnement, par construction.

    Contrôle déterministe : si l'identité comptable ne tient pas, le chargement
    est faux et ne doit pas être publié (docs/03 §2). Tolérance à l'euro pour
    les arrondis de la source.
    """
    ecarts = conn.execute(
        """
        select count(*) from (
            select o.geo_code, o.period,
                   sum(o.value) filter (where indicator_id = 'ofgl_recettes_fonctionnement')
                 - sum(o.value) filter (where indicator_id = 'ofgl_depenses_fonctionnement')
                 - sum(o.value) filter (where indicator_id = 'ofgl_epargne_brute') as ecart
            from core.observations o
            where o.geo_level = %s and o.indicator_id in
                ('ofgl_recettes_fonctionnement','ofgl_depenses_fonctionnement','ofgl_epargne_brute')
            group by 1, 2
        ) t where abs(ecart) > 1
        """,
        (niveau,),
    ).fetchone()[0]
    conn.execute(
        """
        insert into meta.data_quality_checks
            (run_id, dataset_id, check_name, severity, passed, observed)
        values (%s, %s, 'epargne_brute_egale_recettes_moins_depenses', 'blocker', %s,
                jsonb_build_object('territoires_en_ecart', %s))
        """,
        (run_id, JEUX[niveau], ecarts == 0, ecarts),
    )
    conn.commit()
    return ecarts == 0


def run(niveaux: list[str], depuis: int, store_spec: str) -> int:
    conn = db.connect()
    store = make_store(store_spec)
    declarer_indicateurs(conn, niveaux)
    total = 0
    for niveau in niveaux:
        # Mesuré à chaque niveau : le précédent vient d'écrire, et c'est ce
        # connecteur qui porte l'essentiel du volume de la base (D6ter).
        garde_fou_volume(conn)
        dataset_id = JEUX[niveau]
        run_id = db.start_run(conn, dataset_id, "manual")
        try:
            url = ofgl.url_export(niveau, list(ofgl.AGREGATS))
            contenu = fetch(url, timeout=600).content
            db.record_asset(
                conn, store, run_id, dataset_id, "ofgl", f"{niveau}.csv", contenu, url, "text/csv"
            )
            brutes = ofgl.lire(contenu, niveau)
            if niveau == "commune":
                criteres = enregistrer_criteres(conn, brutes)
                print(f"critères de comparaison : {criteres} communes")
            montants, populations = observations(brutes, depuis)
            lignes, ecartes = filtrer_territoires_connus(conn, montants + populations)
            ecrites = ecrire(conn, run_id, lignes)
            if not controler_coherence(conn, run_id, niveau):
                raise ValueError(
                    f"{niveau} : l'épargne brute ne se déduit pas des recettes et dépenses"
                )
            db.finish_run(conn, run_id, "success", rows_written=ecrites)
            alerte = f" — {len(ecartes)} territoires hors référentiel écartés" if ecartes else ""
            print(f"{niveau} : {ecrites} observations{alerte}")
            total += ecrites
        except Exception as error:  # noqa: BLE001 — tout échec finit tracé dans le lineage
            db.finish_run(conn, run_id, "failed", error=str(error))
            raise
    conn.close()
    print(f"total : {total} observations")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--niveaux", default="commune,epci,departement,region")
    parser.add_argument("--depuis", type=int, default=2018)
    parser.add_argument("--store", default=".snapshots")
    args = parser.parse_args()
    return run(args.niveaux.split(","), args.depuis, args.store)


if __name__ == "__main__":
    raise SystemExit(main())
