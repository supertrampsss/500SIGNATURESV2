"""T-17 — Exports statiques : Supabase -> fichiers JSON publiés dans R2.

La carte ne requête jamais la base : elle lit des fichiers versionnés servis par
le CDN (docs/03 §3). Ces fichiers *sont* le jeu de données public — les
republier ne coûte rien et les rend vérifiables par des tiers.

Chaque publication vit sous `data/<version>/`, immuable. Seul
`data/derniere.json` est réécrit : c'est le pointeur que le site interroge.

Usage : python -m plateforme.publish [--publication r2:plateforme-published]
"""

import argparse
import json
from collections import defaultdict
from datetime import UTC, datetime

from plateforme import db
from plateforme.normalize.geo import make_store

NIVEAUX = ["commune", "epci", "departement", "region", "pays"]

# Seuls ces niveaux ont des tuiles : produire des couches de carte pour les
# autres coûterait des centaines de fichiers que rien ne viendrait lire.
NIVEAUX_CARTOGRAPHIES = {"commune", "departement", "region"}


def _json(charge) -> bytes:
    return json.dumps(charge, ensure_ascii=False, separators=(",", ":")).encode()


def manifeste(conn, version: str) -> dict:
    """Matière du panneau « D'où vient ce chiffre ? » : pour chaque jeu, son
    producteur, sa licence et la date d'extraction réellement utilisée."""
    jeux = conn.execute(
        """
        select d.dataset_id, d.title, s.producer, s.license, d.endpoint_url,
               max(a.fetched_at) as extraction
        from meta.dataset_registry d
        join meta.source_registry s using (source_id)
        join meta.raw_assets a on a.dataset_id = d.dataset_id
        group by 1, 2, 3, 4, 5 order by 1
        """
    ).fetchall()
    return {
        "version": version,
        "genere_le": datetime.now(UTC).isoformat(timespec="seconds"),
        "jeux": [
            {
                "id": jeu, "titre": titre, "producteur": producteur, "licence": licence,
                "url": url, "extraction": extraction.isoformat(timespec="seconds"),
            }
            for jeu, titre, producteur, licence, url, extraction in jeux
        ],
    }


def indicateurs(conn) -> list[dict]:
    """La fiche en 10 points (docs/06) accompagne chaque indicateur publié."""
    lignes = conn.execute(
        """
        select i.indicator_id, i.label_fr, i.unit, i.theme, i.additive, i.price_basis,
               i.accounting_frame, i.geo_levels, d.public_definition, d.technical_definition,
               d.formula, d.confidence_level, d.badges, i.dataset_id,
               (select array_agg(distinct o.period order by o.period)
                  from core.observations o where o.indicator_id = i.indicator_id) as periodes
        from core.indicators i
        left join core.indicator_definitions d on d.definition_id = i.definition_id
        where i.published order by i.theme, i.label_fr
        """
    ).fetchall()
    return [
        {
            "id": ligne[0], "libelle": ligne[1], "unite": ligne[2], "theme": ligne[3],
            "sommable": ligne[4], "base_prix": ligne[5], "cadre_comptable": ligne[6],
            "niveaux": ligne[7], "definition": ligne[8], "definition_technique": ligne[9],
            "formule": ligne[10], "confiance": ligne[11], "badges": ligne[12],
            "jeu": ligne[13], "periodes": ligne[14] or [],
        }
        for ligne in lignes
    ]


def couples_publies(conn, niveau: str) -> list[tuple[str, str]]:
    return [
        (indicateur, periode)
        for indicateur, periode in conn.execute(
            """
            select distinct o.indicator_id, o.period
            from core.observations o join core.indicators i using (indicator_id)
            where o.geo_level = %s and i.published and o.value_status = 'normal'
            order by 1, 2
            """,
            (niveau,),
        )
    ]


def valeurs_par_niveau(conn, niveau: str) -> dict[str, dict[str, dict[str, float]]]:
    """-> {indicateur: {periode: {code: valeur}}}.

    Interrogé indicateur par indicateur : lire 1,3 million de lignes d'un seul
    curseur faisait tomber la connexion sur une instance de plan gratuit. Les
    valeurs sous secret statistique ne sont pas exportées comme des zéros :
    elles sont absentes, et la fiche de l'indicateur dit pourquoi.
    """
    valeurs: dict = defaultdict(lambda: defaultdict(dict))
    for indicateur, periode in couples_publies(conn, niveau):
        for code, valeur in conn.execute(
            """
            select o.geo_code, o.value from core.observations o
            where o.geo_level = %s and o.indicator_id = %s and o.period = %s
              and o.value_status = 'normal'
            """,
            (niveau, indicateur, periode),
        ):
            valeurs[indicateur][periode][code] = float(valeur)
    return valeurs


# Critères du groupe de comparaison, repris de la classification de l'OFGL.
# Trois critères suffisent à constituer des groupes lisibles ; en ajouter
# davantage produirait des groupes d'une poignée de communes, où la position
# d'un territoire ne voudrait plus rien dire.
CRITERES_GROUPE = ["tranche_population", "rural", "outre_mer"]


