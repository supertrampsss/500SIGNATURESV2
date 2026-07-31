"""Budget de l'État : voté, rectifié, exécuté (DGFiP) vers fin.* et core.*.

Ce connecteur répond à la question la plus fréquente du produit — « où va
l'argent de l'État ? » — en publiant, exercice par exercice, ce que la loi de
finances a prévu et ce que l'État a réellement encaissé et décaissé. Les deux
montants viennent du même fichier et de la même nomenclature : l'écart entre
voté et exécuté est donc lisible sans rapprochement acrobatique.

**Cadre comptable.** Comptabilité budgétaire, État seul. Le solde budgétaire
n'est pas le déficit public au sens de Maastricht, qui couvre toutes les
administrations publiques et relève de la comptabilité nationale : en 2025, le
premier vaut −124 Md€, le second bien davantage. Les deux séries sont publiées
côte à côte mais ne sont jamais additionnées ni substituées l'une à l'autre.

**Contrôles.** Deux familles, aux conséquences différentes :

- l'*identité du solde* (recettes − dépenses − prélèvements sur recettes +
  soldes annexes) est bloquante : si elle ne se referme pas, le run échoue
  plutôt que de publier un budget faux ;
- la *décomposition des totaux* met en quarantaine les seules composantes en
  cause. Le fichier du producteur contient au moins une erreur réelle — la
  répartition des prélèvements sur recettes de la LFI 2022 y est corrompue —
  et une cellule fausse en 2022 ne doit pas empêcher de publier treize
  exercices vérifiés.

Usage : python -m plateforme.normalize.etat [--store r2:plateforme-raw]
"""

import argparse
import json

from psycopg.types.json import Jsonb

from plateforme import db
from plateforme.connectors import smb
from plateforme.http import fetch
from plateforme.normalize.geo import MILLESIME, make_store

DATASET = "execution-budget-etat"
SOURCE = "data-economie"

# L'exécution n'est pas un texte de loi : `budget_type` désigne le texte de
# référence de l'exercice, `stage` dit à quel moment de sa vie le montant est
# constaté. C'est la colonne `dataset_id` de la ligne qui nomme la source réelle.
TYPE_EXECUTION = ("LFI", "execute")

