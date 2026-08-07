"""Les niches fiscales : 88 milliards d'euros qui ne passent par aucune dépense.

Le site publie ce que l'État dépense. Il ne disait rien de ce qu'il **renonce à
percevoir** : une exonération, un taux réduit, un crédit d'impôt coûtent aussi
cher qu'une subvention, mais n'apparaissent sur aucune ligne de dépense. Le
tome 2 des Voies et moyens, annexé au projet de loi de finances, les recense et
les chiffre. Ce module les charge.

**Ce n'est pas une dépense au sens budgétaire.** Une dépense fiscale est une
moindre recette : l'écart entre l'impôt qu'une règle générale aurait produit et
celui que la règle dérogatoire produit. Elle ne s'additionne donc pas aux
crédits votés — les deux répondent à des questions différentes, et leur somme
ne serait le total de rien.

**Ce sont des chiffrages, pas des encaissements.** Le tome 2 le dit lui-même :
sur 465 dispositifs recensés, tous ne sont pas chiffrables. Deux conventions le
signalent, et elles entrent telles quelles : « ε » marque un coût inférieur à
0,5 M€, « nc » un montant non calculé. Ces lignes sont **absentes**, pas nulles
— écrire zéro à leur place inventerait une niche gratuite.

**Les trois exercices ne se lisent pas pareil.** Le document publie un réalisé
2024 et deux prévisions, 2025 et 2026. Ils viennent du même document et de la
même évaluation : c'est la source qui est datée du PLF 2026, pas chaque chiffre
séparément. Les deux prévisions portent le drapeau `provisional`, et le bloc du
site n'annonce au présent que l'exercice réalisé.

**Le contrôle qui bloque.** Le tome 2 publie un tableau récapitulatif « Dépenses
fiscales par impôt ». Ce module en recopie les dix-sept lignes et vérifie que
les chiffrages lus, regroupés par impôt, les retrouvent — puis que le total
tombe sur les 89 406, 91 834 et 88 269 M€ publiés. Les montants viennent d'une
autre annexe du même PLF, le budget vert, qui est la seule à les publier sous
forme exploitable : le contrôle vérifie donc que les deux annexes disent la
même chose, et il attraperait un périmètre amputé — une annexe qui ne coterait
qu'une partie des niches passerait autrement inaperçue.

Usage : python -m plateforme.normalize.depenses_fiscales [--store r2:plateforme-raw]
"""

import argparse
import json
import urllib.parse

from plateforme import entrepot, revisions
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, make_store

DATASET = "plf-depenses-fiscales"
SOURCE = "data-economie"
JEU = "plf-2026-budget-vert"
BASE = f"https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/{JEU}"

# Le budget vert cote aussi les crédits budgétaires et les taxes affectées
# plafonnées. Seules les dépenses fiscales sont chargées : les crédits sont
# déjà publiés par le connecteur du budget de l'État, sur leur propre source,
# et deux jeux de chiffres sur les mêmes lignes ne s'expliqueraient pas.
TYPE = "Dépenses fiscales"

# Colonne de la source -> exercice, et ce que le chiffre est. Le document
# publie un réalisé et deux prévisions ; les confondre ferait lire une
# prévision comme un constat.
#
# Le caractère provisoire va dans `quality_flags` et non dans `value_status`,
# comme pour le chômage et l'état civil : `value_status` sert à dire qu'une
# valeur est absente ou couverte par le secret, et la publication n'exporte que
# les observations en `normal`. Une prévision marquée là serait écrite dans
# l'entrepôt sans jamais atteindre le site.
EXERCICES = {
    "execution_2024_cp": ("2024", []),
    "lfi_2025_cp_ou_prevision_2025_si_depense_fiscale": ("2025", ["provisional"]),
    "plf_2026_cp_ou_prevision_2026_si_depense_fiscale": ("2026", ["provisional"]),
}

# L'exercice dont le chiffre est un constat et non une prévision. Le site s'en
# sert pour ne pas annoncer au présent ce qui n'a pas encore eu lieu.
REALISE = "2024"