def comparaisons(conn) -> dict:
    """Quartiles par groupe de communes semblables, calculés à la publication.

    Répondre à « ma commune dépense-t-elle plus que les communes comparables ? »
    suppose un groupe défini publiquement. Les critères viennent de l'OFGL, pas
    d'un découpage maison, et sont affichés avec le résultat. Les montants sont
    ramenés par habitant : comparer des totaux entre communes de tailles
    différentes n'aurait aucun sens.
    """
    lignes = conn.execute(
        f"""
        with base as (
            select o.indicator_id, o.period,
                   concat_ws('|', {", ".join(f"g.flags->>'{c}'" for c in CRITERES_GROUPE)})
                     as groupe,
                   o.value / nullif(pop.value, 0) as par_habitant
            from core.observations o
            join core.indicators i using (indicator_id)
            join geo.geography_reference g
              on g.geo_level = o.geo_level and g.geo_code = o.geo_code
             and g.vintage = o.geo_vintage
            join core.observations pop
              on pop.indicator_id = 'ofgl_population_reference'
             and pop.geo_level = o.geo_level and pop.geo_code = o.geo_code
             and pop.period = o.period
            where o.geo_level = 'commune' and i.published and i.unit = 'EUR'
              and o.value_status = 'normal' and g.flags ? 'tranche_population'
        )
        select indicator_id, period, groupe, count(*),
               percentile_cont(0.25) within group (order by par_habitant),
               percentile_cont(0.5) within group (order by par_habitant),
               percentile_cont(0.75) within group (order by par_habitant)
        from base where par_habitant is not null
        group by 1, 2, 3 having count(*) >= 20
        """
    ).fetchall()
    resultat: dict = defaultdict(lambda: defaultdict(dict))
    for indicateur, periode, groupe, effectif, q1, mediane, q3 in lignes:
        resultat[indicateur][periode][groupe] = {
            "n": effectif,
            "q1": round(float(q1), 2),
            "mediane": round(float(mediane), 2),
            "q3": round(float(q3), 2),
        }
    return {"criteres": CRITERES_GROUPE, "groupes": resultat}


def fraicheur(conn) -> list[dict]:
    """État public de chaque jeu : dernière mise à jour, retard, contrôles.

    La transparence opérationnelle fait partie du produit (docs/03 §6) : un
    chiffre vieux de deux ans doit se voir, pas se deviner.
    """
    return [
        {
            "jeu": jeu,
            "titre": titre,
            "priorite": priorite,
            "frequence": frequence,
            "derniere_extraction": extraction.isoformat(timespec="seconds") if extraction else None,
            "retard_jours": retard,
            "dernier_run": statut,
            "controles_echoues": controles,
        }
        for jeu, titre, priorite, frequence, extraction, retard, statut, controles in conn.execute(
            """
            select d.dataset_id, d.title, d.priority, d.update_frequency,
                   max(a.fetched_at) as extraction,
                   case when d.expected_freshness_days is null then null
                        else greatest(0, extract(day from now() - max(a.fetched_at))::int
                                       - d.expected_freshness_days) end,
                   (select r.status from meta.ingestion_runs r
                     where r.dataset_id = d.dataset_id order by r.started_at desc limit 1),
                   (select count(*) from meta.data_quality_checks c
                     where c.dataset_id = d.dataset_id and not c.passed and c.severity = 'blocker')
            from meta.dataset_registry d
            join meta.raw_assets a on a.dataset_id = d.dataset_id
            group by d.dataset_id, d.title, d.priority, d.update_frequency,
                     d.expected_freshness_days
            order by d.dataset_id
            """
        )
    ]


def territoires(conn, niveau: str) -> dict[str, dict]:
    return {
        code: {"nom": nom, "parent": parent, "population": population, "drapeaux": drapeaux}
        for code, nom, parent, population, drapeaux in conn.execute(
            """
            select geo_code, name, parent_code, population, flags
            from geo.geography_reference
            where geo_level = %s and vintage = (select max(vintage)
                from geo.geography_reference where geo_level = %s)
            """,
            (niveau, niveau),
        )
    }


def publier(conn, store, version: str) -> int:
    racine = f"data/{version}"
    fichiers = 0

    def deposer(chemin: str, charge) -> None:
        nonlocal fichiers
        store.put(f"{racine}/{chemin}", _json(charge))
        fichiers += 1

    deposer("manifeste.json", manifeste(conn, version))
    catalogue = indicateurs(conn)
    deposer("indicateurs.json", catalogue)

    recherche = []
    for niveau in NIVEAUX:
        entites = territoires(conn, niveau)
        valeurs = valeurs_par_niveau(conn, niveau)

        if niveau in NIVEAUX_CARTOGRAPHIES:
            for indicateur, periodes in valeurs.items():
                for periode, codes in periodes.items():
                    deposer(f"carte/{indicateur}/{niveau}/{periode}.json", codes)

        # Fiches : les communes sont réparties par département — un fichier par
        # commune ferait 34 875 objets à déposer à chaque publication.
        groupes: dict[str, dict] = defaultdict(dict)
        for code, entite in entites.items():
            lot = entite["parent"] if niveau == "commune" and entite["parent"] else "tous"
            series = {
                indicateur: {
                    periode: codes[code] for periode, codes in periodes.items() if code in codes
                }
                for indicateur, periodes in valeurs.items()
            }
            groupes[lot][code] = {**entite, "series": {k: v for k, v in series.items() if v}}
            recherche.append({"c": code, "n": entite["nom"], "l": niveau, "p": entite["parent"]})

        for lot, contenu in groupes.items():
            deposer(f"territoires/{niveau}/{lot}.json", contenu)

    deposer("recherche.json", recherche)
    deposer("comparaisons.json", comparaisons(conn))
    deposer("fraicheur.json", fraicheur(conn))
    store.put("data/derniere.json", _json({"version": version}), overwrite=True)
    print(f"publication {version} : {fichiers} fichiers, {len(recherche)} territoires")
    return fichiers


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--publication", default=".published")
    parser.add_argument("--version", default=datetime.now(UTC).strftime("%Y-%m-%dT%H%M"))
    args = parser.parse_args()
    conn = db.connect()
    try:
        publier(conn, make_store(args.publication), args.version)
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
