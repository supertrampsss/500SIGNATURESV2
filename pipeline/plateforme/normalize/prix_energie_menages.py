"""Prix comparables du gaz et de l'electricite pour les menages europeens.

Eurostat publie plusieurs produits, tranches de consommation, monnaies, unites
et traitements fiscaux dans les memes cubes. Ce module refuse un cube dont une
de ces dimensions differe de la selection documentee : une valeur plausible
dans la mauvaise tranche ne devient jamais silencieusement une comparaison.

Usage : ``python -m plateforme.normalize.prix_energie_menages [--store ...]``
"""

import argparse
import json
import re

from plateforme import entrepot, revisions
from plateforme.connectors import eurostat
from plateforme.connectors.jsonstat import decoder
from plateforme.http import telecharger
from plateforme.normalize.geo import MILLESIME, make_store


ENERGIES = {
    "gaz": {
        "dataset": "nrg_pc_202",
        "siec": "G3000",
        "nrg_cons": "GJ20-199",
    },
    "electricite": {
        "dataset": "nrg_pc_204",
        "siec": "E7000",
        "nrg_cons": "KWH2500-4999",
    },
}
COMMON = {"freq": "S", "currency": "EUR", "unit": "KWH"}
TAXES = {
    "I_TAX": "ttc",
    "X_TAX": "hors_taxes_et_prelevements",
}

DATASET_IDS = {
    "gaz": "eurostat-nrg-pc-202",
    "electricite": "eurostat-nrg-pc-204",
}
INDICATEURS = {
    "gaz": {
        "I_TAX": "eurostat_prix_gaz_menages_d2_ttc",
        "X_TAX": "eurostat_prix_gaz_menages_d2_hors_taxes_et_prelevements",
    },
    "electricite": {
        "I_TAX": "eurostat_prix_electricite_menages_dc_ttc",
        "X_TAX": "eurostat_prix_electricite_menages_dc_hors_taxes_et_prelevements",
    },
}
UNITE_PUBLIEE = "EUR_per_kWh"
DIMENSIONS = {"freq", "siec", "nrg_cons", "unit", "tax", "currency", "geo", "time"}
DRAPEAUX = {
    "b": "break_in_series",
    "p": "provisional",
    "e": "estimated",
    "d": "definition_differs",
}
PERIODE_SEMESTRIELLE = re.compile(r"^(\d{4})-?S([12])$")


def parametres(energie: str) -> dict:
    """Filtres Eurostat complets pour un cube et ses deux traitements fiscaux."""
    if energie not in ENERGIES:
        raise ValueError(f"energie inconnue : {energie}")
    fiche = ENERGIES[energie]
    return {
        **COMMON,
        "siec": fiche["siec"],
        "nrg_cons": fiche["nrg_cons"],
        "tax": list(TAXES),
    }


def _categories(charge: dict, nom: str) -> list[str]:
    """Rend les categories d'une dimension dans leur ordre JSON-stat."""
    try:
        index = charge["dimension"][nom]["category"]["index"]
    except (KeyError, TypeError) as error:
        raise ValueError(f"dimension {nom} mal formee") from error
    if isinstance(index, dict):
        positions = list(index.values())
        if any(not isinstance(position, int) for position in positions):
            raise ValueError(f"dimension {nom} : index non entier")
        if sorted(positions) != list(range(len(positions))):
            raise ValueError(f"dimension {nom} : index non contigu")
        return sorted(index, key=index.get)
    if isinstance(index, list):
        return list(index)
    raise ValueError(f"dimension {nom} : index absent")


def normaliser_periode(periode: str) -> str:
    """Canonise la frequence semestrielle Eurostat en ``YYYY-S1``/``YYYY-S2``."""
    correspondance = PERIODE_SEMESTRIELLE.fullmatch(str(periode))
    if correspondance is None:
        raise ValueError(f"periode non semestrielle : {periode}")
    return f"{correspondance.group(1)}-S{correspondance.group(2)}"