CHAMPS = (
    "mission", "numero_programme", "programme", "impot_si_depense_fiscale",
    "code_depense", "libelle", *EXERCICES,
)

# Tableau « Dépenses fiscales par impôt » du tome 2 annexé au PLF 2026, recopié
# ligne à ligne, en millions d'euros : 2024, 2025, 2026. C'est la référence du
# contrôle — elle vient du document, pas d'un calcul sur les données lues.
TOME2 = {
    "Impôt sur le revenu": (42_079, 43_980, 41_298),
    "Impôt sur le revenu et impôt sur les sociétés": (14_111, 14_558, 14_418),
    "Impôt sur les sociétés": (3_913, 4_445, 3_711),
    "Impôt sur la fortune immobilière": (205, 218, 221),
    "Retenues à la source": (5, 0, 0),
    "Droits d'enregistrement et de timbre et taxes d'urbanisme": (5_478, 4_478, 4_478),
    "Taxe sur la valeur ajoutée": (10_920, 11_005, 12_366),
    "Accise sur les produits énergétiques autres que les gaz naturels"
    " et les charbons": (6_307, 6_669, 5_824),
    "Accise sur l'électricité": (763, 1_275, 1_069),
    "Accise sur les gaz naturels": (802, 962, 641),
    "Accise sur les charbons": (16, 11, 8),
    "Autres droits": (3_367, 2_713, 2_719),
    "Cotisation sur la valeur ajoutée des entreprises": (10, 10, 7),
    "Taxe foncière sur les propriétés bâties": (648, 677, 677),
    "Taxe foncière sur les propriétés non bâties": (408, 407, 457),
    "Taxe d'habitation": (33, 51, 0),
    "Cotisation foncière des entreprises": (341, 375, 375),
}

# Le budget vert regroupe plus grossièrement que le tome 2 : ses quatre accises
# n'en font qu'une, ses impôts locaux en réunissent cinq. La correspondance est
# écrite ici pour qu'elle se relise, plutôt que devinée à l'exécution.
REGROUPEMENT = {
    "Impôt sur le revenu": ("Impôt sur le revenu",),
    "Impôt sur le revenu et impôt sur les sociétés": (
        "Impôt sur le revenu et impôt sur les sociétés",
    ),
    "Impôt sur les sociétés": ("Impôt sur les sociétés",),
    "Taxe sur la valeur ajoutée": ("Taxe sur la valeur ajoutée",),
    "Accise sur les énergies": (
        "Accise sur les produits énergétiques autres que les gaz naturels"
        " et les charbons",
        "Accise sur l'électricité",
        "Accise sur les gaz naturels",
        "Accise sur les charbons",
    ),
    "Droits d'enregistrement et de timbre": (
        "Droits d'enregistrement et de timbre et taxes d'urbanisme",
    ),
    "Autres droits": ("Autres droits",),
    "Impôts locaux": (
        "Cotisation sur la valeur ajoutée des entreprises",
        "Taxe foncière sur les propriétés bâties",
        "Taxe foncière sur les propriétés non bâties",
        "Taxe d'habitation",
        "Cotisation foncière des entreprises",
    ),
    "Autres impôts directs": (
        "Impôt sur la fortune immobilière",
        "Retenues à la source",
    ),
}

# Le budget vert porte une catégorie « Taxe d'archéologie préventive » que le
# tome 2 ne distingue pas et qui ne pèse rien sur les trois exercices. Elle est
# comptée dans le total et n'a pas d'indicateur à elle : publier une série de
# zéros donnerait à croire qu'un dispositif s'est éteint.
SANS_INDICATEUR = ("Taxe d'archéologie préventive",)

MILLIONS = 1_000_000
TOTAL = "depense_fiscale_totale"
THEME = "depenses_fiscales"

