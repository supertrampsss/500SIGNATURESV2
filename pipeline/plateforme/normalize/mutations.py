"""Droits de mutation : ce que rapporte la vente des logements (DGFiP).

Quand un logement change de mains, l'acheteur paie des droits de mutation. Ils
vont pour l'essentiel au **département**, et une part aux **communes**. C'est la
recette la plus volatile des collectivités : elle suit le marché immobilier, pas
un vote — 21,0 Md€ en 2022, 14,2 Md€ en 2024, soit un tiers de moins en deux
ans, sans qu'aucune décision politique ne soit en cause.

**Deux indicateurs, deux bénéficiaires.** Le département encaisse la taxe de
publicité foncière, le droit départemental d'enregistrement et la taxe
additionnelle ; les communes reçoivent la taxe communale additionnelle. Les
additionner ferait un total que personne ne perçoit.

**La part communale n'est pas une donnée communale.** La source la publie
agrégée sur l'ensemble des communes d'un département : elle dit ce que les
communes de la Gironde ont encaissé, jamais ce que Bordeaux a encaissé.
L'indicateur est donc porté à la maille départementale, et sa fiche le dit —
faute de quoi un lecteur le diviserait par la population d'une commune.

**Ce n'est pas non plus la région.** La taxe régionale existe mais **99,996 %
de son montant n'est pas localisé** dans la source : 817 lignes sur 820 portent
une direction inconnue. Elle est écartée, et son absence est écrite.

**Le contrôle qui bloque.** La même masse est publiée deux fois, ventilée
autrement : une fois par lieu d'encaissement, une fois par collectivité
bénéficiaire. Les deux doivent tomber au centime près, mois par mois et taxe par
taxe. C'est un contrôle qu'aucune erreur de lecture ne peut satisfaire par
hasard, et il ne coûte qu'un second téléchargement.

Usage : python -m plateforme.normalize.mutations [--store r2:plateforme-raw]
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

DATASET = "dgfip-dmto"
SOURCE = "data-economie"
BASE = "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets"
RECOUVREMENT = "dmto_recouv"
ATTRIBUTION = "dmto_attrib"

# Catégorie de la source -> bénéficiaire réel. La taxe régionale (TRAD) n'est
# pas ici : 817 de ses 820 lignes portent une direction inconnue, soit 99,996 %
# de son montant. La cartographier reviendrait à dessiner trois lignes.
DEPARTEMENT = ("TDPF", "DDE", "TDAD")
COMMUNES = ("TCAD",)
REGION_ECARTEE = "TRAD"

INDICATEURS = {
    "dgfip_dmto_departement": (
        "Droits de mutation encaissés par le département",
        "Ce que le département encaisse quand des logements et des locaux"
        " changent de propriétaire. C'est sa recette la plus instable : elle"
        " suit le marché immobilier et peut chuter d'un tiers en deux ans.",
        DEPARTEMENT,
    ),
    "dgfip_dmto_communes": (
        "Droits de mutation encaissés par les communes du département",
        "Ce que **l'ensemble des communes** d'un département encaisse sur les"
        " ventes immobilières. La source ne descend pas à la commune : ce total"
        " ne se divise pas par les habitants d'une ville.",
        COMMUNES,
    ),
}

# Valeurs de la colonne géographique qui ne sont pas un département.
NON_LOCALISES = ("Non_connue", "Non_connus", "00", "R11", "")

THEME = "finances_locales"

TECHNIQUE = (
    "Droits de mutation à titre onéreux encaissés, source DGFiP (application"
    " MEDOC), ventilés par collectivité bénéficiaire. La part départementale"
    " réunit la taxe de publicité foncière, le droit départemental"
    " d'enregistrement et la taxe additionnelle ; la part communale est la taxe"
    " communale additionnelle, que la source publie **agrégée sur toutes les"
    " communes du département** et non commune par commune. Les deux ne"
    " s'additionnent pas : elles vont à deux niveaux de collectivité"
    " différents. La taxe régionale est écartée, 99,996 % de son montant"
    " n'étant pas localisé dans la source. Les montants sont datés du mois de"
    " comptabilisation et non du mois de la transaction : la série ne se lit"
    " pas comme un indicateur conjoncturel du marché immobilier. La"
    " codification suit les directions de la DGFiP : le Bas-Rhin est agrégé au"
    " Haut-Rhin depuis la création de la Collectivité européenne d'Alsace, et"
    " les deux départements corses depuis celle de la Collectivité de Corse."
    " Une série longue y change donc de périmètre."
)


class MassesDivergentes(RuntimeError):
    """Les deux ventilations de la même masse ne tombent pas au centime."""


def url(jeu: str, colonne: str) -> str:
    select = f"date,{colonne},categorie_dmto,recettes"
    return (
        f"{BASE}/{jeu}/exports/csv?select={urllib.parse.quote(select)}"
        "&delimiter=%3B"
    )


def lire(contenu: bytes, colonne: str) -> list[tuple[str, str, str, float]]:
    """-> [(mois, code géographique, catégorie, recettes)]."""
    lecteur = csv.DictReader(io.StringIO(contenu.decode("utf-8-sig")), delimiter=";")
    lignes = []
    for rang in lecteur:
        brut = (rang.get("recettes") or "").strip()
        if not brut:
            continue
        lignes.append((
            (rang.get("date") or "").strip(),
            (rang.get(colonne) or "").strip(),
            (rang.get("categorie_dmto") or "").strip(),
            float(brut),
        ))
    return lignes


def masses(lignes) -> dict[tuple[str, str], float]:
    """{(mois, catégorie): recettes}, la ventilation que les deux jeux partagent."""
    totaux: dict[tuple[str, str], float] = defaultdict(float)
    for mois, _, categorie, recettes in lignes:
        totaux[(mois, categorie)] += recettes
    return dict(totaux)


def controler(encaissees, attribuees) -> dict:
    """La même masse, ventilée deux fois, doit tomber au centime.

    Les deux jeux n'ont pas le même nombre de lignes — la taxe communale est
    encaissée par la direction départementale et reversée aux communes — mais
    ils décrivent le même argent. Aucune erreur de lecture ne peut satisfaire
    cette égalité par hasard : c'est le contrôle le plus dur du dépôt.
    """
    gauche, droite = masses(encaissees), masses(attribuees)
    if not gauche or not droite:
        raise MassesDivergentes("l'un des deux jeux est vide")
    manquantes = sorted(set(gauche) ^ set(droite))
    if manquantes:
        raise MassesDivergentes(
            f"{len(manquantes)} couples (mois, taxe) présents d'un seul côté,"
            f" par exemple {manquantes[0]}. Les deux ventilations ne décrivent"
            " plus la même masse."
        )
    ecarts = {
        cle: round(gauche[cle] - droite[cle], 2)
        for cle in gauche
        if round(gauche[cle] - droite[cle], 2) != 0
    }
    if ecarts:
        cle, ecart = next(iter(sorted(ecarts.items())))
        raise MassesDivergentes(
            f"{len(ecarts)} couples (mois, taxe) divergent entre encaissement et"
            f" attribution, par exemple {cle} : {ecart:+,.2f} €."
        )
    return {
        "couples_verifies": len(gauche),
        "masse_totale": round(sum(gauche.values()), 2),
        "mois_couverts": len({mois for mois, _ in gauche}),
    }


def exercices_complets(lignes) -> set[str]:
    """Les années dont les douze mois sont servis.

    La source va jusqu'au mois dernier : publier l'année en cours à côté des
    précédentes montrerait un effondrement qui n'est que le calendrier.
    """
    mois_par_an: dict[str, set[str]] = defaultdict(set)
    for mois, _, _, _ in lignes:
        if len(mois) >= 7:
            mois_par_an[mois[:4]].add(mois[5:7])
    return {an for an, mois in mois_par_an.items() if len(mois) == 12}


def par_departement(lignes, complets: set[str]) -> list[tuple]:
    """-> les observations annuelles, par indicateur et par département."""
    totaux: dict[tuple[str, str, str], float] = defaultdict(float)
    for mois, code, categorie, recettes in lignes:
        if code in NON_LOCALISES or categorie == REGION_ECARTEE:
            continue
        annee = mois[:4]
        if annee not in complets:
            continue
        for identifiant, (_, _, categories) in INDICATEURS.items():
            if categorie in categories:
                totaux[(identifiant, code, annee)] += recettes
    return [
        (identifiant, "departement", code, annee, montant)
        for (identifiant, code, annee), montant in sorted(totaux.items())
    ]


def masse_par_maille(candidates) -> dict[str, float]:
    """La part départementale écrite, pour les deux côtés de la couverture."""
    par_maille: dict[str, float] = defaultdict(float)
    for identifiant, niveau, _, _, montant in candidates:
        if identifiant == "dgfip_dmto_departement":
            par_maille[niveau] += montant
    return dict(par_maille)


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for identifiant, (libelle, publique, _) in sorted(INDICATEURS.items()):
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, 'Recettes encaissées, source DGFiP MEDOC',
                        'euros courants', 'observed',
                        array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (publique, TECHNIQUE),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, price_basis, accounting_frame, geo_levels,
                     time_granularity, published)
                values (?, ?, ?, ?, ?, 'EUR', true, 'current', 'budgetaire',
                        array['departement'], 'annuelle', true)
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


COLONNES = ("value",)


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        garde_fou_volume(conn)
        lus = {}
        for jeu, colonne in (
            (RECOUVREMENT, "direction_recouvrement"),
            (ATTRIBUTION, "collectivite_attributaire"),
        ):
            adresse = url(jeu, colonne)
            contenu = telecharger(adresse, timeout=600)
            entrepot.record_asset(
                conn, store, run_id, DATASET, SOURCE, f"{jeu}.csv", contenu,
                adresse, "text/csv",
            )
            lus[jeu] = lire(contenu, colonne)
            entrepot.etape(f"{jeu} : {len(lus[jeu])} lignes")
        verifies = controler(lus[RECOUVREMENT], lus[ATTRIBUTION])
        entrepot.etape(f"{verifies['couples_verifies']} couples vérifiés au centime")

        # C'est l'attribution qui est publiée : la question est « qui reçoit »,
        # pas « où l'argent a été encaissé ».
        complets = exercices_complets(lus[ATTRIBUTION])
        candidates = par_departement(lus[ATTRIBUTION], complets)
        gardees, ecartes = filtrer_territoires_connus(conn, candidates)
        lignes = [
            (identifiant, niveau, code, MILLESIME, annee, montant)
            for identifiant, niveau, code, annee, montant in gardees
        ]
        ecrites, revisees = revisions.remplacer(
            conn, run_id, sorted(INDICATEURS), COLONNES, lignes
        )
        parts = couverture.controler(
            masse_par_maille(candidates), masse_par_maille(gardees)
        )
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'encaissement_et_attribution_tombent_au_centime',
                    'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "exercices_complets": sorted(complets),
                "hors_referentiel": len(ecartes),
                "couverture": {n: round(p, 4) for n, p in sorted(parts.items())},
            })),
        )
        conn.commit()
        entrepot.finish_run(
            conn, run_id, "success",
            rows_read=len(lus[ATTRIBUTION]), rows_written=ecrites,
        )
        annees = sorted(complets)
        print(
            f"droits de mutation : {ecrites} observations, exercices"
            f" {annees[0]}-{annees[-1]}, {verifies['couples_verifies']} couples"
            f" (mois × taxe) vérifiés au centime sur"
            f" {verifies['masse_totale'] / 1e9:.1f} Md€, {revisees} révisées"
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
