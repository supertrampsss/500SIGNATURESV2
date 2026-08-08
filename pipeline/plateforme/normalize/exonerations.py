"""Exonérations de cotisations : 80,6 milliards que la Sécurité sociale n'encaisse pas.

Un employeur du secteur privé doit des cotisations sur chaque salaire. Une
partie ne lui est pas réclamée : réduction générale sur les bas salaires,
baisses de taux maladie et famille, régimes d'apprentissage, dispositifs de
zone. L'Urssaf chiffre ce qui n'a pas été appelé — **80,631 Md€ en 2024**,
1 000,7 Md€ cumulés depuis 2004 — et le ventile par département.

**Ce n'est ni une dépense, ni une recette, ni une niche fiscale.** Une
exonération est un prélèvement qui n'a pas lieu : aucun crédit n'est voté,
aucun encaissement n'est constaté. L'État en compense une partie à la Sécurité
sociale, pas la totalité, et la source ne dit pas laquelle. Le site publie
déjà les dépenses fiscales du tome II des Voies et moyens sous
`depense_fiscale_*` : ce sont des impôts d'État en moins, pas des cotisations
sociales en moins, et les deux ne s'additionnent pas.

**Le périmètre est le piège de cette source.** L'Urssaf publie côte à côte le
*secteur privé* et un *champ large* qui ajoute les employeurs publics et les
particuliers employeurs. Les deux jeux portent des colonnes de noms
identiques et des chiffres différents : 80,631 Md€ contre 81,922 Md€ en 2024,
soit 1,6 % d'écart. Un connecteur qui se trompe de jeu ne casse rien — il
publie simplement un chiffre faux. Le périmètre retenu est écrit dans la fiche
technique et les identifiants des trois jeux sont épinglés ici.

**Le contrôle qui bloque.** La même masse est publiée trois fois, ventilée
autrement : par département, par région, et par mesure au niveau national. Les
trois doivent coïncider année par année. Vérifié sur 2024 :
80 631 027 890,128 / 80 631 027 890,074 / 80 631 027 890,300 — l'écart
maximal est de 0,62 € sur 80,6 Md€, du bruit de virgule flottante. Le seuil
est donc relatif (1e-9), jamais une égalité exacte. Les cent départements
épuisent le total : il n'y a aucune ligne « non affecté » à récupérer.

**Des montants négatifs, et c'est normal.** Quatre lignes du départemental le
sont, jusqu'à −45 443 € : ce sont des régularisations d'exercices antérieurs.
Un contrôle « montant ≥ 0 » rejetterait de la donnée juste.

Usage : python -m plateforme.normalize.exonerations [--store r2:plateforme-raw]
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

DATASET = "urssaf-exonerations"
SOURCE = "urssaf"
BASE = "https://open.urssaf.fr/api/explore/v2.1/catalog/datasets"

# Les trois ventilations de la même masse, et la colonne géographique de
# chacune. Le national n'en a pas : il ventile par mesure d'exonération.
JEUX = {
    "departement": ("exos-secteur-prive-par-depart-grandes-categories", "code_departement"),
    "region": ("exos-secteur-prive-par-region-grandes-categories", "code_region"),
    "france": ("exos-secteur-prive-france-entiere-par-mesures", None),
}

# Le voisin qu'il ne faut pas charger. Mêmes noms de colonnes, même structure,
# périmètre plus large — employeurs publics et particuliers employeurs compris.
# 81,922 Md€ en 2024 au lieu de 80,631 : la confusion ne lève aucune erreur,
# elle publie 1,6 % de trop.
JEU_ECARTE = "exos-champ-large-par-grandes-categories"

# Colonne géographique -> maille. L'ordre compte : une ligne appartient à la
# maille de la première colonne qu'elle sert, et une ligne qui n'en sert
# aucune est une ligne France entière.
GEOGRAPHIES = (("code_departement", "departement"), ("code_region", "region"))

# Grande catégorie de mesures 1 : la réduction générale de cotisations sur les
# bas salaires et les baisses de taux maladie et famille. 924,35 Md€ cumulés,
# 92,4 % du total — elle en fait partie, elle ne s'y ajoute pas.
ALLEGEMENTS_GENERAUX = ("1",)

# Écart relatif admis entre les trois ventilations. Les montants sont des
# doubles agrégés dans des ordres différents par la source : sur 80,6 Md€,
# 0,62 € d'écart est le dernier bit de la mantisse, pas une erreur de
# périmètre. Une égalité exacte ferait échouer un run parfaitement juste.
TOLERANCE = 1e-9

INDICATEURS = {
    "urssaf_exonerations_total": (
        "Exonérations de cotisations sociales (secteur privé)",
        "Les cotisations sociales que les employeurs privés du département"
        " n'ont pas payées, parce qu'un allégement les en dispense. Ce n'est"
        " pas une dépense de l'État ni une recette : c'est un prélèvement qui"
        " n'a pas eu lieu.",
        None,
    ),
    "urssaf_exonerations_allegements_generaux": (
        "Exonérations : allégements généraux sur les bas salaires",
        "La part la plus lourde : réduction générale de cotisations sur les"
        " bas salaires, baisses de taux maladie et famille. Elle est"
        " **incluse** dans le total des exonérations du département et ne s'y"
        " ajoute pas.",
        ALLEGEMENTS_GENERAUX,
    ),
}

THEME = "emploi"

TECHNIQUE = (
    "Montant des exonérations de cotisations sociales déclarées à l'Urssaf,"
    " **champ secteur privé** (jeux `exos-secteur-prive-*` d'open.urssaf.fr)."
    " Ce périmètre exclut les employeurs publics et les particuliers"
    " employeurs, que le jeu voisin `exos-champ-large-par-grandes-categories`"
    " inclut sous des colonnes de noms identiques : 81,922 Md€ contre"
    " 80,631 Md€ en 2024. Une exonération est une cotisation **non perçue**,"
    " compensée ou non par l'État : la source ne distingue pas les deux. Ce"
    " n'est ni un crédit budgétaire, ni une recette encaissée, ni une dépense"
    " fiscale au sens du tome II des Voies et moyens, que le site publie"
    " séparément. Le montant est rattaché au département de l'établissement"
    " employeur et non au domicile du salarié. Des montants négatifs"
    " apparaissent : ce sont des régularisations d'exercices antérieurs, et"
    " elles sont conservées. **Mayotte (976) est absente de la source sur"
    " toute la période** ; cent départements sont servis de 2004 à 2025, la"
    " Corse en deux codes distincts. Les deux indicateurs ne s'additionnent"
    " pas : les allégements généraux sont une part du total."
)


class MassesDivergentes(RuntimeError):
    """Les trois ventilations de la même masse ne coïncident pas."""


def url(jeu: str, colonne: str | None) -> str:
    """Export CSV du jeu, réduit aux colonnes lues.

    Les noms de champ sont utilisés, jamais les libellés : celui de `annee`
    porte un caractère U+FEFF collé devant (« ﻿Année »), et un export
    `use_labels=true` le ferait entrer dans l'en-tête.
    """
    champs = ["annee", *([colonne] if colonne else []),
              "code_grande_categorie_de_mesures", "montant_des_exonerations"]
    select = urllib.parse.quote(",".join(champs))
    return f"{BASE}/{jeu}/exports/csv?select={select}&delimiter=%3B"


def exercice(valeur: str | None) -> str:
    """L'année, quelle que soit la forme sous laquelle la source la rend.

    `annee` est typée `date` côté Opendatasoft : l'API des enregistrements
    rend « 2024-01-01 » et n'accepte de filtre que sous la forme
    `where=annee=date'2024-01-01'` ; l'export CSV rend « 2024 ». Les quatre
    premiers caractères sont l'exercice dans les deux cas.
    """
    return (valeur or "").strip()[:4]


def maille(rang: dict) -> tuple[str, str]:
    """-> (maille, code) d'une ligne, d'après la colonne géographique servie.

    Chaque export ne sert qu'une des deux colonnes, ou aucune : la maille se
    lit sur la ligne plutôt que sur le fichier dont elle vient. Une ligne du
    départemental dont le code serait vide — un « non affecté » qui
    apparaîtrait un jour — tomberait donc dans France entière, et le contrôle
    des trois masses la verrait immédiatement.
    """
    for colonne, niveau in GEOGRAPHIES:
        code = (rang.get(colonne) or "").strip()
        if code:
            return niveau, code
    return "france", "FR"


def lire(contenu: bytes) -> list[tuple[str, str, str, str, float]]:
    """-> [(maille, code, exercice, grande catégorie, montant)]."""
    lecteur = csv.DictReader(io.StringIO(contenu.decode("utf-8-sig")), delimiter=";")
    lignes = []
    for rang in lecteur:
        brut = (rang.get("montant_des_exonerations") or "").strip()
        if not brut:
            continue
        niveau, code = maille(rang)
        lignes.append((
            niveau,
            code,
            exercice(rang.get("annee")),
            (rang.get("code_grande_categorie_de_mesures") or "").strip(),
            float(brut),
        ))
    return lignes


def masses(lignes) -> dict[str, dict[str, float]]:
    """{maille: {exercice: montant}}, la ventilation que les trois jeux partagent."""
    totaux: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for niveau, _, annee, _, montant in lignes:
        totaux[niveau][annee] += montant
    return {niveau: dict(annees) for niveau, annees in totaux.items()}


def controler(lignes) -> dict:
    """Σ départements = Σ régions = France entière, exercice par exercice.

    C'est le seul contrôle qui puisse attraper un jeu chargé à la place d'un
    autre : le champ large et le secteur privé se ressemblent trop pour qu'une
    relecture les distingue, mais leurs masses diffèrent de 1,6 % et deux
    mailles sur trois le crieraient.
    """
    par_maille = masses(lignes)
    manquantes = sorted(set(JEUX) - set(par_maille))
    if manquantes:
        raise MassesDivergentes(
            f"maille(s) absente(s) : {', '.join(manquantes)}. Le contrôle à trois"
            " niveaux ne peut pas tourner sur une ventilation manquante."
        )
    reference = par_maille["departement"]
    ecart_maximal = 0.0
    for niveau in ("region", "france"):
        if set(par_maille[niveau]) != set(reference):
            absents = sorted(set(reference) ^ set(par_maille[niveau]))
            raise MassesDivergentes(
                f"{len(absents)} exercice(s) présents d'un seul côté entre"
                f" departement et {niveau}, par exemple {absents[0]}."
            )
        for annee, montant in sorted(reference.items()):
            ecart = abs(par_maille[niveau][annee] - montant)
            relatif = ecart / abs(montant) if montant else ecart
            if relatif >= TOLERANCE:
                raise MassesDivergentes(
                    f"{niveau} et departement divergent sur {annee} :"
                    f" {ecart:,.2f} € d'écart sur {montant:,.2f} €"
                    f" ({relatif:.2e} en relatif, seuil {TOLERANCE:.0e})."
                    " Les trois jeux ne décrivent plus le même périmètre."
                )
            ecart_maximal = max(ecart_maximal, ecart)
    return {
        "exercices_verifies": len(reference),
        "masse_totale": round(sum(reference.values()), 3),
        "ecart_maximal_euros": round(ecart_maximal, 3),
    }


def par_departement(lignes) -> list[tuple]:
    """-> les observations annuelles, par indicateur et par département."""
    totaux: dict[tuple[str, str, str], float] = defaultdict(float)
    for niveau, code, annee, categorie, montant in lignes:
        if niveau != "departement":
            continue
        for identifiant, (_, _, categories) in INDICATEURS.items():
            if categories is None or categorie in categories:
                totaux[(identifiant, code, annee)] += montant
    return [
        (identifiant, "departement", code, annee, montant)
        for (identifiant, code, annee), montant in sorted(totaux.items())
    ]


def masse_par_maille(candidates) -> dict[str, float]:
    """La masse totale écrite, pour les deux côtés de la couverture.

    Mesurée en euros et sur le seul indicateur total : compter les codes
    ferait peser Mayotte absente autant que l'Île-de-France, et compter les
    deux indicateurs compterait les allégements généraux deux fois.
    """
    par_maille: dict[str, float] = defaultdict(float)
    for identifiant, niveau, _, _, montant in candidates:
        if identifiant == "urssaf_exonerations_total":
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
                values (?, ?, 'Somme des montants d''exonérations déclarés, champ secteur privé',
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
                     additive, price_basis, geo_levels, time_granularity, published)
                values (?, ?, ?, ?, ?, 'EUR', true, 'current',
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
        lignes: list[tuple] = []
        for niveau, (jeu, colonne) in JEUX.items():
            adresse = url(jeu, colonne)
            contenu = telecharger(adresse, timeout=300)
            entrepot.record_asset(
                conn, store, run_id, DATASET, SOURCE, f"{jeu}.csv", contenu,
                adresse, "text/csv",
            )
            lues = lire(contenu)
            entrepot.etape(f"{niveau} : {len(lues)} lignes")
            lignes += lues
        verifies = controler(lignes)
        entrepot.etape(
            f"{verifies['exercices_verifies']} exercices vérifiés sur trois mailles,"
            f" écart maximal {verifies['ecart_maximal_euros']} €"
        )

        candidates = par_departement(lignes)
        gardees, ecartes = filtrer_territoires_connus(conn, candidates)
        ecrites, revisees = revisions.remplacer(
            conn, run_id, sorted(INDICATEURS), COLONNES,
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
            values (?, ?, 'departements_regions_et_france_entiere_a_la_meme_masse',
                    'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "champ": "secteur prive",
                "hors_referentiel": sorted(ecartes),
                "couverture": {n: round(p, 4) for n, p in sorted(parts.items())},
            })),
        )
        conn.commit()
        entrepot.finish_run(
            conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites,
        )
        print(
            f"exonérations Urssaf : {ecrites} observations,"
            f" {verifies['exercices_verifies']} exercices vérifiés sur trois"
            f" mailles ({verifies['masse_totale'] / 1e9:.1f} Md€ cumulés, écart"
            f" maximal {verifies['ecart_maximal_euros']} €), {revisees} révisées"
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