def controler_dimensions(charge: dict, energie: str) -> None:
    """Refuse tout cube qui superposerait des series non comparables."""
    if energie not in ENERGIES:
        raise ValueError(f"energie inconnue : {energie}")
    ordre = charge.get("id")
    tailles = charge.get("size")
    dimensions = charge.get("dimension")
    if (
        not isinstance(ordre, list)
        or len(ordre) != len(DIMENSIONS)
        or set(ordre) != DIMENSIONS
        or not isinstance(dimensions, dict)
        or set(dimensions) != DIMENSIONS
        or not isinstance(tailles, list)
        or len(tailles) != len(ordre)
    ):
        raise ValueError("dimensions JSON-stat inattendues")

    categories = {nom: _categories(charge, nom) for nom in ordre}
    for position, nom in enumerate(ordre):
        if tailles[position] != len(categories[nom]):
            raise ValueError(f"dimension {nom} : taille incoherente")

    fiche = ENERGIES[energie]
    attendues = {
        "freq": [COMMON["freq"]],
        "siec": [fiche["siec"]],
        "nrg_cons": [fiche["nrg_cons"]],
        "unit": [COMMON["unit"]],
        "currency": [COMMON["currency"]],
        "tax": list(TAXES),
    }
    for nom, attendu in attendues.items():
        observe = categories[nom]
        if len(observe) != len(attendu) or set(observe) != set(attendu):
            raise ValueError(f"dimension {nom} non comparable : {observe!r}, attendu {attendu!r}")
    if not categories["geo"]:
        raise ValueError("dimension geo vide")
    if not categories["time"]:
        raise ValueError("dimension time vide")
    for periode in categories["time"]:
        normaliser_periode(periode)


def drapeaux_qualite(statut: str | None) -> list[str]:
    """Traduit les statuts connus et conserve explicitement tout code inconnu."""
    if not statut:
        return []
    drapeaux = []
    for code in re.findall(r"[A-Za-z0-9]", str(statut)):
        drapeau = DRAPEAUX.get(code, f"eurostat_status_{code}")
        if drapeau not in drapeaux:
            drapeaux.append(drapeau)
    return drapeaux


def normaliser(charge: dict, energie: str) -> list[dict]:
    """Normalise un cube valide sans convertir les EUR/kWh en EUR/100 kWh."""
    controler_dimensions(charge, energie)
    fiche = ENERGIES[energie]
    observations = []
    for point in decoder(charge):
        taxe = point["tax"]
        observations.append(
            {
                "indicateur": INDICATEURS[energie][taxe],
                "energie": energie,
                "dataset": fiche["dataset"],
                "produit": point["siec"],
                "bande_consommation": point["nrg_cons"],
                "traitement_fiscal": TAXES[taxe],
                "pays": point["geo"],
                "periode": normaliser_periode(point["time"]),
                "valeur": point["valeur"],
                "unite": UNITE_PUBLIEE,
                "quality_flags": drapeaux_qualite(point.get("statut")),
            }
        )
    if not observations:
        raise ValueError(f"aucune observation dans {fiche['dataset']}")
    return observations


