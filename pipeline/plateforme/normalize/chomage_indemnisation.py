"""Ce que l'assurance chômage verse, département par département (Unédic).

36,6 milliards d'euros en 2024. C'est la dépense d'indemnisation du **régime
d'assurance chômage** — les allocations financées par les contributions des
employeurs et versées aux anciens salariés qui ont assez travaillé pour y avoir
droit : ARE, allocation de formation (AREF), allocation de sécurisation
professionnelle (ASP).

**Ce n'est pas « l'aide aux chômeurs ».** L'allocation de solidarité spécifique
et le RSA relèvent de la solidarité nationale, sont financés par l'impôt et ne
figurent pas ici. Un lecteur qui prendrait ce chiffre pour le coût total du
chômage se tromperait de plusieurs milliards, et dans le mauvais sens.

**Ce n'est pas non plus le taux de chômage** (`chomage.py`, INSEE, sens du BIT),
ni le nombre d'inscrits à France Travail : trois grandeurs, trois définitions.

**Le piège qui double la masse.** La source publie 117 lignes par mois : 103
territoires et **14 lignes d'agrégat régional**, reconnaissables au seul
`code_departement = "Total"`. Rien dans le fichier ne dit qu'elles sont d'une
autre nature. Les sommer avec les départements donne exactement le double —
73 279 199 823 € au lieu de 36 639 599 911,50 € pour 2024 — et le résultat reste
parfaitement crédible, ce qui est le pire des cas.

**Le contrôle qui bloque.** Ces mêmes lignes d'agrégat rendent l'erreur
détectable : la somme des 103 territoires doit égaler la somme des 14 agrégats,
au centime, pour chaque exercice. Un département oublié, une ligne d'agrégat
comptée deux fois, une virgule mal lue : l'égalité tombe. Elle est vérifiée
avant la moindre écriture.

**Deux codes ne joignent sur rien.** Saint-Martin et Saint-Barthélemy portent le
code `"Saint"` — une troncature à cinq caractères, à la source. Saint-Pierre-et-
Miquelon (`975`) est une collectivité d'outre-mer, pas un département. Ensemble
0,09 % de la masse : ils sont écartés par le référentiel et leur absence est
mesurée, pas supposée.

Usage : python -m plateforme.normalize.chomage_indemnisation [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
import json
import urllib.parse
from collections import defaultdict

from plateforme import couverture, entrepot, revisions
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "unedic-indemnisation-departement"
SOURCE = "data-unedic"
BASE = "https://data.unedic.org/api/explore/v2.1/catalog/datasets"
JEU = "evolution_indicateurs_cles_ac"

# `depense` est la dépense mensuelle d'indemnisation du département, en euros.
# Le jeu porte aussi `montant_indemnisation_net_tous` — une moyenne mensuelle
# **par allocataire**, de l'ordre du millier d'euros — et `aj_moy`, une
# allocation journalière. Ni l'une ni l'autre ne s'additionne ; elles ne sont
# pas téléchargées, pour qu'on ne puisse pas les confondre.
SELECTION = "code_departement,region,annee_mois,depense"

# La valeur qui distingue les 14 lignes d'agrégat régional des 103 territoires.
AGREGAT = "Total"

INDICATEUR = "unedic_depense_indemnisation"
THEME = "emploi"

FICHE = {
    "libelle": "Dépense d'indemnisation de l'assurance chômage",
    "public": "Ce que l'assurance chômage a versé dans l'année aux allocataires"
    " du département : allocation de retour à l'emploi, allocations de formation"
    " et de sécurisation professionnelle. Ni le RSA ni l'allocation de solidarité"
    " spécifique, qui relèvent de la solidarité nationale, n'y figurent.",
    "technique": "Dépense d'indemnisation du régime d'assurance chômage (ARE,"
    " AREF, ASP), source Unédic, cumulée sur les douze mois de l'exercice en"
    " euros courants, au département de rattachement de l'allocataire. Le"
    " périmètre est le régime d'assurance seul : l'allocation de solidarité"
    " spécifique et le RSA, financés par l'impôt, en sont exclus. Ce montant"
    " n'est pas le coût total du chômage pour la collectivité. Il ne se confond"
    " ni avec le taux de chômage au sens du BIT, ni avec le nombre d'inscrits à"
    " France Travail. Réserves : la source publie, à côté des départements, 14"
    " lignes d'agrégat régional codées « Total » qui doublent la masse si on les"
    " additionne ; la colonne « region » compte 14 modalités dont « DROM-COM »,"
    " qui n'est pas la nomenclature INSEE et n'est donc pas reprise ;"
    " Saint-Martin et Saint-Barthélemy portent un code tronqué (« Saint ») et"
    " Saint-Pierre-et-Miquelon n'est pas un département ; 0,09 % de la masse"
    " reste hors référentiel. La couverture réelle va de janvier 2020 à décembre"
    " 2025, alors que la description du jeu annonce janvier 2018. Confrontée au"
    " jeu national de l'Unédic, la somme des départements retrouve 36,64 Md€ en"
    " 2024 contre 36,65 Md€ France entière, soit 0,030 % d'écart : la"
    " localisation départementale est quasi complète, sans l'être tout à fait.",
    "formule": "Somme des dépenses mensuelles d'indemnisation de l'exercice",
}


class AgregatsDivergents(RuntimeError):
    """Les départements et les agrégats régionaux ne décrivent plus la même masse."""


def url() -> str:
    return (
        f"{BASE}/{JEU}/exports/csv?select={urllib.parse.quote(SELECTION)}"
        "&delimiter=%3B"
    )


def lire(contenu: bytes) -> list[tuple[str, str, str, float]]:
    """-> [(mois, code département, région, dépense)]."""
    lecteur = csv.DictReader(io.StringIO(contenu.decode("utf-8-sig")), delimiter=";")
    lignes = []
    for rang in lecteur:
        brut = (rang.get("depense") or "").strip()
        if not brut:
            continue
        lignes.append((
            (rang.get("annee_mois") or "").strip(),
            (rang.get("code_departement") or "").strip(),
            (rang.get("region") or "").strip(),
            float(brut),
        ))
    return lignes


def masses(lignes) -> tuple[dict[str, float], dict[str, float]]:
    """-> ({exercice: masse des départements}, {exercice: masse des agrégats})."""
    territoires: dict[str, float] = defaultdict(float)
    agregats: dict[str, float] = defaultdict(float)
    for mois, code, _, depense in lignes:
        cible = agregats if code == AGREGAT else territoires
        cible[mois[:4]] += depense
    return dict(territoires), dict(agregats)


def controler(lignes) -> dict:
    """La même masse, ventilée deux fois, doit tomber au centime.

    Les 14 lignes d'agrégat régional ne sont pas un doublon à ignorer : ce sont
    elles qui rendent l'erreur de lecture détectable. Un département oublié, une
    ligne d'agrégat prise pour un territoire, un séparateur décimal mal lu — et
    l'égalité tombe. La confondre par hasard demanderait deux erreurs qui se
    compensent exactement, au centime, sur chaque exercice.
    """
    territoires, agregats = masses(lignes)
    if not territoires or not agregats:
        raise AgregatsDivergents(
            "aucun département ou aucun agrégat régional : la source a changé de"
            f" forme, ou la valeur « {AGREGAT} » n'est plus celle qui marque les"
            " lignes d'agrégat."
        )
    manquants = sorted(set(territoires) ^ set(agregats))
    if manquants:
        raise AgregatsDivergents(
            f"{len(manquants)} exercices servis d'un seul côté, par exemple"
            f" {manquants[0]}. Départements et agrégats ne décrivent plus la même"
            " masse."
        )
    ecarts = {
        annee: round(territoires[annee] - agregats[annee], 2)
        for annee in territoires
        if round(territoires[annee] - agregats[annee], 2) != 0
    }
    if ecarts:
        annee, ecart = next(iter(sorted(ecarts.items())))
        raise AgregatsDivergents(
            f"{len(ecarts)} exercices divergent entre départements et agrégats"
            f" régionaux, par exemple {annee} : {ecart:+,.2f} €."
        )
    return {
        "exercices_verifies": len(territoires),
        "masse_totale": round(sum(territoires.values()), 2),
        "mois_couverts": len({mois for mois, code, _, _ in lignes if code != AGREGAT}),
        "territoires": len({code for _, code, _, _ in lignes if code != AGREGAT}),
        "agregats_regionaux": len({region for _, code, region, _ in lignes if code == AGREGAT}),
    }


def exercices_complets(lignes) -> set[str]:
    """Les exercices dont les douze mois sont servis.

    La source s'arrête au dernier mois publié. Un exercice partiel posé à côté
    des précédents montrerait un effondrement qui n'est que le calendrier.
    """
    mois_par_an: dict[str, set[str]] = defaultdict(set)
    for mois, code, _, _ in lignes:
        if code != AGREGAT and len(mois) >= 7:
            mois_par_an[mois[:4]].add(mois[5:7])
    return {annee for annee, mois in mois_par_an.items() if len(mois) == 12}


def par_departement(lignes, complets: set[str]) -> list[tuple]:
    """-> les observations annuelles par département, agrégats régionaux exclus."""
    totaux: dict[tuple[str, str], float] = defaultdict(float)
    for mois, code, _, depense in lignes:
        annee = mois[:4]
        if code == AGREGAT or annee not in complets:
            continue
        totaux[(code, annee)] += depense
    return [
        (INDICATEUR, "departement", code, annee, montant)
        for (code, annee), montant in sorted(totaux.items())
    ]


def masse_par_maille(candidates) -> dict[str, float]:
    """Les euros lus puis les euros reconnus : la couverture se mesure sur la
    masse, pas sur le nombre de codes. « Saint » pèse 0,08 % ; un format de code
    qui aurait glissé en pèserait 100."""
    par_maille: dict[str, float] = defaultdict(float)
    for _, niveau, _, _, montant in candidates:
        par_maille[niveau] += montant
    return dict(par_maille)


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        definition = curseur.execute(
            """
            insert into core.indicator_definitions
                (public_definition, technical_definition, formula, unit_notes,
                 confidence_level, badges)
            values (?, ?, ?, 'euros courants', 'observed',
                    array['Officiel','Donnée brute'])
            returning definition_id
            """,
            (FICHE["public"], FICHE["technique"], FICHE["formule"]),
        ).fetchone()[0]
        curseur.execute(
            """
            insert into core.indicators
                (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                 additive, price_basis, geo_levels, time_granularity, published)
            values (?, ?, ?, ?, ?, 'EUR', true, 'current', array['departement'],
                    'annuelle', true)
            on conflict (indicator_id) do update set unit = excluded.unit,
                definition_id = excluded.definition_id,
                label_fr = excluded.label_fr,
                theme = excluded.theme, published = true
            """,
            (INDICATEUR, DATASET, definition, THEME, FICHE["libelle"]),
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
        adresse = url()
        contenu = telecharger(adresse, timeout=600)
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, f"{JEU}.csv", contenu,
            adresse, "text/csv",
        )
        lignes = lire(contenu)
        entrepot.etape(f"{JEU} : {len(lignes)} lignes")
        verifies = controler(lignes)
        entrepot.etape(
            f"{verifies['exercices_verifies']} exercices vérifiés au centime"
            f" entre {verifies['territoires']} départements et"
            f" {verifies['agregats_regionaux']} agrégats régionaux"
        )

        complets = exercices_complets(lignes)
        candidates = par_departement(lignes, complets)
        gardees, ecartes = filtrer_territoires_connus(conn, candidates)
        ecrites, revisees = revisions.remplacer(
            conn, run_id, [INDICATEUR], COLONNES,
            [
                (identifiant, niveau, code, MILLESIME, annee, montant)
                for identifiant, niveau, code, annee, montant in gardees
            ],
        )
        parts = couverture.controler(
            masse_par_maille(candidates), masse_par_maille(gardees)
        )
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'departements_et_agregats_regionaux_tombent_au_centime',
                    'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "exercices_complets": sorted(complets),
                "hors_referentiel": sorted(ecartes),
                "couverture": {n: round(p, 4) for n, p in sorted(parts.items())},
            })),
        )
        conn.commit()
        entrepot.finish_run(
            conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites
        )
        annees = sorted(complets)
        print(
            f"indemnisation chômage : {ecrites} observations, exercices"
            f" {annees[0]}-{annees[-1]}, {verifies['exercices_verifies']} exercices"
            f" vérifiés au centime sur {verifies['masse_totale'] / 1e9:.1f} Md€,"
            f" {revisees} révisées, {len(ecartes)} territoires hors référentiel"
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