INDICATEURS = {
    "etat_solde_budgetaire": {
        "libelle": "Solde budgétaire de l'État",
        "public": "Ce qui manque à l'État sur une année entre ses encaissements et ses"
        " décaissements. Ce n'est pas le déficit public : celui-ci couvre aussi la"
        " Sécurité sociale et les collectivités, et se calcule autrement.",
        "technique": "Solde d'exécution des lois de finances, comptabilité budgétaire,"
        " budget général, budgets annexes et comptes spéciaux.",
    },
    "etat_recettes_nettes_bg": {
        "libelle": "Recettes nettes du budget général",
        "public": "Ce que l'État encaisse en un an, une fois retirés les remboursements"
        " et dégrèvements d'impôts qu'il reverse aux contribuables.",
        "technique": "Recettes fiscales nettes et recettes non fiscales du budget général,"
        " hors fonds de concours.",
    },
    "etat_recettes_fiscales": {
        "libelle": "Recettes fiscales nettes",
        "public": "Le produit des impôts revenant à l'État, après remboursements et"
        " dégrèvements. Les cotisations sociales n'en font pas partie : elles financent"
        " la Sécurité sociale, pas l'État.",
        "technique": "Recettes fiscales nettes du budget général, comptabilité budgétaire.",
    },
    "etat_impot_revenu": {
        "libelle": "Impôt sur le revenu",
        "public": "Ce que rapporte à l'État l'impôt sur le revenu des personnes, net des"
        " remboursements.",
        "technique": "Ligne de recette « impôt sur le revenu », nette, budget général.",
    },
    "etat_impot_societes": {
        "libelle": "Impôt sur les sociétés",
        "public": "Ce que rapporte à l'État l'impôt payé par les entreprises sur leurs"
        " bénéfices, net des remboursements.",
        "technique": "Ligne de recette « impôt sur les sociétés », nette, budget général.",
    },
    "etat_tva": {
        "libelle": "Taxe sur la valeur ajoutée (part de l'État)",
        "public": "La part de TVA qui revient à l'État. Une fraction importante du produit"
        " total de la TVA est affectée ailleurs, notamment à la Sécurité sociale : ce"
        " montant n'est donc pas toute la TVA.",
        "technique": "Ligne de recette « taxe sur la valeur ajoutée », nette, budget"
        " général, hors fractions affectées à d'autres administrations.",
    },
    "etat_ticpe": {
        "libelle": "Taxe sur les produits énergétiques (part de l'État)",
        "public": "La part revenant à l'État de la taxe sur les carburants et les énergies."
        " Le reste est affecté aux régions, aux départements et au financement de la"
        " transition énergétique.",
        "technique": "Ligne de recette « taxe intérieure de consommation sur les produits"
        " énergétiques », nette, budget général.",
    },
    "etat_recettes_non_fiscales": {
        "libelle": "Recettes non fiscales",
        "public": "Ce que l'État encaisse sans lever l'impôt : dividendes des entreprises"
        " qu'il détient, amendes, redevances, produits de son patrimoine.",
        "technique": "Recettes non fiscales du budget général, comptabilité budgétaire.",
    },
    "etat_depenses_nettes_bg": {
        "libelle": "Dépenses nettes du budget général",
        "public": "Ce que l'État décaisse en un an, une fois retirés les remboursements"
        " d'impôts. Les prélèvements reversés aux collectivités et à l'Union européenne"
        " n'y figurent pas : ils sont comptés à part.",
        "technique": "Dépenses nettes du budget général, crédits de paiement consommés,"
        " tous titres.",
    },
    "etat_depenses_personnel": {
        "libelle": "Dépenses de personnel de l'État",
        "public": "Les salaires, cotisations et pensions des agents de l'État. Cela ne"
        " couvre ni les hôpitaux ni les agents des collectivités, qui ont leurs propres"
        " budgets.",
        "technique": "Titre 2 du budget général, crédits de paiement consommés.",
    },
    "etat_charge_dette": {
        "libelle": "Charge de la dette de l'État",
        "public": "Les intérêts que l'État verse chaque année à ses créanciers. Le"
        " remboursement du capital emprunté n'y figure pas : il est refinancé par de"
        " nouveaux emprunts.",
        "technique": "Titre 4 du budget général, charges de la dette, crédits de paiement.",
    },
    "etat_psr_collectivites": {
        "libelle": "Prélèvement sur recettes au profit des collectivités",
        "public": "La part des recettes de l'État reversée directement aux communes,"
        " départements et régions. Elle n'apparaît pas dans les dépenses de l'État :"
        " elle est retirée de ses recettes.",
        "technique": "Prélèvement sur recettes au profit des collectivités territoriales,"
        " comptabilité budgétaire.",
    },
    "etat_psr_union_europeenne": {
        "libelle": "Prélèvement sur recettes au profit de l'Union européenne",
        "public": "La contribution de la France au budget de l'Union européenne, prélevée"
        " sur les recettes de l'État. Elle ne mesure pas ce que la France reçoit en"
        " retour de l'Union.",
        "technique": "Prélèvement sur recettes au profit de l'Union européenne,"
        " comptabilité budgétaire.",
    },
    "etat_remboursements_impots_etat": {
        "libelle": "Remboursements et dégrèvements d'impôts d'État",
        "public": "Les sommes rendues aux contribuables : trop-perçus, crédits d'impôt,"
        " remboursements de TVA. Elles sont déduites des recettes, ce qui explique que"
        " les recettes « nettes » soient inférieures aux impôts encaissés.",
        "technique": "Mission « Remboursements et dégrèvements », part impôts d'État,"
        " crédits de paiement consommés.",
    },
    "etat_solde_comptes_speciaux": {
        "libelle": "Solde des comptes spéciaux",
        "public": "Le résultat des comptes que l'État tient à part de son budget général :"
        " avances aux collectivités, participations financières, pensions. Un solde"
        " négatif dégrade le solde budgétaire d'autant.",
        "technique": "Solde des comptes d'affectation spéciale et des comptes de concours"
        " financiers, comptabilité budgétaire.",
    },
}


