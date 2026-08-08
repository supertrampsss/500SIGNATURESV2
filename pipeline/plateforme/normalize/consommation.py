"""Consommation des ménages (INSEE, comptes nationaux) — et ce que l'écart dit.

Ce module charge deux chiffres, et c'est **leur différence** qui répond à une
question du site.

- La **dépense de consommation finale** est ce que les ménages paient de leur
  poche : 1 527 milliards d'euros en 2024.
- La **consommation finale effective** est ce qu'ils consomment réellement,
  services publics compris : 2 051 milliards la même année.

L'écart — 524 milliards — porte un nom dans les comptes nationaux : les
**transferts sociaux en nature**. Ce sont les soins remboursés, l'école, le
logement social, les crèches : des biens et services que les ménages consomment
sans les payer, parce que la collectivité les paie. Sur un site qui demande « où
vont mes impôts », c'est la réponse la plus directe qui existe, et elle ne se lit
que si les deux chiffres sont publiés côte à côte.

**Ce n'est pas de la dépense publique.** Ces montants décrivent ce que les
ménages consomment, pas ce que l'État dépense. Le second est publié à côté, sur
son propre périmètre, et les deux ne s'additionnent pas.

**Le résident, pas le territoire.** Les comptes retiennent la consommation des
ménages **résidents**, où qu'ils dépensent : ce qu'un Français achète à
l'étranger y est, ce qu'un touriste achète en France n'y est pas. La source
porte d'ailleurs une « correction territoriale » — négative de 16 milliards en
2024 — qui fait exactement ce redressement.

**Le contrôle qui bloque.** La consommation effective est, par construction,
supérieure ou égale à la dépense : les transferts sociaux en nature ne peuvent
pas être négatifs. L'inégalité est vérifiée exercice par exercice, et les deux
séries doivent couvrir les mêmes années — une seule des deux publiée laisserait
l'écart illisible.

Usage : python -m plateforme.normalize.consommation [--store r2:plateforme-raw]
"""

import argparse
import json

from plateforme import entrepot, revisions
from plateforme.connectors.insee import MELODI_BASE
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, make_store

DATASET = "melodi-cna-conso-menages"
SOURCE = "insee-melodi"
JEU = "DD_CNA_CONSO_MENAGES_PRODUITS"

# Ménages. `S1` serait toute l'économie, `S13` les administrations, `S15` les
# associations : quatre secteurs sous la même mesure.
SECTEUR = "S14"

# Les filtres qui font qu'une valeur en désigne une seule. `W0` est le monde
# entier — la consommation des ménages résidents où qu'ils dépensent ; `W2`
# porte le détail par produit, que ce module ne charge pas.
FILTRES = {
    "PRODUCT": "_T",
    "COUNTERPART_AREA": "W0",
    "PRICES": "V",  # valeur courante, pas volume chaîné
    "TRANSFORMATION": "N",  # niveau, pas glissement
    "UNIT_MEASURE": "XDC",
    "FREQ": "A",
}

# La source publie en millions d'euros ; le site publie en euros.
MILLIONS = 1_000_000

# Code de la mesure -> (identifiant, libellé, fiche publique).
MESURES = {
    "P31": (
        "insee_conso_menages_depense", "Dépense de consommation des ménages",
        "Ce que les ménages paient de leur poche en un an : logement, nourriture,"
        " transport, loisirs. N'y figure pas ce que la collectivité leur fournit"
        " sans le leur facturer : soins remboursés, école, logement social.",
    ),
    "P4": (
        "insee_conso_menages_effective", "Consommation effective des ménages",
        "Tout ce que les ménages consomment en un an, y compris les services que la"
        " collectivité paie à leur place : soins remboursés, école, logement social."
        " L'écart avec leur dépense mesure ce que le service public leur apporte.",
    ),
}

DEPENSE, EFFECTIVE = "P31", "P4"
THEME = "macro"
COLONNES = ("value",)

TECHNIQUE = (
    "Comptes nationaux annuels de l'INSEE, secteur des ménages (S14), en valeur"
    " courante et en niveau, tous produits confondus, en millions d'euros à la"
    " source et convertis en euros ici. La dépense de consommation finale (P31) est"
    " ce que les ménages financent eux-mêmes ; la consommation finale effective"
    " (P4) y ajoute les transferts sociaux en nature (les biens et services"
    " individualisables que les administrations publiques et les associations"
    " leur fournissent gratuitement ou à prix réduit, soins remboursés, éducation,"
    " logement social). L'écart entre les deux est donc, par construction, la valeur"
    " de ces transferts, et il ne peut pas être négatif. Ces montants décrivent ce"
    " que les ménages consomment et non ce que les administrations dépensent : ils"
    " ne s'additionnent pas aux dépenses publiques publiées par ailleurs sur ce"
    " site. Le champ est celui des ménages résidents, où qu'ils dépensent : les"
    " achats des Français à l'étranger y sont, ceux des touristes en France n'y"
    " sont pas, la source portant à cet effet une correction territoriale."
)


class IdentiteRompue(RuntimeError):
    """La consommation effective est passée sous la dépense."""


