"""Conjoncture économique (Eurostat) : inflation et croissance, niveau pays.

Le débat économique public se joue sur deux chiffres à haute fréquence —
l'inflation du mois, la croissance du trimestre — et le site n'en disait rien
en dessous de l'année. Ce connecteur charge les deux séries qui font parler :

- **Inflation IPCH** (prc_hicp_manr) : hausse des prix sur douze mois, indice
  **harmonisé** européen. Ce n'est pas l'IPC national de l'INSEE — même
  direction, pondérations différentes (santé, logement) — et les deux ne se
  mélangent jamais dans une même série.
- **Croissance du PIB** (namq_10_gdp) : variation du PIB trimestriel en volume,
  corrigée des saisons et du calendrier (SCA), par rapport au **même trimestre
  de l'année précédente** (CLV_PCH_SM) — pas le trimestre-sur-trimestre des
  titres de presse. Le choix est dit dans la fiche.

**Unité verrouillée structurellement.** La réponse JSON-stat rend écho de la
dimension ``unit`` : si Eurostat servait autre chose que RCH_A / CLV_PCH_SM
sous la même URL, le chargement refuse. Le précédent DREES (unité annoncée
changée sous un en-tête identique) a montré que ce contrôle doit être
bloquant, pas statistique.

**Bornes de plausibilité calibrées sur le réel.** La Turquie a dépassé 85 %
d'inflation IPCH (fin 2022), l'Irlande +20 % de PIB en glissement (2021,
relocalisations comptables) : les bornes laissent passer ces valeurs vraies et
arrêtent les artefacts — un niveau d'indice (~120) lu comme un taux, une
virgule perdue. Les écartées sont comptées, jamais tues.

**La France est bloquante.** Une série de conjoncture sans la France n'a pas
d'usage ici : son absence signe une réponse cassée, pas une donnée.

Les rechargements passent par l'archive des révisions : un PIB trimestriel est
révisé plusieurs fois dans les 90 jours, et une croissance revue à la baisse
est une information, pas un détail d'intendance.

Usage : python -m plateforme.normalize.conjoncture [--store r2:plateforme-raw]
"""

import argparse
import json


from plateforme import entrepot, revisions
from plateforme.connectors import eurostat
from plateforme.connectors.jsonstat import decoder
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.europe import DRAPEAUX, enregistrer_pays
from plateforme.normalize.geo import MILLESIME, make_store

# La charte impose 50 mots au plus par définition grand public — vérifié par
# le schéma (0004) et par un test hors ligne. La pédagogie longue vit sur le
# site, pas ici.
INDICATEURS = {
    "eurostat_inflation_ipch": {
        "dataset": "eurostat-prc-hicp-manr",
        "jeu": "prc_hicp_manr",
        "params": {
            "coicop": "CP00",
            "unit": "RCH_A",
            "freq": "M",
            "sinceTimePeriod": "2013-01",
        },
        "unite_attendue": "RCH_A",
        "granularite": "mensuelle",
        "bornes": (-15.0, 120.0),
        "libelle": "Inflation (IPCH, sur un an)",
        "public": "La hausse des prix à la consommation sur douze mois, mesurée"
        " par l'indice harmonisé européen (IPCH). Ce n'est pas l'indice national"
        " de l'INSEE : l'indice harmonisé sert à comparer les pays entre eux, à"
        " définitions identiques.",
        "technique": "Taux de variation annuel de l'IPCH tous postes (COICOP"
        " CP00), série mensuelle non corrigée des variations saisonnières,"
        " unité RCH_A.",
    },
    "eurostat_croissance_pib": {
        "dataset": "eurostat-namq-10-gdp",
        "jeu": "namq_10_gdp",
        "params": {
            "na_item": "B1GQ",
            "unit": "CLV_PCH_SM",
            "s_adj": "SCA",
            "freq": "Q",
            "sinceTimePeriod": "2013-Q1",
        },
        "unite_attendue": "CLV_PCH_SM",
        "granularite": "trimestrielle",
        "bornes": (-30.0, 40.0),
        "libelle": "Croissance du PIB (volume, sur un an)",
        "public": "La variation de la richesse produite, hors effet des prix,"
        " par rapport au même trimestre de l'année précédente, corrigée des"
        " saisons. Ce n'est pas le chiffre trimestre sur trimestre des titres de"
        " presse : le glissement annuel lisse les à-coups.",
        "technique": "PIB trimestriel en volumes chaînés (na_item B1GQ),"
        " variation par rapport au même trimestre de l'année précédente"
        " (CLV_PCH_SM), corrigé des variations saisonnières et de calendrier"
        " (SCA).",
    },
}


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for indicateur, fiche in INDICATEURS.items():
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, confidence_level, badges)
                values (?, ?, ?, 'observed',
                        array['Officiel','Comparaison harmonisée UE'])
                returning definition_id
                """,
                (fiche["public"], fiche["technique"], f"Eurostat, jeu {fiche['jeu']}"),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, accounting_frame, geo_levels, time_granularity, published)
                values (?, ?, ?, 'macro', ?, 'percent', false, 'nationale',
                        array['pays'], ?, true)
                on conflict (indicator_id) do update set unit = excluded.unit,
                    definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                    theme = excluded.theme, time_granularity = excluded.time_granularity,
                    published = true
                """,
                (indicateur, fiche["dataset"], definition, fiche["libelle"],
                 fiche["granularite"]),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def controler_unite(charge: dict, attendue: str) -> None:
    """Refuse de charger si la réponse ne porte pas l'unité demandée.

    L'API filtre sur ``unit`` mais rien ne garantit qu'elle le fera toujours :
    un changement de nomenclature côté producteur renverrait une autre unité
    sous la même URL, et un niveau d'indice chargé comme un taux ferait dire
    au site que les prix montent de 120 % par an.
    """
    index = charge["dimension"]["unit"]["category"]["index"]
    unites = sorted(index, key=index.get) if isinstance(index, dict) else list(index)
    if unites != [attendue]:
        raise ValueError(
            f"unité servie {unites} au lieu de ['{attendue}'] : chargement refusé"
        )