def collecter(conn, store, run_id: str) -> dict[str, bytes]:
    """Les trois pièces jointes et les records de l'API, archivés avant lecture."""
    contenus: dict[str, bytes] = {}
    for nom in smb.PIECES_JOINTES:
        url = smb.url_piece_jointe(nom)
        contenu = fetch(url, timeout=180).content
        db.record_asset(
            conn, store, run_id, DATASET, SOURCE, f"{nom}.csv", contenu, url, "text/csv"
        )
        contenus[nom] = contenu
    url = smb.RECORDS_URL
    contenu = fetch(url, timeout=180).content
    db.record_asset(
        conn, store, run_id, DATASET, SOURCE, "records.json", contenu, url, "application/json"
    )
    contenus["records"] = contenu
    return contenus


def exercices(contenus: dict[str, bytes]) -> tuple[dict[str, dict], str | None]:
    """-> ({exercice: {ligne: montant}} pour les exercices clos, dernier mois connu).

    Seule la colonne de décembre vaut montant annuel : les colonnes des autres
    mois portent un cumul depuis janvier, qu'il serait faux de comparer à une
    année entière.
    """
    mensuel = smb.series_mensuelles(contenus["series_longues"])
    mensuel.update(smb.series_records(json.loads(contenus["records"])["results"]))
    clos = {
        periode[:4]: valeurs for periode, valeurs in mensuel.items() if periode.endswith("-12")
    }
    return clos, max(mensuel, default=None)


def textes(contenus: dict[str, bytes]) -> dict[tuple[str, str], dict]:
    resultat: dict[tuple[str, str], dict] = {}
    for nom in ("textes_2013_2023", "textes_courants"):
        resultat.update(smb.textes_legislatifs(contenus[nom]))
    return resultat


def recouper_execution(
    clos: dict[str, dict], votes: dict[tuple[str, str], dict]
) -> dict[str, list[str]]:
    """Deux fichiers du même producteur donnent l'exécution annuelle : les
    séries mensuelles (colonne de décembre) et la colonne « Exécution » des
    textes législatifs. Elles doivent coïncider.

    -> {exercice: lignes qui divergent}. C'est ce recoupement qui a révélé que
    la seconde porte, pour 2019 à 2021, les dépenses de l'exercice précédent.
    """
    divergences: dict[str, list[str]] = {}
    for annee, mensuel in clos.items():
        annuel = votes.get((smb.EXECUTION, annee))
        if not annuel:
            continue
        ecarts = [
            libelle
            for libelle, montant in annuel.items()
            if libelle in mensuel and abs(mensuel[libelle] - montant) > smb.TOLERANCE_EUR
        ]
        if ecarts:
            divergences[annee] = sorted(ecarts)
    return divergences


def verifier(valeurs: dict[str, float], fonds_de_concours: bool) -> tuple[float, list[str]]:
    """-> (écart de l'identité du solde, totaux dont la décomposition ne ferme pas)."""
    ecarts = smb.controles(valeurs, fonds_de_concours)
    solde = ecarts.pop("solde_budgetaire", 0.0)
    quarantaine = [total for total, ecart in ecarts.items() if abs(ecart) > smb.TOLERANCE_EUR]
    return solde, quarantaine


