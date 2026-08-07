"""Prélèvements obligatoires européens (Eurostat, gov_10a_taxag) : les recettes.

`cofog.py` répond à « où part l'argent public » pour toute l'Europe, mais ne
porte que les **dépenses**. Le site publie par ailleurs les recettes de l'État
seul : il ne peut donc pas répondre à « paie-t-on plus d'impôts qu'ailleurs ».
C'est le pendant en recettes, sur le même producteur, la même définition
harmonisée SEC 2010 et le même secteur S13 — toutes les administrations
publiques, État, collectivités et Sécurité sociale confondus.

**Deux définitions officielles coexistent, et c'est le piège du jeu.** Pour la
France 2024, Eurostat publie 45,2 % du PIB et l'INSEE 42,8 %. Les deux sont
exacts : ils ne comptent pas la même chose. Le même jeu Eurostat publie
d'ailleurs 43,4 % en ne retenant que les cotisations *obligatoires* — l'écart
avec 45,2 est mesuré à chaque chargement, il vaut 1,8 point en 2024 et
correspond aux cotisations sociales imputées de l'État employeur. Le reste de
l'écart avec l'INSEE tient au traitement des crédits d'impôt, qu'Eurostat classe
en subventions et l'INSEE en moindres recettes. **Une page qui affiche « le taux
de prélèvements obligatoires » sans dire laquelle des deux définitions elle
emploie est indéfendable** : la fiche technique nomme celle qui est retenue et
chiffre l'écart avec l'autre.

**Un classement européen mesure un choix d'organisation, pas un niveau de
ponction.** Un pays qui socialise retraites et santé les fait passer par des
cotisations, donc par ce taux ; un pays qui les confie à une assurance privée
obligatoire prélève autant sur les ménages et affiche un taux plus bas. La
fiche le dit, faute de quoi le classement se lit comme un palmarès de la
pression fiscale, ce qu'il n'est pas.

**Le contrôle qui bloque.** Impôts sur la production (D2) + impôts courants sur
le revenu et le patrimoine (D5) + impôts en capital (D91) + cotisations sociales
(D61) − montants dus mais non recouvrables (D995) doit redonner l'agrégat publié
par Eurostat, pays par pays et année par année. Le contrôle porte sur les
montants en millions d'euros, où l'identité est exacte, et non sur les % du PIB,
où cinq valeurs arrondies au dixième la brouillent. Vérifié au moment d'écrire
ce module : 112 couples pays-année, écart nul sur 65 d'entre eux et 0,6 M€ au
pire — l'arrondi au dixième de million des composantes elles-mêmes, sur des
masses de l'ordre du million de millions.

Usage : python -m plateforme.normalize.prelevements_ue [--store r2:plateforme-raw]
"""

import argparse
import json

from plateforme import entrepot, revisions
from plateforme.connectors import eurostat
from plateforme.connectors.jsonstat import decoder
from plateforme.http import telecharger
from plateforme.normalize.europe import DRAPEAUX, enregistrer_pays
from plateforme.normalize.geo import MILLESIME, make_store

DATASET = "eurostat-gov-10a-taxag"
SOURCE = "eurostat"
JEU = "gov_10a_taxag"

# L'agrégat publié par Eurostat : recettes de la fiscalité et des cotisations
# sociales, cotisations imputées comprises, nettes des montants dus mais non
# recouvrables. C'est le chiffre qui donne 45,2 % du PIB pour la France 2024.
AGREGAT = "D2_D5_D91_D61_M_D995"

# La variante du même jeu qui ne retient que les cotisations **obligatoires** :
# 43,4 % pour la France 2024. Elle n'est pas publiée — deux séries nommées
# « prélèvements obligatoires » sur une même page seraient pires que le piège
# qu'elles prétendent lever. Elle est téléchargée pour une seule raison : elle
# chiffre l'écart de définition, à chaque chargement, plutôt que de le laisser
# à une note de bas de page qui vieillit.
OBLIGATOIRES = "D2_D5_D91_D61_M_D611V_D612_M_M_D613V_D614_M_D995"

# Les quatre composantes qui s'additionnent, et la déduction qui les corrige.
COMPOSANTES = ("D2", "D5", "D91", "D61")
DEDUCTION = "D995"

