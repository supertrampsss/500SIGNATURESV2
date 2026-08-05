"""Dépenses publiques par fonction (Eurostat, COFOG) vers core.observations.

« Combien l'État dépense-t-il pour la santé ou la défense ? » est la question
fondatrice du produit, et elle était restée sans réponse : la ventilation par
mission du budget de l'État est inatteignable depuis les sources ouvertes
(docs/08). La classification COFOG y répond autrement — et mieux pour un
citoyen : au niveau de **l'ensemble des administrations publiques** (État,
collectivités, Sécurité sociale), là où la santé est surtout payée par la Sécu
et l'enseignement en partie par les collectivités. Un « budget de l'État par
mission » aurait d'ailleurs répondu à côté : la mission Santé de l'État pèse
1,5 Md€ quand la dépense publique de santé en pèse plus de 260.

En % du PIB et par Eurostat : les deux choix qui rendent la comparaison
honnête. La France se lit alors face à l'Allemagne ou à la zone euro sur la
même définition — doctrine du produit (docs/00 §7), Eurostat prime sur les
sources nationales pour comparer des pays.

**Contrôle d'identité.** La somme des dix fonctions doit redonner le total
publié, à l'arrondi près (dix valeurs à 0,1 point : ±0,5 au pire, tolérance
0,6). Un pays-année qui ne referme pas cette identité est mis en quarantaine et
compté, jamais publié : c'est la même règle que pour le budget de l'État.

Usage : python -m plateforme.normalize.cofog [--store r2:plateforme-raw]
"""

import argparse
import json


from plateforme import entrepot
from plateforme.connectors import eurostat
from plateforme.connectors.jsonstat import decoder
from plateforme.http import telecharger
from plateforme.normalize.europe import DRAPEAUX, enregistrer_pays
from plateforme.normalize.geo import MILLESIME, make_store

DATASET = "eurostat-gov-10a-exp"
JEU = "gov_10a_exp"

# S13 : toutes les administrations publiques. TE : dépense totale de la
# fonction. Depuis 2013 : la même profondeur que le budget de l'État.
PARAMS = {
    "na_item": "TE",
    "sector": "S13",
    "unit": "PC_GDP",
    "freq": "A",
    "sinceTimePeriod": "2013",
    "cofog99": ["TOTAL", "GF01", "GF02", "GF03", "GF04", "GF05",
                "GF06", "GF07", "GF08", "GF09", "GF10"],
}

TOLERANCE_PTS = 0.6  # dix valeurs arrondies à 0,1 : l'écart honnête maximal

# Une fonction COFOG = un indicateur. Les libellés sont ceux de la
# classification, en français courant.
FONCTIONS = {
    "GF01": ("eurostat_fonction_services_generaux", "Services publics généraux",
             "Le fonctionnement général des institutions : Parlement, administration"
             " centrale et locale, service de la dette, aide internationale."),
    "GF02": ("eurostat_fonction_defense", "Défense",
             "Les armées, la défense civile et l'aide militaire."),
    "GF03": ("eurostat_fonction_ordre_securite", "Ordre et sécurité publics",
             "Police, justice, prisons et protection contre l'incendie."),
    "GF04": ("eurostat_fonction_affaires_economiques", "Affaires économiques",
             "Transports, énergie, agriculture, industrie et soutien à l'économie."),
    "GF05": ("eurostat_fonction_environnement", "Protection de l'environnement",
             "Déchets, eaux usées, lutte contre la pollution, protection de la nature."),
    "GF06": ("eurostat_fonction_logement", "Logement et équipements collectifs",
             "Le développement du logement et des équipements collectifs,"
             " l'éclairage public, l'alimentation en eau."),
    "GF07": ("eurostat_fonction_sante", "Santé",
             "Hôpitaux, soins de ville, médicaments — pour l'essentiel financés par"
             " la Sécurité sociale, pas par le budget de l'État."),
    "GF08": ("eurostat_fonction_culture", "Loisirs, culture et culte",
             "Sport, culture, audiovisuel public et cultes."),
    "GF09": ("eurostat_fonction_enseignement", "Enseignement",
             "De la maternelle à l'université, formation continue comprise."),
    "GF10": ("eurostat_fonction_protection_sociale", "Protection sociale",
             "Retraites, chômage, famille, maladie et invalidité, exclusion : le"
             " premier poste de la dépense publique française, et de loin."),
}
TOTAL = ("eurostat_depenses_publiques_pib", "Dépenses publiques totales",
         "Tout ce que dépensent l'État, les collectivités et la Sécurité sociale,"
         " rapporté à la richesse produite dans l'année.")


