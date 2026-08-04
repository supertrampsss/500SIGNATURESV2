"""Taux de chômage localisé (INSEE, BDM) vers core.observations.

Le chômage est l'indicateur économique le plus consulté, et celui où les
confusions coûtent le plus cher. Trois précautions sont donc codées ici :

**Chômage au sens du BIT, pas demandeurs d'emploi.** Cette série mesure les
personnes sans emploi, disponibles et en recherche active, au sens du Bureau
international du travail. Ce n'est pas le nombre d'inscrits à France Travail :
les deux mesures diffèrent de plusieurs centaines de milliers de personnes et
ne se substituent jamais l'une à l'autre. Le schéma l'impose déjà pour
`fin.public_employment` ; la fiche de l'indicateur le dit au lecteur.

**Un taux ne s'additionne pas.** Le taux d'un département et celui de son voisin
ne se somment pas, et ne se moyennent pas sans pondérer par la population
active. L'indicateur est déclaré non sommable.

**France métropolitaine n'est pas la France.** La source publie une série
« France métropolitaine » et une série « France entière hors Mayotte ». Ni
l'une ni l'autre ne couvre le territoire national : elles ne sont pas chargées
au niveau `pays`, où elles seraient prises pour le chiffre national.

Les données sont corrigées des variations saisonnières : c'est ce qui rend deux
trimestres comparables, et cela figure dans la définition technique.

Usage : python -m plateforme.normalize.chomage [--store r2:plateforme-raw]
"""

import argparse

from plateforme import entrepot, revisions
from plateforme.connectors import insee, sdmx
from plateforme.normalize.geo import MILLESIME, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "bdm-taux-chomage"
SOURCE = "insee-bdm"
DATAFLOW = "TAUX-CHOMAGE"

INDICATEUR = "insee_taux_chomage_localise"
FICHE = {
    "libelle": "Taux de chômage",
    "public": "La part des actifs sans emploi, disponibles et cherchant du travail,"
    " au sens du Bureau international du travail. Ce n'est pas le nombre d'inscrits"
    " à France Travail, qui obéit à d'autres règles et donne un chiffre différent.",
    "technique": "Taux de chômage localisé trimestriel au sens du BIT, corrigé des"
    " variations saisonnières, rapporté à la population active du territoire.",
    "formule": "Chômeurs au sens du BIT / population active",
}


def zone_vers_territoire(zone: str) -> tuple[str, str] | None:
    """`D33` -> (departement, 33) ; `R75` -> (region, 75).

    Les agrégats « France métropolitaine » et « France entière hors Mayotte »
    ne couvrent pas le territoire national : ils sont écartés plutôt que rangés
    au niveau `pays`, où ils passeraient pour le chiffre France.
    """
    if not zone or len(zone) < 2:
        return None
    if zone.startswith("D") and len(zone) in (3, 4):
        return ("departement", zone[1:])
    if zone.startswith("R") and len(zone) == 3:
        return ("region", zone[1:])
    return None


def observations(series: list[dict]) -> list[tuple]:
    """-> [(indicateur, niveau, code, période, valeur, drapeaux)]."""
    lignes = []
    for serie in series:
        attributs = serie["attributs"]
        cible = zone_vers_territoire(attributs.get("REF_AREA", ""))
        if cible is None:
            continue
        niveau, code = cible
        for obs in serie["observations"]:
            if obs["valeur"] is None:
                continue
            # « SD » : semi-définitif. La valeur est publiable, mais le lecteur
            # doit savoir qu'elle peut bouger à la prochaine parution.
            drapeaux = [] if obs["statut"] in (None, "A") else ["provisional"]
            lignes.append((INDICATEUR, niveau, code, obs["periode"], obs["valeur"], drapeaux))
    return lignes


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        definition = curseur.execute(
            """
            insert into core.indicator_definitions
                (public_definition, technical_definition, formula, confidence_level, badges)
            values (?, ?, ?, 'observed', array['Officiel','Donnée brute'])
            returning definition_id
            """,
            (FICHE["public"], FICHE["technique"], FICHE["formule"]),
        ).fetchone()[0]
        curseur.execute(
            """
            insert into core.indicators
                (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                 additive, seasonal_adjustment, geo_levels, time_granularity, published)
            values (?, ?, ?, 'emploi', ?, 'percent', false, 'cvs-cjo',
                    array['departement','region'], 'trimestrielle', true)
            on conflict (indicator_id) do update set
                definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                theme = excluded.theme, additive = false, published = true
            """,
            (INDICATEUR, DATASET, definition, FICHE["libelle"]),
        )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def ecrire(conn, run_id: str, lignes: list[tuple]) -> tuple[int, int, int]:
    """Remplace la série en archivant ce qui change : le chômage localisé est
    la série la plus révisée du site — l'INSEE réestime les derniers trimestres
    à chaque parution, et le passage de « semi-définitif » à définitif fait
    partie de la vie du chiffre (docs/02 §C)."""
    sans_drapeaux = [ligne[:5] for ligne in lignes]
    gardees, ecartes = filtrer_territoires_connus(conn, sans_drapeaux)
    connus = {(ligne[1], ligne[2]) for ligne in gardees}
    ecrites, revisees = revisions.remplacer(
        conn,
        run_id,
        [INDICATEUR],
        ("value", "quality_flags"),
        (
            (cle, niveau, code, MILLESIME, periode, valeur, drapeaux)
            for cle, niveau, code, periode, valeur, drapeaux in lignes
            if (niveau, code) in connus
        ),
    )
    conn.commit()
    return ecrites, len(ecartes), revisees


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        contenu = insee.bdm_sdmx(DATAFLOW)
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "taux-chomage.xml", contenu,
            f"{insee.BDM_BASE}/data/{DATAFLOW}", "application/xml",
        )
        series = sdmx.series(contenu)
        lignes = observations(series)
        if not lignes:
            raise ValueError("aucune série de chômage localisé exploitable")
        ecrites, ecartes, revisees = ecrire(conn, run_id, lignes)
        territoires = len({(ligne[1], ligne[2]) for ligne in lignes})
        periodes = sorted({ligne[3] for ligne in lignes})
        entrepot.finish_run(conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites)
        print(
            f"chômage : {ecrites} observations sur {territoires} territoires, "
            f"{periodes[0]} → {periodes[-1]}"
        )
        if revisees:
            print(f"{revisees} valeurs déjà publiées ont changé ; les anciennes sont archivées")
        if ecartes:
            print(f"{ecartes} territoires absents du référentiel, écartés")
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