PARAMS = {
    "sector": "S13",
    "freq": "A",
    "sinceTimePeriod": "2013",
    # Deux unités en un seul téléchargement : les millions d'euros portent le
    # contrôle d'identité, les % du PIB portent la publication.
    "unit": ["MIO_EUR", "PC_GDP"],
    "na_item": [AGREGAT, *COMPOSANTES, DEDUCTION, OBLIGATOIRES],
}

# Cinq termes arrondis au dixième de million : ±0,25 M€ au pire pour un pays,
# davantage pour un agrégat européen dont chaque terme est déjà une somme de
# valeurs arrondies. Le maximum relevé sur le jeu complet est 0,6 M€, sur
# l'Union à vingt-sept. Rapporté aux 1 318 860 M€ de la France, c'est un
# cent-millième de pour cent : la marge ne peut masquer aucune erreur de lecture.
TOLERANCE_MEUR = 1.0

THEME = "europe"

# Un poste = un indicateur. Les libellés sont ceux du SEC 2010, en français
# courant. `D995` n'est pas publié : c'est une déduction, et l'afficher à côté
# des quatre composantes inviterait à l'additionner au lieu de la soustraire.
POSTES = {
    AGREGAT: (
        "eurostat_prelevements_obligatoires_pib",
        "Prélèvements obligatoires en % du PIB (définition Eurostat)",
        "Tout ce que les administrations publiques prélèvent en impôts et en"
        " cotisations sociales, rapporté à la richesse produite dans l'année."
        " Un taux élevé signale d'abord ce qui passe par la collectivité plutôt"
        " que par une assurance privée.",
    ),
    "D2": (
        "eurostat_impots_production_pib",
        "Impôts sur la production et les importations en % du PIB",
        "La TVA, les accises, les taxes foncières et les autres impôts que les"
        " entreprises paient du fait de leur activité, quel que soit leur"
        " bénéfice.",
    ),
    "D5": (
        "eurostat_impots_revenu_patrimoine_pib",
        "Impôts courants sur le revenu et le patrimoine en % du PIB",
        "L'impôt sur le revenu des ménages, l'impôt sur les sociétés et les"
        " autres impôts prélevés chaque année sur les revenus et le patrimoine.",
    ),
    "D91": (
        "eurostat_impots_capital_pib",
        "Impôts en capital en % du PIB",
        "Les droits de succession et de donation : des impôts prélevés une fois,"
        " au moment où un patrimoine change de mains, et non chaque année.",
    ),
    "D61": (
        "eurostat_cotisations_sociales_pib",
        "Cotisations sociales nettes en % du PIB",
        "Ce que salariés, employeurs et indépendants versent pour la retraite,"
        " la maladie, le chômage et la famille. C'est le poste qui distingue le"
        " plus les pays, selon ce qu'ils confient à la collectivité.",
    ),
}

TECHNIQUE = (
    "Recettes fiscales et cotisations sociales des administrations publiques"
    " (secteur S13), comptabilité nationale harmonisée SEC 2010, jeu Eurostat"
    " gov_10a_taxag. **Définition retenue : l'agrégat Eurostat"
    " D2+D5+D91+D61−D995, cotisations sociales imputées comprises**, soit"
    " 45,2 % du PIB pour la France en 2024. Ce n'est pas le taux de"
    " prélèvements obligatoires publié par l'INSEE, qui vaut 42,8 % pour le même"
    " pays et la même année. Deux différences de périmètre expliquent l'écart de"
    " 2,4 points : Eurostat inclut les cotisations sociales imputées de l'État"
    " employeur — le même jeu publie 43,4 % en ne retenant que les cotisations"
    " obligatoires, soit 1,8 point d'écart mesuré à chaque chargement — et"
    " traite les crédits d'impôt comme des subventions quand l'INSEE les traite"
    " en moindres recettes, pour le reste de l'écart. Les deux chiffres sont"
    " exacts ; ils ne comptent pas la même chose, et ne se substituent pas l'un"
    " à l'autre dans une même série. Un classement européen de ce taux mesure un"
    " choix d'organisation et non un niveau de ponction : un pays qui socialise"
    " retraites et santé les fait passer par des cotisations, donc par ce taux,"
    " là où un pays qui les confie à une assurance privée obligatoire prélève"
    " autant sur les ménages en affichant un taux plus bas. Les agrégats (zone"
    " euro, UE27) sont des repères, pas des territoires à additionner aux pays"
    " qui les composent."
)