def declarer(conn) -> None:
    """Declare les quatre series observees sans confondre TTC et hors taxes."""
    bandes = {"gaz": "D2 (20 a 199 GJ)", "electricite": "DC (2 500 a 4 999 kWh)"}
    noms = {"gaz": "gaz", "electricite": "electricite"}
    with conn.cursor() as curseur:
        for energie, par_taxe in INDICATEURS.items():
            for taxe, indicateur in par_taxe.items():
                fiscalite = (
                    "toutes taxes comprises" if taxe == "I_TAX" else "hors taxes et prelevements"
                )
                definition = curseur.execute(
                    """
                    insert into core.indicator_definitions
                        (public_definition, technical_definition, formula,
                         confidence_level, badges)
                    values (?, ?, ?, 'observed',
                            array['Officiel','Comparaison harmonisee UE'])
                    returning definition_id
                    """,
                    (
                        f"Prix du {noms[energie]} paye par les menages, {fiscalite}, "
                        "dans une tranche de consommation constante.",
                        f"Eurostat {ENERGIES[energie]['dataset']}, produit "
                        f"{ENERGIES[energie]['siec']}, bande {bandes[energie]}, "
                        f"taxe {taxe}, EUR par kWh, frequence semestrielle.",
                        "Valeur observee publiee par Eurostat, sans conversion d'unite.",
                    ),
                ).fetchone()[0]
                curseur.execute(
                    """
                    insert into core.indicators
                        (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                         additive, geo_levels, time_granularity, published)
                    values (?, ?, ?, 'energie', ?, ?, false,
                            array['pays'], 'semestrielle', true)
                    on conflict (indicator_id) do update set
                        dataset_id = excluded.dataset_id,
                        definition_id = excluded.definition_id,
                        label_fr = excluded.label_fr,
                        unit = excluded.unit,
                        published = true
                    """,
                    (
                        indicateur,
                        DATASET_IDS[energie],
                        definition,
                        f"Prix du {noms[energie]} des menages, {fiscalite}",
                        UNITE_PUBLIEE,
                    ),
                )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def enregistrer_pays(conn, codes: set[str]) -> set[str]:
    """Ajoute au referentiel les pays et agregats renvoyes par Eurostat."""
    with conn.cursor() as curseur:
        curseur.executemany(
            """
            insert into geo.geography_reference (geo_level, geo_code, vintage, name, flags)
            values ('pays', ?, ?, ?, ?)
            on conflict (geo_level, geo_code, vintage) do nothing
            """,
            [
                (code, MILLESIME, code, json.dumps({"agregat": True} if len(code) > 2 else {}))
                for code in sorted(codes)
            ],
        )
    conn.commit()
    return {
        code
        for (code,) in conn.execute(
            "select geo_code from geo.geography_reference where geo_level = 'pays' and vintage = ?",
            (MILLESIME,),
        ).fetchall()
    }


def run(store_spec: str) -> int:
    """Ingere chaque dataset une fois et archive un seul actif brut par dataset."""
    conn = entrepot.connect()
    store = make_store(store_spec)
    total = 0
    try:
        declarer(conn)
        for energie, fiche in ENERGIES.items():
            dataset_id = DATASET_IDS[energie]
            run_id = entrepot.start_run(conn, dataset_id, "manual")
            try:
                url = eurostat.data_url(fiche["dataset"], parametres(energie))
                contenu = telecharger(url, timeout=300)
                entrepot.record_asset(
                    conn,
                    store,
                    run_id,
                    dataset_id,
                    "eurostat",
                    f"{fiche['dataset']}.json",
                    contenu,
                    url,
                    "application/json",
                )
                observations = normaliser(json.loads(contenu), energie)
                pays = enregistrer_pays(conn, {observation["pays"] for observation in observations})
                lignes = [
                    (
                        observation["indicateur"],
                        "pays",
                        observation["pays"],
                        MILLESIME,
                        observation["periode"],
                        observation["valeur"],
                        observation["quality_flags"],
                    )
                    for observation in observations
                    if observation["pays"] in pays
                ]
                ecrites, _ = revisions.remplacer(
                    conn,
                    run_id,
                    list(INDICATEURS[energie].values()),
                    ("value", "quality_flags"),
                    lignes,
                    niveaux=("pays",),
                )
                conn.commit()
                entrepot.finish_run(
                    conn,
                    run_id,
                    "success",
                    rows_read=len(observations),
                    rows_written=ecrites,
                )
                total += ecrites
            except Exception as error:  # noqa: BLE001 - l'echec reste dans le lineage
                entrepot.finish_run(conn, run_id, "failed", error=str(error))
                raise
    finally:
        conn.close()
    print(f"Prix energie des menages : {total} observations")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--store", default=".snapshots")
    return run(parser.parse_args().store)


if __name__ == "__main__":
    raise SystemExit(main())