# Catégorie du budget vert -> (identifiant, libellé publié).
INDICATEURS = {
    "Impôt sur le revenu": (
        "depense_fiscale_impot_revenu", "Niches fiscales sur l'impôt sur le revenu",
    ),
    "Impôt sur le revenu et impôt sur les sociétés": (
        "depense_fiscale_impot_revenu_societes",
        "Niches fiscales communes à l'impôt sur le revenu et sur les sociétés",
    ),
    "Impôt sur les sociétés": (
        "depense_fiscale_impot_societes", "Niches fiscales sur l'impôt sur les sociétés",
    ),
    "Taxe sur la valeur ajoutée": (
        "depense_fiscale_tva", "Niches fiscales sur la TVA",
    ),
    "Accise sur les énergies": (
        "depense_fiscale_accises_energie", "Niches fiscales sur les accises énergie",
    ),
    "Droits d'enregistrement et de timbre": (
        "depense_fiscale_enregistrement",
        "Niches fiscales sur les droits d'enregistrement et de timbre",
    ),
    "Autres droits": (
        "depense_fiscale_autres_droits", "Niches fiscales sur les autres droits",
    ),
    "Impôts locaux": (
        "depense_fiscale_impots_locaux", "Niches fiscales sur les impôts locaux",
    ),
    "Autres impôts directs": (
        "depense_fiscale_autres_impots_directs",
        "Niches fiscales sur les autres impôts directs",
    ),
}

PUBLIQUE = {
    TOTAL: "Ce que l'État renonce à percevoir en un an au titre des exonérations,"
    " taux réduits et crédits d'impôt. Ce n'est pas une dépense : c'est un impôt"
    " qui n'est pas encaissé, et qui n'apparaît sur aucune ligne du budget.",
    "depense_fiscale_impot_revenu": "Ce que les niches sur l'impôt sur le revenu"
    " coûtent en un an : crédit d'impôt pour un salarié à domicile, frais de garde,"
    " dons, abattement sur les pensions.",
    "depense_fiscale_impot_revenu_societes": "Ce que coûtent en un an les niches qui"
    " valent à la fois pour l'impôt sur le revenu et pour l'impôt sur les sociétés,"
    " au premier rang desquelles le crédit d'impôt recherche.",
    "depense_fiscale_impot_societes": "Ce que les niches propres à l'impôt sur les"
    " sociétés coûtent en un an : régimes particuliers d'imposition et crédits"
    " d'impôt sectoriels.",
    "depense_fiscale_tva": "Ce que les taux réduits et exonérations de TVA coûtent"
    " en un an : travaux dans le logement, restauration, secteurs aidés.",
    "depense_fiscale_accises_energie": "Ce que les exonérations et tarifs réduits"
    " d'accise sur l'électricité, le gaz, les carburants et les charbons coûtent"
    " en un an.",
    "depense_fiscale_enregistrement": "Ce que les exonérations de droits"
    " d'enregistrement, de timbre et de taxes d'urbanisme coûtent en un an, dont"
    " les transmissions d'entreprises.",
    "depense_fiscale_autres_droits": "Ce que coûtent en un an les niches portant"
    " sur les droits qui n'entrent dans aucune des autres catégories du document.",
    "depense_fiscale_impots_locaux": "Ce que les exonérations d'impôts locaux"
    " coûtent en un an à l'État, qui les compense : taxes foncières, taxe"
    " d'habitation, fiscalité économique.",
    "depense_fiscale_autres_impots_directs": "Ce que les niches sur les autres"
    " impôts directs coûtent en un an, principalement l'impôt sur la fortune"
    " immobilière.",
}