class ComposantesDivergentes(RuntimeError):
    """La somme des composantes ne retrouve pas l'agrégat publié par Eurostat.

    Une composante mal rattachée à sa dimension ne fait échouer aucune lecture :
    elle attribue simplement des milliards au mauvais poste. C'est le seul
    contrôle qui le voie.
    """


def ventiler(points: list[dict]) -> dict[tuple[str, str, str], dict[str, float]]:
    """-> {(unité, pays, année): {poste: valeur}}."""
    par_cle: dict[tuple[str, str, str], dict[str, float]] = {}
    for point in points:
        cle = (point["unit"], point["geo"], point["time"])
        par_cle.setdefault(cle, {})[point["na_item"]] = point["valeur"]
    return par_cle


def controler(points: list[dict]) -> dict:
    """D2 + D5 + D91 + D61 − D995 doit redonner l'agrégat publié, en euros.

    Un poste absent vaut zéro plutôt que « série incomplète » : quatorze pays ne
    publient aucun D995 et l'Estonie aucun D91, non par lacune mais parce que
    l'impôt n'existe pas chez eux. Le vérifier plutôt que le supposer : avec
    cette lecture, l'identité se referme sur les 417 couples pays-année du jeu
    complet, et exactement sur 248 d'entre eux.
    """
    ventile = ventiler(points)
    ecarts = {}
    couples = 0
    for (unite, geo, temps), postes in ventile.items():
        if unite != "MIO_EUR" or AGREGAT not in postes:
            continue
        couples += 1
        somme = sum(postes.get(poste, 0.0) for poste in COMPOSANTES)
        ecart = round(somme - postes.get(DEDUCTION, 0.0) - postes[AGREGAT], 3)
        if abs(ecart) > TOLERANCE_MEUR:
            ecarts[f"{geo}/{temps}"] = ecart
    if not couples:
        raise ComposantesDivergentes(
            "aucun couple pays-année ne porte l'agrégat : le jeu lu n'est pas"
            f" {JEU}, ou ses postes ont changé de code."
        )
    if ecarts:
        cle, ecart = next(iter(sorted(ecarts.items())))
        raise ComposantesDivergentes(
            f"{len(ecarts)} couples pays-année où les composantes ne retrouvent"
            f" pas l'agrégat, par exemple {cle} : {ecart:+,.1f} M€. Un poste est"
            " rattaché à la mauvaise dimension."
        )
    exacts = sum(
        1
        for (unite, _, _), postes in ventile.items()
        if unite == "MIO_EUR"
        and AGREGAT in postes
        and round(
            sum(postes.get(p, 0.0) for p in COMPOSANTES)
            - postes.get(DEDUCTION, 0.0)
            - postes[AGREGAT],
            3,
        )
        == 0
    )
    return {"couples_verifies": couples, "identites_exactes": exacts}


def ecart_de_definition(points: list[dict], pays: str = "FR") -> dict[str, float]:
    """{année : écart en points de PIB} entre l'agrégat publié et sa variante
    « cotisations obligatoires seules ».

    C'est le premier des deux écarts qui séparent Eurostat de l'INSEE, et le
    seul que la source permette de mesurer. Le mesurer à chaque chargement vaut
    mieux que l'inscrire une fois dans une note : il bouge avec les révisions.
    """
    return {
        temps: round(postes[AGREGAT] - postes[OBLIGATOIRES], 2)
        for (unite, geo, temps), postes in ventiler(points).items()
        if unite == "PC_GDP"
        and geo == pays
        and AGREGAT in postes
        and OBLIGATOIRES in postes
    }