def declarer(conn) -> None:
    fiches = [*FONCTIONS.values(), TOTAL]
    with conn.cursor() as curseur:
        for indicateur, libelle, publique in fiches:
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, confidence_level, badges)
                values (?, ?, ?, 'observed',
                        array['Officiel','Comparaison harmonisée UE'])
                returning definition_id
                """,
                (
                    publique,
                    "Dépenses des administrations publiques (S13) par fonction COFOG,"
                    " en % du PIB, comptabilité nationale harmonisée SEC 2010.",
                    f"Eurostat, jeu {JEU}, na_item TE, unité PC_GDP",
                ),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, accounting_frame, geo_levels, time_granularity, published)
                values (?, ?, ?, 'fonctions', ?, 'percent', false, 'nationale',
                        array['pays'], 'annuelle', true)
                on conflict (indicator_id) do update set
                    definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                    theme = excluded.theme, published = true
                """,
                (indicateur, DATASET, definition, libelle),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def controler_identite(points: list[dict]) -> tuple[list[dict], dict]:
    """Écarte les pays-années dont la somme des fonctions ne redonne pas le total.

    Le constat conserve chaque écart écarté : une quarantaine muette serait une
    destruction silencieuse.
    """
    par_cle: dict[tuple, dict[str, float]] = {}
    for p in points:
        par_cle.setdefault((p["geo"], p["time"]), {})[p["cofog99"]] = p["valeur"]
    ecartes = {}
    for (geo, temps), valeurs in par_cle.items():
        total = valeurs.get("TOTAL")
        fonctions = [v for k, v in valeurs.items() if k != "TOTAL"]
        if total is None or len(fonctions) < len(FONCTIONS):
            # série incomplète : sans les dix fonctions et le total, l'identité
            # ne peut pas se vérifier — on écarte plutôt que de publier un trou
            ecartes[f"{geo}/{temps}"] = "serie incomplete"
            continue
        ecart = abs(sum(fonctions) - total)
        if ecart > TOLERANCE_PTS:
            ecartes[f"{geo}/{temps}"] = round(ecart, 2)
    gardes = [p for p in points if f"{p['geo']}/{p['time']}" not in ecartes]
    return gardes, ecartes


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        url = eurostat.data_url(JEU, PARAMS)
        contenu = telecharger(url, timeout=300)
        entrepot.record_asset(
            conn, store, run_id, DATASET, "eurostat", "gov_10a_exp.json",
            contenu, url, "application/json",
        )
        points = decoder(json.loads(contenu))
        gardes, ecartes = controler_identite(points)
        pays = enregistrer_pays(conn, {p["geo"] for p in gardes})
        lignes = []
        for p in gardes:
            if p["geo"] not in pays:
                continue
            indicateur = TOTAL[0] if p["cofog99"] == "TOTAL" else FONCTIONS[p["cofog99"]][0]
            lignes.append(
                (indicateur, "pays", p["geo"], MILLESIME, p["time"], p["valeur"],
                 [DRAPEAUX[p["statut"]]] if p.get("statut") in DRAPEAUX else [], run_id)
            )
        with conn.cursor() as curseur:
            curseur.execute(
                "delete from core.observations where indicator_id = any(?)",
                ([TOTAL[0], *[f[0] for f in FONCTIONS.values()]],),
            )
            entrepot.copier(
                conn,
                "core.observations",
                ["indicator_id", "geo_level", "geo_code", "geo_vintage", "period", "value", "quality_flags", "run_id"],
                (ligne for ligne in lignes),
            )
            curseur.execute(
                """
                insert into meta.data_quality_checks
                    (run_id, dataset_id, check_name, severity, passed, observed)
                values (?, ?, 'identite_somme_des_fonctions', ?, ?, ?)
                """,
                (run_id, DATASET, "warning" if ecartes else "info",
                 not ecartes, json.dumps({"tolerance_pts": TOLERANCE_PTS, "ecartes": ecartes})),
            )
        conn.commit()
        entrepot.finish_run(conn, run_id, "success", rows_read=len(points), rows_written=len(lignes))
        print(f"fonctions : {len(lignes)} observations, {len({p['geo'] for p in gardes})} pays,"
              f" {len(ecartes)} pays-années en quarantaine")
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