def exiger_france(points: list[dict], indicateur: str) -> None:
    if not any(p["geo"] == "FR" for p in points):
        raise ValueError(f"{indicateur} : la France est absente de la réponse")


def controler_plausibilite(
    points: list[dict], bornes: tuple[float, float]
) -> tuple[list[dict], dict]:
    """Écarte et compte les valeurs hors bornes — sans jamais les corriger."""
    basse, haute = bornes
    gardes, ecartes = [], {}
    for p in points:
        if basse <= p["valeur"] <= haute:
            gardes.append(p)
        else:
            ecartes[f"{p['geo']}/{p['time']}"] = p["valeur"]
    return gardes, ecartes


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    garde_fou_volume(conn)
    total = 0
    for indicateur, fiche in INDICATEURS.items():
        run_id = entrepot.start_run(conn, fiche["dataset"], "manual")
        try:
            url = eurostat.data_url(fiche["jeu"], fiche["params"])
            contenu = telecharger(url, timeout=300)
            entrepot.record_asset(
                conn, store, run_id, fiche["dataset"], "eurostat",
                f"{indicateur}.json", contenu, url, "application/json",
            )
            charge = json.loads(contenu)
            controler_unite(charge, fiche["unite_attendue"])
            points = decoder(charge)
            exiger_france(points, indicateur)
            gardes, ecartes = controler_plausibilite(points, fiche["bornes"])
            exiger_france(gardes, indicateur)  # la France écartée bloquerait aussi
            pays = enregistrer_pays(conn, {p["geo"] for p in gardes})
            lignes = (
                (indicateur, "pays", p["geo"], MILLESIME, p["time"], p["valeur"],
                 [DRAPEAUX[p["statut"]]] if p.get("statut") in DRAPEAUX else [])
                for p in gardes
                if p["geo"] in pays
            )
            ecrites, revisees = revisions.remplacer(
                conn, run_id, [indicateur], ("value", "quality_flags"), lignes,
            )
            conn.execute(
                """
                insert into meta.data_quality_checks
                    (run_id, dataset_id, check_name, severity, passed, observed)
                values (?, ?, 'bornes_de_plausibilite', ?, ?, ?)
                """,
                (run_id, fiche["dataset"], "warning" if ecartes else "info",
                 not ecartes, json.dumps({"bornes": fiche["bornes"], "ecartes": ecartes})),
            )
            conn.commit()
            entrepot.finish_run(
                conn, run_id, "success", rows_read=len(points), rows_written=ecrites
            )
            total += ecrites
            print(f"{indicateur} : {ecrites} observations,"
                  f" {len({p['geo'] for p in gardes})} pays, {len(ecartes)} écartées,"
                  f" {revisees} valeurs révisées")
        except Exception as error:  # noqa: BLE001 — tout échec finit tracé dans le lineage
            entrepot.finish_run(conn, run_id, "failed", error=str(error))
            raise
    conn.close()
    print(f"conjoncture : {total} observations")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--store", default=".snapshots")
    return run(parser.parse_args().store)


if __name__ == "__main__":
    raise SystemExit(main())