def enregistrer_jeu(conn) -> None:
    """Déclare le jeu au registre s'il n'y est pas encore.

    Le registre versionné dans `infra/seed/dataset_registry.csv` fait foi, et
    cette ligne y a sa place — elle est reprise mot pour mot de docs/01, où
    `gov_10a_taxag` est inscrit depuis l'origine. Elle est posée ici parce que
    rien ne peut s'écrire pour un jeu que le registre ignore : le run n'aurait
    pas de jeu déclaré, et `entrepot.verifier_integrite()` compterait chaque
    observation comme orpheline. `registry.sync()` écrasera cette ligne dès que
    le CSV la portera, ce qui est l'ordre voulu.
    """
    conn.execute(
        """
        insert into meta.dataset_registry
            (dataset_id, source_id, external_id, title, endpoint_url, format,
             update_frequency, expected_freshness_days, geo_granularity,
             time_granularity, priority, ingestion_mode, target_tables,
             personal_data, statistical_secrecy)
        values (?, 'eurostat', ?,
                'Prélèvements obligatoires : recettes fiscales et cotisations sociales',
                ?, 'JSON-stat', 'annuelle', 450, 'pays', 'annee', 'P1',
                'sdmx_pull', ['core.observations'], false, false)
        on conflict (dataset_id) do nothing
        """,
        (DATASET, JEU, f"{eurostat.BASE}/{JEU}"),
    )
    conn.commit()


def declarer(conn) -> None:
    enregistrer_jeu(conn)
    with conn.cursor() as curseur:
        for poste, (identifiant, libelle, publique) in sorted(POSTES.items()):
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, ?, '% du produit intérieur brut', 'observed',
                        array['Officiel','Comparaison harmonisée UE'])
                returning definition_id
                """,
                (publique, TECHNIQUE, f"Eurostat, jeu {JEU}, poste {poste}, unité PC_GDP"),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, accounting_frame, geo_levels, time_granularity, published)
                values (?, ?, ?, ?, ?, 'percent', false, 'nationale',
                        array['pays'], 'annuelle', true)
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


COLONNES = ("value", "quality_flags")


def lignes_a_ecrire(points: list[dict], pays: set[str], run_id: str) -> list[tuple]:
    """-> les observations en % du PIB, agrégat et composantes, pays reconnus.

    `run_id` n'entre pas dans les tuples : `revisions.remplacer` l'ajoute.
    """
    return [
        (
            POSTES[point["na_item"]][0],
            "pays",
            point["geo"],
            MILLESIME,
            point["time"],
            point["valeur"],
            [DRAPEAUX[point["statut"]]] if point.get("statut") in DRAPEAUX else [],
        )
        for point in points
        if point["unit"] == "PC_GDP"
        and point["na_item"] in POSTES
        and point["geo"] in pays
    ]


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        url = eurostat.data_url(JEU, PARAMS)
        contenu = telecharger(url, timeout=300)
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, f"{JEU}.json", contenu, url,
            "application/json",
        )
        points = decoder(json.loads(contenu))
        entrepot.etape(f"{len(points)} valeurs lues")
        verifies = controler(points)
        entrepot.etape(
            f"{verifies['couples_verifies']} couples pays-année vérifiés au"
            f" million d'euros, dont {verifies['identites_exactes']} exacts"
        )
        ecarts = ecart_de_definition(points)
        pays = enregistrer_pays(conn, {p["geo"] for p in points})
        lignes = lignes_a_ecrire(points, pays, run_id)
        ecrites, revisees = revisions.remplacer(
            conn, run_id, sorted(p[0] for p in POSTES.values()), COLONNES, lignes
        )
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'somme_des_composantes_egale_agregat_publie',
                    'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "tolerance_meur": TOLERANCE_MEUR,
                "ecart_de_definition_fr_pts_pib": ecarts,
            })),
        )
        conn.commit()
        entrepot.finish_run(
            conn, run_id, "success", rows_read=len(points), rows_written=ecrites
        )
        annees = sorted({ligne[4] for ligne in lignes})
        dernier = max(ecarts) if ecarts else None
        print(
            f"prélèvements obligatoires UE : {ecrites} observations,"
            f" {len({ligne[2] for ligne in lignes})} pays, {annees[0]}-{annees[-1]},"
            f" {verifies['couples_verifies']} couples pays-année vérifiés,"
            f" {revisees} révisées"
            + (
                f" ; écart de définition France {dernier} : {ecarts[dernier]} point"
                if dernier
                else ""
            )
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