def _composantes_ecartees(quarantaine: list[str]) -> set[str]:
    """Les composantes d'un total qui ne se recompose pas ne sont pas publiées :
    le total, lui, reste couvert par l'identité du solde."""
    ecartees: set[str] = set()
    for total, composantes in smb.SOUS_TOTAUX.items():
        if smb.normaliser(total) in quarantaine:
            ecartees |= {smb.normaliser(c) for c in composantes}
    return ecartees


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for indicateur, fiche in INDICATEURS.items():
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, confidence_level, badges)
                values (%s, %s, 'Situation mensuelle budgétaire de l''État, colonne de'
                        ' décembre de l''exercice', 'observed',
                        array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (fiche["public"], fiche["technique"]),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, price_basis, accounting_frame, geo_levels,
                     time_granularity, published)
                values (%s, %s, %s, 'budget_etat', %s, 'EUR', false, 'current',
                        'budgetaire', array['pays'], 'annuelle', true)
                on conflict (indicator_id) do update set
                    definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                    theme = excluded.theme, accounting_frame = excluded.accounting_frame,
                    published = true
                """,
                (indicateur, DATASET, definition, fiche["libelle"]),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def _inserer_budget(
    conn, run_id: str, annee: str, type_budget: str, etape: str, valeurs: dict, ecartees: set[str]
) -> int:
    budget_id = conn.execute(
        """
        insert into fin.public_budgets
            (geo_level, geo_code, geo_vintage, budget_type, entity_kind, fiscal_year,
             accounting_frame, stage, dataset_id, run_id,
             balance, special_accounts_balance, annexed_budgets_balance)
        values ('pays', 'FR', %s, %s, 'etat', %s, 'budgetaire', %s, %s, %s, %s, %s, %s)
        returning budget_id
        """,
        (
            MILLESIME, type_budget, int(annee), etape, DATASET, run_id,
            valeurs.get(smb.normaliser(smb.SOLDE)),
            valeurs.get(smb.normaliser("Solde des comptes spéciaux")),
            valeurs.get(smb.normaliser("Solde des Budgets annexes")),
        ),
    ).fetchone()[0]
    lignes = 0
    for libelle, montant in valeurs.items():
        ligne = smb.LIGNES[libelle]
        # Les soldes ne sont pas des lignes budgétaires : ils sont portés par
        # le budget lui-même. Les totaux, eux, sont publiés mais marqués.
        if ligne.cote is None or libelle in ecartees:
            continue
        conn.execute(
            """
            insert into fin.public_budget_lines
                (budget_id, fiscal_year, side, titre, line_kind, ae, cp, amount, label)
            values (%s, %s, %s, %s, %s, null, %s, %s, %s)
            """,
            (
                budget_id, int(annee), ligne.cote, ligne.titre, ligne.genre,
                montant if ligne.cote == "depense" else None,
                montant if ligne.cote == "recette" else None,
                ligne.libelle,
            ),
        )
        lignes += 1
    return lignes


def ecrire(conn, run_id: str, clos: dict[str, dict], votes: dict[tuple[str, str], dict]) -> dict:
    """Reconstruit intégralement le budget de l'État : un seul connecteur écrit
    ces lignes, une reconstruction est plus simple à vérifier qu'une fusion."""
    conn.execute("delete from fin.public_budgets where entity_kind = 'etat'")
    resume = {"budgets": 0, "lignes": 0, "quarantaine": {}, "observations": 0}

    for annee, valeurs in sorted(clos.items()):
        solde, quarantaine = verifier(valeurs, fonds_de_concours=True)
        if abs(solde) > smb.TOLERANCE_EUR:
            raise ValueError(
                f"exercice {annee} : le solde budgétaire publié ne se déduit pas de ses"
                f" composantes (écart {solde:,.0f} €)"
            )
        if quarantaine:
            resume["quarantaine"][f"{annee}/execute"] = quarantaine
        type_budget, etape = TYPE_EXECUTION
        resume["lignes"] += _inserer_budget(
            conn, run_id, annee, type_budget, etape, valeurs, _composantes_ecartees(quarantaine)
        )
        resume["budgets"] += 1

    for (texte, annee), valeurs in sorted(votes.items()):
        if texte not in smb.ETAPES:
            continue  # « Exécution » : lue dans les séries mensuelles, recoupée plus haut
        type_budget, etape = smb.ETAPES[texte]
        solde, quarantaine = verifier(valeurs, fonds_de_concours=False)
        if abs(solde) > smb.TOLERANCE_EUR:
            raise ValueError(
                f"{texte} {annee} : le solde voté ne se déduit pas de ses composantes"
                f" (écart {solde:,.0f} €)"
            )
        if quarantaine:
            resume["quarantaine"][f"{annee}/{etape}"] = quarantaine
        resume["lignes"] += _inserer_budget(
            conn, run_id, annee, type_budget, etape, valeurs, _composantes_ecartees(quarantaine)
        )
        resume["budgets"] += 1

    resume["observations"] = _ecrire_observations(conn, run_id, clos)
    conn.commit()
    return resume