TECHNIQUE = (
    "Dépenses fiscales chiffrées dans le tome 2 des Évaluations des voies et"
    " moyens, annexé au projet de loi de finances pour 2026. Une dépense fiscale"
    " est une **moindre recette** : l'écart entre l'impôt qu'une règle générale"
    " aurait produit et celui que produit la règle dérogatoire. Elle ne"
    " s'additionne donc pas aux crédits budgétaires votés, publiés par ailleurs"
    " sur ce site : leur somme ne serait le total de rien. Les montants sont des"
    " chiffrages et non des encaissements ; le document en signale lui-même la"
    " fiabilité inégale. Le coût 2024 est un réalisé, ceux de 2025 et 2026 des"
    " prévisions, tous trois évalués à la date du projet de loi de finances pour"
    " 2026. Les dispositifs dont le coût est inférieur à 0,5 M€ (« ε ») ou non"
    " calculé (« nc ») sont absents et non nuls. Les montants détaillés"
    " proviennent du rapport sur l'impact environnemental du budget de l'État,"
    " seule annexe du même projet de loi à les publier sous forme exploitable ;"
    " leur regroupement par impôt est vérifié contre le tableau récapitulatif du"
    " tome 2."
)


class ChiffrageRompu(RuntimeError):
    """Les chiffrages lus ne retrouvent pas le tableau publié du tome 2."""


def url() -> str:
    """L'export JSON du budget vert, restreint aux dépenses fiscales."""
    clause = f"type_depense = '{TYPE}'"
    return (
        f"{BASE}/exports/json?where={urllib.parse.quote(clause)}"
        f"&select={urllib.parse.quote(','.join(CHAMPS))}"
    )


def lire(contenu: bytes) -> list[dict]:
    """-> les lignes de dépense fiscale, telles que la source les publie.

    Une même dépense fiscale peut occuper plusieurs lignes : le budget vert la
    scinde quand sa cotation environnementale diffère d'une part à l'autre, et
    chaque part porte alors sa fraction du coût. Les lignes sont donc gardées
    telles quelles ici, et regroupées par numéro plus loin — sommer sans
    regrouper afficherait un dispositif au tiers de son coût.
    """
    lignes = []
    for rang in json.loads(contenu):
        code = (rang.get("code_depense") or "").strip()
        if not code:
            continue
        montants = {}
        for colonne, (exercice, drapeaux) in EXERCICES.items():
            valeur = rang.get(colonne)
            if valeur is None:
                continue
            montants[exercice] = (float(valeur), drapeaux)
        lignes.append({
            "code": code,
            "libelle": (rang.get("libelle") or "").strip(),
            "impot": (rang.get("impot_si_depense_fiscale") or "").strip(),
            "mission": (rang.get("mission") or "").strip() or None,
            "programme": (rang.get("programme") or "").strip() or None,
            "numero_programme": rang.get("numero_programme"),
            "montants": montants,
        })
    return lignes


def par_impot(lignes: list[dict]) -> dict[tuple[str, str], float]:
    """-> {(catégorie d'impôt, exercice): coût en euros}."""
    totaux: dict[tuple[str, str], float] = {}
    for ligne in lignes:
        for exercice, (montant, _) in ligne["montants"].items():
            cle = (ligne["impot"], exercice)
            totaux[cle] = totaux.get(cle, 0.0) + montant
    return totaux


def par_dispositif(lignes: list[dict]) -> dict[str, dict]:
    """-> {numéro de dépense fiscale: dispositif consolidé}.

    Les parts qu'une cotation environnementale a séparées sont recollées : le
    coût d'un dispositif est celui du dispositif entier.
    """
    dispositifs: dict[str, dict] = {}
    for ligne in lignes:
        dispositif = dispositifs.setdefault(ligne["code"], {
            "code": ligne["code"], "libelle": ligne["libelle"], "impot": ligne["impot"],
            "mission": ligne["mission"], "programme": ligne["programme"],
            "numero_programme": ligne["numero_programme"], "montants": {},
        })
        for exercice, (montant, statut) in ligne["montants"].items():
            cumul, _ = dispositif["montants"].get(exercice, (0.0, statut))
            dispositif["montants"][exercice] = (cumul + montant, statut)
    return dispositifs


