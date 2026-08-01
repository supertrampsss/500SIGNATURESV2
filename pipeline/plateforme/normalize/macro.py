"""Dette publique française (INSEE, comptes nationaux) vers core.observations.

Ces chiffres relèvent de la **comptabilité nationale**, pas du budget de l'État :
la dette au sens de Maastricht couvre toutes les administrations publiques,
Sécurité sociale et collectivités comprises. Le cadre comptable est porté par
chaque indicateur pour interdire les rapprochements abusifs (docs/00, §2).

Trois pièges de la source, traités explicitement :

1. **Rebasement.** Les bases comptables coexistent : `CNA-2014-DETTE-APU`
   répond encore mais s'arrête en 2022. La base 2020 (`DETTE-TRIM-APU-2020`)
   est la série vivante. Publier la première afficherait un chiffre périmé
   comme s'il était courant.
2. **Ventilation par instrument.** Le même jeu contient l'ensemble de la dette
   et sa décomposition par instrument financier (dépôts, titres, crédits) ;
   seul `DETTE_MAASTRICHT_INTRUMENTS = F` désigne le total.
3. **Sous-secteurs non additifs.** S13 est le total des administrations : il ne
   s'ajoute pas à l'État, aux collectivités et à la Sécurité sociale.

Le déficit n'existe pas en base courante dans la BDM : il vient d'Eurostat,
qui est de toute façon la référence pour les agrégats de Maastricht.

Usage : python -m plateforme.normalize.macro [--store r2:plateforme-raw]
"""

import argparse

from plateforme import db
from plateforme.connectors import insee, sdmx
from plateforme.normalize.geo import MILLESIME, make_store

DATASET = "bdm-dette-apu"
DATAFLOW = "DETTE-TRIM-APU-2020"
ENSEMBLE = "F"  # tous instruments confondus

# (suffixe, libellé de l'indicateur, sujet des phrases, pronom)
SOUS_SECTEURS = {
    "S13": ("apu", "Dette publique", "les administrations publiques", "elles"),
    "S13111": ("etat", "Dette de l'État", "l'État", "il"),
    "S13112": ("odac", "Dette des organismes d'administration centrale", "ces organismes", "ils"),
    "S1313": ("apul", "Dette des collectivités locales", "les collectivités locales", "elles"),
    "S1314": ("asso", "Dette de la Sécurité sociale", "la Sécurité sociale", "elle"),
}


def _plan() -> dict[str, dict]:
    """{indicateur: filtres et fiche}. La sélection reste lisible dans le code
    plutôt que cachée derrière des identifiants opaques."""
    plan = {}
    for secteur, (suffixe, libelle, sujet, pronom) in SOUS_SECTEURS.items():
        base = {
            "INDICATEUR": "DETTE_MAASTRICHT",
            "SECT-INST": secteur,
            "DETTE_MAASTRICHT_INTRUMENTS": ENSEMBLE,
        }
        plan[f"insee_dette_{suffixe}_montant"] = {
            "filtres": {**base, "UNIT_MEASURE": "EUROS"},
            "libelle": libelle,
            "public": f"Total des emprunts que {sujet} doit encore rembourser, mesuré selon"
            " la règle européenne commune qui permet de comparer les pays."
            f" Les intérêts à venir n'y figurent pas.",
            "technique": "Dette brute consolidée au sens du traité de Maastricht,"
            f" sous-secteur {secteur}, tous instruments financiers.",
            "unite": "EUR",
            "base_prix": "current",
        }
        if secteur == "S13":  # la part de PIB n'est publiée que pour le total
            plan["insee_dette_apu_part_pib"] = {
                "filtres": {**base, "UNIT_MEASURE": "POURCENT"},
                "libelle": "Dette publique en % du PIB",
                "public": "La dette rapportée à la richesse produite en un an."
                " C'est la mesure retenue pour comparer les pays européens,"
                f" parce qu'{pronom} tient compte de la taille de l'économie.",
                "technique": "Dette brute consolidée au sens de Maastricht rapportée au"
                " produit intérieur brut, sous-secteur S13.",
                "unite": "percent",
                "base_prix": None,
            }
    return plan


def declarer(conn, plan: dict[str, dict]) -> None:
    with conn.cursor() as curseur:
        for indicateur, fiche in plan.items():
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, confidence_level, badges)
                values (%s, %s, 'Comptes nationaux trimestriels, base 2020', 'observed',
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
                values (%s, %s, %s, 'dette', %s, %s, false, %s, 'nationale',
                        array['pays'], 'trimestrielle', true)
                on conflict (indicator_id) do update set
                    definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                    time_granularity = excluded.time_granularity, published = true
                """,
                (indicateur, DATASET, definition, fiche["libelle"], fiche["unite"],
                 fiche["base_prix"]),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def ecrire(conn, run_id: str, indicateur: str, entrees: list[dict]) -> int:
    lignes = [
        (indicateur, "pays", "FR", MILLESIME, obs["periode"], obs["valeur"],
         [] if obs["statut"] in (None, "A") else ["low_reliability"], run_id)
        for entree in entrees
        for obs in entree["observations"]
    ]
    if not lignes:
        return 0
    with conn.cursor() as curseur:
        curseur.execute("delete from core.observations where indicator_id = %s", (indicateur,))
        with curseur.copy(
            "copy core.observations (indicator_id, geo_level, geo_code, geo_vintage,"
            " period, value, quality_flags, run_id) from stdin"
        ) as copie:
            for ligne in lignes:
                copie.write_row(ligne)
    conn.commit()
    return len(lignes)


def run(store_spec: str) -> int:
    conn = db.connect()
    store = make_store(store_spec)
    plan = _plan()
    declarer(conn, plan)
    run_id = db.start_run(conn, DATASET, "manual")
    try:
        contenu = insee.bdm_sdmx(DATAFLOW)
        db.record_asset(
            conn, store, run_id, DATASET, "insee-bdm", "dette-apu.xml", contenu,
            f"{insee.BDM_BASE}/data/{DATAFLOW}", "application/xml",
        )
        entrees = sdmx.series(contenu)
        total, vides = 0, []
        for indicateur, fiche in plan.items():
            choisies = sdmx.choisir(entrees, fiche["filtres"])
            if len(choisies) > 1:
                # Plusieurs séries pour une même clé : la sélection est ambiguë
                # et produirait des doublons silencieux.
                raise ValueError(f"{indicateur} : {len(choisies)} séries pour un seul indicateur")
            ecrites = ecrire(conn, run_id, indicateur, choisies)
            total += ecrites
            if ecrites == 0:
                vides.append(indicateur)
        if vides:
            raise ValueError(f"séries introuvables : {', '.join(vides)}")
        db.finish_run(conn, run_id, "success", rows_written=total)
        print(f"dette : {total} observations sur {len(plan)} indicateurs")
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
