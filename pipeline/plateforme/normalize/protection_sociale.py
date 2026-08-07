"""Comptes de la protection sociale (DREES) : la première dépense publique.

Le site publie le budget de l'État — 436,7 Md€ nets. Il ne disait rien des
**932,5 Md€** de prestations de protection sociale versées en 2024. Tant que ce
chiffre manque, la fiche nationale laisse croire que l'État est le principal
payeur de la dépense publique française, et « où va mon argent » n'a pas de
réponse honnête. Ce module charge le total et ses six risques : vieillesse-survie
426,7 Md€, santé 338,9, famille 65,8, emploi 51,1, pauvreté-exclusion 34,0,
logement 16,1.

**Ce ne sont pas les crédits de l'État.** Ce sont des prestations versées, tous
régimes confondus — Sécurité sociale, régimes complémentaires obligatoires,
État, collectivités, hôpitaux, mutuelles et institutions de prévoyance — en
comptabilité **nationale**. Le budget de l'État publié à côté est un vote de
crédits sur un périmètre État seul, en comptabilité budgétaire. Les deux sont
justes, ils ne mesurent pas la même chose, et aucune soustraction entre eux n'a
de sens. Ce n'est pas non plus le solde de la Sécurité sociale déjà publié ici
(`eurostat_secu_*`, en % du PIB) : celui-là est un solde, celui-ci une dépense.

**Deux hiérarchies indépendantes, chacune complète.** La source croise une
nomenclature de risque (`ps_niveau` 0 à 4) et une nomenclature de secteur
institutionnel (`si_niveau` 0 à 2). Chacune couvre la totalité de la masse :
en 2024, à `ps_niveau=0`, le secteur agrégé donne 932,55 Md€ sur une ligne, les
neuf secteurs de niveau 1 en donnent 932,55 et les trente-quatre du niveau 2
encore 932,55. **Lire sans filtrer les deux dimensions compte le total trois
fois** — 2 797,6 Md€, un chiffre qu'aucun contrôle interne à une seule
hiérarchie n'attraperait. Ce module filtre donc explicitement les deux.

**`nom_regime` n'est pas une liste de régimes.** La colonne mêle des régimes
réels (« Caisse nationale d'assurance vieillesse ») et des libellés de total
(« Total S13141 », « Total tous régimes »). L'agréger reviendrait à additionner
des totaux à leurs propres composantes. Ce module ne s'en sert pas.

**Le niveau le plus fin est incomplet.** À `ps_niveau=4`, la vieillesse-survie
2024 ne fait que 419,19 Md€ contre 426,67 aux niveaux 1 à 3 : toutes les
branches n'ont pas de feuilles. Publier depuis les feuilles perdrait 30 Md€ sans
qu'aucune ligne ne manque visiblement. Seuls les niveaux 0 et 1 sont chargés.

**La profondeur varie selon le millésime.** Sept lignes par exercice avant 2020
— le total et ses six risques, sans ventilation par secteur — contre environ
1 720 à partir de 2020, où la source ouvre le détail par régime. Les séries
publiées ici sont donc disponibles sur toute la profondeur, de 1959 à 2024, mais
un lecteur qui descendrait par régime ne trouverait rien avant 2020.

**Le contrôle qui bloque.** La somme des six risques doit faire le total, à
secteur agrégé, exercice par exercice. Vérifié sur les 66 exercices de la
source, écart nul — dont 2024 : 426 665,30 + 338 880,82 + 65 806,89 + 51 123,85
+ 34 012,87 + 16 058,54 = 932 548,27 millions d'euros.

Usage : python -m plateforme.normalize.protection_sociale [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
import json

from plateforme import entrepot, revisions
from plateforme.connectors.ods import export_url
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, make_store

DATASET = "drees-comptes-protection-sociale"
SOURCE = "data-drees"
BASE = "https://data.drees.solidarites-sante.gouv.fr/api/explore/v2.1"
JEU = "305_les-comptes-de-la-protection-sociale"

# Les deux filtres qui font qu'une valeur n'est comptée qu'une fois. `si_niveau`
# vaut « tous secteurs institutionnels confondus » : sans lui, les neuf secteurs
# du niveau 1 et les trente-quatre du niveau 2 rediraient la même masse, et le
# total sortirait multiplié par trois.
SECTEUR_AGREGE = "0"
# `ps_niveau` : 0 est le total des prestations, 1 les six risques. Les niveaux 2
# à 4 redisent la même masse en plus fin — et le 4 est incomplet.
NIVEAU_TOTAL = "0"
NIVEAU_RISQUES = "1"

# La source publie en **millions** d'euros. Le site publie en euros, comme le
# budget de l'État et la dette. Sans ce facteur, 932 milliards s'afficheraient à
# 932 mille.
MILLIONS = 1_000_000

# Un demi-million d'euros : les valeurs sont arrondies au centime de million et
# six d'entre elles s'additionnent. L'écart constaté sur les 66 exercices est nul.
TOLERANCE = 0.5 * MILLIONS

TOTAL = "E11-0"

_COMMUN = (
    " Ce sont des prestations versées, tous régimes confondus, et non des crédits"
    " budgétaires de l'État."
)

# Code de risque -> (identifiant, libellé, fiche publique).
RISQUES = {
    TOTAL: (
        "drees_protection_sociale_total",
        "Prestations de protection sociale",
        "Ce que la France verse chaque année en retraites, remboursements de soins,"
        " allocations familiales, chômage, minima sociaux et aides au logement."
        " C'est la première dépense publique du pays, très au-dessus du budget de"
        " l'État." + _COMMUN,
    ),
    "E11-2": (
        "drees_protection_sociale_vieillesse",
        "Protection sociale : vieillesse-survie",
        "Les retraites et les pensions de réversion : régime de base, complémentaires"
        " obligatoires, régimes spéciaux et fonction publique. C'est le premier poste"
        " de la protection sociale." + _COMMUN,
    ),
    "E11-1": (
        "drees_protection_sociale_sante",
        "Protection sociale : santé",
        "Le remboursement des soins et les indemnités journalières : hôpital, ville,"
        " médicaments, invalidité, accidents du travail. Assurance maladie et"
        " complémentaires réunies." + _COMMUN,
    ),
    "E11-3": (
        "drees_protection_sociale_famille",
        "Protection sociale : famille",
        "Les allocations familiales, l'aide à la garde des jeunes enfants, les"
        " prestations liées à la naissance et le congé parental." + _COMMUN,
    ),
    "E11-4": (
        "drees_protection_sociale_emploi",
        "Protection sociale : emploi",
        "L'indemnisation du chômage, les préretraites et les aides à l'insertion"
        " professionnelle. Le poste le plus sensible à la conjoncture : il a bondi"
        " en 2020." + _COMMUN,
    ),
    "E11-6": (
        "drees_protection_sociale_pauvrete",
        "Protection sociale : pauvreté-exclusion sociale",
        "Le RSA et les autres minima sociaux, l'aide alimentaire et l'hébergement"
        " d'urgence." + _COMMUN,
    ),
    "E11-5": (
        "drees_protection_sociale_logement",
        "Protection sociale : logement",
        "Les aides personnelles au logement : APL, allocation de logement familiale"
        " et allocation de logement sociale." + _COMMUN,
    ),
}

COMPOSANTES = tuple(code for code in RISQUES if code != TOTAL)

THEME = "securite_sociale"
COLONNES = ("value",)

FORMULE = (
    "Somme de la colonne « val » des comptes de la protection sociale, filtrée sur"
    " si_niveau = 0 (tous secteurs institutionnels) et ps_niveau ∈ {0, 1}"
)

TECHNIQUE = (
    "Prestations de protection sociale versées, comptes de la protection sociale de"
    " la DREES, en comptabilité nationale (base 2020, SEC 2010) et non budgétaire :"
    " une prestation y est rattachée à l'exercice où le droit naît, et le périmètre"
    " couvre tous les régimes — Sécurité sociale, régimes complémentaires"
    " obligatoires, État, collectivités locales, hôpitaux publics, mutuelles,"
    " institutions de prévoyance et sociétés d'assurance. Ce ne sont pas des crédits"
    " budgétaires de l'État : le budget de l'État publié par ailleurs sur ce site est"
    " un vote de crédits sur le seul périmètre de l'État, en comptabilité budgétaire,"
    " et les deux chiffres ne se soustraient pas. Ce n'est pas non plus le solde des"
    " administrations de sécurité sociale publié ici en % du PIB : celui-là est un"
    " solde, celui-ci une dépense. La source croise deux nomenclatures indépendantes"
    " et complètes — le risque (ps_niveau 0 à 4) et le secteur institutionnel"
    " (si_niveau 0 à 2) ; chacune redit la totalité de la masse, et lire sans filtrer"
    " les deux compte le total trois fois. Seuls le total (ps_niveau 0) et les six"
    " risques (ps_niveau 1) à secteur agrégé (si_niveau 0) sont chargés : le niveau"
    " le plus fin est incomplet, la vieillesse-survie n'y faisant que 419,2 Md€ en"
    " 2024 contre 426,7 aux niveaux supérieurs. La profondeur de la source varie"
    " selon le millésime : sept lignes par exercice avant 2020, sans aucune"
    " ventilation par régime, contre environ 1 720 à partir de 2020 — les séries"
    " publiées ici couvrent toute la profondeur, une lecture par régime ne le"
    " pourrait pas. Montants en millions d'euros courants à la source, convertis en"
    " euros ici."
)


class RisquesIncoherents(RuntimeError):
    """Les six risques ne font plus le total des prestations."""


def url() -> str:
    return f"{export_url(BASE, JEU)}?delimiter=%3B"


def lire(contenu: bytes) -> list[tuple[str, str, str, str, float]]:
    """-> [(exercice, ps_niveau, ps_code, si_niveau, montant en millions)].

    Les deux niveaux de nomenclature sortent tels quels : c'est le filtrage en
    aval, pas la lecture, qui décide ce qui est compté — et les tests peuvent
    ainsi mesurer ce que coûterait son oubli.
    """
    lecteur = csv.DictReader(io.StringIO(contenu.decode("utf-8-sig")), delimiter=";")
    lignes = []
    for rang in lecteur:
        brut = (rang.get("val") or "").strip()
        if not brut:
            continue
        lignes.append((
            (rang.get("annee") or "").strip(),
            (rang.get("ps_niveau") or "").strip(),
            (rang.get("ps_code") or "").strip(),
            (rang.get("si_niveau") or "").strip(),
            float(brut),
        ))
    return lignes


def series(lignes) -> dict[str, dict[str, float]]:
    """{code de risque: {exercice: prestations en euros}}.

    Les deux dimensions sont filtrées ici. Chacune des deux hiérarchies de la
    source est complète : n'en filtrer qu'une laisserait passer l'autre en
    entier, et la masse sortirait multipliée par son nombre de niveaux.
    """
    resultat: dict[str, dict[str, float]] = {}
    for exercice, ps_niveau, ps_code, si_niveau, montant in lignes:
        if si_niveau != SECTEUR_AGREGE:
            continue
        if ps_niveau not in (NIVEAU_TOTAL, NIVEAU_RISQUES):
            continue
        if ps_code not in RISQUES:
            continue
        resultat.setdefault(ps_code, {})[exercice] = montant * MILLIONS
    return resultat


def controler(mesures: dict[str, dict[str, float]]) -> dict:
    """Les six risques font le total, exercice par exercice.

    Un exercice où une composante manque est sauté plutôt que dénoncé — mais
    n'en avoir vérifié aucun est une erreur, pas un silence.
    """
    total = mesures.get(TOTAL, {})
    if not total:
        raise RisquesIncoherents(
            "aucun total de prestations : le filtre sur le secteur agrégé n'a rien"
            " gardé, ou la source a changé de nomenclature"
        )
    verifies = 0
    for exercice, attendu in sorted(total.items()):
        parts = [mesures.get(code, {}).get(exercice) for code in COMPOSANTES]
        if any(part is None for part in parts):
            continue
        ecart = sum(parts) - attendu
        if abs(ecart) > TOLERANCE:
            raise RisquesIncoherents(
                f"{exercice} : les six risques font {sum(parts) / MILLIONS:,.2f} M€"
                f" contre {attendu / MILLIONS:,.2f} M€ pour le total"
                f" ({ecart / MILLIONS:+,.2f}). Un risque manque, double, ou une"
                " ligne d'un autre niveau de nomenclature est entrée dans la somme."
            )
        verifies += 1
    if not verifies:
        raise RisquesIncoherents("aucun exercice n'a pu être vérifié")
    exercices = sorted(total)
    return {
        "les_six_risques_font_le_total": verifies,
        "premier_exercice": exercices[0],
        "dernier_exercice": exercices[-1],
        "total_dernier_exercice_millions": round(total[exercices[-1]] / MILLIONS, 2),
    }


def lignes_a_ecrire(mesures: dict[str, dict[str, float]]) -> list[tuple]:
    """-> les lignes prêtes pour `revisions.remplacer`, cinq clés puis la valeur."""
    return [
        (RISQUES[code][0], "pays", "FR", MILLESIME, exercice, valeur)
        for code, montants in sorted(mesures.items())
        if code in RISQUES
        for exercice, valeur in sorted(montants.items())
    ]


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for _, (identifiant, libelle, publique) in sorted(RISQUES.items()):
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, ?, 'euros courants', 'observed',
                        array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (publique, TECHNIQUE, FORMULE),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, price_basis, accounting_frame, geo_levels,
                     time_granularity, published)
                values (?, ?, ?, ?, ?, 'EUR', false, 'current', 'nationale',
                        array['pays'], 'annuelle', true)
                on conflict (indicator_id) do update set
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


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    garde_fou_volume(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        adresse = url()
        contenu = telecharger(adresse, timeout=600)
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE,
            "comptes-protection-sociale.csv", contenu, adresse, "text/csv",
        )
        lignes = lire(contenu)
        entrepot.etape(f"{len(lignes)} lignes lues, deux nomenclatures croisées")
        mesures = series(lignes)
        verifies = controler(mesures)
        entrepot.etape(
            f"{verifies['les_six_risques_font_le_total']} exercices vérifiés,"
            f" {verifies['total_dernier_exercice_millions']:,.0f} M€ en"
            f" {verifies['dernier_exercice']}"
        )
        a_ecrire = lignes_a_ecrire(mesures)
        if not a_ecrire:
            raise RisquesIncoherents("aucune prestation à écrire")
        ecrites, revisees = revisions.remplacer(
            conn, run_id, [f[0] for f in RISQUES.values()], COLONNES, a_ecrire
        )
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'les_six_risques_font_le_total', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps(verifies)),
        )
        conn.commit()
        entrepot.finish_run(
            conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites,
        )
        print(
            f"protection sociale : {ecrites} observations,"
            f" {verifies['premier_exercice']} à {verifies['dernier_exercice']},"
            f" {verifies['les_six_risques_font_le_total']} exercices où les six"
            f" risques font le total ; "
            f"{verifies['total_dernier_exercice_millions'] / 1000:.1f} Md€ en"
            f" {verifies['dernier_exercice']}, {revisees} valeurs révisées"
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