def controler(lignes: list[dict]) -> dict:
    """Les chiffrages lus retrouvent le tableau par impôt publié dans le tome 2.

    Le contrôle porte sur deux annexes différentes du même projet de loi : les
    montants viennent du budget vert, la référence du tome 2. S'il tient, c'est
    que le budget vert cote bien **toutes** les dépenses fiscales chiffrées, et
    pas une partie — un périmètre amputé ne se verrait sur aucun total interne,
    puisque la somme de ce qu'on a lu est toujours égale à elle-même.
    """
    lus = par_impot(lignes)
    categories = {ligne["impot"] for ligne in lignes}
    inconnues = categories - set(REGROUPEMENT) - set(SANS_INDICATEUR)
    if inconnues:
        raise ChiffrageRompu(
            f"catégories d'impôt que la correspondance ne connaît pas :"
            f" {', '.join(sorted(inconnues))}. Le regroupement vers le tableau du"
            " tome 2 ne serait plus complet, et un impôt entier manquerait au"
            " contrôle sans manquer au total."
        )
    verifies = {}
    for categorie, composants in sorted(REGROUPEMENT.items()):
        for rang, exercice in enumerate(("2024", "2025", "2026")):
            attendu = sum(TOME2[nom][rang] for nom in composants) * MILLIONS
            trouve = lus.get((categorie, exercice), 0.0)
            if round(trouve) != round(attendu):
                raise ChiffrageRompu(
                    f"{categorie} en {exercice} : {trouve:,.0f} € lus contre"
                    f" {attendu:,.0f} € publiés au tome 2. Les deux annexes du"
                    " même projet de loi ne disent pas la même chose."
                )
            verifies[f"{categorie}/{exercice}"] = round(trouve)
    for rang, exercice in enumerate(("2024", "2025", "2026")):
        attendu = sum(valeurs[rang] for valeurs in TOME2.values()) * MILLIONS
        trouve = sum(
            montant for (_, an), montant in lus.items() if an == exercice
        )
        if round(trouve) != round(attendu):
            raise ChiffrageRompu(
                f"total {exercice} : {trouve:,.0f} € lus contre {attendu:,.0f} €"
                " publiés au tome 2."
            )
    return {
        "categories_verifiees": len(REGROUPEMENT),
        "exercices_verifies": 3,
        "totaux": {
            exercice: round(sum(
                montant for (_, an), montant in lus.items() if an == exercice
            ))
            for exercice in ("2024", "2025", "2026")
        },
        "dispositifs": len(par_dispositif(lignes)),
        "lignes_source": len(lignes),
        **verifies,
    }


# `revisions.remplacer` attend : cinq clés, puis ces colonnes-là.
COLONNES = ("value", "quality_flags")


def lignes_a_ecrire(lignes: list[dict]) -> list[tuple]:
    """-> les observations nationales : un total, neuf catégories d'impôt."""
    lus = par_impot(lignes)
    drapeaux = {exercice: liste for exercice, liste in EXERCICES.values()}
    ecrites = []
    for exercice in ("2024", "2025", "2026"):
        montants = [montant for (_, an), montant in lus.items() if an == exercice]
        # Un exercice qu'aucun dispositif ne chiffre n'a pas un coût nul : il
        # n'a pas de coût connu. Publier zéro annoncerait la fin des niches.
        if not montants:
            continue
        ecrites.append((TOTAL, "pays", "FR", MILLESIME, exercice, sum(montants),
                        drapeaux[exercice]))
        for categorie, (identifiant, _) in sorted(INDICATEURS.items()):
            montant = lus.get((categorie, exercice))
            if montant is None:
                continue
            ecrites.append((identifiant, "pays", "FR", MILLESIME, exercice, montant,
                            drapeaux[exercice]))
    return ecrites