def url(mesure: str) -> str:
    """La requête filtre le produit et la zone, pas seulement la lecture.

    Le jeu décline 551 produits : demander toutes les lignes de `P31` et ne
    garder le total qu'après coup fait dépasser la page de l'API, et le total
    disparaît sans que rien n'échoue — la série revient simplement vide. Le
    filtre appartient donc à l'URL.
    """
    return (
        f"{MELODI_BASE}/data/{JEU}?REF_SECTOR={SECTEUR}&STO={mesure}"
        f"&PRODUCT={FILTRES['PRODUCT']}"
        f"&COUNTERPART_AREA={FILTRES['COUNTERPART_AREA']}&maxResult=5000"
    )


def lire(charges: dict[str, bytes]) -> dict[str, dict[str, float]]:
    """{mesure: {exercice: montant en euros}}."""
    series: dict[str, dict[str, float]] = {}
    for mesure, contenu in charges.items():
        montants: dict[str, float] = {}
        for observation in json.loads(contenu).get("observations", []):
            dimensions = observation.get("dimensions", {})
            if dimensions.get("STO") != mesure:
                continue
            if any(dimensions.get(cle) != valeur for cle, valeur in FILTRES.items()):
                continue
            valeur = (
                observation.get("measures", {}).get("OBS_VALUE_NIVEAU") or {}
            ).get("value")
            if valeur is None:
                continue
            montants[dimensions["TIME_PERIOD"]] = float(valeur) * MILLIONS
        series[mesure] = montants
    return series


def controler(series: dict[str, dict[str, float]]) -> dict[str, int]:
    """La consommation effective ne descend jamais sous la dépense.

    Les transferts sociaux en nature — ce que la collectivité fournit sans le
    facturer — ne peuvent pas être négatifs. Une inversion des deux mesures, ou
    un filtre qui aurait laissé passer un autre secteur, se verrait ici.
    """
    depense, effective = series.get(DEPENSE, {}), series.get(EFFECTIVE, {})
    if not depense or not effective:
        raise IdentiteRompue(
            f"séries incomplètes : {len(depense)} dépenses, {len(effective)}"
            " consommations effectives — les deux sont nécessaires pour lire l'écart."
        )
    communs = sorted(set(depense) & set(effective))
    if not communs:
        raise IdentiteRompue("aucun exercice commun aux deux mesures")
    for exercice in communs:
        if effective[exercice] < depense[exercice]:
            raise IdentiteRompue(
                f"{exercice} : consommation effective"
                f" {effective[exercice] / MILLIONS:.0f} M€ sous la dépense"
                f" {depense[exercice] / MILLIONS:.0f} M€. Les transferts sociaux en"
                " nature seraient négatifs : les deux mesures sont inversées ou un"
                " autre secteur est passé."
            )
    return {"la_consommation_effective_depasse_la_depense": len(communs)}


def transferts_en_nature(series: dict[str, dict[str, float]]) -> dict[str, float]:
    """L'écart entre les deux mesures, exercice par exercice — ce que la
    collectivité fournit sans le facturer. Calculé pour le journal de qualité,
    pas publié : la source ne le nomme pas comme un agrégat de ce jeu."""
    depense, effective = series[DEPENSE], series[EFFECTIVE]
    return {
        exercice: effective[exercice] - depense[exercice]
        for exercice in sorted(set(depense) & set(effective))
    }


def lignes_a_ecrire(series: dict[str, dict[str, float]]) -> list[tuple]:
    return [
        (MESURES[mesure][0], "pays", "FR", MILLESIME, exercice, valeur)
        for mesure, montants in sorted(series.items())
        if mesure in MESURES
        for exercice, valeur in sorted(montants.items())
    ]


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for _, (identifiant, libelle, publique) in sorted(MESURES.items()):
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, 'Comptes nationaux annuels, secteur des ménages',
                        'euros courants', 'observed', array['Officiel','Donnée brute'])
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
                values (?, ?, ?, ?, ?, 'EUR', false, 'current', 'nationale',
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


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    garde_fou_volume(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        charges = {}
        for mesure in MESURES:
            adresse = url(mesure)
            contenu = telecharger(adresse, timeout=600)
            entrepot.record_asset(
                conn, store, run_id, DATASET, SOURCE, f"conso-{mesure}.json",
                contenu, adresse, "application/json",
            )
            charges[mesure] = contenu
        series = lire(charges)
        verifies = controler(series)
        lignes = lignes_a_ecrire(series)
        entrepot.etape(f"{len(lignes)} montants lus")
        ecrites, revisees = revisions.remplacer(
            conn, run_id, [m[0] for m in MESURES.values()], COLONNES, lignes
        )
        ecarts = transferts_en_nature(series)
        exercices = sorted(ecarts)
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'la_consommation_effective_depasse_la_depense', 'blocker',
                    true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "premier_exercice": exercices[0],
                "dernier_exercice": exercices[-1],
                "transferts_en_nature_millions": {
                    exercice: round(ecarts[exercice] / MILLIONS, 1)
                    for exercice in exercices[-3:]
                },
            })),
        )
        conn.commit()
        entrepot.finish_run(
            conn, run_id, "success",
            rows_read=sum(len(s) for s in series.values()), rows_written=ecrites,
        )
        dernier = exercices[-1]
        print(
            f"consommation : {ecrites} observations, {exercices[0]} à {dernier},"
            f" {revisees} valeurs révisées ; {dernier} : dépense"
            f" {series[DEPENSE][dernier] / MILLIONS:.0f} M€, effective"
            f" {series[EFFECTIVE][dernier] / MILLIONS:.0f} M€, soit"
            f" {ecarts[dernier] / MILLIONS:.0f} M€ de transferts en nature"
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