def _ecrire_observations(conn, run_id: str, clos: dict[str, dict]) -> int:
    """Séries nationales annuelles, tirées de la seule exécution : un montant
    voté est une décision, pas une observation."""
    lignes = [
        (smb.LIGNES[libelle].indicateur, "pays", "FR", MILLESIME, annee, montant, [], run_id)
        for annee, valeurs in clos.items()
        for libelle, montant in valeurs.items()
        if smb.LIGNES[libelle].indicateur
    ]
    conn.execute(
        "delete from core.observations where indicator_id = any(%s)", (list(INDICATEURS),)
    )
    with conn.cursor() as curseur, curseur.copy(
        "copy core.observations (indicator_id, geo_level, geo_code, geo_vintage,"
        " period, value, quality_flags, run_id) from stdin"
    ) as copie:
        for ligne in lignes:
            copie.write_row(ligne)
    return len(lignes)


def tracer_controles(conn, run_id: str, resume: dict, divergences: dict) -> None:
    controles = [
        ("identite_solde_budgetaire", "blocker", True, {"budgets_verifies": resume["budgets"]}),
        ("decomposition_des_totaux", "warning", not resume["quarantaine"], resume["quarantaine"]),
        ("execution_recoupee_entre_fichiers", "warning", not divergences, divergences),
    ]
    for nom, severite, passe, observe in controles:
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (%s, %s, %s, %s, %s, %s)
            """,
            (run_id, DATASET, nom, severite, passe, Jsonb(observe)),
        )
    conn.commit()


def run(store_spec: str) -> int:
    conn = db.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = db.start_run(conn, DATASET, "manual")
    try:
        contenus = collecter(conn, store, run_id)
        clos, dernier_mois = exercices(contenus)
        votes = textes(contenus)
        inconnues = sorted(
            {
                libelle
                for valeurs in list(clos.values()) + list(votes.values())
                for libelle in smb.lignes_inconnues(valeurs)
            }
        )
        if inconnues:
            raise ValueError(f"lignes non classées par le connecteur : {', '.join(inconnues)}")
        textes_inconnus = sorted(
            {texte for texte, _ in votes if texte not in smb.ETAPES and texte != smb.EXECUTION}
        )
        if textes_inconnus:
            raise ValueError(
                f"textes budgétaires non reconnus : {', '.join(textes_inconnus)}"
            )
        divergences = recouper_execution(clos, votes)
        resume = ecrire(conn, run_id, clos, votes)
        tracer_controles(conn, run_id, resume, divergences)
        db.finish_run(conn, run_id, "success", rows_written=resume["lignes"])
        print(
            f"budget de l'État : {resume['budgets']} budgets, {resume['lignes']} lignes,"
            f" {resume['observations']} observations"
        )
        if dernier_mois and not dernier_mois.endswith("-12"):
            print(
                f"exercice {dernier_mois[:4]} en cours (cumul connu à {dernier_mois}) :"
                " non publié, un cumul partiel ne se compare pas à une année entière"
            )
        for cle, totaux in resume["quarantaine"].items():
            print(f"quarantaine {cle} : {', '.join(totaux)} — décomposition non publiée")
        for annee, lignes in divergences.items():
            print(
                f"recoupement {annee} : {', '.join(lignes)} — les deux fichiers du"
                " producteur divergent, seules les séries mensuelles sont publiées"
            )
        return 0
    except Exception as error:  # noqa: BLE001 — tout échec finit tracé dans le lineage
        db.finish_run(conn, run_id, "failed", error=str(error))
        raise
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--store", default=".snapshots")
    return run(parser.parse_args().store)


if __name__ == "__main__":
    raise SystemExit(main())