def declarer(conn) -> None:
    publies = [(TOTAL, "Coût total des niches fiscales")]
    publies += [(identifiant, libelle) for identifiant, libelle in INDICATEURS.values()]
    with conn.cursor() as curseur:
        for identifiant, libelle in publies:
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, 'Chiffrage du tome 2 des Voies et moyens, PLF 2026',
                        'euros courants', 'estimated', array['Officiel','Estimation'])
                returning definition_id
                """,
                (PUBLIQUE[identifiant], TECHNIQUE),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, price_basis, accounting_frame, geo_levels,
                     time_granularity, published)
                values (?, ?, ?, ?, ?, 'EUR', false, 'current', 'budgetaire',
                        array['pays'], 'annuelle', true)
                on conflict (indicator_id) do update set unit = excluded.unit,
                    definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                    theme = excluded.theme, published = true
                """,
                (identifiant, DATASET, definition, THEME, libelle),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def ecrire_dispositifs(conn, run_id: str, lignes: list[dict]) -> int:
    """Le détail dispositif par dispositif, dans les lignes budgétaires.

    Le type de budget est `PLF` : ces chiffrages sont ceux d'un projet de loi de
    finances, pas d'une loi votée ni d'une exécution. C'est aussi ce qui les
    tient à l'écart des budgets écrits par le connecteur de l'État, qui n'écrit
    que des `LFI` et des `LFR` — deux connecteurs, deux périmètres, aucune
    ligne partagée.
    """
    conn.execute(
        "delete from fin.public_budget_lines where budget_id in"
        " (select budget_id from fin.public_budgets where dataset_id = ?)",
        (DATASET,),
    )
    conn.execute("delete from fin.public_budgets where dataset_id = ?", (DATASET,))
    dispositifs = par_dispositif(lignes)
    ecrites = 0
    for exercice in ("2024", "2025", "2026"):
        budget_id = conn.execute(
            """
            insert into fin.public_budgets
                (geo_level, geo_code, geo_vintage, budget_type, entity_kind,
                 fiscal_year, accounting_frame, stage, dataset_id, run_id)
            values ('pays', 'FR', ?, 'PLF', 'etat', ?, 'budgetaire', ?, ?, ?)
            returning budget_id
            """,
            (MILLESIME, int(exercice),
             "execute" if exercice == REALISE else "vote", DATASET, run_id),
        ).fetchone()[0]
        for dispositif in sorted(dispositifs.values(), key=lambda d: d["code"]):
            montant = dispositif["montants"].get(exercice)
            if montant is None:
                continue
            conn.execute(
                """
                insert into fin.public_budget_lines
                    (budget_id, fiscal_year, side, mission, programme, chapitre,
                     line_kind, amount, label)
                values (?, ?, 'depense', ?, ?, ?, 'depense_fiscale', ?, ?)
                """,
                (
                    budget_id, int(exercice), dispositif["mission"],
                    dispositif["programme"], dispositif["code"], montant[0],
                    dispositif["libelle"],
                ),
            )
            ecrites += 1
    return ecrites


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        garde_fou_volume(conn)
        adresse = url()
        contenu = telecharger(adresse, timeout=300)
        entrepot.etape(f"{len(contenu) // 1024} Ko reçus")
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "depenses-fiscales.json", contenu,
            adresse, "application/json",
        )
        lignes = lire(contenu)
        entrepot.etape(f"{len(lignes)} lignes lues")
        if not lignes:
            raise ValueError("aucune ligne lue")
        verifies = controler(lignes)
        ecrites, revisees = revisions.remplacer(
            conn, run_id,
            [TOTAL, *(identifiant for identifiant, _ in INDICATEURS.values())],
            COLONNES, lignes_a_ecrire(lignes),
        )
        detaillees = ecrire_dispositifs(conn, run_id, lignes)
        entrepot.etape(f"{ecrites} observations, {detaillees} lignes de détail")
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'le_budget_vert_retrouve_le_tome_2', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps(verifies)),
        )
        conn.commit()
        entrepot.finish_run(
            conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites
        )
        totaux = verifies["totaux"]
        print(
            f"dépenses fiscales : {ecrites} observations, {detaillees} dispositifs"
            f" détaillés, {revisees} valeurs révisées ;"
            f" total {totaux['2024'] / 1e9:.1f} Md€ en 2024,"
            f" {totaux['2026'] / 1e9:.1f} Md€ prévus en 2026,"
            f" {verifies['categories_verifiees']} catégories d'impôt vérifiées"
            " contre le tome 2"
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
